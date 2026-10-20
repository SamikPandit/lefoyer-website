/**
 * SearchOverlay — the storefront's search. LF-09, IMPL_SPEC §1 C-14, §3 WP-08,
 * DESIGN_SYSTEM §6.6.
 *
 * WHAT WAS HERE BEFORE: nothing. `Navbar.jsx` rendered a bare
 * `<IconButton sx={{color:'inherit'}}><SearchIcon /></IconButton>` with no `onClick`,
 * no `href` and no `component`, sitting between two correctly wired `component={Link}`
 * icons. There was no search UI, no `/search` route handler and no code path anywhere
 * in the app that sent a term to the API. This file and `pages/Search.jsx` are it.
 *
 * REQUEST DISCIPLINE (the part that is easy to get wrong)
 * 300ms debounce, minimum two characters, and the in-flight request is **aborted**
 * through an `AbortController` — not merely ignored when it resolves. A discarded-but-
 * still-running request keeps a connection open per keystroke and, on the `catalogue`
 * throttle scope (300/min), is how a fast typist gets themselves a 429.
 *
 * `searchProducts(q, {in_stock:true, page_size:6})` is `GET products/products/?search=`
 * — see services/api.js. The overlay shows sellable products only; the full
 * `/search` page shows everything that matches and labels its stock state.
 *
 * DEBOUNCE DISCREPANCY, STATED: DESIGN_SYSTEM §6.6 says 120ms, IMPL_SPEC §3 WP-08 says
 * 300ms. The package contract wins; the constant below is the only place to change it.
 *
 * DATA-PATH DEPENDENCY, STATED: §6.6 was written when `products/views.py` had no
 * `SearchFilter`, and prescribes a client-side `searchIndex.js` cache as the interim.
 * Wave 1 put `SearchFilter` in `DEFAULT_FILTER_BACKENDS`, and WP-02 owns adding
 * `search_fields` to `ProductViewSet` (its acceptance: "`?search=serum` returns a
 * strict subset"). Until that lands, DRF's `SearchFilter` with no `search_fields`
 * returns the queryset untouched, so this overlay will show the whole catalogue for
 * any query. That is a backend gap, not a client one: the §6.6 upgrade path has
 * already been taken, and nothing in this component changes when it lands.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Chip,
  Dialog,
  Divider,
  IconButton,
  InputBase,
  Skeleton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';

import { listConcerns, searchProducts } from '../../services/api';
import EmptyState, { FOCUS_RING_SX } from '../common/EmptyState';
import SearchResultRow, { productPath } from './SearchResultRow';

/* The two numbers the package contract fixes. */
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_CHARS = 2;
const OVERLAY_PAGE_SIZE = 6;
/** Skeletons only after 220ms, so a fast response never flashes them (§6.4). */
const SKELETON_AFTER_MS = 220;
/** The result count is announced at most this often (§6.6). */
const ANNOUNCE_THROTTLE_MS = 500;
const LISTBOX_ID = 'lf-search-list';
const ROW_ID = (index) => `lf-search-option-${index}`;

/** `true` when an axios/fetch rejection is just our own abort. */
const isAbort = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError';

/** The href for the full results page. One place, so the two links cannot diverge. */
export const searchPagePath = (query) => `/search?q=${encodeURIComponent(query)}`;

/* ================================================================== *
 * Concern chips — the recovery path on a no-results state.
 * These are REAL rows from `GET products/concerns/`. A concern is never
 * invented here: if the request fails or returns nothing, no chips are
 * rendered at all (AGENT_BRIEF: "Never invent a concern").
 * ================================================================== */

/**
 * Fetch the concern list once, lazily, while `enabled` is true.
 * @returns {Array<{id:number, name:string, slug:string}>}
 */
export function useConcernChips(enabled) {
  const [concerns, setConcerns] = useState([]);
  const requested = useRef(false);

  useEffect(() => {
    if (!enabled || requested.current) return undefined;
    requested.current = true;
    const controller = new AbortController();
    listConcerns(undefined, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        setConcerns(items.filter((concern) => concern?.slug && concern?.name).slice(0, 6));
      })
      .catch(() => {
        // A missing taxonomy must not break the state it decorates. It also must not
        // be retried in a loop, hence `requested`.
      });
    return () => controller.abort();
  }, [enabled]);

  return concerns;
}

/**
 * The no-results state. Shared verbatim by the overlay and `pages/Search.jsx` so the
 * two can never word the same dead end differently.
 *
 * @param {object} props
 * @param {string} props.query The term that matched nothing.
 * @param {Function} [props.onNavigate] Called when a recovery link is followed.
 * @param {'inline'|'page'} [props.variant='inline']
 */
export const SearchNoResults = ({ query, onNavigate, variant = 'inline' }) => {
  const concerns = useConcernChips(true);

  return (
    <EmptyState
      icon={<SearchOffIcon />}
      title={`No products match “${query}”`}
      message="Check the spelling, try a shorter term, or start from a concern."
      primaryLabel="Shop all products"
      primaryTo="/products"
      onPrimary={onNavigate}
      variant={variant}
      headingComponent={variant === 'page' ? 'h2' : 'h3'}
    >
      {concerns.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography
            variant="overline"
            component="p"
            sx={{ color: 'var(--lf-ink-3)', mb: 1.5 }}
          >
            Shop by concern
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'center',
            }}
          >
            {concerns.map((concern) => (
              <Chip
                key={concern.slug}
                component={RouterLink}
                clickable
                size="medium"
                variant="outlined"
                label={concern.name}
                to={`/products?concern=${encodeURIComponent(concern.slug)}`}
                onClick={onNavigate}
                sx={{ ...FOCUS_RING_SX, minHeight: 32 }}
              />
            ))}
          </Box>
        </Box>
      )}
    </EmptyState>
  );
};

/* ================================================================== *
 * The overlay
 * ================================================================== */

const RowSkeleton = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, minHeight: 64 }}>
    <Skeleton variant="rounded" width={48} height={48} sx={{ borderRadius: 'var(--lf-r-chip)' }} />
    <Box sx={{ flex: 1 }}>
      <Skeleton variant="text" width="62%" height={16} />
      <Skeleton variant="text" width="34%" height={12} />
    </Box>
    <Skeleton variant="text" width={56} height={16} />
  </Box>
);

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose Called for Esc, the scrim, the close button and
 *   after any navigation out of the overlay. Focus returns to the trigger because
 *   MUI's Modal restores it — do not pass `disableRestoreFocus`.
 */
const SearchOverlay = ({ open, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const announcedAt = useRef(0);

  const [query, setQuery] = useState('');
  /** 'idle' | 'loading' | 'done' | 'error' */
  const [status, setStatus] = useState('idle');
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < SEARCH_MIN_CHARS;
  const hasQuery = trimmed.length >= SEARCH_MIN_CHARS;

  /* ---- the search itself: debounce + abort ------------------------ */
  useEffect(() => {
    if (!open) return undefined;

    if (!hasQuery) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStatus('idle');
      setItems([]);
      setCount(0);
      setActiveIndex(-1);
      return undefined;
    }

    const timer = setTimeout(() => {
      // Abort the request still in flight rather than letting it land and be ignored.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('loading');

      searchProducts(
        trimmed,
        { in_stock: true, page_size: OVERLAY_PAGE_SIZE },
        { signal: controller.signal }
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          const list = Array.isArray(result?.items) ? result.items : [];
          setItems(list);
          setCount(typeof result?.count === 'number' ? result.count : list.length);
          setActiveIndex(-1);
          setStatus('done');
        })
        .catch((error) => {
          if (isAbort(error) || controller.signal.aborted) return;
          setItems([]);
          setCount(0);
          setStatus('error');
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [open, trimmed, hasQuery]);

  /* Abort whatever is open when the overlay goes away or the tree unmounts. */
  useEffect(() => {
    if (open) return undefined;
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [open]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  /* ---- skeletons only after 220ms (never a centred spinner) ------- */
  useEffect(() => {
    if (status !== 'loading') {
      setShowSkeleton(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowSkeleton(true), SKELETON_AFTER_MS);
    return () => clearTimeout(timer);
  }, [status]);

  /* ---- one throttled polite announcement -------------------------- */
  useEffect(() => {
    if (!open) return undefined;
    let message = '';
    if (status === 'error') message = 'Search is unavailable right now.';
    else if (status === 'done' && hasQuery) {
      message =
        count === 0
          ? `No products match ${trimmed}.`
          : `${count} ${count === 1 ? 'result' : 'results'} for ${trimmed}.`;
    }
    if (!message) return undefined;

    const wait = Math.max(0, ANNOUNCE_THROTTLE_MS - (Date.now() - announcedAt.current));
    const timer = setTimeout(() => {
      announcedAt.current = Date.now();
      setAnnouncement(message);
    }, wait);
    return () => clearTimeout(timer);
  }, [open, status, count, trimmed, hasQuery]);

  /* ---- focus the input one frame AFTER the transition ------------- */
  const handleEntered = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose?.();
  }, [onClose]);

  const goToResultsPage = useCallback(() => {
    if (!hasQuery) return;
    navigate(searchPagePath(trimmed));
    close();
  }, [close, hasQuery, navigate, trimmed]);

  /* ---- keyboard contract (§6.6) ----------------------------------- */
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      // First Esc clears a non-empty query; the second one closes.
      if (query.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        setQuery('');
        inputRef.current?.focus();
      }
      return;
    }

    if (items.length === 0) {
      if (event.key === 'Enter' && hasQuery) {
        event.preventDefault();
        goToResultsPage();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1 >= items.length ? 0 : current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const product = items[activeIndex];
      if (product) {
        navigate(productPath(product));
        close();
      } else {
        goToResultsPage();
      }
    }
  };

  const activeDescendant = useMemo(
    () => (activeIndex >= 0 && items[activeIndex] ? ROW_ID(activeIndex) : undefined),
    [activeIndex, items]
  );

  const showResults = status === 'done' && items.length > 0;
  const showEmpty = status === 'done' && items.length === 0 && hasQuery;

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="sm"
      fullWidth
      slotProps={{
        transition: { onEntered: handleEntered },
        paper: {
          'aria-label': 'Search products',
          sx: {
            // Desktop: a panel near the top. Mobile: the theme already turns every
            // Dialog paper into a bottom sheet at <600px.
            m: { xs: 0, sm: 2 },
            mt: { sm: '10vh' },
            alignSelf: { xs: 'flex-end', sm: 'flex-start' },
            overflow: 'hidden',
          },
        },
      }}
      sx={{
        '& .MuiDialog-container': {
          alignItems: { xs: 'flex-end', sm: 'flex-start' },
        },
      }}
    >
      {/* Every key is handled HERE, on a child of the Modal root, not on the Dialog
          itself: MUI's own Escape handler runs on the root AFTER calling ours and
          does not consult `defaultPrevented`, so the only way to swallow the first
          Escape (which clears the query) is to stop it propagating from inside. */}
      <Box onKeyDown={handleKeyDown}>
      {/* ---- the field ---- */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
        }}
      >
        <SearchIcon aria-hidden="true" sx={{ color: 'var(--lf-ink-3)' }} />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          inputProps={{
            'aria-label': 'Search products',
            role: 'combobox',
            'aria-expanded': showResults,
            'aria-controls': LISTBOX_ID,
            'aria-autocomplete': 'list',
            'aria-activedescendant': activeDescendant,
            autoComplete: 'off',
            autoCorrect: 'off',
            spellCheck: 'false',
            enterKeyHint: 'search',
            type: 'search',
          }}
          sx={{
            flex: 1,
            fontSize: '1.0625rem',
            color: 'var(--lf-ink)',
            '& input::-webkit-search-cancel-button': { display: 'none' },
          }}
        />
        <IconButton onClick={close} aria-label="Close search" sx={FOCUS_RING_SX}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* ---- results region ---- */}
      <Box
        className="lf-scroll"
        sx={{
          maxHeight: { xs: '62dvh', sm: '60vh' },
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          p: 1,
          backgroundColor: 'var(--lf-surface)',
        }}
      >
        <Box className="lf-sr-only" role="status" aria-live="polite">
          {announcement}
        </Box>

        {status === 'idle' && (
          <Typography
            variant="body2"
            sx={{ px: 2, py: 2.5, color: 'var(--lf-ink-3)' }}
          >
            {tooShort
              ? `Keep typing — ${SEARCH_MIN_CHARS} characters minimum.`
              : 'Search by product name, category or benefit.'}
          </Typography>
        )}

        {status === 'loading' &&
          (showSkeleton ? (
            <Box aria-hidden="true">
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </Box>
          ) : null)}

        {status === 'error' && (
          <Box sx={{ px: 2, py: 2 }} role="alert">
            <Typography variant="subtitle2" sx={{ color: 'var(--lf-ink)' }}>
              Couldn&apos;t search right now
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mt: 0.5 }}>
              This is a connection problem on our side, not an empty result. Try again
              in a moment, or{' '}
              <Box
                component="button"
                type="button"
                onClick={() => {
                  navigate('/products');
                  close();
                }}
                sx={{
                  background: 'none',
                  border: 0,
                  p: 0,
                  font: 'inherit',
                  color: 'var(--lf-gold-ink)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  ...FOCUS_RING_SX,
                }}
              >
                browse all products
              </Box>
              .
            </Typography>
          </Box>
        )}

        {showResults && (
          <>
            <Box id={LISTBOX_ID} role="listbox" aria-label={`Results for ${trimmed}`}>
              {items.map((product, index) => (
                <SearchResultRow
                  key={product.id ?? product.slug ?? index}
                  id={ROW_ID(index)}
                  product={product}
                  query={trimmed}
                  active={index === activeIndex}
                  onSelect={close}
                  onMouseEnter={() => setActiveIndex(index)}
                />
              ))}
            </Box>

            <Divider sx={{ my: 1 }} />
            <Box
              component="button"
              type="button"
              onClick={goToResultsPage}
              className="lf-press"
              sx={{
                width: '100%',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                background: 'none',
                border: 0,
                borderRadius: 'var(--lf-r-field)',
                cursor: 'pointer',
                font: 'inherit',
                color: 'var(--lf-ink)',
                '@media (hover: hover)': {
                  '&:hover': { backgroundColor: 'var(--lf-surface-sunken)' },
                },
                ...FOCUS_RING_SX,
              }}
            >
              <Typography variant="subtitle2" component="span">
                {count > items.length
                  ? `See all ${count} results`
                  : `See all results for “${trimmed}”`}
              </Typography>
              <Typography variant="caption" component="span" sx={{ color: 'var(--lf-ink-3)' }}>
                Enter
              </Typography>
            </Box>
          </>
        )}

        {showEmpty && (
          <Box sx={{ px: 1, py: 1 }}>
            <SearchNoResults query={trimmed} onNavigate={close} />
          </Box>
        )}
      </Box>
      </Box>
    </Dialog>
  );
};

export default SearchOverlay;
