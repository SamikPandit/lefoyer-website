"""Catalogue models.

The one thing to read before editing this file is the availability rule at the
top. IMPL_SPEC §2d defines product availability **once** for the whole system:

    visible   := show_at_website is True
    sellable  := visible AND manual_out_of_stock is False
                         AND stock_quantity > 0
                         AND coming_soon is False
    available_quantity := 0 if (manual_out_of_stock OR coming_soon
                                OR stock_quantity < 0) else stock_quantity

Five packages need that predicate (the catalogue filters and merchandising
rails here, the cart's add/update/merge checks, and order creation's
stock check and confirm-time re-check). Re-typing it in each of those places is
how the bug being fixed here was born in the first place: today
``ProductSerializer.get_available_quantity`` returns the raw
``stock_quantity`` and ignores ``manual_out_of_stock`` entirely, so a product a
human has switched off in the admin serialises as
``in_stock: false, available_quantity: 150``.

So the predicate lives here exactly once, in two interchangeable forms:

* ``SELLABLE_Q`` / ``sellable_q(prefix)`` — the ORM form, for querysets.
* ``Product.is_sellable`` / ``Product.available_quantity`` — the Python form,
  for a single instance already in memory (serializers, cart validation).

**Import them; do not re-express them.**  ``sellable_q()`` takes a relation
prefix so the same predicate can be applied while traversing a relation, e.g.
``Category.objects.annotate(product_count=Count('products',
filter=visible_q('products') & sellable_q('products'), distinct=True))``.

Note that ``SELLABLE_Q`` deliberately does **not** include the visibility
clause, because every public queryset already starts
``.filter(show_at_website=True)`` and the two are needed separately (the cart
has to be able to ask "is this row still sellable?" about a product it reached
through a foreign key). Use ``PUBLIC_SELLABLE_Q`` when you want both.
"""

from django.conf import settings
from django.db import models
from django.db.models import Case, IntegerField, Q, Value, When

# --------------------------------------------------------------------------
# IMPL_SPEC §2d — the canonical availability rule. Single definition.
# --------------------------------------------------------------------------

#: The sellability clauses, as (lookup, value) pairs so they can be re-based
#: onto a relation prefix. Changing availability means changing this tuple and
#: nothing else.
_SELLABLE_CLAUSES = (
    ('manual_out_of_stock', False),
    ('stock_quantity__gt', 0),
    ('coming_soon', False),
)

_VISIBLE_CLAUSES = (
    ('show_at_website', True),
)


def _build_q(clauses, prefix=''):
    lead = f'{prefix}__' if prefix else ''
    query = Q()
    for lookup, value in clauses:
        query &= Q(**{f'{lead}{lookup}': value})
    return query


def sellable_q(prefix=''):
    """§2d ``sellable`` minus the visibility clause, as a ``Q``.

    ``prefix`` is a relation path from the model being queried to ``Product``
    (``'products'`` from ``Category``, ``'product'`` from ``CartItem``).
    """
    return _build_q(_SELLABLE_CLAUSES, prefix)


def visible_q(prefix=''):
    """§2d ``visible``, as a ``Q``."""
    return _build_q(_VISIBLE_CLAUSES, prefix)


def public_sellable_q(prefix=''):
    """§2d ``sellable`` in full: visible *and* sellable."""
    return visible_q(prefix) & sellable_q(prefix)


#: Ready-made forms for the common case of querying ``Product`` itself.
SELLABLE_Q = sellable_q()
VISIBLE_Q = visible_q()
PUBLIC_SELLABLE_Q = public_sellable_q()


#: The alias the availability-first ordering annotation is published under.
#: §2d writes it as ``is_sellable``, but that name is already taken on this
#: model by the read-only property below, and Django raises
#: ``AttributeError: property 'is_sellable' of 'Product' object has no setter``
#: while hydrating rows from an annotated queryset. ``sellable_rank`` also
#: reads more honestly: the annotation is an ordering key (1/0), not a boolean.
SELLABLE_RANK = 'sellable_rank'


def is_sellable_annotation(prefix=''):
    """1 for a sellable row, 0 otherwise — for availability-first ordering.

    §2d: ``.annotate(**{SELLABLE_RANK: is_sellable_annotation()})
    .order_by('-sellable_rank', 'display_order', '-created_at')``.
    """
    return Case(
        When(sellable_q(prefix), then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
    )


def available_quantity_for(product):
    """§2d ``available_quantity`` for an in-memory product.

    Zero whenever the product is switched off by a human or not yet launched,
    which is the half the current serializer forgets.
    """
    if product.manual_out_of_stock or product.coming_soon:
        return 0
    if product.stock_quantity is None or product.stock_quantity < 0:
        return 0
    return product.stock_quantity


#: Shared low-stock copy threshold. The PDP currently says "only N left" below
#: 5 in one place and below 10 in another; both read this now.
LOW_STOCK_THRESHOLD = 5


class Category(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name


class SubCategory(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    category = models.ForeignKey(
        Category, related_name='sub_categories', on_delete=models.CASCADE
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = 'sub categories'
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name


class Concern(models.Model):
    """A "shop by concern" facet.

    Rows are created **only** from real catalogue evidence — see migration
    0008, which derives them 1:1 from the sub-categories that actually exist.
    LF-24 forbids inventing a navigation group, because a tile that leads to an
    empty listing is a dead link. The two extra concerns hardcoded in the dead
    frontend `ShopByConcern` component have no products behind them and are
    therefore not created here; one of them is also an unsubstantiated
    anti-ageing claim (LF-05).
    """

    # TODO(business): supply the customer-facing name, one-line description and
    # icon for each concern tile. Migration 0008 seeds each one from its
    # sub-category's own name and leaves `description` empty, because a concern
    # strapline is marketing copy and LF-05 forbids writing one here.
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True, default='')
    icon_key = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="A key the frontend maps to an icon. Not a file path.",
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name


class SkinType(models.Model):
    """A skin-type facet.

    Populated by migration 0008 from the six verified ``suitable_for`` strings
    by **exact** string match. Splitting those strings on ``,`` yields garbage
    (`" including Sensitive & Acne-Prone"`), which is why ``suitable_for``
    survives only as the human-readable display line while filtering moves to
    this M2M.
    """

    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    brand = models.CharField(max_length=100, default='Le foyeR.')
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    sub_category = models.ForeignKey(SubCategory, related_name='products', on_delete=models.CASCADE)
    concerns = models.ManyToManyField(Concern, blank=True, related_name='products')
    skin_types = models.ManyToManyField(SkinType, blank=True, related_name='products')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    description = models.TextField()
    key_benefits = models.TextField()
    key_features = models.TextField()
    ingredients = models.TextField()
    how_to_use = models.TextField()
    suitable_for = models.CharField(
        max_length=255,
        help_text="Human-readable suitability line. Filtering uses the "
                  "skin_types M2M, not this string.",
    )
    size = models.CharField(max_length=50)
    sku = models.CharField(max_length=100, unique=True)
    stock_quantity = models.IntegerField()
    is_featured = models.BooleanField(default=False)
    is_bestseller = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)
    coming_soon = models.BooleanField(
        default=False,
        help_text="Announced but not yet purchasable. Never sellable, "
                  "whatever the stock level says.",
    )
    # TODO(business): what is the approved merchandising order for the rails —
    # per SKU, the display_order, and which SKUs are is_featured /
    # is_bestseller / is_new? Every row ships at 0, so the rails currently fall
    # back to newest-first. Nothing here invents a ranking (IMPL_SPEC §4 LF-19).
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="Merchandising order, ascending. Lower sorts first. "
                  "Changing it reorders the homepage rails with no deploy.",
    )
    # rating / reviews_count are an un-editable cache of reviews.Review, kept
    # only so `?ordering=-rating` can hit an index. They are NOT served by
    # ProductSerializer (§2e mechanism 1), they are read-only in the admin
    # (§2e mechanism 2), and the only writers are the post_save/post_delete
    # receiver on Review and the `recompute_product_ratings` command.
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    reviews_count = models.IntegerField(default=0)
    image_main = models.ImageField(upload_to='products/')
    image_2 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_3 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_4 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_5 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_6 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_7 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_8 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_9 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_10 = models.ImageField(upload_to='products/', blank=True, null=True)
    amazon_link = models.URLField(max_length=500, blank=True, null=True, help_text="Optional Amazon product link")
    manual_out_of_stock = models.BooleanField(default=False, help_text="Manually mark product as out of stock regardless of quantity")
    show_at_website = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # REQUIRED, not cosmetic. Without a deterministic order the globally
        # paginated list view paginates an unordered queryset, so SQLite and
        # Postgres are both free to return a row on page 1 and again on page 2
        # while dropping another entirely (IMPL_SPEC §1 C-17).
        ordering = ['display_order', '-created_at']
        indexes = [
            models.Index(fields=['is_featured', 'display_order'], name='prod_feat_order_idx'),
            models.Index(fields=['stock_quantity'], name='prod_stock_idx'),
        ]

    def __str__(self):
        return self.name

    # -- §2d, the Python half of the availability rule ---------------------

    @property
    def is_sellable(self):
        """§2d ``sellable``, including the visibility clause.

        This is what ``ProductSerializer.in_stock`` reports and what the cart
        and order paths must gate on.
        """
        return bool(
            self.show_at_website
            and not self.manual_out_of_stock
            and not self.coming_soon
            and (self.stock_quantity or 0) > 0
        )

    @property
    def available_quantity(self):
        """§2d ``available_quantity``. Zero for a switched-off product."""
        return available_quantity_for(self)

    @property
    def is_low_stock(self):
        return self.is_sellable and self.available_quantity <= LOW_STOCK_THRESHOLD

    @property
    def effective_price(self):
        """The price actually charged: the discount if one is set AND positive.

        The `> 0` test must match `orders.services.effective_price` exactly. With a plain
        `is not None`, a `discount_price` of 0.00 made the catalogue and the cart display ₹0
        while order creation still charged the full `price`.
        """
        if self.discount_price and self.discount_price > 0:
            return self.discount_price
        return self.price

    @property
    def canonical_url(self):
        """Absolute PDP URL, matching the `/product/:slug` route in App.jsx."""
        return f"{settings.SITE_URL}/product/{self.slug}"


class StockNotification(models.Model):
    """A "notify me when available" request (endpoint #6).

    ``on_delete=PROTECT`` is deliberate: these rows are a consent record with a
    timestamp, so a product delete must fail loudly rather than quietly
    discarding them.
    """

    product = models.ForeignKey(
        Product, related_name='stock_notifications', on_delete=models.PROTECT
    )
    email = models.EmailField()
    consent_at = models.DateTimeField(
        help_text="When the customer ticked the consent box. Not the row's "
                  "creation time — this is the evidence of consent."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    notified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Set when the back-in-stock mail goes out. Null = still waiting.",
    )

    class Meta:
        unique_together = ('product', 'email')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.email} waiting on {self.product.name}'
