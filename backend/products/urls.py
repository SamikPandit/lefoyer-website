from django.urls import path, include
from rest_framework_nested import routers
from .views import ProductViewSet, CategoryViewSet, SubCategoryViewSet
from reviews.views import ReviewViewSet

router = routers.DefaultRouter()
router.register(r'products', ProductViewSet, basename='products')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'subcategories', SubCategoryViewSet, basename='subcategories')

products_router = routers.NestedSimpleRouter(router, r'products', lookup='product_slug')
products_router.register(r'reviews', ReviewViewSet, basename='product-reviews')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(products_router.urls)),
]
