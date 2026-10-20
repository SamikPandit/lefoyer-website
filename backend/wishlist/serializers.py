"""
Wishlist serializer (IMPL_SPEC §2b #26).

The old version was `fields = '__all__'` on a model whose only interesting
field is a `ManyToManyField`, so `products` came back as `[3, 7, 11]` — bare
primary keys the UI could not render — and `user` came back as the account id
on every response. The shape below is `{id, products: [Product]}`: nested
objects, no user id.
"""

from rest_framework import serializers

from products.serializers import ProductSerializer

from .models import Wishlist


class WishlistSerializer(serializers.ModelSerializer):
    """
    `products` is a method field rather than a declared nested serializer so the
    queryset can be both filtered and ordered.

    * **Filtered** to `show_at_website=True` — §2d: an unpublished product is
      never served, and a saved item is not a side door around that. The row
      stays in the join table, so the item reappears if the product is
      republished; `DELETE /api/wishlist/<product_id>/` removes it regardless of
      visibility either way.
    * **Ordered** explicitly, because a `ManyToManyField` with no `through`
      model has no insertion-time column to sort on and an unordered queryset
      would let the list shuffle between requests.
    """

    products = serializers.SerializerMethodField()

    class Meta:
        model = Wishlist
        fields = ('id', 'products')
        read_only_fields = ('id', 'products')

    def get_products(self, obj):
        queryset = obj.products.filter(show_at_website=True).order_by('name', 'id')
        return ProductSerializer(queryset, many=True, context=self.context).data
