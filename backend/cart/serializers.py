"""Cart serializers.

Both of these used ``fields='__all__'``, which on `CartSerializer` published the
owning `user` id and on `CartItemSerializer` published `cart` - the cart's own
primary key, inside the cart payload. Neither is anything the client needs.

The money in a cart is computed **server-side**, in `CartSummary`, from the same
`orders.services.price_basket` that order creation uses. That is what stops the
cart from quoting a total that checkout then disagrees with: there is one
arithmetic, not two.
"""

from rest_framework import serializers

from orders.services import available_quantity, effective_price, is_sellable, is_visible
from products.serializers import ProductLineSerializer

from .models import Cart, CartItem


def money(value):
    """2dp string. See orders.serializers.money for why not a float."""
    if value is None:
        return None
    return f'{value:.2f}'


class CartItemSerializer(serializers.ModelSerializer):
    # The light card payload, not the full detail one. The full serializer ships ten
    # image fields, five prose blobs and a per-product review_summary aggregate — which
    # made every cart line cost extra queries and kilobytes for data no cart line renders.
    product = ProductLineSerializer(read_only=True)
    # Per-line availability, so the row can be rendered disabled with a "no
    # longer available - remove" action instead of failing at checkout (§2d).
    in_stock = serializers.SerializerMethodField()
    max_quantity = serializers.SerializerMethodField()
    unit_price = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            'id', 'product', 'quantity', 'added_at',
            'in_stock', 'max_quantity', 'unit_price', 'line_total',
        ]
        read_only_fields = fields

    def get_in_stock(self, obj):
        return is_sellable(obj.product) and is_visible(obj.product)

    def get_max_quantity(self, obj):
        return available_quantity(obj.product)

    def get_unit_price(self, obj):
        return money(effective_price(obj.product))

    def get_line_total(self, obj):
        return money(effective_price(obj.product) * obj.quantity)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ('id', 'items', 'item_count', 'total_quantity', 'created_at')
        read_only_fields = fields

    def get_item_count(self, obj):
        return len(obj.items.all())

    def get_total_quantity(self, obj):
        return sum(item.quantity for item in obj.items.all())
