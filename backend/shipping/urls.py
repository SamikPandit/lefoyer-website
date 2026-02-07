"""
URL routing for shipping API endpoints
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'shipments', views.ShipmentViewSet, basename='shipment')

urlpatterns = [
    # Public endpoints
    path('check-serviceability/', views.check_serviceability, name='check-serviceability'),
    path('track/<str:awb_number>/', views.track_shipment, name='track-shipment'),
    
    # Authenticated endpoints
    path('label/<str:awb_number>/', views.download_label, name='download-label'),
    
    # ViewSet routes (shipments list/detail)
    path('', include(router.urls)),
]
