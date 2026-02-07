"""
Django signals for automatic shipment generation after payment confirmation
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from orders.models import Order
from .tasks import generate_shipment_for_order
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Order)
def create_shipment_after_payment(sender,  instance, created, **kwargs):
    """
    Automatically trigger shipment generation when order payment is completed.
    
    This signal fires when:
    - Payment status changes to 'COMPLETED'
    - Shipment doesn't already exist for this order
    """
    # Only process if payment is completed and shipment doesn't exist
    if instance.payment_status == 'COMPLETED' and not hasattr(instance, 'shipment'):
        logger.info(f"Payment completed for order #{instance.id}, triggering shipment generation")
        
        # Queue the shipment generation task
        generate_shipment_for_order.delay(instance.id)
