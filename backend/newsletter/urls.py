from django.urls import path

from .views import NewsletterSubscribeView

app_name = 'newsletter'

urlpatterns = [
    # Mounted at api/newsletter/ in lefoyer/urls.py → /api/newsletter/subscribe/
    path('subscribe/', NewsletterSubscribeView.as_view(), name='subscribe'),
]
