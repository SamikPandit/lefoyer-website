/**
 * Wishlist — the saved-items page.
 *
 * WHAT CHANGED
 *  - It destructured `removeFromWishlist` and never called it, and kept three pieces of
 *    `Snackbar` state (`openSnackbar`, `snackbarMessage`, `snackbarSeverity`) feeding a
 *    `<Snackbar>` that nothing could ever open. All of it is gone; removing an item is
 *    the heart on `ProductCard`, which is now actually wired (LF-23), so there is one
 *    implementation of that action rather than two.
 *  - It hard-coded a display-serif `fontFamily` twice — a font this app has
 *    never loaded (DESIGN_SYSTEM: referenced in seven files, loaded in none). The headings
 *    use the theme's own display face.
 *  - `wishlist.products` is rendered as real nested products, which is what §2b #26
 *    makes the backend serialise (it used to emit bare PKs).
 *  - It had three states (`loading` / `error` / empty-or-full) driven by a context that
 *    starts `wishlist === null`, so a signed-in shopper saw "Your wishlist is empty"
 *    for as long as the fetch took. `initialised` from `WishlistContext` separates
 *    "not fetched yet" from "nothing saved", and the empty and error states are the
 *    shared ones (DESIGN_SYSTEM §6.9).
 *  - Its legacy v1 `Grid` props render unstyled on MUI 7.3.5 (the props are ignored
 *    outright). The layout is now the same CSS grid every other product surface uses, so
 *    there is no `Grid` in this package at all.
 */

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
import { PRODUCT_GRID_SX } from '../components/product/RelatedProducts';

const Wishlist = () => {
  const { products, loading, initialised, error, refresh } = useWishlist();
  const waiting = loading || !initialised;
  const showSkeletons = useSkeletonDelay(waiting);

  return (
    <Box sx={{ backgroundColor: 'var(--lf-canvas)', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      {/* A personal page: useful to the owner, worthless in an index. */}
      <SeoHead title="Saved items" noindex />

      <Container maxWidth="lg">
        <Typography variant="h1" component="h1" sx={{ mb: 1 }}>
          Saved items
        </Typography>
        <Box className="lf-rule" sx={{ mb: 3 }} />

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
            {showSkeletons ? <ProductCardSkeleton count={4} label="Loading your saved items" /> : null}
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
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)', mb: 2 }} role="status">
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
