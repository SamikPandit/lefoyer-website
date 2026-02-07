from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from .models import Order, OrderItem
from .serializers import OrderSerializer
from cart.models import Cart
from coupons.models import Coupon
from django.utils import timezone

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        # Try to get or create cart for the user
        try:
            cart = Cart.objects.get(user=request.user)
        except Cart.DoesNotExist:
            return Response({'error': 'Cart not found. Please add items to cart first.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if cart has items
        cart_items = cart.items.all()
        if not cart_items.exists():
            return Response({
                'error': 'Cart is empty',
                'debug': f'Cart ID: {cart.id}, User: {request.user.username}, Item count: {cart_items.count()}'
            }, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({'error': 'Missing shipping information'}, status=status.HTTP_400_BAD_REQUEST)

        total = sum(item.product.price * item.quantity for item in cart.items.all())

        coupon_code = request.data.get('coupon_code')
        coupon = None
        discount = 0
        if coupon_code:
            now = timezone.now()
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code, valid_from__lte=now, valid_to__gte=now, active=True)
                discount = coupon.discount
            except Coupon.DoesNotExist:
                return Response({'error': 'Invalid coupon code'}, status=status.HTTP_400_BAD_REQUEST)

        # Get additional info
        payment_method = request.data.get('payment_method', 'PREPAID')
        
        # Determine initial payment status and valid payment methods
        valid_methods = ['PREPAID', 'COD', 'upi', 'card'] # 'upi'/'card' from frontend map to PREPAID logic in model, or use them directly if model allows
        
        # Normalize payment method for model
        model_payment_method = 'PREPAID'
        if payment_method == 'cod' or payment_method == 'COD':
            model_payment_method = 'COD'
        
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
            total=total,
            coupon=coupon,
            discount=discount,
            payment_method=model_payment_method
        )

        for item in cart.items.all():
            OrderItem.objects.create(
                order=order,
                product=item.product,
                price=item.product.price,
                quantity=item.quantity
            )

        cart.items.all().delete()
        
        # Trigger shipment generation for COD orders immediately
        if model_payment_method == 'COD':
            from shipping.tasks import generate_shipment_for_order
            # Delay to ensure transaction commit if needed, though here it's fine
            generate_shipment_for_order.delay(order.id)

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
            # COD orders don't need payment gateway
            # Trigger shipment generation if not already done
            try:
                if not hasattr(order, 'shipment'):
                    from shipping.tasks import generate_shipment_for_order
                    generate_shipment_for_order.delay(order.id)
            except:
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
            return Response({'error': 'Payment initiation failed', 'details': response.get('error')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
                    except Order.DoesNotExist:
                        pass # Log error
                        
                elif decoded_response.get('code') == 'PAYMENT_ERROR':
                     merchant_transaction_id = decoded_response['data']['merchantTransactionId']
                     try:
                        order = Order.objects.get(provider_order_id=merchant_transaction_id)
                        order.payment_status = 'FAILED'
                        order.save()
                     except Order.DoesNotExist:
                        pass

                return Response({'status': 'success'})
            else:
                # Redirect return (if configured to POST to this URL)
                # Usually PhonePe redirects to a URL with POST data
                # We should handle it or have a separate view for UI redirect
                return Response({'status': 'ok'})

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
