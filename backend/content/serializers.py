from rest_framework import serializers

from .models import Claim, HomeSection, PolicySetting, SiteSetting, SupportRequest


class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = ['label', 'footnote', 'evidence_url', 'is_substantiated']
        read_only_fields = fields


class SiteSettingSerializer(serializers.ModelSerializer):
    """Endpoint #34 shape.

    `claims` is injected by the view (already filtered and ordered) so the
    substantiation rule lives in exactly one place.
    """

    claims = serializers.SerializerMethodField()
    social = serializers.SerializerMethodField()

    class Meta:
        model = SiteSetting
        fields = [
            'support_email',
            'support_phone',
            'whatsapp',
            'hours',
            'brand_name',
            'tagline',
            'positioning_statement',
            'claims',
            'social',
        ]
        read_only_fields = fields

    def get_claims(self, obj):
        # Supplied by the view, which owns the substantiation filter.
        return ClaimSerializer(self.context.get('claims', []), many=True).data

    def get_social(self, obj):
        return {'instagram': obj.instagram_url}


class PolicySettingSerializer(serializers.ModelSerializer):
    """Endpoint #35 shape."""

    delivery_window_days = serializers.SerializerMethodField()
    free_shipping_threshold = serializers.SerializerMethodField()
    shipping_charge = serializers.SerializerMethodField()

    class Meta:
        model = PolicySetting
        fields = [
            'delivery_window_days',
            'free_shipping_threshold',
            'shipping_charge',
            'return_window_days',
            'return_window_from',
            'refund_days',
            'return_exclusions',
            'cod_available',
        ]
        read_only_fields = fields

    def get_delivery_window_days(self, obj):
        return [obj.delivery_window_min_days, obj.delivery_window_max_days]

    def get_free_shipping_threshold(self, obj):
        # Stays null rather than becoming "0.00", because null means
        # "free on every order" and 0 would mean "free above zero" — the same
        # thing to a human and a different thing to the cart arithmetic.
        if obj.free_shipping_threshold is None:
            return None
        return float(obj.free_shipping_threshold)

    def get_shipping_charge(self, obj):
        return float(obj.shipping_charge)


class HomeSectionProductSerializer(serializers.Serializer):
    """A deliberately minimal product shape for a home-section rail.

    It is defined here rather than imported from products.serializers so that
    the content app does not couple itself to the catalogue serializer's
    changing field list. A rail needs enough to render a card and link to the
    PDP; availability and rating are read from the catalogue endpoints.
    """

    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    slug = serializers.SlugField(read_only=True)
    sku = serializers.CharField(read_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    discount_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, allow_null=True
    )
    image_main = serializers.SerializerMethodField()

    def get_image_main(self, obj):
        image = getattr(obj, 'image_main', None)
        if not image:
            return None
        request = self.context.get('request')
        url = image.url
        return request.build_absolute_uri(url) if request else url


class HomeSectionSerializer(serializers.ModelSerializer):
    """Endpoint #36 shape."""

    products = HomeSectionProductSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = HomeSection
        fields = [
            'id',
            'kind',
            'display_order',
            'title',
            'subtitle',
            'body',
            'image',
            'cta_label',
            'cta_target',
            'starts_at',
            'ends_at',
            'products',
        ]
        read_only_fields = fields

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class SupportRequestSerializer(serializers.Serializer):
    """Input for endpoint #37 — POST /api/content/support/contact/."""

    name = serializers.CharField(max_length=120, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    order_id = serializers.CharField(
        max_length=64, required=False, allow_blank=True, trim_whitespace=True
    )
    topic = serializers.ChoiceField(
        choices=[choice[0] for choice in SupportRequest.TOPIC_CHOICES],
        required=False,
        default='other',
    )
    message = serializers.CharField(max_length=5000, trim_whitespace=True)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_message(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                "Please tell us a little more so we can actually help — at "
                "least a sentence."
            )
        return value.strip()
