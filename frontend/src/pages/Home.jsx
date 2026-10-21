/**
 * ============================================================================
 * Home — ART_DIRECTION.md §5.1. FIVE SECTIONS, ~2,250px at 1440.
 *
 * WAS: eight visible sections and ~3,200px, of which the first ~1,400px
 * contained no product a shopper could buy —
 *   a 38s infinite auto-scroll claims rail (WCAG 2.2.2) printing four strings
 *   the page printed again 2,000px below · a 406px text-only hero with ZERO
 *   imagery · a category grid whose tiles rendered each category's name as
 *   giant grey placeholder artwork AND THEN AGAIN as the real label, which was
 *   the only state that ever shipped because `Category` has no image field ·
 *   the same navigation a second time as "concerns", which migration
 *   `products/0008` derives 1:1 from sub-categories · a "Curated Essentials"
 *   rail with a permanently empty third slot · the brand's one warm moment
 *   stranded at section 6 · a second, incompatible 240px circular card
 *   language · four bordered claim cards · and a second newsletter.
 *
 * NOW (§5.1):
 *   ① <Hero>          the lit alcove — a real photograph in a real niche with
 *                     a real transaction above the fold
 *   ② <CampaignSlot>  THE HEARTH, moved from section 6 to section 2
 *   ③ <Shelf>         all six products, the fold-breaker, §4's grid, one card
 *   ④ <Evidence>      the claims, once, flat, no cards
 *   ⑤ the footer, which `Layout` owns
 *
 * ONE CATALOGUE REQUEST FOR THE WHOLE PAGE. The hero frame and the shelf are
 * the same six rows: a second `featured`/`bestsellers` round trip would add a
 * serialised RTT in front of the LCP element on exactly the connection P4
 * budgets for (mid-range Android, Fast 3G, ≤2.5s). The hero takes "the
 * bestseller, in stock" FROM THAT PAYLOAD (§5.1①) — §5.1① names UV Armor
 * Tinted Sunscreen, but §10.21 forbids typing a product name, size, price or
 * stock state into a component, and the brief that produced the art direction
 * miscalled that very SKU a sunscreen when the live API says The Daily
 * Invisible Moisturizer. The merchandising flag is the honest derivation; it
 * also keeps LF-20 true, because flipping `is_bestseller` in the admin moves
 * the hero with no deploy.
 *
 * LF-26 / C-29 is untouched: `SeoHead` still gives this page its title,
 * description and canonical plus `Organization` and `WebSite` JSON-LD
 * serialised through `JsonLd.jsx`. No `aggregateRating` anywhere, on any
 * surface, ever (§10.9) — all six products have zero `Review` rows.
 *
 * LF-24's category and concern grids are DELETED, not relocated: §1.3 moves
 * that navigation to the shelf itself and to the PLP toolbar chips. With six
 * products and two categories, the shelf IS the navigation, and §7.5 rule 2
 * is now structurally unbreakable here because nothing on this page renders a
 * tile at all. The `concern` and `sub_category` URL params stay supported by
 * the listing.
 *
 * `CustomerTestimonials` is no longer in the render list (§1.3). The component
 * is correct and is kept: it returns `null` at zero `Review` rows, which is
 * every row today, so keeping it mounted only made the list lie. It comes back
 * when real reviews exist.
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';

import SeoHead, { absoluteUrl } from '../components/common/SeoHead';
import CampaignSlot from '../components/home/CampaignSlot';
import Evidence from '../components/home/Evidence';
import Hero from '../components/home/Hero';
import Shelf from '../components/home/Shelf';
import { hasPrice } from '../components/product/PriceBlock';
import { PRODUCT_PAGE_SIZE } from '../components/product/productPresentation';
import { useBrand } from '../content/brand';
import { useCart } from '../context/CartContext';
import { listProducts } from '../services/api';
import { stockState } from '../utils/stock';

/**
 * THE HERO FRAME (§5.1①): "the bestseller, in stock". Derived from the
 * payload, never from a slug typed into a component (§10.21). A product with
 * no usable price cannot carry a purchase card (§6.3), so it is not eligible.
 *
 * @param {object[]} products
 * @returns {object|null}
 */
export function pickHeroProduct(products) {
  const eligible = (products || []).filter(
    (product) => product && stockState(product).sellable && hasPrice(product),
  );
  return eligible.find((product) => product.is_bestseller === true) || eligible[0] || null;
}

const Home = () => {
  const brand = useBrand();
  const { cart } = useCart();
  const siteUrl = absoluteUrl('/');

  /** 'loading' | 'ready' | 'empty' | 'error' */
  const [status, setStatus] = useState('loading');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    setStatus('loading');
    setError(null);

    /* The whole catalogue, in the server's own order. In-stock-first is a
       PRESENTATION decision (§2.23) and is applied in <Shelf>, so the
       merchandising order inside each group survives (LF-20). */
    listProducts({ page_size: PRODUCT_PAGE_SIZE })
      .then(({ items }) => {
        if (!aliveRef.current) return;
        const list = items || [];
        setProducts(list);
        setStatus(list.length === 0 ? 'empty' : 'ready');
      })
      .catch((requestError) => {
        if (!aliveRef.current) return;
        setError(requestError);
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const heroProduct = status === 'ready' ? pickHeroProduct(products) : null;
  const bagProductIds = (cart?.items || []).map((item) => item.id);

  /* Only fields we can actually evidence: no logo (this repo ships no brand
     mark asset), no telephone (`brand.support.phone` is null and inventing one
     is forbidden), no founding date, no address. `pruneJsonLd` drops the nulls
     before serialisation. */
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.seo.siteName,
    legalName: brand.legalName,
    url: siteUrl,
    description: brand.positioningStatement,
    sameAs: brand.social.instagram ? [brand.social.instagram] : undefined,
    contactPoint: brand.support.email
      ? {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: brand.support.email,
          availableLanguage: ['en'],
        }
      : undefined,
  };

  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand.seo.siteName,
    url: siteUrl,
    inLanguage: 'en-IN',
    publisher: { '@type': 'Organization', name: brand.seo.siteName, url: siteUrl },
    potentialAction: siteUrl
      ? {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl.replace(/\/+$/, '')}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        }
      : undefined,
  };

  return (
    <>
      <SeoHead
        title={brand.seo.defaultTitle}
        appendSiteName={false}
        description={brand.seo.defaultDescription}
        canonical="/"
        jsonLd={[organizationLd, websiteLd]}
      />

      <Hero product={heroProduct} status={status} />
      <CampaignSlot />
      <Shelf
        products={products}
        status={status}
        error={error}
        onRetry={load}
        bagProductIds={bagProductIds}
      />
      <Evidence />
    </>
  );
};

export default Home;
