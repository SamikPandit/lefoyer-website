"""
Wishlist endpoints (IMPL_SPEC §2b #26, correction C-8).

The routes themselves were always fine — `wishlist/urls.py` registers this
viewset at `r''`, which gives `GET|POST /api/wishlist/` and
`DELETE /api/wishlist/<pk>/`. The breakage was on the client: `api.js` called
`POST wishlist/add/`, which matched the **detail** route with `pk='add'` and no
`post` handler (a 405), and `DELETE wishlist/<id>/remove/`, which matched
nothing (a 404). Wave 1's `api.js` now calls the real router paths, so this file
only has to satisfy them — no new routes, and `wishlist/urls.py` is untouched.

Two server-side defects are fixed here as well:

* `destroy()` called a bare `Wishlist.objects.get(user=request.user)`, which
  raised `DoesNotExist` → **500** for any user who had never added anything.
  Every handler now goes through `get_or_create`.
* `pk` is a product id on this route, not a wishlist id, and it was passed
  straight into a lookup without validation.
"""

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from products.models import Product

from .models import Wishlist
from .serializers import WishlistSerializer


class WishlistViewSet(viewsets.ViewSet):
    """
    One wishlist per account (`Wishlist.user` is a `OneToOneField`), so there is
    no list-of-wishlists resource: `GET /api/wishlist/` returns *the* wishlist
    and `<pk>` on the detail route is a **product id**.
    """

    permission_classes = [IsAuthenticated]

    def _wishlist(self, request):
        """
        Never raises for a first-time user. `get_or_create` is deliberate on
        every verb, including `DELETE`: a remove for a user with no row is a
        no-op that should answer with an empty wishlist, not a 500.
        """
        wishlist, _ = Wishlist.objects.get_or_create(user=request.user)
        return wishlist

    def _payload(self, request, wishlist):
        wishlist = (
            Wishlist.objects.prefetch_related('products__category', 'products__sub_category')
            .filter(pk=wishlist.pk)
            .first()
            or wishlist
        )
        return WishlistSerializer(wishlist, context={'request': request}).data

    def list(self, request):
        wishlist = self._wishlist(request)
        return Response(self._payload(request, wishlist))

    def create(self, request):
        """
        `POST {product_id}`. Idempotent: adding something already saved returns
        `200` and the unchanged wishlist rather than an error, because the heart
        icon is optimistic and a double-tap must not surface a failure.
        """
        raw_id = request.data.get('product_id')
        if raw_id in (None, ''):
            return Response(
                {'error': 'product_id is required.', 'field': 'product_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            product_id = int(raw_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'product_id must be a product id.', 'field': 'product_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # `show_at_website=True`: an unpublished product cannot be saved, for
        # the same reason it cannot be fetched (§2d).
        product = Product.objects.filter(pk=product_id, show_at_website=True).first()
        if product is None:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            wishlist = self._wishlist(request)
            already_saved = wishlist.products.filter(pk=product.pk).exists()
            if not already_saved:
                wishlist.products.add(product)

        return Response(
            self._payload(request, wishlist),
            status=status.HTTP_200_OK if already_saved else status.HTTP_201_CREATED,
        )

    def destroy(self, request, pk=None):
        """
        `DELETE /api/wishlist/<product_id>/`. Returns the resulting wishlist
        (not `204`) so the client can reconcile its optimistic state in one
        round trip. Removing something that is not saved is a successful no-op.
        """
        try:
            product_id = int(pk)
        except (TypeError, ValueError):
            return Response(
                {'error': 'Expected a product id.', 'field': 'product_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            wishlist = self._wishlist(request)
            # Removed by id, with no visibility filter and no existence check on
            # Product: an item saved before the product was unpublished or
            # deleted must still be removable. `.remove()` on an absent member
            # is a no-op in Django.
            wishlist.products.remove(*Product.objects.filter(pk=product_id))

        return Response(self._payload(request, wishlist), status=status.HTTP_200_OK)
