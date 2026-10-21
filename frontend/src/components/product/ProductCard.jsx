/**
 * ============================================================================
 * <ProductCard> — ART_DIRECTION.md §6.2. BORDERLESS. ONE CARD. EVERYWHERE.
 *
 * Home's shelf, the PLP, the wishlist, the PDP's rest-of-the-shelf rail and
 * the search results all render THIS component at THIS grid (§4). One card
 * language, one grid token, site-wide (§10.23).
 *
 * THE CARD'S FRAME IS DELETED (§2.6). The previous build diagnosed the card
 * honestly — "one notch from a generic SaaS card" — and then prescribed MORE
 * chrome: a 1px border, a `--lf-e1` hairline ring and a `--lf-e-edge` inset
 * highlight. Decoration cannot fix a structural miscast. **THE NICHE IS THE
 * FRAME.** No `Card`, no border, no `CardContent` padding, no shadow — which
 * is also what returns the full card width to the CTA, half the fix for the
 * two-line button wrap.
 *
 * `display: grid` with `grid-template-rows: auto auto auto auto 1fr auto`, so
 * **the CTA bottom-aligns across every card in a row whether or not a name
 * wrapped**. That replaces the `minHeight: 45` hack on the title. The flexible
 * row is the meta block and its content is bottom-aligned, so the price,
 * the size line and the button all line up across a row while the slack
 * collects under the name — "prices and buttons align across a row without a
 * magic number" (§4.3).
 *
 * FIXED ORDER, EVERY ELEMENT AT FULL CARD WIDTH (§6.2):
 *   1. <Alcove surface="card"> + the wishlist heart at its bottom-RIGHT
 *   2. 14px → <StockLabel variant="ledge"> — the full-width status row
 *   3.  6px → category eyebrow, 12px --lf-gold-ink
 *   4.  2px → h4 19px product name, 2-line clamp as a SAFETY NET only
 *   5.  4px → "Be the first to review", a real link to the PDP review form
 *   6.  2px → size line
 *   7. 10px → <PriceBlock>
 *   8. 14px → the CTA, 48px, full card width, NO startIcon
 *
 * THE ARITHMETIC, RE-DERIVED AT THE 288px FLOOR (§4.3's method, §4.3's
 * coefficients: Inter 600 at 19px, ~0.68em per capital, 0.54em per lowercase,
 * 0.26em per space):
 *
 *   "Glow Game WaterLess Face Wash"    6 caps, 19 lower, 4 spaces → **292px**
 *   "The Daily Invisible Moisturizer"  4 caps, 24 lower, 3 spaces → **313px**
 *   "UV Armor Tinted Sunscreen"        5 caps, 17 lower, 3 spaces → **254px**
 *   "Raindrops Shower Gel"             3 caps, 15 lower, 2 spaces → **203px**
 *   "WhiteWave Face Wash"              4 caps, 13 lower, 2 spaces → **195px**
 *   "Spotless Face Wash"               3 caps, 13 lower, 2 spaces → **182px**
 *
 *   §4.3 prints 287px for the moisturizer; by its own coefficients the figure
 *   is 313px (the discrepancy is reported, not papered over). The consequence
 *   is one wrapped line, not a truncation: the longest name needs 313px, so it
 *   sets on ONE line at 362px (1200) and 384px (1440) and wraps to TWO at 288,
 *   304 and 348 — inside the 2-line clamp either way. A THIRD line would need
 *   a card narrower than 157px, which this grid cannot produce at any viewport
 *   from 320 to 1440. **The clamp therefore never truncates a name anywhere
 *   the site renders**, and the grid rows keep the CTAs aligned when it wraps.
 *   Today at 161px the line box is 137px, holding ~15 characters, so the word
 *   being cut is the word that says what the thing IS.
 *
 *   CTA label box at 288px = 288 − 2×20 of MUI padding = 248px. `Add to bag`
 *   ~75px, `Notify me` ~68px, both `nowrap` with the `startIcon` deleted
 *   (§2.15) — 2.3× the room, against ~59px of label box today.
 *
 * NO MEANING IS CARRIED BY COLOUR ALONE (A8), NOTHING HIDES BEHIND :hover
 * (§10.14), AND THERE ARE NO NESTED INTERACTIVE ELEMENTS (A12): the name's
 * anchor carries `::after { inset: 0 }`, so the whole card is clickable
 * without wrapping the buttons in it. The niche paints above that overlay with
 * `pointer-events: none`, so a press on the photograph still navigates while
 * the wishlist heart inside it stays pressable.
 *
 * NEVER A STAR ROW AND NEVER A COUNT (§6.2 item 5, §10.9). All six products
 * have zero `Review` rows; production once shipped hand-typed 4.50/40-reviews
 * with no review rows, and inventing social proof is the worst thing available
 * here.
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

import Alcove from '../common/Alcove';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { stockState } from '../../utils/stock';
import AddToBag from './AddToBag';
import NotifyMe from './NotifyMe';
import PriceBlock, { hasPrice } from './PriceBlock';
import StockLabel from './StockLabel';
import { productPath, reviewView } from './productPresentation';

/**
 * @param {object} props
 * @param {object} props.product  The API payload. No product name, price, size
 *   or stock state is ever typed into this component (§10.21).
 * @param {object} [props.sx]     For the surfaces that set their own track
 *   width — the PDP's 300px scroll-snap rail (§5.3).
 * @param {string} [props.className]
 * @returns {JSX.Element|null}
 */
const ProductCard = ({ product, sx, className, ...rest }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isInWishlist, toggleWishlist, pendingProductIds } = useWishlist();

  const [message, setMessage] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  if (!product) return null;

  const stock = stockState(product);
  const reviews = reviewView(product);
  const path = productPath(product);
  const priced = hasPrice(product);

  /* No silent `|| 'Skincare'`: an uncategorised product gets no eyebrow, not
     a label that is simply untrue. */
  const categoryName =
    typeof product.category?.name === 'string' && product.category.name.trim()
      ? product.category.name.trim()
      : null;

  const saved = isInWishlist(product);
  const wishlistPending = (pendingProductIds || []).includes(product.id);

  /* A plain function, deliberately NOT a `useCallback`: this component returns
     early when `product` is missing, and a hook declared after that return
     would change the hook count between renders. */
  const handleToggleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (wishlistPending) return;

    if (!isAuthenticated) {
      /* LF-13: carry the page they were on, so sign-in returns them here. */
      navigate('/login', { state: { from: location } });
      return;
    }
    setMessage(null);
    const result = await toggleWishlist(product);
    if (!aliveRef.current) return;
    if (result !== true) {
      setMessage(typeof result === 'string' ? result : 'We could not update your saved items.');
    }
  };

  return (
    <Box
      component="article"
      /* <Alcove> and index.css §6 read this: it is how the hearth light goes
         out on an unbuyable product without a single component knowing about
         gradients, and it is why the niche never needs a `stock` prop here. */
      data-stock={stock.state}
      className={className ? `lf-press ${className}` : 'lf-press'}
      data-press="card"
      sx={{
        position: 'relative',
        minWidth: 0,
        height: '100%',
        display: 'grid',
        /* §6.2 — six rows; row 5 is the flexible one, so the CTA in row 6
           bottom-aligns across the whole grid row. */
        gridTemplateRows: 'auto auto auto auto 1fr auto',
        /* THE NICHE IS THE FRAME: no surface, no border, no radius, no
           shadow. The card sits directly on the page. */
        backgroundColor: 'transparent',
        ...sx,
      }}
      {...rest}
    >
      {/* ---- 1. THE NICHE ------------------------------------------------
          It paints ABOVE the name anchor's full-card ::after so the wishlist
          heart inside it is pressable, and it is `pointer-events: none` so a
          press on the photograph still falls through to that overlay and
          navigates. The heart opts back in. */}
      <Alcove
        product={product}
        surface="card"
        style={{ gridRow: 1, zIndex: 2, pointerEvents: 'none' }}
      >
        <IconButton
          className="lf-press"
          size="small"
          onClick={handleToggleWishlist}
          aria-pressed={saved}
          aria-busy={wishlistPending || undefined}
          aria-label={
            saved ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`
          }
          sx={{
            /* `&&` doubles the specificity so this beats index.css §6's
               `.lf-alcove > * { position: relative; z-index: 2 }`, whose
               source order against an emotion class is not guaranteed. */
            '&&': { position: 'absolute', zIndex: 3 },
            right: 12,
            bottom: 12,
            pointerEvents: 'auto',
            width: 36,
            height: 36,
            borderRadius: 'var(--lf-r-pill)',
            backgroundColor: 'var(--lf-paper)',
            boxShadow: 'var(--lf-e1)',
            /* PERMANENTLY VISIBLE — never `opacity: 0`, never behind a hover
               (§9.5, §10.14). 0.82 → 1 is a weighting, not a reveal. */
            opacity: 0.82,
            color: saved ? 'var(--lf-err-ink)' : 'var(--lf-ink-2)',
            transition: 'opacity var(--lf-dur-2) var(--lf-ease), color var(--lf-dur-2) var(--lf-ease)',
            '@media (hover:hover)': {
              '&:hover': { opacity: 1, backgroundColor: 'var(--lf-paper)' },
            },
            '&:focus-visible': { opacity: 1 },
            /* A6 — a 44px hit area around a 36px visual circle. */
            '&::before': { content: '""', position: 'absolute', inset: -4 },
          }}
        >
          {saved ? (
            <FavoriteIcon fontSize="small" />
          ) : (
            <FavoriteBorderIcon fontSize="small" />
          )}
        </IconButton>
      </Alcove>

      {/* ---- 2. THE STATUS LEDGE — full width, beneath the niche --------- */}
      <StockLabel stock={stock} variant="ledge" sx={{ gridRow: 2, mt: '14px' }} />

      {/* ---- 3. CATEGORY EYEBROW ---------------------------------------- */}
      {categoryName ? (
        <Typography variant="eyebrow" sx={{ gridRow: 3, mt: '6px' }}>
          {categoryName}
        </Typography>
      ) : null}

      {/* ---- 4. THE PRODUCT NAME — h4, 19px, Inter 600 ------------------- */}
      <Typography
        variant="h4"
        component="h3"
        sx={{ gridRow: 4, mt: categoryName ? '2px' : '6px', color: 'var(--lf-ink)' }}
      >
        <Box
          component={RouterLink}
          to={path}
          className="lf-clamp-2"
          sx={{
            color: 'inherit',
            textDecoration: 'none',
            /* THE whole-card hit area, with no nested interactive elements. */
            '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 1 },
            /* §2.31 / A9: where the photograph's hover lift is removed, the
               affordance SURVIVES as an underline. The meaning survives; the
               movement does not. */
            '@media (prefers-reduced-motion: reduce)': {
              '&:hover, &:focus-visible': { textDecoration: 'underline' },
            },
          }}
        >
          {product.name}
        </Box>
      </Typography>

      {/* ---- 5. THE META BLOCK — review, size, price --------------------
          Bottom-aligned inside the flexible row, so a wrapped name pushes the
          slack upward and the prices stay on one line across the grid row. */}
      <Box sx={{ gridRow: 5, alignSelf: 'end', minWidth: 0 }}>
        {/* A REAL link to the PDP's review form. Never a star row, never a
            count, never a 0.0 — all six products have zero Review rows. */}
        <Typography
          component={RouterLink}
          to={`${path}#reviews`}
          variant="caption"
          onClick={(event) => event.stopPropagation()}
          sx={{
            position: 'relative',
            zIndex: 2,
            display: 'block',
            mt: '4px',
            color: 'var(--lf-ink-3)',
            textDecoration: 'none',
            '@media (hover:hover)': {
              '&:hover': { color: 'var(--lf-gold-ink)', textDecoration: 'underline' },
            },
          }}
        >
          {reviews.hasReviews ? 'Read reviews' : 'Be the first to review'}
        </Typography>

        {product.size ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: '2px', color: 'var(--lf-ink-3)' }}
          >
            {product.size}
          </Typography>
        ) : null}

        {/* Full --lf-ink weight in stock or out (§2.21): zero products carry a
            discount_price, so there is no discount to suppress, and dimming a
            true price on an item you can still reserve is a sales decision
            wearing an accessibility costume. */}
        <PriceBlock
          product={product}
          size="md"
          sellable={stock.sellable}
          sx={{ mt: '10px' }}
        />
      </Box>

      {/* ---- 6. THE CTA — 48px, full card width, no startIcon ----------- */}
      <Box sx={{ gridRow: 6, position: 'relative', zIndex: 2, mt: '14px', minWidth: 0 }}>
        {!priced ? (
          /* §6.3: a product with no usable price never shows a buy button —
             it degrades to a secondary `View details`, which is true. */
          <Button
            className="lf-press"
            component={RouterLink}
            to={path}
            variant="outlined"
            fullWidth
            sx={{ minHeight: 48, whiteSpace: 'nowrap' }}
          >
            View details
          </Button>
        ) : stock.notifiable ? (
          /* GOLD FILL, never absent, never `disabled` (§6.6, §10.12). The
             BACK SOON ledge in row 2 has already landed by the time the eye
             reaches it. */
          <NotifyMe product={product} size="card" reason={stock.reason} />
        ) : (
          <AddToBag product={product} size="card" onError={setMessage} />
        )}

        {/* One adjacent message slot: the add-to-bag outcome or a wishlist
            failure, stated in words. A button never turns red (§6.5). Zero
            height until there is something to say. */}
        <Box aria-live="polite" sx={{ minWidth: 0 }}>
          {message ? (
            <Typography
              variant="caption"
              role="alert"
              sx={{ display: 'block', mt: 'var(--lf-1)', color: 'var(--lf-err-ink)' }}
            >
              {message}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};

export default ProductCard;
