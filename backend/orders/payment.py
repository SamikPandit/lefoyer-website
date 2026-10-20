"""PhonePe gateway adapter.

=============================================================================
WHAT WAS WRONG, AND WHY THIS FILE IS SHAPED THE WAY IT IS  (spec C-4)
=============================================================================

The previous version of this module was half V1 and half V2, and the seam ran
straight through the only path that confirms a payment:

* It imported and paid with the **V2** OAuth client
  (`phonepe.sdk.pg.payments.v2.standard_checkout_client.StandardCheckoutClient`).
* But `verify_callback` computed the **V1** checksum,
  ``sha256(base64_payload + salt_key) + '###' + salt_index``, and the callback
  view required a V1 ``{'response': <base64>}`` envelope - returning
  ``{'status': 'ok'}`` and writing nothing for anything else.

A V2 callback carries raw JSON and an ``Authorization`` header, not a base64
envelope and an ``X-VERIFY`` header. So in production every single prepaid
order sat at PENDING for ever: paid by the customer, never confirmed by us, no
stock movement, no email, no shipment.

=============================================================================
WHAT IS *NOT* VERIFIED HERE - READ BEFORE TRUSTING THIS FILE
=============================================================================

``phonepe-sdk`` is **not on public PyPI**; ``pip install phonepe-sdk`` fails in
this environment, so the real class could not be introspected and the exact
method names could not be confirmed. The local virtualenv contains only a
hand-written stub (`pay`, `get_order_status`) created as a type-check
convenience. **The stub is not evidence of the real API.**

Two things consequently MUST be confirmed on staging before this integration
can be called done:

  1. **The status-query method name.** `get_order_status` below resolves it at
     runtime from ``SDK_STATUS_METHOD_CANDIDATES`` via ``getattr`` and logs
     which name won. If none exists it raises ``PhonePeAPIError`` naming every
     candidate it tried, rather than guessing. There is also a documented REST
     fallback (``_rest_order_status``) against PhonePe's Order Status endpoint
     using an OAuth token, for the case where the SDK exposes nothing usable.
  2. **The V2 callback authentication scheme.** `verify_callback_auth` below
     implements the documented scheme - the merchant chooses a username and
     password, registers them with PhonePe, and PhonePe sends
     ``Authorization: SHA256(username:password)`` - compared in constant time,
     accepting an optional ``SHA256 `` prefix. Whether the live gateway sends
     the digest bare or prefixed, and in which case, has to be observed from a
     real sandbox callback.

The callback is therefore treated as a **hint only**: it is authenticated and
de-duplicated, and then the order's real state is re-fetched with
`get_order_status`. Nothing in this system marks an order paid on the strength
of an inbound message alone.
"""

import base64
import hashlib
import hmac
import json
import logging
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# SDK import, guarded.
#
# The SDK is an optional dependency at import time: `manage.py check`, the
# catalogue, the cart, COD checkout and the admin must all work on a box where
# it is absent (which is every box in this environment). A missing SDK surfaces
# as a PhonePeAPIError when a prepaid payment is actually attempted - and the
# REST fallback below does not need the SDK at all.
# --------------------------------------------------------------------------- #
SDK_IMPORT_ERROR = None
try:  # pragma: no cover - depends on the deployment's installed packages
    from phonepe.sdk.pg.env import Env
    from phonepe.sdk.pg.payments.v2.models.request.standard_checkout_pay_request import (
        StandardCheckoutPayRequest,
    )
    from phonepe.sdk.pg.payments.v2.standard_checkout_client import StandardCheckoutClient
except Exception as exc:  # ModuleNotFoundError, or a renamed module path
    Env = None
    StandardCheckoutClient = None
    StandardCheckoutPayRequest = None
    SDK_IMPORT_ERROR = exc
    logger.warning(
        'PhonePe SDK is not importable (%s). Prepaid payment initiation and the '
        'SDK status query are unavailable; the REST status fallback can still '
        'work if credentials are configured.',
        exc,
    )


class PhonePeAPIError(Exception):
    """The gateway could not be reached, or answered unusably.

    Never raised to mean "the payment failed" - that is a *state*, not an
    error. This means we do not know, which is why every caller turns it into a
    503 and keeps the order PENDING rather than guessing.
    """


class PhonePeNotConfigured(PhonePeAPIError):
    """Credentials are missing. Distinguished so ops can tell it apart at a glance."""


# Our vocabulary. The gateway's own state strings are mapped onto these.
STATE_PENDING = 'PENDING'
STATE_COMPLETED = 'COMPLETED'
STATE_FAILED = 'FAILED'
STATE_CANCELLED = 'CANCELLED'
STATE_UNKNOWN = 'UNKNOWN'

#: PhonePe's documented and historically-observed state strings, mapped onto
#: ours. Anything unrecognised becomes UNKNOWN, which keeps the order PENDING
#: and lets the 30-minute sweeper deal with it - never COMPLETED by default.
STATE_MAP = {
    # V2 order states
    'COMPLETED': STATE_COMPLETED,
    'FAILED': STATE_FAILED,
    'PENDING': STATE_PENDING,
    'CANCELLED': STATE_CANCELLED,
    # V2 event names arriving on the callback
    'CHECKOUT_ORDER_COMPLETED': STATE_COMPLETED,
    'CHECKOUT_ORDER_FAILED': STATE_FAILED,
    'CHECKOUT_TRANSACTION_ATTEMPT_FAILED': STATE_FAILED,
    'PG_ORDER_COMPLETED': STATE_COMPLETED,
    'PG_ORDER_FAILED': STATE_FAILED,
    # V1 vocabulary, still accepted so a legacy callback in flight during the
    # cutover is understood rather than silently dropped.
    'PAYMENT_SUCCESS': STATE_COMPLETED,
    'PAYMENT_ERROR': STATE_FAILED,
    'PAYMENT_DECLINED': STATE_FAILED,
    'PAYMENT_PENDING': STATE_PENDING,
    'PAYMENT_CANCELLED': STATE_CANCELLED,
    'USER_CANCELLED': STATE_CANCELLED,
    'TIMED_OUT': STATE_FAILED,
    'INTERNAL_SERVER_ERROR': STATE_PENDING,
}

#: Candidate SDK method names for the order-status query, most likely first.
#: Resolved by name at runtime - see the module docstring. Do NOT collapse this
#: to a single name until one has been observed working against the real SDK.
SDK_STATUS_METHOD_CANDIDATES = (
    'get_order_status',
    'get_order_status_by_merchant_order_id',
    'order_status',
    'get_status',
    'status',
    'check_status',
    'get_transaction_status',
)

# PhonePe REST hosts, used only by the documented fallback below.
REST_HOSTS = {
    'PRODUCTION': 'https://api.phonepe.com/apis',
    'SANDBOX': 'https://api-preprod.phonepe.com/apis',
}
REST_TIMEOUT = 10  # seconds; a payment page must not hang on our gateway call


class PhonePeGateway:
    def __init__(self):
        self.client_id = settings.PHONEPE_MERCHANT_ID
        self.client_secret = settings.PHONEPE_SALT_KEY
        self.client_version = settings.PHONEPE_SALT_INDEX

        env_str = str(settings.PHONEPE_ENV).upper()
        self.env_name = 'PRODUCTION' if env_str in ('PRODUCTION', 'PROD') else 'SANDBOX'
        self.env = getattr(Env, self.env_name, self.env_name) if Env else self.env_name

        self._client = None
        self._oauth_token = None
        self._oauth_expires_at = 0

    # ------------------------------------------------------------------ setup
    @property
    def is_configured(self):
        return bool(self.client_id and self.client_secret)

    def _require_configured(self):
        if not self.is_configured:
            raise PhonePeNotConfigured(
                'PhonePe credentials are not configured on this server '
                '(PHONEPE_%s_MERCHANT_ID / _SALT_KEY).'
                % ('PROD' if self.env_name == 'PRODUCTION' else 'TEST')
            )

    @property
    def client(self):
        """The SDK client, built lazily so an absent SDK is not an import error."""
        if self._client is not None:
            return self._client
        self._require_configured()
        if StandardCheckoutClient is None:
            raise PhonePeAPIError(
                'The PhonePe SDK is not installed on this server '
                f'(import failed with: {SDK_IMPORT_ERROR}). Prepaid payments '
                'cannot be initiated until it is.'
            )
        self._client = StandardCheckoutClient(
            client_id=self.client_id,
            client_secret=self.client_secret,
            client_version=self.client_version,
            env=self.env,
        )
        return self._client

    # ---------------------------------------------------------------- helpers
    @staticmethod
    def build_merchant_order_id(order_id, attempt_number):
        """Deterministic, readable, and unique per attempt: ``LF-<order>-<attempt>``.

        Deterministic matters: the old code used a fresh ``uuid4()`` per call and
        stored it on `Order.provider_order_id`, so a retry overwrote the
        reference for the previous attempt and a late callback for that attempt
        could no longer be matched to anything.
        """
        return f'LF-{order_id}-{attempt_number}'

    @staticmethod
    def build_redirect_url(order_id, merchant_order_id):
        """Where the customer lands after the gateway page.

        No ``/#/``. The app is a BrowserRouter now; the previous value
        (``{SITE_URL}/order-confirmation``, no hash, no order id) was wrong
        under both routers - it had no hash for the HashRouter the app then
        was, and no order id for the confirmation page to look anything up
        with, which is exactly why that page fell back to trusting a ``code``
        query parameter for the payment result.
        """
        return (
            f'{settings.SITE_URL}/order-confirmation/{order_id}'
            f'?ref={merchant_order_id}'
        )

    @staticmethod
    def normalise_state(raw_state):
        if not raw_state:
            return STATE_UNKNOWN
        return STATE_MAP.get(str(raw_state).strip().upper(), STATE_UNKNOWN)

    # ------------------------------------------------------------------- pay
    def initiate_payment(self, order, merchant_order_id, amount_rupees):
        """Create a checkout session. Returns ``{redirect_url, merchant_order_id}``.

        Raises ``PhonePeAPIError`` on any failure. It deliberately does not
        return a ``{'success': False}`` dict as the old version did: a falsy
        success flag is easy to forget to check, and forgetting it here means
        sending a customer to ``None``.
        """
        self._require_configured()

        amount_in_paise = int(round(float(amount_rupees) * 100))
        if amount_in_paise <= 0:
            raise PhonePeAPIError(
                f'Refusing to open a payment for {amount_rupees} rupees.'
            )

        redirect_url = self.build_redirect_url(order.id, merchant_order_id)

        # `callback_url` and the metadata are passed through because
        # settings.PHONEPE_CALLBACK_URL previously existed and was referenced
        # NOWHERE - nothing told PhonePe where to call us back, so the S2S
        # callback depended entirely on whatever was typed into the merchant
        # dashboard. **The exact keyword names below are V2-plausible but
        # unconfirmed (the SDK could not be introspected); confirm them against
        # the real `build_request` signature on staging.** Unknown keywords are
        # dropped by a **kwargs builder, so the worst case is that the callback
        # URL again comes only from the dashboard - not a broken request.
        build_kwargs = {
            'merchant_order_id': merchant_order_id,
            'amount': amount_in_paise,
            'redirect_url': redirect_url,
        }
        callback_url = getattr(settings, 'PHONEPE_CALLBACK_URL', '')
        if callback_url:
            build_kwargs['callback_url'] = callback_url
        build_kwargs['meta_info'] = {
            'udf1': str(order.id),
            'udf2': order.order_number or '',
            'udf3': str(getattr(order, 'user_id', '') or ''),
            'udf4': order.payment_method,
        }

        try:
            pay_request = StandardCheckoutPayRequest.build_request(**build_kwargs)
        except TypeError as exc:
            # A keyword the real builder does not accept. Retry with the three
            # arguments the original code proved are accepted, so an unconfirmed
            # extra never costs a customer their checkout.
            logger.warning(
                'PhonePe build_request rejected the extended keyword set (%s); '
                'retrying with the minimal signature. Confirm the real signature '
                'on staging.',
                exc,
            )
            pay_request = StandardCheckoutPayRequest.build_request(
                merchant_order_id=merchant_order_id,
                amount=amount_in_paise,
                redirect_url=redirect_url,
            )

        try:
            response = self.client.pay(pay_request)
        except Exception as exc:
            logger.exception(
                'PhonePe pay() failed for %s (order %s)', merchant_order_id, order.id
            )
            raise PhonePeAPIError(str(exc)) from exc

        gateway_redirect = (
            _attr_or_key(response, 'redirect_url')
            or _attr_or_key(response, 'redirectUrl')
        )
        if not gateway_redirect:
            raise PhonePeAPIError(
                'PhonePe accepted the payment request but returned no redirect URL.'
            )

        return {
            'redirect_url': gateway_redirect,
            'merchant_order_id': merchant_order_id,
            'raw': _jsonable(response),
        }

    # ---------------------------------------------------------------- status
    def get_order_status(self, merchant_order_id):
        """The authoritative payment state for one attempt.

        Returns ``{state, provider_payment_id, amount_paise, raw, source}``
        where `state` is one of our own PENDING / COMPLETED / FAILED /
        CANCELLED / UNKNOWN.

        Resolution order:
          1. The SDK, with the method resolved **by name at runtime** from
             ``SDK_STATUS_METHOD_CANDIDATES``. The winning name is logged at
             INFO so the first staging run records the real one.
          2. The REST Order Status endpoint with an OAuth token, if the SDK is
             absent or exposes none of the candidates.

        Raises ``PhonePeAPIError`` if neither path can answer - which callers
        turn into a 503, never into a payment outcome.
        """
        self._require_configured()

        sdk_error = None
        if StandardCheckoutClient is not None:
            try:
                method, name = self._resolve_status_method()
            except PhonePeAPIError as exc:
                sdk_error = exc
            else:
                try:
                    raw = method(merchant_order_id)
                except TypeError:
                    # Some signatures take a `details` flag.
                    raw = method(merchant_order_id, False)
                except Exception as exc:
                    logger.warning(
                        'PhonePe SDK %s(%s) failed: %s. Falling back to REST.',
                        name, merchant_order_id, exc,
                    )
                    sdk_error = exc
                else:
                    logger.info(
                        'PhonePe order status for %s resolved via SDK method %r.',
                        merchant_order_id, name,
                    )
                    return self._shape_status(raw, source=f'sdk:{name}')
        else:
            sdk_error = SDK_IMPORT_ERROR

        try:
            return self._rest_order_status(merchant_order_id)
        except PhonePeAPIError as rest_error:
            raise PhonePeAPIError(
                f'Could not read the payment status for {merchant_order_id}. '
                f'SDK path: {sdk_error}. REST path: {rest_error}'
            ) from rest_error

    def _resolve_status_method(self):
        """Find the SDK's status-query method by name. Never guesses one."""
        client = self.client
        for name in SDK_STATUS_METHOD_CANDIDATES:
            candidate = getattr(client, name, None)
            if callable(candidate):
                return candidate, name
        raise PhonePeAPIError(
            'The installed PhonePe SDK exposes none of the candidate '
            'order-status methods. Tried, in order: '
            + ', '.join(SDK_STATUS_METHOD_CANDIDATES)
            + '. Available public attributes: '
            + ', '.join(sorted(a for a in dir(client) if not a.startswith('_')))
            + '. Add the real name to SDK_STATUS_METHOD_CANDIDATES.'
        )

    # ------------------------------------------------------------ REST fallback
    def _oauth_access_token(self):
        """Fetch (and briefly cache) a V2 OAuth token.

        Endpoint: ``POST {host}/identity-manager/v1/oauth/token`` with
        ``client_id``, ``client_version``, ``client_secret`` and
        ``grant_type=client_credentials`` as form fields. Confirm against the
        PhonePe V2 docs for the merchant's account on staging.
        """
        now = time.time()
        if self._oauth_token and now < self._oauth_expires_at - 30:
            return self._oauth_token

        host = REST_HOSTS[self.env_name]
        try:
            response = requests.post(
                f'{host}/identity-manager/v1/oauth/token',
                data={
                    'client_id': self.client_id,
                    'client_version': str(self.client_version),
                    'client_secret': self.client_secret,
                    'grant_type': 'client_credentials',
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=REST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise PhonePeAPIError(f'PhonePe OAuth request failed: {exc}') from exc

        if response.status_code != 200:
            raise PhonePeAPIError(
                f'PhonePe OAuth returned HTTP {response.status_code}: '
                f'{response.text[:300]}'
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise PhonePeAPIError('PhonePe OAuth returned a non-JSON body.') from exc

        token = body.get('access_token') or body.get('accessToken')
        if not token:
            raise PhonePeAPIError('PhonePe OAuth response carried no access token.')

        expires_at = body.get('expires_at') or body.get('expiresAt')
        try:
            self._oauth_expires_at = float(expires_at) if expires_at else now + 600
        except (TypeError, ValueError):
            self._oauth_expires_at = now + 600
        self._oauth_token = token
        return token

    def _rest_order_status(self, merchant_order_id):
        """``GET {host}/pg/checkout/v2/order/{merchantOrderId}/status``.

        The documented REST escape hatch for when the SDK exposes no usable
        status query. Confirm the path and the response field names against the
        V2 docs on staging; the shaping below is tolerant of both snake_case and
        camelCase so a naming difference degrades to UNKNOWN (order stays
        PENDING) rather than to a wrong answer.
        """
        token = self._oauth_access_token()
        host = REST_HOSTS[self.env_name]
        url = f'{host}/pg/checkout/v2/order/{merchant_order_id}/status'
        try:
            response = requests.get(
                url,
                headers={
                    'Authorization': f'O-Bearer {token}',
                    'Content-Type': 'application/json',
                },
                params={'details': 'false'},
                timeout=REST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise PhonePeAPIError(f'PhonePe status request failed: {exc}') from exc

        if response.status_code == 404:
            # The gateway has never heard of this attempt. That is a real,
            # usable answer: nothing was ever charged.
            logger.info('PhonePe has no record of %s (404).', merchant_order_id)
            return {
                'state': STATE_FAILED,
                'provider_payment_id': '',
                'amount_paise': None,
                'raw': {'http_status': 404, 'body': response.text[:500]},
                'source': 'rest:404',
            }
        if response.status_code != 200:
            raise PhonePeAPIError(
                f'PhonePe status returned HTTP {response.status_code}: '
                f'{response.text[:300]}'
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise PhonePeAPIError('PhonePe status returned a non-JSON body.') from exc
        return self._shape_status(body, source='rest')

    # ----------------------------------------------------------- normalisation
    def _shape_status(self, raw, source):
        data = _jsonable(raw)
        if not isinstance(data, dict):
            data = {'value': data}

        raw_state = (
            data.get('state')
            or data.get('status')
            or data.get('code')
            or data.get('payment_state')
            or data.get('paymentState')
        )
        provider_payment_id = (
            data.get('transaction_id')
            or data.get('transactionId')
            or data.get('order_id')
            or data.get('orderId')
            or data.get('payment_id')
            or data.get('paymentId')
            or ''
        )
        # Attempt-level detail, when the gateway nests it.
        attempts = data.get('payment_details') or data.get('paymentDetails') or []
        if isinstance(attempts, list) and attempts:
            first = attempts[0] if isinstance(attempts[0], dict) else {}
            raw_state = raw_state or first.get('state') or first.get('status')
            provider_payment_id = provider_payment_id or (
                first.get('transaction_id') or first.get('transactionId') or ''
            )

        amount_paise = data.get('amount')
        try:
            amount_paise = int(amount_paise) if amount_paise is not None else None
        except (TypeError, ValueError):
            amount_paise = None

        state = self.normalise_state(raw_state)
        if state == STATE_UNKNOWN:
            logger.warning(
                'PhonePe returned an unrecognised state %r via %s; treating as '
                'UNKNOWN so the order stays PENDING.',
                raw_state, source,
            )

        return {
            'state': state,
            'raw_state': raw_state,
            'provider_payment_id': str(provider_payment_id or ''),
            'amount_paise': amount_paise,
            'raw': data,
            'source': source,
        }

    # -------------------------------------------------------------- callbacks
    def verify_callback_auth(self, authorization_header):
        """Authenticate a V2 server-to-server callback.

        PhonePe V2: the merchant chooses a username and password, registers them
        with PhonePe, and PhonePe sends ``SHA256(username:password)`` in the
        ``Authorization`` header. Both an optional ``SHA256 `` prefix and a bare
        digest are accepted because which one the live gateway sends has not been
        observed here - see the module docstring.

        Compared with ``hmac.compare_digest``: a plain ``==`` on a credential
        digest leaks its prefix through timing.

        Returns False - never True - when the credentials are unset, so a
        half-configured server rejects callbacks instead of accepting anyone's.
        """
        username = getattr(settings, 'PHONEPE_CALLBACK_USERNAME', '') or ''
        password = getattr(settings, 'PHONEPE_CALLBACK_PASSWORD', '') or ''
        if not username or not password:
            logger.error(
                'A PhonePe callback arrived but PHONEPE_CALLBACK_USERNAME / '
                'PHONEPE_CALLBACK_PASSWORD are not configured. Rejecting it: an '
                'unauthenticated callback must never be able to mark an order paid.'
            )
            return False

        if not authorization_header:
            return False

        presented = str(authorization_header).strip()
        if presented.upper().startswith('SHA256 '):
            presented = presented[len('SHA256 '):].strip()

        expected = hashlib.sha256(f'{username}:{password}'.encode('utf-8')).hexdigest()
        return hmac.compare_digest(presented.lower(), expected.lower())

    def parse_callback(self, body, raw_bytes=None):
        """Normalise an inbound callback into a dict we can act on.

        Understands the V2 shape ``{event, payload:{merchantOrderId, orderId,
        state, amount, ...}}`` and, so that a legacy message in flight during
        the cutover is not silently dropped, the V1 ``{'response': <base64>}``
        envelope too.

        Returns ``{event_key, merchant_order_id, state, provider_payment_id,
        amount_paise, event, payload}``. `event_key` is what
        ``ProcessedCallback`` de-duplicates on: the gateway's own event id when
        it sends one, otherwise a digest of the merchant order id plus the
        reported state, which collapses identical replays while still letting a
        genuine later state change through.
        """
        payload = body if isinstance(body, dict) else {}

        # V1 envelope, accepted for the cutover window only.
        if 'response' in payload and isinstance(payload.get('response'), str):
            try:
                decoded = json.loads(
                    base64.b64decode(payload['response']).decode('utf-8')
                )
            except Exception as exc:
                raise PhonePeAPIError(f'Unreadable V1 callback envelope: {exc}') from exc
            inner = decoded.get('data') or {}
            event = decoded.get('code') or ''
            merchant_order_id = (
                inner.get('merchantOrderId')
                or inner.get('merchantTransactionId')
                or ''
            )
            provider_payment_id = inner.get('transactionId') or ''
            amount_paise = inner.get('amount')
            state = self.normalise_state(inner.get('state') or event)
            raw_for_key = provider_payment_id or merchant_order_id
            return {
                'event_key': self._event_key(event, merchant_order_id, state, raw_for_key),
                'merchant_order_id': merchant_order_id,
                'state': state,
                'provider_payment_id': str(provider_payment_id or ''),
                'amount_paise': _int_or_none(amount_paise),
                'event': event,
                'payload': decoded,
                'version': 'V1',
            }

        # V2: raw JSON.
        event = payload.get('event') or payload.get('type') or ''
        inner = payload.get('payload') or payload.get('data') or {}
        if not isinstance(inner, dict):
            inner = {}
        merchant_order_id = (
            inner.get('merchantOrderId')
            or inner.get('merchant_order_id')
            or payload.get('merchantOrderId')
            or ''
        )
        provider_payment_id = (
            inner.get('orderId')
            or inner.get('order_id')
            or inner.get('transactionId')
            or ''
        )
        state = self.normalise_state(inner.get('state') or inner.get('status') or event)
        event_id = (
            payload.get('eventId')
            or payload.get('event_id')
            or inner.get('eventId')
            or ''
        )
        return {
            'event_key': self._event_key(event, merchant_order_id, state, event_id),
            'merchant_order_id': merchant_order_id,
            'state': state,
            'provider_payment_id': str(provider_payment_id or ''),
            'amount_paise': _int_or_none(inner.get('amount')),
            'event': event,
            'payload': payload,
            'version': 'V2',
        }

    @staticmethod
    def _event_key(event, merchant_order_id, state, event_id):
        if event_id:
            return f'phonepe:{event_id}'[:128]
        digest = hashlib.sha256(
            f'{event}|{merchant_order_id}|{state}'.encode('utf-8')
        ).hexdigest()
        return f'phonepe:{merchant_order_id or "unknown"}:{state}:{digest[:16]}'[:128]

    # -------------------------------------------------------------- deprecated
    def verify_callback(self, response_payload, x_verify):
        """DEPRECATED V1 checksum check. Kept only to fail loudly if called.

        The V1 ``sha256(payload + salt) + '###' + index`` scheme does not apply
        to the V2 client this module pays with - that mismatch (C-4) is the bug
        this file was rewritten to fix. Use `verify_callback_auth`.
        """
        raise PhonePeAPIError(
            'verify_callback() is the V1 checksum scheme and does not apply to '
            'the V2 integration. Use verify_callback_auth(authorization_header).'
        )


# --------------------------------------------------------------------------- #
# Small helpers. The SDK's return types are unknown here, so every read of a
# response goes through these rather than assuming attribute or dict access.
# --------------------------------------------------------------------------- #
def _attr_or_key(obj, name):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def _jsonable(obj):
    """Best-effort conversion of an unknown SDK object into JSON-storable data."""
    if obj is None:
        return {}
    if isinstance(obj, (dict, list, str, int, float, bool)):
        return obj
    for attr in ('to_dict', 'dict', '_asdict'):
        method = getattr(obj, attr, None)
        if callable(method):
            try:
                return method()
            except Exception:  # pragma: no cover - defensive
                pass
    data = getattr(obj, '__dict__', None)
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if _is_jsonable(v)}
    return {'repr': repr(obj)[:500]}


def _is_jsonable(value):
    try:
        json.dumps(value)
        return True
    except (TypeError, ValueError):
        return False


def _int_or_none(value):
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
