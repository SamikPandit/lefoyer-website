/**
 * ============================================================================
 * <StockLabel> — ART_DIRECTION.md §6.4. The words, the dot, every surface.
 *
 * ONE derivation (`utils/stock.js`), consumed by the card, the PDP, the search
 * row and the cart line. Four states, **each with its own words AND a dot,
 * never colour alone** (A8). **Rendered always, including when in stock** — a
 * shelf that only speaks up when something is wrong teaches people to ignore
 * it, and "in stock" is the single most valuable thing a listing can say about
 * a catalogue that is half sold out.
 *
 * TWO REGISTERS, ONE COMPONENT:
 *
 *   `ledge`  — §6.2 item 2, THE FIX FOR THE BADGE/HEART COLLISION (§2.14).
 *              A FULL-WIDTH ROW BENEATH THE NICHE, above the name: 6px dot +
 *              12px/600/+0.14em uppercase. The chip it replaces sat INSIDE the
 *              mat at `left:8` while the wishlist button sat at `right:20,
 *              width:36`, so clearance needed a card wider than ~175px and the
 *              real widths were 161/157/171/173px — overlapped at EVERY
 *              breakpoint the PLP rendered at (visible in plp-desk.png on Glow
 *              Game, WhiteWave and Spotless). With the status out of the frame
 *              the collision is structurally impossible at any card width in
 *              any language, rather than narrowly avoided.
 *              Measured at the 288px floor (§4.3): `IN STOCK` ≈ 82px + a 6px
 *              dot + an 8px gap = 96px of 288. `BACK SOON` = 106px.
 *
 *   `inline` — 13px sentence case for the buy box, the search row and the cart
 *              line, where the status sits in a column of prose, not on a card.
 *
 * Contrast, measured on canvas: `--lf-ok-ink` 6.13:1 · `--lf-warn-ink` 6.24:1 ·
 * `--lf-gold-ink` 5.55:1. The dot is decorative and carries no meaning alone.
 * ========================================================================== */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { stockState } from '../../utils/stock';

/** The two registers. Nothing else sets a size on a stock line. */
const REGISTERS = {
  ledge: { variant: 'eyebrow', minHeight: 20 },
  inline: { variant: 'caption', minHeight: 20 },
};

/**
 * @param {object}  props
 * @param {object}  [props.product]  The API payload. Derived with `stockState`.
 * @param {object}  [props.stock]    A pre-derived state, when the caller
 *   already has one (the PDP derives it once for the stepper and the CTA).
 *   Passing it keeps the derivation single — it does not add a second one.
 * @param {'ledge'|'inline'} [props.variant='ledge']
 * @param {object}  [props.sx]
 * @param {string}  [props.className]
 * @returns {JSX.Element|null}
 */
export default function StockLabel({
  product = null,
  stock: stockProp = null,
  variant = 'ledge',
  sx,
  className,
  ...rest
}) {
  const stock = stockProp || (product ? stockState(product) : null);
  if (!stock) return null;

  const register = REGISTERS[variant] || REGISTERS.ledge;
  const isLedge = variant === 'ledge';

  return (
    <Box
      className={className}
      data-stock-label={stock.state}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--lf-2)',
        minHeight: register.minHeight,
        minWidth: 0,
        ...sx,
      }}
      {...rest}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 6,
          height: 6,
          flex: 'none',
          borderRadius: 'var(--lf-r-pill)',
          backgroundColor: stock.dotColor,
        }}
      />
      <Typography
        variant={register.variant}
        component="span"
        sx={{ color: stock.textColor, ...(isLedge ? null : { fontWeight: 600 }) }}
      >
        {isLedge ? stock.ledgeLabel : stock.label}
      </Typography>
    </Box>
  );
}
