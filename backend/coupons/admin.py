from django.contrib import admin
from django.utils import timezone

from .models import Coupon


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        'code',
        'discount_type',
        'discount_value',
        'max_discount_amount',
        'min_order_amount',
        'valid_from',
        'valid_to',
        'active',
        'usage',
        'live_now',
    )
    list_filter = ('active', 'discount_type', 'valid_from', 'valid_to')
    search_fields = ('code',)
    ordering = ('-valid_to', 'code')
    # `used_count` is maintained by the order state machine (claimed on order
    # creation, released on failure/cancellation). Hand-editing it in the admin
    # would silently change how many redemptions remain.
    readonly_fields = ('used_count', 'discount')
    fieldsets = (
        (None, {'fields': ('code', 'active')}),
        ('Discount', {
            'fields': ('discount_type', 'discount_value', 'max_discount_amount'),
            'description': 'PERCENT treats "discount value" as a percentage (0-100) '
                           'and honours the rupee cap. FIXED takes that many rupees '
                           'off, never more than the subtotal.',
        }),
        ('Eligibility', {'fields': ('min_order_amount', 'valid_from', 'valid_to', 'max_uses')}),
        ('Bookkeeping', {
            'fields': ('used_count', 'discount'),
            'description': '"discount" is the deprecated legacy percentage column, '
                           'kept read-only so historic orders stay explicable.',
        }),
    )

    @admin.display(description='Used')
    def usage(self, obj):
        if obj.max_uses:
            return f'{obj.used_count} / {obj.max_uses}'
        return f'{obj.used_count} / unlimited'

    @admin.display(boolean=True, description='Redeemable now')
    def live_now(self, obj):
        return obj.is_valid()

    def get_queryset(self, request):
        # `live_now` calls is_valid() per row; nothing to prefetch, but keep the
        # timezone evaluated once per request rather than per row.
        self._now = timezone.now()
        return super().get_queryset(request)
