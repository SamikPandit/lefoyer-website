"""
Celery tasks for Blue Dart shipping automation
"""
import logging
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from django.core.files.base import ContentFile

from .models import Shipment, TrackingEvent
from .client import BlueDartClient, BlueDartAPIError
from orders.models import Order

logger = logging.getLogger(__name__)

#: Until product weights exist in the catalogue there is one declared weight for
#: every parcel. Named rather than repeated as a bare 0.5 in four places.
DEFAULT_WEIGHT_KG = 0.5


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def generate_shipment_for_order(self, order_id):
    """Generate the Blue Dart waybill and label for a confirmed order.

    Called from ``orders.services.confirm_order`` via
    ``transaction.on_commit`` - not from a ``post_save`` signal. See
    ``shipping/signals.py`` for why the signal had to go.

    Two things are fixed here beyond the dispatch point.

    **The shipment row is obtained with ``get_or_create``**, so a duplicated
    dispatch (a retried Celery delivery, an operator re-running it) cannot
    create a second shipment for one order.

    **A transient waybill failure is distinguished from "a shipment already
    exists".** The old version, on a Blue Dart error, created a Shipment row
    with ``status='pending'`` and the error message - and then retried. The
    retry found ``hasattr(order, 'shipment')`` true, logged "Shipment already
    exists" and returned. So the very row written to record the failure was what
    stopped the failure from ever being retried, permanently. Now the test is
    whether an **AWB number** exists: no AWB means the booking never succeeded
    and is still retry-worthy.
    """
    logger.info(f"Starting shipment generation for order #{order_id}")

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        logger.error(f"Order #{order_id} not found")
        return {'status': 'order_missing', 'order_id': order_id}

    is_cod = getattr(order, 'payment_method', 'PREPAID') == 'COD'
    if not is_cod and order.payment_status != 'COMPLETED':
        logger.warning(
            f"Order #{order_id} is not paid (status: {order.payment_status}) and is "
            f"not COD; not booking a shipment."
        )
        return {'status': 'not_payable', 'order_id': order_id}

    if getattr(order, 'needs_manual_review', False):
        # confirm_order found short stock on a paid order. Booking a courier for
        # goods that may not exist is worse than waiting for a human.
        logger.error(
            f"Order #{order_id} is flagged for manual review; not booking a shipment."
        )
        return {'status': 'needs_manual_review', 'order_id': order_id}

    sub_product_code = 'C' if is_cod else 'P'
    collectible_amount = order.total if is_cod else 0

    shipment, created = Shipment.objects.get_or_create(
        order=order,
        defaults={
            'destination_pincode': order.pincode,
            'origin_area': getattr(settings, 'BLUEDART_ORIGIN_AREA', '') or 'BOM',
            'weight_kg': DEFAULT_WEIGHT_KG,
            'declared_value': order.total,
            'collectible_amount': collectible_amount,
            'sub_product_code': sub_product_code,
            'status': 'pending',
        },
    )

    # An AWB - not the mere existence of a row - is what means "booked".
    if shipment.awb_number:
        logger.info(
            f"Shipment already booked for order #{order_id}: AWB {shipment.awb_number}"
        )
        return {
            'status': 'already_booked',
            'order_id': order_id,
            'awb_number': shipment.awb_number,
        }

    if not created:
        logger.info(
            f"Retrying waybill generation for order #{order_id} "
            f"(existing shipment row has no AWB; last error: {shipment.last_error!r})"
        )

    try:
        client = BlueDartClient()
        result = client.generate_waybill(
            order=order,
            sub_product_code=sub_product_code,
        )
    except Exception as exc:
        # Reaching Blue Dart failed outright. Record it on the row we already
        # have and retry - the row is not evidence of success.
        shipment.last_error = str(exc)[:2000]
        shipment.status = 'pending'
        shipment.save(update_fields=['last_error', 'status', 'updated_at'])
        logger.error(f"Waybill call raised for order #{order_id}: {exc}")
        raise self.retry(exc=exc)

    if result['error']:
        shipment.last_error = str(result['error'])[:2000]
        shipment.status = 'pending'
        shipment.collectible_amount = collectible_amount
        shipment.sub_product_code = sub_product_code
        shipment.declared_value = order.total
        shipment.destination_pincode = order.pincode
        shipment.save()
        logger.error(
            f"Waybill generation failed for order #{order_id}: {result['error']} "
            f"- shipment row kept with no AWB so this stays retry-worthy."
        )
        raise self.retry(exc=BlueDartAPIError(result['error']))

    shipment.awb_number = result['awb_number']
    shipment.destination_area = result['destination_area']
    shipment.destination_pincode = order.pincode
    shipment.origin_area = client.origin_area
    shipment.weight_kg = DEFAULT_WEIGHT_KG
    shipment.declared_value = order.total
    shipment.collectible_amount = collectible_amount
    shipment.sub_product_code = sub_product_code
    shipment.status = 'booked'
    shipment.last_error = None
    shipment.save()

    if result['label_pdf_bytes']:
        shipment.label_pdf.save(
            f"label_{result['awb_number']}.pdf",
            ContentFile(result['label_pdf_bytes']),
            save=True,
        )

    try:
        transit_result = client.get_transit_time(order.pincode)
        if transit_result['expected_delivery_date']:
            shipment.expected_delivery_date = transit_result['expected_delivery_date']
            shipment.save(update_fields=['expected_delivery_date', 'updated_at'])
    except Exception as exc:
        # Cosmetic. An absent ETA must not undo a successful booking, and must
        # not trigger a retry that would try to book a second waybill.
        logger.warning(f"Failed to get transit time for order #{order_id}: {exc}")

    logger.info(
        f"Shipment created for order #{order_id}: AWB {result['awb_number']}"
    )
    return {
        'status': 'booked',
        'order_id': order_id,
        'awb_number': result['awb_number'],
    }


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
                    
                    # Send notification email for significant status changes
                    notify_statuses = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered']
                    if shipment.status in notify_statuses:
                        try:
                            from accounts.tasks import send_shipment_update_email_task
                            send_shipment_update_email_task.delay(shipment.order_id, shipment.status)
                        except Exception as e:
                            logger.warning(f"Failed to queue shipment update email: {e}")
            
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
