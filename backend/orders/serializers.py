from rest_framework import serializers
from .models import Order, OrderItem
from products.serializers import ProductSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.ImageField(source='product.image_main', read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_image', 'price', 'quantity']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    shipment = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = '__all__'
    
    def get_shipment(self, obj):
        """Get shipment details if available"""
        try:
            shipment = obj.shipment
            return {
                'awb_number': shipment.awb_number,
                'status': shipment.status,
                'tracking_url': f'/api/shipping/track/{shipment.awb_number}/' if shipment.awb_number else None,
            }
        except:
            return None
