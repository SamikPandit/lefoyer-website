"""Rebuild the denormalised `Product.rating` / `Product.reviews_count` cache.

IMPL_SPEC §2e mechanism 2. Those two columns are **not** the source of truth
for anything a customer sees — `ProductSerializer` does not serve them, and
every star on the storefront comes from `review_summary`, which is computed
from `reviews.Review` rows. The columns survive only so that
`?ordering=-rating` and `?ordering=-reviews_count` can sort on an indexed
value instead of an aggregate.

Which means they can drift, and until this change-set they always had: there
was no writer for either column anywhere in the codebase except the Django
admin change form (§1 C-9), so they sat at `0.00 / 0` forever. The steady-state
writer is now a `post_save`/`post_delete` receiver on `Review` (WP-03). This
command is the other half: the backfill that makes the cache correct the first
time, and the repair after a bulk import, a restored dump, or a window in which
the receiver was not registered.

    python manage.py recompute_product_ratings            # rebuild everything
    python manage.py recompute_product_ratings --dry-run  # report drift only
    python manage.py recompute_product_ratings --slug spotless-face-wash

It is safe to run on production and safe to run repeatedly: it only ever
derives values from `Review` rows, and `--dry-run` writes nothing.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Avg, Count, Q

from products.models import Product
from products.serializers import review_has_field

ZERO = Decimal('0.00')


class Command(BaseCommand):
    help = (
        "Recompute Product.rating and Product.reviews_count from approved "
        "reviews. The storefront reads review_summary, not these columns; "
        "they exist so ?ordering=-rating can hit an index."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Report the drift and write nothing.",
        )
        parser.add_argument(
            '--slug',
            action='append',
            default=[],
            dest='slugs',
            help="Limit to these product slugs. Repeatable.",
        )
        parser.add_argument(
            '--include-hidden',
            action='store_true',
            help=(
                "Also recompute products with show_at_website=False. Off by "
                "default: a hidden product is never served, so its cache "
                "cannot be wrong in a way a customer can see."
            ),
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        slugs = options['slugs']

        approved = Q(reviews__is_approved=True) if review_has_field('is_approved') else Q()
        if not review_has_field('is_approved'):
            self.stderr.write(self.style.WARNING(
                "reviews.Review has no is_approved column yet (reviews/0002 is "
                "not applied), so every review is being counted. Re-run this "
                "command after that migration lands."
            ))

        queryset = Product.objects.all()
        if slugs:
            queryset = queryset.filter(slug__in=slugs)
            missing = set(slugs) - set(queryset.values_list('slug', flat=True))
            for slug in sorted(missing):
                self.stderr.write(self.style.WARNING(f"No product with slug {slug!r}."))
        if not options['include_hidden']:
            queryset = queryset.filter(show_at_website=True)

        queryset = queryset.annotate(
            fresh_count=Count('reviews', distinct=True, filter=approved),
            fresh_avg=Avg('reviews__rating', filter=approved),
        ).only('id', 'slug', 'rating', 'reviews_count')

        changed, unchanged = [], 0
        for product in queryset:
            count = product.fresh_count or 0
            if count:
                rating = Decimal(str(product.fresh_avg)).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
            else:
                # No approved reviews. The column goes to 0.00 because it is a
                # sort key and must be a number — this is precisely why it is
                # not served: `review_summary.average` reports null instead.
                rating = ZERO

            if product.rating == rating and product.reviews_count == count:
                unchanged += 1
                continue
            changed.append((product, rating, count))

        for product, rating, count in changed:
            self.stdout.write(
                f"{product.slug}: rating {product.rating} -> {rating}, "
                f"reviews_count {product.reviews_count} -> {count}"
            )

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"--dry-run: {len(changed)} product(s) would change, "
                f"{unchanged} already correct. Nothing written."
            ))
            return

        if changed:
            with transaction.atomic():
                for product, rating, count in changed:
                    product.rating = rating
                    product.reviews_count = count
                Product.objects.bulk_update(
                    [p for p, _, _ in changed], ['rating', 'reviews_count']
                )

        self.stdout.write(self.style.SUCCESS(
            f"Recomputed {len(changed)} product(s); {unchanged} already correct."
        ))
