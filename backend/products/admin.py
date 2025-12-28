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

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'category', 'sub_category', 'price', 'stock_quantity', 'is_featured', 'show_at_website')
    list_filter = ('category', 'sub_category', 'is_featured', 'show_at_website')
    list_editable = ('price', 'stock_quantity', 'is_featured', 'show_at_website')
    prepopulated_fields = {'slug': ('name',)}
