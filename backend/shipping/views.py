"""
Django REST Framework views for shipping API endpoints.

WP-06 hardening (LF-11 backend half, LF-26 error envelope):

* **One error shape.** Every non-2xx body from this app is `{error, field?}`.
  A bad pincode used to return DRF's raw field errors (`{"pincode": [...]}`)
  while every other failure returned `{"error": ...}` — two shapes for one
  client, so the storefront could only ever read one of them.
* **Real booleans.** `serviceable` / `cod_available` are coerced with
  `to_strict_bool` and then rendered through `PincodeCheckResponseSerializer`.
  The zeep clients run with `Settings(strict=False)`; if the Finder WSDL types
  those elements as strings, the string `'false'` is truthy in Python and a
  lenient implementation would report **every** pincode serviceable.
* **A 24h per-pincode cache**, so a debounced pincode field, the PDP widget's
  auto-check and the checkout address step cannot between them re-ask Blue Dart
  for the same answer.
* **The response serializer is actually used**, so the payload shape is enforced
  in one place instead of being rebuilt field-by-field per branch.
"""
import logging

from django.core.cache import cache
from django.http import FileResponse, Http404
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .client import BlueDartAPIError, BlueDartClient, BlueDartConfigurationError
from .constants import (
    PINCODE_INVALID_MESSAGE,
    PINCODE_NOT_SERVICEABLE_MESSAGE,
    PINCODE_SERVICEABLE_MESSAGE,
    SERVICEABILITY_CACHE_KEY_TEMPLATE,
    SERVICEABILITY_CACHE_TTL_SECONDS,
    SERVICEABILITY_UNAVAILABLE_MESSAGE,
)
from .models import Shipment
from .serializers import (
    PincodeCheckResponseSerializer,
    PincodeCheckSerializer,
    ShipmentSerializer,
    error_body,
    first_error_message,
)
from .utils import to_strict_bool

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_serviceability(request):
    """
    Check pincode serviceability and get estimated delivery date.

    GET /api/shipping/check-serviceability/?pincode=560001

    200 (serviceable or not — a "no" is an answer, not a failure):
        {
            "serviceable": true,
            "cod_available": false,
            "expected_delivery_date": "2026-02-10",
            "transit_days": 2,
            "area_code": "BLR",
            "error": null,
            "message": "Delivery is available to this pincode."
        }

    400: {"error": "Enter a valid 6-digit pincode.", "field": "pincode"}
    503: {"error": "Delivery check is temporarily unavailable. ..."}
         — credentials absent or Blue Dart unreachable. The storefront renders
         this as "you can still place your order", never as "we don't deliver".
    """
    request_serializer = PincodeCheckSerializer(data=request.query_params)

    if not request_serializer.is_valid():
        # Translate DRF's `{"pincode": ["..."]}` into the one envelope.
        return Response(
            error_body(
                first_error_message(request_serializer.errors, PINCODE_INVALID_MESSAGE),
                field='pincode',
            ),
            status=status.HTTP_400_BAD_REQUEST,
        )

    pincode = request_serializer.validated_data['pincode']
    cache_key = SERVICEABILITY_CACHE_KEY_TEMPLATE.format(pincode=pincode)

    cached_body = cache.get(cache_key)
    if cached_body is not None:
        # Already rendered through the response serializer before it was stored,
        # so this is byte-identical to a fresh answer.
        logger.debug("Serviceability cache hit for %s", pincode)
        return Response(cached_body)

    try:
        client = BlueDartClient()

        serviceability_result = client.check_serviceability(pincode) or {}

        # Belt and braces: the client already coerces, and so do we, because the
        # truthiness of a string must never decide a delivery promise.
        serviceable = to_strict_bool(
            serviceability_result.get('serviceable'),
            default=False,
            field_name='serviceable',
        )
        cod_available = to_strict_bool(
            serviceability_result.get('cod_available'),
            default=False,
            field_name='cod_available',
        )

        if not serviceable:
            upstream_note = serviceability_result.get('error')
            if upstream_note:
                # Blue Dart's own words are an operator diagnostic, not shopper
                # copy, and "not serviceable" is not an error state.
                logger.info(
                    "Pincode %s reported not serviceable by Blue Dart: %s",
                    pincode, upstream_note,
                )
            payload = {
                'serviceable': False,
                'cod_available': False,
                'expected_delivery_date': None,
                'transit_days': None,
                'area_code': None,
                'error': None,
                'message': PINCODE_NOT_SERVICEABLE_MESSAGE,
            }
        else:
            transit_result = client.get_transit_time(pincode) or {}
            transit_error = (
                transit_result.get('error')
                if transit_result.get('transit_days') is None
                else None
            )
            payload = {
                'serviceable': True,
                'cod_available': cod_available,
                'expected_delivery_date': transit_result.get('expected_delivery_date'),
                'transit_days': transit_result.get('transit_days'),
                'area_code': transit_result.get('area_code'),
                # A serviceable pincode whose transit lookup failed still
                # delivers; we simply cannot name the date. Carrying the reason
                # in `error` keeps the 200 honest without turning a yes into a no.
                'error': str(transit_error) if transit_error else None,
                'message': PINCODE_SERVICEABLE_MESSAGE,
            }

        body = PincodeCheckResponseSerializer(payload).data
        cache.set(cache_key, body, SERVICEABILITY_CACHE_TTL_SECONDS)
        return Response(body)

    except BlueDartConfigurationError as exc:
        # Nothing was sent upstream: the courier account is not configured here.
        logger.error("Serviceability unavailable for %s (not configured): %s", pincode, exc)
        return Response(
            error_body(SERVICEABILITY_UNAVAILABLE_MESSAGE),
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except BlueDartAPIError as exc:
        logger.error("Blue Dart API error checking serviceability for %s: %s", pincode, exc)
        return Response(
            error_body(SERVICEABILITY_UNAVAILABLE_MESSAGE),
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:  # noqa: BLE001 - last resort, must not leak internals
        logger.exception("Unexpected error checking serviceability for %s: %s", pincode, exc)
        # 503, not 500. Whatever went wrong here, the shopper's situation is the same: we
        # cannot check delivery right now, and they can still place the order. The frontend's
        # PincodeCheck renders that honest degraded state for 503; a 500 reads to it as a bug
        # and produces a dead end instead. The traceback is in the log either way.
        return Response(
            error_body(SERVICEABILITY_UNAVAILABLE_MESSAGE),
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def track_shipment(request, awb_number):
    """
    Track a shipment by AWB number.

    GET /api/shipping/track/{awb_number}/

    Returns the `ShipmentSerializer` payload (including the absolute external
    `tracking_url`) when we know the shipment, or a trimmed live payload from
    Blue Dart when we do not. Errors use the `{error, field?}` envelope.
    """
    awb_number = str(awb_number or '').strip()

    if not awb_number:
        return Response(
            error_body('A tracking number is required.', field='awb_number'),
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # No `select_related('order')`: this payload exposes no order field, so
        # joining the orders table would only widen the query (and couple a
        # public tracking lookup to the orders schema).
        shipment = Shipment.objects.prefetch_related('events').get(awb_number=awb_number)
    except Shipment.DoesNotExist:
        shipment = None

    if shipment is not None:
        return Response(ShipmentSerializer(shipment).data)

    # Not ours (or not synced yet) — ask Blue Dart directly.
    try:
        client = BlueDartClient()
        result = client.track_shipment(awb_number) or {}

        if result.get('error'):
            return Response(
                error_body('We could not find that tracking number.', field='awb_number'),
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'awb_number': awb_number,
            'status': result.get('current_status'),
            'events': result.get('scan_events', []),
        })

    except BlueDartConfigurationError as exc:
        logger.error("Tracking unavailable for %s (not configured): %s", awb_number, exc)
        return Response(
            error_body('Tracking is temporarily unavailable. Please try again shortly.'),
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except BlueDartAPIError as exc:
        logger.error("Blue Dart API error tracking %s: %s", awb_number, exc)
        return Response(
            error_body('Tracking is temporarily unavailable. Please try again shortly.'),
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected error tracking %s: %s", awb_number, exc)
        return Response(
            error_body('Tracking is temporarily unavailable. Please try again shortly.'),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_label(request, awb_number):
    """
    Download shipping label PDF.

    GET /api/shipping/label/{awb_number}/

    Returns: PDF file, or the `{error}` envelope.
    """
    try:
        shipment = Shipment.objects.select_related('order').get(awb_number=awb_number)
    except Shipment.DoesNotExist:
        raise Http404("Shipment not found")

    # Check if user owns this order
    if shipment.order.user != request.user and not request.user.is_staff:
        return Response(
            error_body('You do not have access to this label.'),
            status=status.HTTP_403_FORBIDDEN,
        )

    if not shipment.label_pdf:
        return Response(
            error_body('No label has been generated for this shipment yet.'),
            status=status.HTTP_404_NOT_FOUND,
        )

    return FileResponse(
        shipment.label_pdf.open('rb'),
        content_type='application/pdf',
        as_attachment=True,
        filename=f'label_{awb_number}.pdf',
    )


class ShipmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for shipment management.

    Staff see every shipment; a signed-in shopper sees only their own.
    """
    queryset = Shipment.objects.all().select_related('order').prefetch_related('events')
    serializer_class = ShipmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter shipments by user unless staff"""
        queryset = super().get_queryset()

        if self.request.user.is_staff:
            return queryset

        # Regular users can only see their own shipments
        return queryset.filter(order__user=self.request.user)
