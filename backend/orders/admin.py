from django.contrib import admin
from .models import Order, OrderItem

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    raw_id_fields = ['product']
    readonly_fields = ['product', 'price', 'quantity']
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'first_name', 'last_name', 'email', 'total', 'discount',
                    'payment_method', 'payment_status', 'paid', 'created_at')
    list_filter = ('paid', 'payment_status', 'payment_method', 'created_at')
    search_fields = ('first_name', 'last_name', 'email', 'phone', 'id')
    readonly_fields = ('user', 'total', 'discount', 'coupon', 'payment_id', 'provider_order_id', 'created_at', 'updated_at')
    inlines = [OrderItemInline]
