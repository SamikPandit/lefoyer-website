from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import Claim, HomeSection, PolicySetting, SiteSetting, SupportRequest


class SingletonAdmin(admin.ModelAdmin):
    """A singleton has nothing to list and nothing to add or delete."""

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        from django.shortcuts import redirect
        from django.urls import reverse

        obj = self.model.load()
        return redirect(
            reverse(
                f'admin:{self.model._meta.app_label}_'
                f'{self.model._meta.model_name}_change',
                args=[obj.pk],
            )
        )


@admin.register(SiteSetting)
class SiteSettingAdmin(SingletonAdmin):
    fieldsets = (
        ('Brand', {
            'fields': ('brand_name', 'tagline', 'positioning_statement'),
            'description': (
                "Every surface — hero, navbar, footer, About, transactional "
                "email — reads these values. No claim belongs here; claims go "
                "in the Claims register so they carry their evidence."
            ),
        }),
        ('Support contact', {
            'fields': ('support_email', 'support_phone', 'whatsapp', 'hours'),
            'description': (
                "Leave a field blank unless the channel is real and staffed. "
                "A blank field is not rendered anywhere; an aspirational phone "
                "number is a support failure."
            ),
        }),
        ('Social', {'fields': ('instagram_url',)}),
    )
    readonly_fields = ['updated_at']


@admin.register(PolicySetting)
class PolicySettingAdmin(SingletonAdmin):
    fieldsets = (
        ('Delivery', {
            'fields': (
                'delivery_window_min_days',
                'delivery_window_max_days',
                'free_shipping_threshold',
                'shipping_charge',
                'cod_available',
            ),
            'description': (
                "Leave 'free shipping threshold' empty to mean free delivery "
                "on every order. COD availability for a given address still "
                "comes from the per-pincode serviceability check."
            ),
        }),
        ('Returns & refunds', {
            'fields': (
                'return_window_days',
                'return_window_from',
                'refund_days',
                'return_exclusions',
            ),
            'description': (
                "These numbers are the single source for the PDP, the cart, "
                "the FAQ and /shipping-returns. Changing one changes all of "
                "them, which is the point."
            ),
        }),
    )
    readonly_fields = ['updated_at']


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    """The claims register. Unevidenced rows are the ones that matter here."""

    list_display = ['label', 'evidence_state', 'footnote', 'display_order']
    list_editable = ['display_order']
    list_filter = ['is_substantiated']
    search_fields = ['label', 'footnote', 'notes']
    ordering = ['is_substantiated', 'display_order', 'label']
    fields = [
        'label',
        'is_substantiated',
        'footnote',
        'evidence_url',
        'display_order',
        'notes',
    ]
    actions = ['mark_unsubstantiated']

    @admin.display(description='Evidence', ordering='is_substantiated')
    def evidence_state(self, obj):
        if obj.is_substantiated:
            return format_html(
                '<b style="color:#1b7f4b;">Evidenced</b>'
            )
        return format_html(
            '<b style="color:#b3261e;">NOT SUBSTANTIATED &mdash; not served</b>'
        )

    @admin.action(description="Withdraw: mark as not substantiated")
    def mark_unsubstantiated(self, request, queryset):
        updated = queryset.update(is_substantiated=False)
        self.message_user(
            request,
            f"{updated} claim(s) withdrawn. They stop being served immediately "
            f"(allow up to 5 minutes for the public cache to expire).",
        )


@admin.register(HomeSection)
class HomeSectionAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'kind',
        'display_order',
        'is_active',
        'starts_at',
        'ends_at',
        'live_now',
    ]
    list_editable = ['display_order', 'is_active']
    list_filter = ['kind', 'is_active']
    search_fields = ['title', 'subtitle', 'body']
    filter_horizontal = ['products']
    fieldsets = (
        ('What it is', {'fields': ('kind', 'display_order', 'is_active')}),
        ('Copy', {'fields': ('title', 'subtitle', 'body', 'image')}),
        ('Call to action', {'fields': ('cta_label', 'cta_target')}),
        ('Date window', {
            'fields': ('starts_at', 'ends_at'),
            'description': (
                "Leave 'starts at' blank for live immediately and 'ends at' "
                "blank for no end date. A section outside its window is not "
                "served at all, so a seasonal banner retires itself with no "
                "deploy."
            ),
        }),
        ('Products', {'fields': ('products',)}),
    )
    readonly_fields = []

    @admin.display(boolean=True, description='Live now')
    def live_now(self, obj):
        return obj.is_active and obj.is_in_window


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    list_display = [
        'ticket_ref',
        'created_at',
        'topic',
        'name',
        'email',
        'order',
        'handled_at',
    ]
    list_filter = ['topic', 'created_at', 'handled_at']
    search_fields = ['ticket_ref', 'name', 'email', 'message', 'order_reference']
    date_hierarchy = 'created_at'
    readonly_fields = [
        'ticket_ref',
        'name',
        'email',
        'order',
        'order_reference',
        'topic',
        'message',
        'created_at',
    ]
    fields = readonly_fields + ['handled_at', 'handled_note']
    actions = ['mark_handled', 'mark_unhandled']

    def has_add_permission(self, request):
        # Tickets arrive from /contact, not from the admin.
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.action(description="Mark as handled (stamps the time)")
    def mark_handled(self, request, queryset):
        updated = queryset.filter(handled_at__isnull=True).update(
            handled_at=timezone.now()
        )
        self.message_user(request, f"{updated} request(s) marked handled.")

    @admin.action(description="Re-open: clear the handled stamp")
    def mark_unhandled(self, request, queryset):
        updated = queryset.update(handled_at=None)
        self.message_user(request, f"{updated} request(s) re-opened.")
