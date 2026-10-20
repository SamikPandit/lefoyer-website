"""The PENDING sweeper.

A customer who closes the PhonePe tab generates no callback at all. Without this
job their order sits at PENDING for ever: the storefront shows "completing
payment", the customer sees no resolution, and (under the old code) the stock
they never bought stayed held.

Every 5 minutes this asks the gateway about each prepaid order that has been
PENDING for longer than `PENDING_TTL_MINUTES`, and funnels the answer through
``orders/services.py``:

    gateway says COMPLETED -> confirm_order()   (they did pay; honour it)
    gateway says FAILED    -> fail_order()      (retryable; cart intact)
    gateway says CANCELLED -> cancel_order()
    still PENDING/unknown  -> cancel_order(final_state='EXPIRED')

The EXPIRED branch is the honest one. We do not know whether money moved, so the
customer is told exactly that, prominently, with their order reference - rather
than being shown a cheerful "cancelled" that might be a lie.

**Not yet scheduled.** `CELERY_BEAT_SCHEDULE` lives in `lefoyer/settings.py`,
which this package must not edit; the entry is raised as a cross-package
request. Until it is added the task is still runnable by hand
(``sweep_pending_orders.delay()`` or ``apply()``), and the customer's own
`payment-status` poll resolves their order in the meantime - the sweeper exists
for the customer who never comes back.
"""

import logging

from celery import shared_task
from django.utils import timezone

from . import services
from .models import Order

logger = logging.getLogger(__name__)

#: §2f: orders PENDING longer than this are resolved rather than left hanging.
PENDING_TTL_MINUTES = 30

#: Orders older than this are almost certainly pre-change-set rows with no
#: gateway record left. They are expired without a lookup, so one deploy does
#: not fire thousands of status calls at PhonePe.
STALE_CUTOFF_DAYS = 7


@shared_task(name='orders.tasks.sweep_pending_orders')
def sweep_pending_orders():
    """Resolve every prepaid order stuck at PENDING. Returns a counts dict."""
    now = timezone.now()
    cutoff = now - timezone.timedelta(minutes=PENDING_TTL_MINUTES)
    stale_cutoff = now - timezone.timedelta(days=STALE_CUTOFF_DAYS)

    candidates = Order.objects.filter(
        payment_status=Order.PENDING,
        payment_method=Order.PREPAID,
        created_at__lt=cutoff,
    ).order_by('created_at')

    counts = {
        'examined': 0,
        'completed': 0,
        'failed': 0,
        'cancelled': 0,
        'expired': 0,
        'unreachable': 0,
        'skipped_stale': 0,
    }

    for order in candidates.iterator():
        counts['examined'] += 1

        if order.created_at < stale_cutoff:
            services.cancel_order(
                order.id,
                reason='No payment was ever confirmed for this order.',
                final_state=Order.EXPIRED,
                source='sweeper-stale',
            )
            counts['expired'] += 1
            counts['skipped_stale'] += 1
            continue

        try:
            result = services.resolve_payment(order, source='sweeper')
        except services.OrderError as exc:
            # The gateway is unreachable. Leave the order PENDING and try again
            # on the next pass: expiring an order because *our* dependency is
            # down would be guessing.
            logger.warning(
                'Sweeper could not reach the gateway for %s: %s',
                order.order_number, exc.message,
            )
            counts['unreachable'] += 1
            continue
        except Exception:
            logger.exception('Sweeper failed on order %s.', order.order_number)
            counts['unreachable'] += 1
            continue

        state = result.get('state')
        if state == 'COMPLETED':
            counts['completed'] += 1
        elif state == 'FAILED':
            counts['failed'] += 1
        elif state == 'CANCELLED':
            counts['cancelled'] += 1
        else:
            # Still PENDING, or the gateway answered something we do not
            # recognise, and the TTL has passed.
            services.cancel_order(
                order.id,
                reason='The payment could not be confirmed within '
                       f'{PENDING_TTL_MINUTES} minutes.',
                final_state=Order.EXPIRED,
                source='sweeper-ttl',
            )
            counts['expired'] += 1

    if counts['examined']:
        logger.info('Pending-order sweep: %s', counts)
    return counts
