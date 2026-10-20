"""
Review moderation (IMPL_SPEC §3 WP-03).

Changes from the previous admin:

* `user` is **out** of `list_filter`. A `ForeignKey` in `list_filter` renders a
  `<select>` containing every row of the target table — i.e. the whole user
  list, every email address, on one page.
* `is_approved` and `is_verified_purchase` are visible and filterable, because
  moderation is the only lever over what the storefront averages.
* `is_approved` is in `list_editable` plus two bulk actions, so hiding a batch
  of reviews does not mean opening twenty change forms.
"""

from django.contrib import admin, messages

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'product',
        'author_label',
        'rating',
        'title',
        'is_approved',
        'is_verified_purchase',
        'created_at',
    )
    list_display_links = ('id', 'product')
    list_editable = ('is_approved',)
    list_filter = ('is_approved', 'is_verified_purchase', 'rating', 'created_at', 'product')
    search_fields = ('title', 'comment', 'product__name', 'product__sku', 'user__email')
    raw_id_fields = ('user', 'product', 'order_item')
    readonly_fields = ('created_at', 'is_verified_purchase', 'order_item')
    date_hierarchy = 'created_at'
    list_select_related = ('product', 'user')
    actions = ('approve_reviews', 'unapprove_reviews')
    fields = (
        'product',
        'user',
        'rating',
        'title',
        'comment',
        'is_approved',
        'is_verified_purchase',
        'order_item',
        'created_at',
    )

    @admin.display(description='Author', ordering='user__email')
    def author_label(self, obj):
        """
        The storefront byline, so a moderator sees what the customer sees. The
        underlying account is one click away on the change form; it is not
        printed in the changelist.
        """
        from .serializers import author_display_name

        return author_display_name(obj.user)

    @admin.action(description='Approve selected reviews (show on the storefront)')
    def approve_reviews(self, request, queryset):
        self._set_approval(request, queryset, True)

    @admin.action(description='Unapprove selected reviews (hide from the storefront)')
    def unapprove_reviews(self, request, queryset):
        self._set_approval(request, queryset, False)

    def _set_approval(self, request, queryset, approved):
        """
        Saved row by row on purpose. A bulk `queryset.update()` does not fire
        `post_save`, so `Product.rating` / `reviews_count` would silently keep
        counting reviews that are no longer shown.
        """
        changed = 0
        for review in queryset.exclude(is_approved=approved):
            review.is_approved = approved
            review.save(update_fields=['is_approved'])
            changed += 1
        self.message_user(
            request,
            f'{changed} review(s) {"approved" if approved else "unapproved"}. '
            'Product ratings were recomputed.',
            messages.SUCCESS if changed else messages.INFO,
        )
