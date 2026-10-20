from django.urls import path
from django.views.decorators.cache import cache_page

from .views import (
    CONTENT_CACHE_SECONDS,
    HomeSectionsView,
    PolicyView,
    SiteSettingsView,
    SupportContactView,
)

app_name = 'content'

# Mounted at api/content/ in lefoyer/urls.py.
#
# site-settings/ and policy/ are cached for 300s at the view wrapper, so a
# cache hit never reaches DRF dispatch. cache_page keys on the full URL, so the
# ?include_unsubstantiated=true audit view gets its own entry. home-sections/
# is NOT cached: its whole purpose is that a date-window edit takes effect
# immediately.
urlpatterns = [
    path(
        'site-settings/',
        cache_page(CONTENT_CACHE_SECONDS)(SiteSettingsView.as_view()),
        name='site-settings',
    ),
    path(
        'policy/',
        cache_page(CONTENT_CACHE_SECONDS)(PolicyView.as_view()),
        name='policy',
    ),
    path('home-sections/', HomeSectionsView.as_view(), name='home-sections'),
    path('support/contact/', SupportContactView.as_view(), name='support-contact'),
]
