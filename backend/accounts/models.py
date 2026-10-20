"""The custom user model.

IMPL_SPEC §2c (`accounts` 0003) adds the consent and verification-audit columns
that make LF-31 ("new users can sign up, receive the verification email and
successfully verify their accounts") actually reliable:

* `email_verification_sent_at` — without it the email's "this link expires in
  24 hours" sentence was a lie, because nothing recorded when it was issued and
  nothing could therefore enforce a window (C-26).
* `email_verified_at` — distinguishes a mailbox that genuinely clicked a link
  from the users migration `0002` grandfathered to `is_email_verified=True`
  wholesale. `0003` deliberately leaves it NULL for those users.
* `terms_accepted_at` / `marketing_consent` / `marketing_consent_at` — the
  registration endpoint now requires terms acceptance and records marketing
  consent separately, with timestamps, rather than implying both from signup.
* `email_verification_token` widens to 128 characters. `secrets.token_urlsafe(48)`
  is exactly 64 characters, which was the previous column width — zero headroom,
  and a single tweak to the token length would have silently truncated (or, on
  a strict backend, errored on) every signup.
* `email` becomes unique. `token_views.py` used to do `User.objects.get(email=…)`,
  which raises `MultipleObjectsReturned` → 500 for a duplicated address.

**Token issuance lives in exactly one place: `User.issue_verification_token()`.**
Before this change `serializers.py` generated token A, saved it and enqueued the
task, and `email_service.send_verification_email` then generated token B,
overwrote the row and mailed B (C-25) — so the link in the inbox only matched
the database when Celery happened to be running. Every caller (registration,
resend, the admin action) now goes through the method below, and
`email_service` is a pure sender that never mutates the user.
"""
import secrets

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

#: Fallback verification window, in hours, used when settings does not define
#: `EMAIL_VERIFICATION_TOKEN_TTL_HOURS`. `backend/lefoyer/settings.py` has a
#: single owner (WP-01) and this package must not edit it, so the window is read
#: through `getattr` with this default. 24 hours is the window the email body
#: has always claimed; it is now the window that is actually enforced.
DEFAULT_EMAIL_VERIFICATION_TTL_HOURS = 24

#: Number of random bytes behind the verification token. `token_urlsafe(48)`
#: yields a 64-character string, comfortably inside the 128-character column.
VERIFICATION_TOKEN_BYTES = 48


def verification_token_ttl_hours():
    """The configured verification window, in hours, as an int."""
    try:
        hours = int(
            getattr(
                settings,
                'EMAIL_VERIFICATION_TOKEN_TTL_HOURS',
                DEFAULT_EMAIL_VERIFICATION_TTL_HOURS,
            )
        )
    except (TypeError, ValueError):
        return DEFAULT_EMAIL_VERIFICATION_TTL_HOURS
    return hours if hours > 0 else DEFAULT_EMAIL_VERIFICATION_TTL_HOURS


def verification_token_ttl():
    """The configured verification window as a `timedelta`."""
    return timezone.timedelta(hours=verification_token_ttl_hours())


def generate_verification_token():
    """Return a fresh URL-safe verification token.

    Kept here rather than in `email_service` so that the sender has no reason to
    touch token state at all (C-25). `email_service.generate_verification_token`
    remains as a thin re-export for any out-of-tree caller.
    """
    return secrets.token_urlsafe(VERIFICATION_TOKEN_BYTES)


class User(AbstractUser):
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    # --- email verification -------------------------------------------------
    is_email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(
        max_length=128, blank=True, null=True, unique=True
    )
    email_verification_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the current verification token was issued. The expiry '
                  'window is measured from here.',
    )
    email_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When this address was verified by clicking a link. NULL on a '
                  'user whose is_email_verified flag was granted wholesale by '
                  'migration accounts.0002 rather than earned.',
    )

    # --- consent ------------------------------------------------------------
    terms_accepted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the user accepted the terms at registration. NULL for '
                  'accounts created before acceptance was recorded.',
    )
    marketing_consent = models.BooleanField(
        default=False,
        help_text='Opt-in to marketing email. Separate from terms acceptance: '
                  'signing up is not consent to be marketed to.',
    )
    marketing_consent_at = models.DateTimeField(null=True, blank=True)

    # `AbstractUser.email` is `blank=True` and not unique. Both are wrong here:
    # the address *is* the login identifier (username is a mirror of it, set in
    # `UserSerializer.create`), and a duplicate makes login non-deterministic.
    # Migration 0003 aborts with an actionable message if production holds
    # duplicates, rather than failing halfway through the schema change.
    email = models.EmailField(
        _('email address'),
        max_length=254,
        unique=True,
        error_messages={
            'unique': 'An account with this email address already exists.',
        },
    )

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='account_users',
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='account_users',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    # ------------------------------------------------------------------ token
    def issue_verification_token(self, save=True):
        """Generate, persist and return a fresh verification token.

        The **only** place a verification token is created. Also stamps
        `email_verification_sent_at`, which is what makes the advertised expiry
        window real and what `VerifyEmailView` measures against.
        """
        token = generate_verification_token()
        self.email_verification_token = token
        self.email_verification_sent_at = timezone.now()
        if save:
            self.save(
                update_fields=['email_verification_token', 'email_verification_sent_at']
            )
        return token

    @property
    def verification_token_expires_at(self):
        """When the current token stops being accepted, or None if unknown.

        A row with a token but no `email_verification_sent_at` predates 0003.
        Those are treated as non-expiring rather than retroactively invalid —
        locking out a user who holds a legitimately-issued link because we never
        recorded the issue time would be our bug punishing them.
        """
        if not self.email_verification_sent_at:
            return None
        return self.email_verification_sent_at + verification_token_ttl()

    def is_verification_token_expired(self, now=None):
        expires_at = self.verification_token_expires_at
        if expires_at is None:
            return False
        return (now or timezone.now()) > expires_at

    def mark_email_verified(self, now=None):
        """Flip the account to verified, recording *when*.

        Note what this does **not** do: it does not clear
        `email_verification_token`. Nulling it (the old `views.py:85`) made the
        friendly "already verified" branch unreachable, so a second click — or a
        mail scanner prefetching the state-mutating GET before the human ever
        saw the message — rendered "Verification Failed" for a perfectly good
        account (C-26). Keeping the token lets the second click resolve to
        `already_verified`.
        """
        now = now or timezone.now()
        self.is_email_verified = True
        if self.email_verified_at is None:
            self.email_verified_at = now
        self.save(update_fields=['is_email_verified', 'email_verified_at'])

    # ----------------------------------------------------------------- consent
    def record_consent(self, terms_accepted=False, marketing_consent=False, now=None):
        """Stamp registration-time consent. Caller saves."""
        now = now or timezone.now()
        if terms_accepted and self.terms_accepted_at is None:
            self.terms_accepted_at = now
        self.marketing_consent = bool(marketing_consent)
        self.marketing_consent_at = now if marketing_consent else None

    # ------------------------------------------------------------------ public
    def public_payload(self):
        """The user object inlined in the `POST /api/token/` response (§2b #28).

        Delegates to `MeSerializer`, which is what `GET /api/auth/me/` (§2b #27)
        renders, so the two can never drift — including in datetime formatting.
        `AuthContext.login()` falls back to `getMe()` whenever the login
        response omits `user`, so a user object that differed field-for-field or
        format-for-format between the two would show up as a UI that changes
        shape depending on which path produced it.

        Imported locally: `serializers` reaches this module through
        `email_service`, so a module-level import would be circular.
        """
        from .serializers import MeSerializer

        return MeSerializer(self).data
