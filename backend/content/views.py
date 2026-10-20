import logging

from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    Claim,
    HomeSection,
    PolicySetting,
    SiteSetting,
    SupportRequest,
    generate_ticket_ref,
)
from .serializers import (
    HomeSectionSerializer,
    PolicySettingSerializer,
    SiteSettingSerializer,
    SupportRequestSerializer,
)

logger = logging.getLogger(__name__)

# The two singleton endpoints are wrapped in cache_page(CONTENT_CACHE_SECONDS)
# in urls.py. Caching there rather than in the view means a cache hit is served
# before DRF's dispatch runs at all.
CONTENT_CACHE_SECONDS = 300


class PublicReadView(APIView):
    """Shared base for the public content reads.

    These opt into the `catalogue` throttle scope (300/minute) rather than
    inheriting the global anon floor of 30/minute: the site settings and policy
    are fetched by the shell on first paint, so the floor would 429 an ordinary
    browsing session.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogue'


class SiteSettingsView(PublicReadView):
    """Endpoint #34 — GET /api/content/site-settings/.

    `claims` is the whole claims register, each row carrying its own
    `is_substantiated` flag, exactly as the §2b contract specifies. The flag is
    the rendering gate: a client must render a claim only when it is true. The
    register is served in full (rather than pre-filtered) because an
    unevidenced row is information the client needs — it is what lets the copy
    layer keep the approved wording and the "evidence required" note for a claim
    that is currently switched off, instead of forgetting the claim exists.

    `?substantiated_only=true` returns only the renderable subset, for a
    consumer that would rather not carry the gate itself. It gets its own cache
    entry, because cache_page keys on the query string.
    """

    def get(self, request):
        settings_row = SiteSetting.load()
        claims = Claim.objects.all()
        if request.query_params.get('substantiated_only', '').lower() in (
            'true', '1', 'yes'
        ):
            claims = claims.filter(is_substantiated=True)

        serializer = SiteSettingSerializer(
            settings_row, context={'request': request, 'claims': list(claims)}
        )
        return Response(serializer.data)


class PolicyView(PublicReadView):
    """Endpoint #35 — GET /api/content/policy/."""

    def get(self, request):
        return Response(
            PolicySettingSerializer(
                PolicySetting.load(), context={'request': request}
            ).data
        )


class HomeSectionsView(PublicReadView):
    """Endpoint #36 — GET /api/content/home-sections/.

    Server-filtered to `is_active AND starts_at <= now <= ends_at`, with a null
    bound treated as open-ended. This is what retires a seasonal banner without
    a deploy: set `ends_at` in the past and it stops being served. Returns a
    bare list (no pagination envelope) — an in-window homepage is a handful of
    rows, and the frontend renders them in order.
    """

    def get(self, request):
        now = timezone.now()
        sections = (
            HomeSection.objects.filter(is_active=True)
            .filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now))
            .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
            .prefetch_related('products')
            .order_by('display_order', 'id')
        )
        serializer = HomeSectionSerializer(
            sections, many=True, context={'request': request}
        )
        return Response(serializer.data)


class SupportContactView(APIView):
    """Endpoint #37 — POST /api/content/support/contact/."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'support'

    def post(self, request):
        serializer = SupportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        raw_reference = (data.get('order_id') or '').strip()
        order = self._resolve_order(raw_reference)

        support_request = self._create_with_unique_ref(
            name=data['name'],
            email=data['email'],
            order=order,
            order_reference=raw_reference,
            topic=data.get('topic') or 'other',
            message=data['message'],
        )

        logger.info(
            "Support request %s created (topic=%s, order=%s)",
            support_request.ticket_ref,
            support_request.topic,
            order.pk if order else None,
        )

        return Response(
            {
                'detail': (
                    "Thanks — we have your message. We reply to every request; "
                    "quote your reference if you follow up."
                ),
                'ticket_ref': support_request.ticket_ref,
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _resolve_order(raw_reference):
        """Best-effort link to a real order.

        Accepts a bare primary key or an 'LF000123'-style reference. An
        unresolvable value is NOT an error: the raw text is stored on
        `order_reference` so support can still act on it.
        """
        if not raw_reference:
            return None

        from orders.models import Order

        digits = ''.join(ch for ch in raw_reference if ch.isdigit())
        # Nothing numeric, or implausibly long for a primary key: leave it on
        # order_reference only. Nothing about the order is returned to the
        # caller either way, so a wrong guess leaks nothing — it would just
        # mislead whoever picks the ticket up.
        if not digits or len(digits) > 9:
            return None
        return Order.objects.filter(pk=int(digits)).first()

    @staticmethod
    def _create_with_unique_ref(**fields):
        """`ticket_ref` is random; retry on the vanishingly rare collision."""
        last_error = None
        for _ in range(5):
            try:
                return SupportRequest.objects.create(
                    ticket_ref=generate_ticket_ref(), **fields
                )
            except IntegrityError as exc:
                last_error = exc
        raise last_error
