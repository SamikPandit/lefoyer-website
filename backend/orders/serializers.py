"""Order serializers.

`OrderSerializer` used ``fields='__all__'``, which is how an order payload came
to carry `payment_id` and `provider_order_id` - raw gateway references - to the
browser, while *not* carrying the flat ``shipping_*`` names that
`OrderDetail.jsx` reads in eleven places. Every one of those rendered blank.

So: an explicit field list, the derived `status` (there is no `status` column -
C-19), the shipping block under both shapes, rupee money strings, an absolute
tracking URL, and the gateway reference masked rather than published.
"""

from django.conf import settings
from rest_framework import serializers

from products.serializers import ProductLineSerializer

from .models import Order, OrderItem, PaymentAttempt


def money(value):
    """Money as a fixed 2dp string.

    A string, not a float: ``json.dumps(Decimal('1199.00'))`` through DRF's
    float path can land as ``1199.0000000001`` in a browser, and a payment total
    is the last place to accept that.
    """
    if value is None:
        return None
    return f'{value:.2f}'


def mask_reference(reference):
    """Show enough of a gateway reference to quote it to support, no more."""
    if not reference:
        return ''
    reference = str(reference)
    if len(reference) <= 8:
        return '*' * len(reference)
    return f'{reference[:4]}{"*" * (len(reference) - 8)}{reference[-4:]}'


class OrderItemSerializer(serializers.ModelSerializer):
    # The light card payload, not the full detail one. The full serializer ships ten
    # image fields, five prose blobs and a per-product review_summary aggregate — which
    # made every order line cost extra queries and kilobytes for data no order line renders.
    product = ProductLineSerializer(read_only=True)
    # The snapshots win over the live product, so a renamed or re-SKU'd product
    # does not rewrite what the customer actually bought.
    product_name = serializers.SerializerMethodField()
    product_sku = serializers.SerializerMethodField()
    product_slug = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'product_slug',
            'product_image', 'price', 'quantity', 'line_total',
        ]

    def get_product_name(self, obj):
        return obj.product_name or getattr(obj.product, 'name', '')

    def get_product_sku(self, obj):
        return obj.product_sku or getattr(obj.product, 'sku', '')

    def get_product_slug(self, obj):
        return getattr(obj.product, 'slug', '') or ''

    def get_product_image(self, obj):
        image = getattr(obj.product, 'image_main', None)
        if not image:
            return None
        request = self.context.get('request')
        url = image.url
        return request.build_absolute_uri(url) if request else url

    def get_price(self, obj):
        return money(obj.price)

    def get_line_total(self, obj):
        return money(obj.line_total)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    shipment = serializers.SerializerMethodField()

    # Derived, not stored (C-19).
    status = serializers.CharField(read_only=True)

    # Money, as strings in rupees.
    subtotal = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    shipping_amount = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    # The shipping block, both ways: nested for new code, flat aliases for the
    # eleven `order.shipping_*` reads already in the order pages.
    shipping_address = serializers.SerializerMethodField()
    shipping_first_name = serializers.CharField(source='first_name', read_only=True)
    shipping_last_name = serializers.CharField(source='last_name', read_only=True)
    shipping_email = serializers.CharField(source='email', read_only=True)
    shipping_phone = serializers.CharField(source='phone', read_only=True)
    shipping_city = serializers.CharField(source='city', read_only=True)
    shipping_state = serializers.CharField(source='state', read_only=True)
    shipping_pincode = serializers.CharField(source='pincode', read_only=True)

    payment_reference = serializers.SerializerMethodField()
    can_retry = serializers.BooleanField(source='can_retry_payment', read_only=True)
    purchase_event_pending = serializers.BooleanField(read_only=True)

    class Meta:
        model = Order
        # Explicit. `payment_id` and `provider_order_id` are deliberately absent:
        # a raw gateway reference in a public payload is an invitation to look it
        # up. `payment_reference` carries the masked form instead.
        fields = [
            'id', 'order_number', 'status',
            'payment_status', 'payment_method', 'paid', 'payment_failure_reason',
            'subtotal', 'discount_amount', 'discount_type', 'shipping_amount',
            'total', 'currency', 'coupon_code',
            'created_at', 'updated_at',
            'items', 'shipment',
            'shipping_address',
            'shipping_first_name', 'shipping_last_name', 'shipping_email',
            'shipping_phone', 'shipping_city', 'shipping_state', 'shipping_pincode',
            # The unprefixed originals stay, because `Profile.jsx` and
            # `OrderCard.jsx` already read `first_name`/`last_name`.
            'first_name', 'last_name', 'email', 'phone', 'address', 'city',
            'state', 'pincode',
            'payment_reference', 'can_retry', 'purchase_event_pending',
            'needs_manual_review',
        ]
        read_only_fields = fields

    def get_subtotal(self, obj):
        return money(obj.subtotal)

    def get_discount_amount(self, obj):
        return money(obj.discount_amount)

    def get_shipping_amount(self, obj):
        return money(obj.shipping_amount)

    def get_total(self, obj):
        return money(obj.total)

    def get_currency(self, obj):
        return 'INR'

    def get_payment_reference(self, obj):
        return mask_reference(obj.payment_id)

    def get_shipping_address(self, obj):
        return {
            'first_name': obj.first_name,
            'last_name': obj.last_name,
            'email': obj.email,
            'phone': obj.phone,
            'address': obj.address,
            'city': obj.city,
            'state': obj.state,
            'pincode': obj.pincode,
        }

    def get_shipment(self, obj):
        """Fulfilment detail, or None.

        The original caught a bare ``except:``, which swallowed everything
        including a genuine programming error and reported it as "no shipment".
        Narrowed to the one exception a reverse OneToOne actually raises.

        `tracking_url` becomes an **absolute external** URL. It used to be the
        relative path ``/api/shipping/track/<awb>/``, and `OrderDetail.jsx`
        passed it straight to ``navigate()`` - a react-router navigation to an
        API path, which renders the SPA's 404 rather than tracking anything.
        """
        from shipping.models import Shipment

        try:
            shipment = obj.shipment
        except Shipment.DoesNotExist:
            return None
        except AttributeError:  # shipping app not installed
            return None

        tracking_url = None
        if shipment.awb_number:
            base = getattr(settings, 'BLUEDART_TRACKING_URL', '') or (
                'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo='
            )
            tracking_url = f'{base}{shipment.awb_number}'

        return {
            'awb_number': shipment.awb_number,
            'status': shipment.status,
            'status_display': shipment.get_status_display(),
            'tracking_url': tracking_url,
            'expected_delivery_date': shipment.expected_delivery_date,
            'created_at': shipment.created_at,
            'updated_at': shipment.updated_at,
            'shipped_at': shipment.shipped_at,
            'delivered_at': shipment.delivered_at,
        }


class PaymentAttemptSerializer(serializers.ModelSerializer):
    """Admin / support view of a gateway attempt. Never includes the raw response."""

    amount = serializers.SerializerMethodField()

    class Meta:
        model = PaymentAttempt
        fields = ['id', 'merchant_order_id', 'state', 'amount', 'created_at', 'updated_at']
        read_only_fields = fields

    def get_amount(self, obj):
        return money(obj.amount)


# --------------------------------------------------------------------------- #
# Request validation
# --------------------------------------------------------------------------- #
SHIPPING_FIELDS = (
    'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'pincode',
)


class ShippingInfoSerializer(serializers.Serializer):
    """Shipping details, with the formats actually validated.

    The original did ``if not all([...])`` and nothing else, so a one-character
    city, an unroutable 3-digit pincode or ``phone: '-'`` all produced an order
    that Blue Dart would later reject - after the customer had paid.
    """

    first_name = serializers.CharField(max_length=255, trim_whitespace=True)
    last_name = serializers.CharField(max_length=255, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    phone = serializers.RegexField(
        r'^(?:\+91[\-\s]?)?[6-9]\d{9}$',
        max_length=15,
        error_messages={
            'invalid': 'Enter a 10-digit Indian mobile number starting 6-9.'
        },
    )
    address = serializers.CharField(max_length=255, min_length=6, trim_whitespace=True)
    city = serializers.CharField(max_length=255, min_length=2, trim_whitespace=True)
    state = serializers.CharField(max_length=255, min_length=2, trim_whitespace=True)
    pincode = serializers.RegexField(
        r'^[1-9]\d{5}$',
        max_length=10,
        error_messages={'invalid': 'Enter a 6-digit Indian pincode.'},
    )

    def validate_phone(self, value):
        """Store the bare 10 digits, so one number has one representation."""
        digits = ''.join(ch for ch in value if ch.isdigit())
        return digits[-10:]


class OrderCreateSerializer(serializers.Serializer):
    """Body of ``POST /api/orders/``."""

    shipping_info = ShippingInfoSerializer()
    payment_method = serializers.ChoiceField(
        choices=[Order.PREPAID, Order.COD],
        error_messages={
            'invalid_choice': "payment_method must be 'PREPAID' or 'COD'."
        },
    )
    coupon_code = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=50
    )

    def to_internal_value(self, data):
        """Accept the legacy client vocabulary for `payment_method`, nothing more.

        `Checkout.jsx` sends the RadioGroup's own values (`upi`, `cod`). Those
        are mapped here - explicitly, by name - because they are known clients.
        Anything else is a 400. The old code normalised *every* unrecognised
        string to PREPAID, which is how a typo became a prepaid order nobody was
        asked to pay for.
        """
        if isinstance(data, dict):
            raw = data.get('payment_method')
            if isinstance(raw, str):
                alias = {
                    'upi': Order.PREPAID,
                    'card': Order.PREPAID,
                    'phonepe': Order.PREPAID,
                    'prepaid': Order.PREPAID,
                    'online': Order.PREPAID,
                    'cod': Order.COD,
                    'cash': Order.COD,
                    'cash_on_delivery': Order.COD,
                }.get(raw.strip().lower())
                if alias:
                    data = dict(data)
                    data['payment_method'] = alias
        return super().to_internal_value(data)


class PaymentMethodSerializer(serializers.Serializer):
    """Body of ``initiate-payment/`` and ``retry-payment/``."""

    payment_method = serializers.ChoiceField(
        choices=[Order.PREPAID, Order.COD],
        required=False,
        default=Order.PREPAID,
        error_messages={
            'invalid_choice': "payment_method must be 'PREPAID' or 'COD'."
        },
    )

    def to_internal_value(self, data):
        if isinstance(data, dict):
            raw = data.get('payment_method')
            if isinstance(raw, str):
                alias = {
                    'upi': Order.PREPAID,
                    'card': Order.PREPAID,
                    'phonepe': Order.PREPAID,
                    'prepaid': Order.PREPAID,
                    'online': Order.PREPAID,
                    'cod': Order.COD,
                    'cash': Order.COD,
                    'cash_on_delivery': Order.COD,
                }.get(raw.strip().lower())
                if alias:
                    data = dict(data)
                    data['payment_method'] = alias
        return super().to_internal_value(data)


class CancelOrderSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=''
    )


class MarkPurchaseTrackedSerializer(serializers.Serializer):
    event_id = serializers.CharField(
        required=False, allow_blank=True, max_length=128, default=''
    )
