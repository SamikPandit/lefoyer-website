"""The taxonomy models and the back-in-stock waiting list.

IMPL_SPEC §2c, `products` 0007. Still structural only: the rows that fill
`Concern` and `SkinType` arrive in 0008, which derives them from catalogue
evidence rather than from anybody's wish list.

`StockNotification.product` is `PROTECT`, not `CASCADE`: each row is a consent
record carrying the timestamp at which a customer agreed to be emailed, so a
product delete must fail loudly instead of discarding the evidence.
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0006_product_merchandising_and_flags'),
    ]

    operations = [
        migrations.CreateModel(
            name='Concern',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('slug', models.SlugField(unique=True)),
                ('description', models.TextField(blank=True, default='')),
                ('icon_key', models.CharField(blank=True, default='', help_text='A key the frontend maps to an icon. Not a file path.', max_length=50)),
                ('display_order', models.PositiveIntegerField(default=0)),
            ],
            options={
                'ordering': ['display_order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='SkinType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('slug', models.SlugField(unique=True)),
                ('display_order', models.PositiveIntegerField(default=0)),
            ],
            options={
                'ordering': ['display_order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='StockNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('consent_at', models.DateTimeField(help_text="When the customer ticked the consent box. Not the row's creation time — this is the evidence of consent.")),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('notified_at', models.DateTimeField(blank=True, help_text='Set when the back-in-stock mail goes out. Null = still waiting.', null=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='stocknotification',
            name='product',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='stock_notifications', to='products.product'),
        ),
        migrations.AddField(
            model_name='product',
            name='concerns',
            field=models.ManyToManyField(blank=True, related_name='products', to='products.concern'),
        ),
        migrations.AddField(
            model_name='product',
            name='skin_types',
            field=models.ManyToManyField(blank=True, related_name='products', to='products.skintype'),
        ),
        migrations.AlterUniqueTogether(
            name='stocknotification',
            unique_together={('product', 'email')},
        ),
    ]
