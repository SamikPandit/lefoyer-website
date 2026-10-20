"""
Shipping app configuration
"""
import importlib.util
import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class ShippingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'shipping'

    def ready(self):
        """
        Import signal receivers, if there are still any to import.

        Shipment creation is moving out of a `post_save` receiver on `Order` and
        into an explicit `transaction.on_commit` hook in `orders.services`
        (WP-05 owns `shipping/signals.py` and is removing the receiver). Probing
        for the module first means this app keeps booting whether that file
        survives or not, and an `ImportError` raised *inside* the module is still
        allowed to propagate rather than being silently swallowed.
        """
        if importlib.util.find_spec('shipping.signals') is None:
            logger.debug(
                'shipping.signals is absent; shipment creation is handled by '
                'orders.services on commit.'
            )
            return
        import shipping.signals  # noqa: F401
