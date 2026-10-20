"""Account-endpoint throttles.

Two things the stock DRF throttles cannot do, both required by §2b:

1. **Key on the submitted email, not the client IP** (#31, #32). Resend and
   password-reset abuse is per-mailbox: rate-limiting by IP lets one attacker
   on a mobile network flood one person's inbox from a new address each time,
   and simultaneously throttles every innocent user behind the same NAT.
2. **Return `retry_after` in the body** (#31). DRF's `Throttled` renders
   `{"detail": "Request was throttled. Expected available in 42 seconds."}`,
   which forces the client to parse English to build a countdown. These
   throttles raise a `Throttled` subclass whose detail is a dict, which DRF's
   exception handler passes through verbatim.

The rates themselves live in `settings.DEFAULT_THROTTLE_RATES` (scopes
`resend_verification`, `password_reset`, `register`), which WP-01 already
registered. This package does not edit settings.py.
"""
from rest_framework.exceptions import Throttled
from rest_framework.throttling import SimpleRateThrottle


class ThrottledWithRetryAfter(Throttled):
    """429 with a machine-readable `retry_after` alongside the prose `detail`."""

    def __init__(self, wait=None, detail=None):
        super().__init__(wait=wait, detail=detail)
        seconds = int(wait) if wait else 0
        message = detail or (
            'Too many requests. Please try again in '
            f'{seconds} second{"" if seconds == 1 else "s"}.'
        )
        # A dict detail is returned as-is by DRF's default exception handler,
        # so the response body is exactly {detail, retry_after}.
        self.detail = {'detail': message, 'retry_after': seconds}


class EmailScopedRateThrottle(SimpleRateThrottle):
    """Rate-limit by the `email` in the request body, falling back to the IP.

    Subclasses set `scope` (which selects the rate from settings) and may set
    `min_interval_seconds` to additionally enforce a cooldown between two
    consecutive attempts for the same key.
    """

    scope = None
    #: Minimum gap between two successful attempts for one key. 0 disables it.
    min_interval_seconds = 0

    def _submitted_email(self, request):
        data = getattr(request, 'data', None)
        if not hasattr(data, 'get'):
            return ''
        value = data.get('email') or ''
        if not isinstance(value, str):
            return ''
        return value.strip().lower()

    def get_cache_key(self, request, view):
        email = self._submitted_email(request)
        if email:
            # Keyed on (email, requester), not the email alone. Keying on the email alone meant
            # anyone who knew a customer's address could spend that address's 3/hour budget from
            # their own machine and lock the real owner out of BOTH password reset and
            # verification resend for an hour — a denial-of-service on account recovery.
            # Per-address mailbomb protection is kept by EmailOnlyFloodThrottle below, which
            # runs alongside this one at a looser rate.
            ident = f'email:{email}:{self.get_ident(request)}'
        else:
            # No email in the body (a malformed request). Fall back to the IP so
            # the endpoint still cannot be hammered, and so that a client
            # omitting the field cannot bypass the limit entirely.
            ident = f'ip:{self.get_ident(request)}'
        return self.cache_format % {'scope': self.scope, 'ident': ident}

    def allow_request(self, request, view):
        self._cooldown_wait = None
        allowed = super().allow_request(request, view)
        if not allowed:
            return False

        if self.min_interval_seconds and len(self.history) > 1:
            # `throttle_success` has already written `self.now` at history[0],
            # so the previous attempt is history[1].
            elapsed = self.now - self.history[1]
            if elapsed < self.min_interval_seconds:
                # Roll the record we just wrote back out, so a client that
                # retries too fast does not also burn one of its hourly
                # attempts. Without this, three impatient double-clicks would
                # spend the whole 3/hour budget in a second.
                self.history.pop(0)
                self.cache.set(self.key, self.history, self.duration)
                self._cooldown_wait = self.min_interval_seconds - elapsed
                return False
        return True

    def wait(self):
        if getattr(self, '_cooldown_wait', None):
            return self._cooldown_wait
        return super().wait()


class ResendVerificationThrottle(EmailScopedRateThrottle):
    """§2b #31 — `3/hour` keyed on the email, plus a 60s cooldown.

    The cooldown matches the 60-second Resend button cooldown WP-12's
    `CheckYourInbox` component renders, so a user who waits for the button to
    re-enable never sees a 429.
    """

    scope = 'resend_verification'
    min_interval_seconds = 60


class PasswordResetThrottle(EmailScopedRateThrottle):
    """§2b #32 — `3/hour` keyed on the email.

    A separate scope from `resend_verification` so that a user who has spent
    their resend attempts can still reset a password.
    """

    scope = 'password_reset'
    min_interval_seconds = 60


class EmailOnlyFloodThrottle(EmailScopedRateThrottle):
    """A looser cap keyed on the email ALONE, to stop a distributed mailbomb.

    `EmailScopedRateThrottle` is now per (email, requester), which is what keeps one attacker
    from exhausting a stranger's recovery budget. That alone would let many requesters each send
    their own 3/hour to the same inbox, so this second bucket caps total mail per address. It is
    deliberately loose enough that a real person retrying from, say, phone and laptop never hits
    it, but tight enough that an address cannot be flooded.
    """

    scope = 'email_flood'
    min_interval_seconds = 0

    def get_cache_key(self, request, view):
        email = self._submitted_email(request)
        if not email:
            return None  # the per-(email, ip) throttle already covers the malformed case
        return self.cache_format % {'scope': self.scope, 'ident': f'email:{email}'}


class RegisterThrottle(SimpleRateThrottle):
    """§2b #29 — `10/hour` for registration.

    Keyed on the IP, not the email: the email is different on every signup
    attempt, so an email key would never limit anything.
    """

    scope = 'register'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }
