"""Order money model, the new payment states, and the side-effect latches.

Two backfills here deserve to be read rather than skimmed.

**`subtotal` is NOT reconstructed from `total` and `discount`.** The tempting
formula is ``subtotal = total + round(total * discount / (100 - discount))``.
It is wrong, and quietly so: the old code stored an already-net `total` and a
*rounded* percentage, so the gross is not recoverable - several different
subtotals round to the same net total, and the formula divides by zero at
`discount = 100`. Historic rows therefore get ``subtotal = total`` and
``discount_amount = 0``, which is the honest statement "we know what was
charged and we no longer know what it was discounted from". Every affected
order id is printed so the real figures can be recovered from the payment
gateway's own records if anyone needs them.

**`stock_decremented` is set True for COMPLETED orders only.** The old code
decremented stock at order *creation*, before payment, so a PENDING or FAILED
historic order also took stock. Marking those True as well would be more
literally accurate - but it would also authorise `fail_order`/`cancel_order` to
restore stock for a years-old abandoned order the moment anything touches it,
silently inflating inventory. Leaving them False means the latch declines to
move stock it cannot vouch for. The count of such rows is printed so the
operator can reconcile inventory deliberately instead of having it happen to
them.
"""

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


def forwards(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    OrderItem = apps.get_model('orders', 'OrderItem')

    # Refuse to replay. The money backfill below is an unconditional
    # `Order.objects.all().update(subtotal=F('total'), discount_amount=0, ...)`, so running it a
    # second time on a database that is already past 0005 would overwrite the real subtotal and
    # discount of every live order. The presence of 0006's table is the marker: unlike a row flag
    # it survives SQLite's table-remake, and it cannot exist unless 0005 already completed.
    # If you are genuinely rebuilding and hit this, repair django_migrations rather than editing
    # this guard out.
    if 'orders_paymentattempt' in schema_editor.connection.introspection.table_names():
        raise RuntimeError(
            'orders.0005 is being replayed on a database that has already been past it. '
            'Re-running would rewrite subtotal/discount_amount on live orders. '
            'Repair the django_migrations table instead of re-applying this migration.'
        )

    # ---- order_number -----------------------------------------------------
    numbered = 0
    for pk in Order.objects.filter(order_number__isnull=True).values_list('pk', flat=True):
        Order.objects.filter(pk=pk).update(order_number=f'LF{pk:06d}')
        numbered += 1
    if numbered:
        print(f'  orders.0005: assigned order_number to {numbered} historic order(s).')

    # ---- money ------------------------------------------------------------
    lossy_ids = list(
        Order.objects.exclude(discount=0).order_by('pk').values_list('pk', flat=True)
    )
    Order.objects.all().update(
        subtotal=models.F('total'),
        discount_amount=0,
        discount_type='PERCENT',
        shipping_amount=0,
    )
    if lossy_ids:
        print(
            '  orders.0005: {n} historic order(s) carried a percentage discount whose '
            'gross subtotal is NOT recoverable from a net total plus a rounded '
            'percent. They were backfilled subtotal=total, discount_amount=0. '
            'Order ids: {ids}'.format(n=len(lossy_ids), ids=lossy_ids)
        )

    # ---- coupon_code snapshot --------------------------------------------
    snapshotted = 0
    for order in Order.objects.filter(coupon__isnull=False).select_related('coupon').iterator():
        Order.objects.filter(pk=order.pk).update(coupon_code=order.coupon.code)
        snapshotted += 1
    if snapshotted:
        print(f'  orders.0005: snapshotted coupon_code on {snapshotted} order(s).')

    # ---- stock latch ------------------------------------------------------
    decremented = Order.objects.filter(payment_status='COMPLETED').update(
        stock_decremented=True
    )
    unresolved = Order.objects.filter(
        payment_status__in=['PENDING', 'FAILED']
    ).count()
    if decremented:
        print(
            f'  orders.0005: marked stock_decremented=True on {decremented} '
            f'COMPLETED order(s) - those genuinely took stock.'
        )
    if unresolved:
        print(
            f'  orders.0005: {unresolved} PENDING/FAILED order(s) also took stock under '
            f'the old pre-payment decrement, but are left stock_decremented=False so '
            f'nothing auto-restores inventory for them. Reconcile these by hand.'
        )

    # ---- order line snapshots --------------------------------------------
    snapped = 0
    for item in OrderItem.objects.select_related('product').iterator():
        OrderItem.objects.filter(pk=item.pk).update(
            product_name=getattr(item.product, 'name', '') or '',
            product_sku=getattr(item.product, 'sku', '') or '',
        )
        snapped += 1
    if snapped:
        print(f'  orders.0005: snapshotted name/sku on {snapped} order line(s).')


def backwards(apps, schema_editor):
    """Reversing drops the new columns, so there is nothing to undo."""
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('coupons', '0003_coupon_discount_type'),
        ('orders', '0004_order_payment_method'),
        ('products', '0005_product_manual_out_of_stock'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='order',
            options={'ordering': ('-created_at',)},
        ),
        migrations.AlterModelOptions(
            name='orderitem',
            options={'ordering': ('id',)},
        ),
        # order_number arrives nullable so the backfill below can derive it from
        # the primary key; 0006 tightens it to NOT NULL.
        migrations.AddField(
            model_name='order',
            name='order_number',
            field=models.CharField(
                help_text='Customer-facing reference, e.g. LF000123. Assigned on save.',
                max_length=24,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='subtotal',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='order',
            name='discount_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='order',
            name='discount_type',
            field=models.CharField(
                choices=[('PERCENT', 'Percentage'), ('FIXED', 'Fixed amount')],
                default='PERCENT',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='shipping_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='order',
            name='coupon_code',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Snapshot of the code used. Survives coupon deletion and the '
                          'release of the redemption on a failed order.',
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_failure_reason',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Why the last attempt failed or was cancelled. Shown to the '
                          'customer as context, never as a raw gateway error.',
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='stock_decremented',
            field=models.BooleanField(
                default=False,
                help_text='Inventory has been taken for this order. Set once, inside '
                          'confirm_order.',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='stock_restored',
            field=models.BooleanField(
                default=False,
                help_text='Inventory has been given back. Set once, inside '
                          'fail_order/cancel_order, and only if it was ever taken.',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='cart_cleared_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='confirmation_email_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='purchase_tracked_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the browser fired its single Meta Pixel Purchase event. '
                          'This column, not localStorage, is what makes it exactly-once.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='needs_manual_review',
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text='Something happened that money has already changed hands over '
                          'and software must not paper over. Check the order notes.',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='review_note',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='order',
            name='idempotency_key',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Client-supplied Idempotency-Key from POST /api/orders/, so a '
                          'double-click cannot mint two orders.',
                max_length=64,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='order',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('COMPLETED', 'Completed'),
                    ('FAILED', 'Failed'),
                    ('CANCELLED', 'Cancelled'),
                    ('EXPIRED', 'Expired'),
                    ('REFUNDED', 'Refunded'),
                ],
                db_index=True,
                default='PENDING',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='order',
            name='provider_order_id',
            field=models.CharField(blank=True, db_index=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='order',
            name='discount',
            field=models.IntegerField(
                default=0,
                help_text='DEPRECATED legacy percentage. Read discount_amount instead.',
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(100),
                ],
            ),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='product_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='product_sku',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        # CASCADE -> PROTECT. This is the single change that stops a catalogue
        # delete from erasing order history.
        migrations.AlterField(
            model_name='orderitem',
            name='product',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to='products.product'
            ),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(
                fields=['payment_status', 'created_at'],
                name='orders_orde_payment_e2cb15_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='order',
            index=models.Index(
                fields=['user', '-created_at'], name='orders_orde_user_id_0ae59f_idx'
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
