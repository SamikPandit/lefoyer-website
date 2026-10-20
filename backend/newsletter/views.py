import logging

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Subscriber
from .serializers import SubscribeSerializer, SubscriberSerializer

logger = logging.getLogger(__name__)


def client_ip(request):
    """Best-effort originating IP.

    Production terminates TLS at nginx and proxies to gunicorn over a unix
    socket, so REMOTE_ADDR is the proxy. Prefer the left-most X-Forwarded-For
    entry when present, and return None rather than storing something that is
    not an address — the column is a GenericIPAddressField.
    """
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    candidates = [part.strip() for part in forwarded.split(',') if part.strip()]
    candidates.append((request.META.get('REMOTE_ADDR') or '').strip())

    from django.core.validators import validate_ipv46_address
    from django.core.exceptions import ValidationError

    for candidate in candidates:
        if not candidate:
            continue
        try:
            validate_ipv46_address(candidate)
        except ValidationError:
            continue
        return candidate
    return None


class NewsletterSubscribeView(APIView):
    """Endpoint #33 — POST /api/newsletter/subscribe/.

    Idempotent by design: an address that is already on the list is reported as
    `already_subscribed` with a 200, never as an error. `throttle_classes` is
    set explicitly so this view uses the `newsletter` scope (10/hour) instead of
    inheriting the global anon floor.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'newsletter'

    def post(self, request):
        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = data['email']
        existing = Subscriber.objects.filter(email=email).first()
        if existing is not None:
            return Response(
                SubscriberSerializer(
                    existing, context={'subscribe_status': 'already_subscribed'}
                ).data,
                status=status.HTTP_200_OK,
            )

        try:
            with transaction.atomic():
                subscriber = Subscriber.objects.create(
                    email=email,
                    source=data.get('source') or 'other',
                    consent_at=timezone.now(),
                    ip=client_ip(request),
                    utm=data.get('utm') or {},
                )
        except IntegrityError:
            # Two concurrent submissions of the same address. The second one is
            # still a success from the caller's point of view.
            subscriber = Subscriber.objects.filter(email=email).first()
            if subscriber is None:
                raise
            return Response(
                SubscriberSerializer(
                    subscriber, context={'subscribe_status': 'already_subscribed'}
                ).data,
                status=status.HTTP_200_OK,
            )

        logger.info("Newsletter subscription created (source=%s)", subscriber.source)
        return Response(
            SubscriberSerializer(
                subscriber, context={'subscribe_status': 'subscribed'}
            ).data,
            status=status.HTTP_201_CREATED,
        )
