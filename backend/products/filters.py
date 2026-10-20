"""Catalogue filters.

The old `ProductFilter` declared `fields = ['category', 'sub_category',
'suitable_for']`, which produced:

* `category` / `sub_category` as **primary-key** filters, while every caller
  sends a slug (`?category=skincare` → `ValueError`-shaped 400, or silently
  nothing);
* no `in_stock`, so an out-of-stock facet was impossible;
* no `is_featured`, which is why the homepage's `?is_featured=true` was
  silently dropped by django-filter and the "Curated Essentials" rail was
  really page 1 of the unordered catalogue (IMPL_SPEC §1 C-5);
* `suitable_for` as an **exact** match on a free-text line, so a "Sensitive"
  facet could never hit anything (§1 C-11).

All four are fixed here. Note that the real skin-type facet is the
`skin_types` M2M populated by migration 0008; `suitable_for` survives as an
`icontains` filter for continuity only.
"""

from django.db.models import Q
from django_filters import rest_framework as filters

from .models import Category, Concern, Product, SkinType, SubCategory, sellable_q


class MultiValueFilter(filters.Filter):
    """A filter that honours a **repeated** query key.

    django-filter binds a filter to `form.cleaned_data[name]`, and a plain
    form field keeps only the last value of a repeated key — so
    `?category=skincare&category=haircare` would quietly collapse to
    `haircare`. `ModelMultipleChoiceFilter` gets this right because its form
    field reads `getlist`; this exists for the one case that cannot use a
    choice field, namely `?category=` on the sub-category endpoint, which
    accepts **either** an id or a slug.
    """

    def __init__(self, *args, param_name=None, **kwargs):
        self.param_name = param_name
        super().__init__(*args, **kwargs)

    def _raw_values(self):
        data = getattr(self.parent, 'data', None)
        if data is None:
            return []
        key = self.param_name or self.field_name
        getlist = getattr(data, 'getlist', None)
        values = getlist(key) if getlist else [data.get(key)]
        return [v for v in values if v not in (None, '')]

    def filter(self, qs, value):
        values = self._raw_values()
        if not values:
            return qs
        return self.resolve(qs, values)

    def resolve(self, qs, values):  # pragma: no cover - overridden
        return qs.filter(**{f'{self.field_name}__in': values}).distinct()


class CategoryRefFilter(MultiValueFilter):
    """`?category=` accepting an id or a slug, repeatable (endpoint #10)."""

    def resolve(self, qs, values):
        ids = [v for v in values if str(v).isdigit()]
        slugs = [v for v in values if not str(v).isdigit()]
        query = None
        if ids:
            query = Q(**{f'{self.field_name}__in': ids})
        if slugs:
            slug_query = Q(**{f'{self.field_name}__slug__in': slugs})
            query = slug_query if query is None else query | slug_query
        return qs.filter(query).distinct()


class ProductFilter(filters.FilterSet):
    """Endpoint #1's facets.

    Every taxonomy facet is slug-keyed and repeatable, matching api.js's
    `paramsSerializer: {indexes: null}` which sends
    `category=skincare&category=haircare`.
    """

    category = filters.ModelMultipleChoiceFilter(
        field_name='category__slug',
        to_field_name='slug',
        queryset=Category.objects.all(),
        distinct=True,
    )
    sub_category = filters.ModelMultipleChoiceFilter(
        field_name='sub_category__slug',
        to_field_name='slug',
        queryset=SubCategory.objects.all(),
        distinct=True,
    )
    concern = filters.ModelMultipleChoiceFilter(
        field_name='concerns__slug',
        to_field_name='slug',
        queryset=Concern.objects.all(),
        distinct=True,
    )
    skin_type = filters.ModelMultipleChoiceFilter(
        field_name='skin_types__slug',
        to_field_name='slug',
        queryset=SkinType.objects.all(),
        distinct=True,
    )

    min_price = filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = filters.NumberFilter(field_name='price', lookup_expr='lte')

    is_featured = filters.BooleanFilter(field_name='is_featured')
    is_bestseller = filters.BooleanFilter(field_name='is_bestseller')
    is_new = filters.BooleanFilter(field_name='is_new')

    in_stock = filters.BooleanFilter(
        method='filter_in_stock',
        label='Sellable per IMPL_SPEC §2d',
    )

    # Kept for continuity with existing links. The real facet is `skin_type`:
    # nine of the ten rows begin "All Skin/Hair Types", so this is a display
    # line, not a dimension.
    suitable_for = filters.CharFilter(field_name='suitable_for', lookup_expr='icontains')

    class Meta:
        model = Product
        fields = [
            'category', 'sub_category', 'concern', 'skin_type',
            'min_price', 'max_price',
            'is_featured', 'is_bestseller', 'is_new',
            'in_stock', 'suitable_for',
        ]

    def filter_in_stock(self, queryset, name, value):
        """§2d, via the single shared predicate — never re-expressed inline.

        `?in_stock=true` keeps only sellable rows; `?in_stock=false` keeps
        exactly the complement, so the two halves always add up to the
        unfiltered list.
        """
        if value is None:
            return queryset
        predicate = sellable_q()
        return queryset.filter(predicate) if value else queryset.exclude(predicate)


class SubCategoryFilter(filters.FilterSet):
    """Endpoint #10: `?category=` by id or slug, repeatable."""

    category = CategoryRefFilter(field_name='category', param_name='category')

    class Meta:
        model = SubCategory
        fields = ['category']
