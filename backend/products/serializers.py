from rest_framework import serializers
from .models import Product, Category, SubCategory

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCategory
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    in_stock = serializers.SerializerMethodField()
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Product
        exclude = ['show_at_website', 'manual_out_of_stock']

    def get_in_stock(self, obj):
        if obj.manual_out_of_stock:
            return False
        return obj.stock_quantity > 0

    def get_available_quantity(self, obj):
        return obj.stock_quantity
