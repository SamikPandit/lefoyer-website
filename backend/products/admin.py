"""Catalogue admin.

The admin is now the **only** write surface for the catalogue (the DRF
viewsets are read-only), so two things matter here.

**`rating` and `reviews_count` are read-only.** Until this change-set they had
no writer anywhere in the codebase except this change form (IMPL_SPEC §1 C-9):
a human typing a number into a text box was the sole source of every star on
the storefront. They are a cache of `reviews.Review` now (§2e mechanism 2),
recomputed by a signal and by `manage.py recompute_product_ratings`, so a
hand-typed value would be silently overwritten by the next review — worse than
being rejected.

**`display_order` is editable from the list page.** It is what reorders the
homepage rails without a deploy (LF-20), so it has to be adjustable in bulk,
next to `is_featured`, rather than one product at a time.
"""

import csv

from django.contrib import admin
from django.http import HttpResponse

from .models import Category, Concern, Product, SkinType, StockNotification, SubCategory


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'display_order', 'sellable_product_count')
    list_editable = ('display_order',)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('display_order', 'name')

    @admin.display(description='Sellable products')
    def sellable_product_count(self, obj):
        from .models import sellable_q

        return obj.products.filter(sellable_q(), show_at_website=True).count()


@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'display_order')
    list_editable = ('display_order',)
    list_filter = ('category',)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('display_order', 'name')


@admin.register(Concern)
class ConcernAdmin(admin.ModelAdmin):
    """Shop-by-concern facets.

    Only add a row here when the catalogue can actually fill it: the
    storefront renders a concern tile only when its `product_count` is above
    zero, so an aspirational concern is an invisible row, and a concern with
    one unsellable product is a dead link waiting for a restock.
    """

    list_display = ('name', 'slug', 'display_order', 'icon_key', 'product_count')
    list_editable = ('display_order', 'icon_key')
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('display_order', 'name')

    @admin.display(description='Products')
    def product_count(self, obj):
        return obj.products.count()


@admin.register(SkinType)
class SkinTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'display_order', 'product_count')
    list_editable = ('display_order',)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('display_order', 'name')

    @admin.display(description='Products')
    def product_count(self, obj):
        return obj.products.count()


@admin.action(description='Mark selected products as Out of Stock')
def mark_out_of_stock(modeladmin, request, queryset):
    queryset.update(manual_out_of_stock=True)


@admin.action(description='Mark selected products as In Stock')
def mark_in_stock(modeladmin, request, queryset):
    queryset.update(manual_out_of_stock=False)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'category', 'price', 'stock_quantity', 'display_order',
        'manual_out_of_stock', 'coming_soon', 'is_new', 'is_featured',
        'is_bestseller', 'show_at_website', 'sellable',
    )
    list_filter = (
        'category', 'sub_category', 'is_featured', 'is_bestseller', 'is_new',
        'coming_soon', 'show_at_website', 'manual_out_of_stock',
        'concerns', 'skin_types',
    )
    search_fields = ('name', 'sku', 'description')
    prepopulated_fields = {'slug': ('name',)}
    list_editable = (
        'price', 'stock_quantity', 'display_order', 'manual_out_of_stock',
        'coming_soon', 'is_new', 'is_featured', 'is_bestseller', 'show_at_website',
    )
    filter_horizontal = ('concerns', 'skin_types')
    # §2e mechanism 2. See the module docstring: these are a cache, not a field.
    readonly_fields = ('rating', 'reviews_count', 'created_at', 'updated_at')
    actions = [mark_out_of_stock, mark_in_stock]
    list_select_related = ('category', 'sub_category')

    @admin.display(boolean=True, description='Sellable')
    def sellable(self, obj):
        """The one availability answer, straight from §2d.

        Shown because the four columns that feed it (`show_at_website`,
        `manual_out_of_stock`, `coming_soon`, `stock_quantity`) can disagree,
        and this is the value the storefront acts on.
        """
        return obj.is_sellable


@admin.action(description='Export selected requests to CSV')
def export_stock_notifications_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="stock-notifications.csv"'
    writer = csv.writer(response)
    writer.writerow(['product', 'sku', 'email', 'consent_at', 'created_at', 'notified_at'])
    for row in queryset.select_related('product'):
        writer.writerow([
            row.product.name,
            row.product.sku,
            row.email,
            row.consent_at.isoformat() if row.consent_at else '',
            row.created_at.isoformat() if row.created_at else '',
            row.notified_at.isoformat() if row.notified_at else '',
        ])
    return response


@admin.register(StockNotification)
class StockNotificationAdmin(admin.ModelAdmin):
    """Back-in-stock waiting lists.

    Each row is a consent record with a timestamp, so nothing here is
    editable: export it, mail the list, and let the send stamp `notified_at`.
    """

    list_display = ('email', 'product', 'consent_at', 'created_at', 'notified_at')
    list_filter = ('product', 'notified_at')
    search_fields = ('email', 'product__name', 'product__sku')
    readonly_fields = ('product', 'email', 'consent_at', 'created_at', 'notified_at')
    actions = [export_stock_notifications_csv]
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False
