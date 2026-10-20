"""Catalogue views.

What changed and why, in one place:

* **Everything public is read-only.** `CategoryViewSet` and `SubCategoryViewSet`
  were `ModelViewSet`s mounted on the public router, i.e. the taxonomy was
  writable over the API by any staff session; `ProductViewSet` was the same.
  Nothing in the storefront writes a product or a category — the Django admin
  does — so all of them are `ReadOnlyModelViewSet` now.
* **Filtering, search and ordering actually run.** The viewset declared no
  `filter_backends`, so `?search=` and `?ordering=` were silently discarded
  (IMPL_SPEC §1 C-17).
* **The rails are merchandised, not sliced.** `featured`/`bestsellers` had no
  stock predicate, no ordering and no limit, so "Curated Essentials" was the
  first page of an unordered catalogue (§1 C-5). They now honour
  `limit`/`include_out_of_stock`/`section`, sort sellable-first in
  `display_order`, and return the `{count, results}` envelope.
* **`related` was always slug-routed; the caller was wrong** (§1 C-6). It stays
  slug-keyed. Its `except Product.DoesNotExist` was also dead code —
  `get_object()` raises `Http404`, which that clause cannot catch — so the
  unreachable branch is gone and a missing slug now returns DRF's own 404.
* **`product_count` counts only what a customer can buy.** LF-24's render
  condition on every navigation tile is `product_count > 0`; counting hidden
  or out-of-stock rows would ship dead links.

The availability predicate is imported from `models`, never restated. See the
header of that file.
"""

import logging

from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle

from .filters import ProductFilter, SubCategoryFilter
from .models import (
    Category,
    Concern,
    Product,
    SkinType,
    StockNotification,
    SELLABLE_RANK,
    SubCategory,
    is_sellable_annotation,
    public_sellable_q,
    sellable_q,
)
from .serializers import (
    CategorySerializer,
    ConcernSerializer,
    ProductCardSerializer,
    ProductSerializer,
    SkinTypeSerializer,
    StockNotificationSerializer,
    SubCategorySerializer,
    review_annotations,
    review_summary_for,
)

logger = logging.getLogger(__name__)

#: Rail sizes. A caller may ask for fewer; it may not ask the homepage to
#: render the whole catalogue in one unpaginated response.
DEFAULT_RAIL_LIMIT = 12
MAX_RAIL_LIMIT = 48

TRUE_VALUES = {'true', '1', 'yes', 'on'}
FALSE_VALUES = {'false', '0', 'no', 'off', ''}


def parse_limit(raw, default=DEFAULT_RAIL_LIMIT, maximum=MAX_RAIL_LIMIT):
    """A limit that never raises and never returns something unusable."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    if value <= 0:
        return default
    return min(value, maximum)


def parse_bool(raw, default=False):
    """Strict-ish boolean coercion.

    `bool('false')` is `True`, which is the whole reason this helper exists:
    an `include_out_of_stock=false` that reads as true would put sold-out
    products back on the homepage.
    """
    if raw is None:
        return default
    text = str(raw).strip().lower()
    if text in TRUE_VALUES:
        return True
    if text in FALSE_VALUES:
        return False
    return default


def live_window_q(now):
    """`starts_at <= now <= ends_at`, treating a null bound as open-ended."""
    return (Q(starts_at__isnull=True) | Q(starts_at__lte=now)) & (
        Q(ends_at__isnull=True) | Q(ends_at__gte=now)
    )


class CataloguePagination(PageNumberPagination):
    """Honours `?page_size=`, which the global pagination class does not.

    §2b #1 lists `page_size` as a supported parameter, but DRF's
    `PageNumberPagination` ignores it unless `page_size_query_param` is set,
    so every caller was silently pinned to ten rows. Capped, because the
    parameter is public and an uncapped one is a free full-table scan.
    """

    page_size_query_param = 'page_size'
    max_page_size = 48


class NotifyMeThrottle(SimpleRateThrottle):
    """The `notify_me` scope (5/hour), keyed on the requester.

    A `ScopedRateThrottle` reads `view.throttle_scope`, which is a view-level
    attribute and therefore cannot differ per action — and this action sits on
    a viewset whose every other route wants the 300/minute `catalogue` scope.
    """

    scope = 'notify_me'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class CatalogueThrottleMixin:
    """Opt every public catalogue read into the `catalogue` scope.

    `throttle_scope` alone does nothing unless `ScopedRateThrottle` is the
    throttle class in play: the project default is `AnonRateThrottle` +
    `UserRateThrottle`, and the anon floor of 30/minute would 429 an ordinary
    browsing session (a debounced search box can spend it in seconds).
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'catalogue'


class ProductViewSet(CatalogueThrottleMixin, viewsets.ReadOnlyModelViewSet):
    """Endpoints #1–#6."""

    lookup_field = 'slug'
    filterset_class = ProductFilter
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    search_fields = [
        'name', 'description', 'key_benefits', 'key_features',
        'ingredients', 'sku', 'category__name', 'sub_category__name',
    ]
    ordering_fields = [
        'price', 'created_at', 'name', 'rating', 'reviews_count', 'display_order',
    ]
    # The default order. `Product.Meta.ordering` says the same thing; stating it
    # here too means `OrderingFilter` cannot fall back to an unordered queryset,
    # which is what let page 2 repeat a row from page 1 (§1 C-17).
    ordering = ['display_order', '-created_at']
    pagination_class = CataloguePagination

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProductSerializer
        return ProductCardSerializer

    def get_queryset(self):
        """Visible products only, annotated per §2d and §2e.

        `show_at_website=True` is the only place visibility is enforced: it
        never appears in a payload, and a detail request for a hidden product
        is a 404 rather than a hidden page.
        """
        return (
            Product.objects.filter(show_at_website=True)
            .select_related('category', 'sub_category')
            .prefetch_related(
                Prefetch('concerns', queryset=Concern.objects.only('id', 'name', 'slug')),
                Prefetch('skin_types', queryset=SkinType.objects.only('id', 'name', 'slug')),
            )
            .annotate(**{SELLABLE_RANK: is_sellable_annotation()}, **review_annotations())
        )

    # -- merchandising rails ------------------------------------------------

    def _rail(self, request, base_queryset):
        """Shared body of `featured` and `bestsellers` (endpoints #2, #3).

        `include_out_of_stock=false` (the default) drops unsellable rows
        outright; `true` keeps them but sorts them last, so a sold-out hero
        product degrades instead of vanishing mid-campaign.
        """
        limit = parse_limit(request.query_params.get('limit'))
        include_oos = parse_bool(request.query_params.get('include_out_of_stock'), default=False)
        section = request.query_params.get('section')

        queryset = base_queryset
        if section:
            queryset = self._restrict_to_section(queryset, section)
        if not include_oos:
            queryset = queryset.filter(sellable_q())

        queryset = queryset.order_by(f'-{SELLABLE_RANK}', 'display_order', '-created_at')
        products = list(queryset[:limit])
        serializer = self.get_serializer(products, many=True)
        return Response({'count': len(products), 'results': serializer.data})

    def _restrict_to_section(self, queryset, section):
        """Narrow a rail to one curated `content.HomeSection`.

        `section` is a HomeSection id or `kind`. Only sections that are active
        and inside their date window count, which is what lets a campaign rail
        expire without a deploy.

        A named section that matches nothing live returns an **empty** rail,
        not the unfiltered one. That asymmetry is deliberate: falling back to
        the whole featured list would re-render a rail the business had just
        retired by setting `ends_at`, which is exactly the failure LF-25 is
        about. An empty rail is visible, debuggable and harmless.
        """
        try:
            from content.models import HomeSection
        except Exception:  # pragma: no cover - content is in INSTALLED_APPS
            logger.warning("?section=%s ignored: the content app is unavailable.", section)
            return queryset

        now = timezone.now()
        sections = HomeSection.objects.filter(is_active=True).filter(live_window_q(now))
        sections = (
            sections.filter(pk=section) if str(section).isdigit()
            else sections.filter(kind=section)
        )
        ids = list(sections.values_list('pk', flat=True))
        if not ids:
            logger.info(
                "?section=%s matched no active, in-window HomeSection; "
                "returning an empty rail.", section
            )
            return queryset.none()
        return queryset.filter(home_sections__in=ids).distinct()

    @action(detail=False, methods=['get'])
    def featured(self, request):
        return self._rail(request, self.get_queryset().filter(is_featured=True))

    @action(detail=False, methods=['get'])
    def bestsellers(self, request):
        return self._rail(request, self.get_queryset().filter(is_bestseller=True))

    @action(detail=True, methods=['get'])
    def related(self, request, slug=None):
        """Endpoint #4 — slug-keyed, never empty, never a dead link.

        A missing slug returns DRF's 404 from `get_object()`. The old
        `except Product.DoesNotExist` could not catch that (§1 C-6), so the
        `{'error': 'Product not found'}` body it guarded was unreachable.

        Three tiers, in order: same sub-category, then same category, then
        bestsellers. Each tier excludes anything unsellable or unpublished, so
        the strip never offers something the customer cannot buy — and the
        fallback is what stops it rendering an empty "You may also like".
        """
        product = self.get_object()
        limit = parse_limit(request.query_params.get('limit'), default=4)

        sellable = self.get_queryset().filter(sellable_q()).exclude(pk=product.pk)
        picked, seen = [], {product.pk}

        tiers = (
            sellable.filter(sub_category=product.sub_category_id),
            sellable.filter(category=product.category_id),
            sellable.filter(is_bestseller=True),
            sellable,
        )
        for tier in tiers:
            if len(picked) >= limit:
                break
            for candidate in tier.order_by('display_order', '-created_at')[: limit * 2]:
                if candidate.pk in seen:
                    continue
                seen.add(candidate.pk)
                picked.append(candidate)
                if len(picked) >= limit:
                    break

        serializer = self.get_serializer(picked, many=True)
        return Response({'count': len(picked), 'results': serializer.data})

    @action(detail=True, methods=['get'], url_path='review-summary')
    def review_summary(self, request, slug=None):
        """Endpoint #5 — the §2e summary on its own, for a PDP refresh.

        `average` is `null` when `count == 0`. Every surface that draws stars
        reads this one number; nothing averages a page of reviews client-side.
        """
        product = self.get_object()
        return Response(review_summary_for(product))

    @action(
        detail=True,
        methods=['post'],
        url_path='notify-me',
        throttle_classes=[NotifyMeThrottle],
    )
    def notify_me(self, request, slug=None):
        """Endpoint #6 — "notify me when available".

        §2d: where Add to Cart is suppressed, this takes its place, so an
        unsellable product is an action rather than a dead end. Idempotent: a
        repeat submission is `already_subscribed` with a 200, never an error
        that tells the customer their address is already on file.
        """
        product = self.get_object()
        serializer = StockNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        _row, created = StockNotification.objects.get_or_create(
            product=product,
            email=email,
            defaults={'consent_at': timezone.now()},
        )
        if not created:
            return Response({'status': 'already_subscribed'}, status=status.HTTP_200_OK)
        return Response({'status': 'subscribed'}, status=status.HTTP_201_CREATED)


class TaxonomyViewSet(CatalogueThrottleMixin, viewsets.ReadOnlyModelViewSet):
    """Base for the four navigation endpoints (#7–#10).

    `pagination_class = None`: these lists are short and every consumer treats
    them as a complete set. They were inheriting the global
    `PageNumberPagination` with `PAGE_SIZE: 10`, which happened to be harmless
    only because there are three categories and eight sub-categories — the
    ninth sub-category would have silently disappeared from the filter panel
    (§1 C-18).
    """

    pagination_class = None
    count_relation = 'products'

    def get_queryset(self):
        """`product_count` counts only products a customer can actually buy.

        `order_by` is explicit and not a duplicate of `Meta.ordering`: since
        Django 3.1 a queryset that carries an aggregate drops `Meta.ordering`
        rather than putting it in the GROUP BY, so annotating `product_count`
        silently returns these rows in whatever order the index scan produces.
        Without this line the navigation comes back alphabetical and
        `display_order` does nothing.
        """
        relation = self.count_relation
        return self.queryset.annotate(
            product_count=Count(
                relation,
                filter=public_sellable_q(relation),
                distinct=True,
            )
        ).order_by('display_order', 'name')


class CategoryViewSet(TaxonomyViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class SubCategoryViewSet(TaxonomyViewSet):
    queryset = SubCategory.objects.select_related('category')
    serializer_class = SubCategorySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = SubCategoryFilter


class ConcernViewSet(TaxonomyViewSet):
    """Endpoint #7.

    The rows are derived from real sub-categories by migration 0008 and
    nothing else, so this list cannot contain a group the catalogue is unable
    to fill. The two extra concerns named in the dead `ShopByConcern`
    component are absent for exactly that reason (LF-24).
    """

    queryset = Concern.objects.all()
    serializer_class = ConcernSerializer


class SkinTypeViewSet(TaxonomyViewSet):
    """Endpoint #8."""

    queryset = SkinType.objects.all()
    serializer_class = SkinTypeSerializer
