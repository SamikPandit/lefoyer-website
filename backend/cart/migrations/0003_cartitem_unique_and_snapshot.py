"""One cart line per product, plus when it was added.

`unique_together('cart', 'product')` is the real fix. `cart/views.py::add`
already tried to behave as if the constraint existed - it looked for an
existing line with `.filter(...).first()` and topped up its quantity - but
nothing stopped two concurrent adds from both missing and both inserting. A cart
with two lines for the same product then showed the wrong subtotal, and
`update_item` could only ever edit one of them.

The de-dup step runs first and MERGES quantities rather than discarding rows, so
no customer loses something they put in their basket. It prints what it merged;
per §5.2 this must be dry-run against a production dump before it is run for
real.
"""

from django.db import migrations, models


def dedupe_cart_items(apps, schema_editor):
    CartItem = apps.get_model('cart', 'CartItem')

    seen = {}
    duplicates = []
    for item in CartItem.objects.order_by('cart_id', 'product_id', 'id').iterator():
        key = (item.cart_id, item.product_id)
        if key in seen:
            duplicates.append((key, seen[key], item.id, item.quantity))
        else:
            seen[key] = item.id

    if not duplicates:
        print('  cart.0003: no duplicate cart lines found; nothing to merge.')
        return

    merged = 0
    for key, keeper_id, loser_id, quantity in duplicates:
        keeper = CartItem.objects.filter(pk=keeper_id).first()
        if keeper is None:  # pragma: no cover - defensive
            continue
        keeper.quantity = (keeper.quantity or 0) + (quantity or 0)
        keeper.save(update_fields=['quantity'])
        CartItem.objects.filter(pk=loser_id).delete()
        merged += 1
        print(
            f'  cart.0003: merged cart {key[0]} product {key[1]}: '
            f'+{quantity} into line {keeper_id}, deleted line {loser_id}.'
        )
    print(f'  cart.0003: merged {merged} duplicate cart line(s).')


def noop_reverse(apps, schema_editor):
    """Merged quantities cannot be unmerged; reversing only drops the constraint."""
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('cart', '0002_alter_cart_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='cartitem',
            name='added_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.RunPython(dedupe_cart_items, noop_reverse),
        migrations.AlterUniqueTogether(
            name='cartitem',
            unique_together={('cart', 'product')},
        ),
        migrations.AlterModelOptions(
            name='cartitem',
            options={'ordering': ('id',)},
        ),
    ]
