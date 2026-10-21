/**
 * ============================================================================
 * Wishlist — the saved-items page. ART_DIRECTION.md §5.9 (UTILITY archetype).
 *
 * THIS PASS (§4, §5.9)
 *  - **The grid moves to `components/product/productGrid.js`.** It imported
 *    `PRODUCT_GRID_SX` from `RelatedProducts` — `repeat(auto-fill,
 *    minmax(156px, 1fr))`, the one number behind four of the site's most
 *    visible defects (§1.3, §10.5). A related-products rail does not own the
 *    catalogue's geometry. The listing, the home shelf, the PDP rail and this
 *    page now share ONE explicit 1 / 2 / 3-column schedule with a 288px floor.
 *  - **`minHeight: '100vh'` is deleted** (§5.9, by name). This page sits inside
 *    `Layout`'s flex column, below a nav spacer and above the footer, so a
 *    100vh minimum guaranteed a vertical scrollbar and pushed the footer
 *    off-screen **on every single visit** — including when the page was showing
 *    a 64px empty-state circle. `Layout`'s `flexGrow: 1` on `<main>` already
 *    does what it was reaching for.
 *  - **UTILITY heading.** `variant="h3" component="h1"` at 26px with
 *    `py: var(--lf-sect)`, so "Saved items" stops rendering 50% larger than
 *    "My orders" and "My account" — three pages of the same kind reached from
 *    the same menu (§2.34).
 *  - `.lf-rule` → `.lf-ledge` (§2.3): the 1px gold hairline composited to
 *    1.30:1 over canvas and is deleted system-wide; the ledge is 2px solid
 *    `--lf-gold` at 1.96:1 with a warm under-shadow. One per page here, well
 *    inside the four-per-page maximum.
 *  - The skeleton count is **derived** from what is about to render rather
 *    than hardcoded to 4 (§7.5 rule 3, P5).
 *
 * EARLIER PASSES, UNCHANGED
 *  - It destructured `removeFromWishlist` and never called it, and kept three
 *    pieces of `Snackbar` state feeding a `<Snackbar>` nothing could open.
 *    Removing an item is the heart on `<ProductCard>` (LF-23), so there is one
 *    implementation of that action rather than two.
 *  - `wishlist.products` renders as real nested products.
 *  - `initialised` from `WishlistContext` separates "not fetched yet" from
 *    "nothing saved", so a signed-in shopper no longer reads "empty" for as
 *    long as the fetch takes. The empty and error states are the shared ones.
 *  - No `Grid`: its legacy v1 props render unstyled on MUI 7.3.5.
 * ========================================================================== */

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

import { useWishlist } from '../context/WishlistContext';
import SeoHead from '../components/common/SeoHead';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import ProductCardSkeleton, { useSkeletonDelay } from '../components/common/ProductCardSkeleton';
import ProductCard from '../components/product/ProductCard';
import { PRODUCT_GRID_SX, skeletonCount } from '../components/product/productGrid';

const Wishlist = () => {
  const { products, loading, initialised, error, refresh } = useWishlist();
  const waiting = loading || !initialised;
  const showSkeletons = useSkeletonDelay(waiting);

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
      {/* A personal page: useful to the owner, worthless in an index. */}
      <SeoHead title="Saved items" noindex />

      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" sx={{ color: 'var(--lf-ink)' }}>
          Saved items
        </Typography>
        <Box className="lf-ledge" sx={{ mt: 2, mb: 3 }} />

        {error && !waiting ? (
          <ErrorState
            title="Couldn't load your saved items"
            onRetry={refresh}
            secondaryLabel="Shop all products"
            secondaryTo="/products"
            variant="page"
          />
        ) : waiting ? (
          <Box sx={PRODUCT_GRID_SX} aria-busy="true">
            {showSkeletons ? (
              <ProductCardSkeleton
                count={skeletonCount(products.length || 3)}
                label="Loading your saved items"
              />
            ) : null}
          </Box>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<FavoriteBorderIcon />}
            title="Nothing saved yet"
            message="Tap the heart on any product to keep it here for later."
            primaryLabel="Shop all products"
            primaryTo="/products"
            variant="page"
          />
        ) : (
          <>
            <Typography variant="caption" component="p" sx={{ color: 'var(--lf-ink-3)', mb: 2 }} role="status">
              {`${products.length} ${products.length === 1 ? 'item' : 'items'} saved`}
            </Typography>
            <Box sx={PRODUCT_GRID_SX}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
};

export default Wishlist;
