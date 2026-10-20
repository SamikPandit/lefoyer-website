"""Public coupon validation.

Three changes from the original, all of them consequences of the same fact: the
customer who needs to know whether a code works is usually not logged in yet.

1. **AllowAny.** ``IsAuthenticated`` meant a guest filling in the cart could not
   check a code at all - they had to sign up first, and only then find out the
   promotion did not apply to their basket.
2. **Throttled** (`coupon_validate`, 20/hour). An open, unauthenticated endpoint
   that confirms whether a string is a live coupon is a brute-force oracle;
   without a limit a script enumerates the whole promotion table.
3. **400, not 404, with a machine-readable reason.** A 404 on a POST to an
   endpoint that exists is a lie about the route, and axios interceptors treat
   it as a transport failure. The rejection body is now a result the UI can
   render: ``{valid:false, reason, message, ...}``.

The arithmetic itself lives in ``coupons/services.py`` and is shared with order
creation, so this endpoint cannot promise a discount that checkout then refuses.
"""

import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .serializers import CouponValidateRequestSerializer, result_body
from .services import CouponError, evaluate_coupon

logger = logging.getLogger(__name__)


class CouponViewSet(viewsets.ViewSet):
    """Only `validate` is exposed. Coupons are not browsable by customers."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'coupon_validate'

    @action(detail=False, methods=['post'])
    def validate(self, request):
        serializer = CouponValidateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            # Keep the `valid:false` envelope even for a malformed request, so
            # the client has exactly one shape to parse for every rejection.
            return Response(
                {
                    'valid': False,
                    'reason': 'INVALID_REQUEST',
                    'message': 'Enter a coupon code and the order subtotal.',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            evaluation = evaluate_coupon(
                code=serializer.validated_data['code'],
                subtotal=serializer.validated_data['subtotal'],
                user=request.user if request.user.is_authenticated else None,
            )
        except CouponError as exc:
            return Response(exc.as_body(), status=status.HTTP_400_BAD_REQUEST)

        return Response(result_body(evaluation), status=status.HTTP_200_OK)
