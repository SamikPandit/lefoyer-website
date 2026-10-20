"""
Reviews 0002 — verification, moderation and one-review-per-customer.

IMPL_SPEC §2c (`reviews` 0002) and §2e.

**Production risk, stated plainly.** Operation 7 adds
`unique_together ('product', 'user')`. The live database has no such constraint
and therefore may hold several reviews by one account on one product. Adding
the constraint against that data fails mid-migration and leaves the schema
half-applied. Operation 6 is the mandatory guard: it finds every duplicated
`(product_id, user_id)` pair and deletes all but the newest row (newest by
`created_at`, tie-broken by the highest `id`), logging each pair and each
deleted id at WARNING so the operator has a record of exactly what went.

**That deletion is irreversible and it destroys customer-written text.** It must
be dry-run on a production *dump* first — §5.2 requires it. `reverse_dedupe` is
a documented no-op: dropping the constraint is reversible, resurrecting the
deleted rows is not.

`is_approved` defaults to **True** so every review already on the site stays
visible the moment this migration lands. `is_verified_purchase` defaults to
False and is *not* backfilled here: §2e computes it at creation time only.
Existing rows therefore render no "Verified Buyer" chip, which understates
rather than overstates — the safe direction.
"""

import logging

from django.conf import settings
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion

logger = logging.getLogger(__name__)


def dedupe_reviews(apps, schema_editor):
    """
    Collapse duplicate `(product, user)` reviews to the newest one.

    Pure ORM against the historical model, no raw SQL, so it behaves the same on
    SQLite and PostgreSQL. Idempotent: a second run finds no duplicates.
    """
    Review = apps.get_model('reviews', 'Review')

    pairs = (
        Review.objects.values('product_id', 'user_id')
        .annotate(n=models.Count('id'))
        .filter(n__gt=1)
        .order_by()
    )

    doomed = []
    pair_count = 0
    for pair in pairs:
        pair_count += 1
        ids = list(
            Review.objects.filter(
                product_id=pair['product_id'], user_id=pair['user_id']
            )
            .order_by('-created_at', '-id')
            .values_list('id', flat=True)
        )
        keep, drop = ids[0], ids[1:]
        logger.warning(
            'reviews.0002 de-dup: product=%s user=%s had %s reviews; keeping id=%s, '
            'deleting ids=%s',
            pair['product_id'],
            pair['user_id'],
            pair['n'],
            keep,
            drop,
        )
        doomed.extend(drop)

    if doomed:
        # Chunked so a pathological duplicate count cannot blow the SQLite
        # parameter limit.
        for start in range(0, len(doomed), 500):
            Review.objects.filter(id__in=doomed[start:start + 500]).delete()
        logger.warning(
            'reviews.0002 de-dup: deleted %s duplicate review row(s) across %s '
            '(product, user) pair(s).',
            len(doomed),
            pair_count,
        )
    else:
        logger.info('reviews.0002 de-dup: no duplicate (product, user) reviews found.')


def reverse_dedupe(apps, schema_editor):
    """
    Deliberately a no-op. Reversing this migration drops the unique constraint,
    which is enough to make the schema reversible; the deleted rows are gone and
    pretending otherwise would be dishonest.
    """
    logger.warning(
        'reviews.0002 reversed: the unique constraint is dropped, but reviews '
        'deleted by the de-dup step are NOT restored.'
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        # OrderItem exists from orders/0001_initial; 0004 is simply the latest
        # migration that already existed when this was written. Pinned to a
        # concrete, already-committed migration rather than to whatever is
        # newest, so a parallel package adding orders/0005+ cannot reorder this.
        ('orders', '0004_order_payment_method'),
        # Only needs the Product model itself, which 0001_initial creates.
        # Deliberately NOT pinned to the newest products migration: that would
        # couple this file to another package's in-flight numbering.
        ('products', '0001_initial'),
        ('reviews', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='review',
            options={'ordering': ['-created_at']},
        ),
        migrations.AddField(
            model_name='review',
            name='is_approved',
            field=models.BooleanField(
                default=True,
                help_text='Uncheck to hide a review from the storefront and from every average.',
            ),
        ),
        migrations.AddField(
            model_name='review',
            name='is_verified_purchase',
            field=models.BooleanField(
                default=False,
                help_text='Set automatically when the reviewer has a qualifying order. '
                          'Never accepted from the client.',
            ),
        ),
        migrations.AddField(
            model_name='review',
            name='order_item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviews',
                to='orders.orderitem',
            ),
        ),
        migrations.AddField(
            model_name='review',
            name='title',
            field=models.CharField(blank=True, default='', max_length=140),
        ),
        migrations.AlterField(
            model_name='review',
            name='rating',
            field=models.PositiveIntegerField(
                help_text='1 to 5. Enforced by the serializer and by these model validators.',
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(5),
                ],
            ),
        ),
        # MUST precede AlterUniqueTogether. See the module docstring.
        migrations.RunPython(dedupe_reviews, reverse_dedupe, elidable=False),
        migrations.AlterUniqueTogether(
            name='review',
            unique_together={('product', 'user')},
        ),
    ]
