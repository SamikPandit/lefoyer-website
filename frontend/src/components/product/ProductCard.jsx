/**
 * ProductCard — the tile that carries every listing, rail and search result.
 *
 * WHAT WAS WRONG WITH THE OLD CARD (all verified in the file this replaces)
 *  1. **Quick Add and the wishlist heart were hover-only** (`opacity: isHovered ? 1 : 0`,
 *     `translateY(100%)`). On a phone — which is most of this store's traffic — neither
 *     existed. DESIGN_SYSTEM §9 #5: "Do not hide anything behind `:hover`." Both are now
 *     permanently visible at every breakpoint; hover is reduced to a *decorative*
 *     second-image crossfade on pointer devices, and that second image is not even
 *     requested on a touch device (§7).
 *  2. **The heart's `onClick` was an empty placeholder** with the comment "Wishlist logic
 *     here - missing in original component". It is now wired to `useWishlist()`, which is
 *     optimistic, and a guest is sent to sign-in **carrying the page they came from** so
 *     LF-13's return journey works.
 *  3. **Every control was nested inside the `<Link>`** that wrapped the whole card, so a
 *     tap could be swallowed by navigation, and the markup was invalid
 *     (interactive-in-interactive). The actions now sit OUTSIDE the anchor; the title's
 *     anchor carries `::after { inset: 0 }`, which makes the whole card clickable with no
 *     nesting at all (§7).
 *  4. **The out-of-stock overlay sat at `zIndex: 3` above the heart**, with a code comment
 *     admitting "overlay covers it". The scrim is now `pointer-events: none` at z-index 1
 *     and the heart is at 3, so it stays usable on an unbuyable product — which is
 *     exactly when saving for later matters most.
 *  5. **A hidden Quick Add was the entire out-of-stock experience.** §2d: "Unsellable
 *     means an action, not a dead end" — the CTA is replaced by "Notify me when it's
 *     back" (`NotifyMeButton`), never a dead grey button (§6.8 #3).
 *  6. **`rating = 0` rendered an empty five-star row with `(0)`** on a catalogue where
 *     every row is `0.00` and the `Review` table is empty. §2e: stars come from
 *     `review_summary` only, and at `count === 0` the widget is not rendered at all —
 *     "Be the first to review" takes its place.
 *  7. **Availability was `in_stock === undefined ? … : stock_quantity > 0`.**
 *     `stock_quantity` is not served any more, so that fallback read `undefined`.
 *     §2d: `in_stock` and `available_quantity`, via `stockState()`.
 *  8. `category?.name || 'Skincare'` silently labelled every uncategorised product
 *     "Skincare"; `₹{price}` printed the list price while the backend charges
 *     `discount_price`; and the title hard-coded a display serif, a font this app
 *     no longer loads.
 *
 * The one prop is `product`. `Search.jsx`, `FeaturedProducts.jsx`, `Wishlist.jsx`,
 * `RelatedProducts.jsx` and `ProductListing.jsx` all call it that way.
 */

import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { NotifyMeButton } from '../common/NotifyMeDialog';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../common/EmptyState';
import {
  priceView,
  productAlt,
  productPath,
  reviewView,
  stockState,
} from './productPresentation';

/** §6.8: a success flash that is shorter than this reads as a glitch. */
const ADDED_FLASH_MS = 900;
/** §6.8: "400 ms minimum display" for the loading state, so it cannot flicker. */
const MIN_SPINNER_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Shared placement for the one status badge on the mat. */
const BADGE_SX = {
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 2,
  pointerEvents: 'none',
};

/**
 * The stock row. Rendered ALWAYS, including when in stock (DESIGN_SYSTEM §7), with its
 * own words plus a dot — never colour alone.
 */
const StockPill = ({ stock }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 20 }}>
    <Box
      aria-hidden="true"
      sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: stock.dotColor, flexShrink: 0 }}
    />
    <Typography variant="caption" sx={{ color: stock.textColor }}>
      {stock.label}
    </Typography>
  </Box>
);

const ProductCard = ({ product }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addToCart, pendingItemIds } = useCart();
  const { isInWishlist, toggleWishlist, pendingProductIds } = useWishlist();

  // Hover is a pointer-device *enhancement* only: it crossfades to a second shot.
  // Nothing is revealed by it, and on a touch device the second image is never fetched.
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [hovered, setHovered] = useState(false);

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [actionError, setActionError] = useState(null);
  const aliveRef = useRef(true);
  const flashTimer = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  if (!product) return null;

  const stock = stockState(product);
  const price = priceView(product, { sellable: stock.sellable });
  const reviews = reviewView(product);
  const path = productPath(product);
  const categoryName =
    typeof product.category?.name === 'string' && product.category.name.trim()
      ? product.category.name.trim()
      : null;

  const saved = isInWishlist(product);
  const wishlistPending = (pendingProductIds || []).includes(product.id);
  const cartPending = adding || (pendingItemIds || []).includes(product.id);

  const handleAddToCart = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (cartPending || !stock.sellable || !price.hasPrice) return;

    setActionError(null);
    setAdding(true);
    const startedAt = Date.now();
    const result = await addToCart(product, 1);
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPINNER_MS) await sleep(MIN_SPINNER_MS - elapsed);
    if (!aliveRef.current) return;

    setAdding(false);
    if (result === true) {
      setAdded(true);
      flashTimer.current = setTimeout(() => {
        if (aliveRef.current) setAdded(false);
      }, ADDED_FLASH_MS);
    } else {
      // CartContext returns the backend's own sentence ("Only 3 units available"),
      // which is far more useful than "Failed to add to cart".
      setActionError(typeof result === 'string' ? result : 'We could not add that to your bag.');
    }
  };

  // A plain function, deliberately NOT a `useCallback`: this component returns early
  // when `product` is missing, and a hook declared after that return would change the
  // hook count between renders.
  const handleToggleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      // LF-13: carry the page they were on, so sign-in returns them here.
      navigate('/login', { state: { from: location } });
      return;
    }
    setActionError(null);
    const result = await toggleWishlist(product);
    if (!aliveRef.current) return;
    if (result !== true) {
      setActionError(typeof result === 'string' ? result : 'We could not update your saved items.');
    }
  };

  const addLabel = added ? 'Added' : 'Add to bag';

  return (
    <Card
      component="article"
      className="lf-press"
      data-press="card"
      onMouseEnter={canHover ? () => setHovered(true) : undefined}
      onMouseLeave={canHover ? () => setHovered(false) : undefined}
      sx={{
        position: 'relative',
        height: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--lf-surface)',
        border: '1px solid var(--lf-hairline)',
        borderRadius: 'var(--lf-r-card)',
        transition: 'border-color var(--lf-dur-2) var(--lf-ease), box-shadow var(--lf-dur-3) var(--lf-ease)',
        '@media (hover: hover)': {
          '&:hover': { borderColor: 'var(--lf-border)', boxShadow: 'var(--lf-e2)' },
        },
        // The title anchor's ::after covers the card; keep the ring on the card itself.
        '&:focus-within': { borderColor: 'var(--lf-border-ink)' },
      }}
    >
      {/* ---------------- media: 1:1 mat, `cover` (DESIGN_SYSTEM §6.3) ---------------- */}
      <Box sx={{ position: 'relative', p: 1.5, pb: 0 }}>
        <Box
          className="lf-media lf-ar-1x1"
          sx={{ borderRadius: 'var(--lf-r-field)', position: 'relative' }}
        >
          {product.image_main ? (
            <img
              src={product.image_main}
              alt={productAlt(product)}
              data-product={product.slug || product.sku || ''}
              width="600"
              height="600"
              loading="lazy"
              decoding="async"
              style={{
                transition: 'opacity var(--lf-dur-3) var(--lf-ease)',
                opacity: canHover && hovered && product.image_2 ? 0 : 1,
                filter: stock.sellable ? 'none' : 'grayscale(0.35)',
              }}
            />
          ) : (
            <Box
              aria-hidden="true"
              sx={{ position: 'absolute', inset: 0, backgroundColor: 'var(--lf-surface-sunken)' }}
            />
          )}

          {/* Second shot: a pointer-device crossfade, never a reveal, never fetched on touch. */}
          {canHover && product.image_2 ? (
            <img
              src={product.image_2}
              alt=""
              aria-hidden="true"
              width="600"
              height="600"
              loading="lazy"
              decoding="async"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'opacity var(--lf-dur-3) var(--lf-ease)',
                opacity: hovered ? 1 : 0,
              }}
            />
          ) : null}

          {/* The scrim is decorative and NEVER captures a tap (the old one did). */}
          {!stock.sellable ? (
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                pointerEvents: 'none',
                backgroundColor: 'rgba(253, 251, 249, 0.35)',
              }}
            />
          ) : null}

          {/* Status / merchandising badge. One at most, in priority order. */}
          {stock.state === 'coming_soon' ? (
            <Chip label="Coming soon" size="small" variant="statusGold" sx={BADGE_SX} />
          ) : stock.state === 'out' ? (
            <Chip label="Out of stock" size="small" variant="filter" sx={BADGE_SX} />
          ) : product.is_bestseller ? (
            <Chip label="Bestseller" size="small" variant="bestseller" sx={BADGE_SX} />
          ) : product.is_new ? (
            <Chip label="New" size="small" variant="statusGold" sx={BADGE_SX} />
          ) : null}
        </Box>

        {/* ---- wishlist: OUTSIDE the anchor, above the scrim, permanently visible ---- */}
        <IconButton
          className="lf-press"
          onClick={handleToggleWishlist}
          aria-pressed={saved}
          aria-label={
            saved ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`
          }
          disabled={wishlistPending}
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 3,
            width: 36,
            height: 36,
            opacity: 0.78,
            backgroundColor: 'var(--lf-surface)',
            border: '1px solid var(--lf-hairline)',
            color: saved ? 'var(--lf-err-ink)' : 'var(--lf-ink-2)',
            transition: 'opacity var(--lf-dur-2) var(--lf-ease), color var(--lf-dur-2) var(--lf-ease)',
            '&:hover': { opacity: 1, backgroundColor: 'var(--lf-surface)' },
            '&:focus-visible': { opacity: 1 },
            // 44px hit area without a 44px visual circle.
            '&::before': { content: '""', position: 'absolute', inset: -4 },
            ...FOCUS_RING_SX,
          }}
        >
          {saved ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* ---------------- content, in the §7 order ---------------- */}
      <CardContent sx={{ px: 1.5, pt: 1.5, pb: 0, flexGrow: 1, '&:last-child': { pb: 0 } }}>
        {categoryName ? (
          <Typography variant="overline" sx={{ display: 'block', color: 'var(--lf-ink-3)', fontSize: '0.75rem' }}>
            {categoryName}
          </Typography>
        ) : null}

        <Typography variant="h5" component="h3" sx={{ mt: categoryName ? 0.5 : 0, minHeight: 45 }}>
          <Box
            component={RouterLink}
            to={path}
            className="lf-clamp-2"
            sx={{
              color: 'var(--lf-ink)',
              textDecoration: 'none',
              // THE whole-card hit area, with no nested interactive elements (§7).
              '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 0 },
              '@media (hover: hover)': { '&:hover': { textDecoration: 'underline' } },
            }}
          >
            {product.name}
          </Box>
        </Typography>

        {/* proof row — §2e: nothing at all when there are no reviews */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 22, mt: 0.5 }}>
          {reviews.hasReviews ? (
            <>
              <Rating
                value={reviews.average}
                precision={0.1}
                readOnly
                size="small"
                sx={{ fontSize: '0.95rem' }}
              />
              <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                {reviews.averageLabel} ({reviews.count})
              </Typography>
            </>
          ) : (
            <Typography
              component={RouterLink}
              to={`${path}#reviews`}
              variant="caption"
              sx={{
                position: 'relative',
                zIndex: 2,
                color: 'var(--lf-ink-3)',
                textDecoration: 'none',
                '@media (hover: hover)': { '&:hover': { color: 'var(--lf-gold-ink)', textDecoration: 'underline' } },
                ...FOCUS_RING_SX,
              }}
            >
              Be the first to review
            </Typography>
          )}
        </Box>

        {product.size ? (
          <Typography variant="caption" sx={{ display: 'block', color: 'var(--lf-ink-3)', mt: 0.5 }}>
            {product.size}
          </Typography>
        ) : null}

        {/* price — never ₹undefined / ₹NaN / ₹0 (§9 #13) */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          {price.hasPrice ? (
            <>
              <Typography
                variant="price"
                component="p"
                sx={{ color: stock.sellable ? 'var(--lf-ink)' : 'var(--lf-ink-3)' }}
              >
                {price.priceLabel}
              </Typography>
              {price.compareLabel ? (
                <Typography variant="priceCompare" component="span">
                  {price.compareLabel}
                </Typography>
              ) : null}
              {price.showSavings ? (
                <Typography variant="badge" component="span" sx={{ color: 'var(--lf-ok-ink)' }}>
                  Save {price.savingsPercent}%
                </Typography>
              ) : null}
            </>
          ) : (
            <Typography variant="price" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
              Price on request
            </Typography>
          )}
        </Box>

        <Box sx={{ mt: 0.75 }}>
          <StockPill stock={stock} />
        </Box>
      </CardContent>

      {/* ---------------- actions: outside the anchor, above its ::after ---------------- */}
      <Box sx={{ position: 'relative', zIndex: 2, p: 1.5, pt: 1.5 }}>
        {!price.hasPrice ? (
          // §9 #13: an unpriced product gets a secondary "View details", not a buy button.
          <Button
            className="lf-press"
            component={RouterLink}
            to={path}
            variant="outlined"
            fullWidth
            sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
          >
            View details
          </Button>
        ) : stock.notifiable ? (
          <NotifyMeButton
            slug={product.slug}
            productName={product.name}
            fullWidth
            label="Notify me"
            sx={{ ...TOUCH_TARGET_SX }}
          />
        ) : (
          <Button
            className="lf-press"
            variant="contained"
            color="primary"
            disableElevation
            fullWidth
            onClick={handleAddToCart}
            aria-busy={cartPending}
            startIcon={
              cartPending ? (
                <CircularProgress size={16} thickness={3.6} sx={{ color: 'inherit' }} />
              ) : added ? (
                <CheckIcon />
              ) : (
                <ShoppingBagOutlinedIcon />
              )
            }
            sx={{
              ...TOUCH_TARGET_SX,
              ...FOCUS_RING_SX,
              // §6.8: while loading, the label dims rather than disappearing, so the
              // button keeps its measured width and cannot reflow the grid row.
              ...(cartPending ? { '& .MuiButton-startIcon': { opacity: 1 }, opacity: 0.85 } : null),
            }}
          >
            {addLabel}
          </Button>
        )}

        {/* §6.8 #2: the reason / the outcome is ALWAYS stated adjacent, never left to colour. */}
        <Box sx={{ minHeight: 18, mt: actionError ? 0.75 : 0 }} aria-live="polite">
          {actionError ? (
            <Typography variant="caption" role="alert" sx={{ color: 'var(--lf-err-ink)' }}>
              {actionError}
            </Typography>
          ) : stock.state === 'out' ? (
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              Out of stock — we&apos;ll email you when it&apos;s back
            </Typography>
          ) : stock.state === 'coming_soon' ? (
            <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
              Not on sale yet — we&apos;ll email you at launch
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Card>
  );
};

export default ProductCard;
