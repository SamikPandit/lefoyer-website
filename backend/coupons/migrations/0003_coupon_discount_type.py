"""Coupon money model: PERCENT / FIXED, with a rupee cap.

`discount_value` is backfilled from the deprecated `discount` percentage column
so every existing coupon keeps working with identical arithmetic: the old column
was a percentage, every historic coupon is therefore PERCENT, and copying the
integer across is lossless.

`active` gains `default=False`. This changes no stored row - it only means
`Coupon()` stops raising in a shell, and a half-configured coupon is inert until
someone ticks the box.
"""

import decimal

import django.core.validators
from django.db import migrations, models


def backfill_discount_value(apps, schema_editor):
    """Copy the legacy integer percentage into `discount_value`.

    Every pre-existing coupon is a percentage coupon - the column only ever held
    a percentage - so `discount_type` keeps its PERCENT default and no row needs
    inspecting. Logged with a count so the operator can reconcile it against the
    production table rather than taking it on trust.
    """
    Coupon = apps.get_model('coupons', 'Coupon')
    updated = 0
    for coupon in Coupon.objects.all().iterator():
        coupon.discount_value = decimal.Decimal(coupon.discount or 0)
        coupon.discount_type = 'PERCENT'
        coupon.save(update_fields=['discount_value', 'discount_type'])
        updated += 1
    if updated:
        print(
            f'  coupons.0003: copied the legacy percentage into discount_value '
            f'for {updated} coupon(s); all were typed PERCENT.'
        )


def noop_reverse(apps, schema_editor):
    """Reversing drops the new columns; `discount` still holds the percentage."""
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('coupons', '0002_coupon_max_uses_coupon_min_order_amount_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='coupon',
            name='discount_type',
            field=models.CharField(
                choices=[('PERCENT', 'Percentage off'), ('FIXED', 'Fixed amount off')],
                default='PERCENT',
                help_text="PERCENT applies 'discount value' as a percentage of the "
                          "order subtotal. FIXED takes 'discount value' rupees off.",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='coupon',
            name='discount_value',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Percent (0-100) when type is PERCENT, rupees when FIXED.',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(decimal.Decimal('0'))],
            ),
        ),
        migrations.AddField(
            model_name='coupon',
            name='max_discount_amount',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Optional rupee cap for a PERCENT coupon. Blank = uncapped. '
                          'Ignored for FIXED coupons.',
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='coupon',
            name='active',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='coupon',
            name='discount',
            field=models.IntegerField(
                default=0,
                help_text="DEPRECATED - legacy percentage column. Edit 'discount value' instead.",
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(100),
                ],
            ),
        ),
        migrations.AlterField(
            model_name='coupon',
            name='min_order_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Minimum order subtotal (before discount) to apply coupon',
                max_digits=10,
            ),
        ),
        migrations.AlterModelOptions(
            name='coupon',
            options={'ordering': ['-valid_to', 'code']},
        ),
        migrations.RunPython(backfill_discount_value, noop_reverse),
    ]
