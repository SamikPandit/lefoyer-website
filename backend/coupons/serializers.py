"""Coupon serializers.

The old ``fields='__all__'`` CouponSerializer published the entire row to any
caller who guessed a code: `max_uses`, `used_count`, `valid_from`/`valid_to`,
`min_order_amount` and the primary key. That is merchandising intelligence, and
`used_count` in particular tells a scraper exactly how close a promotion is to
exhaustion. Nothing here exposes more than the customer needs to understand the
price they are about to be charged.
"""

from rest_framework import serializers


class CouponValidateRequestSerializer(serializers.Serializer):
    """Input for ``POST /api/coupons/validate/``."""

    code = serializers.CharField(max_length=50, trim_whitespace=True)
    # Accepted as a string or a number. Range and format are enforced by
    # coupons.services.normalise_subtotal so that the endpoint and the order
    # path cannot disagree about what a valid subtotal is.
    subtotal = serializers.CharField(required=True, allow_blank=False)

    def to_internal_value(self, data):
        # DRF would stringify a numeric subtotal anyway; doing it explicitly
        # keeps the error message about the subtotal rather than about types.
        if isinstance(data, dict) and 'subtotal' in data and data['subtotal'] is not None:
            data = dict(data)
            data['subtotal'] = str(data['subtotal'])
        return super().to_internal_value(data)


class CouponResultSerializer(serializers.Serializer):
    """The success body. Money fields are strings to survive JSON float drift."""

    valid = serializers.BooleanField()
    code = serializers.CharField()
    discount_type = serializers.CharField()
    discount_value = serializers.CharField()
    discount_amount = serializers.CharField()
    subtotal = serializers.CharField()
    final_total = serializers.CharField()
    message = serializers.CharField()


def result_body(evaluation):
    """Turn an `evaluate_coupon` result into the wire body (drops the model)."""
    return {
        'valid': True,
        'code': evaluation['code'],
        'discount_type': evaluation['discount_type'],
        'discount_value': str(evaluation['discount_value']),
        'discount_amount': str(evaluation['discount_amount']),
        'subtotal': str(evaluation['subtotal']),
        'final_total': str(evaluation['final_total']),
        'message': evaluation['message'],
    }
