"""Catalogue serializers.

Two things in here are load-bearing and easy to undo by accident.

**1. `rating` and `reviews_count` are not served.** `ProductSerializer` uses an
explicit field list rather than `exclude`, and that list omits both columns
(IMPL_SPEC §2e mechanism 1). They are a cache of `reviews.Review`, they have
had no writer at all until this change-set (§1 C-9), and all ten seeded
products genuinely hold `rating = 0.00` with an empty `Review` table. Serving
`rating: 0.00` is what makes the storefront render a zero-star product. The
replacement is `review_summary`, whose `average` is **`null`** when
`count == 0` — never `0`. A client can then decide not to draw stars at all,
which is the only honest option when there are no reviews.

**2. `available_quantity` comes from the model property, which zeroes out.**
§2d: a product switched off by a human (`manual_out_of_stock`) or not yet
launched (`coming_soon`) has `available_quantity == 0`. The previous
implementation returned the raw `stock_quantity`, so a disabled product
serialised `in_stock: false, available_quantity: 150` and any client that
trusted the quantity would happily offer it.

`ProductCardSerializer` is the light payload for list/featured/bestsellers/
related: it drops the nine secondary image fields and the five prose blobs
(`description`, `key_benefits`, `key_features`, `ingredients`, `how_to_use`),
which together are the bulk of a product row. `ProductSerializer` (detail)
carries everything.
"""

from functools import lru_cache

from django.apps import apps
from django.conf import settings
from django.core.exceptions import FieldDoesNotExist
from django.db.models import Avg, Count, Q
from rest_framework import serializers

from .derived_images import derived_map_for
from .models import Category, Concern, Product, SkinType, StockNotification, SubCategory

RATING_BUCKETS = ('5', '4', '3', '2', '1')

EMPTY_DISTRIBUTION = {bucket: 0 for bucket in RATING_BUCKETS}


# ---------------------------------------------------------------------------
# Review bridge
#
# `reviews.Review` gains `is_approved` and `is_verified_purchase` in
# reviews/0002 (WP-03). The catalogue is the biggest consumer of those two
# columns and must not 500 while that migration is unapplied — a half-deployed
# backend that cannot serve a product list is worse than one that counts an
# unmoderated review. So the filter is built from the model's *declared*
# fields: once the columns exist, the §2e predicate applies verbatim and this
# shim becomes inert. It is a deployment-order guard, not a feature.
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _review_model():
    try:
        return apps.get_model('reviews', 'Review')
    except LookupError:  # pragma: no cover - reviews is in INSTALLED_APPS
        return None


@lru_cache(maxsize=4)
def review_has_field(name):
    model = _review_model()
    if model is None:
        return False
    try:
        model._meta.get_field(name)
    except FieldDoesNotExist:
        return False
    return True


def approved_review_q(prefix='reviews'):
    """§2e: the single source of truth is `Review` rows with `is_approved`."""
    if review_has_field('is_approved'):
        return Q(**{f'{prefix}__is_approved': True})
    return Q(**{f'{prefix}__isnull': False})


def review_annotations():
    """The §2e annotations, for `ProductViewSet.get_queryset()`.

    `review_summary` prefers these over any per-object query, so a product
    list costs one query for the page rather than one per card.
    """
    reviews_q = approved_review_q()
    return {
        'rv_avg': Avg('reviews__rating', filter=reviews_q),
        'rv_count': Count('reviews', distinct=True, filter=reviews_q),
    }


def review_breakdown_for(products):
    """`{product_id: {'distribution': {...}, 'verified_count': int}}`.

    One grouped query for the whole page, so the histogram on a listing costs
    the same as the histogram on a PDP.
    """
    model = _review_model()
    ids = [p.pk for p in products if p.pk]
    blank = {pk: {'distribution': dict(EMPTY_DISTRIBUTION), 'verified_count': 0} for pk in ids}
    if model is None or not ids:
        return blank

    approved = Q()
    if review_has_field('is_approved'):
        approved = Q(is_approved=True)

    rows = (
        model.objects.filter(approved, product_id__in=ids)
        .values('product_id', 'rating')
        .annotate(n=Count('id'))
    )
    for row in rows:
        bucket = str(row['rating'])
        if bucket in blank[row['product_id']]['distribution']:
            blank[row['product_id']]['distribution'][bucket] += row['n']

    if review_has_field('is_verified_purchase'):
        verified = (
            model.objects.filter(approved, product_id__in=ids, is_verified_purchase=True)
            .values('product_id')
            .annotate(n=Count('id'))
        )
        for row in verified:
            blank[row['product_id']]['verified_count'] = row['n']

    return blank


def review_summary_for(product, breakdown=None):
    """The §2e `ReviewSummary` payload for one product.

    `average` is `None` when `count == 0`. Reads the `rv_avg`/`rv_count`
    annotations when the queryset supplied them and falls back to a direct
    aggregate for a single-object read.
    """
    if breakdown is None:
        breakdown = review_breakdown_for([product]).get(product.pk) or {
            'distribution': dict(EMPTY_DISTRIBUTION),
            'verified_count': 0,
        }

    count = getattr(product, 'rv_count', None)
    average = getattr(product, 'rv_avg', None)
    if count is None:
        # A single-object read on a queryset that carried no annotation.
        model = _review_model()
        if model is None:
            count, average = 0, None
        else:
            approved = Q(is_approved=True) if review_has_field('is_approved') else Q()
            aggregate = model.objects.filter(approved, product_id=product.pk).aggregate(
                n=Count('id'), avg=Avg('rating')
            )
            count = aggregate['n'] or 0
            average = aggregate['avg']

    count = int(count or 0)
    if count == 0:
        # Never 0. A zero average renders as a zero-star product; the honest
        # statement is "there is no rating".
        return {
            'average': None,
            'count': 0,
            'distribution': dict(EMPTY_DISTRIBUTION),
            'verified_count': 0,
        }

    return {
        'average': round(float(average), 2) if average is not None else None,
        'count': count,
        'distribution': breakdown['distribution'],
        'verified_count': breakdown['verified_count'],
    }


# ---------------------------------------------------------------------------
# Taxonomy
# ---------------------------------------------------------------------------


class TaxonomyRefSerializer(serializers.Serializer):
    """`{id, name, slug}` — how a category/concern/skin type nests in a product."""

    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    slug = serializers.SlugField(read_only=True)


class ProductCountMixin(serializers.ModelSerializer):
    """`product_count` from the viewset's annotation.

    The annotation counts only products that are both visible and sellable
    (§2d), because LF-24's hard render condition on every navigation tile is
    `product_count > 0` — a tile that counts hidden or out-of-stock products
    is a dead link.
    """

    product_count = serializers.IntegerField(read_only=True, default=0)
    #: What selecting this facet actually returns — every visible product, in stock or not.
    #: `product_count` counts only what is buyable, which is what LF-24 gates a tile on; a
    #: facet LABEL must use this one or it promises a number the next click disproves.
    listed_count = serializers.IntegerField(read_only=True, default=0)


class CategorySerializer(ProductCountMixin):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'image', 'display_order', 'product_count', 'listed_count')


class SubCategorySerializer(ProductCountMixin):
    category = TaxonomyRefSerializer(read_only=True)

    class Meta:
        model = SubCategory
        fields = ('id', 'name', 'slug', 'category', 'display_order', 'product_count', 'listed_count')


class ConcernSerializer(ProductCountMixin):
    class Meta:
        model = Concern
        fields = (
            'id', 'name', 'slug', 'description', 'icon_key',
            'display_order', 'product_count', 'listed_count',
        )


class SkinTypeSerializer(ProductCountMixin):
    """Endpoint #8 returns the same shape as #7.

    `SkinType` has no `description`/`icon_key` columns (§2c keeps the model
    minimal), so both are emitted as empty strings. That keeps one client-side
    component able to render either facet list without branching, without
    adding two columns nothing writes.
    """

    description = serializers.SerializerMethodField()
    icon_key = serializers.SerializerMethodField()

    class Meta:
        model = SkinType
        fields = (
            'id', 'name', 'slug', 'description', 'icon_key',
            'display_order', 'product_count', 'listed_count',
        )

    def get_description(self, obj):
        return getattr(obj, 'description', '') or ''

    def get_icon_key(self, obj):
        return getattr(obj, 'icon_key', '') or ''


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


class _ProductListSerializer(serializers.ListSerializer):
    """Computes the review histogram for the whole page in one query."""

    def to_representation(self, data):
        items = list(data)
        self.child.context['_review_breakdown'] = review_breakdown_for(items)
        return super().to_representation(items)


class BaseProductSerializer(serializers.ModelSerializer):
    category = TaxonomyRefSerializer(read_only=True)
    sub_category = TaxonomyRefSerializer(read_only=True)
    concerns = TaxonomyRefSerializer(many=True, read_only=True)
    skin_types = TaxonomyRefSerializer(many=True, read_only=True)

    in_stock = serializers.BooleanField(source='is_sellable', read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)
    effective_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    currency = serializers.SerializerMethodField()
    canonical_url = serializers.CharField(read_only=True)
    review_summary = serializers.SerializerMethodField()
    derived_images = serializers.SerializerMethodField()

    class Meta:
        list_serializer_class = _ProductListSerializer

    def get_currency(self, obj):
        return getattr(settings, 'DEFAULT_CURRENCY', 'INR')

    def get_derived_images(self, obj):
        """Responsive derivatives for this product's whole gallery, keyed by filename stem.

        Additive and optional: `image_main` and `image_2`…`image_10` are unchanged and still
        correct on their own, so a client that ignores this field behaves exactly as before.
        Generated by `manage.py optimize_media`; see products/derived_images.py.

        This is the server half of the image pipeline. The frontend build can only pre-encode
        masters committed to the repo, which covers two of the six live products; the other
        four are uploads in MEDIA_ROOT. Measured, those four were 2.27 MB of the listing's
        weight, and the PDP's 72px thumbnail rail was downloading eight full-resolution
        masters for 4.88 MB. The card payload sends only `image_main`'s entry; the detail
        payload sends the gallery, because only the PDP renders frames 2-10.

        Reading the manifest adds no query — it is cached in process and invalidated by mtime.
        """
        fields = [obj.image_main]
        if self._include_gallery:
            fields += [getattr(obj, f'image_{i}', None) for i in range(2, 11)]
        return derived_map_for(fields, self.context.get('request'))

    # The card payload has no gallery fields to describe (and `.only()` has not loaded them),
    # so asking for them would be both pointless and an extra query per row.
    _include_gallery = False

    def get_review_summary(self, obj):
        breakdown = (self.context.get('_review_breakdown') or {}).get(obj.pk)
        return review_summary_for(obj, breakdown)


class ProductCardSerializer(BaseProductSerializer):
    """The list / rail payload.

    Everything a card, a rail or a related-products strip needs, and nothing
    else: no `image_2`…`image_10`, no description, benefits, features,
    ingredients or how-to-use. Those five text blobs plus nine image fields
    were being shipped for every row of every listing page.
    """

    class Meta(BaseProductSerializer.Meta):
        model = Product
        fields = (
            'id', 'name', 'slug', 'brand',
            'category', 'sub_category', 'concerns', 'skin_types',
            'price', 'discount_price', 'effective_price', 'currency',
            'suitable_for', 'size', 'sku',
            'is_featured', 'is_bestseller', 'is_new', 'coming_soon',
            'display_order',
            'in_stock', 'available_quantity',
            'review_summary',
            'image_main', 'derived_images',
            'amazon_link',
            'canonical_url',
            'created_at',
        )


class ProductLineSerializer(serializers.ModelSerializer):
    """The payload for a cart line or an order line.

    Deliberately NOT a `BaseProductSerializer` subclass. A line renders a thumbnail, a name, a
    price and an availability state — it renders no rating, no concerns and no skin types. Those
    three fields cost four taxonomy queries and a review aggregate per product, which is how a
    five-line cart summary reached 61 queries. Order lines additionally prefer their own
    `product_name`/`product_sku` snapshots over anything here.
    """

    in_stock = serializers.BooleanField(source='is_sellable', read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)
    effective_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    currency = serializers.SerializerMethodField()
    canonical_url = serializers.CharField(read_only=True)
    derived_images = serializers.SerializerMethodField()

    def get_derived_images(self, obj):
        """Same map as the card payload — a cart thumbnail is an image too."""
        return derived_map_for([obj.image_main], self.context.get('request'))

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'brand',
            'price', 'discount_price', 'effective_price', 'currency',
            'size', 'sku', 'image_main', 'derived_images',
            'in_stock', 'available_quantity', 'coming_soon',
            'canonical_url',
        )
        read_only_fields = fields

    def get_currency(self, obj):
        return getattr(settings, 'DEFAULT_CURRENCY', 'INR')


class ProductSerializer(BaseProductSerializer):
    """The detail payload.

    An explicit field list, not `exclude`. The omissions are deliberate:
    `show_at_website` and `manual_out_of_stock` are server-side concerns a
    client must never branch on (§2d: an invisible product is simply not
    served, and availability is reported as `in_stock`), and `rating` /
    `reviews_count` are replaced by `review_summary` (§2e).
    """

    # The only payload that renders frames 2-10, so the only one that describes them.
    _include_gallery = True

    class Meta(BaseProductSerializer.Meta):
        model = Product
        fields = (
            'id', 'name', 'slug', 'brand',
            'category', 'sub_category', 'concerns', 'skin_types',
            'price', 'discount_price', 'effective_price', 'currency',
            'description', 'key_benefits', 'key_features', 'ingredients',
            'how_to_use', 'suitable_for', 'size', 'sku',
            'is_featured', 'is_bestseller', 'is_new', 'coming_soon',
            'display_order',
            'in_stock', 'available_quantity',
            'review_summary',
            'derived_images',
            'image_main', 'image_2', 'image_3', 'image_4', 'image_5',
            'image_6', 'image_7', 'image_8', 'image_9', 'image_10',
            'amazon_link',
            'canonical_url',
            'created_at', 'updated_at',
        )


class ReviewSummarySerializer(serializers.Serializer):
    """Endpoint #5's response. Declared for schema clarity; the view builds the
    dict with `review_summary_for`."""

    average = serializers.FloatField(allow_null=True)
    count = serializers.IntegerField()
    distribution = serializers.DictField(child=serializers.IntegerField())
    verified_count = serializers.IntegerField()


class StockNotificationSerializer(serializers.ModelSerializer):
    """Endpoint #6's request body.

    `consent` is required and must be `true`: the row is a consent record, so
    there is no path that stores an address without one. `consent_at` is
    stamped server-side — a client-supplied timestamp would be worthless as
    evidence.
    """

    consent = serializers.BooleanField(write_only=True)

    class Meta:
        model = StockNotification
        fields = ('email', 'consent')

    def validate_consent(self, value):
        if value is not True:
            raise serializers.ValidationError(
                'We can only store your address if you agree to be emailed about this product.'
            )
        return value
