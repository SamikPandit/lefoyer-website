"""
Email service module for Le foyeR.
Handles all transactional emails: verification, welcome, password reset, order
confirmation, shipment updates.

THREE THINGS CHANGED HERE, AND EACH FIXES A CUSTOMER-VISIBLE DEFECT
-------------------------------------------------------------------
1. **Every sender is now pure, and raises on failure.**
   `send_verification_email` used to generate its own token, overwrite the row
   and mail the new one, while `serializers.py` had already generated, saved and
   enqueued a *different* token (C-25). The link in the inbox therefore matched
   the database only by accident of timing. Senders no longer touch the user at
   all: the token is generated in exactly one place
   (`User.issue_verification_token`) and passed in.
   Every sender also used to wrap `send_mail` in `try/except → return False`,
   and `tasks.py` discarded the return value — so `max_retries=3` never fired
   and `POST /api/auth/register/` still answered `201` after a silent SMTP
   failure. They now let the exception out, which is what lets the Celery task
   retry and the register endpoint report `verification_email_sent: false`.
   *Callers outside this app* (`orders/views.py`, `shipping/tasks.py` dispatch
   the order and shipment tasks) must therefore not assume dispatch is
   infallible — see `cross_package_requests` in the WP-04 report.

2. **No link contains `/#/` any more.** The app was a `HashRouter`; `App.jsx` is
   now a `BrowserRouter`, so `https://site/#/verify-email/<token>` would deliver
   the token to the *fragment*, which is never sent to the server and which the
   router no longer reads. WP-07 ships a `LegacyHashRedirect` shim that rewrites
   `/#/x` → `/x` for links already sitting in people's inboxes; that shim is a
   migration aid for mail already sent, not a licence to keep minting hash URLs.
   The five builders (verify-email, products, reset-password, and the two
   `orders/<id>` links) are all hash-free. `reset-password` is built in
   `serializers.py`, next to the token it carries.

3. **The order email prints the stored money, with no arithmetic.** It used to
   read `subtotal = order.total` — which is already the *net* total — then
   subtract `order.discount` percent off it a second time and present the result
   as the TOTAL. The customer was shown less than their card was charged
   (C-20's email sibling). It now prints `subtotal` / `discount_amount` /
   `shipping_amount` / `total` exactly as stored, and labels the discount by
   `discount_type` instead of hardcoding `%`.
"""
from django.conf import settings
from django.core.mail import send_mail
import logging

from .models import (  # re-exported for callers that imported them from here
    generate_verification_token,  # noqa: F401
    verification_token_ttl_hours,
)

logger = logging.getLogger(__name__)

#: §4-approved brand strings. Used only when the `content` app's SiteSetting
#: singleton is unavailable (fresh database, or the content migration has not
#: run yet). The previous header said "LUXURY SKINCARE FOR FAMILY" — an
#: unevidenced luxury/primacy claim of the kind IMPL_SPEC §4 LF-05 withdraws.
BRAND_NAME_FALLBACK = 'Le foyeR.'
BRAND_TAGLINE_FALLBACK = 'Skincare for the whole family.'


def site_url(path=''):
    """Absolute front-end URL for `path`, with no `#` fragment.

    `path` is given without a leading slash, e.g. `site_url('products')`.
    """
    base = settings.SITE_URL.rstrip('/')
    if not path:
        return base
    return f"{base}/{path.lstrip('/')}"


def _brand():
    """`(brand_name, tagline)` from `content.SiteSetting`, else the §4 defaults.

    Read-only on purpose — `SiteSetting.load()` would `get_or_create` a row, and
    sending an email must not write to the settings table. Any failure (the
    content app not migrated, the table missing mid-deploy) falls back to the
    approved literals rather than breaking a transactional email.
    """
    try:
        from content.models import SiteSetting

        row = SiteSetting.objects.only('brand_name', 'tagline').first()
        if row is not None:
            return (
                (row.brand_name or BRAND_NAME_FALLBACK).strip(),
                (row.tagline or BRAND_TAGLINE_FALLBACK).strip(),
            )
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug('SiteSetting unavailable for email branding: %s', exc)
    return BRAND_NAME_FALLBACK, BRAND_TAGLINE_FALLBACK


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
    brand_name, tagline = _brand()
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
                <h1>{brand_name}</h1>
                <div class="tagline">{tagline}</div>
            </div>
            {content}
            <div class="footer">
                <p>&copy; {brand_name} Global | <a href="{site_url()}">lefoyerglobal.com</a></p>
                <p>This is an automated email. Please do not reply directly.</p>
            </div>
        </div>
    </body>
    </html>
    """


def _send(subject, plain_message, html_message, recipient, context=''):
    """Send one email. Logs, then **re-raises** on failure.

    The re-raise is the whole point: `tasks.py` turns it into
    `self.retry(...)`, and `serializers.py` turns it into
    `verification_email_sent: false` in the registration response. Swallowing it
    here is what made a silent SMTP outage look like a successful signup.
    """
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as exc:
        logger.error('Failed to send %s to %s: %s', context or subject, recipient, exc)
        raise
    logger.info('Sent %s to %s', context or subject, recipient)
    return True


def send_verification_email(user, token):
    """Mail the verification link for an already-persisted `token`.

    A **pure sender**: it does not generate a token, does not write to the user
    and does not stamp `email_verification_sent_at`. `token` must be the value
    already stored on the row by `User.issue_verification_token()`, otherwise
    the link in the inbox will not resolve.
    """
    if not token:
        raise ValueError(
            'send_verification_email requires the token already persisted on the '
            'user; it no longer generates one (IMPL_SPEC C-25).'
        )

    verification_link = site_url(f'verify-email/{token}')
    ttl_hours = verification_token_ttl_hours()
    expiry_sentence = (
        f'This link expires {ttl_hours} hours after it was sent. '
        'If it has expired, you can request a new one from the sign-in page.'
    )

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
        <p style="font-size: 13px; color: #999;">{expiry_sentence}</p>
    </div>
    """

    html_message = _wrap_email(content, "Verify Your Email - Le foyeR.")
    plain_message = (
        f"Hello, verify your email by visiting: {verification_link}\n\n{expiry_sentence}"
    )

    return _send(
        'Verify Your Email - Le foyeR.',
        plain_message,
        html_message,
        user.email,
        context='verification email',
    )


def send_welcome_email(user):
    """Send welcome email after successful verification."""
    shop_link = site_url('products')
    content = f"""
    <div class="content">
        <h2>Welcome to Le foyeR.</h2>
        <p>Hello{' ' + user.first_name if user.first_name else ''},</p>
        <p>Your email has been verified and your account is now active.</p>
        <p>Explore the range — cleansers, moisturisers, sun protection and haircare, for the whole family.</p>
        <p style="text-align: center;">
            <a href="{shop_link}" class="btn">START SHOPPING</a>
        </p>
    </div>
    """

    html_message = _wrap_email(content, "Welcome to Le foyeR.")
    plain_message = (
        f"Welcome to Le foyeR.! Your email is verified. Start shopping at {shop_link}"
    )

    return _send(
        'Welcome to Le foyeR.',
        plain_message,
        html_message,
        user.email,
        context='welcome email',
    )


def send_password_reset_email(user, reset_link):
    """Send password reset email.

    `reset_link` is built by `PasswordResetSerializer` (hash-free, §2b #32).
    """
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

    return _send(
        'Reset Your Password - Le foyeR.',
        plain_message,
        html_message,
        user.email,
        context='password reset email',
    )


def _money(value):
    """Format a stored Decimal for the email. No arithmetic, ever."""
    return f"{value:,.2f}"


def _order_money_rows(order):
    """The subtotal / discount / shipping rows, read straight off the order.

    Every number here is a stored column. Nothing is derived, because the bug
    being fixed *was* the derivation: `total` is already net of discount, so
    subtracting the percentage again under-reported the amount charged.

    `subtotal`, `discount_amount`, `discount_type` and `shipping_amount` arrive
    with `orders` migration 0005 (WP-05, landing in the same change-set). The
    `hasattr` guards keep this file importable and correct against the current
    schema too, where only `total` exists — in that case the email prints the
    single TOTAL row it can honestly print, instead of inventing a breakdown.
    """
    rows = ''

    if hasattr(order, 'subtotal') and order.subtotal is not None:
        rows += f"""
                <tr>
                    <td colspan="3" style="text-align: right;"><strong>Subtotal</strong></td>
                    <td style="text-align: right;"><strong>&#8377;{_money(order.subtotal)}</strong></td>
                </tr>
        """

    discount_amount = getattr(order, 'discount_amount', None)
    if discount_amount:
        discount_type = getattr(order, 'discount_type', '') or ''
        coupon_code = (getattr(order, 'coupon_code', '') or '').strip()
        # Label by the stored discount_type. Hardcoding "%" was wrong the moment
        # coupons gained a FIXED type (coupons 0003).
        if discount_type == 'PERCENT' and getattr(order, 'discount', 0):
            qualifier = f' ({order.discount}% off)'
        elif discount_type == 'FIXED':
            qualifier = ' (flat)'
        else:
            qualifier = ''
        label = f"Discount{qualifier}"
        if coupon_code:
            label += f" &middot; {coupon_code}"
        rows += f"""
                <tr>
                    <td colspan="3" style="text-align: right; color: #28a745;">{label}</td>
                    <td style="text-align: right; color: #28a745;">-&#8377;{_money(discount_amount)}</td>
                </tr>
        """

    if hasattr(order, 'shipping_amount') and order.shipping_amount is not None:
        shipping_display = (
            'Free' if not order.shipping_amount
            else f'&#8377;{_money(order.shipping_amount)}'
        )
        rows += f"""
                <tr>
                    <td colspan="3" style="text-align: right;">Shipping</td>
                    <td style="text-align: right;">{shipping_display}</td>
                </tr>
        """

    return rows


def send_order_confirmation_email(order):
    """Send order confirmation email with order details."""
    items_html = ""
    for item in order.items.all():
        # `product_name` is the OrderItem snapshot added by orders 0005; it
        # survives a catalogue edit or deletion, where `item.product.name` does
        # not. Fall back to the live relation while the snapshot is unavailable.
        item_name = (getattr(item, 'product_name', '') or '').strip() or item.product.name
        items_html += f"""
        <tr>
            <td>{item_name}</td>
            <td style="text-align: center;">{item.quantity}</td>
            <td style="text-align: right;">&#8377;{_money(item.price)}</td>
            <td style="text-align: right;">&#8377;{_money(item.price * item.quantity)}</td>
        </tr>
        """

    order_ref = (getattr(order, 'order_number', '') or '').strip() or f'#{order.id}'
    payment_method_display = (
        "Cash on Delivery" if order.payment_method == "COD" else "Prepaid (Online)"
    )
    order_link = site_url(f'orders/{order.id}')

    content = f"""
    <div class="content">
        <h2>Order Confirmed</h2>
        <p>Hello {order.first_name},</p>
        <p>Thank you for your order! We're getting it ready for you.</p>

        <div class="highlight-box">
            <p><strong>Order:</strong> {order_ref}</p>
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
                {_order_money_rows(order)}
                <tr class="total-row">
                    <td colspan="3" style="text-align: right;">TOTAL</td>
                    <td style="text-align: right;">&#8377;{_money(order.total)}</td>
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
            <a href="{order_link}" class="btn">VIEW ORDER</a>
        </p>
    </div>
    """

    html_message = _wrap_email(content, f"Order {order_ref} Confirmed - Le foyeR.")
    plain_message = (
        f"Your order {order_ref} has been confirmed. "
        f"Total: ₹{_money(order.total)}. View it at {order_link}"
    )

    return _send(
        f'Order {order_ref} Confirmed - Le foyeR.',
        plain_message,
        html_message,
        order.email,
        context=f'order confirmation email for order {order_ref}',
    )


def send_shipment_update_email(order, new_status):
    """Send shipment status update email to customer."""
    status_messages = {
        'booked': 'Your order has been booked for shipping.',
        'pickup_scheduled': 'Pickup has been scheduled for your order.',
        'picked_up': 'Your order has been picked up and is on its way.',
        'in_transit': 'Your order is in transit.',
        'out_for_delivery': 'Your order is out for delivery today.',
        'delivered': 'Your order has been delivered.',
    }
    message = status_messages.get(new_status, f'Order status updated to: {new_status}')

    order_ref = (getattr(order, 'order_number', '') or '').strip() or f'#{order.id}'
    order_link = site_url(f'orders/{order.id}')
    status_label = new_status.replace('_', ' ').title()

    content = f"""
    <div class="content">
        <h2>Shipment Update</h2>
        <p>Hello {order.first_name},</p>
        <p>{message}</p>

        <div class="highlight-box">
            <p><strong>Order:</strong> {order_ref}</p>
            <p><strong>Status:</strong> {status_label}</p>
        </div>

        <p style="text-align: center; margin-top: 25px;">
            <a href="{order_link}" class="btn">TRACK ORDER</a>
        </p>
    </div>
    """

    html_message = _wrap_email(content, f"Shipment Update - Order {order_ref}")
    plain_message = f"Your order {order_ref} status: {message} Track it at {order_link}"

    return _send(
        f'Shipment Update: Order {order_ref} - {status_label}',
        plain_message,
        html_message,
        order.email,
        context=f'shipment update email for order {order_ref}',
    )
