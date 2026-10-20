"""
Celery tasks for sending emails asynchronously.
These tasks wrap the functions in email_service.py so emails don't block HTTP
requests.

WHY EVERY TASK CHANGED
----------------------
They were declared `@shared_task(max_retries=3, default_retry_delay=60)` without
`bind=True` and without ever calling `self.retry(...)`. `max_retries` is only
consulted by `Task.retry()`, so **the declared retry policy never fired**: the
first SMTP blip dropped the email permanently. Worse, the senders used to return
`False` on failure instead of raising, and these tasks discarded the return
value — so a total mail outage was invisible everywhere.

Now: `bind=True`, the senders raise, and each task re-raises through
`self.retry(exc=exc, countdown=60)`. When the retries are exhausted the failure
is logged once at ERROR with the recipient, so an outage is findable.
"""
from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

RETRY_COUNTDOWN_SECONDS = 60
MAX_RETRIES = 3


def _retry(task, exc, description):
    """Re-raise `exc` as a Celery retry, or log the final give-up."""
    try:
        raise task.retry(exc=exc, countdown=RETRY_COUNTDOWN_SECONDS)
    except MaxRetriesExceededError:
        logger.error(
            'Giving up on %s after %s retries: %s', description, MAX_RETRIES, exc
        )
        raise


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=RETRY_COUNTDOWN_SECONDS)
def send_verification_email_task(self, user_id, token):
    """Send the verification email for an already-persisted token.

    `token` is **required**. The caller generates it exactly once, via
    `User.issue_verification_token()`, and passes it here; this task must never
    mint a token of its own, because that was precisely the C-25 bug — the row
    held one token and the inbox held another.

    A message enqueued by the previous code (no `token` argument) will fail
    loudly with a `TypeError` rather than silently rotating the token. Resolve
    any such in-flight message with the "Resend verification email" admin
    action, which issues a fresh token and mails that one.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error('User %s not found for verification email', user_id)
        return False

    from .email_service import send_verification_email

    try:
        return send_verification_email(user, token)
    except Exception as exc:
        logger.error('Failed to send verification email to %s: %s', user.email, exc)
        _retry(self, exc, f'verification email to {user.email}')


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=RETRY_COUNTDOWN_SECONDS)
def send_welcome_email_task(self, user_id):
    """Send welcome email asynchronously."""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error('User %s not found for welcome email', user_id)
        return False

    from .email_service import send_welcome_email

    try:
        return send_welcome_email(user)
    except Exception as exc:
        _retry(self, exc, f'welcome email to {user.email}')


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=RETRY_COUNTDOWN_SECONDS)
def send_password_reset_email_task(self, user_id, reset_link):
    """Send password reset email asynchronously."""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error('User %s not found for password reset email', user_id)
        return False

    from .email_service import send_password_reset_email

    try:
        return send_password_reset_email(user, reset_link)
    except Exception as exc:
        _retry(self, exc, f'password reset email to {user.email}')


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=RETRY_COUNTDOWN_SECONDS)
def send_order_confirmation_email_task(self, order_id):
    """Send order confirmation email asynchronously."""
    from orders.models import Order

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        logger.error('Order %s not found for confirmation email', order_id)
        return False

    from .email_service import send_order_confirmation_email

    try:
        return send_order_confirmation_email(order)
    except Exception as exc:
        _retry(self, exc, f'order confirmation email for order {order_id}')


@shared_task(bind=True, max_retries=MAX_RETRIES, default_retry_delay=RETRY_COUNTDOWN_SECONDS)
def send_shipment_update_email_task(self, order_id, new_status):
    """Send shipment status update email asynchronously."""
    from orders.models import Order

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        logger.error('Order %s not found for shipment update email', order_id)
        return False

    from .email_service import send_shipment_update_email

    try:
        return send_shipment_update_email(order, new_status)
    except Exception as exc:
        _retry(self, exc, f'shipment update email for order {order_id}')
