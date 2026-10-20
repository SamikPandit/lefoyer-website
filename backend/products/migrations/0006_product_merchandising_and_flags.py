"""Merchandising fields, launch flags, and a deterministic product order.

IMPL_SPEC §2c, `products` 0006. Purely additive — every column has a default,
so there is no data step and nothing to back out.

The one operation here that is a bug fix rather than a feature is
`AlterModelOptions` on `product`: `Product` had no `Meta.ordering`, and the
product list is globally paginated. Paginating an unordered queryset lets the
database return a row on page 1 and again on page 2 while dropping another
entirely — which is exactly what the live catalogue does today (§1 C-17).
`['display_order', '-created_at']` makes the order total and merchandiser-
controlled.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0005_product_manual_out_of_stock'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='category',
            options={'ordering': ['display_order', 'name'], 'verbose_name_plural': 'categories'},
        ),
        migrations.AlterModelOptions(
            name='product',
            options={'ordering': ['display_order', '-created_at']},
        ),
        migrations.AlterModelOptions(
            name='subcategory',
            options={'ordering': ['display_order', 'name'], 'verbose_name_plural': 'sub categories'},
        ),
        migrations.AddField(
            model_name='category',
            name='display_order',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='category',
            name='image',
            field=models.ImageField(blank=True, null=True, upload_to='categories/'),
        ),
        migrations.AddField(
            model_name='subcategory',
            name='display_order',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='product',
            name='brand',
            field=models.CharField(default='Le foyeR.', max_length=100),
        ),
        migrations.AddField(
            model_name='product',
            name='coming_soon',
            field=models.BooleanField(default=False, help_text='Announced but not yet purchasable. Never sellable, whatever the stock level says.'),
        ),
        migrations.AddField(
            model_name='product',
            name='display_order',
            field=models.PositiveIntegerField(db_index=True, default=0, help_text='Merchandising order, ascending. Lower sorts first. Changing it reorders the homepage rails with no deploy.'),
        ),
        migrations.AddField(
            model_name='product',
            name='is_new',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='product',
            name='suitable_for',
            field=models.CharField(help_text='Human-readable suitability line. Filtering uses the skin_types M2M, not this string.', max_length=255),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['is_featured', 'display_order'], name='prod_feat_order_idx'),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['stock_quantity'], name='prod_stock_idx'),
        ),
    ]
