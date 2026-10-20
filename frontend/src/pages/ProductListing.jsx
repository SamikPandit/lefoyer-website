/**
 * ProductListing — discovery. **The URL is the single source of truth** (LF-06 / LF-08).
 *
 * WHAT THIS REPLACES, ALL VERIFIED IN THE FILE IT OVERWRITES
 *  - Filters lived in `useState`, so `/products?category=skincare&page=2` could not be
 *    shared, bookmarked, indexed, or restored by the browser's Back button. The old code
 *    read `?category=` once, mapped the slug to a **numeric id**, and put the id in the
 *    request — so even the one URL it honoured round-tripped into something unshareable.
 *    Everything now derives from `useSearchParams` and is written back with slugs.
 *  - `setTotalPages(Math.ceil(response.data.count / 10))` hard-coded the page size, and
 *    the toolbar printed `{products.length} Products` — the size of the current page,
 *    not the total. Both now come from `count` and the page size this component actually
 *    sends (LF-09).
 *  - `catch { setProducts([]) }` meant a backend outage rendered as **"No products
 *    found. Try adjusting your filters."** A shopper would clear every filter and still
 *    see nothing. LF-26: `status` is one of `loading | error | empty | ready`, there is a
 *    distinct error panel with Retry, and there are THREE different empty copies — a
 *    search with no hits, a filter set with no hits, and a genuinely empty catalogue.
 *  - An unknown slug (`?category=skincar`) silently returned the full catalogue; today
 *    the server would answer `400` and the old code would show "No products found".
 *    There is now an explicit "we don't have that filter" state.
 *  - It read `.data.results` (api.js normalises), rendered `#FAFAFA` (deleted from the
 *    design system), stacked three bordered `Paper` strips above the first product
 *    (~160px of chrome, DESIGN_SYSTEM §8) and passed a `view` prop `ProductCard` ignored.
 *
 * MOBILE FILTERING IS STAGED (DESIGN_SYSTEM §6.7)
 * The sheet edits a **draft**. Nothing refetches until "Show N products" is tapped. The
 * count in that button is kept live by a debounced `page_size=1` count request, which
 * costs one tiny response per pause in ticking instead of re-fetching the whole grid on
 * every tick — "live refetch per tick is unusable on a slow connection".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import SortIcon from '@mui/icons-material/Sort';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';

import {
  listCategories,
  listConcerns,
  listProducts,
  listSkinTypes,
  listSubCategories,
} from '../services/api';
import SeoHead, { absoluteUrl } from '../components/common/SeoHead';
import EmptyState, { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import ProductCardSkeleton, {
  SKELETON_COUNT,
  useSkeletonDelay,
} from '../components/common/ProductCardSkeleton';
import ProductCard from '../components/product/ProductCard';
import ProductFilter, {
  MULTI_FACETS,
  SORT_OPTIONS,
  buildPriceBands,
} from '../components/product/ProductFilter';
import ProductPagination from '../components/product/ProductPagination';
import { PRODUCT_GRID_SX } from '../components/product/RelatedProducts';
import { PRODUCT_PAGE_SIZE, formatRupees } from '../components/product/productPresentation';

/* -------------------------------------------------------------------------- *
 * URL <-> filter state. Slugs only, so every URL is shareable and indexable.
 * -------------------------------------------------------------------------- */

const EMPTY_FILTERS = Object.freeze({
  category: [],
  sub_category: [],
  concern: [],
  skin_type: [],
  in_stock: null,
  min_price: null,
  max_price: null,
  ordering: '',
});

const numberOrNull = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/** Everything the grid needs, read out of the query string. */
function readState(searchParams) {
  const filters = {
    category: searchParams.getAll('category').filter(Boolean),
    sub_category: searchParams.getAll('sub_category').filter(Boolean),
    concern: searchParams.getAll('concern').filter(Boolean),
    skin_type: searchParams.getAll('skin_type').filter(Boolean),
    in_stock: searchParams.get('in_stock') === 'true' ? true : null,
    min_price: numberOrNull(searchParams.get('min_price')),
    max_price: numberOrNull(searchParams.get('max_price')),
    ordering: SORT_OPTIONS.some((option) => option.value === searchParams.get('ordering'))
      ? searchParams.get('ordering')
      : '',
  };

  const pageRaw = Number(searchParams.get('page'));
  return {
    filters,
    // `search` is the canonical key; `q` is accepted because SearchOverlay's
    // "see all results" affordance and the design system's keyboard contract both
    // mention `?q=`, and a link already in the wild must not land on an unfiltered page.
    search: (searchParams.get('search') ?? searchParams.get('q') ?? '').trim(),
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.trunc(pageRaw) : 1,
  };
}

/** The query string for a given state. Absent values are omitted, never emitted blank. */
function writeState({ filters, search, page }) {
  const params = new URLSearchParams();
  MULTI_FACETS.forEach((key) => {
    (filters[key] || []).forEach((slug) => params.append(key, slug));
  });
  if (filters.in_stock === true) params.set('in_stock', 'true');
  if (filters.min_price !== null && filters.min_price !== undefined) {
    params.set('min_price', String(filters.min_price));
  }
  if (filters.max_price !== null && filters.max_price !== undefined) {
    params.set('max_price', String(filters.max_price));
  }
  if (filters.ordering) params.set('ordering', filters.ordering);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  return params;
}

/** The axios params for one grid request. */
function toQuery({ filters, search, page, pageSize = PRODUCT_PAGE_SIZE }) {
  return {
    category: filters.category,
    sub_category: filters.sub_category,
    concern: filters.concern,
    skin_type: filters.skin_type,
    in_stock: filters.in_stock === true ? true : undefined,
    min_price: filters.min_price ?? undefined,
    max_price: filters.max_price ?? undefined,
    ordering: filters.ordering || undefined,
    search: search || undefined,
    page: page > 1 ? page : undefined,
    page_size: pageSize,
  };
}

const anyFacetActive = (filters) =>
  MULTI_FACETS.some((key) => (filters[key] || []).length > 0) ||
  filters.in_stock === true ||
  filters.min_price !== null ||
  filters.max_price !== null;

/** The facet keys whose values must exist in the taxonomy. */
const TAXONOMY_SOURCES = Object.freeze({
  category: 'categories',
  sub_category: 'subCategories',
  concern: 'concerns',
  skin_type: 'skinTypes',
});

const FACET_LABELS = Object.freeze({
  category: 'Category',
  sub_category: 'Sub-category',
  concern: 'Concern',
  skin_type: 'Skin type',
});

const ProductListing = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();

  const { filters, search, page } = useMemo(() => readState(searchParams), [searchParams]);

  const [taxonomy, setTaxonomy] = useState({
    categories: [],
    subCategories: [],
    concerns: [],
    skinTypes: [],
  });
  const [taxonomyStatus, setTaxonomyStatus] = useState('loading');

  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [maxCataloguePrice, setMaxCataloguePrice] = useState(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [draftCount, setDraftCount] = useState(null);
  const [sheetNotice, setSheetNotice] = useState('');

  const gridTopRef = useRef(null);
  const gridControllerRef = useRef(null);
  const draftControllerRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (gridControllerRef.current) gridControllerRef.current.abort();
      if (draftControllerRef.current) draftControllerRef.current.abort();
    };
  }, []);

  /* ------------------------------------------------------------------ *
   * taxonomy — fetched here ONCE and handed to ProductFilter as props
   * ------------------------------------------------------------------ */

  const loadTaxonomy = useCallback(async () => {
    setTaxonomyStatus('loading');
    const [categories, subCategories, concerns, skinTypes] = await Promise.all([
      listCategories().catch(() => null),
      listSubCategories().catch(() => null),
      listConcerns().catch(() => null),
      listSkinTypes().catch(() => null),
    ]);
    if (!aliveRef.current) return;

    // Any missing facet means the taxonomy cannot be trusted. Checking only categories and
    // sub-categories meant a transient failure of /concerns/ or /skin-types/ left those lists
    // empty but the taxonomy "loaded", so every ?concern= and ?skin_type= URL — the links the
    // homepage sends people to — was treated as an unknown filter and silently emptied.
    const failed =
      categories === null || subCategories === null || concerns === null || skinTypes === null;
    setTaxonomy({
      categories: categories?.items || [],
      subCategories: subCategories?.items || [],
      concerns: concerns?.items || [],
      skinTypes: skinTypes?.items || [],
    });
    setTaxonomyStatus(failed ? 'error' : 'ready');
  }, []);

  useEffect(() => {
    loadTaxonomy();
  }, [loadTaxonomy]);

  /* The real catalogue ceiling, so the price bands cannot offer an empty band. */
  useEffect(() => {
    let alive = true;
    listProducts({ ordering: '-price', page_size: 1 })
      .then(({ items }) => {
        const top = Number(items?.[0]?.price);
        if (alive && Number.isFinite(top) && top > 0) setMaxCataloguePrice(top);
      })
      .catch(() => {
        /* bands fall back to the full default ladder */
      });
    return () => {
      alive = false;
    };
  }, []);

  const priceBands = useMemo(() => buildPriceBands(maxCataloguePrice), [maxCataloguePrice]);

  /** Slugs in the URL that the taxonomy does not know about. */
  const unknownFilters = useMemo(() => {
    if (taxonomyStatus !== 'ready') return [];
    const unknown = [];
    Object.entries(TAXONOMY_SOURCES).forEach(([key, source]) => {
      const known = new Set((taxonomy[source] || []).map((item) => item.slug));
      (filters[key] || []).forEach((slug) => {
        if (!known.has(slug)) unknown.push({ key, slug });
      });
    });
    return unknown;
  }, [taxonomyStatus, taxonomy, filters]);

  /* ------------------------------------------------------------------ *
   * the grid
   * ------------------------------------------------------------------ */

  const urlHasTaxonomyFacet = MULTI_FACETS.some((key) => (filters[key] || []).length > 0);
  // Firing the grid request before the taxonomy has settled would 400 on an unknown
  // slug and flash an error panel before we can explain which filter is wrong. We only
  // wait when the URL actually carries a taxonomy slug.
  const waitingForTaxonomy = urlHasTaxonomyFacet && taxonomyStatus === 'loading';

  const loadProducts = useCallback(async () => {
    if (gridControllerRef.current) gridControllerRef.current.abort();
    const controller = new AbortController();
    gridControllerRef.current = controller;

    setStatus('loading');
    setError(null);
    try {
      const result = await listProducts(toQuery({ filters, search, page }), {
        signal: controller.signal,
      });
      if (!aliveRef.current || controller.signal.aborted) return;
      setProducts(result.items);
      setCount(result.count);
      setStatus(result.items.length ? 'ready' : 'empty');
    } catch (requestError) {
      if (requestError?.isCanceled || controller.signal.aborted || !aliveRef.current) return;
      // A 400 from this endpoint is a rejected filter VALUE (django-filter validates
      // every slug against the taxonomy), not an outage. Saying "something went wrong"
      // would send the shopper to Retry forever.
      if (requestError?.status === 400) {
        setStatus('unknown-filter');
        return;
      }
      // DRF answers 404 for a page number past the end — which is what a shared link to
      // `?page=7` becomes once the catalogue shrinks. That is not an outage, so it must
      // not render an error with a Retry button that can never succeed: fall back to the
      // first page of the same filter set.
      if (requestError?.isNotFound && page > 1) {
        setSearchParams(writeState({ filters, search, page: 1 }), { replace: true });
        return;
      }
      setError(requestError);
      setStatus('error');
    }
  }, [filters, search, page, setSearchParams]);

  // A stable key, so resolving the taxonomy does not re-fire an identical grid request
  // just because `unknownFilters` is a new array instance.
  const unknownKey = unknownFilters.map((item) => `${item.key}:${item.slug}`).join('|');

  useEffect(() => {
    if (waitingForTaxonomy) {
      setStatus('loading');
      return;
    }
    if (unknownKey) {
      setStatus('unknown-filter');
      return;
    }
    loadProducts();
  }, [waitingForTaxonomy, unknownKey, loadProducts]);

  /* ------------------------------------------------------------------ *
   * writing back to the URL
   * ------------------------------------------------------------------ */

  /** Filter tweaks REPLACE: fifteen tick-untick cycles must not need fifteen Backs. */
  const applyFilters = useCallback(
    (nextFilters) => {
      setSearchParams(writeState({ filters: nextFilters, search, page: 1 }), { replace: true });
    },
    [search, setSearchParams],
  );

  /** A page change PUSHES, because Back from page 2 to page 1 is a real expectation. */
  const changePage = useCallback(
    (_event, nextPage) => {
      setSearchParams(writeState({ filters, search, page: nextPage }));
      if (gridTopRef.current) {
        gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [filters, search, setSearchParams],
  );

  const clearAll = useCallback(() => {
    // Clear all empties the URL — including the search term, which is also a filter on
    // what you can see.
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const removeFilter = useCallback(
    (key, value) => {
      const next = { ...filters };
      if (key === 'price') {
        next.min_price = null;
        next.max_price = null;
      } else if (key === 'search') {
        setSearchParams(writeState({ filters, search: '', page: 1 }), { replace: true });
        return;
      } else if (MULTI_FACETS.includes(key)) {
        next[key] = (filters[key] || []).filter((slug) => slug !== value);
        if (key === 'category') {
          // Keep the dependent facet honest (same rule as ProductFilter's own pruning).
          const allowed = new Set(
            (next.category.length
              ? taxonomy.subCategories.filter((sub) => next.category.includes(sub.category?.slug))
              : taxonomy.subCategories
            ).map((sub) => sub.slug),
          );
          next.sub_category = (next.sub_category || []).filter((slug) => allowed.has(slug));
        }
      } else {
        next[key] = key === 'ordering' ? '' : null;
      }
      applyFilters(next);
    },
    [applyFilters, filters, setSearchParams, taxonomy.subCategories],
  );

  /* ------------------------------------------------------------------ *
   * the staged mobile sheet
   * ------------------------------------------------------------------ */

  const openFilters = () => {
    setDraft(filters);
    setDraftCount(count);
    setSheetNotice('');
    setFiltersOpen(true);
  };

  const dismissFilters = (reason) => {
    setFiltersOpen(false);
    setDraft(filters);
    if (reason === 'discard') setSheetNotice('Filter changes discarded.');
  };

  const commitFilters = () => {
    setFiltersOpen(false);
    applyFilters(draft);
  };

  /* The live count for "Show N products", debounced. The grid is untouched. */
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const timer = setTimeout(async () => {
      if (draftControllerRef.current) draftControllerRef.current.abort();
      const controller = new AbortController();
      draftControllerRef.current = controller;
      try {
        const result = await listProducts(
          toQuery({ filters: draft, search, page: 1, pageSize: 1 }),
          { signal: controller.signal },
        );
        if (aliveRef.current && !controller.signal.aborted) setDraftCount(result.count);
      } catch (requestError) {
        if (!requestError?.isCanceled && aliveRef.current && !controller.signal.aborted) {
          // Unknown: the button says "Show products" rather than a number we cannot stand behind.
          setDraftCount(null);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, filtersOpen, search]);

  /* ------------------------------------------------------------------ *
   * chips, copy and SEO
   * ------------------------------------------------------------------ */

  const nameFor = useCallback(
    (key, slug) => {
      const source = taxonomy[TAXONOMY_SOURCES[key]] || [];
      const hit = source.find((item) => item.slug === slug);
      return hit ? hit.name : slug;
    },
    [taxonomy],
  );

  const activeChips = useMemo(() => {
    const chips = [];
    if (search) chips.push({ key: 'search', value: search, label: `Search: “${search}”` });
    MULTI_FACETS.forEach((key) => {
      (filters[key] || []).forEach((slug) => {
        chips.push({ key, value: slug, label: nameFor(key, slug) });
      });
    });
    if (filters.in_stock === true) chips.push({ key: 'in_stock', value: true, label: 'In stock only' });
    if (filters.min_price !== null || filters.max_price !== null) {
      const min = filters.min_price !== null ? formatRupees(filters.min_price) : null;
      const max = filters.max_price !== null ? formatRupees(filters.max_price) : null;
      chips.push({
        key: 'price',
        value: 'price',
        label: min && max ? `${min} – ${max}` : max ? `Under ${max}` : `${min} and above`,
      });
    }
    if (filters.ordering) {
      const option = SORT_OPTIONS.find((item) => item.value === filters.ordering);
      if (option) chips.push({ key: 'ordering', value: filters.ordering, label: `Sorted: ${option.label}` });
    }
    return chips;
  }, [filters, nameFor, search]);

  const filterCount = activeChips.filter((chip) => chip.key !== 'ordering').length;

  /** The page's own name, built only from facts in the URL and the taxonomy. */
  const { heading, introCopy, canonicalPath, indexable } = useMemo(() => {
    const singleCategory = filters.category.length === 1 ? filters.category[0] : null;
    const singleSub = filters.sub_category.length === 1 ? filters.sub_category[0] : null;
    const singleConcern = filters.concern.length === 1 ? filters.concern[0] : null;

    let title = 'All products';
    if (search) title = `Results for “${search}”`;
    else if (singleSub) title = nameFor('sub_category', singleSub);
    else if (singleCategory) title = nameFor('category', singleCategory);
    else if (singleConcern) title = nameFor('concern', singleConcern);

    // Intro copy is NEVER invented: a concern's description is authored in the admin,
    // and that is the only prose we have a source for.
    let intro = null;
    if (!search && singleConcern) {
      const concern = (taxonomy.concerns || []).find((item) => item.slug === singleConcern);
      if (concern?.description) intro = concern.description;
    }

    // Canonical keeps the facets that make a legitimately distinct, indexable page and
    // drops the ones that only re-sort or thin it out.
    const canonicalParams = new URLSearchParams();
    MULTI_FACETS.forEach((key) => {
      [...(filters[key] || [])].sort().forEach((slug) => canonicalParams.append(key, slug));
    });
    const canonicalQuery = canonicalParams.toString();

    const facetGroupsActive = MULTI_FACETS.filter((key) => (filters[key] || []).length > 0).length;
    const isIndexable =
      !search &&
      page === 1 &&
      facetGroupsActive <= 1 &&
      filters.min_price === null &&
      filters.max_price === null;

    return {
      heading: title,
      introCopy: intro,
      canonicalPath: canonicalQuery ? `/products?${canonicalQuery}` : '/products',
      indexable: isIndexable,
    };
  }, [filters, nameFor, page, search, taxonomy.concerns]);

  const jsonLd = useMemo(() => {
    const collectionUrl = absoluteUrl(canonicalPath);
    const crumbs = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Products', item: absoluteUrl('/products') },
    ];
    if (heading !== 'All products' && !search) {
      crumbs.push({ '@type': 'ListItem', position: 3, name: heading, item: collectionUrl });
    }

    const documents = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs }];

    if (status === 'ready') {
      documents.push({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: heading,
        description: introCopy || undefined,
        url: collectionUrl,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: count,
          itemListElement: products.map((product, index) => ({
            '@type': 'ListItem',
            position: (page - 1) * PRODUCT_PAGE_SIZE + index + 1,
            name: product.name,
            url: absoluteUrl(`/product/${product.slug}`),
          })),
        },
      });
    }

    return documents;
  }, [canonicalPath, count, heading, introCopy, page, products, search, status]);

  const totalPages = Math.max(1, Math.ceil((count || 0) / PRODUCT_PAGE_SIZE));
  const showSkeletons = useSkeletonDelay(status === 'loading');
  const skeletonCount = isMobile ? SKELETON_COUNT.mobile : SKELETON_COUNT.desktop;

  /* ------------------------------------------------------------------ *
   * render
   * ------------------------------------------------------------------ */

  const railFilter = (
    <ProductFilter
      value={filters}
      onChange={applyFilters}
      taxonomy={taxonomy}
      taxonomyStatus={taxonomyStatus}
      onRetryTaxonomy={loadTaxonomy}
      priceBands={priceBands}
    />
  );

  const resultsRegion = (() => {
    if (status === 'error') {
      return (
        <ErrorState
          title="Couldn't load products"
          error={error}
          onRetry={loadProducts}
          secondaryLabel="Go to home"
          secondaryTo="/"
          variant="page"
        />
      );
    }

    if (status === 'unknown-filter') {
      const names = unknownFilters.map((item) => `${FACET_LABELS[item.key]} “${item.slug}”`);
      return (
        <EmptyState
          icon={<SearchOffIcon />}
          title="We don't have that filter"
          message={
            names.length
              ? `${names.join(', ')} ${names.length > 1 ? 'are not' : 'is not'} part of our catalogue — the link may be out of date.`
              : 'One of the filters in this link is not part of our catalogue, so we have not guessed at what you meant.'
          }
          primaryLabel="Clear all filters"
          onPrimary={clearAll}
          secondaryLabel="Shop all products"
          secondaryTo="/products"
          variant="page"
        />
      );
    }

    if (status === 'empty') {
      // THREE different empty states (LF-26), because they need three different exits.
      if (search) {
        return (
          <EmptyState
            icon={<SearchOffIcon />}
            title={`No products match “${search}”`}
            message="Try a shorter word, or browse the full range."
            primaryLabel="Shop all products"
            onPrimary={clearAll}
            variant="page"
          />
        );
      }
      if (anyFacetActive(filters)) {
        return (
          <EmptyState
            icon={<SearchOffIcon />}
            title="No products match these filters"
            message="Nothing in the catalogue meets all of them at once."
            primaryLabel="Clear all filters"
            onPrimary={clearAll}
            secondaryLabel="Shop all products"
            secondaryTo="/products"
            variant="page"
          />
        );
      }
      return (
        <EmptyState
          icon={<StorefrontOutlinedIcon />}
          title="Nothing here yet"
          message="There are no products on sale at the moment. New formulations are on the way."
          primaryLabel="Go to home"
          primaryTo="/"
          variant="page"
        />
      );
    }

    return (
      <>
        <Box sx={PRODUCT_GRID_SX} aria-busy={status === 'loading'}>
          {status === 'loading'
            ? showSkeletons
              ? <ProductCardSkeleton count={skeletonCount} />
              : null
            : products.map((product) => <ProductCard key={product.id} product={product} />)}
        </Box>

        {status === 'ready' && totalPages > 1 ? (
          <Box sx={{ mt: 4 }}>
            <ProductPagination count={totalPages} page={page} onChange={changePage} />
          </Box>
        ) : null}
      </>
    );
  })();

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', minHeight: '100vh', py: { xs: 2, md: 4 } }}>
      <SeoHead
        title={heading === 'All products' ? 'All products' : heading}
        description={
          introCopy ||
          'Browse every Le foyeR. formulation — cleansers, moisturisers, sun protection and haircare, with free standard delivery and 7-day returns.'
        }
        canonical={canonicalPath}
        noindex={!indexable}
        jsonLd={jsonLd}
      />

      <Container maxWidth="lg">
        {/* breadcrumb -> h1 -> indexable copy, ABOVE the grid (DESIGN_SYSTEM §8) */}
        <Box component="nav" aria-label="Breadcrumb" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
            <Typography
              component={RouterLink}
              to="/"
              variant="caption"
              sx={{ color: 'inherit', textDecoration: 'none' }}
            >
              Home
            </Typography>
            {' / '}
            {heading === 'All products' ? (
              'Products'
            ) : (
              <>
                <Typography
                  component={RouterLink}
                  to="/products"
                  variant="caption"
                  sx={{ color: 'inherit', textDecoration: 'none' }}
                >
                  Products
                </Typography>
                {` / ${heading}`}
              </>
            )}
          </Typography>
        </Box>

        <Typography variant="h1" component="h1" sx={{ mb: introCopy ? 1 : 2 }}>
          {heading}
        </Typography>
        {introCopy ? (
          <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)', maxWidth: '68ch', mb: 2 }}>
            {introCopy}
          </Typography>
        ) : null}

        <Box sx={{ display: 'flex', gap: { md: 4 }, alignItems: 'flex-start' }}>
          {/* ---------------- desktop rail: live, borderless, in tab order ---------------- */}
          {!isMobile ? (
            <Box
              sx={{
                width: 264,
                flexShrink: 0,
                position: 'sticky',
                top: 'calc(var(--lf-nav-h) + 24px)',
                maxHeight: 'calc(100vh - var(--lf-nav-h) - 48px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                pr: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="h5" component="h2">
                  Filters
                </Typography>
                {filterCount > 0 ? (
                  <Button
                    className="lf-press"
                    variant="text"
                    size="small"
                    onClick={clearAll}
                    sx={{ ...FOCUS_RING_SX, color: 'var(--lf-ink-2)' }}
                  >
                    Clear all
                  </Button>
                ) : null}
              </Box>
              {railFilter}
            </Box>
          ) : null}

          {/* ---------------- results column. `minWidth: 0` is load-bearing (§8). -------- */}
          <Box sx={{ flex: 1, minWidth: 0 }} ref={gridTopRef}>
            {/* mobile: one sticky 56px sub-bar, two 44px buttons (§6.7) */}
            {isMobile ? (
              <Box
                className="lf-glass"
                sx={{
                  position: 'sticky',
                  top: 'var(--lf-nav-h)',
                  zIndex: 2,
                  display: 'flex',
                  gap: 1,
                  py: 1,
                  mb: 1.5,
                  borderBottom: '1px solid var(--lf-hairline)',
                }}
              >
                <Button
                  className="lf-press"
                  fullWidth
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                  onClick={openFilters}
                  aria-haspopup="dialog"
                  aria-expanded={filtersOpen}
                  sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
                >
                  {filterCount > 0 ? `Filters (${filterCount})` : 'Filters'}
                </Button>
                <Button
                  className="lf-press"
                  fullWidth
                  variant="outlined"
                  startIcon={<SortIcon />}
                  onClick={() => setSortOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={sortOpen}
                  sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
                >
                  Sort
                </Button>
              </Box>
            ) : null}

            {/* one toolbar row: the TOTAL, not the page size (LF-09) */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                minHeight: 52,
                borderBottom: '1px solid var(--lf-hairline)',
                mb: 2,
              }}
            >
              <Typography variant="body2" role="status" aria-live="polite" sx={{ color: 'var(--lf-ink-2)' }}>
                {status === 'loading'
                  ? 'Loading products…'
                  : status === 'ready'
                    ? `${count} ${count === 1 ? 'product' : 'products'}${totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}`
                    : ''}
              </Typography>
              <Box component="span" className="lf-sr-only" aria-live="polite">
                {sheetNotice}
              </Box>
            </Box>

            {/* individually removable chips + Clear all */}
            {activeChips.length ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {activeChips.map((chip) => (
                  <Chip
                    key={`${chip.key}-${chip.value}`}
                    variant="filter"
                    label={chip.label}
                    onDelete={() => removeFilter(chip.key, chip.value)}
                    sx={{ ...FOCUS_RING_SX }}
                  />
                ))}
                <Button
                  className="lf-press"
                  variant="text"
                  size="small"
                  onClick={clearAll}
                  sx={{ ...FOCUS_RING_SX, color: 'var(--lf-ink-2)' }}
                >
                  Clear all
                </Button>
              </Stack>
            ) : null}

            {resultsRegion}
          </Box>
        </Box>
      </Container>

      {/* ---------------- mobile filter sheet: STAGED (§6.7) ---------------- */}
      <Drawer
        anchor="bottom"
        open={filtersOpen}
        onClose={() => dismissFilters('discard')}
        PaperProps={{
          sx: {
            maxHeight: '92dvh',
            borderTopLeftRadius: 'var(--lf-r-panel)',
            borderTopRightRadius: 'var(--lf-r-panel)',
            backgroundColor: 'var(--lf-surface)',
          },
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'Filters',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
          <Box aria-hidden="true" sx={{ width: 36, height: 5, borderRadius: 'var(--lf-r-pill)', backgroundColor: 'var(--lf-ink-4)' }} />
        </Box>

        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 56,
            px: 2,
            backgroundColor: 'var(--lf-surface)',
            borderBottom: '1px solid var(--lf-hairline)',
          }}
        >
          <Typography variant="h4" component="h2">
            Filters
          </Typography>
          <IconButton
            onClick={() => dismissFilters('discard')}
            aria-label="Close filters without applying"
            sx={{ width: 44, height: 44, ...FOCUS_RING_SX }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ px: 2, py: 2, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <ProductFilter
            value={draft}
            onChange={setDraft}
            taxonomy={taxonomy}
            taxonomyStatus={taxonomyStatus}
            onRetryTaxonomy={loadTaxonomy}
            priceBands={priceBands}
          />
        </Box>

        <Box
          className="lf-safe-bottom"
          sx={{
            position: 'sticky',
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            pt: 1.5,
            backgroundColor: 'var(--lf-surface)',
            borderTop: '1px solid var(--lf-hairline)',
          }}
        >
          <Button
            className="lf-press"
            variant="text"
            onClick={() => {
              setDraft({ ...EMPTY_FILTERS });
            }}
            sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX, color: 'var(--lf-ink-2)', flexShrink: 0 }}
          >
            Clear all
          </Button>
          <Button
            className="lf-press"
            variant="contained"
            color="primary"
            disableElevation
            fullWidth
            onClick={commitFilters}
            sx={{ minHeight: 52, ...FOCUS_RING_SX }}
          >
            {draftCount === null
              ? 'Show products'
              : `Show ${draftCount} ${draftCount === 1 ? 'product' : 'products'}`}
          </Button>
        </Box>
      </Drawer>

      {/* ---------------- mobile sort sheet: one choice, applied immediately ---------- */}
      <Drawer
        anchor="bottom"
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 'var(--lf-r-panel)',
            borderTopRightRadius: 'var(--lf-r-panel)',
            backgroundColor: 'var(--lf-surface)',
          },
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'Sort products',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, px: 2 }}>
          <Typography variant="h4" component="h2">
            Sort
          </Typography>
          <IconButton onClick={() => setSortOpen(false)} aria-label="Close sort options" sx={{ width: 44, height: 44, ...FOCUS_RING_SX }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box className="lf-safe-bottom" sx={{ px: 2, pb: 1 }}>
          {SORT_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.value || 'default'}
              sx={{ m: 0, minHeight: 48, width: '100%' }}
              control={
                <Radio
                  name="lf-sort"
                  checked={(filters.ordering || '') === option.value}
                  onChange={() => {
                    setSortOpen(false);
                    applyFilters({ ...filters, ordering: option.value });
                  }}
                  sx={{ ...FOCUS_RING_SX }}
                />
              }
              label={option.label}
            />
          ))}
        </Box>
      </Drawer>
    </Box>
  );
};

export default ProductListing;
