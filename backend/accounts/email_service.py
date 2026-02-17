"""
Email service module for Le foyeR.
Handles all transactional emails: verification, welcome, password reset, order confirmation.
"""
import secrets
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


def _get_base_styles():
    """Common CSS styles for email templates."""
    return """
        body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background-color: #1a1a1a; padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; font-family: 'Georgia', serif; font-size: 28px; margin: 0; letter-spacing: 2px; }
        .header .tagline { color: #b0b0b0; font-size: 12px; margin-top: 5px; letter-spacing: 1px; }
        .content { padding: 40px 30px; }
        .content h2 { color: #1a1a1a; font-size: 22px; margin-bottom: 15px; }
        .content p { color: #555555; font-size: 15px; line-height: 1.6; margin-bottom: 15px; }
        .btn { display: inline-block; background-color: #1a1a1a; color: #ffffff !important; text-decoration: none; padding: 14px 35px; border-radius: 25px; font-size: 14px; font-weight: 600; letter-spacing: 1px; margin: 20px 0; }
        .btn:hover { background-color: #333333; }
        .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .order-table th { background-color: #f8f8f8; padding: 12px; text-align: left; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #eee; }
        .order-table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; }
        .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #1a1a1a; }
        .footer { background-color: #f8f8f8; padding: 25px 30px; text-align: center; border-top: 1px solid #eee; }
        .footer p { color: #999999; font-size: 12px; margin: 5px 0; }
        .footer a { color: #1a1a1a; text-decoration: none; }
        .highlight-box { background-color: #f8f8f8; border-left: 4px solid #1a1a1a; padding: 15px 20px; margin: 20px 0; }
        .highlight-box p { margin: 5px 0; }
    """


def _wrap_email(content, title=""):
    """Wrap content in the standard Le foyeR. email layout."""
    styles = _get_base_styles()
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <style>{styles}</style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <h1>Le foyeR.</h1>
                <div class="tagline">LUXURY SKINCARE FOR FAMILY</div>
            </div>
            {content}
            <div class="footer">
                <p>&copy; Le foyeR. Global | <a href="{settings.SITE_URL}">lefoyerglobal.com</a></p>
                <p>This is an automated email. Please do not reply directly.</p>
            </div>
        </div>
    </body>
    </html>
    """


def generate_verification_token():
    """Generate a unique verification token."""
    return secrets.token_urlsafe(48)


def send_verification_email(user):
    """Send email verification link to newly registered user."""
    token = generate_verification_token()
    user.email_verification_token = token
    user.save(update_fields=['email_verification_token'])

    verification_link = f"{settings.SITE_URL}/#/verify-email/{token}"

    content = f"""
    <div class="content">
        <h2>Verify Your Email</h2>
        <p>Hello{' ' + user.first_name if user.first_name else ''},</p>
        <p>Thank you for creating an account with Le foyeR. To complete your registration and start shopping, please verify your email address.</p>
        <p style="text-align: center;">
            <a href="{verification_link}" class="btn">VERIFY EMAIL</a>
        </p>
        <p style="font-size: 13px; color: #999;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">{verification_link}</p>
        <p style="font-size: 13px; color: #999;">This link will expire in 24 hours.</p>
    </div>
    """

    html_message = _wrap_email(content, "Verify Your Email - Le foyeR.")
    plain_message = f"Hello, verify your email by visiting: {verification_link}"

    try:
        send_mail(
            subject='Verify Your Email - Le foyeR.',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Verification email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email to {user.email}: {e}")
        return False


def send_welcome_email(user):
    """Send welcome email after successful verification."""
    content = f"""
    <div class="content">
        <h2>Welcome to Le foyeR.</h2>
        <p>Hello{' ' + user.first_name if user.first_name else ''},</p>
        <p>Your email has been verified and your account is now active! Welcome to Le foyeR. — luxury skincare for the whole family.</p>
        <p>Explore our curated collection of premium skincare products designed for the entire family.</p>
        <p style="text-align: center;">
            <a href="{settings.SITE_URL}/#/products" class="btn">START SHOPPING</a>
        </p>
    </div>
    """

    html_message = _wrap_email(content, "Welcome to Le foyeR.")
    plain_message = f"Welcome to Le foyeR.! Your email is verified. Start shopping at {settings.SITE_URL}"

    try:
        send_mail(
            subject='Welcome to Le foyeR. 🏠',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Welcome email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email to {user.email}: {e}")
        return False


def send_password_reset_email(user, reset_link):
    """Send password reset email."""
    content = f"""
    <div class="content">
        <h2>Reset Your Password</h2>
        <p>Hello{' ' + user.first_name if user.first_name else ''},</p>
        <p>We received a request to reset the password for your Le foyeR. account. Click the button below to set a new password.</p>
        <p style="text-align: center;">
            <a href="{reset_link}" class="btn">RESET PASSWORD</a>
        </p>
        <p style="font-size: 13px; color: #999;">If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">Or copy this link: {reset_link}</p>
    </div>
    """

    html_message = _wrap_email(content, "Reset Your Password - Le foyeR.")
    plain_message = f"Reset your password by visiting: {reset_link}"

    try:
        send_mail(
            subject='Reset Your Password - Le foyeR.',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Password reset email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {user.email}: {e}")
        return False


def send_order_confirmation_email(order):
    """Send order confirmation email with order details."""
    # Build order items table rows
    items_html = ""
    for item in order.items.all():
        items_html += f"""
        <tr>
            <td>{item.product.name}</td>
            <td style="text-align: center;">{item.quantity}</td>
            <td style="text-align: right;">₹{item.price:,.2f}</td>
            <td style="text-align: right;">₹{(item.price * item.quantity):,.2f}</td>
        </tr>
        """

    # Calculate totals
    subtotal = order.total
    discount_amount = (subtotal * order.discount / 100) if order.discount else 0
    final_total = subtotal - discount_amount

    discount_row = ""
    if order.discount > 0:
        discount_row = f"""
        <tr>
            <td colspan="3" style="text-align: right; color: #28a745;">Discount ({order.discount}%)</td>
            <td style="text-align: right; color: #28a745;">-₹{discount_amount:,.2f}</td>
        </tr>
        """

    payment_method_display = "Cash on Delivery" if order.payment_method == "COD" else "Prepaid (Online)"

    content = f"""
    <div class="content">
        <h2>Order Confirmed! 🎉</h2>
        <p>Hello {order.first_name},</p>
        <p>Thank you for your order! We're getting it ready for you.</p>

        <div class="highlight-box">
            <p><strong>Order ID:</strong> #{order.id}</p>
            <p><strong>Payment Method:</strong> {payment_method_display}</p>
            <p><strong>Order Date:</strong> {order.created_at.strftime('%B %d, %Y at %I:%M %p')}</p>
        </div>

        <h3 style="margin-top: 25px; color: #1a1a1a;">Order Items</h3>
        <table class="order-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
                <tr>
                    <td colspan="3" style="text-align: right;"><strong>Subtotal</strong></td>
                    <td style="text-align: right;"><strong>₹{subtotal:,.2f}</strong></td>
                </tr>
                {discount_row}
                <tr class="total-row">
                    <td colspan="3" style="text-align: right;">TOTAL</td>
                    <td style="text-align: right;">₹{final_total:,.2f}</td>
                </tr>
            </tbody>
        </table>

        <h3 style="margin-top: 25px; color: #1a1a1a;">Shipping Address</h3>
        <div class="highlight-box">
            <p>{order.first_name} {order.last_name}</p>
            <p>{order.address}</p>
            <p>{order.city}, {order.state} - {order.pincode}</p>
            <p>Phone: {order.phone}</p>
        </div>

        <p style="text-align: center; margin-top: 25px;">
            <a href="{settings.SITE_URL}/#/orders/{order.id}" class="btn">VIEW ORDER</a>
        </p>
    </div>
    """

    html_message = _wrap_email(content, f"Order #{order.id} Confirmed - Le foyeR.")
    plain_message = f"Your order #{order.id} has been confirmed. Total: ₹{final_total:,.2f}. View it at {settings.SITE_URL}"

    try:
        send_mail(
            subject=f'Order #{order.id} Confirmed - Le foyeR.',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Order confirmation email sent for order #{order.id} to {order.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send order confirmation email for order #{order.id}: {e}")
        return False


def send_shipment_update_email(order, new_status):
    """Send shipment status update email to customer."""
    status_messages = {
        'booked': ('Your order has been booked for shipping!', '📦'),
        'pickup_scheduled': ('Pickup has been scheduled for your order.', '🚚'),
        'picked_up': ('Your order has been picked up and is on its way!', '🚛'),
        'in_transit': ('Your order is in transit.', '✈️'),
        'out_for_delivery': ('Your order is out for delivery today!', '🏃'),
        'delivered': ('Your order has been delivered!', '🎉'),
    }

    message, emoji = status_messages.get(new_status, (f'Order status updated to: {new_status}', '📋'))

    content = f"""
    <div class="content">
        <h2>Shipment Update {emoji}</h2>
        <p>Hello {order.first_name},</p>
        <p>{message}</p>

        <div class="highlight-box">
            <p><strong>Order ID:</strong> #{order.id}</p>
            <p><strong>Status:</strong> {new_status.replace('_', ' ').title()}</p>
        </div>

        <p style="text-align: center; margin-top: 25px;">
            <a href="{settings.SITE_URL}/#/orders/{order.id}" class="btn">TRACK ORDER</a>
        </p>
    </div>
    """

    html_message = _wrap_email(content, f"Shipment Update - Order #{order.id}")
    plain_message = f"Your order #{order.id} status: {message}"

    try:
        send_mail(
            subject=f'Shipment Update: Order #{order.id} - {new_status.replace("_", " ").title()}',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Shipment update email sent for order #{order.id} (status: {new_status})")
        return True
    except Exception as e:
        logger.error(f"Failed to send shipment update email for order #{order.id}: {e}")
        return False
