/**
 * ============================================================================
 * ProductListing — ART_DIRECTION.md §5.2. THE SHELF.
 *
 * **The URL is still the single source of truth** (LF-06 / LF-08). Everything
 * below is a change of chrome and geometry, not of contract: every facet, every
 * query parameter, `Clear all`, the refresh/Back round-trip, the three empty
 * copies, the unknown-filter state and the staged mobile sheet survive verbatim.
 *
 * WHAT §5.2 DELETES, AND WHERE EACH BEHAVIOUR LANDS
 *
 *  1. **The 264px always-open desktop filter rail** (§1.3). ~1,300px of facets —
 *     21 rows at 48px, eight reading `(0)` and inert — inside a ~790px nested
 *     scroller with no visible scrollbar on overlay-scrollbar platforms,
 *     consuming 23% of the content width to filter SIX products.
 *     → **LF-08 is preserved in full**: every facet moves into a desktop
 *       **`Refine` popover** that renders the *existing* `<ProductFilter>`,
 *       live, exactly as the rail did. Mobile keeps the *existing* staged
 *       bottom sheet with `Show N products` — live refetch per tick is
 *       unusable on Indian 4G, and that sheet is the best-built thing here.
 *
 *  2. **`repeat(auto-fill, minmax(156px, 1fr))`**, imported from a
 *     related-products rail (§1.3, §10.5). Verified at 1440: container 1232 −
 *     80 gutters = 1152, minus the 264px rail and a 32px gap = 856px of
 *     results column; `floor((856+12)/168)` = **5 tracks**; `(856−48)/5` =
 *     **161.6px cards**. That one number caused the mid-word name truncation
 *     ("Glow Game WaterLess…", "UV Armor Tinted…"), the two-line wrap inside
 *     `Add to bag` / `Notify me`, and the heart overlapping the Out-of-stock
 *     chip — all four visible in `plp-desk.png`.
 *     → `components/product/productGrid.js` (§4): explicit 1 / 2 / 3 columns
 *       with a 288px floor. Two full rows of three at 1440, **never a ragged
 *       final row at any breakpoint** (§2.29).
 *
 *  3. **The `h1` 48px `All products`** — the largest, boldest, highest-contrast
 *     element on a page whose products rendered at 161px.
 *     → `h3` 26px, `component="h1"`.
 *
 *  4. **The `Sub-category` facet UI** — the same eight options with the same
 *     counts as `Concern`, because `products/0008` derives one 1:1 from the
 *     other. → ONE taxonomy facet, **Concern**. `?sub_category=` stays a fully
 *     supported URL param: read, written, validated against the taxonomy, and
 *     rendered as an individually removable chip.
 *
 *  5. **Pagination.** Six products, `page_size` 24 — the control could never
 *     render. See `PAGINATION` below: the `page` parameter itself survives.
 *
 *  6. **~1,000px of dead space below a 6-item grid**, and the page's
 *     `minHeight: 100vh` (the same defect §5.9 names on `Wishlist`: it sits
 *     inside `Layout`'s flex column, so it guarantees a scrollbar and pushes
 *     the footer off-screen on every visit). The page now ends: grid → 64px →
 *     a 96px hearth band carrying `brand.territoryLine` → footer.
 *
 * WHAT §5.2 ADDS
 *
 *  · **ONE 52px toolbar row**, replacing ~160px of chrome. Left: the concern
 *    chips that actually have products, plus an `In stock (N)` toggle — this is
 *    where the deleted `ProductCategories` and `ShopByConcern` navigation lands
 *    (§1.3). Right: `Refine` and `Sort`.
 *  · **In-stock first by default** (§2.23), so the page never opens on three
 *    sold-out cards. A shopper who sorts explicitly gets their sort, untouched.
 *  · **Sort, fixed rather than re-decorated.** It printed its label twice —
 *    once as a gold overline from `<FacetGroup legend="Sort by">`, once as the
 *    field's own `<InputLabel>` — above a blank outlined box with only a caret,
 *    because the default value is `''` and MUI treats that as empty. One label,
 *    no facet wrapper, and `renderValue` so `''` reads `Recommended`.
 *  · **`Price` repaired, not deleted** (§2.25): the old ladder could never
 *    render once against a ₹480 ceiling. Bands now derive from the catalogue's
 *    real min and max.
 *
 * PAGINATION — READ BEFORE RESTORING IT
 * §5.2 is explicit: "No pagination for six products (the control is removed,
 * not rendered-and-empty)." `components/product/ProductPagination.jsx` is
 * deleted with it. **The `page` URL parameter is deliberately still read,
 * written and sent**, and the DRF-404-past-the-end fallback is still here, so
 * every `?page=2` link already in the wild resolves instead of 404ing. The
 * condition under which the control must come back is exactly one line:
 * `count > PRODUCT_PAGE_SIZE` (24). At that point products past the first page
 * are unreachable from this UI, and a control — not a bigger page size — is
 * the fix. Reported as a deviation.
 *
 * NO FABRICATED ANYTHING. Every number on this page is measured: the catalogue
 * total, the in-stock count, the facet counts and the price extremes all come
 * from the API. `brand.territoryLine` is read from `brand.js`, never retyped.
 * ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
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
import { useBrand } from '../content/brand';
import SeoHead, { absoluteUrl } from '../components/common/SeoHead';
import EmptyState, { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import ProductCardSkeleton, { useSkeletonDelay } from '../components/common/ProductCardSkeleton';
import ProductCard from '../components/product/ProductCard';
import ProductFilter, {
  MULTI_FACETS,
  SORT_OPTIONS,
  SortSelect,
  buildPriceBands,
  priceRangeLabel,
} from '../components/product/ProductFilter';
import { PRODUCT_GRID_SX, skeletonCount } from '../components/product/productGrid';
import { PRODUCT_PAGE_SIZE } from '../components/product/productPresentation';
import { stockState } from '../utils/stock';

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

/**
 * §10.21 forbids typing a count into a component, and §5.2's header copy is
 * written in words ("Six formulations. Three on the shelf today."). Both hold:
 * the NUMBERS come from the API, this only spells them. Past twelve it falls
 * back to digits rather than inventing an English numeral rule.
 */
const NUMBER_WORDS = Object.freeze([
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
]);
const numberWord = (value, { capital = false } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n >= NUMBER_WORDS.length) return String(value);
  const word = NUMBER_WORDS[n];
  return capital ? word : word.toLowerCase();
};

/**
 * §2.23 / §5.2 — **in stock sorts first, unless the shopper explicitly sorted.**
 * Opening `/products` on three sold-out cards for cold traffic reads as *sold
 * out*, not as *organised*.
 *
 * A stable partition, not a comparator, so the server's own merchandising
 * order (`display_order, -created_at`) survives inside each band. `coming_soon`
 * sits between sellable and out of stock: it keeps its lit niche and its
 * working link, but it cannot be bought today.
 *
 * It orders the PAGE, not the catalogue — at `page_size` 24 against a
 * six-product shop those are the same set, and pagination is deleted (§5.2).
 */
function inStockFirst(products) {
  const rank = (product) => {
    const stock = stockState(product);
    if (stock.sellable) return 0;
    return stock.lit ? 1 : 2;
  };
  return products
    .map((product, index) => ({ product, index, rank: rank(product) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.product);
}

/* -------------------------------------------------------------------------- *
 * §5.2's toolbar pill. 36px visual, 44px hit area (A6), and the selected state
 * is an ink fill PLUS a 2px --lf-gold-edge underline — never colour alone (A8).
 * -------------------------------------------------------------------------- */

const ToolbarChip = ({ selected, onClick, children }) => (
  <Button
    className="lf-press"
    onClick={onClick}
    aria-pressed={selected}
    disableElevation
    sx={{
      position: 'relative',
      flex: 'none',
      minHeight: 36,
      height: 36,
      px: '14px',
      py: 0,
      borderRadius: 'var(--lf-r-pill)',
      fontSize: '0.8125rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      border: '1px solid var(--lf-border-strong)',
      backgroundColor: selected ? 'var(--lf-ink)' : 'transparent',
      color: selected ? 'var(--lf-on-ink)' : 'var(--lf-ink)',
      /* §10.20 — no raw hex in a component. An unselected pill warms to the
         niche's own wall colour; a selected one is already the darkest thing
         in the row, so it answers with the press transform alone. */
      '@media (hover:hover)': {
        '&:hover': {
          backgroundColor: selected ? 'var(--lf-ink)' : 'var(--lf-mat)',
          borderColor: selected ? 'var(--lf-ink)' : 'var(--lf-border-strong)',
        },
      },
      /* A6 — a 44px hit area around a 36px pill. */
      '&::before': { content: '""', position: 'absolute', inset: -4 },
      /* A8 — the second, non-colour cue. 2px --lf-gold-edge at 3.16:1 on
         canvas, the same indicator the nav and the tab bar use. */
      '&::after': selected
        ? {
            content: '""',
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: -6,
            height: 2,
            backgroundColor: 'var(--lf-gold-edge)',
          }
        : undefined,
      '&.Mui-focusVisible': { outline: '2px solid var(--lf-focus)', outlineOffset: 2 },
    }}
  >
    {children}
  </Button>
);

const ProductListing = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();
  const brand = useBrand();

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

  /** Catalogue-level facts, fetched once: the header line, the `In stock (N)`
   *  toggle and the price bands are all measured, never typed. */
  const [catalogue, setCatalogue] = useState({
    total: null,
    inStock: null,
    minPrice: null,
    maxPrice: null,
  });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [refineAnchor, setRefineAnchor] = useState(null);
  const [draft, setDraft] = useState(filters);
  const [draftCount, setDraftCount] = useState(null);
  const [sheetNotice, setSheetNotice] = useState('');

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
    // toolbar chips now send people to — was treated as an unknown filter and silently emptied.
    //
    // `subCategories` is still fetched although its facet UI is deleted (§5.2): it is what
    // validates a `?sub_category=` slug from an old link and what names its removable chip.
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

  /* The catalogue's own facts. Three `page_size=1` responses, once per mount:
     the cheapest product, the dearest, and how many are buyable today. Nothing
     on this page states a count it did not measure. */
  useEffect(() => {
    let alive = true;
    Promise.all([
      listProducts({ ordering: 'price', page_size: 1 }).catch(() => null),
      listProducts({ ordering: '-price', page_size: 1 }).catch(() => null),
      listProducts({ in_stock: true, page_size: 1 }).catch(() => null),
    ]).then(([cheapest, dearest, inStock]) => {
      if (!alive) return;
      const low = Number(cheapest?.items?.[0]?.price);
      const high = Number(dearest?.items?.[0]?.price);
      setCatalogue({
        total: Number.isFinite(cheapest?.count) ? cheapest.count : null,
        inStock: Number.isFinite(inStock?.count) ? inStock.count : null,
        minPrice: Number.isFinite(low) && low > 0 ? low : null,
        maxPrice: Number.isFinite(high) && high > 0 ? high : null,
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  /* §2.25 — derived from the REAL extremes, so the facet can no longer be a
     render condition that is false for the entire catalogue (§10.22). */
  const priceBands = useMemo(
    () => buildPriceBands(catalogue.minPrice, catalogue.maxPrice),
    [catalogue.minPrice, catalogue.maxPrice],
  );

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
      // first page of the same filter set. The pagination CONTROL is deleted (§5.2);
      // this fallback is why deleting it does not break the links already in the wild.
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

  /** §2.23 — the shopper's explicit sort always wins over the default. */
  const orderedProducts = useMemo(
    () => (filters.ordering ? products : inStockFirst(products)),
    [filters.ordering, products],
  );

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
        // No dependent pruning: `sub_category` no longer has a facet UI, so the
        // only thing pruning could do now is silently discard the slug an old
        // link arrived with. Its chip is right here and removes it explicitly.
        next[key] = (filters[key] || []).filter((slug) => slug !== value);
      } else {
        next[key] = key === 'ordering' ? '' : null;
      }
      applyFilters(next);
    },
    [applyFilters, filters, setSearchParams],
  );

  const toggleConcern = useCallback(
    (slug) => {
      const current = filters.concern || [];
      applyFilters({
        ...filters,
        concern: current.includes(slug)
          ? current.filter((item) => item !== slug)
          : [...current, slug],
      });
    },
    [applyFilters, filters],
  );

  const toggleInStock = useCallback(() => {
    applyFilters({ ...filters, in_stock: filters.in_stock === true ? null : true });
  }, [applyFilters, filters]);

  const setOrdering = useCallback(
    (ordering) => applyFilters({ ...filters, ordering }),
    [applyFilters, filters],
  );

  /* ------------------------------------------------------------------ *
   * Refine — one trigger, two presentations, ONE ProductFilter
   * ------------------------------------------------------------------ */

  const openRefine = (event) => {
    if (isMobile) {
      // The mobile sheet is STAGED. Nothing refetches until "Show N products"
      // is tapped: live refetch per tick is unusable on Indian 4G.
      setDraft(filters);
      setDraftCount(count);
      setSheetNotice('');
      setFiltersOpen(true);
      return;
    }
    // The desktop popover is LIVE, exactly as the rail it replaces was.
    setRefineAnchor(event.currentTarget);
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

  /** The concern chips that actually have products (§5.2, LF-24's render rule). */
  const concernChips = useMemo(
    () =>
      (taxonomy.concerns || []).filter((concern) => {
        const productCount = Number(concern.listed_count ?? concern.product_count);
        return Number.isFinite(productCount) ? productCount > 0 : true;
      }),
    [taxonomy.concerns],
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
      chips.push({
        key: 'price',
        value: 'price',
        label: priceRangeLabel(priceBands, filters.min_price, filters.max_price),
      });
    }
    if (filters.ordering) {
      const option = SORT_OPTIONS.find((item) => item.value === filters.ordering);
      if (option) chips.push({ key: 'ordering', value: filters.ordering, label: `Sorted: ${option.label}` });
    }
    return chips;
  }, [filters, nameFor, priceBands, search]);

  const filterCount = activeChips.filter((chip) => chip.key !== 'ordering').length;

  /** The page's own name, built only from facts in the URL and the taxonomy. */
  const { heading, seoTitle, introCopy, canonicalPath, indexable } = useMemo(() => {
    const singleCategory = filters.category.length === 1 ? filters.category[0] : null;
    const singleSub = filters.sub_category.length === 1 ? filters.sub_category[0] : null;
    const singleConcern = filters.concern.length === 1 ? filters.concern[0] : null;

    // §5.2: the unfiltered page is THE SHELF, at h3 26px — not `All products`
    // at h1 48px, which made the page's loudest element a label for a page you
    // were already on. The indexable <title> stays the plain-language one.
    let title = null;
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
      heading: title || 'The shelf',
      seoTitle: title || 'All products',
      introCopy: intro,
      canonicalPath: canonicalQuery ? `/products?${canonicalQuery}` : '/products',
      indexable: isIndexable,
    };
  }, [filters, nameFor, page, search, taxonomy.concerns]);

  /**
   * §5.2's sub-head, with every number measured rather than typed (§10.21):
   * "Six formulations. Three on the shelf today." It only renders once both
   * counts are known — a sentence about the shop is not worth a guess.
   */
  const shelfLine = useMemo(() => {
    const { total, inStock } = catalogue;
    if (!Number.isFinite(total) || total <= 0) return null;
    const formulations = `${numberWord(total, { capital: true })} ${total === 1 ? 'formulation' : 'formulations'}.`;
    if (!Number.isFinite(inStock)) return formulations;
    if (inStock === 0) return `${formulations} None on the shelf today.`;
    return `${formulations} ${numberWord(inStock, { capital: true })} on the shelf today.`;
  }, [catalogue]);

  const jsonLd = useMemo(() => {
    const collectionUrl = absoluteUrl(canonicalPath);
    const crumbs = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Products', item: absoluteUrl('/products') },
    ];
    if (seoTitle !== 'All products' && !search) {
      crumbs.push({ '@type': 'ListItem', position: 3, name: seoTitle, item: collectionUrl });
    }

    const documents = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs }];

    if (status === 'ready') {
      documents.push({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: seoTitle,
        description: introCopy || undefined,
        url: collectionUrl,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: count,
          // The order the shopper actually sees (§2.23), so the structured
          // data cannot disagree with the page.
          itemListElement: orderedProducts.map((product, index) => ({
            '@type': 'ListItem',
            position: (page - 1) * PRODUCT_PAGE_SIZE + index + 1,
            name: product.name,
            url: absoluteUrl(`/product/${product.slug}`),
          })),
        },
      });
    }

    return documents;
  }, [canonicalPath, count, introCopy, orderedProducts, page, search, seoTitle, status]);

  const showSkeletons = useSkeletonDelay(status === 'loading');
  const skeletons = skeletonCount(count || 6, isMobile ? 2 : 3);
  const refineOpen = Boolean(refineAnchor);

  /* ------------------------------------------------------------------ *
   * render
   * ------------------------------------------------------------------ */

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
      <Box sx={PRODUCT_GRID_SX} aria-busy={status === 'loading'}>
        {status === 'loading'
          ? showSkeletons
            ? <ProductCardSkeleton count={skeletons} />
            : null
          : orderedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
      </Box>
    );
  })();

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)' }}>
      <SeoHead
        title={seoTitle}
        description={
          introCopy ||
          'Browse every Le foyeR. formulation — cleansers, moisturisers, sun protection and haircare, with free standard delivery and 7-day returns.'
        }
        canonical={canonicalPath}
        noindex={!indexable}
        jsonLd={jsonLd}
      />

      <Container maxWidth="lg" sx={{ pt: 'var(--lf-sect-sm)', pb: 0 }}>
        {/* ---- HEADER: breadcrumb -> h3 -> one line -> ledge ------------- */}
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
            {heading === 'The shelf' ? (
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

        <Typography variant="h3" component="h1" sx={{ color: 'var(--lf-ink)' }}>
          {heading}
        </Typography>

        {introCopy || shelfLine ? (
          <Typography
            variant="body2"
            sx={{ color: 'var(--lf-ink-3)', maxWidth: '62ch', mt: 1 }}
          >
            {introCopy || shelfLine}
          </Typography>
        ) : null}

        <Box className="lf-ledge" sx={{ mt: 2 }} />

        {/* ---- §5.2's ONE TOOLBAR ROW ------------------------------------
            It replaces ~160px of stacked chrome AND the 264px / ~1,300px
            rail. Below the `shelf` breakpoint the chip scroller takes its own
            line rather than being squeezed to ~88px of visible track — the
            §5.2 arithmetic is written for the desktop row it replaces. */}
        <Box
          sx={{
            position: 'sticky',
            top: 'var(--lf-nav-h)',
            zIndex: 3,
            /* OPAQUE canvas, never glass: a second blurred bar above a
               scrolling grid is exactly the cost P6 refuses on a mid-range
               Android. */
            backgroundColor: 'var(--lf-canvas)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            minHeight: 52,
            mt: 3,
          }}
        >
          {/* LEFT: the navigation the deleted ProductCategories and
              ShopByConcern used to carry, as the only concerns that have
              products, plus the availability toggle. */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
              flex: { xs: '1 0 100%', shelf: '1 1 auto' },
              order: { xs: 2, shelf: 1 },
              overflowX: 'auto',
              /* room for the selected pill's -6px gold underline, pulled back
                 out so it costs the row no height */
              pt: '2px',
              pb: '10px',
              mb: '-10px',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              /* A right-edge fade so the row LOOKS scrollable. Without it the track
                 clipped mid-word at 390px ("Body Care (" with the count sliced off)
                 and the "In stock" chip — the highest-value facet on the page —
                 read as unreachable. A mask, not a blur: §9.4/P6 forbids blur in a
                 scrolling list, and a mask costs no compositing work.
                 It is painted only while the row actually overflows, and dropped for
                 anyone who has asked for less transparency. */
              '@media (min-width: 0px)': {
                maskImage:
                  'linear-gradient(to right, #000 calc(100% - 32px), transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to right, #000 calc(100% - 32px), transparent 100%)',
              },
              '&[data-scroll-end="true"]': { maskImage: 'none', WebkitMaskImage: 'none' },
              '@media (prefers-reduced-transparency: reduce)': {
                maskImage: 'none',
                WebkitMaskImage: 'none',
              },
            }}
            onScroll={(event) => {
              const el = event.currentTarget;
              const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
              el.setAttribute('data-scroll-end', atEnd ? 'true' : 'false');
            }}
          >
            {concernChips.map((concern) => {
              /* `listed_count`, not `product_count`: selecting a facet returns every
                 VISIBLE product (LF-02 keeps out-of-stock items listed with a Notify me),
                 while `product_count` counts only what is buyable, which is what LF-24
                 gates tile visibility on. Printing the latter here made the chip
                 "Cleansers (1)" return four products. */
              const productCount = Number(
                concern.listed_count ?? concern.product_count,
              );
              return (
                <ToolbarChip
                  key={concern.slug}
                  selected={(filters.concern || []).includes(concern.slug)}
                  onClick={() => toggleConcern(concern.slug)}
                >
                  {Number.isFinite(productCount)
                    ? `${concern.name} (${productCount})`
                    : concern.name}
                </ToolbarChip>
              );
            })}
            {Number.isFinite(catalogue.inStock) && catalogue.inStock > 0 ? (
              <ToolbarChip selected={filters.in_stock === true} onClick={toggleInStock}>
                {`In stock (${catalogue.inStock})`}
              </ToolbarChip>
            ) : null}
          </Box>

          {/* RIGHT: Refine + Sort. */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flex: { xs: '1 1 100%', shelf: '0 0 auto' },
              order: { xs: 1, shelf: 2 },
              ml: { shelf: 'auto' },
            }}
          >
            <Button
              className="lf-press"
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={openRefine}
              aria-haspopup="dialog"
              aria-expanded={isMobile ? filtersOpen : refineOpen}
              sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX, flex: { xs: 1, shelf: 'none' }, whiteSpace: 'nowrap' }}
            >
              {filterCount > 0 ? `Refine (${filterCount})` : 'Refine'}
            </Button>

            {isMobile ? (
              <Button
                className="lf-press"
                variant="outlined"
                startIcon={<SortIcon />}
                onClick={() => setSortOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sortOpen}
                sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX, flex: 1, whiteSpace: 'nowrap' }}
              >
                Sort
              </Button>
            ) : (
              <SortSelect value={filters.ordering} onChange={setOrdering} />
            )}
          </Box>
        </Box>

        {/* ---- the results region ---------------------------------------- */}
        <Box sx={{ mt: 3, minWidth: 0 }}>
          {/* The count is news only when something has narrowed the page; the
              header already states the catalogue's size. LF-09: it is always
              the TOTAL from `count`, never `products.length`. */}
          <Typography
            variant="caption"
            component="p"
            role="status"
            aria-live="polite"
            sx={{ display: 'block', m: 0, mb: 1.5, minHeight: 19, color: 'var(--lf-ink-3)' }}
          >
            {status === 'loading'
              ? 'Loading products…'
              : status === 'ready' && (search || anyFacetActive(filters))
                ? `${count} ${count === 1 ? 'product' : 'products'}`
                : ''}
            {sheetNotice ? <span className="lf-sr-only">{` ${sheetNotice}`}</span> : null}
          </Typography>

          {/* individually removable chips + Clear all. This is where a
              `?sub_category=` slug from an old link stays visible and
              removable now that its facet UI is gone. */}
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
      </Container>

      {/* ---- THE PAGE ENDS (§5.2): grid -> 64px -> the footer ------------
          No "You might also like", no filler, no 1,000px of void.

          There was a 96px hearth band here carrying brand.territoryLine. It is
          gone because the footer opens with the SAME sentence 105px further
          down, so the page printed the brand's closing line twice in two
          near-identical dark bands separated by a strip of canvas. §5.11 is
          explicit that the hearth sentence is THE BRAND'S LAST WORD, which
          only works if it is said once. The 64px of air plus the footer is the
          cleaner ending. */}
      <Box sx={{ mt: 8 }} />

      {/* ---- DESKTOP: the Refine popover. LF-08, intact. -----------------
          The SAME <ProductFilter> the rail rendered, live, writing the same
          URL params. MUI's Popover is modal: Escape closes it and focus is
          trapped, so `Clear all` and the refresh/Back round-trip behave
          exactly as they did in the rail. */}
      <Popover
        open={refineOpen}
        anchorEl={refineAnchor}
        onClose={() => setRefineAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': 'Filters',
            sx: {
              mt: 1,
              width: 360,
              maxWidth: 'calc(100vw - 2 * var(--lf-gutter))',
              backgroundColor: 'var(--lf-paper)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - var(--lf-nav-h) - 96px)',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 2,
            py: 1.5,
            borderBottom: '1px solid var(--lf-hairline)',
          }}
        >
          <Typography variant="h5" component="h2">
            Filters
          </Typography>
          <IconButton
            onClick={() => setRefineAnchor(null)}
            aria-label="Close filters"
            sx={{ width: 44, height: 44, ...FOCUS_RING_SX }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* `.lf-scroll` keeps the focus ring inside the scroller (A7). */}
        <Box
          className="lf-scroll"
          sx={{ px: 2, py: 2, overflowY: 'auto', overscrollBehavior: 'contain' }}
        >
          <ProductFilter
            value={filters}
            onChange={applyFilters}
            taxonomy={taxonomy}
            taxonomyStatus={taxonomyStatus}
            onRetryTaxonomy={loadTaxonomy}
            priceBands={priceBands}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: 2,
            py: 1.5,
            borderTop: '1px solid var(--lf-hairline)',
          }}
        >
          <Button
            className="lf-press"
            variant="text"
            onClick={clearAll}
            sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX, color: 'var(--lf-ink-2)' }}
          >
            Clear all
          </Button>
          <Button
            className="lf-press"
            variant="outlined"
            onClick={() => setRefineAnchor(null)}
            sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
          >
            Done
          </Button>
        </Box>
      </Popover>

      {/* ---- MOBILE: the existing STAGED filter sheet, unchanged --------- */}
      <Drawer
        anchor="bottom"
        open={filtersOpen}
        onClose={() => dismissFilters('discard')}
        PaperProps={{
          sx: {
            maxHeight: '92dvh',
            borderTopLeftRadius: 'var(--lf-r-panel)',
            borderTopRightRadius: 'var(--lf-r-panel)',
            backgroundColor: 'var(--lf-paper)',
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
            backgroundColor: 'var(--lf-paper)',
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

        <Box className="lf-scroll" sx={{ px: 2, py: 2, overflowY: 'auto', overscrollBehavior: 'contain' }}>
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
            backgroundColor: 'var(--lf-paper)',
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

      {/* ---- MOBILE: sort sheet, one choice, applied immediately --------- */}
      <Drawer
        anchor="bottom"
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 'var(--lf-r-panel)',
            borderTopRightRadius: 'var(--lf-r-panel)',
            backgroundColor: 'var(--lf-paper)',
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
                    setOrdering(option.value);
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
