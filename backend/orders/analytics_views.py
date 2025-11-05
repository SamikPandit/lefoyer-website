from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from .models import Order
from django.db.models import Sum, Count

@staff_member_required
def sales_analytics(request):
    total_sales = Order.objects.aggregate(Sum('total'))['total__sum'] or 0
    total_orders = Order.objects.count()

    context = {
        'total_sales': total_sales,
        'total_orders': total_orders,
    }
    return render(request, 'admin/sales_analytics.html', context)
