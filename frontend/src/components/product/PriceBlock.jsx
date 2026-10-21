/**
 * ============================================================================
 * <PriceBlock> — ART_DIRECTION.md §6.3. ONE component, FIVE surfaces.
 *
 * Card, buy box, cart line, summary row, search row — so **a price can never
 * disagree with itself**. Before this, the card printed `₹{price}` (the list
 * price) while the PDP printed `₹{discount_price}`, and a bare `₹{price}` on a
 * DRF `DecimalField` renders `₹1299.00`.
 *
 *   · `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR',
 *     maximumFractionDigits:0})` → `₹1,299`, `₹1,29,900` with Indian grouping.
 *   · `price` 17px on a card, `priceLg` 28–34px in a buy box, both
 *     `font-variant-numeric: tabular-nums` ALWAYS (the typography variants in
 *     theme.js §3.7 carry `tnum`, so a changing digit never shifts the row).
 *   · The current price is `--lf-ink` at 15.97:1 on canvas.
 *   · It NEVER renders `₹undefined`, `₹NaN` or `₹0`. A missing price renders
 *     `Price on request`, and the caller is expected to degrade its CTA to a
 *     secondary `View details` — `hasPrice()` is exported for exactly that.
 *
 * §6.8 RULE 4 IS NARROWLY OVERTURNED (§2.21): the price stays at FULL
 * `--lf-ink` weight on an out-of-stock card. That rule exists to stop a shop
 * advertising a DISCOUNT on something nobody can buy; zero of the six products
 * carry a `discount_price`, so there is nothing to suppress, and dimming a true
 * price on an item you can still reserve is a sales decision wearing an
 * accessibility costume. The savings treatment — and only that — is still
 * withheld on an unsellable product, which is the part of rule 4 that survives.
 *
 * The money helpers themselves live in `productPresentation.js`, which already
 * serves `ProductListing` and `ProductFilter`; they are re-exported here so
 * §6.8's "formatted by PriceBlock's formatter" has one honest address.
 * ========================================================================== */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { formatRupees, priceView, unitPrice } from './productPresentation';

export { formatRupees, priceView, unitPrice };

/** The two registers §6.3 names. Nothing else writes a price size. */
const VARIANTS = { md: 'price', lg: 'priceLg' };

/**
 * Does this product have a real, chargeable price? The CTA degrades to
 * `View details` when it does not (§6.3).
 * @param {object} product
 * @returns {boolean}
 */
export function hasPrice(product) {
  return priceView(product).hasPrice;
}

/**
 * The formatted unit price, or `null`. For a button label that carries the
 * price — the PDP's `Add to bag · ₹480` (§5.3).
 * @param {object} product
 * @returns {string|null}
 */
export function priceLabelOf(product) {
  return priceView(product).priceLabel;
}

/**
 * The formatted sum of a set of products, for `<ShelfBundle>`'s
 * `Add the shelf · ₹1,080` (§6.8) — computed from real prices at render,
 * NEVER a typed number.
 * @param {object[]} products
 * @returns {string|null}
 */
export function sumPriceLabel(products) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const total = products.reduce((sum, product) => sum + unitPrice(product), 0);
  return formatRupees(total);
}

/**
 * @param {object}  props
 * @param {object}  props.product   The API payload. The price is never typed.
 * @param {'md'|'lg'} [props.size='md']  `md` = card/row/line, `lg` = buy box.
 * @param {boolean} [props.sellable]  Defaults to true. `false` withholds the
 *   SAVINGS treatment only — the price itself stays full-weight (§2.21).
 * @param {string}  [props.missingLabel='Price on request']
 * @param {object}  [props.sx]
 * @param {string}  [props.className]
 * @returns {JSX.Element}
 */
export default function PriceBlock({
  product,
  size = 'md',
  sellable = true,
  missingLabel = 'Price on request',
  sx,
  className,
  ...rest
}) {
  const price = priceView(product, { sellable });
  const variant = VARIANTS[size] || VARIANTS.md;

  if (!price.hasPrice) {
    return (
      <Box className={className} sx={{ minWidth: 0, ...sx }} {...rest}>
        <Typography variant={variant} component="p" sx={{ color: 'var(--lf-ink-3)' }}>
          {missingLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: 'var(--lf-2)',
        minWidth: 0,
        ...sx,
      }}
      {...rest}
    >
      {/* FULL --lf-ink, in stock or out (§2.21). 15.97:1 on canvas. */}
      <Typography variant={variant} component="p" sx={{ color: 'var(--lf-ink)' }}>
        {price.priceLabel}
      </Typography>

      {/* Only ever rendered when the API really carries a higher list price. */}
      {price.compareLabel ? (
        <Typography variant="priceCompare" component="span">
          <span className="lf-sr-only">Was </span>
          {price.compareLabel}
        </Typography>
      ) : null}

      {price.showSavings ? (
        <Typography variant="badge" component="span" sx={{ color: 'var(--lf-ok-ink)' }}>
          Save {price.savingsPercent}%
        </Typography>
      ) : null}
    </Box>
  );
}
