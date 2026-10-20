import secrets

from django.db import models
from django.utils import timezone


def generate_unsubscribe_token():
    """48 bytes of urlsafe base64 is 64 characters; the column holds 64 with
    headroom to spare because it is declared at 64 and we never append to it."""
    return secrets.token_urlsafe(32)


class Subscriber(models.Model):
    """One newsletter opt-in.

    Consent is recorded as a timestamp plus the originating IP, because "they
    ticked a box" is not evidence unless you can say when and from where.
    """

    SOURCE_CHOICES = [
        ('home', 'Homepage form'),
        ('footer', 'Footer form'),
        ('checkout', 'Checkout'),
        ('popup', 'Popup / overlay'),
        ('import', 'Manual import'),
        ('other', 'Other'),
    ]

    email = models.EmailField(unique=True)
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES, default='other')
    consent_at = models.DateTimeField(
        help_text="When the subscriber ticked the consent box."
    )
    ip = models.GenericIPAddressField(
        null=True, blank=True, help_text="IP the consent was given from."
    )
    utm = models.JSONField(
        default=dict, blank=True, help_text="Campaign attribution, as submitted."
    )
    is_confirmed = models.BooleanField(
        default=False,
        help_text="Set once a double opt-in confirmation link has been followed. "
                  "No confirmation mail is sent yet, so this stays False.",
    )
    unsubscribe_token = models.CharField(
        max_length=64, unique=True, default=generate_unsubscribe_token, editable=False
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Subscriber'
        verbose_name_plural = 'Subscribers'

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.consent_at:
            self.consent_at = timezone.now()
        if not self.unsubscribe_token:
            self.unsubscribe_token = generate_unsubscribe_token()
        super().save(*args, **kwargs)
