/**
 * ProductDetail — the PDP. Eight separate requirements land in this one file.
 *
 * LF-21 · THE LAYOUT BUG THAT CAUSED EVERYTHING ELSE
 * The old page was `display:flex; flexDirection:'row'; flexWrap:'nowrap'` with two hard
 * `width:'50%'` columns **at every breakpoint**. On a 375px phone the buy box was 170px
 * wide, which is why the product name was shrunk to `fontSize: {xs:'1rem'}` and the
 * category line to `0.6rem`. It is now `flexDirection:{xs:'column',md:'row'}` with
 * `width:{xs:'100%',md:'50%'}`, and every `xs` font shrink is deleted — the type scale
 * in `theme.js` already handles small screens.
 *
 * LF-21 · THE BUY BOX IS RE-TIERED in the order the spec names: benefit → suitability →
 * price + savings → availability → **Add to Cart as the visual primary** → trust/proof
 * row that actually links to the reviews → delivery + pincode.
 *
 * LF-18 · AMAZON. The old page rendered a full-width "Buy on Amazon" button **above the
 * fold inside the D2C buy box**, in Amazon's own palette (an orange Buy Now, a red
 * price, a cold grey delivery panel) on a brand whose accent is warm gold — actively
 * diverting traffic to the channel the requirement says undercuts it. Per §4: the link
 * survives as a quiet text link **below the tabs**, labelled "Also available on Amazon";
 * Add to Cart is the visual primary; every Amazon hex is gone; and the only D2C statement
 * made is the one the shipped code can prove (`policy.js`'s `d2cAdvantage`). No
 * price-match and no lowest-price claim.
 *
 * LF-11 · PINCODE. The page told shoppers "Enter your postal code for Delivery
 * Availability" next to **no input at all**, and asserted "Cash on Delivery Available"
 * for every pincode in India. `<PincodeCheck />` is now under the delivery line and the
 * COD row is driven by `cod_available` from that lookup.
 *
 * LF-12 · ONE POLICY SOURCE. "Free 30 Days Delivery Returns" (one sentence conflating
 * two policies, with a window `/shipping-returns` puts at 7 days) is replaced by two
 * labelled blocks built from `content/policy.js`. No number is typed in this file.
 *
 * LF-01 / §2e · ONE RATING. The hero stars, the review block's average, the card badge
 * and the JSON-LD `aggregateRating` all read `review_summary`. `product.rating` and
 * `product.reviews_count` are not even served any more. With zero reviews **no stars
 * render at all** — not an empty five-star row, not `0 reviews`.
 *
 * LF-07 · SEO. `SeoHead` + `Product` JSON-LD emitted from the same values the page
 * renders, with `availability` derived from the same `in_stock` and `aggregateRating`
 * present only when `review_summary.count > 0`.
 *
 * LF-26 · STATES. `getProductBySlug` did not exist in api.js; the call threw, `product`
 * stayed null, and the page showed **"Loading…" forever**. There are now four terminal
 * states: skeleton, error-with-Retry, a 404 "no longer available" page, and ready.
 *
 * §2d · AVAILABILITY. `in_stock !== undefined ? … : stock_quantity > 0` is gone (and
 * `stock_quantity` is no longer served). The two different low-stock thresholds — `<=5`
 * in the stock line, `<=10` on the quantity cap, in the same component — are one
 * `LOW_STOCK_THRESHOLD`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import SearchOffIcon from '@mui/icons-material/SearchOff';

import { getProduct } from '../services/api';
import { trackViewContent } from '../services/analytics';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { usePolicy } from '../content/policy';
import SeoHead, { absoluteUrl } from '../components/common/SeoHead';
import EmptyState, { FOCUS_RING_SX } from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import PincodeCheck from '../components/common/PincodeCheck';
import { NotifyMeButton } from '../components/common/NotifyMeDialog';
import ProductReviews from '../components/product/ProductReviews';
import RelatedProducts from '../components/product/RelatedProducts';
import {
  LOW_STOCK_THRESHOLD,
  benefitRows,
  priceView,
  productAlt,
  productImages,
  reviewView,
  schemaAvailability,
  stockState,
  suitabilityLine,
} from '../components/product/productPresentation';

/** The sticky mobile bar's height, published as a CSS var so a toast cannot cover it. */
const MOBILE_BAR_H = 68;

/** Meta descriptions are truncated by every engine anyway; do it on a word boundary. */
function metaDescription(product) {
  const source = (product?.description || product?.key_benefits || '').replace(/\s+/g, ' ').trim();
  if (!source) return undefined;
  if (source.length <= 155) return source;
  return `${source.slice(0, 152).replace(/\s+\S*$/, '')}…`;
}

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const { copy: policyCopy } = usePolicy();
  const { isAuthenticated } = useAuth();
  const { addToCart, pendingItemIds } = useCart();
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
  const [busyAction, setBusyAction] = useState(null);
  const [barVisible, setBarVisible] = useState(false);

  const aliveRef = useRef(true);
  const controllerRef = useRef(null);
  const trackedSlugRef = useRef(null);
  const inlineCtaRef = useRef(null);
  const railRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  /* ------------------------------------------------------------------ *
   * load
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

  useEffect(() => {
    // A fragment owns the scroll position (`ScrollToTop` makes the same exemption), so
    // a card's "Be the first to review" link to `/product/x#reviews` is not overridden.
    if (location.hash) return;
    window.scrollTo(0, 0);
  }, [slug, location.hash]);

  /* A deep link to #reviews cannot work on its own: the anchor does not exist until the
     product has loaded, by which time the browser has given up on the fragment. */
  useEffect(() => {
    if (status !== 'ready' || location.hash !== '#reviews') return;
    const node = document.getElementById('reviews');
    if (node) node.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [status, location.hash]);

  /* §2g: ViewContent, once per slug, after the product has loaded. */
  useEffect(() => {
    if (status !== 'ready' || !product || trackedSlugRef.current === product.slug) return;
    trackedSlugRef.current = product.slug;
    trackViewContent(product);
  }, [product, status]);

  /* ------------------------------------------------------------------ *
   * derived values — one derivation, shared with the card (§2d / §2e)
   * ------------------------------------------------------------------ */

  const stock = useMemo(() => stockState(product), [product]);
  const price = useMemo(() => priceView(product, { sellable: stock.sellable }), [product, stock.sellable]);
  const reviews = useMemo(() => reviewView(summary), [summary]);
  const images = useMemo(() => productImages(product), [product]);
  const benefits = useMemo(() => benefitRows(product?.key_benefits), [product]);
  const suitability = suitabilityLine(product);

  const saved = product ? isInWishlist(product) : false;
  const wishlistPending = product ? (pendingProductIds || []).includes(product.id) : false;
  const cartPending = Boolean(busyAction) || (product ? (pendingItemIds || []).includes(product.id) : false);

  /* The sticky mobile buy bar appears only once the inline CTA has scrolled away
     (DESIGN_SYSTEM "MobileBuyBar": an IntersectionObserver, never a scroll handler). */
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

  /* Which frame of the mobile gallery is in view. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined') return undefined;
    const slides = Array.from(rail.querySelectorAll('[data-gallery-index]'));
    if (!slides.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setGalleryIndex(Number(entry.target.getAttribute('data-gallery-index')) || 0);
          }
        });
      },
      { root: rail, threshold: 0.6 },
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [images.length, isDesktop, status]);

  /* ------------------------------------------------------------------ *
   * actions
   * ------------------------------------------------------------------ */

  const changeQuantity = (delta) => {
    setQuantity((current) => {
      const ceiling = stock.maxQty > 0 ? stock.maxQty : 1;
      return Math.max(1, Math.min(current + delta, ceiling));
    });
  };

  const addToBag = async (then) => {
    if (!product || !stock.sellable || cartPending) return;
    setCartMessage(null);
    setBusyAction(then === 'checkout' ? 'buy' : 'add');
    const result = await addToCart(product, quantity);
    if (!aliveRef.current) return;
    setBusyAction(null);

    if (result === true) {
      if (then === 'checkout') {
        navigate('/checkout');
        return;
      }
      setCartMessage({ tone: 'ok', text: `Added ${quantity > 1 ? `${quantity} × ` : ''}${product.name} to your bag.` });
      return;
    }
    // CartContext resolves to the backend's own sentence ("Only 3 units available"), so
    // the shopper learns what to do instead of meeting "Failed to add to cart".
    setCartMessage({
      tone: 'error',
      text: typeof result === 'string' ? result : 'We could not add that to your bag.',
    });
  };

  const handleWishlist = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
    const result = await toggleWishlist(product);
    if (!aliveRef.current) return;
    if (result !== true) {
      setCartMessage({
        tone: 'error',
        text: typeof result === 'string' ? result : 'We could not update your saved items.',
      });
    }
  };

  const goToReviews = () => {
    const node = document.getElementById('reviews');
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ------------------------------------------------------------------ *
   * terminal states
   * ------------------------------------------------------------------ */

  if (status === 'loading') {
    return (
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', minHeight: '100vh', py: { xs: 2, md: 4 } }}>
        <SeoHead title="Loading product" noindex />
        <Container maxWidth="lg">
          <Box
            aria-busy="true"
            sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 3, md: 5 } }}
          >
            <Box sx={{ width: { xs: '100%', md: '50%' } }}>
              <Box className="lf-skel lf-skel--media lf-ar-1x1" sx={{ borderRadius: 'var(--lf-r-panel)' }} />
            </Box>
            {/* The buy box is skeletoned at its final height — the single biggest CLS
                risk on the site (DESIGN_SYSTEM §6.4). */}
            <Box sx={{ width: { xs: '100%', md: '50%' }, minHeight: 520 }}>
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
                    mt: index === 0 ? 0 : 2,
                    borderRadius: index === 6 ? 'var(--lf-r-field)' : 'var(--lf-r-chip)',
                    backgroundColor: 'var(--lf-surface-quiet)',
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
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', minHeight: '100vh', py: { xs: 4, md: 8 } }}>
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
      <Box sx={{ backgroundColor: 'var(--lf-canvas)', minHeight: '100vh', py: { xs: 4, md: 8 } }}>
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

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: imageUrl || undefined,
    description: (product.description || '').trim() || undefined,
    sku: product.sku || undefined,
    brand: { '@type': 'Brand', name: product.brand || 'Le foyeR.' },
    category: categoryName || undefined,
    offers: price.hasPrice
      ? {
          '@type': 'Offer',
          price: String(price.amount),
          priceCurrency: product.currency || 'INR',
          // Derived from THE SAME `in_stock` the page renders (LF-07).
          availability: schemaAvailability(product),
          url: productUrl || undefined,
        }
      : undefined,
    // §2e: absent entirely when there are no reviews. A product with no reviews must
    // never emit an aggregateRating, and nothing here is computed client-side.
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

  const proofRow = reviews.hasReviews ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Rating value={reviews.average} precision={0.1} readOnly size="small" />
      <Typography
        component="button"
        type="button"
        onClick={goToReviews}
        variant="body2"
        sx={{
          border: 0,
          background: 'none',
          p: 0,
          cursor: 'pointer',
          color: 'var(--lf-gold-ink)',
          textDecoration: 'underline',
          ...FOCUS_RING_SX,
        }}
      >
        {reviews.averageLabel} · {reviews.countLabel}
      </Typography>
    </Box>
  ) : (
    <Typography
      component="button"
      type="button"
      onClick={goToReviews}
      variant="body2"
      sx={{
        border: 0,
        background: 'none',
        p: 0,
        cursor: 'pointer',
        color: 'var(--lf-ink-3)',
        textDecoration: 'underline',
        ...FOCUS_RING_SX,
      }}
    >
      Be the first to review this product
    </Typography>
  );

  const detailRows = [
    ['Brand', product.brand || 'Le foyeR.'],
    ['Category', categoryName],
    ['Sub-category', product.sub_category?.name],
    ['Size', product.size],
    ['SKU', product.sku],
    ['Suitable for', suitability],
    ['Key features', product.key_features],
  ].filter(([, value]) => typeof value === 'string' && value.trim());

  const panels = [
    {
      label: 'Product details',
      content: (
        <Box>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 180px) 1fr' },
              rowGap: 1,
              columnGap: 2,
              m: 0,
            }}
          >
            {detailRows.map(([label, value]) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="subtitle2" sx={{ color: 'var(--lf-ink-2)' }}>
                  {label}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
          {product.description ? (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h5" component="h3" sx={{ mb: 1 }}>
                Description
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', whiteSpace: 'pre-line' }}>
                {product.description}
              </Typography>
            </Box>
          ) : null}
        </Box>
      ),
    },
    product.ingredients
      ? {
          label: 'Ingredients',
          content: (
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', whiteSpace: 'pre-line' }}>
              {product.ingredients}
            </Typography>
          ),
        }
      : null,
    product.how_to_use
      ? {
          label: 'How to use',
          content: (
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', whiteSpace: 'pre-line' }}>
              {product.how_to_use}
            </Typography>
          ),
        }
      : null,
  ].filter(Boolean);

  const addToBagButton = (
    <Button
      ref={inlineCtaRef}
      className="lf-press"
      variant="contained"
      color="primary"
      disableElevation
      fullWidth
      onClick={() => addToBag('stay')}
      aria-busy={cartPending}
      startIcon={
        busyAction === 'add' ? <CircularProgress size={16} thickness={3.6} sx={{ color: 'inherit' }} /> : null
      }
      sx={{ minHeight: 52, ...FOCUS_RING_SX }}
    >
      Add to bag
    </Button>
  );

  return (
    <Box
      sx={{
        backgroundColor: 'var(--lf-canvas)',
        minHeight: '100vh',
        py: { xs: 2, md: 4 },
        // Room for the sticky bar, so it never covers the last row of content.
        pb: barVisible ? `calc(${MOBILE_BAR_H}px + env(safe-area-inset-bottom, 0px) + 16px)` : undefined,
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
        {/* breadcrumb */}
        <Box component="nav" aria-label="Breadcrumb" sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
            <Typography component={RouterLink} to="/" variant="caption" sx={{ color: 'inherit', textDecoration: 'none' }}>
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

        {/* ============================ gallery + buy box ============================ */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 3, md: 5 },
            alignItems: 'flex-start',
            mb: 6,
          }}
        >
          {/* ---------------- gallery: ALL images, never slice(0, 4) ---------------- */}
          <Box sx={{ width: { xs: '100%', md: '50%' }, minWidth: 0 }}>
            {isDesktop ? (
              <Box sx={{ display: 'flex', gap: 2 }}>
                {images.length > 1 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      maxHeight: 520,
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      pr: 0.5,
                    }}
                  >
                    {images.map((image, index) => (
                      <Box
                        key={image}
                        component="button"
                        type="button"
                        onClick={() => setGalleryIndex(index)}
                        aria-label={`Show image ${index + 1} of ${images.length}`}
                        aria-current={galleryIndex === index}
                        className="lf-media lf-ar-1x1 lf-press"
                        sx={{
                          width: 72,
                          flexShrink: 0,
                          p: 0,
                          cursor: 'pointer',
                          border: galleryIndex === index ? '2px solid var(--lf-gold-edge)' : '1px solid var(--lf-hairline)',
                          borderRadius: 'var(--lf-r-field)',
                          ...FOCUS_RING_SX,
                        }}
                      >
                        <img
                          src={image}
                          alt=""
                          aria-hidden="true"
                          width="144"
                          height="144"
                          loading="lazy"
                          decoding="async"
                        />
                      </Box>
                    ))}
                  </Box>
                ) : null}

                <Box
                  className="lf-media lf-ar-1x1"
                  data-fit="contain"
                  sx={{ flex: 1, minWidth: 0, borderRadius: 'var(--lf-r-panel)' }}
                >
                  {images[galleryIndex] ? (
                    <img
                      src={images[galleryIndex]}
                      alt={productAlt(product, galleryIndex)}
                      data-product={product.slug}
                      width="1200"
                      height="1200"
                      decoding="async"
                      loading="eager"
                    />
                  ) : null}
                </Box>
              </Box>
            ) : (
              <Box>
                {/* Swipeable, full-width, one frame per swipe. CSS scroll-snap, so it
                    works with a flick, with a trackpad and with Tab + arrow keys. */}
                <Box
                  ref={railRef}
                  className="lf-rail"
                  role="group"
                  aria-label={`${product.name} images`}
                  sx={{ gap: 1, mx: -2, px: 2, scrollSnapType: 'x mandatory' }}
                >
                  {images.map((image, index) => (
                    <Box
                      key={image}
                      data-gallery-index={index}
                      className="lf-media lf-ar-1x1"
                      data-fit="contain"
                      sx={{ width: '100%', borderRadius: 'var(--lf-r-panel)' }}
                    >
                      <img
                        src={image}
                        alt={productAlt(product, index)}
                        data-product={product.slug}
                        width="1200"
                        height="1200"
                        decoding="async"
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchpriority={index === 0 ? 'high' : undefined}
                      />
                    </Box>
                  ))}
                </Box>

                {images.length > 1 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 1.5 }}>
                    {images.map((image, index) => (
                      <Box
                        key={`dot-${image}`}
                        aria-hidden="true"
                        sx={{
                          width: galleryIndex === index ? 18 : 6,
                          height: 6,
                          borderRadius: 'var(--lf-r-pill)',
                          backgroundColor: galleryIndex === index ? 'var(--lf-ink)' : 'var(--lf-border-strong)',
                          transition: 'width var(--lf-dur-2) var(--lf-ease)',
                        }}
                      />
                    ))}
                  </Box>
                ) : null}
                <Typography component="p" className="lf-sr-only" role="status" aria-live="polite">
                  {`Image ${galleryIndex + 1} of ${images.length}`}
                </Typography>
              </Box>
            )}
          </Box>

          {/* ---------------- buy box, re-tiered per LF-21 ---------------- */}
          <Box
            sx={{
              width: { xs: '100%', md: '50%' },
              minWidth: 0,
              position: { md: 'sticky' },
              top: { md: 'calc(var(--lf-nav-h) + 24px)' },
            }}
          >
            {categoryName ? (
              <Typography
                component={categorySlug ? RouterLink : 'p'}
                {...(categorySlug ? { to: `/products?category=${encodeURIComponent(categorySlug)}` } : null)}
                variant="overline"
                sx={{ display: 'block', color: 'var(--lf-gold-ink)', textDecoration: 'none', mb: 0.5 }}
              >
                {categoryName}
              </Typography>
            ) : null}

            {/* No xs font shrinking: the theme's clamp() scale already handles 320px. */}
            <Typography variant="h1" component="h1" sx={{ mb: 1 }}>
              {product.name}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              {proofRow}
              {product.is_bestseller ? <Chip label="Bestseller" size="small" variant="bestseller" /> : null}
            </Box>

            {/* tier 1 — the benefit, as structured rows (never a comma split of prose) */}
            {benefits.length ? (
              <Box sx={{ mb: 2 }}>
                {benefits.length === 1 ? (
                  <Typography variant="subtitle1" sx={{ color: 'var(--lf-ink-2)' }}>
                    {benefits[0]}
                  </Typography>
                ) : (
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {benefits.map((row) => (
                      <Typography component="li" key={row} variant="body2" sx={{ mb: 0.5, color: 'var(--lf-ink-2)' }}>
                        {row}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            ) : null}

            {/* tier 2 — suitability, per SKU. §4 LF-05 deletes "All Skin Types" as a
                site-wide promise and replaces it with what each product claims. */}
            {suitability || (product.skin_types || []).length ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Suitable for
                </Typography>
                {suitability ? (
                  <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mb: (product.skin_types || []).length ? 1 : 0 }}>
                    {suitability}
                  </Typography>
                ) : null}
                {(product.skin_types || []).length ? (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {product.skin_types.map((skinType) => (
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

            <Box className="lf-rule" sx={{ my: 2 }} />

            {/* tier 3 — price + savings. The price is ink, never a marketplace red. */}
            <Box sx={{ mb: 1.5 }}>
              {price.hasPrice ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="priceLg" component="p" sx={{ color: stock.sellable ? 'var(--lf-ink)' : 'var(--lf-ink-3)' }}>
                      {price.priceLabel}
                    </Typography>
                    {price.compareLabel ? (
                      <Typography variant="priceCompare" component="span">
                        {price.compareLabel}
                      </Typography>
                    ) : null}
                    {product.size ? (
                      <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                        {product.size}
                      </Typography>
                    ) : null}
                  </Box>
                  {price.showSavings ? (
                    <Typography variant="subtitle2" sx={{ color: 'var(--lf-ok-ink)', mt: 0.5 }}>
                      Save {price.savingsPercent}%
                    </Typography>
                  ) : null}
                </>
              ) : (
                <Typography variant="priceLg" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
                  Price on request
                </Typography>
              )}
            </Box>

            {/* tier 4 — availability. ONE derivation, ONE threshold. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
              <Box
                aria-hidden="true"
                sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: stock.dotColor }}
              />
              <Typography variant="body2" sx={{ color: stock.textColor, fontWeight: 600 }}>
                {stock.label}
              </Typography>
            </Box>

            {/* tier 5 — the CTA block. Add to bag is the visual primary (LF-18). */}
            {stock.sellable && price.hasPrice ? (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                  <Typography component="span" variant="subtitle2" id="lf-qty-label">
                    Quantity
                  </Typography>
                  <Box
                    role="group"
                    aria-labelledby="lf-qty-label"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px solid var(--lf-border-field)',
                      borderRadius: 'var(--lf-r-field)',
                    }}
                  >
                    <IconButton
                      onClick={() => changeQuantity(-1)}
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                      sx={{ width: 44, height: 44, borderRadius: 'var(--lf-r-field)', ...FOCUS_RING_SX }}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography component="span" className="lf-num" sx={{ minWidth: 40, textAlign: 'center' }} aria-live="polite">
                      {quantity}
                    </Typography>
                    <IconButton
                      onClick={() => changeQuantity(1)}
                      aria-label="Increase quantity"
                      disabled={quantity >= stock.maxQty}
                      sx={{ width: 44, height: 44, borderRadius: 'var(--lf-r-field)', ...FOCUS_RING_SX }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {stock.maxQty <= LOW_STOCK_THRESHOLD ? (
                    <Typography variant="caption" sx={{ color: 'var(--lf-warn-ink)' }}>
                      {`Max ${stock.maxQty} per order`}
                    </Typography>
                  ) : null}
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>{addToBagButton}</Box>
                  <IconButton
                    onClick={handleWishlist}
                    aria-pressed={saved}
                    aria-label={saved ? 'Remove from saved items' : 'Save for later'}
                    disabled={wishlistPending}
                    sx={{
                      width: 52,
                      height: 52,
                      border: '1px solid var(--lf-border-field)',
                      borderRadius: 'var(--lf-r-field)',
                      color: saved ? 'var(--lf-err-ink)' : 'var(--lf-ink-2)',
                      ...FOCUS_RING_SX,
                    }}
                  >
                    {saved ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                  </IconButton>
                </Box>

                <Button
                  className="lf-press"
                  variant="outlined"
                  fullWidth
                  onClick={() => addToBag('checkout')}
                  aria-busy={busyAction === 'buy'}
                  startIcon={
                    busyAction === 'buy' ? <CircularProgress size={16} thickness={3.6} sx={{ color: 'inherit' }} /> : null
                  }
                  sx={{ minHeight: 52, mt: 1.5, ...FOCUS_RING_SX }}
                >
                  Buy now
                </Button>
              </Box>
            ) : (
              // §6.8 #3: an unbuyable item offers a path, not a dead button. The stepper
              // and Buy now are REMOVED rather than disabled.
              <Box sx={{ mb: 2 }}>
                <Box ref={inlineCtaRef}>
                  {price.hasPrice ? (
                    <NotifyMeButton
                      slug={product.slug}
                      productName={product.name}
                      fullWidth
                      sx={{ minHeight: 52 }}
                    />
                  ) : (
                    <Button
                      className="lf-press"
                      component={RouterLink}
                      to="/contact"
                      variant="contained"
                      color="primary"
                      disableElevation
                      fullWidth
                      sx={{ minHeight: 52, ...FOCUS_RING_SX }}
                    >
                      Ask us about this product
                    </Button>
                  )}
                </Box>
                <Typography variant="caption" sx={{ display: 'block', color: 'var(--lf-ink-3)', mt: 1 }}>
                  {stock.state === 'coming_soon'
                    ? "Not on sale yet — we'll email you the moment it launches."
                    : !price.hasPrice
                      ? 'This product has no published price yet.'
                      : "Out of stock — we'll email you when it's back."}
                </Typography>
              </Box>
            )}

            {/* the outcome is always stated adjacent, never left to a colour (§6.8 #2) */}
            <Box aria-live="polite" sx={{ minHeight: 20, mb: 2 }}>
              {cartMessage ? (
                <Typography
                  variant="caption"
                  role={cartMessage.tone === 'error' ? 'alert' : undefined}
                  sx={{ color: cartMessage.tone === 'error' ? 'var(--lf-err-ink)' : 'var(--lf-ok-ink)' }}
                >
                  {cartMessage.text}{' '}
                  {cartMessage.tone === 'ok' ? (
                    <Typography component={RouterLink} to="/cart" variant="caption" sx={{ color: 'var(--lf-gold-ink)' }}>
                      View bag
                    </Typography>
                  ) : null}
                </Typography>
              ) : null}
            </Box>

            {/* tier 6 — trust / proof, each row linking to the page that proves it */}
            <Box sx={{ borderTop: '1px solid var(--lf-hairline)', pt: 2 }}>
              <TrustRow icon={<LocalShippingOutlinedIcon fontSize="small" />} text={policyCopy.shippingLabel} />
              <TrustRow
                icon={<ReplayOutlinedIcon fontSize="small" />}
                text={policyCopy.returnsShort}
                to="/shipping-returns"
              />
              <TrustRow
                icon={<PaymentsOutlinedIcon fontSize="small" />}
                text={policyCopy.codLabelFor(codAvailable)}
              />
            </Box>

            {/* tier 7 — delivery and returns: TWO labelled blocks, one source (LF-12) */}
            <Box sx={{ mt: 2, backgroundColor: 'var(--lf-surface-sunken)', borderRadius: 'var(--lf-r-panel)', p: 2 }}>
              <Typography variant="overline" sx={{ display: 'block', color: 'var(--lf-ink-3)' }}>
                Delivery
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mb: 1.5 }}>
                {policyCopy.deliveryLine}
              </Typography>

              {/* LF-11: the input the old copy asked for but never provided. */}
              <PincodeCheck
                variant="inline"
                showPolicyLine={false}
                onResult={(result) =>
                  setCodAvailable(
                    result && typeof result.cod_available === 'boolean' ? result.cod_available : null,
                  )
                }
              />

              <Box sx={{ borderTop: '1px solid var(--lf-hairline)', mt: 2, pt: 1.5 }}>
                <Typography variant="overline" sx={{ display: 'block', color: 'var(--lf-ink-3)' }}>
                  Returns
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                  {policyCopy.returnsLine}
                </Typography>
                {policyCopy.returnsExclusionsLine ? (
                  <Typography variant="caption" sx={{ display: 'block', color: 'var(--lf-ink-3)', mt: 0.5 }}>
                    {policyCopy.returnsExclusionsLine}
                  </Typography>
                ) : null}
                <Typography
                  component={RouterLink}
                  to="/shipping-returns"
                  variant="caption"
                  sx={{ display: 'inline-block', mt: 1, color: 'var(--lf-gold-ink)' }}
                >
                  Read the delivery &amp; returns policy
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ============================ tabs / accordion ============================ */}
        <Box sx={{ mb: 2 }}>
          {isDesktop ? (
            <>
              <Tabs
                value={activeTab}
                onChange={(_event, next) => setActiveTab(next)}
                aria-label="Product information"
                sx={{ borderBottom: '1px solid var(--lf-hairline)' }}
              >
                {panels.map((panel, index) => (
                  <Tab
                    key={panel.label}
                    label={panel.label}
                    id={`lf-tab-${index}`}
                    aria-controls={`lf-panel-${index}`}
                  />
                ))}
              </Tabs>
              {panels.map((panel, index) =>
                activeTab === index ? (
                  <Box
                    key={panel.label}
                    role="tabpanel"
                    id={`lf-panel-${index}`}
                    aria-labelledby={`lf-tab-${index}`}
                    sx={{ py: 3 }}
                  >
                    {panel.content}
                  </Box>
                ) : null,
              )}
            </>
          ) : (
            // Four tab labels do not fit 288px and off-screen tabs are undiscoverable
            // (DESIGN_SYSTEM §8), so mobile gets a stacked accordion.
            <Box>
              {panels.map((panel, index) => (
                <Accordion key={panel.label} defaultExpanded={index === 0} disableGutters>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
                    <Typography variant="subtitle2">{panel.label}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>{panel.content}</AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </Box>

        {/* ---------------- LF-18: Amazon, quiet, below the tabs ---------------- */}
        {product.amazon_link ? (
          <Box sx={{ mb: 6, pt: 2, borderTop: '1px solid var(--lf-hairline)' }}>
            <Typography
              component="a"
              href={product.amazon_link}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={{ color: 'var(--lf-ink-2)', ...FOCUS_RING_SX }}
            >
              Also available on Amazon
            </Typography>
            {/*
              The ONLY D2C statement we can prove from the code being shipped, built from
              policy.js so it cannot drift from the returns window.
              TODO(business): LF-18 — either align marketplace prices to D2C, or approve a
              concrete D2C benefit we can honour and state (first-order code, free
              samples, loyalty points, or an extended return window). Until one is
              approved, no price-advantage language may ship here.
            */}
            <Typography variant="caption" sx={{ display: 'block', color: 'var(--lf-ink-3)', mt: 0.5, maxWidth: '68ch' }}>
              {policyCopy.d2cAdvantage}
            </Typography>
          </Box>
        ) : null}

        <Box sx={{ mb: 6 }}>
          <RelatedProducts slug={product.slug} limit={4} />
        </Box>

        <ProductReviews
          slug={product.slug}
          summary={summary}
          onSummaryChange={setSummary}
          productName={product.name}
        />
      </Container>

      {/* ---------------- sticky mobile buy bar ---------------- */}
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
            gap: 1,
            px: 2,
            py: 1,
            pb: 'calc(8px + env(safe-area-inset-bottom, 0px))',
            boxShadow: 'var(--lf-e-bar)',
            transform: barVisible ? 'translateY(0)' : 'translateY(110%)',
            transition: 'transform var(--lf-dur-3) var(--lf-ease-out)',
            visibility: barVisible ? 'visible' : 'hidden',
          }}
        >
          <Box sx={{ minWidth: 96 }}>
            <Typography variant="price" component="p" sx={{ lineHeight: 1.2 }}>
              {price.priceLabel || 'On request'}
            </Typography>
            <Typography variant="caption" sx={{ color: stock.textColor }}>
              {stock.label}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {stock.sellable && price.hasPrice ? (
              <Button
                className="lf-press"
                variant="contained"
                color="primary"
                disableElevation
                fullWidth
                onClick={() => addToBag('stay')}
                aria-busy={cartPending}
                tabIndex={barVisible ? 0 : -1}
                sx={{ minHeight: 48, ...FOCUS_RING_SX }}
              >
                Add to bag
              </Button>
            ) : (
              <NotifyMeButton
                slug={product.slug}
                productName={product.name}
                fullWidth
                label="Notify me"
                sx={{ minHeight: 48 }}
              />
            )}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

/** One flat trust row. Links where there is a page that proves the claim. */
const TrustRow = ({ icon, text, to }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 36 }}>
    <Box aria-hidden="true" sx={{ color: 'var(--lf-ink-3)', display: 'flex' }}>
      {icon}
    </Box>
    {to ? (
      <Typography component={RouterLink} to={to} variant="body2" sx={{ color: 'var(--lf-ink-2)', ...FOCUS_RING_SX }}>
        {text}
      </Typography>
    ) : (
      <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
        {text}
      </Typography>
    )}
  </Box>
);

export default ProductDetail;
