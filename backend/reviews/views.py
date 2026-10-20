"""
Review endpoints (IMPL_SPEC §2b #11, #12, #13 and §2e).

Routing note: this app has **no `urls.py`**. The review list/detail routes are
the nested router declared in `products/urls.py`
(`/api/products/products/<slug>/reviews/`), and `TopReviewViewSet` is registered
on the same router at `/api/products/reviews/top/`. The old `reviews/urls.py`
held an empty `urlpatterns`, was included by nothing, and has been deleted.
"""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from products.models import Product

from .models import RATING_MAX, RATING_MIN, Review, build_review_summary, find_qualifying_order_item
from .serializers import ReviewSerializer, TopReviewSerializer

#: Homepage testimonial rail defaults for §2b #13.
TOP_REVIEWS_DEFAULT_LIMIT = 6
TOP_REVIEWS_MAX_LIMIT = 24
TOP_REVIEWS_DEFAULT_MIN_RATING = 4


class IsOwnerOrReadOnly(BasePermission):
    """
    Writes to an existing review are the author's alone.

    Before this existed, `ReviewViewSet` carried only
    `IsAuthenticatedOrReadOnly`, so **any** logged-in account could `PATCH` the
    text or `DELETE` the row of **any** review on the site.
    """

    message = 'You can only edit or delete your own review.'

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return obj.user_id == user.id or user.is_staff


def _coerce_int(raw, default, minimum, maximum):
    """Query-param parsing that cannot 500 on `?limit=banana`."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, value))


class ReviewViewSet(viewsets.ModelViewSet):
    """
    `/api/products/products/<slug>/reviews/` — read public, write authenticated.

    `product` and `user` are never read from the request body; they come from
    the URL and the session respectively (§2e).
    """

    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    # The PDP review block is a public read on a page a browsing session hits
    # repeatedly; the global `anon: 30/minute` floor would 429 an ordinary
    # visitor, so this opts into the `catalogue` scope like every other public
    # read surface. Review spam is bounded by `unique_together`, not by rate.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogue'
    ordering_fields = ['created_at', 'rating', 'is_verified_purchase']
    ordering = ['-created_at']
    search_fields = ['title', 'comment']

    #: The URL kwarg `drf-nested-routers` generates for the parent lookup is
    #: `<lookup>_<parent lookup_field>`. With `lookup='product_slug'` in
    #: `products/urls.py` and `lookup_field='slug'` on `ProductViewSet`, that is
    #: `product_slug_slug`. The previous version of this view read
    #: `self.kwargs['product_slug']`, which no route has ever supplied — so every
    #: request that got past correction C-7's wrong client path would have died
    #: on a `KeyError` (a 500) instead of serving reviews. Both plausible names
    #: are accepted so a change to `ProductViewSet.lookup_field`, which belongs
    #: to another package, cannot silently break this endpoint again.
    PRODUCT_SLUG_KWARGS = ('product_slug_slug', 'product_slug_pk', 'product_slug')

    def get_product_slug(self):
        for key in self.PRODUCT_SLUG_KWARGS:
            value = self.kwargs.get(key)
            if value:
                return value
        raise Http404('No product in the request path.')

    def get_product(self):
        """
        The product named by the nested route.

        `show_at_website=True` is part of the lookup, so an unpublished product
        is a 404 here exactly as it is on the detail endpoint (§2d) — its
        reviews are not a side door into a hidden page.
        """
        if not hasattr(self, '_product'):
            self._product = get_object_or_404(
                Product.objects.filter(show_at_website=True),
                slug=self.get_product_slug(),
            )
        return self._product

    def get_queryset(self):
        """
        Approved reviews, plus the requesting user's own.

        Own-but-unapproved rows are included so a moderated author can still
        see, edit and delete their review rather than meeting a 404. They are
        not counted in any average: `build_review_summary` filters on
        `is_approved=True` independently of this queryset.
        """
        queryset = Review.objects.filter(product=self.get_product()).select_related('user', 'product')
        user = self.request.user
        if user and user.is_authenticated:
            if user.is_staff:
                return queryset
            return queryset.filter(Q(is_approved=True) | Q(user=user))
        return queryset.filter(is_approved=True)

    def create(self, request, *args, **kwargs):
        """
        `201 {review, review_summary}` — the summary comes back in the same
        response so the PDP can repaint its hero stars, its average and its
        histogram from the server's numbers instead of averaging the page of
        reviews it happens to be holding (§2e mechanism 3).

        A duplicate is a `409`, not a `400`: the request is well-formed, it just
        conflicts with a review the user already left.
        """
        product = self.get_product()

        if Review.objects.filter(product=product, user=request.user).exists():
            return Response(
                {
                    'error': 'ALREADY_REVIEWED',
                    'detail': 'You have already reviewed this product. Edit your existing review instead.',
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # "Verified Buyer" is decided here, once, from order history — never
        # taken from the client and never recomputed later (§2e).
        order_item = find_qualifying_order_item(request.user, product)

        try:
            with transaction.atomic():
                review = serializer.save(
                    product=product,
                    user=request.user,
                    is_verified_purchase=order_item is not None,
                    order_item=order_item,
                )
        except IntegrityError:
            # Lost the race against a concurrent duplicate POST.
            return Response(
                {
                    'error': 'ALREADY_REVIEWED',
                    'detail': 'You have already reviewed this product.',
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {
                'review': self.get_serializer(review).data,
                'review_summary': build_review_summary(product),
            },
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        """
        Kept consistent with `create()` for any caller that reaches the viewset
        through the generic path (the browsable API form, a future bulk tool):
        product, user and the verification flag are still server-set.
        """
        product = self.get_product()
        order_item = find_qualifying_order_item(self.request.user, product)
        serializer.save(
            product=product,
            user=self.request.user,
            is_verified_purchase=order_item is not None,
            order_item=order_item,
        )

    def perform_update(self, serializer):
        """
        An edit may change the words and the stars. It may not change who wrote
        it, which product it is about, or whether the author is a verified
        buyer — `is_verified_purchase` is explicitly not recomputed, so a later
        refund cannot retroactively erase a genuine review (§2e).
        """
        serializer.save()

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            response.data = {
                'review': response.data,
                'review_summary': build_review_summary(self.get_product()),
            }
        return response

    def destroy(self, request, *args, **kwargs):
        product = self.get_product()
        super().destroy(request, *args, **kwargs)
        # The rating cache is refreshed by the post_delete receiver on commit;
        # this body is the live count, so the client never has to guess.
        return Response({'review_summary': build_review_summary(product)}, status=status.HTTP_200_OK)


class TopReviewViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    `/api/products/reviews/top/` (§2b #13) — the homepage testimonial source.

    It exists so `CustomerTestimonials.jsx` can be rebuilt on real rows. When
    there are none it returns `[]` and the section is simply not rendered; it is
    never filled with placeholder quotes.

    Registered by `products/urls.py` as
    `router.register(r'reviews', TopReviewViewSet, basename='top-reviews')`.
    """

    serializer_class = TopReviewSerializer
    permission_classes = []
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogue'
    pagination_class = None

    def get_queryset(self):
        min_rating = _coerce_int(
            self.request.query_params.get('min_rating'),
            TOP_REVIEWS_DEFAULT_MIN_RATING,
            RATING_MIN,
            RATING_MAX,
        )
        return (
            Review.objects.filter(
                is_approved=True,
                rating__gte=min_rating,
                product__show_at_website=True,
            )
            .select_related('user', 'product')
            # Verified buyers first, then newest. A testimonial whose author we
            # can prove bought the product is worth more than one we cannot.
            .order_by('-is_verified_purchase', '-created_at')
        )

    def _limited(self):
        limit = _coerce_int(
            self.request.query_params.get('limit'),
            TOP_REVIEWS_DEFAULT_LIMIT,
            1,
            TOP_REVIEWS_MAX_LIMIT,
        )
        return self.get_queryset()[:limit]

    @action(detail=False, methods=['get'], url_path='top')
    def top(self, request):
        serializer = self.get_serializer(self._limited(), many=True)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        """
        Same payload at the collection root. Registering the viewset gives the
        router a list route whether or not it is advertised, so it answers with
        something coherent instead of a 404 or an unpaginated full table.
        """
        serializer = self.get_serializer(self._limited(), many=True)
        return Response(serializer.data)
