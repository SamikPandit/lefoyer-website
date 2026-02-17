from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer
from products.models import Product

class CartViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        cart, created = Cart.objects.get_or_create(user=request.user)
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add(self, request):
        cart, created = Cart.objects.get_or_create(user=request.user)
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check stock availability
        cart_item_existing = CartItem.objects.filter(cart=cart, product=product).first()
        current_qty = cart_item_existing.quantity if cart_item_existing else 0
        total_requested = current_qty + quantity

        if total_requested > product.stock_quantity:
            return Response(
                {
                    'error': f'Only {product.stock_quantity} units available',
                    'available': product.stock_quantity,
                    'in_cart': current_qty
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if cart_item_existing:
            cart_item_existing.quantity = total_requested
            cart_item_existing.save()
        else:
            CartItem.objects.create(cart=cart, product=product, quantity=quantity)

        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def update_item(self, request, pk=None):
        try:
            cart_item = CartItem.objects.select_related('product').get(id=pk, cart__user=request.user)
        except CartItem.DoesNotExist:
            return Response({'error': 'Cart item not found'}, status=status.HTTP_404_NOT_FOUND)

        quantity = int(request.data.get('quantity', 1))
        if quantity > 0:
            # Validate against stock
            if quantity > cart_item.product.stock_quantity:
                return Response(
                    {
                        'error': f'Only {cart_item.product.stock_quantity} units available',
                        'available': cart_item.product.stock_quantity,
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            cart_item.quantity = quantity
            cart_item.save()
        else:
            cart_item.delete()

        cart = Cart.objects.get(user=request.user)
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['delete'])
    def remove_item(self, request, pk=None):
        try:
            cart_item = CartItem.objects.get(id=pk, cart__user=request.user)
        except CartItem.DoesNotExist:
            return Response({'error': 'Cart item not found'}, status=status.HTTP_404_NOT_FOUND)

        cart_item.delete()

        cart = Cart.objects.get(user=request.user)
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['delete'])
    def clear(self, request):
        cart, created = Cart.objects.get_or_create(user=request.user)
        cart.items.all().delete()
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)
