"""Order, order line, payment attempt and callback-dedupe records.

The schema here is shaped by one requirement: every side effect of a payment -
stock movement, cart clearing, coupon redemption, the confirmation email and the
Meta Pixel `Purchase` event - must happen *exactly* once, no matter how many
times the gateway calls us back or how many times the customer refreshes.

That is not achievable with `payment_status` alone, because "the status is
COMPLETED" does not tell you whether the stock decrement that was supposed to
accompany it actually ran. So each side effect carries its own one-way latch:

* ``stock_decremented`` / ``stock_restored`` - inventory moved, once each way.
* ``cart_cleared_at`` - the basket was emptied.
* ``confirmation_email_sent_at`` - the "order confirmed" mail went out.
* ``purchase_tracked_at`` - the browser fired its one `Purchase` event.

``orders/services.py`` is the only module permitted to set any of them.
"""

import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from coupons.models import Coupon
from products.models import Product


class Order(models.Model):
    # ---------------------------------------------------------------- states
    PENDING = 'PENDING'
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'
    CANCELLED = 'CANCELLED'
    EXPIRED = 'EXPIRED'
    REFUNDED = 'REFUNDED'

    PAYMENT_STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (COMPLETED, 'Completed'),
        (FAILED, 'Failed'),
        (CANCELLED, 'Cancelled'),
        (EXPIRED, 'Expired'),
        (REFUNDED, 'Refunded'),
    ]

    #: States no automatic transition may leave. A late FAILED callback for an
    #: order that was already confirmed must not undo the confirmation, and a
    #: late COMPLETED callback for an order the customer cancelled must not
    #: quietly resurrect it - that one lands in ops' lap via
    #: `needs_manual_review` instead.
    TERMINAL_STATUSES = (COMPLETED, CANCELLED, EXPIRED, REFUNDED)

    #: FAILED is deliberately *not* terminal: "payment failed" means "awaiting
    #: payment", and the customer may retry on the same order.
    RETRYABLE_STATUSES = (PENDING, FAILED)

    PREPAID = 'PREPAID'
    COD = 'COD'
    PAYMENT_METHOD_CHOICES = [
        (PREPAID, 'Prepaid'),
        (COD, 'Cash on Delivery'),
    ]

    PERCENT = 'PERCENT'
    FIXED = 'FIXED'
    DISCOUNT_TYPE_CHOICES = [
        (PERCENT, 'Percentage'),
        (FIXED, 'Fixed amount'),
    ]

    # ------------------------------------------------------------- identity
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    order_number = models.CharField(
        max_length=24,
        unique=True,
        help_text="Customer-facing reference, e.g. LF000123. Assigned on save.",
    )

    # --------------------------------------------------------- shipping snapshot
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=15)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=255)
    state = models.CharField(max_length=255)
    pincode = models.CharField(max_length=10)

    # ------------------------------------------------------------------ money
    # Four stored numbers, so the order page, the confirmation email and the
    # refund desk all print the same arithmetic instead of each re-deriving it.
    # Previously only `total` (already net) and `discount` (a percentage) were
    # stored, which meant the gross was unrecoverable and the email re-applied
    # the percentage to the net figure and under-reported what was charged.
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_type = models.CharField(
        max_length=10, choices=DISCOUNT_TYPE_CHOICES, default=PERCENT
    )
    shipping_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    coupon = models.ForeignKey(
        Coupon, related_name='orders', null=True, blank=True, on_delete=models.SET_NULL
    )
    coupon_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Snapshot of the code used. Survives coupon deletion and the "
                  "release of the redemption on a failed order.",
    )
    # DEPRECATED: the legacy percentage column. Retained read-only so historic
    # orders stay explicable; `discount_amount` is what is charged.
    discount = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="DEPRECATED legacy percentage. Read discount_amount instead.",
    )

    # ------------------------------------------------------------- timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ----------------------------------------------------------------- payment
    paid = models.BooleanField(default=False)
    payment_id = models.CharField(max_length=100, blank=True, null=True)
    provider_order_id = models.CharField(
        max_length=100, blank=True, null=True, db_index=True
    )
    payment_status = models.CharField(
        max_length=20, default=PENDING, choices=PAYMENT_STATUS_CHOICES, db_index=True
    )
    payment_method = models.CharField(
        max_length=20, default=PREPAID, choices=PAYMENT_METHOD_CHOICES
    )
    payment_failure_reason = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Why the last attempt failed or was cancelled. Shown to the "
                  "customer as context, never as a raw gateway error.",
    )

    # ------------------------------------------------------- side-effect latches
    stock_decremented = models.BooleanField(
        default=False,
        help_text="Inventory has been taken for this order. Set once, inside "
                  "confirm_order.",
    )
    stock_restored = models.BooleanField(
        default=False,
        help_text="Inventory has been given back. Set once, inside "
                  "fail_order/cancel_order, and only if it was ever taken.",
    )
    cart_cleared_at = models.DateTimeField(null=True, blank=True)
    confirmation_email_sent_at = models.DateTimeField(null=True, blank=True)
    purchase_tracked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the browser fired its single Meta Pixel Purchase event. "
                  "This column, not localStorage, is what makes it exactly-once.",
    )
    needs_manual_review = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Something happened that money has already changed hands over "
                  "and software must not paper over. Check the order notes.",
    )
    review_note = models.TextField(blank=True, default='')

    idempotency_key = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        db_index=True,
        help_text="Client-supplied Idempotency-Key from POST /api/orders/, so a "
                  "double-click cannot mint two orders.",
    )

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=['payment_status', 'created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
        constraints = [
            # The Idempotency-Key check in services.create_order is a read-then-write, so two
            # concurrent submissions of the same key could both find nothing and both create an
            # order. Only the database can settle that. NULLs do not collide on SQLite or
            # PostgreSQL, so orders created without a key are unaffected.
            models.UniqueConstraint(
                fields=['user', 'idempotency_key'],
                condition=Q(idempotency_key__isnull=False),
                name='orders_order_user_idempotency_uniq',
            ),
        ]

    def __str__(self):
        return self.order_number or f'Order {self.pk}'

    def save(self, *args, **kwargs):
        """Assign `order_number` on first insert.

        It is derived from the primary key (``LF000123``), which does not exist
        until after the INSERT. Rather than insert a NULL or a shared empty
        string - which two concurrent checkouts would collide on, since the
        column is unique - the row goes in carrying a disposable unique token
        and is immediately rewritten. Both statements are in the caller's
        transaction, so no reader ever sees the token.
        """
        if not self.order_number:
            self.order_number = f'TMP-{uuid.uuid4().hex[:18]}'
            super().save(*args, **kwargs)
            self.order_number = f'LF{self.pk:06d}'
            type(self).objects.filter(pk=self.pk).update(order_number=self.order_number)
            return None
        return super().save(*args, **kwargs)

    # ------------------------------------------------------------- predicates
    @property
    def is_terminal(self):
        return self.payment_status in self.TERMINAL_STATUSES

    @property
    def can_retry_payment(self):
        """A retry is offered only when it would actually achieve something."""
        if self.payment_status not in self.RETRYABLE_STATUSES:
            return False
        if self.paid:
            return False
        return not self.has_shipment

    @property
    def has_shipment(self):
        try:
            return self.shipment is not None
        except Exception:
            # Shipment is a reverse OneToOne; its absence raises
            # Shipment.DoesNotExist, but the shipping app may not be installed
            # in every deployment of this code.
            return False

    @property
    def purchase_event_pending(self):
        """§2g: the server, not the client, decides whether Purchase may fire."""
        return self.payment_status == self.COMPLETED and self.purchase_tracked_at is None

    @property
    def status(self):
        """The derived, customer-facing status (C-19).

        There is no `status` column and there should not be one: a second
        mutable status field is a second thing to keep in sync. `OrderDetail.jsx`
        and `OrderTimeline.jsx` both read `order.status`, and both silently fell
        back to the literal string 'Pending' for every order ever placed.

        Fulfilment detail wins when it exists, because "Delivered" is more
        informative than "Paid"; otherwise the payment state speaks.
        """
        if self.payment_status in (self.CANCELLED, self.EXPIRED, self.REFUNDED):
            return self.get_payment_status_display()

        shipment_status = None
        try:
            shipment_status = self.shipment.status
        except Exception:
            shipment_status = None

        if shipment_status in ('delivered',):
            return 'Delivered'
        if shipment_status in ('out_for_delivery',):
            return 'Out for delivery'
        if shipment_status in ('in_transit', 'picked_up'):
            return 'Shipped'
        if shipment_status in ('rto_initiated', 'rto_delivered'):
            return 'Returned'
        if shipment_status in ('booked', 'pickup_scheduled'):
            return 'Processing'
        if shipment_status == 'undelivered':
            return 'Delivery attempted'

        if self.payment_status == self.COMPLETED:
            return 'Confirmed'
        if self.payment_status == self.FAILED:
            return 'Payment failed'
        return 'Awaiting payment'


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    # PROTECT, not CASCADE. A CASCADE here means deleting a product - which
    # `seed_products.py --force` does with `Product.objects.all().delete()` -
    # silently erases the order lines that reference it, taking order history and
    # every verified-buyer proof with them. PROTECT turns that into a loud error.
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    # Snapshots, so a renamed or re-SKU'd product does not rewrite history, and
    # so an order line is still printable if the product row is ever archived.
    product_name = models.CharField(max_length=255, blank=True, default='')
    product_sku = models.CharField(max_length=100, blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ('id',)

    def __str__(self):
        return f'{self.quantity} x {self.product_name or self.product_id}'

    @property
    def line_total(self):
        return self.price * self.quantity


class PaymentAttempt(models.Model):
    """One trip to the gateway.

    Retries create a new row instead of overwriting `Order.provider_order_id`,
    which is what makes a late callback for an abandoned first attempt still
    resolvable to the order it belonged to.
    """

    CREATED = 'CREATED'
    PENDING = 'PENDING'
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'
    CANCELLED = 'CANCELLED'
    STATE_CHOICES = [
        (CREATED, 'Created'),
        (PENDING, 'Pending'),
        (COMPLETED, 'Completed'),
        (FAILED, 'Failed'),
        (CANCELLED, 'Cancelled'),
    ]

    order = models.ForeignKey(Order, related_name='attempts', on_delete=models.CASCADE)
    merchant_order_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Deterministic: LF-<order id>-<attempt number>.",
    )
    provider_payment_id = models.CharField(max_length=128, blank=True, default='')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default=CREATED)
    raw_response = models.JSONField(default=dict, blank=True)
    redirect_url = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.merchant_order_id} ({self.state})'


class ProcessedCallback(models.Model):
    """Gateway callbacks we have already acted on.

    PhonePe retries server-to-server callbacks. Without this table a replayed
    `PAYMENT_ERROR` ran ``restore_stock_for_order`` a second time and inflated
    inventory; a replayed success sent a second confirmation email. The unique
    `event_key` makes a replay a no-op that still answers 200, which is what
    stops the gateway retrying forever.
    """

    event_key = models.CharField(max_length=128, unique=True, db_index=True)
    order = models.ForeignKey(
        Order, related_name='callbacks', null=True, blank=True, on_delete=models.SET_NULL
    )
    payload = models.JSONField(default=dict, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-received_at',)

    def __str__(self):
        return self.event_key
