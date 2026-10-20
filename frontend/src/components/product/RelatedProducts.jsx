/**
 * RelatedProducts — the strip under the PDP.
 *
 * TWO DEFECTS FIXED
 *  1. It imported `getRelatedProducts` from the **mock catalogue module** (§1 C-16: one of the
 *     three live mock-module importers) and the PDP called it with `product.id`. The real
 *     endpoint is slug-routed — `products/products/<slug>/related/` (§2b #4) — so a
 *     numeric id would have 404'd every time. It now takes the **slug**.
 *  2. `if (products.length === 0) return null;` made a backend outage and an empty
 *     catalogue the same silent nothing. Loading, error-with-Retry and empty are three
 *     different states now (LF-26).
 *
 * The endpoint falls back sub-category → bestseller server-side so it is rarely empty;
 * the empty state exists because "rarely" is not "never".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { getRelatedProducts } from '../../services/api';
import ErrorState from '../common/ErrorState';
import ProductCardSkeleton, { useSkeletonDelay } from '../common/ProductCardSkeleton';
import ProductCard from './ProductCard';

/** §7's grid: 1-up at 320px, 2-up from 360px, more as the column widens. */
export const PRODUCT_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(156px, 1fr))',
  gap: 1.5,
  minWidth: 0,
};

/**
 * @param {object} props
 * @param {string} props.slug The product's slug — NOT its id.
 * @param {number} [props.limit=4]
 * @param {string} [props.title='You might also like']
 */
const RelatedProducts = ({ slug, limit = 4, title = 'You might also like' }) => {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    if (!slug) {
      setItems([]);
      setStatus('empty');
      return;
    }

    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('loading');
    setError(null);

    try {
      const { items: results } = await getRelatedProducts(slug, { limit }, { signal: controller.signal });
      if (!aliveRef.current || controller.signal.aborted) return;
      setItems(results);
      setStatus(results.length ? 'ready' : 'empty');
    } catch (requestError) {
      if (requestError?.isCanceled || controller.signal.aborted || !aliveRef.current) return;
      setError(requestError);
      setStatus('error');
    }
  }, [slug, limit]);

  useEffect(() => {
    load();
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [load]);

  const showSkeletons = useSkeletonDelay(status === 'loading');

  return (
    <Box component="section" aria-labelledby="lf-related-heading" sx={{ minWidth: 0 }}>
      <Typography id="lf-related-heading" variant="h4" component="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box className="lf-rule" sx={{ mb: 2 }} />

      {status === 'error' ? (
        <ErrorState
          title="Couldn't load related products"
          error={error}
          onRetry={load}
          secondaryLabel="Browse all products"
          secondaryTo="/products"
          variant="inline"
          headingComponent="h3"
        />
      ) : status === 'empty' ? (
        <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
          Nothing to pair with this one yet.{' '}
          <Typography
            component={RouterLink}
            to="/products"
            variant="body2"
            sx={{ color: 'var(--lf-gold-ink)' }}
          >
            Browse all products
          </Typography>
          .
        </Typography>
      ) : (
        <Box sx={PRODUCT_GRID_SX} aria-busy={status === 'loading'}>
          {status === 'loading'
            ? showSkeletons
              ? <ProductCardSkeleton count={limit} label="Loading related products" />
              : null
            : items.map((product) => <ProductCard key={product.id} product={product} />)}
        </Box>
      )}
    </Box>
  );
};

export default RelatedProducts;
