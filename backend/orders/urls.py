from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, InitiatePaymentView, PaymentCallbackView

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='order')

urlpatterns = [
    path('', include(router.urls)),
    path('<int:pk>/initiate-payment/', InitiatePaymentView.as_view(), name='initiate-payment'),
    path('payment/callback/', PaymentCallbackView.as_view(), name='payment-callback'),
]
