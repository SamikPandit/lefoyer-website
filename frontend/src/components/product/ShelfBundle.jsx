/**
 * ============================================================================
 * <ShelfBundle> — ART_DIRECTION.md §6.8 / §2.19 / §2.20.
 *
 * THE ONE BASKET-RAISING MECHANIC ON THE SITE.
 *
 * Every other CTA here adds one bottle at ₹280–480 with free delivery and COD
 * exposure. This is the only mechanic in the brief that raises a basket, and
 * it is built entirely from facts the shipped code can prove:
 *
 *   · THE TOTAL IS COMPUTED FROM REAL PRICES AT RENDER, never typed (§10.21).
 *     `sumPriceLabel()` is <PriceBlock>'s own formatter, so the bundle total
 *     and the card prices are formatted by one function and cannot disagree.
 *   · NO INVENTED DISCOUNT, NO INVENTED URGENCY, NO INVENTED BUNDLE PRICE
 *     (§6.8, §2.19). `policy.js` already makes delivery free with no
 *     threshold, so there is no nudge available to fake. What is offered is
 *     completeness and one arrival, and both are true.
 *   · INK, NOT GOLD (§2.20). A gold button 300px from three ink `Add to bag`
 *     buttons inverts the hierarchy: the action that adds three products
 *     should be the BIGGEST INK ACTION ON THE PAGE, not a different hue. It
 *     gets its prominence from scale (52px, full panel width) and position,
 *     and gold stays at its two licensed fills (§2.18).
 *   · IT USES THE EXISTING CART SERVICE. N calls through `useCart().addToCart`,
 *     no new endpoint (§6.8). If any call fails, the outcome NAMES EXACTLY
 *     which products were added and which were not — "some of them worked" is
 *     not a sentence a shopper can act on.
 *
 * IT RENDERS `null` unless at least two in-stock products are not already in
 * the bag, so it disappears the moment it has nothing honest to offer rather
 * than degrading into a dead button.
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import { useCart } from '../../context/CartContext';
import { stockState } from '../../utils/stock';
import { hasPrice, sumPriceLabel } from './PriceBlock';

/** §6.5's minimum spinner display, so a fast network cannot make it flicker. */
const MIN_SPINNER_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * §6.8's subtext is `Three formulations, one delivery.` — but "three" is a
 * STOCK STATE typed into a component, which §10.21 forbids outright, and the
 * sentence becomes a lie the first time a fourth product comes back in stock.
 * So the word is derived from the set the button will actually add. On today's
 * catalogue (exactly three sellable SKUs, verified) this renders §6.8's
 * sentence character for character.
 */
const COUNT_WORDS = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const countWord = (n) => COUNT_WORDS[n] || String(n);

/** An honest list: "A, B and C". Never "and 2 others". */
const nameList = (products) => {
  const names = products.map((product) => product?.name).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * @param {object}   props
 * @param {object[]} props.products   Candidates — typically every product the
 *   surface is showing, including the one being viewed (§5.3: "the current
 *   product already counted in the total"). Unsellable and unpriced ones are
 *   filtered out here, so a caller cannot accidentally bundle a sold-out SKU.
 * @param {Array<number|string>} [props.exclude=[]]  Product ids already in the
 *   bag. The button never offers to add something twice.
 * @param {string}   [props.label='Add the shelf']
 * @param {object}   [props.sx]
 * @param {string}   [props.className]
 * @returns {JSX.Element|null}
 */
export default function ShelfBundle({
  products,
  exclude = [],
  label = 'Add the shelf',
  sx,
  className,
  ...rest
}) {
  const { addToCart } = useCart();

  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const excluded = new Set((exclude || []).map((id) => String(id)));
  const seen = new Set();

  /* The exact set the button will add — which is also the set the total is
     summed from, so the label can never promise a price for a different
     basket than the one it builds. */
  const targets = (Array.isArray(products) ? products : []).filter((product) => {
    if (!product || product.id === undefined || product.id === null) return false;
    const id = String(product.id);
    if (seen.has(id) || excluded.has(id)) return false;
    if (!stockState(product).sellable || !hasPrice(product)) return false;
    seen.add(id);
    return true;
  });

  /* §6.8: "Renders ONLY when ≥2 in-stock products are not already in the bag;
     otherwise it renders null." */
  if (targets.length < 2) return null;

  const total = sumPriceLabel(targets);
  if (!total) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);

    const startedAt = Date.now();
    const added = [];
    const failed = [];

    /* N calls through the EXISTING cart service — no new endpoint (§6.8).
       Sequential, so the server sees the same ordering a shopper tapping
       three buttons would produce and the per-line stock checks still apply. */
    for (const product of targets) {
      const result = await addToCart(product, 1);
      if (result === true) added.push(product);
      else failed.push({ product, message: typeof result === 'string' ? result : null });
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPINNER_MS) await sleep(MIN_SPINNER_MS - elapsed);
    if (!aliveRef.current) return;

    setBusy(false);

    if (failed.length === 0) {
      setOutcome({
        tone: 'ok',
        text: `Added ${nameList(added)} to your bag.`,
      });
      return;
    }

    /* "If any call fails, it names exactly which products were added and which
       were not" (§6.8). The server's own sentence is carried where it gave
       one ("Only 3 units available"), because it tells the shopper what to do. */
    const serverSentence = failed.map((entry) => entry.message).find(Boolean);
    setOutcome({
      tone: 'error',
      text: [
        added.length ? `Added ${nameList(added)}.` : null,
        `We could not add ${nameList(failed.map((entry) => entry.product))}.`,
        serverSentence,
      ]
        .filter(Boolean)
        .join(' '),
    });
  };

  return (
    <Box className={className} sx={{ minWidth: 0, ...sx }} {...rest}>
      {/* THE BIGGEST INK ACTION ON THE PAGE: 52px, full panel width (§2.20). */}
      <Button
        className="lf-press"
        type="button"
        variant="contained"
        color="primary"
        fullWidth
        onClick={handleClick}
        aria-busy={busy || undefined}
        sx={{
          minHeight: 52,
          whiteSpace: 'nowrap',
          ...(busy ? { pointerEvents: 'none' } : null),
        }}
        startIcon={
          busy ? <CircularProgress size={16} thickness={3.6} sx={{ color: 'inherit' }} /> : null
        }
      >
        {`${label} · ${total}`}
      </Button>

      {/* §6.8, verbatim where the data allows it: no discount, no urgency, no
          threshold copy. Completeness and one arrival — both true. */}
      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 'var(--lf-2)', color: 'var(--lf-ink-3)' }}
      >
        {`${countWord(targets.length)} formulations, one delivery.`}
      </Typography>

      {/* One adjacent outcome slot. A button never turns red (§6.5); the
          sentence does the work, and it names every product by name. */}
      <Box aria-live="polite" sx={{ minWidth: 0 }}>
        {outcome ? (
          <Typography
            variant="caption"
            role={outcome.tone === 'error' ? 'alert' : undefined}
            sx={{
              display: 'block',
              mt: 'var(--lf-2)',
              color: outcome.tone === 'error' ? 'var(--lf-err-ink)' : 'var(--lf-ok-ink)',
            }}
          >
            {outcome.text}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
