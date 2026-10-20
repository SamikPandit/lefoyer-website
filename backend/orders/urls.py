from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OrderViewSet, PaymentCallbackView

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='order')

urlpatterns = [
    # Declared BEFORE the router. The router is registered at r'', so its detail
    # routes are `orders/<pk>/...`; `payment/callback/` cannot collide with one,
    # but listing it first keeps that independent of the router's internals.
    #
    # `initiate-payment/` is no longer a separate APIView: it is an action on
    # OrderViewSet, which the router publishes at the identical path
    # `orders/<pk>/initiate-payment/`. The URL is unchanged for existing
    # clients; what changed is that it now shares one response envelope with
    # `retry-payment/` instead of having its own.
    path('payment/callback/', PaymentCallbackView.as_view(), name='payment-callback'),
    path('', include(router.urls)),
]
