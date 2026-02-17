from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from .models import Order, OrderItem
from .serializers import OrderSerializer
from cart.models import Cart
from coupons.models import Coupon
from django.utils import timezone
from django.db import transaction
from django.db.models import F
import logging

logger = logging.getLogger(__name__)


def send_order_email_async(order_id):
    """Send order confirmation email via Celery (non-blocking)."""
    try:
        from accounts.tasks import send_order_confirmation_email_task
        send_order_confirmation_email_task.delay(order_id)
    except Exception as e:
        logger.error(f"Failed to queue order confirmation email for order #{order_id}: {e}")


def get_effective_price(product):
    """Return discount_price if set, otherwise regular price."""
    if product.discount_price and product.discount_price > 0:
        return product.discount_price
    return product.price


def restore_stock_for_order(order):
    """Restore stock quantities for all items in an order."""
    for item in order.items.select_related('product').all():
        item.product.__class__.objects.filter(pk=item.product.pk).update(
            stock_quantity=F('stock_quantity') + item.quantity
        )
    logger.info(f"Stock restored for order #{order.id}")


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        # Get cart
        try:
            cart = Cart.objects.get(user=request.user)
        except Cart.DoesNotExist:
            return Response(
                {'error': 'Cart not found. Please add items to cart first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if cart has items
        cart_items = cart.items.select_related('product').all()
        if not cart_items.exists():
            return Response(
                {'error': 'Cart is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate stock availability
        out_of_stock = []
        for item in cart_items:
            if item.product.stock_quantity < item.quantity:
                out_of_stock.append({
                    'product': item.product.name,
                    'available': item.product.stock_quantity,
                    'requested': item.quantity
                })
        
        if out_of_stock:
            return Response(
                {'error': 'Some items are out of stock', 'items': out_of_stock},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get shipping information from request data
        shipping_data = request.data.get('shipping_info', {})
        first_name = shipping_data.get('first_name')
        last_name = shipping_data.get('last_name')
        email = shipping_data.get('email')
        phone = shipping_data.get('phone')
        address = shipping_data.get('address')
        city = shipping_data.get('city')
        state = shipping_data.get('state')
        pincode = shipping_data.get('pincode')

        if not all([first_name, last_name, email, phone, address, city, state, pincode]):
            return Response(
                {'error': 'Missing shipping information'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate total using effective price (discount_price if available)
        total = sum(get_effective_price(item.product) * item.quantity for item in cart_items)

        # Validate and apply coupon
        coupon_code = request.data.get('coupon_code')
        coupon = None
        discount = 0
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code)
                
                if not coupon.is_valid():
                    return Response(
                        {'error': 'This coupon is no longer valid'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if coupon.min_order_amount and total < coupon.min_order_amount:
                    return Response(
                        {'error': f'Minimum order of ₹{coupon.min_order_amount} required for this coupon'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                discount = coupon.discount
            except Coupon.DoesNotExist:
                return Response(
                    {'error': 'Invalid coupon code'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Calculate final total after discount
        discount_amount = total * discount / 100
        final_total = total - discount_amount

        # Get and normalize payment method
        payment_method = request.data.get('payment_method', 'PREPAID')
        model_payment_method = 'COD' if payment_method.upper() == 'COD' else 'PREPAID'

        # Wrap order creation in an atomic transaction
        try:
            with transaction.atomic():
                order = Order.objects.create(
                    user=request.user,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=phone,
                    address=address,
                    city=city,
                    state=state,
                    pincode=pincode,
                    total=final_total,
                    coupon=coupon,
                    discount=discount,
                    payment_method=model_payment_method,
                    # COD orders are immediately confirmed
                    paid=model_payment_method == 'COD',
                    payment_status='COMPLETED' if model_payment_method == 'COD' else 'PENDING',
                )

                for item in cart_items:
                    OrderItem.objects.create(
                        order=order,
                        product=item.product,
                        price=get_effective_price(item.product),
                        quantity=item.quantity
                    )
                    # Reduce stock quantity atomically
                    updated = item.product.__class__.objects.filter(
                        pk=item.product.pk,
                        stock_quantity__gte=item.quantity
                    ).update(stock_quantity=F('stock_quantity') - item.quantity)
                    
                    if not updated:
                        raise ValueError(f'{item.product.name} is now out of stock')

                # Increment coupon usage
                if coupon:
                    Coupon.objects.filter(pk=coupon.pk).update(used_count=F('used_count') + 1)

                cart.items.all().delete()
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # NOTE: Shipment generation is handled automatically by the post_save signal
        # in shipping/signals.py when payment_status='COMPLETED'

        # Send order confirmation email asynchronously via Celery
        send_order_email_async(order.id)

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def complete_payment(self, request, pk=None):
        """Endpoint to complete payment for a pending order"""
        order = self.get_object()
        
        if order.payment_status == 'COMPLETED':
            return Response(
                {'error': 'Order already paid'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment_method = request.data.get('payment_method', 'PREPAID')
        
        # Normalize payment method
        if payment_method.upper() in ['UPI', 'CARD', 'PHONEPE']:
            payment_method = 'PREPAID'
        elif payment_method.upper() == 'COD':
            payment_method = 'COD'
        
        # Update payment method if changed
        if order.payment_method != payment_method:
            order.payment_method = payment_method
            order.save()
        
        # For COD, mark as confirmed and trigger shipment
        if payment_method == 'COD':
            order.paid = True
            order.payment_status = 'COMPLETED'
            order.save()

            try:
                if not hasattr(order, 'shipment'):
                    from shipping.tasks import generate_shipment_for_order
                    generate_shipment_for_order.delay(order.id)
            except Exception:
                pass
            
            return Response({
                'success': True,
                'message': 'COD order confirmed',
                'order_id': order.id
            })
        
        # For prepaid, trigger payment gateway
        from .payment import PhonePeGateway
        gateway = PhonePeGateway()
        response = gateway.initiate_payment(
            order_id=order.id,
            amount=float(order.total),
            user_id=request.user.id
        )
        
        if response['success']:
            order.provider_order_id = response['merchant_transaction_id']
            order.save()
            return Response({
                'success': True,
                'redirect_url': response['redirect_url']
            })
        else:
            return Response(
                {'success': False, 'error': 'Payment initiation failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


from rest_framework.views import APIView
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .payment import PhonePeGateway
import base64
import json

class InitiatePaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        try:
            order = Order.objects.get(pk=pk, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

        if order.paid:
            return Response({'error': 'Order already paid'}, status=status.HTTP_400_BAD_REQUEST)

        gateway = PhonePeGateway()
        response = gateway.initiate_payment(
            order_id=order.id,
            amount=float(order.total),
            user_id=request.user.id
        )

        if response['success']:
            order.provider_order_id = response['merchant_transaction_id']
            order.save()
            return Response({'redirect_url': response['redirect_url']})
        else:
            return Response(
                {'error': 'Payment initiation failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@method_decorator(csrf_exempt, name='dispatch')
class PaymentCallbackView(APIView):
    permission_classes = []  # Allow public access for callback

    def post(self, request):
        try:
            if 'response' in request.data:
                # S2S Callback
                encoded_response = request.data.get('response')
                x_verify = request.headers.get('X-VERIFY')
                
                gateway = PhonePeGateway()
                if not gateway.verify_callback(encoded_response, x_verify):
                     return Response({'error': 'Invalid checksum'}, status=status.HTTP_400_BAD_REQUEST)

                decoded_response = json.loads(base64.b64decode(encoded_response).decode('utf-8'))
                
                if decoded_response.get('code') == 'PAYMENT_SUCCESS':
                    merchant_transaction_id = decoded_response['data']['merchantTransactionId']
                    transaction_id = decoded_response['data']['transactionId']
                    
                    try:
                        order = Order.objects.get(provider_order_id=merchant_transaction_id)
                        order.paid = True
                        order.payment_status = 'COMPLETED'
                        order.payment_id = transaction_id
                        order.save()
                        
                        # Send order confirmation email asynchronously via Celery
                        send_order_email_async(order.id)
                    except Order.DoesNotExist:
                        logger.error(f"Order not found for transaction: {merchant_transaction_id}")
                        
                elif decoded_response.get('code') == 'PAYMENT_ERROR':
                     merchant_transaction_id = decoded_response['data']['merchantTransactionId']
                     try:
                        order = Order.objects.get(provider_order_id=merchant_transaction_id)
                        order.payment_status = 'FAILED'
                        order.save()
                        # Restore stock for failed payment
                        restore_stock_for_order(order)
                     except Order.DoesNotExist:
                        logger.error(f"Order not found for failed transaction: {merchant_transaction_id}")

                return Response({'status': 'success'})
            else:
                return Response({'status': 'ok'})

        except Exception as e:
            logger.error(f"Payment callback error: {e}")
            return Response(
                {'error': 'Payment processing error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
