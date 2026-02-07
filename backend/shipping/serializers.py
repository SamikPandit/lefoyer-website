"""
DRF Serializers for shipping models
"""
from rest_framework import serializers
from .models import Shipment, TrackingEvent


class TrackingEventSerializer(serializers.ModelSerializer):
    """Serializer for tracking events"""
    
    class Meta:
        model = TrackingEvent
        fields = [
            'id',
            'scan_date',
            'scan_code',
            'scan_description',
            'scanned_location',
            'instructions',
            'created_at'
        ]
        read_only_fields = fields


class ShipmentSerializer(serializers.ModelSerializer):
    """Serializer for shipment details"""
    
    events = TrackingEventSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    status_color = serializers.CharField(source='get_status_display_color', read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Shipment
        fields = [
            'id',
            'awb_number',
            'status',
            'status_display',
            'status_color',
            'is_active',
            'origin_area',
            'destination_area',
            'destination_pincode',
            'weight_kg',
            'expected_delivery_date',
            'created_at',
            'shipped_at',
            'delivered_at',
            'events',
            'last_error'
        ]
        read_only_fields = fields


class PincodeCheckSerializer(serializers.Serializer):
    """Serializer for pincode serviceability check request"""
    pincode = serializers.CharField(max_length=6, min_length=6)
    
    def validate_pincode(self, value):
        """Validate pincode is 6 digits"""
        if not value.isdigit():
            raise serializers.ValidationError("Pincode must be 6 digits")
        return value


class PincodeCheckResponseSerializer(serializers.Serializer):
    """Serializer for pincode check response"""
    serviceable = serializers.BooleanField()
    cod_available = serializers.BooleanField()
    expected_delivery_date = serializers.DateField(allow_null=True)
    transit_days = serializers.IntegerField(allow_null=True)
    area_code = serializers.CharField(allow_null=True)
    error = serializers.CharField(allow_null=True)
