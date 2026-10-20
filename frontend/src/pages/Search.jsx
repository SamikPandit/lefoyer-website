/**
 * /search?q= — the linkable, shareable, indexable results page. LF-09, LF-06.
 *
 * The overlay is for the six-row glance while typing; this page is the one you can
 * send someone, bookmark, or land on from a crawler. It therefore reads its whole
 * state from the URL (`useSearchParams`), never from component state that a reload
 * would throw away.
 *
 * THREE DISTINCT STATES, WHICH THE OLD SITE COULD NOT HAVE HAD BECAUSE IT HAD NO
 * SEARCH AT ALL:
 *   no query      → the field, plus a route to the catalogue. `noindex`, because an
 *                   empty search page is a thin duplicate (IMPL_SPEC §3 WP-08).
 *   zero matches  → `No products match "x"` + all products + the REAL concern chips.
 *   request failed→ `ErrorState` with a retry. A backend outage must never be worded
 *                   as "no results": that turns a five-second blip into a lost sale
 *                   and an untraceable support ticket.
 *
 * Unlike the overlay, this page does NOT pass `in_stock:true`. A shopper who searched
 * for a specific product deserves to be told it exists and is out of stock — the row
 * labels the state — rather than being told it does not exist.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Button, Container, Grid, InputBase, Stack, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

import { searchProducts } from '../services/api';
import SeoHead from '../components/common/SeoHead';
import ErrorState from '../components/common/ErrorState';
import EmptyState, { FOCUS_RING_SX } from '../components/common/EmptyState';
import ProductCardSkeleton from '../components/common/ProductCardSkeleton';
import ProductCard from '../components/product/ProductCard';
import { SearchNoResults, SEARCH_MIN_CHARS } from '../components/search/SearchOverlay';

const PAGE_SIZE = 24;
const GRID_SIZE = { xs: 12, sm: 6, md: 4, lg: 3 };

const isAbort = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError';

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
        { signal: controller.signal }
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
    [query]
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
    []
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = draft.trim();
    // `replace: false` so Back returns to the previous search, which is what a
    // shopper refining a term expects.
    setSearchParams(value ? { q: value } : {});
  };

  const tooShort = query.length > 0 && query.length < SEARCH_MIN_CHARS;
  const heading = query ? `Results for “${query}”` : 'Search';

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 4, md: 7 } }}>
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

      <Container maxWidth="lg">
        <Typography variant="h1" sx={{ mb: 1 }}>
          {heading}
        </Typography>

        {/* The field, so the page is usable on its own and after a reload. */}
        <Box
          component="form"
          role="search"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 3,
            mb: 1,
            px: 2,
            py: 1,
            maxWidth: 560,
            backgroundColor: 'var(--lf-surface)',
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
          <Button type="submit" size="small" sx={FOCUS_RING_SX}>
            Search
          </Button>
        </Box>

        {status === 'done' && items.length > 0 && (
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)', mb: 3 }} role="status">
            {count} {count === 1 ? 'product' : 'products'}
          </Typography>
        )}

        {/* ---- no query ---- */}
        {status === 'idle' && (
          <Box sx={{ mt: 4 }}>
            <EmptyState
              icon={<SearchIcon />}
              title="What are you looking for?"
              message={
                tooShort
                  ? `Search terms need at least ${SEARCH_MIN_CHARS} characters.`
                  : 'Search by product name, category or benefit — or browse the full catalogue.'
              }
              primaryLabel="Shop all products"
              primaryTo="/products"
              variant="page"
              headingComponent="h2"
            />
          </Box>
        )}

        {/* ---- loading page 1 ---- */}
        {status === 'loading' && (
          <Grid container spacing={{ xs: 1.5, md: 3 }} sx={{ mt: 1 }}>
            {Array.from({ length: 6 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Grid key={`skeleton-${index}`} size={GRID_SIZE}>
                <ProductCardSkeleton announce={index === 0} label="Searching products" />
              </Grid>
            ))}
          </Grid>
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
            <Grid container spacing={{ xs: 1.5, md: 3 }}>
              {items.map((product) => (
                <Grid key={product.id ?? product.slug} size={GRID_SIZE}>
                  <ProductCard product={product} />
                </Grid>
              ))}
            </Grid>

            <Stack alignItems="center" sx={{ mt: 5 }} spacing={1.5}>
              {next && (
                <Button
                  variant="outlined"
                  onClick={() => run(page + 1)}
                  disabled={status === 'loadingMore'}
                  sx={FOCUS_RING_SX}
                >
                  {status === 'loadingMore' ? 'Loading…' : 'Show more products'}
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
                  sx={{ color: 'var(--lf-gold-ink)', ...FOCUS_RING_SX }}
                >
                  Browse all products
                </Box>
              </Typography>
            </Stack>
          </>
        )}
      </Container>
    </Box>
  );
};

export default Search;
