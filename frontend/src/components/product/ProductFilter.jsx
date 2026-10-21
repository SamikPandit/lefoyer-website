/**
 * ============================================================================
 * ProductFilter — ART_DIRECTION.md §1.3 / §5.2. LF-08, PRESERVED IN FULL.
 *
 * The 264px always-open desktop rail is deleted (§1.3): ~1,300px of facets —
 * 21 rows at 48px, eight of them reading `(0)` and inert — forced into a
 * ~790px nested scroller, consuming 23% of the content width to filter SIX
 * items. **Only the always-open rail dies.** This component is unchanged in
 * kind: it is still the ONE controlled facet component, and it is now rendered
 * in two places instead of two:
 *
 *   · the desktop **Refine popover** (live, same as the rail it replaces)
 *   · the existing staged mobile bottom sheet with `Show N products`
 *
 * Same URL params, same Clear all, same refresh/Back round-trip, same
 * `aria-disabled` + visible count on zero-count rows.
 *
 * WHAT CHANGED IN THIS FILE, AND ONLY THIS
 *
 * 1. **The `Sub-category` facet UI is deleted** (§1.3, §5.2). It rendered the
 *    same eight options with the same counts as `Concern`, character for
 *    character, because backend migration `products/0008` derives one 1:1 from
 *    the other. ONE taxonomy facet, labelled with the shopper-facing word:
 *    **Concern**. The `sub_category` URL parameter stays fully supported — the
 *    listing reads it, writes it, validates it against the taxonomy and
 *    renders it as an individually removable chip, so an old link or campaign
 *    keeps working and its filter is still visible and removable.
 *
 *    The dependent-facet pruning went with it. It existed so the URL could not
 *    keep a filter this UI could neither display nor remove; the listing's
 *    chip row now does both, so pruning would only silently discard the slug
 *    an old link arrived with.
 *
 * 2. **Sort leaves the facet list** (§5.2). It was wrapped in
 *    `<FacetGroup legend="Sort by">` AND given its own `<InputLabel>Sort by</InputLabel>`,
 *    so the label printed twice — once as a gold overline, once as the field's
 *    floating label — above a **blank outlined box with only a caret**,
 *    because the default value is `''` and MUI treats that as empty. The
 *    `FacetGroup` wrapper is dropped (sort is not a facet), ONE `InputLabel`
 *    survives, and `renderValue` makes `''` display **`Recommended`**.
 *    It is exported as `<SortSelect>` and rendered once, in the §5.2 toolbar.
 *
 * 3. **`Price` is repaired, not deleted** (§2.25, §10.22). Verified dead:
 *    `edges = [500,1000,2000,5000].filter(e => ceiling > e)` against a ₹480
 *    ceiling emptied `bands`, `previous` stayed `null` so no "and above" band
 *    was pushed, and `if (priceBands.length)` could never be true — **the
 *    facet has never rendered once in production.** Deleting the UI would have
 *    left the bug in the tree for the next person. The bands are now derived
 *    from the catalogue's REAL min and max (§5.2's `Under ₹300` · `₹300 – ₹400`
 *    · `₹400+` falls straight out of ₹280–₹480).
 *
 * 4. Token hygiene: `--lf-surface-sunken` → `--lf-mat`, `overline` → `eyebrow`
 *    (§3.1, §3.7 — both are deprecated aliases due to be deleted in step 9.10).
 *
 * UNCHANGED, DELIBERATELY
 *  - **A pure controlled component.** `value` in, `onChange(next)` out,
 *    taxonomy passed as props by the listing. It holds no state and performs
 *    no requests, which is the only way "works identically in the desktop
 *    popover and the mobile sheet" can be true rather than aspirational: the
 *    popover passes the live URL state, the sheet passes a draft, and neither
 *    needs a different component. STAGING LIVES IN THE PARENT.
 *  - **Each facet is a `<fieldset>` with a `<legend>`**, so a screen reader
 *    hears "Concern, group" before the first option.
 *  - **Counts live inside the label text** (`Cleansers (1)`) so they are
 *    announced, and a zero-count row is `aria-disabled` — NOT `disabled` — so
 *    it stays discoverable with the count explaining why (A4).
 *  - **The whole 48px row is the `<label>`**, so the row IS the hit target (A6).
 *  - **No `Paper`, no border, no background**: type and hairlines do the
 *    hierarchy, not boxes.
 * ========================================================================== */

import { useId } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Radio from '@mui/material/Radio';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import ErrorState from '../common/ErrorState';
import { FOCUS_RING_SX } from '../common/EmptyState';
import { formatRupees } from './productPresentation';

/**
 * The sort menu. Every value is a real `ordering_fields` entry on
 * `ProductViewSet` (`price`, `created_at`, `name`, `rating`, `reviews_count`,
 * `display_order`) — `?ordering=` used to be discarded silently, so an
 * invented value here would look like it worked and quietly do nothing.
 *
 * `''` means "send no `ordering` at all" and let the server's own
 * `['display_order', '-created_at']` merchandising order stand — which the
 * listing then opens in-stock-first (§2.23).
 */
export const SORT_OPTIONS = Object.freeze([
  { value: '', label: 'Recommended' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
  { value: '-created_at', label: 'Newest first' },
  { value: 'name', label: 'Name: A to Z' },
  { value: '-reviews_count', label: 'Most reviewed' },
]);

/**
 * The facet keys that hold an array of slugs, in render order.
 *
 * `sub_category` is STILL HERE even though its facet UI is deleted (§5.2):
 * this constant is what the listing uses to read the query string, write it
 * back, validate it against the taxonomy and build its removable chips. Drop
 * it from this array and `/products?sub_category=cleansers` — a live campaign
 * link — silently loses its filter.
 */
export const MULTI_FACETS = Object.freeze(['category', 'sub_category', 'concern', 'skin_type']);

/** The facet keys this component actually draws a control for. */
export const VISIBLE_FACETS = Object.freeze(['category', 'concern', 'skin_type']);

/**
 * The step ladder for price bands. The first step that lands the catalogue in
 * four bands or fewer wins, so a ₹280–₹480 shelf gets ₹100 steps and a
 * ₹280–₹12,000 one gets ₹2,500 steps, with no per-catalogue tuning.
 */
const BAND_STEPS = Object.freeze([50, 100, 250, 500, 1000, 2500, 5000, 10000]);

/**
 * Price bands derived from the catalogue's REAL extremes (§2.25), so we can
 * never offer a band no product can fall into — and never ship a facet whose
 * render condition is false for the entire catalogue (§10.22).
 *
 * Upper bounds are EXCLUSIVE (`max = edge - 1`). `Under ₹300` must not also
 * contain the three ₹300 products that `₹300 – ₹400` claims, or the two bands
 * would overlap and their counts would not sum to the catalogue.
 *
 * At the real catalogue (min ₹280, max ₹480) this returns exactly §5.2's
 * ladder: `Under ₹300` · `₹300 – ₹400` · `₹400+`.
 *
 * @param {number|null} minPrice The cheapest price in the catalogue.
 * @param {number|null} maxPrice The dearest price in the catalogue.
 * @returns {Array<{id:string,label:string,min:number|null,max:number|null}>}
 *   Empty when the catalogue cannot be meaningfully banded — one price, no
 *   prices, or a range narrower than the finest step. The caller renders no
 *   Price facet at all rather than a one-option chooser.
 */
export function buildPriceBands(minPrice, maxPrice) {
  const min = Number(minPrice);
  const max = Number(maxPrice);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min) return [];

  const step = BAND_STEPS.find(
    (candidate) => Math.ceil(max / candidate) - Math.floor(min / candidate) <= 4,
  );
  if (!step) return [];

  const edges = [];
  for (let edge = (Math.floor(min / step) + 1) * step; edge < max; edge += step) {
    edges.push(edge);
  }
  if (!edges.length) return [];

  const bands = [];
  let previous = null;
  edges.forEach((edge) => {
    bands.push({
      id: `${previous ?? 0}-${edge}`,
      label:
        previous === null
          ? `Under ${formatRupees(edge)}`
          : `${formatRupees(previous)} – ${formatRupees(edge)}`,
      min: previous,
      max: edge - 1,
    });
    previous = edge;
  });
  bands.push({
    id: `${previous}-plus`,
    label: `${formatRupees(previous)}+`,
    min: previous,
    max: null,
  });

  return bands;
}

/** A band id for the current min/max pair, `'any'`, or `'custom'`. */
export function matchPriceBand(bands, minPrice, maxPrice) {
  const min = minPrice === null || minPrice === undefined || minPrice === '' ? null : Number(minPrice);
  const max = maxPrice === null || maxPrice === undefined || maxPrice === '' ? null : Number(maxPrice);
  if (min === null && max === null) return 'any';
  const hit = (bands || []).find((band) => (band.min ?? null) === min && (band.max ?? null) === max);
  return hit ? hit.id : 'custom';
}

/** The human label for a min/max pair, preferring a real band's own wording. */
export function priceRangeLabel(bands, minPrice, maxPrice) {
  const id = matchPriceBand(bands, minPrice, maxPrice);
  const hit = (bands || []).find((band) => band.id === id);
  if (hit) return hit.label;
  const min = minPrice !== null && minPrice !== undefined ? formatRupees(minPrice) : null;
  const max = maxPrice !== null && maxPrice !== undefined ? formatRupees(maxPrice) : null;
  if (min && max) return `${min} – ${max}`;
  if (max) return `Under ${max}`;
  return min ? `${min}+` : 'Any price';
}

/* -------------------------------------------------------------------------- *
 * Sort — ONE label, and `''` renders as `Recommended` (§5.2)
 * -------------------------------------------------------------------------- */

/**
 * The listing's sort control. Lives in the §5.2 toolbar, not in the facet list:
 * sort is not a facet, and wrapping it in one is what printed its label twice.
 *
 * `displayEmpty` + an explicit `renderValue` is the whole fix for the blank
 * outlined box: the default value is `''`, MUI treats that as empty, and the
 * field rendered as a caret with nothing beside it.
 *
 * @param {object} props
 * @param {string} props.value One of `SORT_OPTIONS[].value`. `''` = Recommended.
 * @param {Function} props.onChange Called with the next ordering string.
 * @param {object} [props.sx]
 */
export const SortSelect = ({ value, onChange, sx }) => {
  const baseId = useId();
  const labelId = `${baseId}-sort-label`;
  const current = value || '';
  const selected = SORT_OPTIONS.find((option) => option.value === current) || SORT_OPTIONS[0];

  return (
    <FormControl size="small" sx={{ minWidth: 172, ...sx }}>
      <InputLabel id={labelId} shrink>
        Sort by
      </InputLabel>
      <Select
        labelId={labelId}
        value={current}
        displayEmpty
        input={<OutlinedInput notched label="Sort by" />}
        renderValue={() => selected.label}
        onChange={(event) => onChange(event.target.value)}
        sx={{ ...FOCUS_RING_SX }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem key={option.value || 'default'} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

/* -------------------------------------------------------------------------- *
 * presentation primitives
 * -------------------------------------------------------------------------- */

const ROW_SX = {
  m: 0,
  minHeight: 48,
  width: '100%',
  alignItems: 'center',
  borderRadius: 'var(--lf-r-field)',
  pr: 1,
  '& .MuiFormControlLabel-label': { fontSize: '0.9375rem', color: 'var(--lf-ink)' },
  '@media (hover: hover)': { '&:hover': { backgroundColor: 'var(--lf-mat)' } },
  '&[aria-disabled="true"] .MuiFormControlLabel-label': { color: 'var(--lf-ink-3)' },
};

/** A facet group. `<fieldset>` + `<legend>`, hairline-separated, no box. */
const FacetGroup = ({ legend, children, hint }) => (
  <Box
    component="fieldset"
    sx={{
      border: 0,
      borderTop: '1px solid var(--lf-hairline)',
      m: 0,
      px: 0,
      pt: 2,
      pb: 2,
      minWidth: 0,
      '&:first-of-type': { borderTop: 0, pt: 0 },
    }}
  >
    <Typography component="legend" variant="eyebrow" sx={{ color: 'var(--lf-ink-3)', px: 0, mb: 1 }}>
      {legend}
    </Typography>
    {hint ? (
      <Typography variant="caption" sx={{ display: 'block', color: 'var(--lf-ink-3)', mb: 1 }}>
        {hint}
      </Typography>
    ) : null}
    {children}
  </Box>
);

/**
 * One checkbox facet list.
 * A zero-count option is `aria-disabled` and still focusable, with the count
 * telling the customer why it would return nothing (A4).
 */
const CheckboxFacet = ({ legend, hint, options, selected, onToggle, emptyText }) => {
  if (!options.length) {
    return (
      <FacetGroup legend={legend} hint={hint}>
        <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
          {emptyText}
        </Typography>
      </FacetGroup>
    );
  }

  return (
    <FacetGroup legend={legend} hint={hint}>
      {options.map((option) => {
        const isSelected = selected.includes(option.slug);
        /* See ProductListing: a facet label must report what selecting it returns.
           `product_count` is buyable-only and is for LF-24 tile visibility; this
           list filters on visibility, so eight facets that read "(0)" were not in
           fact inert — they would have returned out-of-stock products. */
        const count = Number(option.listed_count ?? option.product_count);
        const hasCount = Number.isFinite(count);
        const isEmpty = hasCount && count === 0 && !isSelected;

        return (
          <FormControlLabel
            key={option.slug}
            aria-disabled={isEmpty ? 'true' : undefined}
            sx={ROW_SX}
            control={
              <Checkbox
                checked={isSelected}
                onChange={() => {
                  // aria-disabled, not disabled: the control keeps focus and the row
                  // stays discoverable, but ticking it is a no-op.
                  if (isEmpty) return;
                  onToggle(option.slug);
                }}
                size="medium"
                sx={{ ...FOCUS_RING_SX }}
              />
            }
            label={hasCount ? `${option.name} (${count})` : option.name}
          />
        );
      })}
    </FacetGroup>
  );
};

/**
 * @param {object} props
 * @param {object} props.value `{category[], sub_category[], concern[], skin_type[],
 *   in_stock, min_price, max_price, ordering}` — slugs, never ids, so the URL this
 *   produces is shareable and indexable (LF-06/LF-08).
 * @param {Function} props.onChange Called with the COMPLETE next value.
 * @param {object} props.taxonomy `{categories, subCategories, concerns, skinTypes}`
 * @param {'loading'|'error'|'ready'} [props.taxonomyStatus='ready']
 * @param {Function} [props.onRetryTaxonomy]
 * @param {Array} [props.priceBands] From `buildPriceBands()`.
 */
const ProductFilter = ({
  value,
  onChange,
  taxonomy,
  taxonomyStatus = 'ready',
  onRetryTaxonomy,
  priceBands = [],
}) => {
  const categories = taxonomy?.categories || [];
  const concerns = taxonomy?.concerns || [];
  const skinTypes = taxonomy?.skinTypes || [];

  const selected = {
    category: value?.category || [],
    concern: value?.concern || [],
    skin_type: value?.skin_type || [],
  };

  const toggle = (key, slug) => {
    const current = selected[key];
    const next = current.includes(slug)
      ? current.filter((item) => item !== slug)
      : [...current, slug];
    onChange({ ...value, [key]: next });
  };

  const selectedBandId = matchPriceBand(priceBands, value?.min_price, value?.max_price);

  return (
    <Box
      component="nav"
      aria-label="Filters"
      sx={{ minWidth: 0, backgroundColor: 'transparent', border: 0 }}
    >
      <FacetGroup legend="Availability">
        <FormControlLabel
          sx={ROW_SX}
          control={
            <Checkbox
              checked={value?.in_stock === true}
              onChange={(event) =>
                onChange({ ...value, in_stock: event.target.checked ? true : null })
              }
              sx={{ ...FOCUS_RING_SX }}
            />
          }
          label="In stock only"
        />
      </FacetGroup>

      {taxonomyStatus === 'error' ? (
        // An inline failure keeps availability and price alive: a failed filter
        // fetch must not take the grid down with it.
        <Box sx={{ borderTop: '1px solid var(--lf-hairline)', pt: 2, pb: 2 }}>
          <ErrorState
            title="Couldn't load filters"
            onRetry={onRetryTaxonomy}
            secondaryLabel={null}
            variant="inline"
            headingComponent="h3"
          />
        </Box>
      ) : taxonomyStatus === 'loading' ? (
        <Box sx={{ borderTop: '1px solid var(--lf-hairline)', pt: 2, pb: 2 }}>
          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }} role="status">
            Loading filters…
          </Typography>
        </Box>
      ) : (
        <>
          <CheckboxFacet
            legend="Category"
            options={categories}
            selected={selected.category}
            onToggle={(slug) => toggle('category', slug)}
            emptyText="No categories available."
          />

          {/* ONE taxonomy facet, labelled with the shopper-facing word. The
              Sub-category list was this list again, character for character
              (products/0008 derives one 1:1 from the other). */}
          <CheckboxFacet
            legend="Concern"
            options={concerns}
            selected={selected.concern}
            onToggle={(slug) => toggle('concern', slug)}
            emptyText="No concerns available."
          />

          <CheckboxFacet
            legend="Skin type"
            options={skinTypes}
            selected={selected.skin_type}
            onToggle={(slug) => toggle('skin_type', slug)}
            emptyText="No skin types available."
          />
        </>
      )}

      {priceBands.length ? (
        <FacetGroup legend="Price">
          <FormControlLabel
            sx={ROW_SX}
            control={
              <Radio
                checked={selectedBandId === 'any'}
                onChange={() => onChange({ ...value, min_price: null, max_price: null })}
                name="lf-price-band"
                sx={{ ...FOCUS_RING_SX }}
              />
            }
            label="Any price"
          />
          {priceBands.map((band) => (
            <FormControlLabel
              key={band.id}
              sx={ROW_SX}
              control={
                <Radio
                  checked={selectedBandId === band.id}
                  onChange={() => onChange({ ...value, min_price: band.min, max_price: band.max })}
                  name="lf-price-band"
                  sx={{ ...FOCUS_RING_SX }}
                />
              }
              label={band.label}
            />
          ))}
          {selectedBandId === 'custom' ? (
            <FormControlLabel
              sx={ROW_SX}
              control={
                <Radio
                  checked
                  onChange={() => {}}
                  inputProps={{ readOnly: true }}
                  name="lf-price-band"
                  sx={{ ...FOCUS_RING_SX }}
                />
              }
              label="Custom range (from your link)"
            />
          ) : null}
        </FacetGroup>
      ) : null}
    </Box>
  );
};

export default ProductFilter;
