"""Catalogue routes.

Mounted by `lefoyer/urls.py` under `api/products/`, and this module adds a
second `products` prefix of its own — so the product list really is
`/api/products/products/` and a product's reviews really are
`/api/products/products/<slug>/reviews/` (IMPL_SPEC §1 C-7). That is ugly but
it is the live, linked-to shape; renaming it would break every existing URL,
so the contract in §2b keeps it and api.js calls it exactly.
"""

import logging

from django.urls import include, path
from rest_framework_nested import routers

from reviews import views as review_views

from .views import (
    CategoryViewSet,
    ConcernViewSet,
    ProductViewSet,
    SkinTypeViewSet,
    SubCategoryViewSet,
)

logger = logging.getLogger(__name__)

router = routers.DefaultRouter()
router.register(r'products', ProductViewSet, basename='products')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'subcategories', SubCategoryViewSet, basename='subcategories')
router.register(r'concerns', ConcernViewSet, basename='concerns')
router.register(r'skin-types', SkinTypeViewSet, basename='skin-types')

# Endpoint #13, `GET /api/products/reviews/top/`, is served by a viewset in the
# reviews app (WP-03). It is resolved by name here rather than imported
# directly: this file and `reviews/views.py` belong to different packages in
# the same change-set, and a hard import would mean the catalogue routes — the
# whole storefront — fail to load if that viewset lands under a different name
# or lands late. If none of the candidates resolve, the route is simply absent
# and the reason is logged once at startup.
TOP_REVIEW_VIEWSET_CANDIDATES = (
    'TopReviewViewSet',
    'TopReviewsViewSet',
    'PublicReviewViewSet',
    'ReviewHighlightViewSet',
)

_top_reviews = next(
    (
        getattr(review_views, name)
        for name in TOP_REVIEW_VIEWSET_CANDIDATES
        if getattr(review_views, name, None) is not None
    ),
    None,
)

if _top_reviews is not None:
    router.register(r'reviews', _top_reviews, basename='top-reviews')
else:
    logger.warning(
        "GET /api/products/reviews/top/ is NOT mounted: reviews.views exposes "
        "none of %s. The homepage testimonial rail will see a 404 and render "
        "nothing, which is the intended empty state, but endpoint #13 is "
        "missing until that viewset exists.",
        ', '.join(TOP_REVIEW_VIEWSET_CANDIDATES),
    )

products_router = routers.NestedSimpleRouter(router, r'products', lookup='product_slug')
products_router.register(r'reviews', review_views.ReviewViewSet, basename='product-reviews')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(products_router.urls)),
]
