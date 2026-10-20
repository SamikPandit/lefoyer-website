import csv

from django.contrib import admin
from django.http import HttpResponse
from django.utils import timezone

from .models import Subscriber


@admin.register(Subscriber)
class SubscriberAdmin(admin.ModelAdmin):
    list_display = ['email', 'source', 'is_confirmed', 'consent_at', 'created_at']
    list_filter = ['source', 'is_confirmed', 'created_at']
    search_fields = ['email']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['unsubscribe_token', 'created_at', 'consent_at', 'ip', 'utm']
    actions = ['export_as_csv']

    @admin.action(description="Export selected subscribers as CSV")
    def export_as_csv(self, request, queryset):
        """The list is only useful if it can leave the admin."""
        stamp = timezone.now().strftime('%Y%m%d-%H%M')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="lefoyer-newsletter-{stamp}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow([
            'email', 'source', 'is_confirmed', 'consent_at', 'ip',
            'utm', 'unsubscribe_token', 'created_at',
        ])
        for subscriber in queryset.iterator():
            writer.writerow([
                subscriber.email,
                subscriber.source,
                subscriber.is_confirmed,
                subscriber.consent_at.isoformat() if subscriber.consent_at else '',
                subscriber.ip or '',
                subscriber.utm or {},
                subscriber.unsubscribe_token,
                subscriber.created_at.isoformat() if subscriber.created_at else '',
            ])
        return response
