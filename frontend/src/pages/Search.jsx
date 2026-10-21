/**
 * /search?q= — the linkable, shareable, indexable results page. ART_DIRECTION §5.8,
 * §5.9 (UTILITY), §5.10. LF-09, LF-06.
 *
 * The overlay is for the glance while typing; this page is the one you can send
 * someone, bookmark, or land on from a crawler. It therefore reads its whole state from
 * the URL (`useSearchParams`), never from component state that a reload would throw
 * away.
 *
 * THREE DISTINCT STATES, WHICH THE OLD SITE COULD NOT HAVE HAD BECAUSE IT HAD NO SEARCH
 *   no query      → the field, plus **the whole shelf**. `noindex`, because an empty
 *                   search page is a thin duplicate (IMPL_SPEC §3 WP-08).
 *   zero matches  → `No products match "x"` + all products + the REAL concern chips.
 *   request failed→ `ErrorState` with a retry. A backend outage must never be worded as
 *                   "no results": that turns a five-second blip into a lost sale and an
 *                   untraceable support ticket.
 *
 * WHAT §5 CHANGES HERE
 *  - **§5.8's table, row "Idle search":** the children slot carries *the whole shelf*.
 *    The idle state stops being one line of grey text in a tall empty panel — opening
 *    search on an empty query shows you the shop (§5.10's principle, applied to the
 *    page rather than to the overlay).
 *  - **§4 / §10.5: the catalogue grid comes from `productGrid.js`.** This page used a
 *    MUI `<Grid container>` with `size={{xs:12,sm:6,md:4,lg:3}}`, i.e. a **four-up**
 *    row — a fourth card language on a six-product catalogue, and at `lg` a 1232px
 *    container gives ~284px cards, under the 288px floor the card's own arithmetic
 *    (§4.3) is built on. One token now, shared with the PLP, the wishlist and About.
 *  - §5.9's UTILITY frame: `h3 component="h1"`, left, `py: var(--lf-sect)` — ending the
 *    `variant="h1"` that made this page's title 44px while "My orders" was 26px.
 *  - Unlike the overlay, this page does NOT pass `in_stock: true` (§2.24). A shopper who
 *    searched for a specific product deserves to be told it exists and is out of stock —
 *    the card's status ledge says so — rather than being told it does not exist.
 *  - "Show more products" uses `aria-disabled` with the guard in the handler, never the
 *    `disabled` attribute, so the control keeps its place in the tab order (§10.12).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Button, InputBase, Stack, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

import { searchProducts } from '../services/api';
import SeoHead from '../components/common/SeoHead';
import ErrorState from '../components/common/ErrorState';
import EmptyState, {
  FOCUS_RING_SX,
  PageShell,
  TOUCH_TARGET_SX,
  useProductShelf,
} from '../components/common/EmptyState';
import ProductCardSkeleton from '../components/common/ProductCardSkeleton';
import ProductCard from '../components/product/ProductCard';
import { PRODUCT_GRID_SX, skeletonCount } from '../components/product/productGrid';
import { SearchNoResults, SEARCH_MIN_CHARS } from '../components/search/SearchOverlay';

const PAGE_SIZE = 24;
/** The idle shelf is the catalogue, which is six (§Appendix) — ask for headroom. */
const SHELF_LIMIT = 12;

const isAbort = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError';

/** The one grid, from the one place that defines it. */
const ProductGrid = ({ products }) => (
  <Box sx={PRODUCT_GRID_SX}>
    {products.map((product) => (
      <ProductCard key={product.id ?? product.slug} product={product} />
    ))}
  </Box>
);

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();

  /** The field is seeded from the URL and then owned by the user until they submit. */
  const [draft, setDraft] = useState(query);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [page, setPage] = useState(1);
  /** 'idle' | 'loading' | 'loadingMore' | 'done' | 'error' */
  const [status, setStatus] = useState(query ? 'loading' : 'idle');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  /* §5.8 — the idle state's children. Fetched only while there is no query. */
  const { products: shelf, loading: shelfLoading } = useProductShelf({
    limit: SHELF_LIMIT,
    enabled: status === 'idle',
  });

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const run = useCallback(
    (targetPage) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus(targetPage > 1 ? 'loadingMore' : 'loading');
      setError(null);

      searchProducts(
        query,
        { page: targetPage, page_size: PAGE_SIZE },
        { signal: controller.signal },
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          const list = Array.isArray(result?.items) ? result.items : [];
          setItems((current) => (targetPage > 1 ? [...current, ...list] : list));
          setCount(typeof result?.count === 'number' ? result.count : list.length);
          setNext(result?.next ?? null);
          setPage(targetPage);
          setStatus('done');
        })
        .catch((caught) => {
          if (isAbort(caught) || controller.signal.aborted) return;
          setError(caught);
          setStatus('error');
          if (targetPage === 1) {
            setItems([]);
            setCount(0);
            setNext(null);
          }
        });
    },
    [query],
  );

  useEffect(() => {
    if (!query) {
      abortRef.current?.abort();
      setItems([]);
      setCount(0);
      setNext(null);
      setPage(1);
      setStatus('idle');
      setError(null);
      return undefined;
    }
    run(1);
    return () => abortRef.current?.abort();
  }, [query, run]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = draft.trim();
    // `replace: false` so Back returns to the previous search, which is what a
    // shopper refining a term expects.
    setSearchParams(value ? { q: value } : {});
  };

  const loadingMore = status === 'loadingMore';
  const handleMore = () => {
    if (loadingMore) return;
    run(page + 1);
  };

  const tooShort = query.length > 0 && query.length < SEARCH_MIN_CHARS;
  const heading = query ? `Results for “${query}”` : 'Search';

  return (
    <PageShell archetype="utility" maxWidth="lg" title={heading}>
      <SeoHead
        title={query ? `Search: ${query}` : 'Search'}
        description={
          query
            ? `Products matching “${query}” at Le foyeR.`
            : 'Search the Le foyeR. catalogue by product name, category or benefit.'
        }
        canonical="/search"
        noindex={!query}
      />

      {/* The field, so the page is usable on its own and after a reload. */}
      <Box
        component="form"
        role="search"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1,
          px: 2,
          py: 1,
          maxWidth: 560,
          backgroundColor: 'var(--lf-paper)',
          border: '1px solid var(--lf-border-field)',
          borderRadius: 'var(--lf-r-field)',
        }}
      >
        <SearchIcon aria-hidden="true" sx={{ color: 'var(--lf-ink-3)' }} />
        <InputBase
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search products"
          inputProps={{ 'aria-label': 'Search products', type: 'search', enterKeyHint: 'search' }}
          sx={{ flex: 1, color: 'var(--lf-ink)' }}
        />
        <Button type="submit" size="small" sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}>
          Search
        </Button>
      </Box>

      {status === 'done' && items.length > 0 && (
        <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)', mb: 3 }} role="status">
          {count} {count === 1 ? 'product' : 'products'}
        </Typography>
      )}

      {/* ---- no query: the field, and then the whole shop (§5.8) ---- */}
      {status === 'idle' && (
        <Box sx={{ mt: 4 }}>
          <EmptyState
            icon={<SearchIcon />}
            title="What are you looking for?"
            message={
              tooShort
                ? `Search terms need at least ${SEARCH_MIN_CHARS} characters.`
                : 'Search by product name, category or benefit — or take the whole shelf from here.'
            }
            primaryLabel="Shop all products"
            primaryTo="/products"
            variant="page"
            headingComponent="h2"
          >
            <Box component="section" aria-labelledby="idle-shelf-heading">
              <Typography
                id="idle-shelf-heading"
                variant="h4"
                component="h3"
                sx={{ color: 'var(--lf-ink)', mb: 3 }}
              >
                Everything we make
              </Typography>
              <Box sx={PRODUCT_GRID_SX}>
                {shelfLoading && shelf.length === 0 ? (
                  <ProductCardSkeleton count={skeletonCount(SHELF_LIMIT)} label="Loading products" />
                ) : (
                  shelf.map((product) => (
                    <ProductCard key={product.id ?? product.slug} product={product} />
                  ))
                )}
              </Box>
            </Box>
          </EmptyState>
        </Box>
      )}

      {/* ---- loading page 1 ---- */}
      {status === 'loading' && (
        <Box sx={{ ...PRODUCT_GRID_SX, mt: 1 }}>
          <ProductCardSkeleton count={skeletonCount(PAGE_SIZE)} label="Searching products" />
        </Box>
      )}

      {/* ---- request failed: NOT the same thing as zero results ---- */}
      {status === 'error' && items.length === 0 && (
        <Box sx={{ mt: 4 }}>
          <ErrorState
            title="Couldn’t load search results"
            error={error}
            onRetry={() => run(1)}
            secondaryLabel="Browse all products"
            secondaryTo="/products"
            variant="page"
            focusOnMount
          />
        </Box>
      )}

      {/* ---- zero matches ---- */}
      {status === 'done' && items.length === 0 && (
        <Box sx={{ mt: 4 }}>
          <SearchNoResults query={query} variant="page" />
        </Box>
      )}

      {/* ---- results ---- */}
      {items.length > 0 && (
        <>
          <ProductGrid products={items} />

          <Stack alignItems="flex-start" sx={{ mt: 5 }} spacing={1.5}>
            {next && (
              <Button
                className="lf-press"
                variant="outlined"
                onClick={handleMore}
                aria-disabled={loadingMore}
                aria-busy={loadingMore ? 'true' : undefined}
                sx={{ px: 3, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                {loadingMore ? 'Loading…' : 'Show more products'}
              </Button>
            )}
            {status === 'error' && (
              <Typography variant="body2" sx={{ color: 'var(--lf-err-ink)' }} role="alert">
                Couldn’t load more results. Try again.
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
              Not what you wanted?{' '}
              <Box
                component={RouterLink}
                to="/products"
                sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
              >
                Browse all products
              </Box>
            </Typography>
          </Stack>
        </>
      )}
    </PageShell>
  );
};

export default Search;
