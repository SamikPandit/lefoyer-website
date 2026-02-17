from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class SubCategory(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    category = models.ForeignKey(Category, related_name='sub_categories', on_delete=models.CASCADE)

    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    sub_category = models.ForeignKey(SubCategory, related_name='products', on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    description = models.TextField()
    key_benefits = models.TextField()
    key_features = models.TextField()
    ingredients = models.TextField()
    how_to_use = models.TextField()
    suitable_for = models.CharField(max_length=255)
    size = models.CharField(max_length=50)
    sku = models.CharField(max_length=100, unique=True)
    stock_quantity = models.IntegerField()
    is_featured = models.BooleanField(default=False)
    is_bestseller = models.BooleanField(default=False)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    reviews_count = models.IntegerField(default=0)
    image_main = models.ImageField(upload_to='products/')
    image_2 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_3 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_4 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_5 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_6 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_7 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_8 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_9 = models.ImageField(upload_to='products/', blank=True, null=True)
    image_10 = models.ImageField(upload_to='products/', blank=True, null=True)
    amazon_link = models.URLField(max_length=500, blank=True, null=True, help_text="Optional Amazon product link")
    manual_out_of_stock = models.BooleanField(default=False, help_text="Manually mark product as out of stock regardless of quantity")
    show_at_website = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
