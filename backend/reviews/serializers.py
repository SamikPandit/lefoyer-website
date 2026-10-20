"""
Review serializers (IMPL_SPEC §2b #11-#13, §2e).

What this file replaces: `fields = '__all__'`, which emitted `user` as a bare
integer primary key — a public user-id leak on an `AllowAny` endpoint — with no
display name at all, while the PDP tried to read `review.user.username`. The
payload below carries `author: {display_name}` and **no user id, no email and
no product id**.
"""

from rest_framework import serializers

from .models import RATING_MAX, RATING_MIN, Review

#: Last-resort author label. Deliberately avoids the word "verified", which on
#: this site means exactly one thing (`is_verified_purchase`) and must never be
#: implied by a fallback string.
ANONYMOUS_AUTHOR = 'Le foyeR. customer'

#: Generous but finite. The model field is a TextField with no ceiling, which on
#: a public POST endpoint is an open invitation.
MAX_COMMENT_LENGTH = 2000


def mask_email_local_part(local_part):
    """
    `samik` -> `S***k`, `jo` -> `J*`, `j` -> `J*`.

    Keeps a review attributable-looking to its own author without printing an
    address. Never returns the raw local part for a short handle.
    """
    local_part = (local_part or '').strip()
    if not local_part:
        return ''
    if len(local_part) == 1:
        return f'{local_part.upper()}*'
    if len(local_part) == 2:
        return f'{local_part[0].upper()}*'
    return f'{local_part[0].upper()}{"*" * (len(local_part) - 2)}{local_part[-1]}'


def author_display_name(user):
    """
    `first_name + ' ' + last_name[0] + '.'`, falling back to a masked email
    local part.

    **The fallback is not optional.** `SignUp.jsx` has never collected
    `first_name` / `last_name`, so on real data most users have two blank name
    fields; a name-only implementation would print an empty byline for almost
    every review on the site.
    """
    if user is None:
        return ANONYMOUS_AUTHOR

    first = (getattr(user, 'first_name', '') or '').strip()
    last = (getattr(user, 'last_name', '') or '').strip()
    if first and last:
        return f'{first} {last[0].upper()}.'
    if first:
        return first
    if last:
        return f'{last[0].upper()}.'

    # Blank names: mask the email local part. `username` is the second source
    # because this project signs users up with their address as the username.
    for candidate in (getattr(user, 'email', ''), getattr(user, 'username', '')):
        candidate = (candidate or '').strip()
        if not candidate:
            continue
        masked = mask_email_local_part(candidate.split('@')[0])
        if masked:
            return masked

    return ANONYMOUS_AUTHOR


class ReviewSerializer(serializers.ModelSerializer):
    """
    The §2b #11 `Review` shape:
    `{id, rating, title, comment, created_at, author:{display_name},
       is_verified_purchase}`.

    `product` and `user` are absent from `fields` entirely rather than merely
    `read_only`, so there is no field for a client to send and nothing for a
    future `fields='__all__'` regression to re-expose.
    """

    rating = serializers.IntegerField(
        min_value=RATING_MIN,
        max_value=RATING_MAX,
        error_messages={
            'min_value': f'Please give a rating between {RATING_MIN} and {RATING_MAX} stars.',
            'max_value': f'Please give a rating between {RATING_MIN} and {RATING_MAX} stars.',
        },
    )
    title = serializers.CharField(max_length=140, required=False, allow_blank=True, default='')
    comment = serializers.CharField(
        max_length=MAX_COMMENT_LENGTH,
        allow_blank=False,
        trim_whitespace=True,
    )
    author = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ('id', 'rating', 'title', 'comment', 'created_at', 'author', 'is_verified_purchase')
        read_only_fields = ('id', 'created_at', 'is_verified_purchase')

    def get_author(self, obj):
        return {'display_name': author_display_name(obj.user)}


class TopReviewProductSerializer(serializers.Serializer):
    """
    The `product: {name, slug, image_main}` stub of §2b #13.

    Hand-written rather than imported from `products.serializers` so this app
    carries no dependency on a serializer another package is rewriting, and so
    a homepage testimonial rail never ships ten image fields per row.
    """

    name = serializers.CharField(read_only=True)
    slug = serializers.SlugField(read_only=True)
    image_main = serializers.SerializerMethodField()

    def get_image_main(self, obj):
        image = getattr(obj, 'image_main', None)
        if not image:
            return None
        try:
            url = image.url
        except ValueError:
            # ImageField with a name but no storage file.
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request is not None else url


class TopReviewSerializer(ReviewSerializer):
    """§2b #13 — a `Review` plus the product it is about."""

    product = TopReviewProductSerializer(read_only=True)

    class Meta(ReviewSerializer.Meta):
        fields = ReviewSerializer.Meta.fields + ('product',)
