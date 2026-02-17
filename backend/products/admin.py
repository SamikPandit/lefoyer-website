from django.contrib import admin
from .models import Product, Category, SubCategory

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category')
    prepopulated_fields = {'slug': ('name',)}

@admin.action(description='Mark selected products as Out of Stock')
def mark_out_of_stock(modeladmin, request, queryset):
    queryset.update(manual_out_of_stock=True)

@admin.action(description='Mark selected products as In Stock')
def mark_in_stock(modeladmin, request, queryset):
    queryset.update(manual_out_of_stock=False)

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'stock_quantity', 'manual_out_of_stock', 'is_featured', 'is_bestseller', 'show_at_website')
    list_filter = ('category', 'is_featured', 'is_bestseller', 'show_at_website', 'manual_out_of_stock')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ('price', 'stock_quantity', 'manual_out_of_stock', 'is_featured', 'show_at_website')
    actions = [mark_out_of_stock, mark_in_stock]
