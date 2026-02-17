from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Product, Category, SubCategory
from .serializers import ProductSerializer, CategorySerializer, SubCategorySerializer
from .filters import ProductFilter

from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticatedOrReadOnly


class ReadOnlyOrAdminPermission(IsAuthenticatedOrReadOnly):
    """Allow read access to anyone, but restrict write operations to admin users."""

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user and request.user.is_staff


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    lookup_field = 'slug'
    permission_classes = [ReadOnlyOrAdminPermission]

    def get_queryset(self):
        return Product.objects.filter(show_at_website=True)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def featured(self, request):
        featured_products = Product.objects.filter(is_featured=True, show_at_website=True)
        serializer = self.get_serializer(featured_products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def bestsellers(self, request):
        bestseller_products = Product.objects.filter(is_bestseller=True, show_at_website=True)
        serializer = self.get_serializer(bestseller_products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def related(self, request, slug=None):
        try:
            product = self.get_object()
            related_products = Product.objects.filter(category=product.category).exclude(id=product.id)[:4]
            serializer = self.get_serializer(related_products, many=True)
            return Response(serializer.data)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [ReadOnlyOrAdminPermission]

class SubCategoryViewSet(viewsets.ModelViewSet):
    queryset = SubCategory.objects.all()
    serializer_class = SubCategorySerializer
    permission_classes = [ReadOnlyOrAdminPermission]
