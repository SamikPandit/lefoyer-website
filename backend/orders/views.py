"""Order and payment endpoints.

Every state change in here delegates to ``orders/services.py``. These views
validate input, decide an HTTP status and shape a response; they do not touch
stock, carts, coupons, emails or the pixel flag. That separation is the whole
point: there used to be four places that could mark an order paid (`create`,
`complete_payment`, `InitiatePaymentView`, `PaymentCallbackView`) and they did
not agree with each other.

The callback (``POST /api/orders/payment/callback/``) deserves its own note. It
is treated as a **hint**, not as a fact: it is authenticated, de-duplicated and
recorded, and then the order's real state is re-fetched from the gateway with
``get_order_status``. Nothing marks an order paid on the strength of an inbound
HTTP body - which is what the previous version did, with a V1 checksum it could
never have computed for the V2 client it paid with.
"""

import logging

from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Order, ProcessedCallback
from .serializers import (
    CancelOrderSerializer,
    MarkPurchaseTrackedSerializer,
    OrderCreateSerializer,
    OrderItemSerializer,
    OrderSerializer,
    PaymentMethodSerializer,
    money,
)
from .services import OrderError

logger = logging.getLogger(__name__)

#: What the customer may usefully do next, per state (§2f's last column). Sent
#: as codes rather than copy so the wording lives in the frontend content
#: modules and can change without a backend deploy.
NEXT_ACTIONS = {
    Order.PENDING: ['RETRY_PAYMENT', 'RESTORE_CART', 'CONTACT_SUPPORT'],
    Order.FAILED: ['RETRY_PAYMENT', 'RESTORE_CART', 'CONTACT_SUPPORT'],
    Order.CANCELLED: ['RETRY_PAYMENT', 'RESTORE_CART', 'CONTACT_SUPPORT'],
    Order.EXPIRED: ['CONTACT_SUPPORT', 'RESTORE_CART'],
    Order.COMPLETED: ['VIEW_ORDER', 'CONTINUE_SHOPPING', 'CONTACT_SUPPORT'],
    Order.REFUNDED: ['VIEW_ORDER', 'CONTACT_SUPPORT'],
}

STATE_MESSAGES = {
    Order.PENDING: 'Order {number} created - completing payment.',
    Order.COMPLETED: 'Order placed successfully.',
    Order.FAILED: (
        'Payment failed. Order {number} is awaiting payment - you have not been '
        'charged. Your cart is still here.'
    ),
    Order.CANCELLED: (
        'Payment cancelled. Order {number} was not completed. Nothing has been charged.'
    ),
    Order.EXPIRED: (
        'We could not confirm this payment. If you were charged we will refund it '
        'automatically - reference {number}.'
    ),
    Order.REFUNDED: 'This order has been refunded.',
}


def state_message(order):
    template = STATE_MESSAGES.get(order.payment_status, '')
    return template.format(number=order.order_number)


class OrderViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Read your own orders; create one; move its payment along.

    Deliberately not a `ModelViewSet`: the original exposed PUT, PATCH and
    DELETE on orders to their owner, so a customer could rewrite the total of an
    order they had already placed.
    """

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .select_related('coupon')
            .prefetch_related('items__product', 'attempts')
        )

    # ------------------------------------------------------------------ create
    def create(self, request, *args, **kwargs):
        """Create an order from the cart.

        For PREPAID this **does not** take stock, **does not** clear the cart and
        **does not** send a confirmation email - it returns the gateway
        `redirect_url` and `cart_retained: true`. An abandoned payment therefore
        costs the customer nothing: their basket is exactly where they left it.
        """
        serializer = OrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                _field_error_body(serializer.errors),
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        idempotency_key = (request.headers.get('Idempotency-Key') or '').strip()[:64]

        try:
            order, created = services.create_order(
                user=request.user,
                shipping_info=data['shipping_info'],
                payment_method=data['payment_method'],
                coupon_code=data.get('coupon_code') or '',
                idempotency_key=idempotency_key or None,
            )
        except OrderError as exc:
            return Response(exc.as_body(), status=exc.http_status)

        payment = None
        if created and order.payment_method == Order.PREPAID:
            # The gateway call is outside create_order's transaction on purpose:
            # a network round trip inside an open transaction holds row locks for
            # as long as the gateway feels like taking.
            try:
                payment = services.start_payment_attempt(order)
            except OrderError as exc:
                # The order exists and is PENDING. Report the gateway problem
                # without discarding the order - the customer can retry the
                # payment on it, and their cart is still intact either way.
                body = _order_create_body(order, payment=None, request=request)
                body.update(exc.as_body())
                return Response(body, status=exc.http_status)

        order.refresh_from_db()
        return Response(
            _order_create_body(order, payment, request),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    # --------------------------------------------------------- initiate payment
    @action(detail=True, methods=['post'], url_path='initiate-payment')
    def initiate_payment(self, request, pk=None):
        """Open (or re-open) a gateway session for an existing order.

        One envelope - ``{redirect_url, merchant_order_id, attempt_id}`` - shared
        with `retry-payment`. The old pair returned ``{success, redirect_url}``
        from one endpoint and ``{redirect_url}`` from the other, which is why the
        checkout page and the payment dialog parsed the reply differently and one
        of them was always wrong.
        """
        return self._start_payment(request, self.get_object())

    @action(detail=True, methods=['post'], url_path='retry-payment')
    def retry_payment(self, request, pk=None):
        """Retry payment on the same order, as a new `PaymentAttempt`."""
        order = self.get_object()

        if order.has_shipment:
            return Response(
                {'error': 'ALREADY_SHIPPED',
                 'message': 'This order has already been handed to the courier.'},
                status=status.HTTP_409_CONFLICT,
            )

        # Re-check availability before sending someone back to a payment page for
        # goods that have since sold out.
        shortfalls = []
        for item in order.items.select_related('product').all():
            reason = services.unavailable_reason(item.product, item.quantity)
            if reason:
                shortfalls.append({
                    'product_id': item.product_id,
                    'product': item.product_name or item.product.name,
                    'name': item.product_name or item.product.name,
                    'reason': reason,
                    'available': services.available_quantity(item.product),
                    'requested': item.quantity,
                })
        if shortfalls:
            return Response(
                {'error': 'OUT_OF_STOCK',
                 'message': 'Some items on this order are no longer available.',
                 'items': shortfalls},
                status=status.HTTP_409_CONFLICT,
            )

        return self._start_payment(request, order)

    @action(detail=True, methods=['post'])
    def complete_payment(self, request, pk=None):
        """DEPRECATED alias of `retry-payment`, kept for clients already shipped.

        It used to mark a COD order COMPLETED and flip `paid` by hand, which is
        exactly the sort of second writer this change-set removes. It now
        funnels into the same services functions as everything else.
        """
        return self.retry_payment(request, pk=pk)

    def _start_payment(self, request, order):
        serializer = PaymentMethodSerializer(data=request.data or {})
        if not serializer.is_valid():
            return Response(
                _field_error_body(serializer.errors), status=status.HTTP_400_BAD_REQUEST
            )
        payment_method = serializer.validated_data['payment_method']

        if order.paid or order.payment_status == Order.COMPLETED:
            return Response(
                {'error': 'ALREADY_PAID', 'message': 'This order has already been paid.'},
                status=status.HTTP_409_CONFLICT
                if request.path.endswith('retry-payment/')
                else status.HTTP_400_BAD_REQUEST,
            )

        if payment_method != order.payment_method:
            Order.objects.filter(pk=order.pk).update(payment_method=payment_method)
            order.payment_method = payment_method

        if payment_method == Order.COD:
            # No gateway: a COD order is confirmed here and now.
            services.confirm_order(order.id, source='cod-retry')
            order.refresh_from_db()
            return Response(
                {
                    'payment_status': order.payment_status,
                    'order_id': order.id,
                    'order_number': order.order_number,
                    'message': state_message(order),
                },
                status=status.HTTP_200_OK,
            )

        try:
            payment = services.start_payment_attempt(order)
        except OrderError as exc:
            return Response(exc.as_body(), status=exc.http_status)
        return Response(payment, status=status.HTTP_200_OK)

    # --------------------------------------------------------- payment status
    @action(detail=True, methods=['get'], url_path='payment-status')
    def payment_status(self, request, pk=None):
        """The authoritative payment state. Never optimistic.

        If the gateway cannot be reached this answers **503** carrying the
        order's stored status - which is PENDING - and an honest message. It
        does not report COMPLETED on a failed lookup, and it does not read the
        outcome from a query parameter. `OrderConfirmation.jsx` used to do both:
        ``setPaymentStatus(status || 'success')`` defaulted an unverified,
        client-supplied value to success.
        """
        order = self.get_object()
        ref = (request.query_params.get('ref') or '').strip() or None

        if ref and not order.attempts.filter(merchant_order_id=ref).exists():
            # A ref that does not belong to this order is ignored rather than
            # queried, so nobody can aim our status lookup at someone else's
            # payment by editing the URL.
            logger.warning(
                'Ignoring ref %r on payment-status for order %s: not one of its attempts.',
                ref, order.order_number,
            )
            ref = None

        message = ''
        # Re-verify for every retryable status, not just PENDING. A FAILED order is explicitly
        # retryable (Order.RETRYABLE_STATUSES) and `retry_payment` opens a new PaymentAttempt
        # without moving the order back to PENDING. Gating on PENDING alone meant a customer who
        # was declined once and then paid successfully on the retry landed on a page still
        # rendering "you have not been charged", with a Retry button that would charge them again.
        if order.payment_status in Order.RETRYABLE_STATUSES and order.payment_method == Order.PREPAID:
            try:
                result = services.resolve_payment(
                    order, merchant_order_id=ref, source='payment-status'
                )
                message = result.get('message') or ''
            except OrderError as exc:
                body = _payment_status_body(order, request, message=exc.message)
                body['error'] = exc.code
                return Response(body, status=exc.http_status)
            order.refresh_from_db()

        return Response(
            _payment_status_body(order, request, message=message),
            status=status.HTTP_200_OK,
        )

    # ----------------------------------------------------------------- cancel
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Customer-initiated cancellation of an unpaid order."""
        serializer = CancelOrderSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=False)
        reason = (serializer.validated_data.get('reason') or '').strip()

        order = self.get_object()

        if order.payment_status == Order.COMPLETED or order.paid:
            return Response(
                {
                    'error': 'ALREADY_PAID',
                    'message': 'This order is paid and cannot be cancelled here. '
                               'Contact support to arrange a return or refund.',
                },
                status=status.HTTP_409_CONFLICT,
            )
        if order.payment_status in (Order.CANCELLED, Order.EXPIRED, Order.REFUNDED):
            return Response(
                {
                    'order_id': order.id,
                    'payment_status': order.payment_status,
                    'stock_restored': False,
                    'coupon_released': False,
                    'message': state_message(order),
                },
                status=status.HTTP_200_OK,
            )

        outcome = services.cancel_order(
            order.id,
            reason=f'Cancelled by the customer. {reason}'.strip(),
            source='customer-cancel',
        )
        order.refresh_from_db()
        return Response(
            {
                'order_id': order.id,
                'order_number': order.order_number,
                'payment_status': order.payment_status,
                'stock_restored': outcome['stock_restored'],
                'coupon_released': outcome['coupon_released'],
                'message': state_message(order),
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------- purchase tracking (§2g)
    @action(detail=True, methods=['post'], url_path='mark-purchase-tracked')
    def mark_purchase_tracked(self, request, pk=None):
        """Close the exactly-once Meta Pixel `Purchase` window, server-side.

        409 on the second call. That is what makes a refresh, a second tab, a
        back-navigation or a shared confirmation link fire nothing - rather than
        a `localStorage` flag, which is per-browser and clears itself.
        """
        serializer = MarkPurchaseTrackedSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=False)
        order = self.get_object()

        if order.payment_status != Order.COMPLETED:
            return Response(
                {
                    'error': 'NOT_COMPLETED',
                    'message': 'This order is not completed, so there is no purchase '
                               'to track.',
                    'payment_status': order.payment_status,
                },
                status=status.HTTP_409_CONFLICT,
            )

        claimed, order = services.mark_purchase_tracked(order.id)
        if not claimed:
            return Response(
                {
                    'error': 'ALREADY_TRACKED',
                    'message': 'This purchase has already been tracked.',
                    'purchase_tracked': True,
                    'tracked_at': order.purchase_tracked_at,
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            {'purchase_tracked': True, 'tracked_at': order.purchase_tracked_at},
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------------------------------- #
# Response builders
# --------------------------------------------------------------------------- #
def _order_create_body(order, payment, request):
    return {
        'id': order.id,
        'order_id': order.id,
        'order_number': order.order_number,
        'payment_status': order.payment_status,
        'payment_method': order.payment_method,
        'status': order.status,
        'subtotal': money(order.subtotal),
        'discount_amount': money(order.discount_amount),
        'discount_type': order.discount_type,
        'coupon_code': order.coupon_code,
        'shipping_amount': money(order.shipping_amount),
        'total': money(order.total),
        'currency': 'INR',
        'items': OrderItemSerializer(
            order.items.select_related('product').all(),
            many=True,
            context={'request': request},
        ).data,
        # True whenever the basket still holds what it held: every PREPAID order
        # at creation, and False only once confirm_order has emptied it.
        'cart_retained': order.cart_cleared_at is None,
        'payment': payment,
        'message': state_message(order),
    }


def _payment_status_body(order, request, message=''):
    attempt = order.attempts.order_by('-created_at').first()
    return {
        'order_id': order.id,
        'order_number': order.order_number,
        'payment_status': order.payment_status,
        'status': order.status,
        'paid': order.paid,
        'payment_method': order.payment_method,
        'provider_reference': attempt.merchant_order_id if attempt else '',
        'subtotal': money(order.subtotal),
        'discount_amount': money(order.discount_amount),
        'shipping_amount': money(order.shipping_amount),
        'total': money(order.total),
        'currency': 'INR',
        'items': OrderItemSerializer(
            order.items.select_related('product').all(),
            many=True,
            context={'request': request},
        ).data,
        'can_retry': order.can_retry_payment,
        'purchase_event_pending': order.purchase_event_pending,
        'next_actions': NEXT_ACTIONS.get(order.payment_status, ['CONTACT_SUPPORT']),
        'message': message or state_message(order),
        'failure_reason': order.payment_failure_reason,
        'verified_at': timezone.now(),
    }


def _field_error_body(errors):
    """Flatten DRF errors into ``{error, message, field, errors}``.

    One shape for every rejection, because `api.js`'s `getApiErrorMessage` has
    to find a sentence somewhere and the original endpoints offered it four
    different places to look.
    """
    field, message = _first_error(errors)
    return {
        'error': 'VALIDATION_ERROR',
        'message': message,
        'detail': message,
        'field': field,
        'errors': errors,
    }


def _first_error(errors, prefix=''):
    if isinstance(errors, dict):
        for key, value in errors.items():
            name = f'{prefix}{key}' if not prefix else f'{prefix}.{key}'
            return _first_error(value, prefix=name)
    if isinstance(errors, (list, tuple)) and errors:
        return prefix, str(errors[0])
    return prefix or None, str(errors)


# --------------------------------------------------------------------------- #
# The gateway callback
# --------------------------------------------------------------------------- #
@method_decorator(csrf_exempt, name='dispatch')
class PaymentCallbackView(APIView):
    """``POST /api/orders/payment/callback/`` - PhonePe server-to-server.

    Order of operations, and why:

      1. **Authenticate** the V2 ``Authorization`` header. An unauthenticated
         callback must never be able to move an order, so a missing or wrong
         header is a 401 and nothing else happens. The previous version accepted
         any body without a ``response`` key and answered ``{'status':'ok'}``,
         writing nothing at all.
      2. **Parse and de-duplicate** on the gateway's event id via
         `ProcessedCallback`. PhonePe retries; a replay must be a no-op that
         still answers 200, or it retries for ever.
      3. **Persist the raw payload** before acting, so an unparseable or novel
         message is still available to a human afterwards.
      4. **Re-verify with `get_order_status`** and funnel into
         ``orders/services.py``. The callback is a hint that something changed;
         it is not evidence of what.

    Answers 200 for everything understood, duplicates included, and 401 only on
    a genuine authentication failure.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    # The shared-secret Authorization header is the gate here, not a rate limit. Leaving the
    # global AnonRateThrottle on would 429 PhonePe from the 30th callback a minute, and a
    # throttled callback is a payment outcome we never hear about.
    throttle_classes = []

    def post(self, request):
        from .payment import PhonePeAPIError, PhonePeGateway

        gateway = PhonePeGateway()
        authorization = request.headers.get('Authorization') or request.headers.get(
            'authorization'
        )
        if not gateway.verify_callback_auth(authorization):
            logger.error(
                'Rejected a PhonePe callback: Authorization header did not verify.'
            )
            return Response(
                {'error': 'UNAUTHORIZED'}, status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            parsed = gateway.parse_callback(request.data)
        except PhonePeAPIError as exc:
            logger.error('Unparseable PhonePe callback: %s', exc)
            ProcessedCallback.objects.get_or_create(
                event_key=f'unparseable:{timezone.now().timestamp()}',
                defaults={'payload': _safe_payload(request.data)},
            )
            # 200: a 4xx makes the gateway retry a message we will never
            # understand. It is recorded instead.
            return Response({'status': 'ok', 'detail': 'unparseable'})

        event_key = parsed['event_key']
        merchant_order_id = parsed['merchant_order_id']

        order = None
        if merchant_order_id:
            order = Order.objects.filter(
                attempts__merchant_order_id=merchant_order_id
            ).first() or Order.objects.filter(
                provider_order_id=merchant_order_id
            ).first()

        with transaction.atomic():
            record, is_new = ProcessedCallback.objects.get_or_create(
                event_key=event_key,
                defaults={'order': order, 'payload': _safe_payload(parsed['payload'])},
            )
        if not is_new:
            logger.info(
                'PhonePe callback %s is a replay; no side effects run.', event_key
            )
            return Response({'status': 'ok', 'duplicate': True})

        if order is None:
            logger.error(
                'PhonePe callback %s references unknown merchant order %r.',
                event_key, merchant_order_id,
            )
            return Response({'status': 'ok', 'detail': 'unknown order'})

        # Re-verify. The inbound state is not trusted.
        try:
            services.resolve_payment(
                order, merchant_order_id=merchant_order_id, source='callback'
            )
        except OrderError as exc:
            # The gateway is unreachable right now. The callback is recorded, so
            # the 30-minute sweeper and the customer's own status poll will
            # resolve it. 200, so PhonePe stops retrying.
            logger.warning(
                'Callback %s for order %s could not be re-verified: %s',
                event_key, order.order_number, exc.message,
            )
            return Response({'status': 'ok', 'detail': 'deferred'})
        except Exception:
            logger.exception('Callback %s failed while applying state.', event_key)
            return Response(
                {'error': 'PROCESSING_ERROR'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({'status': 'ok'})


def _safe_payload(data):
    """Store a callback body as JSON, never letting a weird type abort the write."""
    try:
        if isinstance(data, dict):
            return data
        return {'value': str(data)[:4000]}
    except Exception:  # pragma: no cover - defensive
        return {}
