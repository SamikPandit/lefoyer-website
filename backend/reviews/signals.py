"""
Keeps the `Product.rating` / `Product.reviews_count` cache honest
(IMPL_SPEC §2e mechanism 2).

Before this module existed, those two columns had **no writer at all** except
the Django admin text box (correction C-9), so every product sat at
`0.00 / 0` forever while the storefront printed fabricated stars from
`mockApi`. They are now a derived cache and nothing but these receivers (and
WP-02's `recompute_product_ratings` backfill command, which calls the same
function) is allowed to write them.

Two deliberate choices:

* **`transaction.on_commit`** — the recompute runs after the surrounding
  transaction commits, so it aggregates rows that are actually durable. Running
  it inline would, inside `ATOMIC_REQUESTS` or an explicit `atomic()` block,
  write a cache value derived from a review that may still be rolled back.
* **`dispatch_uid`** — connection is idempotent, so a reload of this module can
  never register a second receiver.
"""

import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save

from .models import Review, recompute_product_rating

logger = logging.getLogger(__name__)

SAVE_DISPATCH_UID = 'reviews.signals.recompute_on_review_save'
DELETE_DISPATCH_UID = 'reviews.signals.recompute_on_review_delete'


def _recompute(product_id):
    try:
        recompute_product_rating(product_id)
    except Exception:  # pragma: no cover - a cache refresh must never 500 a request
        # This runs after commit, so the review itself is already safe. Losing
        # the cache refresh only mis-sorts `?ordering=-rating`; the served
        # `review_summary` is computed live and stays correct either way.
        logger.exception('Failed to recompute rating cache for product %s', product_id)


def _schedule_recompute(product_id):
    if not product_id:
        return
    transaction.on_commit(lambda: _recompute(product_id))


def recompute_on_review_save(sender, instance, **kwargs):
    """Covers create, edit, an approval flip and a rating change alike."""
    _schedule_recompute(instance.product_id)


def recompute_on_review_delete(sender, instance, **kwargs):
    """
    Fires per row, including for the rows removed by a queryset `.delete()` and
    by a cascade, which is what makes `review_summary.count` and
    `Product.reviews_count` fall together.
    """
    _schedule_recompute(instance.product_id)


def register_receivers():
    """Called once from `ReviewsConfig.ready()`."""
    post_save.connect(
        recompute_on_review_save,
        sender=Review,
        dispatch_uid=SAVE_DISPATCH_UID,
    )
    post_delete.connect(
        recompute_on_review_delete,
        sender=Review,
        dispatch_uid=DELETE_DISPATCH_UID,
    )
