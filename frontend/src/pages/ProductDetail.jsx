/**
 * ============================================================================
 * ProductDetail — the PDP, rebuilt as ART_DIRECTION.md §5.3 with §6.7's buy box.
 *
 * WHAT THIS PAGE LOOKED LIKE BEFORE (pdp-desk.png, measured)
 *
 *  · TWO HARD 50% COLUMNS. §8 line 1523 specified gallery 1–7 / buy box 8–12
 *    and it was never built. Inside the 50% gallery a 72px thumbnail rail plus
 *    a 16px gap squeezed the main image to ~468px, so **the photograph of the
 *    thing being sold occupied 32% of the content width** — and then sat
 *    `object-fit: contain` on a warm mat, which §10.3 bans outright because the
 *    masters are RGB with no alpha over six disagreeing grounds (cyan #9DE1E7,
 *    deep blue #134F85, pink #F6A5C8). It is now **7/5**: at 1440, content
 *    1216 = gallery **686** + gap **40** + buy box **490**.
 *  · A TALL VOID. The left column ended at ~440px while the right ran to ~900.
 *    The gallery column now carries the niche, the thumbnail rail beneath it,
 *    **The ritual** (§2.32) and the per-SKU suitability, so it reaches the buy
 *    box's depth with real content rather than with padding.
 *  · THE THUMBNAIL RAIL WAS CLIPPED MID-IMAGE by `maxHeight: 520; overflowY:
 *    auto` on a vertical column. It moves **beneath the main image**,
 *    horizontal, 72px squares, scroll-snapped, selected = 2px `--lf-gold-edge`
 *    (3.16:1, clears SC 1.4.11). It also loaded the FULL-RESOLUTION source into
 *    a 72px button — `<img src={image} width="144">` on a 2048² master — so a
 *    ten-image PDP downloaded ~50 MB, most of it to paint ten 72px squares.
 *    <ProductImage surface="thumb"> now serves the 160px derivative (P3: the
 *    whole gallery at 1280w measures 445 KB AVIF against a 900 KB budget).
 *  · "YOU MIGHT ALSO LIKE" was tiny, left-aligned, with dead space to the
 *    right: `RelatedProducts limit={4}` through an auto-fill template that
 *    opened six tracks for four items, on a catalogue of six. Deleted (§1.3).
 *    Replaced by **the rest of the shelf** — all five remaining products on
 *    `--lf-mat` with a ledge, scroll-snapped at 300px, filling the row at every
 *    width — then <ShelfBundle>, the one basket-raising mechanic (§2.19).
 *  · THE REVIEWS BLOCK was a screen of vertical emptiness at zero reviews.
 *    <ProductReviews> now renders the compact §6 empty state. **No stars, ever,
 *    anywhere on this page**: all six products have zero `Review` rows (§10.9).
 *
 * WHAT DID NOT CHANGE, BECAUSE IT WAS ALREADY RIGHT
 *   The buy box's tiering intent, the two labelled delivery/returns blocks from
 *   `policy.js` (LF-12 — no number is typed in this file), the real
 *   `<PincodeCheck>` driving the COD row (LF-11), the honest "Be the first to
 *   review", the four terminal states (LF-26), `ViewContent` once per slug
 *   (§2g), and the `Product` JSON-LD emitted from the same values the page
 *   renders with `aggregateRating` **omitted entirely** at zero reviews (LF-07,
 *   §5.3, §10.9).
 *
 * THE BUY BOX ORDER IS §5.3's, VERBATIM (§6.7)
 *   eyebrow category → h1 name → `Be the first to review` as a REAL anchor that
 *   scroll-targets the review form (it was a `Typography` with `cursor:pointer`
 *   and no handler) → priceLg → <StockLabel> → size + SKU → **ledge** (the
 *   page's one gold rule) → quantity stepper → 52px primary → 52px secondary →
 *   wishlist TEXT button → delivery and returns as two rows with two wordings →
 *   `Buy on Amazon` as a tertiary text link → `About this item` as a definition
 *   list, not an MUI Table with a `width:200` cell that cannot fit 288px.
 *
 *   In stock: ink `Add to bag · ₹480` (the bag icon is licensed HERE and in the
 *   sticky bar, nowhere else — §2.15) + outlined `Buy now`.
 *   Out of stock: the stepper and `Buy now` are **removed, not disabled**, and
 *   the primary becomes <NotifyMe size="buybox"> — `--lf-gold` fill with an
 *   `--lf-ink` label at 8.15:1, `aria-disabled` only, never absent (§6.6, A4,
 *   §10.12).
 *
 * EVERY PRIMITIVE IS IMPORTED, NEVER FORKED: <Alcove>, <ProductImage>,
 * <ProductCard>, <PriceBlock>, <StockLabel>, <AddToBag>, <NotifyMe>,
 * <ShelfBundle>, `utils/stock.js`, `productGrid.js`. One card language, one
 * price formatter, one availability derivation, site-wide (§10.23).
 * ========================================================================== */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchOffIcon from '@mui/icons-material/SearchOff';

import { getProduct, listProducts } from '../services/api';
import { trackViewContent } from '../services/analytics';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { usePolicy } from '../content/policy';
import SeoHead, { absoluteUrl } from '../components/common/SeoHead';
import EmptyState, { FOCUS_RING_SX } from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import PincodeCheck from '../components/common/PincodeCheck';
import Alcove from '../components/common/Alcove';
import ProductImage from '../components/common/ProductImage';
import ProductReviews from '../components/product/ProductReviews';
import ProductCard from '../components/product/ProductCard';
import ShelfBundle from '../components/product/ShelfBundle';
import AddToBag from '../components/product/AddToBag';
import NotifyMe from '../components/product/NotifyMe';
import PriceBlock, { hasPrice, priceView } from '../components/product/PriceBlock';
import StockLabel from '../components/product/StockLabel';
import { PRODUCT_RAIL_SX, skeletonCount } from '../components/product/productGrid';
import { LOW_STOCK_THRESHOLD, schemaAvailability, stockState } from '../utils/stock';
import {
  benefitRows,
  productAlt,
  productImages,
  reviewView,
  suitabilityLine,
} from '../components/product/productPresentation';

/** The sticky mobile bar's height, published as a CSS var so a toast cannot cover it. */
const MOBILE_BAR_H = 68;

/** How many products the shelf row may hold. Six SKUs today; the rail scrolls. */
const SHELF_PAGE_SIZE = 12;

/** Meta descriptions are truncated by every engine anyway; do it on a word boundary. */
function metaDescription(product) {
  const source = (product?.description || product?.key_benefits || '').replace(/\s+/g, ' ').trim();
  if (!source) return undefined;
  if (source.length <= 155) return source;
  return `${source.slice(0, 152).replace(/\s+\S*$/, '')}…`;
}

/* ==========================================================================
 * THE RITUAL — §2.32 / §5.3. Built VERBATIM from `how_to_use`.
 *
 * A real `TextField` on `Product`, served by the detail serializer and until
 * now buried inside a tab. It becomes new on-site editorial content with ZERO
 * invention and ZERO new assets, on a site whose last trust failure was
 * hand-typed ratings. For UV Armor it renders, word for word:
 *
 *   01  Apply generously and evenly to all exposed skin 15 minutes before
 *       sun exposure.
 *   02  Reapply frequently, especially after swimming, sweating, or towel
 *       drying.
 *
 * Splitting is done by a scan rather than by a lookbehind regex: Safari before
 * 16.4 throws on `(?<=…)`, and a naive `split('.')` cuts "Net Wt. 50 gm",
 * "0.5 ml" and "fl. oz" in half — the same class of bug as the `key_benefits`
 * comma split this project already fixed once. A terminator only ends a step
 * when whitespace follows AND the next word starts like a new sentence.
 * ========================================================================== */

const TERMINATORS = new Set(['.', '!', '?']);

function splitSentences(line) {
  const out = [];
  let start = 0;

  for (let i = 0; i < line.length; i += 1) {
    if (!TERMINATORS.has(line[i])) continue;

    let end = i + 1;
    while (end < line.length && TERMINATORS.has(line[end])) end += 1;

    const next = line[end];
    if (next !== undefined && !/\s/.test(next)) {
      /* "0.5 ml" — a digit follows the stop, so it is a decimal point. */
      i = end - 1;
      continue;
    }

    let peek = end;
    while (peek < line.length && /\s/.test(line[peek])) peek += 1;
    const following = line[peek];
    if (following !== undefined && !/[A-Z0-9(“"']/.test(following)) {
      /* "fl. oz" — the next word is lowercase, so the stop is an abbreviation. */
      i = end - 1;
      continue;
    }

    const sentence = line.slice(start, end).trim();
    if (sentence) out.push(sentence);
    start = end;
    i = end - 1;
  }

  const tail = line.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * `how_to_use` as numbered steps. Authored line breaks are respected first,
 * then each line is split on sentence boundaries. Any numbering the author
 * already typed is stripped, because the component supplies `01`, `02` — two
 * sets of numbers on one list is how a step list starts lying about its order.
 * @param {string} text
 * @returns {string[]}
 */
function ritualSteps(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) =>
      splitSentences(
        line
          .replace(/^\s*(?:step\s*)?\d+\s*[.)\]:-]\s*/i, '')
          .replace(/^[\s\-–—*•·]+/, '')
          .trim(),
      ),
    )
    .filter(Boolean);
}

/* ==========================================================================
 * Small, page-local pieces. Declared at module scope so React keeps their
 * identity across renders (a component defined inside a render remounts its
 * whole subtree on every keystroke in the buy box).
 * ========================================================================== */

/** One labelled block of policy prose. `policy.js` owns every number (LF-12). */
const PolicyRow = ({ label, children }) => (
  <Box sx={{ py: 'var(--lf-3)' }}>
    <Typography variant="eyebrow" component="h3" sx={{ display: 'block', color: 'var(--lf-ink-3)' }}>
      {label}
    </Typography>
    <Box sx={{ mt: 'var(--lf-2)' }}>{children}</Box>
  </Box>
);

/**
 * `About this item` as a DEFINITION LIST (§5.3) — not an MUI `Table` with a
 * fixed `width: 200` cell that cannot fit a 288px column. It collapses to one
 * column below `sm`, where a 140px label track would leave 148px for a value.
 */
const DetailList = ({ rows }) => (
  <Box
    component="dl"
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 140px) 1fr' },
      rowGap: 'var(--lf-2)',
      columnGap: 'var(--lf-4)',
      m: 0,
      minWidth: 0,
    }}
  >
    {rows.map(([label, value]) => (
      <Box key={label} sx={{ display: 'contents' }}>
        <Typography component="dt" variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
          {label}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, color: 'var(--lf-ink-2)' }}>
          {value}
        </Typography>
      </Box>
    ))}
  </Box>
);

/**
 * The below-the-fold accordion (§5.3: tabs at ≥900, stacked accordion below —
 * four labels do not fit 288px and off-screen tabs are undiscoverable).
 *
 * A14 / §10.16: it animates `grid-template-rows: 0fr → 1fr`, never a measured
 * pixel height. MUI's `<Accordion>` wraps `<Collapse>`, which animates `height`
 * — a layout property, banned by P7 — so the disclosure is hand-built. Closed
 * panels carry `inert`, so their content leaves the tab order without the
 * `aria-hidden`-over-focusable-content violation that hiding it would create.
 */
const InfoAccordion = ({ panels, idBase }) => {
  const [openIndexes, setOpenIndexes] = useState(() => [0]);

  const toggle = (index) =>
    setOpenIndexes((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
    );

  return (
    <Box sx={{ minWidth: 0 }}>
      {panels.map((panel, index) => {
        const isOpen = openIndexes.includes(index);
        return (
          <Box
            key={panel.label}
            sx={{ borderTop: index === 0 ? 0 : '1px solid var(--lf-hairline)' }}
          >
            <Box
              component="button"
              type="button"
              id={`${idBase}-summary-${index}`}
              aria-expanded={isOpen}
              aria-controls={`${idBase}-panel-${index}`}
              onClick={() => toggle(index)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--lf-3)',
                width: '100%',
                minHeight: 56,
                px: 0,
                py: 'var(--lf-3)',
                border: 0,
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--lf-ink)',
                ...FOCUS_RING_SX,
              }}
            >
              <Typography variant="h5" component="span">
                {panel.label}
              </Typography>
              <ExpandMoreIcon
                aria-hidden="true"
                sx={{
                  flex: 'none',
                  color: 'var(--lf-ink-3)',
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform var(--lf-dur-2) var(--lf-ease)',
                }}
              />
            </Box>

            <Box
              id={`${idBase}-panel-${index}`}
              role="region"
              aria-labelledby={`${idBase}-summary-${index}`}
              {...(isOpen ? null : { inert: '' })}
              sx={{
                display: 'grid',
                gridTemplateRows: isOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows var(--lf-dur-3) var(--lf-ease)',
              }}
            >
              <Box sx={{ overflow: 'hidden', minHeight: 0 }}>
                <Box sx={{ pb: 'var(--lf-5)' }}>{panel.content}</Box>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

/* ==========================================================================
 * THE PAGE
 * ========================================================================== */

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const baseId = useId();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const { copy: policyCopy } = usePolicy();
  const { isAuthenticated } = useAuth();
  const { cart } = useCart();
  const { isInWishlist, toggleWishlist, pendingProductIds } = useWishlist();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [codAvailable, setCodAvailable] = useState(null);
  const [cartMessage, setCartMessage] = useState(null);
  const [barVisible, setBarVisible] = useState(false);

  /* The rest of the shelf — its own request, its own three states (LF-26). */
  const [shelf, setShelf] = useState([]);
  const [shelfStatus, setShelfStatus] = useState('loading');
  const [shelfError, setShelfError] = useState(null);
  const [shelfVisible, setShelfVisible] = useState([]);

  const aliveRef = useRef(true);
  const controllerRef = useRef(null);
  const shelfControllerRef = useRef(null);
  const trackedSlugRef = useRef(null);
  const inlineCtaRef = useRef(null);
  const shelfRailRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (controllerRef.current) controllerRef.current.abort();
      if (shelfControllerRef.current) shelfControllerRef.current.abort();
    };
  }, []);

  /* ------------------------------------------------------------------ *
   * load — the product
   * ------------------------------------------------------------------ */

  const load = useCallback(async () => {
    if (!slug) return;
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('loading');
    setError(null);
    try {
      const data = await getProduct(slug, { signal: controller.signal });
      if (!aliveRef.current || controller.signal.aborted) return;
      setProduct(data);
      setSummary(data?.review_summary ?? null);
      setQuantity(1);
      setGalleryIndex(0);
      setActiveTab(0);
      setCartMessage(null);
      setStatus('ready');
    } catch (requestError) {
      if (requestError?.isCanceled || controller.signal.aborted || !aliveRef.current) return;
      // §2d: an invisible or deleted product is a 404, not a hidden page — so it gets
      // its own terminal state with a way onward, not an "it broke, retry" panel.
      if (requestError?.isNotFound) {
        setProduct(null);
        setStatus('notfound');
        return;
      }
      setError(requestError);
      setStatus('error');
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------------------ *
   * load — THE REST OF THE SHELF (§5.3)
   *
   * `getRelatedProducts(slug, {limit: 4})` is deliberately NOT used: on a
   * six-SKU catalogue it returns four of the other five, which is almost the
   * whole shop presented as a recommendation (§1.3). The honest version is the
   * whole shop minus this product, which also guarantees the row is full at
   * every width — §2.29's "a shelf is complete at whatever its row count is".
   * In-stock sorts first (§2.23) without disturbing the server's own order.
   * ------------------------------------------------------------------ */

  const loadShelf = useCallback(async () => {
    if (!slug) return;
    if (shelfControllerRef.current) shelfControllerRef.current.abort();
    const controller = new AbortController();
    shelfControllerRef.current = controller;

    setShelfStatus('loading');
    setShelfError(null);
    try {
      const { items } = await listProducts(
        { page_size: SHELF_PAGE_SIZE },
        { signal: controller.signal },
      );
      if (!aliveRef.current || controller.signal.aborted) return;

      const rest = (items || [])
        .filter((candidate) => candidate && candidate.slug !== slug)
        .map((candidate, index) => ({ candidate, index }))
        .sort((a, b) => {
          const aSellable = stockState(a.candidate).sellable ? 0 : 1;
          const bSellable = stockState(b.candidate).sellable ? 0 : 1;
          return aSellable - bSellable || a.index - b.index;
        })
        .map((entry) => entry.candidate);

      setShelf(rest);
      setShelfStatus(rest.length ? 'ready' : 'empty');
    } catch (requestError) {
      if (requestError?.isCanceled || controller.signal.aborted || !aliveRef.current) return;
      setShelfError(requestError);
      setShelfStatus('error');
    }
  }, [slug]);

  useEffect(() => {
    loadShelf();
  }, [loadShelf]);

  useEffect(() => {
    // A fragment owns the scroll position (`ScrollToTop` makes the same exemption), so
    // a card's "Be the first to review" link to `/product/x#reviews` is not overridden.
    if (location.hash) return;
    window.scrollTo(0, 0);
  }, [slug, location.hash]);

  /* A deep link to #reviews cannot work on its own: the anchor does not exist until the
     product has loaded, by which time the browser has given up on the fragment. */
  useEffect(() => {
    if (status !== 'ready' || !location.hash) return;
    const node = document.getElementById(location.hash.slice(1));
    if (node) node.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [status, location.hash]);

  /* §2g: ViewContent, once per slug, after the product has loaded. */
  useEffect(() => {
    if (status !== 'ready' || !product || trackedSlugRef.current === product.slug) return;
    trackedSlugRef.current = product.slug;
    trackViewContent(product);
  }, [product, status]);

  /* ------------------------------------------------------------------ *
   * derived values — ONE derivation, shared with the card (§6.4, §6.3, §2e)
   * ------------------------------------------------------------------ */

  const stock = useMemo(() => stockState(product), [product]);
  const reviews = useMemo(() => reviewView(summary), [summary]);
  const images = useMemo(() => productImages(product), [product]);
  const benefits = useMemo(() => benefitRows(product?.key_benefits), [product]);
  const ritual = useMemo(() => ritualSteps(product?.how_to_use), [product]);
  const suitability = suitabilityLine(product);
  const priced = hasPrice(product);

  const bagProductIds = useMemo(
    () => (cart?.items || []).map((item) => item.id),
    [cart],
  );

  const saved = product ? isInWishlist(product) : false;
  const wishlistPending = product ? (pendingProductIds || []).includes(product.id) : false;

  /* The sticky mobile buy bar appears only once the inline CTA has scrolled away
     (§5.3 / P8: an IntersectionObserver, never a scroll handler). */
  useEffect(() => {
    if (isDesktop || status !== 'ready') {
      setBarVisible(false);
      return undefined;
    }
    const node = inlineCtaRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setBarVisible(!entry.isIntersecting),
      { rootMargin: '0px 0px -20% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isDesktop, status]);

  /* Publish the bar height so nothing else can sit under it. */
  useEffect(() => {
    const root = document.documentElement;
    if (barVisible) root.style.setProperty('--lf-bar-h', `${MOBILE_BAR_H}px`);
    else root.style.setProperty('--lf-bar-h', '0px');
    return () => root.style.setProperty('--lf-bar-h', '0px');
  }, [barVisible]);

  /* THE SHELF ROW'S SCROLL INDICATOR (§5.3: "a visible 2px --lf-gold-edge
     scroll indicator"). §10.17 and P8 forbid a scroll listener outright, so the
     indicator is driven by ONE IntersectionObserver rooted on the rail: one
     segment per product, lit --lf-gold-edge while that card is in view. It also
     states how many products the row holds, which a scrollbar never does. */
  useEffect(() => {
    const rail = shelfRailRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined' || shelf.length === 0) {
      return undefined;
    }
    const slides = Array.from(rail.querySelectorAll('[data-shelf-index]'));
    if (!slides.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        setShelfVisible((current) => {
          const next = new Set(current);
          entries.forEach((entry) => {
            const index = Number(entry.target.getAttribute('data-shelf-index'));
            if (entry.isIntersecting) next.add(index);
            else next.delete(index);
          });
          return Array.from(next);
        });
      },
      { root: rail, threshold: 0.6 },
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [shelf]);

  /* ------------------------------------------------------------------ *
   * actions
   * ------------------------------------------------------------------ */

  const ceiling = stock.maxQty > 0 ? stock.maxQty : null;

  const changeQuantity = (delta) => {
    setQuantity((current) => {
      const next = current + delta;
      if (next < 1) return current;
      /* `maxQty: 0` means the quantity was never served, which is "unknown",
         NOT zero (utils/stock.js). The server enforces the real ceiling in
         `cart/add` and again in `confirm_order`, so no number is invented here. */
      if (ceiling !== null && next > ceiling) return current;
      return next;
    });
  };

  const handleWishlist = async () => {
    if (!product || wishlistPending) return;
    if (!isAuthenticated) {
      /* LF-13: carry the page they were on, so sign-in returns them here. */
      navigate('/login', { state: { from: location } });
      return;
    }
    setCartMessage(null);
    const result = await toggleWishlist(product);
    if (!aliveRef.current) return;
    if (result !== true) {
      setCartMessage({
        tone: 'error',
        text: typeof result === 'string' ? result : 'We could not update your saved items.',
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * terminal states
   * ------------------------------------------------------------------ */

  if (status === 'loading') {
    return (
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect-sm)' }}>
        <SeoHead title="Loading product" noindex />
        <Container maxWidth="lg">
          <Box
            aria-busy="true"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' },
              gap: { xs: 'var(--lf-6)', md: 'var(--lf-10)' },
              alignItems: 'start',
            }}
          >
            {/* The stage is skeletoned AS THE NICHE: a card placeholder that is
                not arch-shaped makes first paint and loaded paint two different
                shapes, which is the CLS budget (P5, ≤0.05). */}
            <Box
              className="lf-skel lf-skel--media lf-skel--alcove"
              sx={{ inlineSize: 'min(100%, 542px)', marginInline: 'auto' }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Box component="span" className="lf-sr-only" role="status" aria-live="polite">
                Loading product
              </Box>
              {[40, 70, 30, 55, 90, 45, 52].map((width, index) => (
                <Box
                  key={`pdp-skel-${index}`}
                  className="lf-skel lf-skel--text"
                  sx={{
                    width: `${width}%`,
                    height: index === 6 ? 52 : 18,
                    mt: index === 0 ? 0 : 'var(--lf-4)',
                    borderRadius: index === 6 ? 'var(--lf-r-field)' : 'var(--lf-r-chip)',
                  }}
                />
              ))}
            </Box>
          </Box>
        </Container>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
        <SeoHead title="Product unavailable" noindex />
        <Container maxWidth="sm">
          <ErrorState
            title="Couldn't load this product"
            error={error}
            onRetry={load}
            secondaryLabel="Shop all products"
            secondaryTo="/products"
            variant="page"
            headingComponent="h1"
          />
        </Container>
      </Box>
    );
  }

  if (status === 'notfound' || !product) {
    return (
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: 'var(--lf-sect)' }}>
        <SeoHead title="Product no longer available" noindex />
        <Container maxWidth="sm">
          <EmptyState
            icon={<SearchOffIcon />}
            title="This product is no longer available"
            message="It may have been discontinued or renamed. The rest of the range is here."
            primaryLabel="Shop all products"
            primaryTo="/products"
            secondaryLabel="Go to home"
            secondaryTo="/"
            variant="page"
            headingComponent="h1"
          />
        </Container>
      </Box>
    );
  }

  /* ------------------------------------------------------------------ *
   * ready
   * ------------------------------------------------------------------ */

  const categoryName = product.category?.name;
  const categorySlug = product.category?.slug;
  const productUrl = absoluteUrl(`/product/${product.slug}`);
  const imageUrl = absoluteUrl(product.image_main);
  const skinTypes = product.skin_types || [];

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: imageUrl || undefined,
    description: (product.description || '').trim() || undefined,
    sku: product.sku || undefined,
    brand: { '@type': 'Brand', name: product.brand || 'Le foyeR.' },
    category: categoryName || undefined,
    offers: priced
      ? {
          '@type': 'Offer',
          // Emitted from the SAME source <PriceBlock> renders (§5.3): one
          // derivation, so `offers.price` cannot disagree with the visible price.
          price: String(priceView(product).amount),
          priceCurrency: product.currency || 'INR',
          availability: schemaAvailability(product),
          url: productUrl || undefined,
        }
      : undefined,
    /* §5.3 / §10.9: `aggregateRating` is OMITTED ENTIRELY. `review_summary.count`
       is 0 on all six products, and production once shipped a hand-typed
       4.50/40-reviews with no Review rows — inventing social proof is the worst
       thing available here. The condition stays so a real rating can never be
       suppressed once real rows exist; today it is always false. */
    aggregateRating: reviews.hasReviews
      ? {
          '@type': 'AggregateRating',
          ratingValue: Number(reviews.average.toFixed(2)),
          reviewCount: reviews.count,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Products', item: absoluteUrl('/products') },
      ...(categoryName && categorySlug
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: categoryName,
              item: absoluteUrl(`/products?category=${encodeURIComponent(categorySlug)}`),
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: categoryName ? 4 : 3,
        name: product.name,
        item: productUrl,
      },
    ],
  };

  /* `About this item` — every row from the payload, never a typed value
     (§10.21). TODO(data) §7.6 #6: LF-SK-MO02 "The Daily Invisible Moisturizer"
     is filed under sub-category "Cleansers". It renders as served; a moisturiser
     filed as a cleanser is fixed in admin, not papered over in the UI. */
  const detailRows = [
    ['Brand', product.brand || 'Le foyeR.'],
    ['Category', categoryName],
    ['Sub-category', product.sub_category?.name],
    ['Size', product.size],
    ['SKU', product.sku],
  ].filter(([, value]) => typeof value === 'string' && value.trim());

  /* Below the fold: at most four labels, each rendered only when the payload
     really carries the field. `how_to_use` is NOT here — it is The ritual. */
  const panels = [
    benefits.length
      ? {
          label: 'Benefits',
          content:
            benefits.length === 1 ? (
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                {benefits[0]}
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 'var(--lf-5)' }}>
                {benefits.map((row) => (
                  <Typography
                    component="li"
                    key={row}
                    variant="body2"
                    sx={{ mb: 'var(--lf-1)', color: 'var(--lf-ink-2)' }}
                  >
                    {row}
                  </Typography>
                ))}
              </Box>
            ),
        }
      : null,
    product.description
      ? {
          label: 'Description',
          content: (
            <Typography
              variant="body2"
              sx={{ color: 'var(--lf-ink-2)', whiteSpace: 'pre-line' }}
            >
              {product.description}
            </Typography>
          ),
        }
      : null,
    product.ingredients
      ? {
          label: 'Ingredients',
          content: (
            <Typography
              variant="body2"
              sx={{ color: 'var(--lf-ink-2)', whiteSpace: 'pre-line' }}
            >
              {product.ingredients}
            </Typography>
          ),
        }
      : null,
    product.key_features
      ? {
          label: 'Key features',
          content: (
            <Typography
              variant="body2"
              sx={{ color: 'var(--lf-ink-2)', whiteSpace: 'pre-line' }}
            >
              {product.key_features}
            </Typography>
          ),
        }
      : null,
  ].filter(Boolean);

  /* ---- the gallery ------------------------------------------------- */

  const gallery = (
    <Box sx={{ minWidth: 0 }}>
      {/* THE STAGE — the SAME niche, the same hearth light and the same
          foot-shade as the card (§5.3). A product you tapped on the shelf
          opens into a larger version of the exact frame it was standing in;
          that continuity IS the design. `data-fit="contain"` is gone with the
          mat it sat on (§2.10, §10.3). */}
      <Alcove
        product={product}
        surface="pdp"
        frame={galleryIndex}
        priority={galleryIndex === 0}
        stock={stock.state}
      />

      {images.length > 1 ? (
        <>
          {/* THE THUMBNAIL RAIL, BENEATH THE MAIN IMAGE (§5.3) — horizontal,
              72px squares, scroll-snapped. It was a vertical column with
              `maxHeight: 520; overflowY: auto`, which is why pdp-desk.png cuts
              the seventh thumbnail in half. */}
          <Box
            className="lf-rail"
            role="group"
            aria-label={`${product.name} images`}
            sx={{ gap: 'var(--lf-2)', mt: 'var(--lf-4)', py: 'var(--lf-1)' }}
          >
            {images.map((image, index) => {
              const selected = galleryIndex === index;
              return (
                <Box
                  key={image}
                  component="button"
                  type="button"
                  onClick={() => setGalleryIndex(index)}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-current={selected ? 'true' : undefined}
                  className="lf-press"
                  sx={{
                    position: 'relative',
                    width: 72,
                    height: 72,
                    flex: 'none',
                    p: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    backgroundColor: 'var(--lf-mat)',
                    borderRadius: 'var(--lf-r-field)',
                    /* A8: never colour alone — the selected thumbnail carries a
                       2px boundary (3.16:1, clears SC 1.4.11) against a 1px
                       hairline, plus `aria-current`. */
                    border: selected
                      ? '2px solid var(--lf-gold-edge)'
                      : '1px solid var(--lf-hairline)',
                    transition: 'border-color var(--lf-dur-2) var(--lf-ease)',
                    /* A7: the ring must not be clipped inside a scroller. */
                    '&:focus-visible': {
                      outline: '2px solid var(--lf-focus)',
                      outlineOffset: -2,
                    },
                    /* <picture> is an inline box, so a percentage height on the
                       <img> inside it resolves against `auto` unless the
                       wrapper is given one. */
                    '& picture': { display: 'block', width: '100%', height: '100%' },
                    '& img': {
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    },
                  }}
                >
                  {/* §7.4: the 160px derivative, not the 2048² master. The alt
                      is empty because the button's own label names the frame. */}
                  <ProductImage
                    product={product}
                    frame={index}
                    surface="thumb"
                    alt=""
                    priority={index === 0}
                    preload={false}
                  />
                </Box>
              );
            })}
          </Box>
          <Typography component="p" className="lf-sr-only" role="status" aria-live="polite">
            {`Image ${galleryIndex + 1} of ${images.length}`}
          </Typography>
        </>
      ) : null}

    </Box>
  );

  /* ---- the prose that sits beneath the gallery (§5.3) ----------------------
     SPLIT OUT OF `gallery` IN THE INTEGRATION STEP. It is still "directly
     beneath the gallery" at md+, because the grid below places it in column 1
     row 2 while the buy box spans both rows — the desktop composition is
     byte-for-byte what it was. At xs the three children stack by `order`, so
     the buy box comes SECOND and the ritual THIRD. Before this, a phone showed
     ~500px of usage instructions before the first price or Add to bag, which is
     the same defect §5.5 names on Checkout ("the order-summary column is the
     second grid child and therefore stacks below the Place Order button") and
     fixes with exactly this mechanism. */
  const galleryProse = (
    <Box sx={{ minWidth: 0 }}>
      {/* THE RITUAL (§2.32), directly beneath the gallery, VERBATIM from
          `how_to_use`. Zero invention, zero new assets. */}
      {ritual.length ? (
        <Box component="section" aria-labelledby={`${baseId}-ritual`}>
          <Typography id={`${baseId}-ritual`} variant="h3" component="h2">
            The ritual
          </Typography>
          <Box component="ol" sx={{ listStyle: 'none', m: 0, mt: 'var(--lf-4)', p: 0 }}>
            {ritual.map((step, index) => (
              <Box
                component="li"
                key={step}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 40px) 1fr',
                  columnGap: 'var(--lf-4)',
                  alignItems: 'baseline',
                  py: 'var(--lf-3)',
                  borderTop: index === 0 ? 0 : '1px solid var(--lf-hairline)',
                }}
              >
                <Typography
                  variant="eyebrow"
                  component="span"
                  aria-hidden="true"
                  className="lf-num"
                >
                  {String(index + 1).padStart(2, '0')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                  {step}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}

      {/* PER-SKU SUITABILITY — what replaced the withdrawn sitewide
          universal-suitability claim (LF-05). One plain line, then chips. */}
      {suitability || skinTypes.length ? (
        <Box sx={{ mt: ritual.length ? 'var(--lf-6)' : 'var(--lf-8)' }}>
          <Typography variant="eyebrow" component="h3" sx={{ color: 'var(--lf-ink-3)' }}>
            Suitable for
          </Typography>
          {suitability ? (
            <Typography
              variant="body2"
              sx={{ mt: 'var(--lf-2)', color: 'var(--lf-ink-2)' }}
            >
              {suitability}
            </Typography>
          ) : null}
          {skinTypes.length ? (
            <Box sx={{ display: 'flex', gap: 'var(--lf-2)', flexWrap: 'wrap', mt: 'var(--lf-3)' }}>
              {skinTypes.map((skinType) => (
                <Chip
                  key={skinType.slug}
                  component={RouterLink}
                  to={`/products?skin_type=${encodeURIComponent(skinType.slug)}`}
                  clickable
                  label={skinType.name}
                  size="small"
                  variant="filter"
                />
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );

  /* ---- the buy box (§6.7, §5.3's order verbatim) -------------------- */

  const buyBox = (
    <Box
      component="section"
      aria-label="Purchase options"
      sx={{
        minWidth: 0,
        /* §6.7: sticky, internal scroll, and `overscroll-behavior: contain` so
           reaching its end does not start scrolling the page behind it. */
        position: { md: 'sticky' },
        top: { md: 'calc(var(--lf-nav-h) + 24px)' },
        maxHeight: { md: 'calc(100dvh - var(--lf-nav-h) - 48px)' },
        overflowY: { md: 'auto' },
        overscrollBehavior: 'contain',
        /* A7: a focus ring must never be clipped inside a scroller. */
        '& *:focus-visible': { outlineOffset: -2 },
      }}
    >
      {categoryName ? (
        <Typography
          component={categorySlug ? RouterLink : 'p'}
          {...(categorySlug ? { to: `/products?category=${encodeURIComponent(categorySlug)}` } : null)}
          variant="eyebrow"
          sx={{ display: 'block', textDecoration: 'none' }}
        >
          {categoryName}
        </Typography>
      ) : null}

      {/* No xs font shrinking: `h1`'s clamp() already runs 30px → 44px. */}
      <Typography variant="h1" component="h1" sx={{ mt: 'var(--lf-2)' }}>
        {product.name}
      </Typography>

      {/* A REAL ANCHOR that scroll-targets the review form (§5.3). It was a
          `Typography` with `cursor: pointer` and no handler. NEVER a star row
          and never a count — all six products have zero Review rows (§10.9). */}
      <Typography
        component="a"
        href="#reviews"
        variant="caption"
        sx={{
          display: 'inline-block',
          mt: 'var(--lf-3)',
          color: 'var(--lf-ink-3)',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          '@media (hover:hover)': { '&:hover': { color: 'var(--lf-gold-ink)' } },
          ...FOCUS_RING_SX,
        }}
      >
        {reviews.hasReviews
          ? `${reviews.averageLabel} out of 5 · ${reviews.countLabel}`
          : 'Be the first to review'}
      </Typography>

      <PriceBlock
        product={product}
        size="lg"
        sellable={stock.sellable}
        sx={{ mt: 'var(--lf-4)' }}
      />

      <StockLabel stock={stock} variant="inline" sx={{ mt: 'var(--lf-2)' }} />

      {product.size || product.sku ? (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 'var(--lf-2)', color: 'var(--lf-ink-3)' }}
        >
          {[product.size, product.sku].filter(Boolean).join(' · ')}
        </Typography>
      ) : null}

      {/* THE PAGE'S ONE GOLD RULE (§3.3 / §5.3). Maximum four per page; this
          page spends two — here and on the rest of the shelf. */}
      <Box className="lf-ledge" sx={{ my: 'var(--lf-5)' }} />

      {/* ---------------- the CTA block ---------------- */}
      <Box ref={inlineCtaRef}>
        {stock.sellable && priced ? (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--lf-4)',
                flexWrap: 'wrap',
                mb: 'var(--lf-4)',
              }}
            >
              <Typography component="span" variant="subtitle2" id={`${baseId}-qty`}>
                Quantity
              </Typography>
              <Box
                role="group"
                aria-labelledby={`${baseId}-qty`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid var(--lf-border-field)',
                  borderRadius: 'var(--lf-r-field)',
                }}
              >
                {/* A4 / §10.12: `aria-disabled` at the bounds, never the
                    `disabled` attribute — the control keeps its place in the
                    tab order and keeps its explanation. */}
                <IconButton
                  onClick={() => changeQuantity(-1)}
                  aria-label="Decrease quantity"
                  aria-disabled={quantity <= 1 || undefined}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--lf-r-field)',
                    color: quantity <= 1 ? 'var(--lf-ink-3)' : 'var(--lf-ink)',
                    ...FOCUS_RING_SX,
                  }}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography
                  component="span"
                  className="lf-num"
                  sx={{ minWidth: 40, textAlign: 'center' }}
                  aria-live="polite"
                >
                  {quantity}
                </Typography>
                <IconButton
                  onClick={() => changeQuantity(1)}
                  aria-label="Increase quantity"
                  aria-disabled={(ceiling !== null && quantity >= ceiling) || undefined}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--lf-r-field)',
                    color:
                      ceiling !== null && quantity >= ceiling
                        ? 'var(--lf-ink-3)'
                        : 'var(--lf-ink)',
                    ...FOCUS_RING_SX,
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>
              {ceiling !== null && ceiling <= LOW_STOCK_THRESHOLD ? (
                <Typography variant="caption" sx={{ color: 'var(--lf-warn-ink)' }}>
                  {`Max ${ceiling} per order`}
                </Typography>
              ) : null}
            </Box>

            {/* PRIMARY — ink, 52px, `Add to bag · ₹480`. The bag glyph is
                licensed HERE and in the sticky bar, nowhere else (§2.15). */}
            <AddToBag
              product={product}
              quantity={quantity}
              size="buybox"
              withPrice
              showIcon
              onAdded={() =>
                setCartMessage({ tone: 'ok', text: 'Added to your bag.' })
              }
              onError={(message) =>
                setCartMessage(message ? { tone: 'error', text: message } : null)
              }
            />

            {/* SECONDARY — outlined, 52px. The same component, so there is one
                add-to-cart implementation on the page, not two (§10.23); the
                `variant` prop rides <AddToBag>'s own pass-through. */}
            <AddToBag
              product={product}
              quantity={quantity}
              size="buybox"
              label="Buy now"
              showIcon={false}
              variant="outlined"
              onAdded={() => navigate('/checkout')}
              onError={(message) =>
                setCartMessage(message ? { tone: 'error', text: message } : null)
              }
              sx={{ mt: 'var(--lf-3)' }}
            />
          </>
        ) : priced ? (
          /* OUT OF STOCK / COMING SOON: the stepper and `Buy now` are REMOVED,
             not disabled (§5.3). The primary becomes the gold fill — half this
             catalogue is unbuyable, so the restock row is the warmest thing on
             the page rather than its dead half (§2.18). <NotifyMe> carries the
             adjacent reason itself, from the same derivation the ledge reads. */
          <NotifyMe product={product} size="buybox" reason={stock.reason} />
        ) : (
          <>
            {/* §6.3: a product with no usable price never shows a buy button.
                On a PDP "View details" is meaningless — you are on them — so
                the honest secondary is the one thing we can actually do. */}
            <Button
              className="lf-press"
              component={RouterLink}
              to="/contact"
              variant="outlined"
              fullWidth
              sx={{ minHeight: 52, whiteSpace: 'nowrap', ...FOCUS_RING_SX }}
            >
              Ask us about this product
            </Button>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 'var(--lf-2)', color: 'var(--lf-ink-3)' }}
            >
              This product has no published price yet.
            </Typography>
          </>
        )}
      </Box>

      {/* The outcome is always stated adjacent, never by turning a button red
          (§6.5). Zero height until there is something to say. */}
      <Box aria-live="polite" sx={{ minWidth: 0 }}>
        {cartMessage ? (
          <Typography
            variant="caption"
            role={cartMessage.tone === 'error' ? 'alert' : undefined}
            sx={{
              display: 'block',
              mt: 'var(--lf-3)',
              color: cartMessage.tone === 'error' ? 'var(--lf-err-ink)' : 'var(--lf-ok-ink)',
            }}
          >
            {cartMessage.text}{' '}
            {cartMessage.tone === 'ok' ? (
              <Typography
                component={RouterLink}
                to="/cart"
                variant="caption"
                sx={{ color: 'var(--lf-gold-ink)' }}
              >
                View bag
              </Typography>
            ) : null}
          </Typography>
        ) : null}
      </Box>

      {/* WISHLIST — a TEXT button (§5.3), not a 52px icon box competing with
          the two real buttons above it. 44px high, never `disabled`. */}
      <Button
        className="lf-press"
        type="button"
        variant="text"
        onClick={handleWishlist}
        aria-pressed={saved}
        aria-busy={wishlistPending || undefined}
        startIcon={saved ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
        sx={{
          minHeight: 44,
          mt: 'var(--lf-3)',
          px: 0,
          color: saved ? 'var(--lf-err-ink)' : 'var(--lf-ink-2)',
          ...(wishlistPending ? { pointerEvents: 'none' } : null),
          ...FOCUS_RING_SX,
        }}
      >
        {saved ? 'Saved for later' : 'Save for later'}
      </Button>

      {/* DELIVERY AND RETURNS — two rows, two wordings, every number from
          `policy.js` so they cannot drift from /shipping-returns (§6.7, LF-12).
          "Free 30 Days Delivery Returns" — one sentence conflating two
          policies, against a 7-day window on the policy page — is gone. */}
      <Box sx={{ mt: 'var(--lf-5)', borderTop: '1px solid var(--lf-hairline)' }}>
        <PolicyRow label="Delivery">
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
            {policyCopy.deliveryLine}
          </Typography>
          {/* LF-11: the input the old copy asked for but never provided, with a
              REAL serviceability lookup behind it (§6.7). */}
          <Box sx={{ mt: 'var(--lf-3)' }}>
            <PincodeCheck
              variant="inline"
              showPolicyLine={false}
              onResult={(result) =>
                setCodAvailable(
                  result && typeof result.cod_available === 'boolean' ? result.cod_available : null,
                )
              }
            />
          </Box>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 'var(--lf-2)', color: 'var(--lf-ink-3)' }}
          >
            {policyCopy.codLabelFor(codAvailable)}
          </Typography>
        </PolicyRow>

        <Box sx={{ borderTop: '1px solid var(--lf-hairline)' }}>
          <PolicyRow label="Returns">
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
              {policyCopy.returnsLine}
            </Typography>
            {policyCopy.returnsExclusionsLine ? (
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 'var(--lf-1)', color: 'var(--lf-ink-3)' }}
              >
                {policyCopy.returnsExclusionsLine}
              </Typography>
            ) : null}
            <Typography
              component={RouterLink}
              to="/shipping-returns"
              variant="caption"
              sx={{ display: 'inline-block', mt: 'var(--lf-2)', color: 'var(--lf-gold-ink)' }}
            >
              Read the delivery &amp; returns policy
            </Typography>
          </PolicyRow>
        </Box>
      </Box>

      {/* AMAZON — a TERTIARY TEXT LINK (§5.3), which is also LF-18's substance:
          it was a full-width button above the fold inside the D2C buy box, in
          Amazon's own palette, on a brand whose accent is warm gold. No
          price-match claim and no lowest-price claim ships here.
          TODO(business): LF-18 — either align marketplace prices to D2C, or
          approve a concrete D2C benefit we can honour and state. Until one is
          approved, no price-advantage language may ship. */}
      {product.amazon_link ? (
        <Box sx={{ mt: 'var(--lf-4)', pt: 'var(--lf-4)', borderTop: '1px solid var(--lf-hairline)' }}>
          <Typography
            component="a"
            href={product.amazon_link}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ color: 'var(--lf-ink-2)', ...FOCUS_RING_SX }}
          >
            Buy on Amazon
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 'var(--lf-1)', color: 'var(--lf-ink-3)' }}
          >
            {policyCopy.d2cAdvantage}
          </Typography>
        </Box>
      ) : null}

      {detailRows.length ? (
        <Box sx={{ mt: 'var(--lf-5)', pt: 'var(--lf-4)', borderTop: '1px solid var(--lf-hairline)' }}>
          <Typography variant="eyebrow" component="h3" sx={{ color: 'var(--lf-ink-3)', mb: 'var(--lf-3)' }}>
            About this item
          </Typography>
          <DetailList rows={detailRows} />
        </Box>
      ) : null}
    </Box>
  );

  /* ---- the rest of the shelf (§5.3) --------------------------------- */

  const shelfBody = (() => {
    if (shelfStatus === 'error') {
      return (
        <ErrorState
          title="Couldn't load the rest of the shelf"
          error={shelfError}
          onRetry={loadShelf}
          secondaryLabel="Browse all products"
          secondaryTo="/products"
          variant="inline"
          headingComponent="h3"
        />
      );
    }

    if (shelfStatus === 'empty') {
      return (
        <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
          This is the whole shelf for now.{' '}
          <Typography
            component={RouterLink}
            to="/products"
            variant="body2"
            sx={{ color: 'var(--lf-gold-ink)' }}
          >
            Browse all products
          </Typography>
          .
        </Typography>
      );
    }

    const loading = shelfStatus === 'loading';
    const tracks = loading
      ? Array.from({ length: skeletonCount(5, 3) }, (_, index) => index)
      : shelf;

    return (
      <>
        <Box
          ref={shelfRailRef}
          className="lf-rail"
          aria-busy={loading || undefined}
          sx={{
            ...PRODUCT_RAIL_SX,
            /* Bleed the rail to the panel's edges so a card can scroll flush
               with it instead of stopping inside a 32px pad. */
            mx: { xs: 'calc(-1 * var(--lf-5))', md: 'calc(-1 * var(--lf-8))' },
            px: { xs: 'var(--lf-5)', md: 'var(--lf-8)' },
            py: 'var(--lf-1)',
            scrollPaddingInline: { xs: 'var(--lf-5)', md: 'var(--lf-8)' },
          }}
        >
          {loading
            ? tracks.map((index) => (
                <Box
                  key={`shelf-skel-${index}`}
                  aria-hidden="true"
                  sx={{ flex: '0 0 300px', minWidth: 0 }}
                >
                  {/* P5: the placeholder lays out at the REAL card's shape —
                      the arch, then §6.2's row rhythm — so first paint and
                      loaded paint are not two different silhouettes. */}
                  <Box className="lf-skel lf-skel--media lf-skel--alcove" />
                  {[
                    { w: 34, h: 12, mt: '14px' },
                    { w: 28, h: 12, mt: '6px' },
                    { w: 78, h: 20, mt: '2px' },
                    { w: 46, h: 12, mt: '4px' },
                    { w: 30, h: 16, mt: '10px' },
                    { w: 100, h: 48, mt: '14px' },
                  ].map((bar, barIndex) => (
                    <Box
                      key={`bar-${barIndex}`}
                      className="lf-skel lf-skel--text"
                      sx={{
                        width: `${bar.w}%`,
                        height: bar.h,
                        mt: bar.mt,
                        borderRadius: bar.h === 48 ? 'var(--lf-r-field)' : 'var(--lf-r-chip)',
                      }}
                    />
                  ))}
                </Box>
              ))
            : tracks.map((candidate, index) => (
                <Box
                  key={candidate.id}
                  data-shelf-index={index}
                  sx={{ flex: '0 0 300px', minWidth: 0, scrollSnapAlign: 'start' }}
                >
                  <ProductCard product={candidate} />
                </Box>
              ))}
        </Box>

        {/* §5.3's visible 2px --lf-gold-edge scroll indicator — one segment per
            product, lit while that card is in view. Driven by the
            IntersectionObserver above, because §10.17 and P8 ban scroll
            listeners outright. */}
        {!loading && shelf.length > 1 ? (
          <Box
            aria-hidden="true"
            sx={{ display: 'flex', gap: 'var(--lf-1)', mt: 'var(--lf-4)' }}
          >
            {shelf.map((candidate, index) => (
              <Box
                key={`indicator-${candidate.id}`}
                sx={{
                  flex: 1,
                  height: 2,
                  borderRadius: 'var(--lf-r-pill)',
                  backgroundColor: shelfVisible.includes(index)
                    ? 'var(--lf-gold-edge)'
                    : 'var(--lf-hairline)',
                  transition: 'background-color var(--lf-dur-2) var(--lf-ease)',
                }}
              />
            ))}
          </Box>
        ) : null}
      </>
    );
  })();

  /* ------------------------------------------------------------------ */

  return (
    <Box
      sx={{
        backgroundColor: 'var(--lf-canvas)',
        py: 'var(--lf-sect-sm)',
        // Room for the sticky bar, so it never covers the last row of content.
        pb: barVisible
          ? `calc(${MOBILE_BAR_H}px + env(safe-area-inset-bottom, 0px) + 16px)`
          : undefined,
      }}
    >
      <SeoHead
        title={product.name}
        description={metaDescription(product)}
        canonical={`/product/${product.slug}`}
        image={product.image_main}
        imageAlt={productAlt(product)}
        type="product"
        jsonLd={[productLd, breadcrumbLd]}
      />

      <Container maxWidth="lg">
        <Box component="nav" aria-label="Breadcrumb" sx={{ mb: 'var(--lf-4)' }}>
          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
            <Typography
              component={RouterLink}
              to="/"
              variant="caption"
              sx={{ color: 'inherit', textDecoration: 'none' }}
            >
              Home
            </Typography>
            {' / '}
            <Typography
              component={RouterLink}
              to="/products"
              variant="caption"
              sx={{ color: 'inherit', textDecoration: 'none' }}
            >
              Products
            </Typography>
            {categorySlug ? (
              <>
                {' / '}
                <Typography
                  component={RouterLink}
                  to={`/products?category=${encodeURIComponent(categorySlug)}`}
                  variant="caption"
                  sx={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {categoryName}
                </Typography>
              </>
            ) : null}
            {` / ${product.name}`}
          </Typography>
        </Box>

        {/* ======================= 7 / 5, not 50 / 50 (§5.3) =======================
            At 1440: content 1216 − 40 gap = 1176 → gallery 686, buy box 490. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' },
            columnGap: { md: 'var(--lf-10)' },
            rowGap: 'var(--lf-6)',
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          {/* At md the placement is explicit, so the buy box spans both rows and
              the prose sits under the media in column 1 — the 7/5 composition
              §5.3 specifies. At xs there is one column and `order` decides:
              media → buy box → prose. */}
          <Box sx={{ minWidth: 0, order: 1, gridColumn: { md: 1 }, gridRow: { md: 1 } }}>
            {gallery}
          </Box>
          <Box
            sx={{
              minWidth: 0,
              order: 2,
              gridColumn: { md: 2 },
              gridRow: { md: '1 / span 2' },
              /* The wrapper stretches over both rows so the sticky buy box
                 inside it has somewhere to travel; `align-items: start` on the
                 grid would content-size it and freeze the sticky. */
              alignSelf: { md: 'stretch' },
            }}
          >
            {buyBox}
          </Box>
          <Box
            sx={{
              minWidth: 0,
              order: 3,
              gridColumn: { md: 1 },
              gridRow: { md: 2 },
              mt: { md: 'var(--lf-4)' },
            }}
          >
            {galleryProse}
          </Box>
        </Box>

        {/* ======================= below the fold ======================= */}
        {panels.length ? (
          <Box sx={{ mt: 'var(--lf-sect)' }}>
            {isDesktop ? (
              <>
                <Tabs
                  value={activeTab}
                  onChange={(_event, next) => setActiveTab(next)}
                  aria-label="Product information"
                >
                  {panels.map((panel, index) => (
                    <Tab
                      key={panel.label}
                      label={panel.label}
                      id={`${baseId}-tab-${index}`}
                      aria-controls={`${baseId}-tabpanel-${index}`}
                    />
                  ))}
                </Tabs>
                {panels.map((panel, index) =>
                  activeTab === index ? (
                    <Box
                      key={panel.label}
                      role="tabpanel"
                      id={`${baseId}-tabpanel-${index}`}
                      aria-labelledby={`${baseId}-tab-${index}`}
                      sx={{ py: 'var(--lf-6)', maxWidth: '68ch' }}
                    >
                      {panel.content}
                    </Box>
                  ) : null,
                )}
              </>
            ) : (
              <InfoAccordion panels={panels} idBase={`${baseId}-acc`} />
            )}
          </Box>
        ) : null}

        {/* ================= THE REST OF THE SHELF (§5.3) =================
            On --lf-mat with a ledge. ALL five remaining products, scroll-
            snapped at 300px, filling the row at every width and never leaving
            an empty track (§2.29). */}
        <Box
          component="section"
          aria-labelledby={`${baseId}-shelf`}
          sx={{
            mt: 'var(--lf-sect)',
            backgroundColor: 'var(--lf-mat)',
            borderRadius: 'var(--lf-r-panel)',
            p: { xs: 'var(--lf-5)', md: 'var(--lf-8)' },
            minWidth: 0,
          }}
        >
          <Box className="lf-ledge" sx={{ mb: 'var(--lf-5)' }} />

          {shelfStatus === 'ready' ? (
            <Typography variant="eyebrow" sx={{ display: 'block' }}>
              {shelf.length === 1 ? '1 more product' : `${shelf.length} more products`}
            </Typography>
          ) : null}
          <Typography
            id={`${baseId}-shelf`}
            variant="h3"
            component="h2"
            sx={{ mt: 'var(--lf-2)', mb: 'var(--lf-5)' }}
          >
            The rest of the shelf
          </Typography>

          {shelfBody}

          {/* §6.8 / §5.3: the one basket-raising mechanic, with the CURRENT
              product already counted in the total. No invented discount, no
              invented urgency, no invented bundle price — the total is summed
              from real `price` values by <PriceBlock>'s own formatter. */}
          {/* §6.8: "Ink fill, 52px, FULL PANEL WIDTH (§2.20) — the biggest ink
              action on the page." The 420px cap this used to carry made it the
              width of one rail track and read as a stray button. */}
          <Box sx={{ mt: 'var(--lf-6)' }}>
            <ShelfBundle products={[product, ...shelf]} exclude={bagProductIds} />
          </Box>
        </Box>

        <Box sx={{ mt: 'var(--lf-sect)' }}>
          <ProductReviews
            slug={product.slug}
            summary={summary}
            onSummaryChange={setSummary}
            productName={product.name}
          />
        </Box>
      </Container>

      {/* ---------------- sticky mobile buy bar (§5.3, §4.4) ----------------
          At 320: 104 price + 8 gap + 168 CTA = 280, inside the 288 content. */}
      {!isDesktop ? (
        <Box
          className="lf-glass"
          aria-hidden={!barVisible}
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1150,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--lf-2)',
            px: 'var(--lf-4)',
            py: 'var(--lf-2)',
            pb: 'calc(8px + env(safe-area-inset-bottom, 0px))',
            boxShadow: 'var(--lf-e-bar)',
            transform: barVisible ? 'translateY(0)' : 'translateY(110%)',
            transition: 'transform var(--lf-dur-3) var(--lf-ease-out)',
            /* `visibility: hidden` also takes the controls out of the tab order,
               so nothing focusable hides behind `aria-hidden`. */
            visibility: barVisible ? 'visible' : 'hidden',
          }}
        >
          <Box sx={{ minWidth: 104 }}>
            <PriceBlock product={product} size="md" sellable={stock.sellable} />
            <StockLabel stock={stock} variant="inline" sx={{ minHeight: 0 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {stock.sellable && priced ? (
              <AddToBag
                product={product}
                quantity={quantity}
                size="card"
                showIcon
                onError={(message) =>
                  setCartMessage(message ? { tone: 'error', text: message } : null)
                }
              />
            ) : priced ? (
              <NotifyMe product={product} size="card" reason={null} />
            ) : (
              <Button
                className="lf-press"
                component={RouterLink}
                to="/contact"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ minHeight: 48, whiteSpace: 'nowrap' }}
              >
                Ask us
              </Button>
            )}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

export default ProductDetail;
