"""
Celery tasks for Blue Dart shipping automation
"""
import logging
from datetime import datetime, timedelta
from celery import shared_task
from django.utils import timezone
from django.core.files.base import ContentFile

from .models import Shipment, TrackingEvent
from .client import BlueDartClient, BlueDartAPIError
from orders.models import Order

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def generate_shipment_for_order(self, order_id):
    """
    Generate Blue Dart shipment (AWB and label) for a completed order.
    
    Triggered automatically when order payment is completed.
    Retry strategy: 3 retries with 5 minute delays on failure.
    
    Args:
        order_id: ID of the Order to create shipment for
    """
    try:
        logger.info(f"Starting shipment generation for order #{order_id}")
        
        # Get the order
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            logger.error(f"Order #{order_id} not found")
            return
        
        # Check if shipment already exists
        if hasattr(order, 'shipment'):
            logger.warning(f"Shipment already exists for order #{order_id}: AWB {order.shipment.awb_number}")
            return
        
        # Check if order is paid or COD
        is_cod = getattr(order, 'payment_method', 'PREPAID') == 'COD'
        
        if not is_cod and order.payment_status != 'COMPLETED':
            logger.warning(f"Order #{order_id} is not paid yet (status: {order.payment_status}) and is not COD")
            return
        
        # Initialize Blue Dart client
        client = BlueDartClient()
        
        # Set COD parameters
        sub_product_code = 'C' if is_cod else 'P'
        collectible_amount = order.total if is_cod else 0
        
        # Generate waybill
        result = client.generate_waybill(
            order=order,
            sub_product_code=sub_product_code,
            # Uses default weight/dimensions from settings for now
            # TODO: Calculate actual weight from order items if product weights are available
        )
        
        if result['error']:
            logger.error(f"Waybill generation failed for order #{order_id}: {result['error']}")
            # Create shipment with error status for tracking
            Shipment.objects.create(
                order=order,
                destination_pincode=order.pincode,
                origin_area='BOM', # Fallback or fetch from client
                weight_kg=0.5,
                declared_value=order.total,
                collectible_amount=collectible_amount,
                sub_product_code=sub_product_code,
                status='pending',
                last_error=result['error']
            )
            # Retry the task
            raise self.retry(exc=BlueDartAPIError(result['error']))
        
        # Create shipment record
        shipment = Shipment.objects.create(
            order=order,
            awb_number=result['awb_number'],
            destination_area=result['destination_area'],
            destination_pincode=order.pincode,
            origin_area=client.origin_area,
            weight_kg=0.5,  # TODO: Calculate from order items
            declared_value=order.total,
            collectible_amount=collectible_amount,
            sub_product_code=sub_product_code,
            status='booked',
        )
        
        # Save label PDF if available
        if result['label_pdf_bytes']:
            shipment.label_pdf.save(
                f"label_{result['awb_number']}.pdf",
                ContentFile(result['label_pdf_bytes']),
                save=True
            )
        
        # Get expected delivery date
        try:
            transit_result = client.get_transit_time(order.pincode)
            if transit_result['expected_delivery_date']:
                shipment.expected_delivery_date = transit_result['expected_delivery_date']
                shipment.save()
        except Exception as e:
            logger.warning(f"Failed to get transit time for order #{order_id}: {e}")
        
        logger.info(f"Shipment created successfully for order #{order_id}: AWB {result['awb_number']}")
        
    except Exception as e:
        logger.error(f"Unexpected error generating shipment for order #{order_id}: {e}")
        raise self.retry(exc=e)


@shared_task
def poll_active_shipments():
    """
    Poll Blue Dart tracking API for all active shipments.
    
    Scheduled via Celery Beat: Every 2 hours.
    Updates shipment status and creates tracking events.
    """
    logger.info("Starting tracking poll for active shipments")
    
    # Get all non-delivered shipments with AWB numbers
    active_shipments = Shipment.objects.filter(
        awb_number__isnull=False
    ).exclude(
        status__in=['delivered', 'cancelled', 'rto_delivered']
    )
    
    logger.info(f"Found {active_shipments.count()} active shipments to track")
    
    client = BlueDartClient()
    updated_count = 0
    error_count = 0
    
    for shipment in active_shipments:
        try:
            result = client.track_shipment(shipment.awb_number)
            
            if result['error']:
                shipment.last_error = result['error']
                shipment.save()
                error_count += 1
                continue
            
            # Update shipment status
            if result['current_status']:
                old_status = shipment.status
                shipment.status = result['current_status']
                
                # Set timestamps based on status
                if shipment.status == 'picked_up' and not shipment.shipped_at:
                    shipment.shipped_at = timezone.now()
                elif shipment.status == 'delivered' and not shipment.delivered_at:
                    shipment.delivered_at = timezone.now()
                
                shipment.save()
                
                if old_status != shipment.status:
                    logger.info(f"Shipment {shipment.awb_number} status changed: {old_status} -> {shipment.status}")
                    updated_count += 1
            
            # Create/update tracking events
            for event_data in result['scan_events']:
                TrackingEvent.objects.get_or_create(
                    shipment=shipment,
                    scan_date=event_data['scan_date'],
                    scan_code=event_data['scan_code'],
                    scanned_location=event_data['scanned_location'],
                    defaults={
                        'scan_description': event_data['scan_description'],
                        'instructions': event_data.get('instructions', '')
                    }
                )
            
        except Exception as e:
            logger.error(f"Error tracking shipment {shipment.awb_number}: {e}")
            error_count += 1
    
    logger.info(f"Tracking poll complete: {updated_count} updated, {error_count} errors")


@shared_task
def register_daily_pickup():
    """
    Register pickup request for all today's booked shipments.
    
    Scheduled via Celery Beat: Daily at 4 PM IST.
    Batches all shipments created today into a single pickup request.
    """
    logger.info("Starting daily pickup registration")
    
    today = timezone.now().date()
    
    # Get all booked shipments from today that don't have pickup scheduled
    shipments_to_pickup = Shipment.objects.filter(
        created_at__date=today,
        status='booked',
        pickup_token__isnull=True,
        awb_number__isnull=False
    )
    
    if not shipments_to_pickup.exists():
        logger.info("No shipments to register for pickup today")
        return
    
    logger.info(f"Registering pickup for {shipments_to_pickup.count()} shipments")
    
    client = BlueDartClient()
    
    try:
        result = client.register_pickup(shipments=list(shipments_to_pickup))
        
        if result['error']:
            logger.error(f"Pickup registration failed: {result['error']}")
            return
        
        # Update shipments with pickup token
        pickup_token = result['pickup_token']
        shipments_to_pickup.update(
            pickup_token=pickup_token,
            status='pickup_scheduled'
        )
        
        logger.info(f"Pickup registered successfully: Token {pickup_token} for {shipments_to_pickup.count()} shipments")
        
    except Exception as e:
        logger.error(f"Error registering pickup: {e}")


@shared_task
def register_shipment_pickup(shipment_ids):
    """
    Register pickup for specific shipments (admin action).
    
    Args:
        shipment_ids: List of Shipment IDs to register for pickup
    """
    logger.info(f"Manual pickup registration for {len(shipment_ids)} shipments")
    
    shipments = Shipment.objects.filter(
        id__in=shipment_ids,
        awb_number__isnull=False
    )
    
    if not shipments.exists():
        logger.warning("No valid shipments found for pickup registration")
        return
    
    client = BlueDartClient()
    
    try:
        result = client.register_pickup(shipments=list(shipments))
        
        if result['error']:
            logger.error(f"Pickup registration failed: {result['error']}")
            return
        
        pickup_token = result['pickup_token']
        shipments.update(
            pickup_token=pickup_token,
            status='pickup_scheduled'
        )
        
        logger.info(f"Pickup registered: Token {pickup_token} for {shipments.count()} shipments")
        
    except Exception as e:
        logger.error(f"Error registering pickup: {e}")


@shared_task(bind=True, max_retries=1)
def cancel_shipment(self, shipment_id):
    """
    Cancel a shipment with Blue Dart.
   
    IMPORTANT: Only works before shipment is picked up/in-scanned.
    
    Args:
        shipment_id: ID of the Shipment to cancel
    """
    try:
        shipment = Shipment.objects.get(id=shipment_id)
    except Shipment.DoesNotExist:
        logger.error(f"Shipment #{shipment_id} not found")
        return
    
    if not shipment.awb_number:
        logger.warning(f"Shipment #{shipment_id} has no AWB number, cannot cancel")
        return
    
    if shipment.status in ['cancelled', 'delivered', 'rto_delivered']:
        logger.warning(f"Shipment {shipment.awb_number} is already {shipment.status}, cannot cancel")
        return
    
    logger.info(f"Cancelling shipment {shipment.awb_number}")
    
    client = BlueDartClient()
    
    try:
        result = client.cancel_waybill(shipment.awb_number)
        
        if result['error']:
            logger.error(f"Cancellation failed for {shipment.awb_number}: {result['error']}")
            shipment.last_error = result['error']
            shipment.save()
            raise self.retry(exc=BlueDartAPIError(result['error']))
        
        shipment.status = 'cancelled'
        shipment.save()
        
        logger.info(f"Shipment {shipment.awb_number} cancelled successfully")
        
    except Exception as e:
        logger.error(f"Error cancelling shipment {shipment.awb_number}: {e}")
        raise self.retry(exc=e)
