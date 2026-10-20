"""PaymentAttempt, ProcessedCallback, and order_number tightened to NOT NULL.

`PaymentAttempt` exists so a retry is a new row rather than an overwrite of
`Order.provider_order_id`: a late callback for an abandoned first attempt is
still resolvable to the order it belonged to.

`ProcessedCallback` exists because PhonePe retries callbacks. Without it a
replayed failure callback restored stock a second time - inflating inventory -
and a replayed success sent a second confirmation email.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_order_money_and_state_machine'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='order_number',
            field=models.CharField(
                help_text='Customer-facing reference, e.g. LF000123. Assigned on save.',
                max_length=24,
                unique=True,
            ),
        ),
        migrations.CreateModel(
            name='PaymentAttempt',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                (
                    'merchant_order_id',
                    models.CharField(
                        db_index=True,
                        help_text='Deterministic: LF-<order id>-<attempt number>.',
                        max_length=64,
                        unique=True,
                    ),
                ),
                ('provider_payment_id', models.CharField(blank=True, default='', max_length=128)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    'state',
                    models.CharField(
                        choices=[
                            ('CREATED', 'Created'),
                            ('PENDING', 'Pending'),
                            ('COMPLETED', 'Completed'),
                            ('FAILED', 'Failed'),
                            ('CANCELLED', 'Cancelled'),
                        ],
                        default='CREATED',
                        max_length=20,
                    ),
                ),
                ('raw_response', models.JSONField(blank=True, default=dict)),
                ('redirect_url', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'order',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='attempts',
                        to='orders.order',
                    ),
                ),
            ],
            options={'ordering': ('-created_at',)},
        ),
        migrations.CreateModel(
            name='ProcessedCallback',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('event_key', models.CharField(db_index=True, max_length=128, unique=True)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('received_at', models.DateTimeField(auto_now_add=True)),
                (
                    'order',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='callbacks',
                        to='orders.order',
                    ),
                ),
            ],
            options={'ordering': ('-received_at',)},
        ),
    ]
