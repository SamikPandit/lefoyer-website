"""Cart endpoints.

Two classes of fix here.

**Availability (C-32, §2d).** `add` and `update_item` compared the requested
quantity against ``product.stock_quantity`` and nothing else. Nothing consulted
`manual_out_of_stock` or `show_at_website`, so a product an operator had
explicitly disabled - or never published - could be added to a cart and ordered.
Both now apply the canonical rule from `orders.services`, which is the same rule
the catalogue filters, the order path and the confirm-time stock check use.

**One source of money.** `GET /api/cart/summary/` computes the subtotal, the
coupon discount, shipping and the total through
``orders.services.price_basket`` - the same function `create_order` uses, which
in turn calls the same `evaluate_coupon` that `/api/coupons/validate/` calls. The
number in the cart is therefore the number charged at checkout, by construction
rather than by coincidence.

Errors carry the precise message (``"Only 3 units available"``) because
`CartContext` now surfaces whatever the backend says; a generic failure string
here becomes a shrug in the UI.
"""

import logging
from decimal import Decimal

from django.core.cache import cache
from django.db import IntegrityError, transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from coupons.services import CouponError
from orders.models import Order
from orders.services import (
    available_quantity,
    free_shipping_progress,
    is_visible,
    price_basket,
    sellable_q,
    unavailable_reason,
)
from products.models import Product
from products.serializers import ProductSerializer

from .models import Cart, CartItem
from .serializers import CartItemSerializer, CartSerializer, money

logger = logging.getLogger(__name__)

MAX_LINE_QUANTITY = 20
CROSS_SELL_COUNT = 3
DELIVERY_CACHE_SECONDS = 60 * 60 * 24


class CartViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------ helpers
    def _cart(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart

    def _cart_response(self, request, cart=None, extra=None, http_status=status.HTTP_200_OK):
        cart = cart or self._cart(request)
        cart = (
            Cart.objects.prefetch_related('items__product').get(pk=cart.pk)
        )
        data = CartSerializer(cart, context={'request': request}).data
        if extra:
            data = {**data, **extra}
        return Response(data, status=http_status)

    # --------------------------------------------------------------------- read
    def list(self, request):
        return self._cart_response(request)

    # ---------------------------------------------------------------------- add
    @action(detail=False, methods=['post'])
    def add(self, request):
        cart = self._cart(request)
        product_id = request.data.get('product_id')
        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response(
                {'error': 'Quantity must be a whole number.', 'field': 'quantity'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quantity < 1:
            return Response(
                {'error': 'Quantity must be at least 1.', 'field': 'quantity'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            product = Product.objects.get(id=product_id)
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND
            )

        # §2d. An unpublished product is treated as non-existent rather than
        # "unavailable", because acknowledging it leaks the unpublished catalogue.
        if not is_visible(product):
            return Response(
                {'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND
            )

        existing = CartItem.objects.filter(cart=cart, product=product).first()
        current_quantity = existing.quantity if existing else 0
        total_requested = current_quantity + quantity

        if total_requested > MAX_LINE_QUANTITY:
            return Response(
                {
                    'error': f'You can order up to {MAX_LINE_QUANTITY} of one item. '
                             f'Contact us for a larger order.',
                    'available': available_quantity(product),
                    'in_cart': current_quantity,
                    'max_quantity': MAX_LINE_QUANTITY,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = unavailable_reason(product, total_requested)
        if reason:
            return Response(
                _availability_error(product, reason, current_quantity),
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                if existing:
                    existing.quantity = total_requested
                    existing.save(update_fields=['quantity'])
                else:
                    CartItem.objects.create(
                        cart=cart, product=product, quantity=quantity
                    )
        except IntegrityError:
            # The unique_together added in cart.0003 fired: a concurrent add
            # inserted the same line first. Top that one up instead of failing.
            with transaction.atomic():
                row = CartItem.objects.select_for_update().filter(
                    cart=cart, product=product
                ).first()
                if row is None:  # pragma: no cover - defensive
                    raise
                row.quantity = min(row.quantity + quantity, MAX_LINE_QUANTITY)
                row.save(update_fields=['quantity'])

        return self._cart_response(request, cart)

    # -------------------------------------------------------------- update_item
    @action(detail=True, methods=['patch'])
    def update_item(self, request, pk=None):
        try:
            cart_item = CartItem.objects.select_related('product').get(
                id=pk, cart__user=request.user
            )
        except (CartItem.DoesNotExist, ValueError):
            return Response(
                {'error': 'Cart item not found'}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response(
                {'error': 'Quantity must be a whole number.', 'field': 'quantity'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity <= 0:
            cart_item.delete()
            return self._cart_response(request)

        if quantity > MAX_LINE_QUANTITY:
            return Response(
                {
                    'error': f'You can order up to {MAX_LINE_QUANTITY} of one item.',
                    'max_quantity': MAX_LINE_QUANTITY,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = unavailable_reason(cart_item.product, quantity)
        if reason:
            return Response(
                _availability_error(cart_item.product, reason, cart_item.quantity),
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart_item.quantity = quantity
        cart_item.save(update_fields=['quantity'])
        return self._cart_response(request)

    # -------------------------------------------------------------- remove/clear
    @action(detail=True, methods=['delete'])
    def remove_item(self, request, pk=None):
        try:
            cart_item = CartItem.objects.get(id=pk, cart__user=request.user)
        except (CartItem.DoesNotExist, ValueError):
            return Response(
                {'error': 'Cart item not found'}, status=status.HTTP_404_NOT_FOUND
            )
        cart_item.delete()
        return self._cart_response(request)

    @action(detail=False, methods=['delete'])
    def clear(self, request):
        cart = self._cart(request)
        cart.items.all().delete()
        return self._cart_response(request, cart)

    # ------------------------------------------------------------------ summary
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Everything the cart page needs, priced by the server (§2b #15).

        `coupon` is evaluated here through the shared evaluator, so a coupon
        that will be refused at checkout is refused here too, with the same
        reason - and one that is accepted quotes the same discount.
        """
        cart = Cart.objects.prefetch_related('items__product').filter(
            user=request.user
        ).first()
        items = list(cart.items.select_related('product').all()) if cart else []

        sellable_lines = []
        unavailable = []
        for item in items:
            reason = unavailable_reason(item.product, item.quantity)
            if reason:
                unavailable.append({
                    'item_id': item.id,
                    'product_id': item.product_id,
                    'name': item.product.name,
                    'reason': reason,
                    'available': available_quantity(item.product),
                    'requested': item.quantity,
                })
            else:
                sellable_lines.append((item.product, item.quantity))

        requested_code = (request.query_params.get('coupon') or '').strip()
        coupon_block = None
        try:
            pricing = price_basket(
                sellable_lines, coupon_code=requested_code, user=request.user
            )
            if requested_code:
                coupon_block = {
                    'code': pricing['coupon_code'],
                    'applied': True,
                    'valid': True,
                    'discount_type': pricing['discount_type'],
                    'discount_value': str(pricing['discount_value']),
                    'discount_amount': money(pricing['discount_amount']),
                    'message': pricing['coupon_message'],
                }
        except CouponError as exc:
            # Price the basket without the coupon and report why it did not
            # apply, rather than failing the whole summary. The cart must still
            # render when a code is wrong.
            pricing = price_basket(sellable_lines, coupon_code=None, user=request.user)
            coupon_block = {
                'code': requested_code,
                'applied': False,
                'valid': False,
                'reason': exc.reason,
                'message': exc.message,
                **{k: str(v) for k, v in exc.extra.items()},
            }

        body = {
            'cart_id': cart.id if cart else None,
            'items': CartItemSerializer(
                items, many=True, context={'request': request}
            ).data,
            'item_count': len(items),
            'total_quantity': sum(item.quantity for item in items),
            'sellable_item_count': len(sellable_lines),
            'unavailable_items': unavailable,
            'subtotal': money(pricing['subtotal']),
            'discount_amount': money(pricing['discount_amount']),
            'discount_type': pricing['discount_type'],
            'shipping_amount': money(pricing['shipping_amount']),
            'total': money(pricing['total']),
            'currency': 'INR',
            'coupon': coupon_block,
            'free_shipping': free_shipping_progress(pricing['subtotal']),
            'policy': _policy_block(),
            'delivery': _delivery_block(request.query_params.get('pincode')),
            'cross_sell': ProductSerializer(
                _cross_sell(items), many=True, context={'request': request}
            ).data,
        }
        return Response(body, status=status.HTTP_200_OK)

    # -------------------------------------------------------------------- merge
    @action(detail=False, methods=['post'])
    def merge(self, request):
        """Fold a guest cart into the signed-in one, in one round trip (§2b #16).

        `CartContext` used to loop `addToCart` per item and clear
        `localStorage.cart` regardless of the outcome, so anything the server
        rejected vanished silently. This reports `skipped[]` with a reason per
        line, and the client only clears local storage on a successful response.

        Quantities are **merged by taking the larger** of the two, not added.
        A guest who put 2 in their basket, signed in, and found 2 already there
        wanted 2 - not 4.
        """
        raw_items = request.data.get('items')
        if not isinstance(raw_items, list):
            return Response(
                {'error': "Expected a list under 'items'.", 'field': 'items'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart = self._cart(request)
        existing = {item.product_id: item for item in cart.items.select_related('product')}

        merged, skipped = [], []
        for raw in raw_items:
            if not isinstance(raw, dict):
                continue
            product_id = raw.get('product_id') or raw.get('id')
            try:
                quantity = max(1, int(raw.get('quantity', 1)))
            except (TypeError, ValueError):
                quantity = 1

            product = Product.objects.filter(id=product_id).first()
            if product is None or not is_visible(product):
                skipped.append({
                    'product_id': product_id,
                    'name': '',
                    'reason': 'NOT_FOUND',
                    'available': 0,
                })
                continue

            current = existing.get(product.id)
            target = min(
                max(quantity, current.quantity if current else 0), MAX_LINE_QUANTITY
            )

            reason = unavailable_reason(product, target)
            if reason:
                capped = min(available_quantity(product), MAX_LINE_QUANTITY)
                if capped > 0 and reason == 'INSUFFICIENT_STOCK':
                    # Keep what we can rather than dropping the line entirely,
                    # and say so.
                    target = capped
                    reason = None
                else:
                    skipped.append({
                        'product_id': product.id,
                        'name': product.name,
                        'reason': reason,
                        'available': available_quantity(product),
                    })
                    continue

            if current:
                if current.quantity != target:
                    current.quantity = target
                    current.save(update_fields=['quantity'])
            else:
                current = CartItem.objects.create(
                    cart=cart, product=product, quantity=target
                )
                existing[product.id] = current

            entry = {
                'product_id': product.id,
                'name': product.name,
                'quantity': target,
            }
            if target != quantity:
                entry['requested'] = quantity
                entry['capped'] = True
            merged.append(entry)

        cart = Cart.objects.prefetch_related('items__product').get(pk=cart.pk)
        return Response(
            {
                'cart': CartSerializer(cart, context={'request': request}).data,
                'merged': merged,
                'skipped': skipped,
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------- restore from order
    @action(detail=False, methods=['post'], url_path='restore-from-order')
    def restore_from_order(self, request):
        """Rebuild a cart from a failed or cancelled order (§2b #17).

        The recovery action behind "Restore my cart" on the FAILED / CANCELLED /
        EXPIRED confirmation states. Under the new flow a prepaid failure leaves
        the cart untouched, so this usually finds nothing to do - which is the
        point. It exists for the customer who cleared their basket, switched
        device, or whose order was cancelled long after the fact.

        Only the caller's own orders are readable, and a COMPLETED order is
        refused: re-adding the contents of a paid order invites a duplicate
        purchase.
        """
        order_id = request.data.get('order_id')
        order = Order.objects.filter(id=order_id, user=request.user).first() if order_id else None
        if order is None:
            return Response(
                {'error': 'Order not found', 'field': 'order_id'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if order.payment_status == Order.COMPLETED:
            return Response(
                {
                    'error': 'ALREADY_PAID',
                    'message': 'That order was paid for. Add the items again from the '
                               'product pages if you would like to reorder.',
                },
                status=status.HTTP_409_CONFLICT,
            )

        cart = self._cart(request)
        existing = {item.product_id: item for item in cart.items.all()}
        restored, skipped = [], []

        for line in order.items.select_related('product').all():
            product = line.product
            if not is_visible(product):
                skipped.append({
                    'product_id': product.id,
                    'name': line.product_name or product.name,
                    'reason': 'UNAVAILABLE',
                    'available': 0,
                })
                continue

            current = existing.get(product.id)
            target = min(
                max(line.quantity, current.quantity if current else 0), MAX_LINE_QUANTITY
            )
            reason = unavailable_reason(product, target)
            if reason:
                capped = min(available_quantity(product), MAX_LINE_QUANTITY)
                if capped > 0 and reason == 'INSUFFICIENT_STOCK':
                    target = capped
                    reason = None
                else:
                    skipped.append({
                        'product_id': product.id,
                        'name': line.product_name or product.name,
                        'reason': reason,
                        'available': available_quantity(product),
                    })
                    continue

            if current:
                if current.quantity != target:
                    current.quantity = target
                    current.save(update_fields=['quantity'])
            else:
                current = CartItem.objects.create(
                    cart=cart, product=product, quantity=target
                )
                existing[product.id] = current

            restored.append({
                'product_id': product.id,
                'name': line.product_name or product.name,
                'quantity': target,
            })

        cart = Cart.objects.prefetch_related('items__product').get(pk=cart.pk)
        return Response(
            {
                'cart': CartSerializer(cart, context={'request': request}).data,
                'restored': restored,
                'skipped': skipped,
            },
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _availability_error(product, reason, in_cart):
    """The precise message, because the UI now renders whatever we say."""
    available = available_quantity(product)
    messages = {
        'COMING_SOON': f'{product.name} is not on sale yet.',
        'OUT_OF_STOCK': f'{product.name} is out of stock.',
        'UNAVAILABLE': f'{product.name} is not available.',
        'INSUFFICIENT_STOCK': (
            f'Only {available} unit{"" if available == 1 else "s"} of '
            f'{product.name} available.'
        ),
    }
    return {
        'error': messages.get(reason, f'{product.name} is not available.'),
        'reason': reason,
        'available': available,
        'in_cart': in_cart,
        'product_id': product.id,
    }


def _policy_block():
    """The delivery/returns numbers, from the single content singleton.

    Returned as numbers, not sentences: the copy lives in the frontend content
    modules so that one wording change is not a backend deploy.
    """
    try:
        from content.models import PolicySetting

        policy = PolicySetting.load()
    except Exception as exc:
        logger.warning('Could not load the delivery policy for the cart: %s', exc)
        return None
    return {
        'delivery_window_days': [
            policy.delivery_window_min_days, policy.delivery_window_max_days
        ],
        'free_shipping_threshold': (
            money(policy.free_shipping_threshold)
            if policy.free_shipping_threshold is not None
            else None
        ),
        'shipping_charge': money(Decimal(policy.shipping_charge or 0)),
        'return_window_days': policy.return_window_days,
        'return_window_from': policy.return_window_from,
        'refund_days': policy.refund_days,
        'cod_available': policy.cod_available,
    }


def _delivery_block(pincode):
    """Pincode-driven ETA for the cart, cached for 24h.

    Guarded end to end: Blue Dart's WSDL is fetched at runtime and its
    credentials default to empty, so this must degrade to "we could not check
    right now, you can still order" rather than break the cart page. `error` is
    carried through so the UI can say which of the two happened.
    """
    pincode = (pincode or '').strip()
    if not pincode:
        return None
    if not (pincode.isdigit() and len(pincode) == 6):
        return {'pincode': pincode, 'error': 'Enter a 6-digit pincode.'}

    cache_key = f'cart-summary-delivery:{pincode}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    result = {
        'pincode': pincode,
        'serviceable': None,
        'cod_available': None,
        'expected_delivery_date': None,
        'transit_days': None,
        'error': None,
    }
    try:
        from shipping.client import BlueDartClient

        client = BlueDartClient()
        serviceability = client.check_serviceability(pincode)
        result['serviceable'] = _as_bool(serviceability.get('serviceable'))
        result['cod_available'] = _as_bool(serviceability.get('cod_available'))
        result['error'] = serviceability.get('error')
        if result['serviceable']:
            transit = client.get_transit_time(pincode)
            expected = transit.get('expected_delivery_date')
            result['expected_delivery_date'] = (
                expected.isoformat() if hasattr(expected, 'isoformat') else expected
            )
            result['transit_days'] = transit.get('transit_days')
    except Exception as exc:
        logger.info('Cart delivery check for %s unavailable: %s', pincode, exc)
        result['error'] = 'We could not check delivery for this pincode right now.'
        # Not cached: a transient failure must not be remembered for 24 hours.
        return result

    cache.set(cache_key, result, DELIVERY_CACHE_SECONDS)
    return result


def _as_bool(value):
    """Strict coercion.

    zeep runs with ``Settings(strict=False)``, so if the WSDL types these as
    strings the string ``'false'`` is truthy in Python and every pincode would
    report serviceable. Never use a bare ``bool()`` on one of these.
    """
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in ('true', '1', 'yes', 'y'):
        return True
    if text in ('false', '0', 'no', 'n', '', 'none', 'null'):
        return False
    return None


def _cross_sell(cart_items):
    """Three sellable products the cart does not already contain.

    Same category first, because "you might also like" is only useful if it is
    adjacent. Falls back to the wider catalogue so the slot is either filled
    properly or empty - never padded with something arbitrary.
    """
    in_cart = [item.product_id for item in cart_items]
    categories = {item.product.category_id for item in cart_items}

    base = Product.objects.filter(show_at_website=True).filter(sellable_q()).exclude(
        id__in=in_cart
    )

    picks = []
    if categories:
        picks = list(base.filter(category_id__in=categories)[:CROSS_SELL_COUNT])
    if len(picks) < CROSS_SELL_COUNT:
        picks += list(
            base.exclude(id__in=[p.id for p in picks])[: CROSS_SELL_COUNT - len(picks)]
        )
    return picks
