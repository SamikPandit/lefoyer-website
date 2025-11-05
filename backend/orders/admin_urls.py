from django.urls import path
from .analytics_views import sales_analytics

urlpatterns = [
    path('analytics/', sales_analytics, name='sales_analytics'),
]
