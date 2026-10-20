/**
 * ProductFilter — the seven facets LF-08 asks for, as ONE controlled component used
 * unchanged in the desktop rail and in the mobile sheet.
 *
 * WHAT IT REPLACES (§1 C-16, verified)
 * The old file rendered exactly **one** control — a "Sort By" `<Select>`. Its
 * `handleCategoryChange` / `handleSubCategoryChange` were written and never mounted
 * (lines 45-48 were literally blank), it fetched its own taxonomy from
 * the mock catalogue module while the page fetched the real one from `services/api`, and it
 * read `.data.results` off a response api.js now normalises. It was the last
 * `getCategories`/`getSubCategories` importer of that mock module.
 *
 * DESIGN DECISIONS, ALL FROM THE SPEC
 *  - **It is a pure controlled component.** `value` in, `onChange(next)` out, taxonomy
 *    passed as props by `ProductListing` (which already fetches it). It holds no state
 *    of its own and performs no requests, which is the only way "works identically in
 *    the desktop sidebar and the mobile Drawer" can be true rather than aspirational:
 *    the rail passes the live URL state, the sheet passes a draft, and neither needs a
 *    different component. STAGING LIVES IN THE PARENT (DESIGN_SYSTEM §6.7 — "Filters
 *    are STAGED, not live. Nothing refetches until Show is tapped").
 *  - **Each facet is a `<fieldset>` with a `<legend>`** so a screen reader hears
 *    "Category, group" before the first option (§6.7).
 *  - **Counts live inside the label text** (`Serums (4)`) so they are announced, and a
 *    zero-count facet is `aria-disabled` — NOT `disabled` — so it stays discoverable
 *    with the count explaining why (§6.7).
 *  - **The whole 48px row is the `<label>`**, so the row *is* the hit target (§6.7).
 *  - **No `Paper`, no border, no background** — the rail sits directly on the canvas and
 *    is structured by type and hairlines (§6.7, "type does the hierarchy, not boxes").
 *  - **Sub-category is dependent** on the selected categories, and selecting a category
 *    prunes sub-category values that no longer belong (otherwise the URL keeps a filter
 *    the UI can no longer show or remove).
 *  - **Price is a band chooser, not a slider.** A band maps to exactly one
 *    `min_price`/`max_price` pair, which is what keeps it individually removable as one
 *    chip and shareable as a URL; two overlapping slider thumbs at 320px with no themed
 *    `MuiSlider` would have been the only control on the page the design system has no
 *    tokens for. A hand-written `?min_price=` from an older link still renders as a
 *    removable chip and selects "Custom range".
 */

import { useId } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import ErrorState from '../common/ErrorState';
import { FOCUS_RING_SX } from '../common/EmptyState';
import { formatRupees } from './productPresentation';

/**
 * The sort menu. Every value is a real `ordering_fields` entry on
 * `ProductViewSet` (`price`, `created_at`, `name`, `rating`, `reviews_count`,
 * `display_order`) — §1 C-17 was that `?ordering=` used to be discarded silently, so an
 * invented value here would look like it worked and quietly do nothing.
 *
 * `''` means "send no `ordering` at all" and let the server's own
 * `['display_order', '-created_at']` merchandising order stand.
 */
export const SORT_OPTIONS = Object.freeze([
  { value: '', label: 'Recommended' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
  { value: '-created_at', label: 'Newest first' },
  { value: 'name', label: 'Name: A to Z' },
  { value: '-reviews_count', label: 'Most reviewed' },
]);

/** The facet keys that hold an array of slugs. Order is the render order. */
export const MULTI_FACETS = Object.freeze(['category', 'sub_category', 'concern', 'skin_type']);

/**
 * Price bands derived from the real catalogue ceiling, so we never offer a band no
 * product can fall into. `maxPrice` comes from one `listProducts({ordering:'-price',
 * page_size:1})` call in `ProductListing`.
 * @param {number|null} maxPrice
 * @returns {Array<{id:string,label:string,min:number|null,max:number|null}>}
 */
export function buildPriceBands(maxPrice) {
  const ceiling = Number(maxPrice);
  const edges = [500, 1000, 2000, 5000].filter(
    (edge) => !Number.isFinite(ceiling) || ceiling > edge,
  );

  const bands = [];
  let previous = null;
  edges.forEach((edge) => {
    bands.push({
      id: `${previous ?? 0}-${edge}`,
      label: previous === null ? `Under ${formatRupees(edge)}` : `${formatRupees(previous)} – ${formatRupees(edge)}`,
      min: previous,
      max: edge,
    });
    previous = edge;
  });

  if (previous !== null) {
    bands.push({
      id: `${previous}-plus`,
      label: `${formatRupees(previous)} and above`,
      min: previous,
      max: null,
    });
  }

  return bands;
}

/** A band id for the current min/max pair, `'any'`, or `'custom'`. */
export function matchPriceBand(bands, minPrice, maxPrice) {
  const min = minPrice === null || minPrice === undefined || minPrice === '' ? null : Number(minPrice);
  const max = maxPrice === null || maxPrice === undefined || maxPrice === '' ? null : Number(maxPrice);
  if (min === null && max === null) return 'any';
  const hit = bands.find((band) => (band.min ?? null) === min && (band.max ?? null) === max);
  return hit ? hit.id : 'custom';
}

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
  '@media (hover: hover)': { '&:hover': { backgroundColor: 'var(--lf-surface-sunken)' } },
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
    <Typography component="legend" variant="overline" sx={{ color: 'var(--lf-ink-3)', px: 0, mb: 1 }}>
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
 * A zero-count option is `aria-disabled` and still focusable, with the count telling
 * the customer why it would return nothing (§6.7).
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
        const count = Number(option.product_count);
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
 * @param {boolean} [props.showSort=true] The sheet and the rail both show it; the
 *   listing's compact mobile "Sort" sheet renders `SORT_OPTIONS` itself.
 */
const ProductFilter = ({
  value,
  onChange,
  taxonomy,
  taxonomyStatus = 'ready',
  onRetryTaxonomy,
  priceBands = [],
  showSort = true,
}) => {
  const baseId = useId();
  const sortLabelId = `${baseId}-sort-label`;

  const categories = taxonomy?.categories || [];
  const subCategories = taxonomy?.subCategories || [];
  const concerns = taxonomy?.concerns || [];
  const skinTypes = taxonomy?.skinTypes || [];

  const selected = {
    category: value?.category || [],
    sub_category: value?.sub_category || [],
    concern: value?.concern || [],
    skin_type: value?.skin_type || [],
  };

  /** Sub-category options narrow to the chosen categories (the "dependent" facet). */
  const visibleSubCategories = selected.category.length
    ? subCategories.filter((sub) => selected.category.includes(sub.category?.slug))
    : subCategories;

  const toggle = (key, slug) => {
    const current = selected[key];
    const next = current.includes(slug)
      ? current.filter((item) => item !== slug)
      : [...current, slug];

    const draft = { ...value, [key]: next };

    if (key === 'category') {
      // Drop sub-categories that no longer belong to any selected category, so the URL
      // cannot keep a filter this UI can neither display nor remove.
      const allowed = new Set(
        (next.length ? subCategories.filter((sub) => next.includes(sub.category?.slug)) : subCategories).map(
          (sub) => sub.slug,
        ),
      );
      draft.sub_category = (selected.sub_category || []).filter((slug) => allowed.has(slug));
    }

    onChange(draft);
  };

  const selectedBandId = matchPriceBand(priceBands, value?.min_price, value?.max_price);

  return (
    <Box
      component="nav"
      aria-label="Filters"
      sx={{ minWidth: 0, backgroundColor: 'transparent', border: 0 }}
    >
      {showSort ? (
        <FacetGroup legend="Sort by">
          <FormControl size="small" fullWidth>
            <InputLabel id={sortLabelId}>Sort by</InputLabel>
            <Select
              labelId={sortLabelId}
              label="Sort by"
              value={value?.ordering || ''}
              onChange={(event) => onChange({ ...value, ordering: event.target.value })}
              sx={{ ...FOCUS_RING_SX }}
            >
              {SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value || 'default'} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </FacetGroup>
      ) : null}

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
        // An inline failure keeps sort, availability and price alive (§6.9: "a failed
        // filter fetch must not take the grid down with it").
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

          <CheckboxFacet
            legend="Sub-category"
            hint={selected.category.length ? 'Within your selected categories.' : undefined}
            options={visibleSubCategories}
            selected={selected.sub_category}
            onToggle={(slug) => toggle('sub_category', slug)}
            emptyText="No sub-categories for this selection."
          />

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
