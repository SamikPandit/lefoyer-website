"""
Django REST Framework views for shipping API endpoints
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import FileResponse, Http404

from .models import Shipment, TrackingEvent
from .serializers import (
    ShipmentSerializer,
    TrackingEventSerializer,
    PincodeCheckSerializer,
    PincodeCheckResponseSerializer
)
from .client import BlueDartClient, BlueDartAPIError

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_serviceability(request):
    """
    Check pincode serviceability and get estimated delivery date.
    
    GET /api/shipping/check-serviceability/?pincode=560001
    
    Returns:
        {
            "serviceable": true,
            "cod_available": false,
            "expected_delivery_date": "2026-02-10",
            "transit_days": 2,
            "area_code": "BLR",
            "error": null
        }
    """
    serializer = PincodeCheckSerializer(data=request.query_params)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    pincode = serializer.validated_data['pincode']
    
    try:
        client = BlueDartClient()
        
        # Check serviceability
        serviceability_result = client.check_serviceability(pincode)
        
        if not serviceability_result['serviceable']:
            response_data = {
                'serviceable': False,
                'cod_available': False,
                'expected_delivery_date': None,
                'transit_days': None,
                'area_code': None,
                'error': serviceability_result.get('error')
            }
            return Response(response_data)
        
        # Get transit time
        transit_result = client.get_transit_time(pincode)
        
        response_data = {
            'serviceable': True,
            'cod_available': serviceability_result['cod_available'],
            'expected_delivery_date': transit_result.get('expected_delivery_date'),
            'transit_days': transit_result.get('transit_days'),
            'area_code': transit_result.get('area_code'),
            'error': transit_result.get('error')
        }
        
        return Response(response_data)
        
    except BlueDartAPIError as e:
        logger.error(f"Blue Dart API error checking serviceability for {pincode}: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.error(f"Unexpected error checking serviceability for {pincode}: {e}")
        return Response(
            {'error': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def track_shipment(request, awb_number):
    """
    Track a shipment by AWB number.
    
    GET /api/shipping/track/{awb_number}/
    
    Returns:
        {
            "awb_number": "12345678901",
            "status": "in_transit",
            "status_display": "In Transit",
            "status_color": "blue",
            "events": [
                {
                    "scan_date": "2026-02-07T10:30:00Z",
                    "scan_description": "Departed from Mumbai Hub",
                    "scanned_location": "Mumbai",
                    ...
                }
            ],
            ...
        }
    """
    try:
        # Try to find existing shipment
        try:
            shipment = Shipment.objects.get(awb_number=awb_number)
            serializer = ShipmentSerializer(shipment)
            return Response(serializer.data)
        except Shipment.DoesNotExist:
            # Shipment not in our DB, try fetching directly from Blue Dart
            client = BlueDartClient()
            result = client.track_shipment(awb_number)
            
            if result['error']:
                return Response(
                    {'error': result['error']},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Return basic tracking data
            return Response({
                'awb_number': awb_number,
                'status': result.get('current_status'),
                'events': result.get('scan_events', [])
            })
            
    except BlueDartAPIError as e:
        logger.error(f"Blue Dart API error tracking {awb_number}: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.error(f"Unexpected error tracking {awb_number}: {e}")
        return Response(
            {'error': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_label(request, awb_number):
    """
    Download shipping label PDF.
    
    GET /api/shipping/label/{awb_number}/
    
    Returns: PDF file
    """
    try:
        shipment = Shipment.objects.get(awb_number=awb_number)
        
        # Check if user owns this order
        if shipment.order.user != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not shipment.label_pdf:
            return Response(
                {'error': 'Label not available'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return FileResponse(
            shipment.label_pdf.open('rb'),
            content_type='application/pdf',
            as_attachment=True,
            filename=f'label_{awb_number}.pdf'
        )
        
    except Shipment.DoesNotExist:
        raise Http404("Shipment not found")


class ShipmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for shipment management (admin/staff only).
    
    List, retrieve shipments.
    """
    queryset = Shipment.objects.all().select_related('order').prefetch_related('events')
    serializer_class = ShipmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter shipments by user unless staff"""
        queryset = super().get_queryset()
        
        if self.request.user.is_staff:
            return queryset
        
        # Regular users can only see their own shipments
        return queryset.filter(order__user=self.request.user)
