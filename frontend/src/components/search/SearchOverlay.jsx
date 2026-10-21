/**
 * ============================================================================
 * <SearchOverlay> — ART_DIRECTION.md §5.10, §2.24. LF-09.
 *
 * TWO THINGS CHANGE HERE, AND BOTH ARE ABOUT SHOWING THE SHOP RATHER THAN
 * HIDING IT.
 *
 * 1. `in_stock: true` IS DROPPED (§2.24). This file passed it while
 *    `pages/Search.jsx` passed no such filter, so the SAME QUERY RETURNED TWO
 *    DIFFERENT SHOPS depending on which surface you used — and since exactly
 *    three of six products are out of stock, the overlay was hiding half the
 *    catalogue from the person who had just typed its name. Out-of-stock rows
 *    render with their stock words and the thing their page offers; §10.13
 *    forbids dimming them, so they are not dimmed.
 *
 * 2. THE IDLE STATE IS THE SHELF (§5.10). It used to be one line of grey text
 *    in a 60vh panel: a question asked of someone who had not decided yet.
 *    Now opening search on an empty query SHOWS YOU THE SHOP — all six
 *    products, in-stock first (§2.23), as the same rows a query returns, in
 *    the same listbox, reachable with the same arrow keys. With six SKUs
 *    there is no version of "browse" that is not simply the catalogue.
 *
 * REQUEST DISCIPLINE (the part that is easy to get wrong)
 * 300ms debounce, minimum two characters, and the in-flight request is
 * ABORTED through an `AbortController` — not merely ignored when it resolves.
 * A discarded-but-still-running request keeps a connection open per keystroke
 * and, on the `catalogue` throttle scope (300/min), is how a fast typist gets
 * themselves a 429. The idle shelf is fetched at most once per page load and
 * shares its promise with the footer's row, so the two surfaces that show the
 * same six products do not fetch them twice.
 *
 * DEBOUNCE DISCREPANCY, STATED: DESIGN_SYSTEM §6.6 says 120ms, IMPL_SPEC §3
 * WP-08 says 300ms. The package contract wins; the constant below is the only
 * place to change it.
 *
 * DATA-PATH DEPENDENCY, STATED: until `ProductViewSet` gains `search_fields`,
 * DRF's `SearchFilter` returns the queryset untouched, so this overlay will
 * show the whole catalogue for any query. That is a backend gap, not a client
 * one, and nothing in this component changes when it lands.
 * ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Chip,
  Dialog,
  Divider,
  IconButton,
  InputBase,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';

import { listConcerns, searchProducts } from '../../services/api';
import EmptyState from '../common/EmptyState';
import { inStockFirst, loadShelfProducts } from '../common/Footer';
import SearchResultRow, { productPath } from './SearchResultRow';

/* The two numbers the package contract fixes. */
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_CHARS = 2;
const OVERLAY_PAGE_SIZE = 6;
/** Skeletons only after 220ms, so a fast response never flashes them. */
const SKELETON_AFTER_MS = 220;
/** The result count is announced at most this often. */
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
 * rendered at all.
 * ================================================================== */

/**
 * Fetch the concern list once, lazily, while `enabled` is true.
 * @param {boolean} enabled
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
 * The no-results state. Shared verbatim by the overlay and `pages/Search.jsx`
 * so the two can never word the same dead end differently.
 *
 * @param {object} props
 * @param {string} props.query The term that matched nothing.
 * @param {Function} [props.onNavigate] Called when a recovery link is followed.
 * @param {'inline'|'page'} [props.variant='inline']
 * @returns {JSX.Element}
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
          <Typography variant="eyebrow" component="p" sx={{ mb: 1.5 }}>
            Shop by concern
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
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

/**
 * A skeleton the shape of the real row (P5): a 72px niche, two text lines and
 * a price. First paint and loaded paint are the same height, so nothing jumps
 * when the results land.
 */
const RowSkeleton = () => (
  <Box
    aria-hidden="true"
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--lf-4)',
      px: { xs: 'var(--lf-3)', sm: 'var(--lf-4)' },
      py: 'var(--lf-2)',
      minHeight: 64,
    }}
  >
    <Box
      className="lf-skel lf-skel--alcove"
      sx={{ flex: 'none', inlineSize: 'calc(72px / var(--lf-arch-ratio))' }}
    />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box className="lf-skel lf-skel--text" sx={{ height: 14, width: '62%' }} />
      <Box className="lf-skel lf-skel--text" sx={{ height: 11, width: '34%', mt: 'var(--lf-2)' }} />
    </Box>
    <Box className="lf-skel lf-skel--text" sx={{ height: 16, width: 56 }} />
  </Box>
);

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose Called for Esc, the scrim, the close button and
 *   after any navigation out of the overlay. Focus returns to the trigger because
 *   MUI's Modal restores it — do not pass `disableRestoreFocus`.
 * @returns {JSX.Element}
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
  /** §5.10's idle shelf: `null` until the six products land. */
  const [shelf, setShelf] = useState(null);

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < SEARCH_MIN_CHARS;
  const hasQuery = trimmed.length >= SEARCH_MIN_CHARS;

  /* ---- §5.10: the shelf, fetched once, the first time search opens ----- */
  useEffect(() => {
    if (!open || shelf !== null) return undefined;
    let alive = true;
    loadShelfProducts().then((products) => {
      if (alive) setShelf(inStockFirst(products));
    });
    return () => {
      alive = false;
    };
  }, [open, shelf]);

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

      /* NO `in_stock` FILTER (§2.24). The overlay and /search are the same
         shop, and half this catalogue is out of stock today. */
      searchProducts(
        trimmed,
        { page_size: OVERLAY_PAGE_SIZE },
        { signal: controller.signal }
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          const list = Array.isArray(result?.items) ? result.items : [];
          setItems(inStockFirst(list));
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

  /* The listbox's contents: the matches, or — on an empty query — the shelf.
     ONE list, so the arrow keys, `aria-activedescendant` and Enter behave
     identically whether the shopper has typed anything or not. */
  const shelfRows = shelf || [];
  const rows = hasQuery ? items : shelfRows;
  const showRows = hasQuery ? status === 'done' && items.length > 0 : shelfRows.length > 0;
  const showEmpty = status === 'done' && items.length === 0 && hasQuery;
  const showShelfSkeleton = !hasQuery && shelf === null;

  /* ---- keyboard contract ------------------------------------------ */
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

    if (rows.length === 0) {
      if (event.key === 'Enter' && hasQuery) {
        event.preventDefault();
        goToResultsPage();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1 >= rows.length ? 0 : current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? rows.length - 1 : current - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(rows.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const product = rows[activeIndex];
      if (product) {
        navigate(productPath(product));
        close();
      } else if (hasQuery) {
        goToResultsPage();
      }
    }
  };

  const activeDescendant = useMemo(
    () => (activeIndex >= 0 && rows[activeIndex] ? ROW_ID(activeIndex) : undefined),
    [activeIndex, rows]
  );

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
            gap: 'var(--lf-3)',
            px: { xs: 'var(--lf-3)', sm: 'var(--lf-4)' },
            py: 'var(--lf-3)',
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
              'aria-expanded': showRows,
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
              /* A7. Without this the field a keyboard user types into shows no
                 focus at all: InputBase paints no ring of its own, and the
                 overlay is reachable from the nav on every route. Scoped to the
                 InputBase rather than :focus-within on the row, so it cannot
                 double-ring with the adjacent close button. */
              '&.Mui-focused': {
                outline: '2px solid var(--lf-focus)',
                outlineOffset: 2,
                borderRadius: 'var(--lf-r-field)',
              },
            }}
          />
          <IconButton onClick={close} aria-label="Close search">
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
            p: 'var(--lf-2)',
          }}
        >
          <Box className="lf-sr-only" role="status" aria-live="polite">
            {announcement}
          </Box>

          {/* One character typed: say what is missing, and keep the shelf
              visible beneath it rather than replacing the shop with a hint. */}
          {tooShort ? (
            <Typography
              variant="body2"
              sx={{ px: 'var(--lf-4)', py: 'var(--lf-3)', color: 'var(--lf-ink-3)' }}
            >
              {`Keep typing — ${SEARCH_MIN_CHARS} characters minimum.`}
            </Typography>
          ) : null}

          {/* §5.10 — the idle state is the whole shop, not a prompt. */}
          {!hasQuery && showRows ? (
            <Typography
              variant="eyebrow"
              component="p"
              sx={{ px: 'var(--lf-4)', pt: 'var(--lf-2)', pb: 'var(--lf-1)' }}
            >
              The shelf
            </Typography>
          ) : null}

          {showShelfSkeleton || (status === 'loading' && showSkeleton) ? (
            <Box aria-hidden="true">
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </Box>
          ) : null}

          {status === 'error' && hasQuery && (
            <Box sx={{ px: 'var(--lf-4)', py: 'var(--lf-4)' }} role="alert">
              <Typography variant="h5" component="p" sx={{ color: 'var(--lf-ink)' }}>
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
                  }}
                >
                  browse all products
                </Box>
                .
              </Typography>
            </Box>
          )}

          {showRows && (
            <Box
              id={LISTBOX_ID}
              role="listbox"
              aria-label={hasQuery ? `Results for ${trimmed}` : 'All products'}
            >
              {rows.map((product, index) => (
                <SearchResultRow
                  key={product.id ?? product.slug ?? index}
                  id={ROW_ID(index)}
                  product={product}
                  query={hasQuery ? trimmed : ''}
                  active={index === activeIndex}
                  onSelect={close}
                  onMouseEnter={() => setActiveIndex(index)}
                />
              ))}
            </Box>
          )}

          {showRows && hasQuery && (
            <>
              <Divider sx={{ my: 'var(--lf-2)' }} />
              <Box
                component="button"
                type="button"
                onClick={goToResultsPage}
                className="lf-press"
                data-press="row"
                sx={{
                  width: '100%',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 'var(--lf-4)',
                  background: 'none',
                  border: 0,
                  borderRadius: 'var(--lf-r-field)',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'var(--lf-ink)',
                  '@media (hover: hover)': {
                    '&:hover': { backgroundColor: 'var(--lf-mat)' },
                  },
                }}
              >
                <Typography variant="h5" component="span">
                  {count > rows.length
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
            <Box sx={{ px: 'var(--lf-2)', py: 'var(--lf-2)' }}>
              <SearchNoResults query={trimmed} onNavigate={close} />
            </Box>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default SearchOverlay;
