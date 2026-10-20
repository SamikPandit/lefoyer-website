"""Editable site content: the single source of truth for brand copy, claims,
the delivery/returns policy, timed homepage sections and support requests.

Everything here exists so that a copy change, a retired campaign banner or a
newly-evidenced claim is an admin edit rather than a deploy.
"""

import secrets

from django.db import models


class SingletonModel(models.Model):
    """A table that holds at most one row, always at pk=1.

    `load()` returns that row, creating it from field defaults if the data
    migration has not run (a fresh test database, for instance), so no caller
    ever has to handle DoesNotExist.
    """

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # pragma: no cover - defensive
        raise RuntimeError(
            f"{type(self).__name__} is a singleton and must not be deleted."
        )

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class SiteSetting(SingletonModel):
    """Brand identity and the customer-facing support contact set.

    TODO(business): confirm the support contact set — is there a published
    support phone number, a WhatsApp number, and staffed hours we may print?
    None exists anywhere customer-facing in the repo today, so the safe default
    ships the email address only (the value already configured as
    EMAIL_HOST_USER) and leaves phone / WhatsApp / hours blank. A blank field is
    simply not rendered; an invented number is a support failure.

    TODO(business): confirm the legal entity. TermsAndConditions.jsx names
    "Le Foyer Global, incorporated under the Companies Act, 1956" (an Act
    replaced in 2013) in one place and "SITE COBALLO PRIVATE LIMITED" with a
    gmail.com support address in another. Which is the contracting entity, and
    what is its CIN and registered address?
    """

    brand_name = models.CharField(max_length=120, default='Le foyeR.')
    tagline = models.CharField(max_length=255, blank=True, default='')
    positioning_statement = models.TextField(
        blank=True,
        default='',
        help_text="One or two sentences. Must not contain an unevidenced claim "
                  "— every claim belongs in the Claims table with its evidence.",
    )

    support_email = models.EmailField(blank=True, default='support@lefoyerglobal.com')
    support_phone = models.CharField(
        max_length=32,
        blank=True,
        default='',
        help_text="Leave blank unless a real, staffed number is published. "
                  "Blank is not rendered.",
    )
    whatsapp = models.CharField(
        max_length=32,
        blank=True,
        default='',
        help_text="Leave blank unless a real WhatsApp number is published.",
    )
    hours = models.CharField(
        max_length=160,
        blank=True,
        default='',
        help_text="e.g. 'Mon-Sat, 10am-6pm IST'. Leave blank unless staffed.",
    )

    instagram_url = models.URLField(max_length=300, blank=True, default='')

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Site setting'
        verbose_name_plural = 'Site settings'

    def __str__(self):
        return f'Site settings ({self.brand_name})'


class PolicySetting(SingletonModel):
    """The one place the delivery and returns policy is stated.

    Before this existed the repo asserted five mutually contradictory versions
    (3-7 vs 3-5 days, 7 vs 30 day returns, free over Rs.5000 vs unconditionally
    free vs a flat Rs.50, and a backend that charged nothing). Every surface now
    reads these numbers.

    TODO(business): confirm or correct, as a single set, the return window and
    its start point, the free-shipping threshold and standard shipping charge,
    the delivery window, the refund timeline, and the non-returnable
    categories. The values below are the NARROWEST of the conflicting promises
    already published plus the ones that match what the backend actually
    charges, chosen because under-promising is recoverable and over-promising is
    a chargeback. Do not pick one of the five existing variants by guesswork.
    """

    RETURN_WINDOW_FROM_CHOICES = [
        ('delivery', 'From delivery'),
        ('purchase', 'From purchase'),
    ]

    delivery_window_min_days = models.PositiveSmallIntegerField(default=3)
    delivery_window_max_days = models.PositiveSmallIntegerField(default=7)

    free_shipping_threshold = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        default=None,
        help_text="Order subtotal above which shipping is free. NULL means "
                  "shipping is free on every order (the current default).",
    )
    shipping_charge = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Standard shipping charge below the threshold. 0 matches what "
                  "order creation actually charges today.",
    )

    return_window_days = models.PositiveSmallIntegerField(default=7)
    return_window_from = models.CharField(
        max_length=10, choices=RETURN_WINDOW_FROM_CHOICES, default='delivery'
    )
    refund_days = models.PositiveSmallIntegerField(
        default=10, help_text="Working days to credit a refund once approved."
    )
    return_exclusions = models.JSONField(
        default=list,
        blank=True,
        help_text="List of plain-language strings naming what cannot be returned.",
    )

    cod_available = models.BooleanField(
        default=True,
        help_text="Whether cash on delivery is offered at all. Actual "
                  "availability for a given address still comes from "
                  "/api/shipping/check-serviceability/ per pincode.",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Delivery & returns policy'
        verbose_name_plural = 'Delivery & returns policy'

    def __str__(self):
        return 'Delivery & returns policy'

    @property
    def delivery_window_days(self):
        return [self.delivery_window_min_days, self.delivery_window_max_days]


class Claim(models.Model):
    """The claims register.

    Every marketing claim the site makes must have a row here. `is_substantiated`
    is False until a named certificate, lab report or test number is attached in
    `footnote` / `evidence_url`. The public endpoint serves substantiated claims
    only by default, so an unevidenced row cannot reach a customer by accident —
    but it stays visible to ops in the admin, which is the whole point of the
    register.
    """

    label = models.CharField(max_length=160, unique=True)
    footnote = models.CharField(
        max_length=300,
        blank=True,
        default='',
        help_text="One line naming the evidence. Rendered beside the claim.",
    )
    evidence_url = models.URLField(max_length=500, blank=True, default='')
    is_substantiated = models.BooleanField(
        default=False,
        help_text="Tick ONLY when a named certificate, lab report or test "
                  "number exists and is referenced above.",
    )
    display_order = models.PositiveIntegerField(default=0, db_index=True)
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Internal. Why this claim is or is not currently evidenced.",
    )

    class Meta:
        ordering = ['display_order', 'label']

    def __str__(self):
        mark = 'evidenced' if self.is_substantiated else 'UNEVIDENCED'
        return f'{self.label} ({mark})'


class HomeSection(models.Model):
    """A timed homepage module.

    `starts_at` / `ends_at` are what retires a seasonal banner without a deploy:
    the public endpoint filters on `is_active AND starts_at <= now <= ends_at`,
    treating a null bound as open-ended. `is_active` defaults to False so a
    half-written section is never live.
    """

    KIND_CHOICES = [
        ('hero', 'Hero'),
        ('banner', 'Promotional banner'),
        ('product_rail', 'Product rail'),
        ('editorial', 'Editorial block'),
        ('category_grid', 'Category grid'),
        ('concern_grid', 'Concern grid'),
        ('testimonials', 'Testimonials'),
        ('newsletter', 'Newsletter signup'),
    ]

    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    display_order = models.PositiveIntegerField(default=0, db_index=True)

    title = models.CharField(max_length=200, blank=True, default='')
    subtitle = models.CharField(max_length=300, blank=True, default='')
    body = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='home_sections/', blank=True, null=True)

    cta_label = models.CharField(max_length=60, blank=True, default='')
    cta_target = models.CharField(
        max_length=300,
        blank=True,
        default='',
        help_text="An in-app path such as /products?category=skincare. "
                  "No leading '#'.",
    )

    starts_at = models.DateTimeField(
        null=True, blank=True, help_text="Blank = live immediately."
    )
    ends_at = models.DateTimeField(
        null=True, blank=True, help_text="Blank = no end date."
    )
    is_active = models.BooleanField(default=False)

    products = models.ManyToManyField(
        'products.Product', blank=True, related_name='home_sections'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'id']

    def __str__(self):
        return f'{self.get_kind_display()}: {self.title or "(untitled)"}'

    @property
    def is_in_window(self):
        from django.utils import timezone
        now = timezone.now()
        if self.starts_at and self.starts_at > now:
            return False
        if self.ends_at and self.ends_at < now:
            return False
        return True


def generate_ticket_ref():
    """A short, human-readable reference a customer can quote on the phone."""
    return f'LFS-{secrets.token_hex(4).upper()}'


class SupportRequest(models.Model):
    """A submission from /contact. Read-mostly in the admin."""

    TOPIC_CHOICES = [
        ('order', 'An order I placed'),
        ('delivery', 'Delivery or tracking'),
        ('returns', 'Returns or refunds'),
        ('product', 'Product question'),
        ('payment', 'Payment problem'),
        ('other', 'Something else'),
    ]

    name = models.CharField(max_length=120)
    email = models.EmailField()
    order = models.ForeignKey(
        'orders.Order',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='support_requests',
    )
    order_reference = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text="Exactly what the customer typed. Kept verbatim even when it "
                  "does not resolve to a row above, so support can still act "
                  "on a mistyped or marketplace reference.",
    )
    topic = models.CharField(max_length=20, choices=TOPIC_CHOICES, default='other')
    message = models.TextField()
    ticket_ref = models.CharField(
        max_length=24, unique=True, default=generate_ticket_ref, editable=False
    )
    created_at = models.DateTimeField(auto_now_add=True)
    handled_at = models.DateTimeField(null=True, blank=True)
    handled_note = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.ticket_ref} — {self.get_topic_display()}'
