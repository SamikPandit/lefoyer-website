"""
Reviews app configuration.

`ready()` is where the rating-cache receivers are registered (IMPL_SPEC §2e
mechanism 2). Registering here rather than at import time in `models.py` means
the receivers are connected exactly once, by the app registry, with a
`dispatch_uid` — so a re-import under the autoreloader or in a test runner
cannot double-connect them and double-count nothing.
"""

from django.apps import AppConfig


class ReviewsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reviews'
    verbose_name = 'Reviews & ratings'

    def ready(self):
        from . import signals

        signals.register_receivers()
