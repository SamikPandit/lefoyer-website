/**
 * ============================================================================
 * <AddToBag> — ART_DIRECTION.md §6.5. INK, ALWAYS.
 *
 * §2.17 upheld: the primary CTA stays ink `--lf-ink` at ~16:1. A grid of gold
 * buy-buttons turns the accent into a theme colour; ink is the most legible
 * thing on the page and it is what keeps gold precious enough for §2.18's two
 * licensed fills (`Notify me` and the newsletter `Join`).
 *
 * GEOMETRY (§6.5, proved at the 288px floor in §4.3):
 *   · 48px on a card, 52px in a buy box, full width of its container.
 *   · **No `startIcon` on a card** (§2.15). The bag glyph carries no
 *     information the label does not and costs 28px of the only space that
 *     matters. It is licensed in the PDP buy box and the mobile buy bar, and
 *     nowhere else.
 *   · Label box at 288px = 288 − 2×20 of MUI padding = 248px; `Add to bag` at
 *     15px/600 Inter measures ~75px, so it clears by 173px. On the build this
 *     replaces the same label sat in a `p:1.5` box behind a 20px bag icon with
 *     ~59px of label box for a label needing ~76px — which is why `Add to bag`
 *     and `Notify me` BOTH wrap to two lines on all six cards in plp-desk.png.
 *     `white-space: nowrap` makes that wrap structurally impossible rather
 *     than merely unlikely.
 *
 * STATES (§6.5), every one of them transform/opacity/colour only (P7):
 *   · Loading — `min-width` frozen at the MEASURED label width so the button
 *     cannot reflow its grid row, the label drops to `opacity .45` (it never
 *     disappears), a 16px `thickness 3.6` `currentColor` spinner centres over
 *     it, `aria-busy="true"`, pointer events off, and a **400ms minimum
 *     display** so a fast network cannot make it flicker.
 *   · Success — the label CROSSFADES to a check + `Added` for 900ms while the
 *     nav bag badge springs on `--lf-ease-spring` (licensed moment 1 of 2).
 *   · Error — **a button never turns red.** It returns to its default and the
 *     error appears adjacent, carrying the server's own sentence ("Only 3
 *     units available"), which is worth more than "Failed to add to cart".
 *
 * It never renders with the `disabled` attribute (A4): an unbuyable product
 * gets <NotifyMe> in this slot instead, and an unpriced one gets a secondary
 * `View details` — a dead grey button is the version of this we are deleting.
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';

import { useCart } from '../../context/CartContext';
import { priceLabelOf } from './PriceBlock';

/** §6.5: "400ms minimum display" so the loading state cannot flicker. */
const MIN_SPINNER_MS = 400;
/** §6.5: the success flash. Shorter than this reads as a glitch. */
const ADDED_FLASH_MS = 900;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 48 on a card, 52 in a buy box (§6.5). Nothing else sets this height. */
const HEIGHTS = { card: 48, buybox: 52 };

/**
 * @param {object}   props
 * @param {object}   props.product        The API payload. Never a typed name.
 * @param {number}   [props.quantity=1]
 * @param {'card'|'buybox'} [props.size='card']
 * @param {boolean}  [props.fullWidth=true]
 * @param {string}   [props.label='Add to bag']
 * @param {boolean}  [props.withPrice=false]  Appends ` · ₹480` from the real
 *   payload, for the PDP's primary CTA (§5.3). Never a typed number.
 * @param {boolean}  [props.showIcon]     Defaults to true in a buy box, false
 *   on a card. The bag glyph is licensed in the buy box and the mobile buy bar.
 * @param {Function} [props.onAdded]      Called with the product after success.
 * @param {Function} [props.onError]      Called with the message. When given,
 *   the caller owns the adjacent message and this component renders none.
 * @param {object}   [props.sx]
 * @param {string}   [props.className]
 * @returns {JSX.Element}
 */
export default function AddToBag({
  product,
  quantity = 1,
  size = 'card',
  fullWidth = true,
  label = 'Add to bag',
  withPrice = false,
  showIcon,
  onAdded,
  onError,
  sx,
  className,
  ...rest
}) {
  const { addToCart, pendingItemIds } = useCart();

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);
  /** The measured label width, frozen for the duration of the request. */
  const [frozenWidth, setFrozenWidth] = useState(null);

  const buttonRef = useRef(null);
  const aliveRef = useRef(true);
  const flashTimer = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const height = HEIGHTS[size] || HEIGHTS.card;
  const withBag = showIcon === undefined ? size === 'buybox' : showIcon;
  const busy = adding || (pendingItemIds || []).includes(product?.id);

  const priceLabel = withPrice ? priceLabelOf(product) : null;
  const restingLabel = priceLabel ? `${label} · ${priceLabel}` : label;

  const handleClick = async (event) => {
    /* A card's whole surface is a link via the name anchor's ::after; a press
       on this button must add to the bag, not navigate. */
    event.preventDefault();
    event.stopPropagation();
    if (busy || !product) return;

    /* Freeze the width BEFORE the spinner mounts, from the real rendered box
       (§6.5) — a guessed `minWidth` is how a button jumps a grid row. */
    const measured = buttonRef.current ? buttonRef.current.offsetWidth : null;
    if (measured) setFrozenWidth(measured);

    setError(null);
    if (typeof onError === 'function') onError(null);
    setAdding(true);

    const startedAt = Date.now();
    const result = await addToCart(product, quantity);
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPINNER_MS) await sleep(MIN_SPINNER_MS - elapsed);
    if (!aliveRef.current) return;

    setAdding(false);
    if (result === true) {
      setAdded(true);
      if (typeof onAdded === 'function') onAdded(product);
      flashTimer.current = setTimeout(() => {
        if (!aliveRef.current) return;
        setAdded(false);
        setFrozenWidth(null);
      }, ADDED_FLASH_MS);
      return;
    }

    setFrozenWidth(null);
    /* CartContext returns the backend's own sentence where it has one. */
    const message = typeof result === 'string' ? result : 'We could not add that to your bag.';
    if (typeof onError === 'function') onError(message);
    else setError(message);
  };

  return (
    <>
      <Button
        ref={buttonRef}
        className={className ? `lf-press ${className}` : 'lf-press'}
        type="button"
        variant="contained"
        color="primary"
        fullWidth={fullWidth}
        onClick={handleClick}
        aria-busy={busy || undefined}
        sx={{
          minHeight: height,
          /* The CTA owns the full width of its container, so the label box is
             248px at the 288px floor — 2.3× what the label needs. */
          whiteSpace: 'nowrap',
          ...(frozenWidth ? { minWidth: frozenWidth } : null),
          ...(busy ? { pointerEvents: 'none' } : null),
          ...sx,
        }}
        {...rest}
      >
        <Box
          component="span"
          sx={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--lf-2)',
          }}
        >
          {/* The resting label. It dims, it never disappears, so the measured
              width survives the request. */}
          <Box
            component="span"
            data-motion="crossfade"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--lf-2)',
              opacity: added ? 0 : busy ? 0.45 : 1,
              transition: 'opacity var(--lf-dur-2) var(--lf-ease)',
            }}
          >
            {withBag ? <ShoppingBagOutlinedIcon aria-hidden="true" sx={{ fontSize: 20 }} /> : null}
            {restingLabel}
          </Box>

          {/* The success layer, crossfaded over the label for 900ms. */}
          <Box
            component="span"
            aria-hidden="true"
            data-motion="crossfade"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--lf-1)',
              opacity: added ? 1 : 0,
              pointerEvents: 'none',
              transition: 'opacity var(--lf-dur-2) var(--lf-ease)',
            }}
          >
            <CheckIcon sx={{ fontSize: 20 }} />
            Added
          </Box>

          {busy ? (
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress size={16} thickness={3.6} sx={{ color: 'inherit' }} />
            </Box>
          ) : null}
        </Box>
      </Button>

      {/* §6.5: the outcome is stated ADJACENT, never by turning the button red.
          Zero height until there is something to say, so the card's row
          arithmetic (§4.3) is unaffected. */}
      {typeof onError === 'function' ? null : (
        <Box aria-live="polite" sx={{ minWidth: 0 }}>
          {error ? (
            <Typography
              variant="caption"
              role="alert"
              sx={{ display: 'block', color: 'var(--lf-err-ink)', mt: 'var(--lf-1)' }}
            >
              {error}
            </Typography>
          ) : null}
        </Box>
      )}

      {/* The success flash is visual; this says it out loud exactly once. */}
      <Box className="lf-sr-only" role="status" aria-live="polite">
        {added ? 'Added to your bag' : ''}
      </Box>
    </>
  );
}
