"""The order state machine. The ONLY place an order changes state.

=============================================================================
THE BUG THIS MODULE EXISTS TO KILL  (spec C-21, C-22, §2f)
=============================================================================

``OrderViewSet.create`` used to do all of this *before* PhonePe was contacted:

    create the Order  ->  decrement stock  ->  delete the cart
                      ->  queue "Order Confirmed!" email

So a customer who closed the PhonePe tab lost their basket, and the stock they
never bought sat held against an order that would never be paid. `Checkout.jsx`
called `clearCart()` before redirecting too, so the cart was destroyed twice.

It got worse on the way back. `payment_status` had no CANCELLED state and the
callback handled only `PAYMENT_SUCCESS` / `PAYMENT_ERROR`, so a cancelled or
timed-out payment was never even marked FAILED - the order simply stayed PENDING
for ever and the stock stayed held. And a **replayed** `PAYMENT_ERROR` called
``restore_stock_for_order`` a second time, *inflating* inventory: the shop now
believed it had more units than it had ever bought.

=============================================================================
THE SHAPE OF THE FIX
=============================================================================

Four public transitions, and nothing else may move an order:

    create_order()   PENDING (prepaid) or straight to confirm_order() (COD)
    confirm_order()  -> COMPLETED
    fail_order()     -> FAILED      (retryable; not terminal)
    cancel_order()   -> CANCELLED or EXPIRED

Every one of them:
  * runs in ``transaction.atomic()`` and takes ``select_for_update()`` on the
    order, so two concurrent callbacks serialise instead of interleaving;
  * is a **no-op** when the order is already terminal, and says so in its
    return value rather than raising;
  * is the sole owner of stock movement, cart clearing, coupon release, the
    confirmation email and the purchase-tracking flag.

Each side effect has its own latch column, because "the status is COMPLETED" is
not evidence that the stock decrement which should have accompanied it ran:

    stock_decremented  stock_restored  cart_cleared_at
    confirmation_email_sent_at         purchase_tracked_at

Stock moves down exactly once, in `confirm_order`. It moves back up exactly
once, in `fail_order`/`cancel_order`, **and only if it was ever taken** - so on
the normal prepaid-failure path restoring is a no-op, because nothing was taken.
That is the whole correction.
"""

import logging
from decimal import Decimal

from django.core.mail import mail_admins
from django.db import transaction, IntegrityError
from django.db.models import F, Q
from django.utils import timezone

from cart.models import Cart
from coupons.models import quantize_money
from coupons.services import CouponError, claim_use, evaluate_coupon, release_use
from products.models import Product

from .models import Order, OrderItem, PaymentAttempt

logger = logging.getLogger(__name__)

PAYMENT_METHODS = (Order.PREPAID, Order.COD)


class OrderError(Exception):
    """An order could not be created or moved. Carries a machine-readable code."""

    def __init__(self, code, message, extra=None, http_status=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.extra = extra or {}
        self.http_status = http_status

    def as_body(self):
        body = {'error': self.code, 'message': self.message, 'detail': self.message}
        body.update(self.extra)
        return body


# --------------------------------------------------------------------------- #
# §2d - the canonical availability rule, in its ORM form.
# --------------------------------------------------------------------------- #
def _product_has(field_name):
    """Whether `Product` carries `field_name` in this deployment.

    ``coming_soon`` is added by the catalogue package's `products.0006`
    migration, which may not have landed when this module is first imported.
    Feature-detecting rather than assuming means availability is still computed
    correctly - just without the `coming_soon` clause - instead of every
    availability query raising FieldError. Once `products.0006` is applied the
    clause is included automatically; nothing here needs changing then.
    """
    try:
        Product._meta.get_field(field_name)
        return True
    except Exception:
        return False


def sellable_q():
    """``Q`` matching a product that may be sold right now (§2d).

    ``sellable := visible AND NOT manual_out_of_stock AND stock_quantity > 0
                  AND NOT coming_soon``

    `visible` (`show_at_website`) is applied separately by callers that need it,
    because an item already in a cart is judged on sellability while visibility
    decides whether it may be *discovered* at all.
    """
    q = Q(manual_out_of_stock=False) & Q(stock_quantity__gt=0)
    if _product_has('coming_soon'):
        q &= Q(coming_soon=False)
    return q


def is_sellable(product):
    """The in-Python twin of `sellable_q`, for a product already in hand."""
    if getattr(product, 'manual_out_of_stock', False):
        return False
    if getattr(product, 'coming_soon', False):
        return False
    return (product.stock_quantity or 0) > 0


def is_visible(product):
    return bool(getattr(product, 'show_at_website', True))


def available_quantity(product):
    """``0`` when disabled or coming soon, never a negative number (§2d)."""
    if getattr(product, 'manual_out_of_stock', False):
        return 0
    if getattr(product, 'coming_soon', False):
        return 0
    quantity = product.stock_quantity or 0
    return quantity if quantity > 0 else 0


def effective_price(product):
    """`discount_price` when it is set and positive, else `price`."""
    discount_price = getattr(product, 'discount_price', None)
    if discount_price and discount_price > 0:
        return Decimal(discount_price)
    return Decimal(product.price)


def unavailable_reason(product, requested, available=None):
    """A machine-readable reason a line cannot be sold, or None if it can."""
    if not is_visible(product):
        return 'UNAVAILABLE'
    if getattr(product, 'coming_soon', False):
        return 'COMING_SOON'
    if getattr(product, 'manual_out_of_stock', False):
        return 'OUT_OF_STOCK'
    available = available_quantity(product) if available is None else available
    if available <= 0:
        return 'OUT_OF_STOCK'
    if requested > available:
        return 'INSUFFICIENT_STOCK'
    return None


# --------------------------------------------------------------------------- #
# Shipping
# --------------------------------------------------------------------------- #
def shipping_amount_for(subtotal):
    """Shipping charged on a basket worth `subtotal`, from the policy singleton.

    The threshold is compared against the **gross** subtotal, which is what the
    `free_shipping_threshold` field says ("order subtotal above which shipping
    is free") and the more generous of the two readings. A NULL threshold means
    shipping is free on every order, which is what the backend actually charged
    before this change - so the default alters nobody's total.
    """
    try:
        from content.models import PolicySetting

        policy = PolicySetting.load()
    except Exception as exc:  # content app absent or unmigrated
        logger.warning('Could not load the delivery policy (%s); shipping = 0.', exc)
        return quantize_money(0)

    threshold = policy.free_shipping_threshold
    charge = Decimal(policy.shipping_charge or 0)
    if threshold is None or charge <= 0:
        return quantize_money(0)
    if Decimal(subtotal) >= Decimal(threshold):
        return quantize_money(0)
    return quantize_money(charge)


def free_shipping_progress(subtotal):
    """``{threshold, remaining, qualified}`` for the cart's free-ship nudge."""
    try:
        from content.models import PolicySetting

        policy = PolicySetting.load()
    except Exception:
        return {'threshold': None, 'remaining': None, 'qualified': True}

    threshold = policy.free_shipping_threshold
    if threshold is None or Decimal(policy.shipping_charge or 0) <= 0:
        return {'threshold': None, 'remaining': None, 'qualified': True}
    remaining = Decimal(threshold) - Decimal(subtotal)
    return {
        'threshold': str(quantize_money(threshold)),
        'remaining': str(quantize_money(max(remaining, Decimal('0')))),
        'qualified': remaining <= 0,
    }


# --------------------------------------------------------------------------- #
# Pricing a basket
# --------------------------------------------------------------------------- #
def price_basket(lines, coupon_code=None, user=None):
    """Price `lines` (an iterable of ``(product, quantity)``).

    Returns ``{subtotal, discount_amount, discount_type, discount_value,
    shipping_amount, total, coupon, coupon_code, coupon_message}``.

    This is the single arithmetic used by the cart summary **and** by order
    creation, which is why the number quoted in the cart is the number charged
    at checkout. The coupon part delegates to
    ``coupons.services.evaluate_coupon``, the one evaluator that
    ``/api/coupons/validate/`` also uses (C-1).
    """
    subtotal = quantize_money(
        sum((effective_price(p) * q for p, q in lines), Decimal('0'))
    )

    discount_amount = quantize_money(0)
    discount_type = Order.PERCENT
    discount_value = quantize_money(0)
    coupon = None
    coupon_message = ''
    code = (coupon_code or '').strip()

    if code:
        evaluation = evaluate_coupon(code=code, subtotal=subtotal, user=user)
        coupon = evaluation['coupon']
        discount_amount = evaluation['discount_amount']
        discount_type = evaluation['discount_type']
        discount_value = evaluation['discount_value']
        coupon_message = evaluation['message']

    shipping = shipping_amount_for(subtotal)
    total = quantize_money(subtotal - discount_amount + shipping)

    return {
        'subtotal': subtotal,
        'discount_amount': discount_amount,
        'discount_type': discount_type,
        'discount_value': discount_value,
        'shipping_amount': shipping,
        'total': total,
        'coupon': coupon,
        'coupon_code': coupon.code if coupon else '',
        'coupon_message': coupon_message,
    }


# --------------------------------------------------------------------------- #
# 1. create_order
# --------------------------------------------------------------------------- #
def create_order(
    user,
    shipping_info,
    payment_method,
    coupon_code=None,
    idempotency_key=None,
):
    """Create an order from the user's cart. Returns ``(order, created)``.

    **It does not decrement stock, does not clear the cart and does not send a
    confirmation email.** For a PREPAID order those are `confirm_order`'s job,
    and `confirm_order` does not run until the money is confirmed. The cart
    therefore survives an abandoned gateway page with nothing to rebuild.

    For COD it calls `confirm_order` itself, because a COD order is confirmed at
    creation - there is no gateway in that path.

    `idempotency_key` comes from the ``Idempotency-Key`` request header. A
    repeated key returns the existing order with ``created=False``, so a
    double-click or an axios retry cannot mint two orders.
    """
    if payment_method not in PAYMENT_METHODS:
        # Explicit allowlist. The old code normalised ANY unrecognised string to
        # PREPAID, so a typo in the client silently created a prepaid order that
        # the customer was never asked to pay for.
        raise OrderError(
            'INVALID_PAYMENT_METHOD',
            "payment_method must be 'PREPAID' or 'COD'.",
            {'field': 'payment_method', 'allowed': list(PAYMENT_METHODS)},
        )

    if idempotency_key:
        existing = (
            Order.objects.filter(user=user, idempotency_key=idempotency_key)
            .order_by('created_at')
            .first()
        )
        if existing is not None:
            logger.info(
                'Idempotency-Key %s already created order %s; returning it.',
                idempotency_key, existing.order_number,
            )
            return existing, False

    cart = Cart.objects.filter(user=user).first()
    cart_items = list(cart.items.select_related('product').all()) if cart else []
    if not cart_items:
        raise OrderError(
            'EMPTY_CART', 'Your cart is empty. Add something to it first.'
        )

    # Read-only availability check (§2d). The authoritative, oversell-proof check
    # is the conditional UPDATE in `confirm_order`; this one exists to give the
    # customer an actionable answer before they are sent to a payment page.
    out_of_stock = []
    for item in cart_items:
        product = item.product
        reason = unavailable_reason(product, item.quantity)
        if reason:
            out_of_stock.append({
                'product_id': product.id,
                'product': product.name,
                'name': product.name,
                'reason': reason,
                'available': available_quantity(product),
                'requested': item.quantity,
            })
    if out_of_stock:
        raise OrderError(
            'OUT_OF_STOCK',
            'Some items in your cart are no longer available.',
            {'items': out_of_stock},
        )

    try:
        pricing = price_basket(
            [(item.product, item.quantity) for item in cart_items],
            coupon_code=coupon_code,
            user=user,
        )
    except CouponError as exc:
        raise OrderError(
            exc.reason,
            exc.message,
            dict(exc.extra, field='coupon_code', valid=False, reason=exc.reason),
        )

    try:
        with transaction.atomic():
            order = Order(
                user=user,
                first_name=shipping_info['first_name'],
                last_name=shipping_info['last_name'],
                email=shipping_info['email'],
                phone=shipping_info['phone'],
                address=shipping_info['address'],
                city=shipping_info['city'],
                state=shipping_info['state'],
                pincode=shipping_info['pincode'],
                subtotal=pricing['subtotal'],
                discount_amount=pricing['discount_amount'],
                discount_type=pricing['discount_type'],
                shipping_amount=pricing['shipping_amount'],
                total=pricing['total'],
                coupon=pricing['coupon'],
                coupon_code=pricing['coupon_code'],
                # The deprecated percentage column is kept consistent for PERCENT
                # coupons only, so historic reports keep working. Nothing reads it.
                discount=(
                    int(pricing['discount_value'])
                    if pricing['discount_type'] == Order.PERCENT
                    else 0
                ),
                payment_method=payment_method,
                paid=False,
                payment_status=Order.PENDING,
                idempotency_key=idempotency_key or None,
            )
            order.save()

            OrderItem.objects.bulk_create([
                OrderItem(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    product_sku=item.product.sku,
                    price=effective_price(item.product),
                    quantity=item.quantity,
                )
                for item in cart_items
            ])

            # Claim the coupon redemption here, at creation, so two checkouts cannot
            # both spend the last use of a max_uses=1 coupon. It is released again by
            # fail_order / cancel_order.
            if pricing['coupon'] is not None:
                if not claim_use(pricing['coupon']):
                    raise OrderError(
                        'EXHAUSTED',
                        f'Coupon "{pricing["coupon"].code}" was fully redeemed a '
                        f'moment ago. Remove it and try again.',
                        {'field': 'coupon_code', 'valid': False, 'reason': 'EXHAUSTED'},
                    )

    except IntegrityError:
        # Two submissions of the same Idempotency-Key raced past the read above and the
        # (user, idempotency_key) unique constraint settled it. The loser re-reads the
        # winner's order and returns the same shape as the fast path, so the customer gets
        # one order either way.
        if not idempotency_key:
            raise
        existing = Order.objects.filter(
            user=user, idempotency_key=idempotency_key
        ).order_by('created_at').first()
        if existing is None:
            raise
        logger.info(
            'Idempotency-Key %s lost a create race; returning order %s.',
            idempotency_key, existing.order_number,
        )
        return existing, False

    logger.info(
        'Created order %s (%s, %s) for user %s - cart retained, stock untouched.',
        order.order_number, order.payment_method, order.total, user.pk,
    )

    if payment_method == Order.COD:
        # No gateway in this path: a COD order is confirmed the moment it is
        # placed. confirm_order does the stock, cart, email and shipment work.
        confirm_order(order.id, source='cod-creation')
        order.refresh_from_db()

    return order, True


# --------------------------------------------------------------------------- #
# Payment attempts (no state transition - the order stays PENDING)
# --------------------------------------------------------------------------- #
def start_payment_attempt(order):
    """Open a gateway checkout session for `order`.

    Returns ``{redirect_url, merchant_order_id, attempt_id}``. Moves no state:
    the order is PENDING before and after. It is here rather than in `views.py`
    so that order creation, `initiate-payment` and `retry-payment` all produce
    exactly one response envelope - the old code had two different ones, which
    is why `Checkout.jsx` and `PaymentCompletionDialog.jsx` parsed the reply
    differently.

    The `PaymentAttempt` row is written **before** ``pay()`` is called, so if
    the HTTP call succeeds but our process dies before we record it, the
    attempt - and therefore any callback about it - is still resolvable.
    """
    from .payment import PhonePeAPIError, PhonePeGateway

    if order.paid or order.payment_status == Order.COMPLETED:
        raise OrderError('ALREADY_PAID', 'This order has already been paid.', http_status=409)
    if order.payment_status in (Order.CANCELLED, Order.EXPIRED, Order.REFUNDED):
        raise OrderError(
            'ORDER_CLOSED',
            f'This order is {order.get_payment_status_display().lower()} and cannot be paid.',
            {'payment_status': order.payment_status},
            http_status=409,
        )

    gateway = PhonePeGateway()
    attempt_number = order.attempts.count() + 1
    merchant_order_id = gateway.build_merchant_order_id(order.id, attempt_number)

    attempt = PaymentAttempt.objects.create(
        order=order,
        merchant_order_id=merchant_order_id,
        amount=order.total,
        state=PaymentAttempt.CREATED,
    )

    try:
        result = gateway.initiate_payment(order, merchant_order_id, order.total)
    except PhonePeAPIError as exc:
        attempt.state = PaymentAttempt.FAILED
        attempt.raw_response = {'error': str(exc)}
        attempt.save(update_fields=['state', 'raw_response', 'updated_at'])
        logger.error('Payment initiation failed for %s: %s', order.order_number, exc)
        raise OrderError(
            'PAYMENT_GATEWAY_UNAVAILABLE',
            'We could not reach the payment gateway. Your order is saved - '
            'please try the payment again in a moment.',
            {'payment_status': order.payment_status, 'order_id': order.id},
            http_status=503,
        )

    attempt.state = PaymentAttempt.PENDING
    attempt.raw_response = result.get('raw') or {}
    attempt.redirect_url = result['redirect_url']
    attempt.save(update_fields=['state', 'raw_response', 'redirect_url', 'updated_at'])

    # Keep the legacy column pointing at the latest attempt for operator
    # convenience; `PaymentAttempt` is the record of truth.
    Order.objects.filter(pk=order.pk).update(provider_order_id=merchant_order_id)
    order.provider_order_id = merchant_order_id

    return {
        'redirect_url': result['redirect_url'],
        'merchant_order_id': merchant_order_id,
        'attempt_id': attempt.id,
    }


# --------------------------------------------------------------------------- #
# 2. confirm_order
# --------------------------------------------------------------------------- #
def confirm_order(order_id, provider_payment_id=None, merchant_order_id=None, source=''):
    """Move an order to COMPLETED and run every confirmation side effect once.

    Returns ``{changed, payment_status, stock_decremented, cart_cleared,
    email_queued, shortfalls, needs_manual_review}``.

    No-op (``changed: False``) when the order is already terminal. A replayed
    success callback therefore sends **one** email and decrements stock **once**.

    The one remaining oversell window is between the read-only check in
    `create_order` and the conditional decrement here. If stock is short at this
    point the order is **still** marked COMPLETED - the money was taken, and
    pretending otherwise would be the bigger lie - but `needs_manual_review` is
    set, shipment generation is skipped and ops are emailed. Do not "fix" this
    by silently failing a paid order.
    """
    now = timezone.now()
    outcome = {
        'changed': False,
        'payment_status': None,
        'stock_decremented': False,
        'cart_cleared': False,
        'email_queued': False,
        'shortfalls': [],
        'needs_manual_review': False,
    }
    after_commit = []

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        outcome['payment_status'] = order.payment_status

        if order.payment_status in Order.TERMINAL_STATUSES:
            if order.payment_status != Order.COMPLETED:
                # A success arriving for an order the customer cancelled, or that
                # the sweeper expired. Money may have moved. That is a human
                # problem, and it is flagged as one rather than resolved by code.
                _flag_for_review(
                    order,
                    f'A payment success arrived from {source or "the gateway"} for an '
                    f'order already marked {order.payment_status}. Check whether the '
                    f'customer was charged and refund or fulfil deliberately.',
                )
                outcome['needs_manual_review'] = True
            logger.info(
                'confirm_order(%s) is a no-op: already %s.',
                order.order_number, order.payment_status,
            )
            return outcome

        items = list(order.items.select_related('product').all())

        # ---- stock, exactly once -----------------------------------------
        shortfalls = []
        if not order.stock_decremented:
            for item in items:
                updated = Product.objects.filter(
                    pk=item.product_id, stock_quantity__gte=item.quantity
                ).update(stock_quantity=F('stock_quantity') - item.quantity)
                if not updated:
                    shortfalls.append({
                        'product_id': item.product_id,
                        'product': item.product_name or str(item.product_id),
                        'requested': item.quantity,
                    })
            order.stock_decremented = True
            outcome['stock_decremented'] = True
            if shortfalls:
                outcome['shortfalls'] = shortfalls
                order.needs_manual_review = True
                order.review_note = (
                    (order.review_note + '\n') if order.review_note else ''
                ) + (
                    f'[{now.isoformat()}] Paid, but stock was short at confirmation '
                    f'for: {shortfalls}. Shipment generation was skipped. The '
                    f'customer HAS been charged.'
                )
                outcome['needs_manual_review'] = True
        else:
            logger.info(
                'confirm_order(%s): stock already decremented; not touching it again.',
                order.order_number,
            )

        # ---- the cart, exactly once ---------------------------------------
        if order.cart_cleared_at is None:
            cleared = _clear_cart_for_order(order, items)
            order.cart_cleared_at = now
            outcome['cart_cleared'] = True
            logger.info(
                'Cleared %s cart line(s) for order %s.', cleared, order.order_number
            )

        # ---- the state ----------------------------------------------------
        order.payment_status = Order.COMPLETED
        order.paid = True
        order.payment_failure_reason = ''
        if provider_payment_id:
            order.payment_id = provider_payment_id
        if merchant_order_id:
            order.provider_order_id = merchant_order_id

        # ---- the email, exactly once --------------------------------------
        if order.confirmation_email_sent_at is None:
            order.confirmation_email_sent_at = now
            outcome['email_queued'] = True
            after_commit.append(('email', order.id))

        order.save(update_fields=[
            'payment_status', 'paid', 'payment_id', 'provider_order_id',
            'payment_failure_reason', 'stock_decremented', 'cart_cleared_at',
            'confirmation_email_sent_at', 'needs_manual_review', 'review_note',
            'updated_at',
        ])

        if merchant_order_id:
            PaymentAttempt.objects.filter(merchant_order_id=merchant_order_id).update(
                state=PaymentAttempt.COMPLETED,
                provider_payment_id=provider_payment_id or '',
            )

        if not order.needs_manual_review:
            after_commit.append(('shipment', order.id))

        # on_commit, not an inline .delay(): the shipping signal used to dispatch
        # the Celery task from inside this transaction, so for COD the worker
        # could pick up an order id that had not been committed yet - and a
        # rolled-back order still dispatched a shipment.
        for kind, oid in after_commit:
            if kind == 'email':
                transaction.on_commit(lambda oid=oid: _queue_confirmation_email(oid))
            else:
                transaction.on_commit(lambda oid=oid: _queue_shipment(oid))

    outcome['changed'] = True
    outcome['payment_status'] = Order.COMPLETED

    if outcome['shortfalls']:
        _notify_ops_of_oversell(order_id, outcome['shortfalls'])

    logger.info(
        'confirm_order(%s) -> COMPLETED (source=%s, stock=%s, cart=%s, email=%s).',
        order_id, source or 'unspecified', outcome['stock_decremented'],
        outcome['cart_cleared'], outcome['email_queued'],
    )
    return outcome


# --------------------------------------------------------------------------- #
# 3. fail_order
# --------------------------------------------------------------------------- #
def fail_order(order_id, reason='', provider_payment_id=None, merchant_order_id=None,
               source=''):
    """Mark a payment as failed. FAILED is **not** terminal - the order is retryable.

    Returns ``{changed, payment_status, stock_restored, coupon_released}``.

    Restoring stock is guarded twice: by `stock_restored` so a replayed failure
    callback cannot restore twice, and by `stock_decremented` so nothing is
    "restored" that was never taken. On the normal prepaid-failure path both
    guards mean this does nothing to inventory, which is correct.
    """
    return _close_order(
        order_id,
        new_status=Order.FAILED,
        reason=reason or 'The payment did not complete.',
        provider_payment_id=provider_payment_id,
        merchant_order_id=merchant_order_id,
        attempt_state=PaymentAttempt.FAILED,
        source=source,
    )


# --------------------------------------------------------------------------- #
# 4. cancel_order
# --------------------------------------------------------------------------- #
def cancel_order(order_id, reason='', final_state=Order.CANCELLED,
                 merchant_order_id=None, source=''):
    """Cancel an unpaid order. Terminal.

    `final_state` is CANCELLED for a customer cancellation or a gateway-reported
    user cancellation, and EXPIRED when the 30-minute sweeper gives up on a
    payment it could never confirm. They are kept in one function because the
    bookkeeping is identical - restore stock if it was taken, release the coupon,
    close the order - and only the word shown to the customer differs.
    """
    if final_state not in (Order.CANCELLED, Order.EXPIRED):
        raise ValueError(
            f'cancel_order cannot move an order to {final_state!r}; '
            'only CANCELLED or EXPIRED.'
        )
    return _close_order(
        order_id,
        new_status=final_state,
        reason=reason or (
            'This payment could not be confirmed.'
            if final_state == Order.EXPIRED
            else 'The payment was cancelled.'
        ),
        provider_payment_id=None,
        merchant_order_id=merchant_order_id,
        attempt_state=PaymentAttempt.CANCELLED,
        source=source,
    )


def _close_order(order_id, new_status, reason, provider_payment_id,
                 merchant_order_id, attempt_state, source):
    """Shared body of fail_order / cancel_order."""
    outcome = {
        'changed': False,
        'payment_status': None,
        'stock_restored': False,
        'coupon_released': False,
    }

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order_id)
        outcome['payment_status'] = order.payment_status

        if order.payment_status in Order.TERMINAL_STATUSES:
            logger.info(
                '%s(%s) is a no-op: already %s.',
                new_status, order.order_number, order.payment_status,
            )
            return outcome

        if order.payment_status == new_status:
            # Already FAILED and failing again: refresh the reason, but do not
            # touch stock or the coupon a second time.
            if reason and order.payment_failure_reason != reason:
                order.payment_failure_reason = reason[:255]
                order.save(update_fields=['payment_failure_reason', 'updated_at'])
            logger.info('%s(%s) is a no-op: already %s.', new_status, order_id, new_status)
            return outcome

        # ---- stock back, exactly once, and only if it ever went out -------
        if order.stock_decremented and not order.stock_restored:
            if order.needs_manual_review:
                # A confirmation that found short stock decremented an unknown
                # subset of the lines. Restoring every line would create units
                # that were never taken - the exact inventory-inflation bug this
                # module exists to prevent. Leave it to a human.
                logger.error(
                    'Order %s is flagged for manual review; NOT auto-restoring '
                    'stock. Reconcile by hand.', order_id,
                )
            else:
                for item in order.items.all():
                    Product.objects.filter(pk=item.product_id).update(
                        stock_quantity=F('stock_quantity') + item.quantity
                    )
                order.stock_restored = True
                outcome['stock_restored'] = True
                logger.info('Restored stock for order %s.', order.order_number)

        # ---- the coupon redemption back, exactly once ----------------------
        # Only on a genuinely terminal status. FAILED is retryable: the order still exists and
        # still owes the discounted total, so releasing the redemption there would let one
        # max_uses=1 coupon be spent again by someone else while this order can still be paid.
        if order.coupon_id is not None and new_status in (Order.CANCELLED, Order.EXPIRED):
            if release_use(order.coupon):
                outcome['coupon_released'] = True
            # The code itself survives on `coupon_code`; dropping the FK is what
            # records that the redemption is no longer held by this order, and is
            # why `coupon_code` exists as a snapshot.
            order.coupon = None

        order.payment_status = new_status
        order.paid = False
        order.payment_failure_reason = (reason or '')[:255]
        if provider_payment_id:
            order.payment_id = provider_payment_id
        order.save(update_fields=[
            'payment_status', 'paid', 'payment_failure_reason', 'payment_id',
            'coupon', 'stock_restored', 'updated_at',
        ])

        if merchant_order_id:
            PaymentAttempt.objects.filter(merchant_order_id=merchant_order_id).update(
                state=attempt_state, provider_payment_id=provider_payment_id or ''
            )
        else:
            order.attempts.filter(
                state__in=[PaymentAttempt.CREATED, PaymentAttempt.PENDING]
            ).update(state=attempt_state)

    outcome['changed'] = True
    outcome['payment_status'] = new_status
    logger.info(
        '%s(%s) applied (source=%s, stock_restored=%s, coupon_released=%s).',
        new_status, order_id, source or 'unspecified',
        outcome['stock_restored'], outcome['coupon_released'],
    )
    return outcome


# --------------------------------------------------------------------------- #
# Resolving a payment against the gateway
# --------------------------------------------------------------------------- #
def resolve_payment(order, merchant_order_id=None, source=''):
    """Ask the gateway what really happened, then funnel into a transition.

    This is what makes the status endpoint and the callback trustworthy: neither
    believes what it was told. The callback is a *hint* that something changed;
    the answer comes from `get_order_status`.

    Returns ``{resolved, state, outcome, message}``. Raises
    ``OrderError('PAYMENT_GATEWAY_UNAVAILABLE', http_status=503)`` when the
    gateway cannot be reached - the caller must then report the order's stored
    status, which is PENDING, and never COMPLETED.
    """
    from .payment import STATE_COMPLETED, STATE_FAILED, STATE_CANCELLED
    from .payment import PhonePeAPIError, PhonePeGateway

    if order.payment_method == Order.COD:
        return {
            'resolved': False,
            'state': None,
            'outcome': None,
            'message': 'Cash on delivery orders are not settled through the gateway.',
        }

    merchant_order_id = merchant_order_id or _latest_merchant_order_id(order)
    if not merchant_order_id:
        return {
            'resolved': False,
            'state': None,
            'outcome': None,
            'message': 'No payment has been started for this order yet.',
        }

    gateway = PhonePeGateway()
    try:
        status = gateway.get_order_status(merchant_order_id)
    except PhonePeAPIError as exc:
        logger.warning(
            'Gateway status lookup failed for %s (%s): %s',
            order.order_number, merchant_order_id, exc,
        )
        raise OrderError(
            'PAYMENT_GATEWAY_UNAVAILABLE',
            'We could not confirm your payment with the gateway just now. '
            'Nothing has changed on your order - please refresh in a moment, '
            'and contact support with your order number if it persists.',
            {'payment_status': order.payment_status, 'order_id': order.id},
            http_status=503,
        )

    PaymentAttempt.objects.filter(merchant_order_id=merchant_order_id).update(
        raw_response=status.get('raw') or {},
        provider_payment_id=status.get('provider_payment_id') or '',
    )

    state = status['state']
    if state == STATE_COMPLETED:
        outcome = confirm_order(
            order.id,
            provider_payment_id=status.get('provider_payment_id'),
            merchant_order_id=merchant_order_id,
            source=source or 'gateway-status',
        )
    elif state == STATE_FAILED:
        outcome = fail_order(
            order.id,
            reason='The payment was declined or did not complete.',
            provider_payment_id=status.get('provider_payment_id'),
            merchant_order_id=merchant_order_id,
            source=source or 'gateway-status',
        )
    elif state == STATE_CANCELLED:
        outcome = cancel_order(
            order.id,
            reason='The payment was cancelled.',
            merchant_order_id=merchant_order_id,
            source=source or 'gateway-status',
        )
    else:
        # PENDING or UNKNOWN. Deliberately no transition: the sweeper resolves
        # it after the TTL rather than guessing now.
        return {
            'resolved': True,
            'state': state,
            'outcome': None,
            'message': 'The payment is still being processed.',
        }

    return {
        'resolved': True,
        'state': state,
        'outcome': outcome,
        'message': '',
    }


def _latest_merchant_order_id(order):
    attempt = order.attempts.order_by('-created_at').first()
    if attempt:
        return attempt.merchant_order_id
    return order.provider_order_id or None


# --------------------------------------------------------------------------- #
# Purchase tracking (§2g)
# --------------------------------------------------------------------------- #
def mark_purchase_tracked(order_id):
    """Close the exactly-once Meta Pixel `Purchase` window. Returns ``(ok, order)``.

    A conditional UPDATE, not a read-then-write: two tabs racing to report the
    same purchase must not both win. The loser gets ``ok=False``, which the view
    turns into a 409, which the client treats as "already tracked".
    """
    now = timezone.now()
    claimed = Order.objects.filter(
        pk=order_id, purchase_tracked_at__isnull=True, payment_status=Order.COMPLETED
    ).update(purchase_tracked_at=now)
    order = Order.objects.get(pk=order_id)
    return bool(claimed), order


# --------------------------------------------------------------------------- #
# Internals
# --------------------------------------------------------------------------- #
def _clear_cart_for_order(order, items):
    """Empty the basket this order was placed from.

    Only the lines for the products that were actually ordered are deleted.
    Between placing a prepaid order and its confirmation the customer may have
    added something new, and deleting that would be a smaller version of the
    bug this module exists to fix. In the normal case the two sets are identical
    and the cart ends up empty, which is what the customer expects.
    """
    cart = Cart.objects.filter(user=order.user).first()
    if cart is None:
        return 0
    product_ids = [item.product_id for item in items]
    deleted, _ = cart.items.filter(product_id__in=product_ids).delete()
    remaining = cart.items.count()
    if remaining:
        logger.info(
            'Order %s cleared %s cart line(s); %s line(s) added after the order '
            'was placed were left alone.', order.order_number, deleted, remaining,
        )
    return deleted


def _queue_confirmation_email(order_id):
    try:
        from accounts.tasks import send_order_confirmation_email_task

        send_order_confirmation_email_task.delay(order_id)
    except Exception as exc:
        # The order is confirmed and the latch is already set; a failed queueing
        # must not roll that back. It is logged loudly instead.
        logger.error(
            'Could not queue the confirmation email for order %s: %s', order_id, exc
        )


def _queue_shipment(order_id):
    try:
        from shipping.tasks import generate_shipment_for_order

        generate_shipment_for_order.delay(order_id)
    except Exception as exc:
        logger.error(
            'Could not queue shipment generation for order %s: %s', order_id, exc
        )


def _flag_for_review(order, note):
    stamped = f'[{timezone.now().isoformat()}] {note}'
    Order.objects.filter(pk=order.pk).update(
        needs_manual_review=True,
        review_note=(order.review_note + '\n' + stamped) if order.review_note else stamped,
    )
    logger.error('Order %s flagged for manual review: %s', order.order_number, note)


def _notify_ops_of_oversell(order_id, shortfalls):
    """Tell a human that a paid order could not take the stock it needed."""
    message = (
        f'Order {order_id} was paid, but stock was short at confirmation.\n\n'
        f'Short lines: {shortfalls}\n\n'
        f'The order is COMPLETED (the customer HAS been charged) and marked '
        f'needs_manual_review. Shipment generation was skipped. Either source the '
        f'stock or refund the affected lines - do not leave it to the software.'
    )
    logger.error(message)
    try:
        mail_admins(f'Oversell on order {order_id}', message, fail_silently=True)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error('Could not email ops about order %s: %s', order_id, exc)
