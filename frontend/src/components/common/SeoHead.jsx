/**
 * SeoHead — the ONLY place a page sets its title, description, canonical, social card
 * or structured data. Built on react-helmet-async (2.0.5, already installed); the
 * `<HelmetProvider>` lives in App.jsx.
 *
 * Every page gets one. A page without a SeoHead inherits index.html's defaults, which
 * is how a storefront ends up with ten URLs all titled "Le foyeR." and no canonical.
 *
 * Usage:
 *   <SeoHead title="Cleansers" description="..." canonical="/products?category=skincare" />
 *   <SeoHead title={product.name} description={...} canonical={`/products/${slug}`}
 *            image={product.image_main} jsonLd={productLd} />
 *   <SeoHead title={`Results for "${q}"`} noindex />        // thin / duplicate pages
 *
 * CANONICAL
 * Pass a path (`/products`) or an absolute URL; both are resolved against
 * `VITE_SITE_URL` (falling back to the current origin). Omit it and the current
 * pathname is used WITHOUT its query string — which is the right canonical for a
 * filtered listing, and the reason `noindex` exists for the cases where it is not.
 *
 * SOCIAL IMAGE
 * `brand.seo.ogImage` is `null` because this repo contains no share card. When it is
 * null and no `image` prop is given, the og:image/twitter:image tags are OMITTED —
 * an og:image pointing at a 404 is worse than none.
 */

import { Helmet } from 'react-helmet-async';

import { useBrand } from '../../content/brand';
import { pruneJsonLd, serializeJsonLd } from './JsonLd';

/** Configured public origin, without a trailing slash. */
const CONFIGURED_ORIGIN = String(import.meta.env?.VITE_SITE_URL || '').replace(/\/+$/, '');

function currentOrigin() {
  if (CONFIGURED_ORIGIN) return CONFIGURED_ORIGIN;
  if (typeof window !== 'undefined' && window.location) return window.location.origin;
  return '';
}

/** Resolve a path or absolute URL to an absolute URL. Returns null if unresolvable. */
export function absoluteUrl(pathOrUrl) {
  if (typeof pathOrUrl !== 'string' || !pathOrUrl.trim()) return null;
  const value = pathOrUrl.trim();
  if (/^https?:\/\//i.test(value)) return value;
  const origin = currentOrigin();
  if (!origin) return null;
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
}

function currentPath() {
  if (typeof window !== 'undefined' && window.location) return window.location.pathname;
  return '/';
}

/**
 * @param {object} props
 * @param {string} [props.title] Page title. Rendered through `brand.seo.titleTemplate`
 *   ("%s | Le foyeR.") unless `appendSiteName` is false. Omit for the home page, which
 *   should use `brand.seo.defaultTitle` verbatim.
 * @param {boolean} [props.appendSiteName=true] Set false when `title` already carries
 *   the brand name, so it is not printed twice.
 * @param {string} [props.description] Meta description. Falls back to the brand default.
 * @param {string} [props.canonical] Path or absolute URL. Defaults to the current
 *   pathname without its query string.
 * @param {string} [props.image] Social card image, path or absolute URL.
 * @param {string} [props.imageAlt] Alt text for the social card.
 * @param {boolean} [props.noindex=false] Emits `noindex, follow`. Use for search
 *   results, empty queries, filtered duplicates, cart/checkout and account pages.
 * @param {boolean} [props.nofollow=false] Adds `nofollow` to the robots directive.
 * @param {string} [props.robots] Explicit robots value; overrides noindex/nofollow.
 * @param {'website'|'product'|'article'} [props.type='website'] og:type.
 * @param {object|object[]} [props.jsonLd] Structured data, emitted into <head> as one
 *   `application/ld+json` script per object, escaped against markup injection.
 * @param {React.ReactNode} [props.children] Extra head elements, forwarded to Helmet.
 */
const SeoHead = ({
  title,
  appendSiteName = true,
  description,
  canonical,
  image,
  imageAlt,
  noindex = false,
  nofollow = false,
  robots,
  type = 'website',
  jsonLd,
  children,
}) => {
  const brand = useBrand();
  const { seo } = brand;

  const pageTitle = (() => {
    const trimmed = typeof title === 'string' ? title.trim() : '';
    if (!trimmed) return seo.defaultTitle;
    if (!appendSiteName) return trimmed;
    if (trimmed.toLowerCase().includes(seo.siteName.toLowerCase())) return trimmed;
    return seo.titleTemplate.replace('%s', trimmed);
  })();

  const metaDescription =
    (typeof description === 'string' && description.trim()) || seo.defaultDescription;

  const canonicalUrl = absoluteUrl(canonical || currentPath());
  const imageUrl = absoluteUrl(image || seo.ogImage);
  const imageAltText = imageAlt || (image ? null : seo.ogImageAlt);

  const robotsValue =
    robots ||
    (noindex || nofollow
      ? [noindex ? 'noindex' : 'index', nofollow ? 'nofollow' : 'follow'].join(', ')
      : null);

  const ldEntries = (Array.isArray(jsonLd) ? jsonLd : [jsonLd])
    .map((entry) => serializeJsonLd(pruneJsonLd(entry)))
    .filter((json) => json.length > 0);

  // No `prioritizeSeoTags`: that flag exists so a server renderer can emit SEO tags
  // ahead of everything else, and it moves the title/description/canonical/og tags out
  // of `helmet.meta` into `helmet.priority`. This app renders on the client, where
  // Helmet writes straight to the real <head> and the ordering is irrelevant, so the
  // flag only makes the output harder to reason about.
  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={metaDescription} />
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
      {robotsValue ? <meta name="robots" content={robotsValue} /> : null}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={seo.siteName} />
      <meta property="og:locale" content={seo.locale} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={metaDescription} />
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
      {imageUrl ? <meta property="og:image" content={imageUrl} /> : null}
      {imageUrl && imageAltText ? (
        <meta property="og:image:alt" content={imageAltText} />
      ) : null}

      {/* Twitter: a card with no image must be `summary`, or the card renders blank. */}
      <meta name="twitter:card" content={imageUrl ? seo.twitterCard : 'summary'} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={metaDescription} />
      {imageUrl ? <meta name="twitter:image" content={imageUrl} /> : null}

      {/* Helmet writes a script child as innerHTML, so the escaping done by
          serializeJsonLd is what keeps a product name from closing the tag. */}
      {ldEntries.map((json, index) => (
        <script key={`seo-ld-${index}`} type="application/ld+json">
          {json}
        </script>
      ))}

      {children}
    </Helmet>
  );
};

export default SeoHead;
