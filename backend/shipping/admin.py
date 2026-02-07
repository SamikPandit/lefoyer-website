from django.contrib import admin
from django.utils.html import format_html
from .models import Shipment, TrackingEvent


class TrackingEventInline(admin.TabularInline):
    """Inline display  of tracking events within Shipment admin"""
    model = TrackingEvent
    extra = 0
    readonly_fields = ('scan_date', 'scan_code', 'scan_description', 'scanned_location', 'instructions', 'created_at')
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    """Admin interface for Shipment model"""
   
    list_display = (
        'awb_number',
        'order_link',
        'customer_name',
        'destination_pincode',
        'status_badge',
        'created_at',
        'delivered_at'
    )
    
    list_filter = ('status', 'created_at', 'shipped_at', 'delivered_at', 'product_code', 'sub_product_code')
    
    search_fields = ('awb_number', 'order__id', 'order__first_name', 'order__last_name', 'order__email', 'destination_pincode')
    
    readonly_fields = (
        'created_at',
        'updated_at',
        'order',
        'awb_number',
        'destination_area',
        'shipped_at',
        'delivered_at',
        'last_error'
    )
    
    fieldsets = (
        ('Order Information', {
            'fields': ('order', 'created_at', 'updated_at')
        }),
        ('Shipment Details', {
            'fields': (
                'awb_number',
                'pickup_token',
                'status',
                'expected_delivery_date',
                'shipped_at',
                'delivered_at',
                'label_pdf'
            )
        }),
        ('Blue Dart Configuration', {
            'fields': (
                'product_code',
                'sub_product_code',
                'origin_area',
                'destination_area',
                'destination_pincode'
            ),
            'classes': ('collapse',)
        }),
        ('Physical Details', {
            'fields': (
                'weight_kg',
                'declared_value',
                'collectible_amount'
            ),
            'classes': ('collapse',)
        }),
        ('Error Tracking', {
            'fields': ('last_error',),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [TrackingEventInline]
    
    def order_link(self, obj):
        """Clickable link to order"""
        if obj.order:
            from django.urls import reverse
            from django.utils.html import format_html
            url = reverse('admin:orders_order_change', args=[obj.order.id])
            return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)
        return '-'
    order_link.short_description = 'Order'
    
    def customer_name(self, obj):
        """Display customer name"""
        if obj.order:
            return f"{obj.order.first_name} {obj.order.last_name}"
        return '-'
    customer_name.short_description = 'Customer'
    
    def status_badge(self, obj):
        """Display status with color"""
        color = obj.get_status_display_color()
        color_map = {
            'green': '#28a745',
            'blue': '#007bff',
            'cyan': '#17a2b8',
            'orange': '#fd7e14',
            'red': '#dc3545',
            'gray': '#6c757d',
        }
        bg_color = color_map.get(color, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 11px;">{}</span>',
            bg_color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    # Admin actions
    actions = ['download_labels_as_zip', 'trigger_pickup']
    
    def download_labels_as_zip(self, request, queryset):
        """Download selected shipment labels as a ZIP file"""
        import zipfile
        from django.http import HttpResponse
        from io import BytesIO
        
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for shipment in queryset:
                if shipment.label_pdf:
                    try:
                        label_content = shipment.label_pdf.read()
                        zip_file.writestr(f"label_{shipment.awb_number}.pdf", label_content)
                    except Exception as e:
                        self.message_user(request, f"Error reading label for {shipment.awb_number}: {e}", level='warning')
        
        response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename=shipping_labels.zip'
        return response
    
    download_labels_as_zip.short_description = "Download selected labels as ZIP"
    
    def trigger_pickup(self, request, queryset):
        """Trigger pickup registration for selected shipments"""
        from .tasks import register_shipment_pickup
        
        shipment_ids = list(queryset.values_list('id', flat=True))
        register_shipment_pickup.delay(shipment_ids)
        
        self.message_user(request, f"Pickup registration triggered for {len(shipment_ids)} shipments.")
    
    trigger_pickup.short_description = "Trigger pickup for selected shipments"


@admin.register(TrackingEvent)
class TrackingEventAdmin(admin.ModelAdmin):
    """Admin interface for TrackingEvent model"""
    
    list_display = ('shipment', 'scan_date', 'scan_description', 'scanned_location')
    list_filter = ('scan_date', 'scanned_location')
    search_fields = ('shipment__awb_number', 'scan_description', 'scanned_location')
    readonly_fields = ('shipment', 'scan_date', 'scan_code', 'scan_description', 'scanned_location', 'instructions', 'created_at')
    
    def has_add_permission(self, request):
        return False
