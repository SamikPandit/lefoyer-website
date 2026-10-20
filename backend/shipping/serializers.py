"""
DRF Serializers for shipping models.

Two things here are contracts the storefront depends on (§2b #38, LF-26):

* every error body this app produces is `{error, field?}` — one shape, so one
  client-side branch can read it. DRF's default field-error body
  (`{"pincode": ["..."]}`) is translated by `error_body()` and never escapes.
* `PincodeCheckResponseSerializer` is the only writer of the serviceability
  response, so the payload cannot drift field by field and `serviceable` /
  `cod_available` are real booleans by construction.
"""
from rest_framework import serializers

from .constants import PINCODE_INVALID_MESSAGE, PINCODE_REGEX
from .models import Shipment, TrackingEvent


# ---------------------------------------------------------------------------
# Error envelope (LF-26)
# ---------------------------------------------------------------------------
def error_body(message, field=None):
    """
    The single error shape this app returns, at every status code.

    Args:
        message: One human sentence. It is shown to the shopper verbatim.
        field: The offending request field, when the failure is about input.
               Omitted entirely (not sent as null) when the failure is ours.

    Returns:
        dict: `{'error': str}` or `{'error': str, 'field': str}`.
    """
    body = {'error': str(message)}
    if field:
        body['field'] = str(field)
    return body


def first_error_message(errors, fallback):
    """
    Reduce a DRF `serializer.errors` tree to one sentence.

    DRF nests field errors as `{field: [ErrorDetail, ...]}`, which is the second
    error shape this endpoint used to leak. This flattens it so `error_body()`
    can carry the serializer's own (already human) message instead of a
    hand-written substitute.
    """
    if isinstance(errors, dict):
        for value in errors.values():
            message = first_error_message(value, None)
            if message:
                return message
    elif isinstance(errors, (list, tuple)):
        for value in errors:
            message = first_error_message(value, None)
            if message:
                return message
    elif errors:
        return str(errors)
    return fallback


class TrackingEventSerializer(serializers.ModelSerializer):
    """Serializer for tracking events"""

    class Meta:
        model = TrackingEvent
        fields = [
            'id',
            'scan_date',
            'scan_code',
            'scan_description',
            'scanned_location',
            'instructions',
            'created_at'
        ]
        read_only_fields = fields


class ShipmentSerializer(serializers.ModelSerializer):
    """Serializer for shipment details"""

    events = TrackingEventSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    status_color = serializers.CharField(source='get_status_display_color', read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    # Absolute, external, customer-facing Blue Dart tracking page. It replaces
    # the old `/api/shipping/track/<awb>/` value, which was a relative path into
    # this JSON API: the order pages hand this straight to `window.open`, so a
    # relative API path showed the shopper a JSON document. Null until an AWB
    # exists, so the UI can hide the button rather than open a dead page.
    tracking_url = serializers.URLField(read_only=True, allow_null=True)

    class Meta:
        model = Shipment
        fields = [
            'id',
            'awb_number',
            'status',
            'status_display',
            'status_color',
            'is_active',
            'tracking_url',
            'origin_area',
            'destination_area',
            'destination_pincode',
            'weight_kg',
            'expected_delivery_date',
            'created_at',
            'shipped_at',
            'delivered_at',
            'events',
            'last_error'
        ]
        read_only_fields = fields


class PincodeCheckSerializer(serializers.Serializer):
    """
    Query-parameter validation for the serviceability check.

    Deliberately stricter than "six characters": Indian PIN codes are exactly
    six digits and never start with 0, which is the same rule the storefront's
    `PincodeCheck` component applies client-side (`PINCODE_RE`). Keeping both
    ends identical means the field error the shopper sees is the one the server
    would have given anyway.
    """
    pincode = serializers.RegexField(
        PINCODE_REGEX,
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        error_messages={
            'required': PINCODE_INVALID_MESSAGE,
            'blank': PINCODE_INVALID_MESSAGE,
            'invalid': PINCODE_INVALID_MESSAGE,
            'null': PINCODE_INVALID_MESSAGE,
        },
    )


class PincodeCheckResponseSerializer(serializers.Serializer):
    """
    The serviceability response body (§2b #38).

    `serviceable` and `cod_available` are declared `BooleanField` without
    `allow_null`, so this serializer is the second line of defence behind
    `utils.to_strict_bool`: a string that somehow survived the client would be
    rendered as a JSON boolean here, and a `None` would raise loudly in tests
    rather than ship an ambiguous promise.
    """
    serviceable = serializers.BooleanField()
    cod_available = serializers.BooleanField()
    expected_delivery_date = serializers.DateField(allow_null=True)
    transit_days = serializers.IntegerField(allow_null=True)
    area_code = serializers.CharField(allow_null=True)
    # `error` stays in the payload for contract compatibility, but it is now
    # reserved for a genuine upstream failure reported with a 200 (i.e. we got
    # an answer and part of it was unusable). "We do not deliver here" is not an
    # error, so it travels in `message`.
    error = serializers.CharField(allow_null=True)
    message = serializers.CharField(allow_null=True)
