"""
Shipping app configuration
"""
from django.apps import AppConfig


class ShippingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'shipping'
    
    def ready(self):
        """Import signals when app is ready"""
        import shipping.signals
