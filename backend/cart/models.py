from django.conf import settings
from django.db import models

from products.models import Product


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Cart for {self.user}'


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    # Nullable because existing rows predate the column; new rows always carry it.
    added_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        # One line per product. `add` already behaved as though this constraint
        # existed (find-then-top-up), but nothing stopped two concurrent adds
        # from both missing and both inserting, leaving a cart that showed the
        # wrong subtotal and that `update_item` could only half-edit.
        unique_together = (('cart', 'product'),)
        ordering = ('id',)

    def __str__(self):
        return f'{self.quantity} x {self.product.name}'
