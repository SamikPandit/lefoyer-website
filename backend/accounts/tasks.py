"""
Celery tasks for sending emails asynchronously.
These tasks wrap the functions in email_service.py so emails don't block HTTP requests.
"""
from celery import shared_task
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(max_retries=3, default_retry_delay=60)
def send_verification_email_task(user_id):
    """Send verification email asynchronously."""
    from .email_service import send_verification_email
    try:
        user = User.objects.get(id=user_id)
        send_verification_email(user)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for verification email")
    except Exception as e:
        logger.error(f"Failed to send verification email for user {user_id}: {e}")
        raise


@shared_task(max_retries=3, default_retry_delay=60)
def send_welcome_email_task(user_id):
    """Send welcome email asynchronously."""
    from .email_service import send_welcome_email
    try:
        user = User.objects.get(id=user_id)
        send_welcome_email(user)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for welcome email")
    except Exception as e:
        logger.error(f"Failed to send welcome email for user {user_id}: {e}")
        raise


@shared_task(max_retries=3, default_retry_delay=60)
def send_password_reset_email_task(user_id, reset_link):
    """Send password reset email asynchronously."""
    from .email_service import send_password_reset_email
    try:
        user = User.objects.get(id=user_id)
        send_password_reset_email(user, reset_link)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for password reset email")
    except Exception as e:
        logger.error(f"Failed to send password reset email for user {user_id}: {e}")
        raise


@shared_task(max_retries=3, default_retry_delay=60)
def send_order_confirmation_email_task(order_id):
    """Send order confirmation email asynchronously."""
    from .email_service import send_order_confirmation_email
    from orders.models import Order
    try:
        order = Order.objects.get(id=order_id)
        send_order_confirmation_email(order)
    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found for confirmation email")
    except Exception as e:
        logger.error(f"Failed to send order confirmation email for order {order_id}: {e}")
        raise


@shared_task(max_retries=3, default_retry_delay=60)
def send_shipment_update_email_task(order_id, new_status):
    """Send shipment status update email asynchronously."""
    from .email_service import send_shipment_update_email
    from orders.models import Order
    try:
        order = Order.objects.get(id=order_id)
        send_shipment_update_email(order, new_status)
    except Order.DoesNotExist:
        logger.error(f"Order {order_id} not found for shipment update email")
    except Exception as e:
        logger.error(f"Failed to send shipment update email for order {order_id}: {e}")
        raise
