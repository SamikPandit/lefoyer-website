/**
 * ============================================================================
 * ③ THE SHELF — ART_DIRECTION.md §5.1③ / §2.22 / §2.23 / §2.29 / §4.
 *
 * THE FOLD-BREAKER, AND THE WHOLE CATALOGUE. This replaces two modules at
 * once: a "Curated Essentials" rail whose `md:8` column held an inner grid of
 * `md:4` cards — so the permanently-empty third slot was ~256px of blank
 * canvas and the skeleton promised three products when two arrived — and a
 * 240px circular rail that was a second, incompatible card language 800px
 * below the first. §10.23: ONE CARD, ONE GRID, SITE-WIDE.
 *
 * `<ProductCard>` at `PRODUCT_GRID_SX` (§4.1), identical to the PLP. Not a
 * variant, not a prop, not a copy. The grid is defined in `productGrid.js` and
 * nowhere else (§10.5), so the 161.6px card and the ragged five-up row that
 * `repeat(auto-fill, minmax(156px, 1fr))` produced are structurally
 * impossible here.
 *
 * IN-STOCK FIRST (§2.23), stable within each group so the server's
 * `display_order` still decides the order inside a group — which is what
 * LF-20's acceptance test actually exercises ("change `display_order` in admin
 * and show the homepage rail reorders with no deploy"). Opening on three
 * sold-out cards reads as *sold out*, not as *organised*.
 *
 * THE DATA RESOLVES ITSELF INTO A LIT ROW AND AN UNLIT ROW (§1.1). Three of
 * six are in stock, so at ≥1200 row 1 is three lit niches with ink `Add to
 * bag` and row 2 is three unlit niches with gold `Notify me`. Nothing is
 * hidden and nothing is apologised for.
 *
 * THE `Back soon` LINE, AND WHY IT IS CONDITIONAL. §5.1③ puts "a single 13px
 * --lf-ink-3 line above row 2", which is true at 3-up where the group boundary
 * IS a row boundary. At 2-up it is not: three in-stock products end mid-row,
 * and a full-width line there would split a row and leave the ragged final row
 * §2.29 bans. So the line is a `1 / -1` grid item that is displayed only at
 * the breakpoints where the boundary already falls between rows — computed
 * from the real in-stock count, per column schedule. When it is hidden the
 * grid is untouched; when it shows, nothing moves. It is also withheld unless
 * every product beneath it is genuinely `out`, because "Back soon" is not true
 * of a `coming_soon` product.
 *
 * NO FABRICATED PROOF ANYWHERE IN HERE (§10.9) — the card owns that, and it
 * renders `Be the first to review` for all six.
 * ========================================================================== */

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import ProductCardSkeleton from '../common/ProductCardSkeleton';
import ProductCard from '../product/ProductCard';
import { PRODUCT_GRID_SX, skeletonCount } from '../product/productGrid';
import { PRODUCT_PAGE_SIZE } from '../product/productPresentation';
import { STOCK, stockState } from '../../utils/stock';
import ShelfBundle from '../product/ShelfBundle';
import { countWord, countWordCap } from './countWords';

/**
 * In-stock first, STABLE inside each group (§2.23). `Array.prototype.sort` is
 * specified as stable in ES2019, but the index tiebreak makes the intent
 * explicit rather than relying on it: the server's order inside a group is
 * the merchandising decision and must survive.
 * @param {object[]} products
 * @returns {object[]}
 */
export function shelfOrder(products) {
  return (products || [])
    .map((product, index) => ({ product, index, sellable: stockState(product).sellable }))
    .sort((a, b) => Number(b.sellable) - Number(a.sellable) || a.index - b.index)
    .map((entry) => entry.product);
}

/**
 * The sentence under the ledge. Every count comes from the payload (§10.21).
 * @param {number} inCount
 * @param {number} outCount
 * @returns {string}
 */
function shelfLine(inCount, outCount) {
  const first = `${countWordCap(inCount)} on the shelf today.`;
  if (outCount <= 0) return first;
  const verb = outCount === 1 ? 'comes' : 'come';
  return `${first} The other ${countWord(outCount)} ${verb} back — we’ll tell you when.`;
}

/**
 * @param {object} props
 * @param {object[]} [props.products]
 * @param {'loading'|'ready'|'error'|'empty'} [props.status='loading']
 * @param {object} [props.error]
 * @param {Function} [props.onRetry]
 * @param {Array<number|string>} [props.bagProductIds] Ids already in the bag,
 *   forwarded to `<ShelfBundle>` so its total is the sum of exactly what it
 *   will add (§6.8).
 * @returns {JSX.Element}
 */
const Shelf = ({ products = [], status = 'loading', error, onRetry, bagProductIds = [] }) => {
  const ordered = shelfOrder(products);
  const sellable = ordered.filter((product) => stockState(product).sellable);
  const rest = ordered.filter((product) => !stockState(product).sellable);

  const inCount = sellable.length;
  const outCount = rest.length;
  const total = ordered.length;

  /* "Back soon" is only true when every product beneath the line is `out`. */
  const restIsAllOut = outCount > 0 && rest.every((p) => stockState(p).state === STOCK.OUT);

  /* The group boundary is a ROW boundary only where the in-stock count
     divides the column count. §4.1's schedule: 1 col · 2 cols from 680 ·
     3 cols from 1200. */
  const dividerDisplay = {
    display: 'block',
    '@media (min-width:680px)': { display: inCount % 2 === 0 ? 'block' : 'none' },
    '@media (min-width:1200px)': { display: inCount % 3 === 0 ? 'block' : 'none' },
  };

  return (
    <Box
      component="section"
      aria-labelledby="home-shelf-heading"
      sx={{ py: 'var(--lf-sect)', backgroundColor: 'var(--lf-canvas)' }}
    >
      <Container>
        <Box sx={{ maxWidth: '56ch', minWidth: 0 }}>
          <Typography variant="eyebrow">The shelf</Typography>

          <Typography
            id="home-shelf-heading"
            variant="h2"
            component="h2"
            sx={{ mt: 'var(--lf-2)', color: 'var(--lf-ink)' }}
          >
            {total > 0 ? `${countWordCap(total)} formulations.` : 'The shelf'}
          </Typography>

          {/* LEDGE 2 of 4 on this page (§3.3). */}
          <Box component="hr" className="lf-ledge" sx={{ mt: 'var(--lf-4)' }} />

          {total > 0 ? (
            <Typography
              variant="caption"
              component="p"
              sx={{ mt: 'var(--lf-3)', color: 'var(--lf-ink-3)' }}
            >
              {shelfLine(inCount, outCount)}
            </Typography>
          ) : null}
        </Box>

        {status === 'error' ? (
          <Box sx={{ mt: '40px' }}>
            <ErrorState
              title="We could not load the shelf"
              error={error}
              onRetry={onRetry}
              secondaryLabel="Browse all products"
              secondaryTo="/products"
            />
          </Box>
        ) : status === 'empty' ? (
          <Box sx={{ mt: '40px' }}>
            <EmptyState
              title="The shelf is empty just now"
              message="Nothing is published yet. The full catalogue opens the moment it is."
              primaryLabel="Browse all products"
              primaryTo="/products"
            />
          </Box>
        ) : (
          <>
            <Box sx={{ ...PRODUCT_GRID_SX, mt: '40px' }} aria-busy={status === 'loading'}>
              {status === 'loading' ? (
                /* §7.5 rule 3: derived from the expected count, never
                   hardcoded. `skeletonCount` caps at two full rows. */
                <ProductCardSkeleton count={skeletonCount(PRODUCT_PAGE_SIZE)} label="Loading the shelf" />
              ) : (
                <>
                  {sellable.map((product) => (
                    <ProductCard key={product.id ?? product.slug} product={product} />
                  ))}

                  {restIsAllOut ? (
                    <Typography
                      variant="caption"
                      component="p"
                      sx={{
                        gridColumn: '1 / -1',
                        color: 'var(--lf-ink-3)',
                        ...dividerDisplay,
                      }}
                    >
                      Back soon
                    </Typography>
                  ) : null}

                  {rest.map((product) => (
                    <ProductCard key={product.id ?? product.slug} product={product} />
                  ))}
                </>
              )}
            </Box>

            {status === 'ready' ? (
              <ShelfBundle products={sellable} exclude={bagProductIds} sx={{ mt: 'var(--lf-8)' }} />
            ) : null}
          </>
        )}
      </Container>
    </Box>
  );
};

export default Shelf;
