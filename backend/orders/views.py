from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
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
        cart = Cart.objects.get(user=request.user)
        if not cart.items.exists():
            return Response({'error': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

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
            discount=discount
        )

        for item in cart.items.all():
            OrderItem.objects.create(
                order=order,
                product=item.product,
                price=item.product.price,
                quantity=item.quantity
            )

        cart.items.all().delete()

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
