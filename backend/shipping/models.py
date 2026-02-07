from django.db import models
from django.conf import settings
from orders.models import Order


class Shipment(models.Model):
    """
    Represents a shipment linked to an order. Stores Blue Dart AWB details,
    tracking status, and shipping label.
    """
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name='shipment'
    )
    awb_number = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Blue Dart Air Waybill tracking number"
    )
    pickup_token = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="Pickup registration token from Blue Dart"
    )

    # Blue Dart product configuration
    product_code = models.CharField(
        max_length=1,
        default='D',
        help_text="D=Domestic Priority, A=Apex, E=Surfaceline"
    )
    sub_product_code = models.CharField(
        max_length=1,
        default='P',
        help_text="P=Prepaid, C=COD"
    )
    origin_area = models.CharField(
        max_length=3,
        help_text="3-character origin area code (e.g., BOM, BLR)"
    )
    destination_area = models.CharField(
        max_length=3,
        null=True,
        blank=True,
        help_text="3-character destination area code from Blue Dart"
    )
    destination_pincode = models.CharField(max_length=6)

    # Shipment physical details
    weight_kg = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Actual or volumetric weight in kg"
    )
    declared_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Invoice value for insurance"
    )
    collectible_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="COD amount (0 for prepaid orders)"
    )

    # Status tracking
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('booked', 'Booked'),  # AWB generated
        ('pickup_scheduled', 'Pickup Scheduled'),
        ('picked_up', 'Picked Up'),
        ('in_transit', 'In Transit'),
        ('out_for_delivery', 'Out for Delivery'),
        ('delivered', 'Delivered'),
        ('undelivered', 'Undelivered'),
        ('rto_initiated', 'RTO Initiated'),
        ('rto_delivered', 'Returned to Origin'),
        ('cancelled', 'Cancelled'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )

    # Label storage
    label_pdf = models.FileField(
        upload_to='shipping/labels/%Y/%m/',
        null=True,
        blank=True
    )

    # Delivery estimates and actuals
    expected_delivery_date = models.DateField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    shipped_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When shipment was picked up by Blue Dart"
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Actual delivery timestamp"
    )

    # Error tracking
    last_error = models.TextField(
        null=True,
        blank=True,
        help_text="Last API error message for troubleshooting"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['awb_number']),
        ]

    def __str__(self):
        if self.awb_number:
            return f"Shipment {self.awb_number} - Order #{self.order.id}"
        return f"Pending Shipment - Order #{self.order.id}"

    def is_active(self):
        """Returns True if shipment is still in transit and needs tracking"""
        return self.status not in ['delivered', 'cancelled', 'rto_delivered']

    def get_status_display_color(self):
        """Returns color code for status badge in frontend"""
        color_map = {
            'pending': 'gray',
            'booked': 'blue',
            'pickup_scheduled': 'blue',
            'picked_up': 'cyan',
            'in_transit': 'blue',
            'out_for_delivery': 'orange',
            'delivered': 'green',
            'undelivered': 'red',
            'rto_initiated': 'orange',
            'rto_delivered': 'orange',
            'cancelled': 'gray',
        }
        return color_map.get(self.status, 'gray')


class TrackingEvent(models.Model):
    """
    Stores individual scan/checkpoint events from Blue Dart tracking API
    """
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name='events'
    )
    scan_date = models.DateTimeField(
        help_text="Date and time of this tracking event"
    )
    scan_code = models.CharField(
        max_length=10,
        help_text="Blue Dart internal scan code"
    )
    scan_description = models.TextField(
        help_text="Human-readable event description"
    )
    scanned_location = models.CharField(
        max_length=100,
        help_text="Hub/facility name where scan occurred"
    )
    instructions = models.TextField(
        null=True,
        blank=True,
        help_text="Additional instructions or notes from Blue Dart"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-scan_date']
        unique_together = [
            'shipment',
            'scan_date',
            'scan_code',
            'scanned_location'
        ]
        indexes = [
            models.Index(fields=['shipment', '-scan_date']),
        ]

    def __str__(self):
        return f"{self.scan_description} at {self.scanned_location}"
