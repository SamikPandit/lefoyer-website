/**
 * The 404 route. ART_DIRECTION §5.8 / §5.9 (EDITORIAL). LF-29.
 *
 * THE DEFECT THIS FIXES (visible in the before-state capture)
 * The content sat top-aligned in a `variant="page"` state with roughly 1,200px of empty
 * canvas between the last recovery link and the footer — a dead end that looks like a
 * broken deploy. §5.8's table fixes it with one line: the `children` slot that
 * `EmptyState` has shipped since it was written and that **no caller has ever passed**
 * (§2.28). With six SKUs the 404 can show the shop.
 *
 * | Route | Heading | Rail passed as `children` |
 * | 404 (`NotFound.jsx:40`) | `We can't find that page` | the three in-stock products |
 *
 * So: §2.16's form is upheld exactly — 64px tinted circle, 28px outline glyph, heading,
 * one line, one primary, one text escape, **no illustration** — and the three products a
 * shopper can actually buy today sit underneath it. The three hand-rolled recovery links
 * and the support row are deleted: they were ceremony standing in for merchandise, and
 * LF-29's acceptance test names the footer, navbar, cart, checkout, confirmation and PDP
 * as the routes to a human, not this one.
 *
 * The heading is §5.8's string verbatim ("We can't find that page"), and it renders at
 * §5.9's EDITORIAL register — `variant="h1"` as the route's single `h1`.
 *
 * `noindex`, because a soft 404 in the index is worse than none. A dead product URL is
 * the usual way someone arrives here (the catalogue is slug-routed), which is why
 * "Browse all products" is the primary rather than "Go home".
 */

import { Box, Typography } from '@mui/material';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';

import SeoHead from '../components/common/SeoHead';
import ProductCard from '../components/product/ProductCard';
import ProductCardSkeleton from '../components/common/ProductCardSkeleton';
import { PRODUCT_GRID_SX } from '../components/product/productGrid';
import EmptyState, { PageShell, useProductShelf } from '../components/common/EmptyState';

/** §5.8: "the three in-stock products". Exactly three are sellable today. */
const RAIL_SIZE = 3;

export default function NotFound() {
  const { products, loading } = useProductShelf({ inStockOnly: true, limit: RAIL_SIZE });
  const showRail = loading || products.length > 0;

  return (
    <>
      <SeoHead title="Page not found" noindex />

      <PageShell archetype="editorial" maxWidth="lg">
        <EmptyState
          icon={<TravelExploreOutlinedIcon />}
          headingComponent="h1"
          titleVariant="h1"
          title="We can't find that page"
          message="The link may be old, or the product may have moved. Nothing is wrong with your account or your bag."
          primaryLabel="Browse all products"
          primaryTo="/products"
          secondaryLabel="Search the catalogue"
          secondaryTo="/search"
          sx={{ py: 0 }}
        >
          {showRail ? (
            <Box component="section" aria-labelledby="notfound-rail-heading">
              <Typography
                id="notfound-rail-heading"
                variant="h2"
                component="h2"
                sx={{ color: 'var(--lf-ink)', mb: 3 }}
              >
                In stock right now
              </Typography>
              <Box sx={PRODUCT_GRID_SX}>
                {loading && products.length === 0 ? (
                  <ProductCardSkeleton count={RAIL_SIZE} label="Loading products" />
                ) : (
                  products.map((product) => (
                    <ProductCard key={product.id ?? product.slug} product={product} />
                  ))
                )}
              </Box>
            </Box>
          ) : null}
        </EmptyState>
      </PageShell>
    </>
  );
}
