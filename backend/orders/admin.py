"""Order admin.

The money columns, the state latches and the gateway references are read-only.
`orders/services.py` is the only writer of order state, and an admin text box
that can set `payment_status` by hand is a second writer - exactly the kind that
let an order be COMPLETED without the stock decrement that should have come with
it. Ops get explicit *actions* instead, which go through the services functions
and therefore carry all of their guards.
"""

from django.contrib import admin, messages

from . import services
from .models import Order, OrderItem, PaymentAttempt, ProcessedCallback


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    raw_id_fields = ['product']
    readonly_fields = ['product', 'product_name', 'product_sku', 'price', 'quantity']
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj):
        return False


class PaymentAttemptInline(admin.TabularInline):
    model = PaymentAttempt
    readonly_fields = [
        'merchant_order_id', 'state', 'amount', 'provider_payment_id',
        'created_at', 'updated_at', 'raw_response',
    ]
    fields = readonly_fields
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_number', 'user', 'email', 'total', 'discount_amount',
        'payment_method', 'payment_status', 'paid', 'stock_decremented',
        'needs_manual_review', 'created_at',
    )
    list_display_links = ('order_number',)
    list_filter = (
        'payment_status', 'payment_method', 'paid', 'needs_manual_review',
        'stock_decremented', 'created_at',
    )
    search_fields = (
        'order_number', 'first_name', 'last_name', 'email', 'phone', 'id',
        'coupon_code', 'provider_order_id',
    )
    date_hierarchy = 'created_at'
    inlines = [OrderItemInline, PaymentAttemptInline]
    actions = ['action_confirm', 'action_fail', 'action_cancel']

    readonly_fields = (
        'order_number', 'user', 'subtotal', 'discount_amount', 'discount_type',
        'shipping_amount', 'total', 'discount', 'coupon', 'coupon_code',
        'payment_id', 'provider_order_id', 'payment_status', 'paid',
        'payment_failure_reason', 'stock_decremented', 'stock_restored',
        'cart_cleared_at', 'confirmation_email_sent_at', 'purchase_tracked_at',
        'idempotency_key', 'created_at', 'updated_at', 'derived_status',
    )
    fieldsets = (
        (None, {'fields': ('order_number', 'user', 'derived_status', 'created_at')}),
        ('Payment', {
            'fields': (
                'payment_status', 'payment_method', 'paid', 'payment_failure_reason',
                'payment_id', 'provider_order_id',
            ),
            'description': 'Read-only. Use the list actions (Confirm / Fail / Cancel) '
                           'so stock, the cart, the coupon and the confirmation email '
                           'stay consistent with the state.',
        }),
        ('Money', {
            'fields': (
                'subtotal', 'discount_amount', 'discount_type', 'shipping_amount',
                'total', 'coupon', 'coupon_code', 'discount',
            ),
        }),
        ('Side-effect latches', {
            'classes': ('collapse',),
            'fields': (
                'stock_decremented', 'stock_restored', 'cart_cleared_at',
                'confirmation_email_sent_at', 'purchase_tracked_at', 'idempotency_key',
            ),
            'description': 'Each records that one side effect has already happened. '
                           'They are what make a replayed gateway callback harmless.',
        }),
        ('Shipping address', {
            'fields': (
                'first_name', 'last_name', 'email', 'phone', 'address', 'city',
                'state', 'pincode',
            ),
        }),
        ('Operations', {'fields': ('needs_manual_review', 'review_note')}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'coupon')

    @admin.display(description='Status')
    def derived_status(self, obj):
        return obj.status

    @admin.action(description='Confirm payment (decrements stock, clears cart, emails)')
    def action_confirm(self, request, queryset):
        done = skipped = 0
        for order in queryset:
            outcome = services.confirm_order(order.id, source='admin')
            done += 1 if outcome['changed'] else 0
            skipped += 0 if outcome['changed'] else 1
        self.message_user(
            request,
            f'Confirmed {done} order(s); {skipped} were already in a terminal state.',
            messages.SUCCESS if done else messages.WARNING,
        )

    @admin.action(description='Mark payment failed (restores stock if it was taken)')
    def action_fail(self, request, queryset):
        done = skipped = 0
        for order in queryset:
            outcome = services.fail_order(
                order.id, reason='Marked failed by an administrator.', source='admin'
            )
            done += 1 if outcome['changed'] else 0
            skipped += 0 if outcome['changed'] else 1
        self.message_user(
            request,
            f'Failed {done} order(s); {skipped} unchanged.',
            messages.SUCCESS if done else messages.WARNING,
        )

    @admin.action(description='Cancel (restores stock if taken, releases the coupon)')
    def action_cancel(self, request, queryset):
        done = skipped = 0
        for order in queryset:
            outcome = services.cancel_order(
                order.id, reason='Cancelled by an administrator.', source='admin'
            )
            done += 1 if outcome['changed'] else 0
            skipped += 0 if outcome['changed'] else 1
        self.message_user(
            request,
            f'Cancelled {done} order(s); {skipped} were already terminal.',
            messages.SUCCESS if done else messages.WARNING,
        )


@admin.register(PaymentAttempt)
class PaymentAttemptAdmin(admin.ModelAdmin):
    list_display = (
        'merchant_order_id', 'order', 'state', 'amount', 'provider_payment_id',
        'created_at',
    )
    list_filter = ('state', 'created_at')
    search_fields = ('merchant_order_id', 'provider_payment_id', 'order__order_number')
    readonly_fields = [f.name for f in PaymentAttempt._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ProcessedCallback)
class ProcessedCallbackAdmin(admin.ModelAdmin):
    """The replay ledger. Deleting a row here re-arms a replay - so, read-only."""

    list_display = ('event_key', 'order', 'received_at')
    search_fields = ('event_key', 'order__order_number')
    readonly_fields = [f.name for f in ProcessedCallback._meta.fields]
    date_hierarchy = 'received_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
