"""The single coupon evaluator.

Before this module there were two answers to "is this coupon good, and what is
it worth?":

* ``POST /api/coupons/validate/`` looked the code up with an active+window
  filter, returned the whole model via ``fields='__all__'`` and never looked at
  the basket total at all. It could not see `max_uses` and it could not see
  `min_order_amount`, so it happily told a customer a coupon applied when order
  creation would reject it.
* ``OrderViewSet.create`` called ``coupon.is_valid()`` (active + window +
  max_uses) *and* checked `min_order_amount`, then applied the percentage.

Two evaluators means the number shown in the cart and the number charged at
checkout are two different computations that only agree by luck. There is now
exactly one, ``evaluate_coupon``, and both callers use it.

The function is deliberately side-effect free: it reads, it decides, it returns.
Claiming a use (`used_count`) is a separate, explicitly-ordered step owned by
``orders.services``, because only the order path may consume a use.
"""

import logging
from decimal import Decimal, InvalidOperation

from django.db.models import F, Q
from django.utils import timezone

from .models import Coupon, quantize_money

logger = logging.getLogger(__name__)

# Machine-readable rejection reasons. The client switches on these; the
# human-readable `message` beside them is what gets rendered.
NOT_FOUND = 'NOT_FOUND'
INACTIVE = 'INACTIVE'
EXPIRED = 'EXPIRED'
NOT_YET_VALID = 'NOT_YET_VALID'
EXHAUSTED = 'EXHAUSTED'
MIN_ORDER_NOT_MET = 'MIN_ORDER_NOT_MET'
NO_BENEFIT = 'NO_BENEFIT'
INVALID_SUBTOTAL = 'INVALID_SUBTOTAL'
MISSING_CODE = 'MISSING_CODE'


class CouponError(Exception):
    """A coupon was rejected. Carries the machine-readable reason."""

    def __init__(self, reason, message, extra=None):
        super().__init__(message)
        self.reason = reason
        self.message = message
        self.extra = extra or {}

    def as_body(self):
        body = {'valid': False, 'reason': self.reason, 'message': self.message}
        body.update(self.extra)
        return body


def normalise_subtotal(raw):
    """Coerce a client-supplied subtotal to a non-negative Decimal.

    Raises CouponError(INVALID_SUBTOTAL) rather than returning 0, because
    silently treating a malformed subtotal as zero would then report
    MIN_ORDER_NOT_MET and send the customer hunting for a problem that is not
    theirs.
    """
    if raw is None or raw == '':
        raise CouponError(
            INVALID_SUBTOTAL,
            'An order subtotal is required to check a coupon.',
        )
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, ValueError, TypeError):
        raise CouponError(INVALID_SUBTOTAL, 'The order subtotal is not a valid amount.')
    if value.is_nan() or value.is_infinite() or value < 0:
        raise CouponError(INVALID_SUBTOTAL, 'The order subtotal is not a valid amount.')
    return quantize_money(value)


def evaluate_coupon(code, subtotal, user=None):
    """Evaluate `code` against `subtotal`.

    Returns a dict on success::

        {valid: True, code, coupon, discount_type, discount_value,
         discount_amount, subtotal, final_total, message}

    `coupon` is the model instance (the HTTP layer drops it; the order path
    needs it to claim a use). All money values are Decimals quantized to 2dp.

    Raises ``CouponError`` on every rejection, carrying a machine-readable
    `reason`. `user` is accepted and currently unused: there is no per-user
    redemption table in this schema, so a per-user cap cannot be enforced
    without inventing one. The parameter exists so that adding one later is a
    change inside this function and nowhere else.
    """
    if not code or not str(code).strip():
        raise CouponError(MISSING_CODE, 'Enter a coupon code.')

    code = str(code).strip()
    subtotal = normalise_subtotal(subtotal)

    # Unfiltered lookup first, exactly as orders/views.py did, so that an
    # expired or deactivated code can be told apart from a code that was never
    # issued. A single "invalid coupon" for both is what made the old endpoint
    # impossible to support.
    try:
        coupon = Coupon.objects.get(code__iexact=code)
    except Coupon.DoesNotExist:
        raise CouponError(NOT_FOUND, f'"{code}" is not a valid coupon code.')
    except Coupon.MultipleObjectsReturned:
        # `code` is unique, but uniqueness is case-sensitive while the lookup is
        # not, so FOO and foo can coexist. Prefer an exact match, else the
        # newest usable one, and log it so the duplicate gets cleaned up.
        logger.warning(
            'Multiple coupons match code %r case-insensitively; resolving to the exact match.',
            code,
        )
        coupon = (
            Coupon.objects.filter(code=code).first()
            or Coupon.objects.filter(code__iexact=code).order_by('-valid_to').first()
        )
        if coupon is None:  # pragma: no cover - defensive
            raise CouponError(NOT_FOUND, f'"{code}" is not a valid coupon code.')

    now = timezone.now()

    if not coupon.active:
        raise CouponError(INACTIVE, f'Coupon "{coupon.code}" is no longer available.')

    if now < coupon.valid_from:
        raise CouponError(
            NOT_YET_VALID,
            f'Coupon "{coupon.code}" is not valid yet.',
            {'valid_from': coupon.valid_from.isoformat()},
        )

    if now > coupon.valid_to:
        raise CouponError(
            EXPIRED,
            f'Coupon "{coupon.code}" expired on {coupon.valid_to.date().isoformat()}.',
            {'valid_to': coupon.valid_to.isoformat()},
        )

    if coupon.max_uses > 0 and coupon.used_count >= coupon.max_uses:
        raise CouponError(
            EXHAUSTED,
            f'Coupon "{coupon.code}" has been fully redeemed.',
        )

    min_order = Decimal(coupon.min_order_amount or 0)
    if min_order > 0 and subtotal < min_order:
        shortfall = quantize_money(min_order - subtotal)
        raise CouponError(
            MIN_ORDER_NOT_MET,
            f'Add {_rupees(shortfall)} more to use "{coupon.code}" '
            f'(minimum order {_rupees(min_order)}).',
            {
                'min_order_amount': str(quantize_money(min_order)),
                'shortfall': str(shortfall),
            },
        )

    discount_amount = coupon.compute_discount(subtotal)

    if discount_amount <= 0:
        # A configured-but-worthless coupon (value 0, or a cap of 0). Telling the
        # customer it "worked" and then charging full price is the worse outcome.
        raise CouponError(
            NO_BENEFIT,
            f'Coupon "{coupon.code}" does not reduce this order.',
        )

    final_total = quantize_money(subtotal - discount_amount)

    return {
        'valid': True,
        'code': coupon.code,
        'coupon': coupon,
        'discount_type': coupon.discount_type,
        'discount_value': quantize_money(coupon.discount_value or 0),
        'discount_amount': discount_amount,
        'subtotal': subtotal,
        'final_total': final_total,
        'message': _success_message(coupon, discount_amount),
    }


def claim_use(coupon):
    """Consume one redemption of `coupon`, atomically. Returns True on success.

    The conditional update is the whole point: two concurrent checkouts racing
    for the last use of a `max_uses=1` coupon cannot both win, because the
    WHERE clause re-tests exhaustion inside the UPDATE. The old code did an
    unconditional ``used_count = used_count + 1``, which could overshoot
    `max_uses` without anything noticing.
    """
    if coupon is None:
        return False
    claimed = (
        Coupon.objects.filter(pk=coupon.pk)
        .filter(Q(max_uses=0) | Q(used_count__lt=F('max_uses')))
        .update(used_count=F('used_count') + 1)
    )
    if claimed:
        logger.info('Claimed one use of coupon %s', coupon.code)
        return True
    logger.warning(
        'Could not claim coupon %s - it was exhausted between evaluation and claim.',
        coupon.code,
    )
    return False


def release_use(coupon):
    """Give a redemption back after a failed or cancelled order.

    Floored at zero: an over-release would let the coupon be used more times
    than it was issued for, which is the mirror image of the inventory-inflation
    bug this change-set exists to kill.
    """
    if coupon is None:
        return False
    released = (
        Coupon.objects.filter(pk=coupon.pk, used_count__gt=0)
        .update(used_count=F('used_count') - 1)
    )
    if released:
        logger.info('Released one use of coupon %s', coupon.code)
        return True
    logger.info('Nothing to release for coupon %s (used_count already 0).', coupon.code)
    return False


def _rupees(amount):
    return f'Rs.{quantize_money(amount):,.2f}'


def _percent(value):
    """Render a percentage without trailing zeros and without exponent notation.

    ``Decimal('10.00').normalize()`` is ``Decimal('1E+1')``, which printed as
    "1E+1% off" in a message shown to a customer. Strip the zeros by hand
    instead.
    """
    text = f'{Decimal(value or 0):.2f}'.rstrip('0').rstrip('.')
    return text or '0'


def _success_message(coupon, discount_amount):
    if coupon.discount_type == Coupon.FIXED:
        return f'Coupon applied - {_rupees(discount_amount)} off.'
    return (
        f'Coupon applied - {_percent(coupon.discount_value)}% off '
        f'({_rupees(discount_amount)}).'
    )
