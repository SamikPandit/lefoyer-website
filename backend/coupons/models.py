"""Coupon definitions.

The money model here is deliberately richer than the original single
`discount` integer percentage, because a fixed-rupee-off voucher is not
expressible as a percentage of an arbitrary subtotal and the storefront needs
both. `discount` is retained as a deprecated, read-only column so no historic
`Order.discount` percentage becomes unexplainable; every new code path reads
`discount_type` + `discount_value`.

Nothing in this module decides whether a coupon may be applied to a particular
basket. That lives in exactly one place, ``coupons/services.py::evaluate_coupon``,
which both ``POST /api/coupons/validate/`` and ``orders.services.create_order``
call, so the number the customer is shown is the number they are charged.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

TWO_PLACES = Decimal('0.01')


def quantize_money(value):
    """Round a money amount to 2dp, half-up, which is how a till rounds."""
    return Decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


class Coupon(models.Model):
    PERCENT = 'PERCENT'
    FIXED = 'FIXED'
    DISCOUNT_TYPE_CHOICES = [
        (PERCENT, 'Percentage off'),
        (FIXED, 'Fixed amount off'),
    ]

    code = models.CharField(max_length=50, unique=True)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()

    # DEPRECATED. Kept only so historic rows and historic Order.discount
    # percentages remain readable. Excluded from every serializer; never read by
    # new code. `discount_value` is the live column.
    discount = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        default=0,
        help_text="DEPRECATED - legacy percentage column. Edit 'discount value' instead.",
    )

    discount_type = models.CharField(
        max_length=10,
        choices=DISCOUNT_TYPE_CHOICES,
        default=PERCENT,
        help_text="PERCENT applies 'discount value' as a percentage of the "
                  "order subtotal. FIXED takes 'discount value' rupees off.",
    )
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Percent (0-100) when type is PERCENT, rupees when FIXED.",
    )
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional rupee cap for a PERCENT coupon. Blank = uncapped. "
                  "Ignored for FIXED coupons.",
    )

    # Previously this field had NO default at all, so `Coupon()` raised in a
    # shell and every fixture/factory had to name it. Defaulting to False is the
    # safe direction: a half-configured coupon is inert until someone ticks it.
    active = models.BooleanField(default=False)

    max_uses = models.PositiveIntegerField(default=0, help_text="0 = unlimited")
    used_count = models.PositiveIntegerField(default=0)
    min_order_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Minimum order subtotal (before discount) to apply coupon",
    )

    class Meta:
        ordering = ['-valid_to', 'code']

    def __str__(self):
        return self.code

    def is_valid(self):
        """Window / active / exhaustion check, independent of any basket.

        Retained with its original name and semantics because
        ``orders/views.py`` relied on it covering `active`, the date window and
        `max_uses` together. `evaluate_coupon` needs the individual reasons, so
        it re-derives them rather than calling this; this stays for admin and
        shell use.
        """
        from django.utils import timezone

        now = timezone.now()
        if not self.active:
            return False
        if now < self.valid_from or now > self.valid_to:
            return False
        if self.max_uses > 0 and self.used_count >= self.max_uses:
            return False
        return True

    def compute_discount(self, subtotal):
        """Rupees off `subtotal`. Never negative, never more than the subtotal.

        PERCENT -> min(subtotal * value / 100, max_discount_amount or infinity)
        FIXED   -> min(value, subtotal)
        """
        subtotal = Decimal(subtotal or 0)
        if subtotal <= 0:
            return quantize_money(0)

        value = Decimal(self.discount_value or 0)
        if value <= 0:
            return quantize_money(0)

        if self.discount_type == self.FIXED:
            amount = min(value, subtotal)
        else:
            amount = subtotal * value / Decimal('100')
            if self.max_discount_amount is not None:
                amount = min(amount, Decimal(self.max_discount_amount))

        amount = quantize_money(amount)
        if amount < 0:
            return quantize_money(0)
        return min(amount, quantize_money(subtotal))
