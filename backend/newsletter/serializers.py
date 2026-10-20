from rest_framework import serializers

from .models import Subscriber


class SubscribeSerializer(serializers.Serializer):
    """Input for POST /api/newsletter/subscribe/.

    Deliberately not a ModelSerializer: `email` must NOT carry a uniqueness
    validator here. An address that is already on the list is a success
    (`already_subscribed`), not a validation error — telling an anonymous
    caller "this email is already registered" is a membership disclosure.
    """

    email = serializers.EmailField(max_length=254)
    consent = serializers.BooleanField()
    source = serializers.ChoiceField(
        choices=[choice[0] for choice in Subscriber.SOURCE_CHOICES],
        required=False,
        default='other',
    )
    utm = serializers.DictField(required=False, default=dict)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_consent(self, value):
        if value is not True:
            raise serializers.ValidationError(
                "We can only add you to the list if you agree to receive emails."
            )
        return value

    def validate_utm(self, value):
        # Keep the blob small and flat; it is attribution, not a payload store.
        cleaned = {}
        for key, raw in list(value.items())[:12]:
            cleaned[str(key)[:64]] = str(raw)[:255]
        return cleaned


class SubscriberSerializer(serializers.ModelSerializer):
    """Output shape for endpoint #33. `status` is supplied by the view."""

    status = serializers.SerializerMethodField()

    class Meta:
        model = Subscriber
        fields = ['id', 'email', 'status', 'created_at']
        read_only_fields = fields

    def get_status(self, obj):
        return self.context.get('subscribe_status', 'subscribed')
