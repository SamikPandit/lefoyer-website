"""The admin sales panel.

The numbers it printed were wrong in a way that flattered the business: it
aggregated ``Order.objects.aggregate(Sum('total'))`` over **every** order,
including PENDING ones. Under the old checkout an order was created before
PhonePe was contacted, so every abandoned payment - every closed tab - was
counted as revenue. "Total orders" counted them too.

Revenue is now scoped to ``payment_status='COMPLETED'``, which is the only state
in which money is known to have moved. The abandoned and failed counts are
reported separately rather than hidden, because an abandonment rate is
information, not noise.
"""

from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Avg, Count, Sum
from django.shortcuts import render
from django.utils import timezone

from .models import Order


@staff_member_required
def sales_analytics(request):
    completed = Order.objects.filter(payment_status=Order.COMPLETED)

    aggregates = completed.aggregate(
        gross=Sum('subtotal'),
        discounts=Sum('discount_amount'),
        shipping=Sum('shipping_amount'),
        net=Sum('total'),
        average=Avg('total'),
        orders=Count('id'),
    )

    by_state = {
        row['payment_status']: row['count']
        for row in Order.objects.values('payment_status').annotate(count=Count('id'))
    }

    context = {
        # Kept under their original names so the existing template renders, now
        # carrying only money that was actually taken.
        'total_sales': aggregates['net'] or 0,
        'total_orders': aggregates['orders'] or 0,
        # The detail the panel never had.
        'gross_sales': aggregates['gross'] or 0,
        'total_discounts': aggregates['discounts'] or 0,
        'total_shipping': aggregates['shipping'] or 0,
        'average_order_value': aggregates['average'] or 0,
        'orders_by_state': by_state,
        'orders_awaiting_payment': by_state.get(Order.PENDING, 0),
        'orders_failed': by_state.get(Order.FAILED, 0),
        'orders_cancelled': (
            by_state.get(Order.CANCELLED, 0) + by_state.get(Order.EXPIRED, 0)
        ),
        'orders_needing_review': Order.objects.filter(needs_manual_review=True).count(),
        'currency': 'INR',
        'generated_at': timezone.now(),
    }
    return render(request, 'admin/sales_analytics.html', context)
