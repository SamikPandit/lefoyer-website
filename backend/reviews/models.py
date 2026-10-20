"""
Review model — the single source of truth for every rating on the site
(IMPL_SPEC §2e / LF-01).

Everything the storefront prints as a star, an average or a count is derived
from `Review` rows with `is_approved=True`. `Product.rating` and
`Product.reviews_count` survive only as a *cache* so `?ordering=-rating` can
hit an index; they are recomputed from here by `reviews.signals` and are
read-only in the admin. Nothing else may write them.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.apps import apps
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count, Q

from products.models import Product

RATING_MIN = 1
RATING_MAX = 5

#: The distribution buckets, highest first — the order the PDP histogram wants.
RATING_BUCKETS = (5, 4, 3, 2, 1)


class Review(models.Model):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(RATING_MIN), MaxValueValidator(RATING_MAX)],
        help_text='1 to 5. Enforced by the serializer and by these model validators.',
    )
    title = models.CharField(max_length=140, blank=True, default='')
    comment = models.TextField()

    # Computed once, server-side, at creation (§2e) and then never recomputed,
    # so a later refund cannot retroactively erase a genuine review.
    is_verified_purchase = models.BooleanField(
        default=False,
        help_text='Set automatically when the reviewer has a qualifying order. '
                  'Never accepted from the client.',
    )
    # Ship-safe default: existing rows stay visible on migration (§2c).
    is_approved = models.BooleanField(
        default=True,
        help_text='Uncheck to hide a review from the storefront and from every average.',
    )
    # The purchase the verification was derived from, kept as evidence. SET_NULL
    # so pruning order history never deletes a customer's words.
    order_item = models.ForeignKey(
        'orders.OrderItem',
        related_name='reviews',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        # One review per customer per product. The 0002 migration de-duplicates
        # existing pairs (keeping the newest) before this constraint is added.
        unique_together = ('product', 'user')

    def __str__(self):
        return f'Review for {self.product.name} by {self.user}'


def find_qualifying_order_item(user, product):
    """
    Return the `OrderItem` that makes `user` a verified buyer of `product`, or
    `None`.

    This is IMPL_SPEC §2e's query, with one correction the spec's own rationale
    demands. §2e writes the first arm as a bare
    `Q(order__payment_status='COMPLETED')` while explaining that "a COD order is
    marked COMPLETED at creation, which is *not* evidence of receipt". Both are
    true of this codebase: `orders/views.py:157` sets
    `payment_status='COMPLETED'` for COD at creation, so a bare COMPLETED arm
    would match every COD order and the delivered-shipment gate in the second
    arm could never bite. The arms are therefore made disjoint by payment
    method, which is exactly the behaviour §2e describes:

      * anything that is not COD   -> `payment_status='COMPLETED'` is the real
        prepaid settlement signal, written by the payment path;
      * COD                        -> additionally requires a delivered
        shipment (`shipping.Shipment.status == 'delivered'`).

    `apps.get_model` is used instead of a module-level import so this module
    does not pin the import order of the orders app.
    """
    OrderItem = apps.get_model('orders', 'OrderItem')
    return (
        OrderItem.objects.filter(order__user=user, product=product)
        .filter(
            (Q(order__payment_status='COMPLETED') & ~Q(order__payment_method='COD'))
            | Q(order__payment_method='COD', order__shipment__status='delivered')
        )
        .order_by('-order__created_at', '-id')
        .first()
    )


def empty_review_summary():
    """The §2e `review_summary` for a product with no approved reviews."""
    return {
        'average': None,
        'count': 0,
        'distribution': {str(bucket): 0 for bucket in RATING_BUCKETS},
        'verified_count': 0,
    }


def build_review_summary(product):
    """
    The canonical `review_summary` payload (§2e mechanism 3).

    One grouped query. `average` is **`None`** when `count == 0` — never `0`,
    because an unreviewed product has no rating, and the UI must be able to
    tell "no rating" from "a bad rating".

    `product` may be a `Product` instance or a primary key. Importable by any
    package that needs the same numbers (the product serializer, the
    `review-summary/` action) so there is exactly one implementation.
    """
    product_id = getattr(product, 'pk', product)
    if product_id is None:
        return empty_review_summary()

    aggregates = {
        'average': Avg('rating'),
        'count': Count('id'),
        'verified_count': Count('id', filter=Q(is_verified_purchase=True)),
    }
    for bucket in RATING_BUCKETS:
        aggregates[f'bucket_{bucket}'] = Count('id', filter=Q(rating=bucket))

    row = Review.objects.filter(product_id=product_id, is_approved=True).aggregate(**aggregates)

    count = row['count'] or 0
    average = None
    if count and row['average'] is not None:
        average = float(Decimal(str(row['average'])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

    return {
        'average': average,
        'count': count,
        'distribution': {str(bucket): row[f'bucket_{bucket}'] or 0 for bucket in RATING_BUCKETS},
        'verified_count': row['verified_count'] or 0,
    }


def recompute_product_rating(product_id):
    """
    Refresh the `Product.rating` / `Product.reviews_count` cache from the
    approved reviews of one product (§2e mechanism 2).

    Written with `queryset.update()` on purpose: it is a single UPDATE, it does
    not fire `Product` save signals, and it cannot clobber a concurrently-saved
    Product row with stale in-memory field values. A product that has just been
    deleted simply matches zero rows.

    Returns `(rating, reviews_count)` as written.
    """
    if not product_id:
        return Decimal('0.00'), 0

    row = Review.objects.filter(product_id=product_id, is_approved=True).aggregate(
        average=Avg('rating'), count=Count('id')
    )
    count = row['count'] or 0
    if count and row['average'] is not None:
        rating = Decimal(str(row['average'])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        # No approved reviews -> the cache goes back to zero. The *served*
        # average is `null` (see build_review_summary); this column is only an
        # ordering key, and 0.00 is the right sort position for "unrated".
        rating = Decimal('0.00')

    Product.objects.filter(pk=product_id).update(rating=rating, reviews_count=count)
    return rating, count
