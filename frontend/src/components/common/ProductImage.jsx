/**
 * ============================================================================
 * <ProductImage> — ART_DIRECTION.md §7.3
 *
 * THE ONLY THING IN THE CODEBASE THAT WRITES AN <img>.
 *
 * Before this component, `grep -rn "srcset\|srcSet\|<picture\|webp\|avif"
 * frontend/src` returned ZERO hits while the masters ran 1.18–6.12 MB and
 * `ProductDetail.jsx:702` loaded full-resolution sources into 72px thumbnail
 * buttons. A PLP shipped ~30 MB to render six 161px thumbnails. Six cards at
 * 480w AVIF now measure ~90 KB in total (P2 budget: 400 KB).
 *
 * WHAT IT GUARANTEES (A13, P5, P1):
 *   · <picture> with AVIF → WebP → JPEG, so an old Android still gets a photo.
 *   · srcset + the §7.3 `sizes` string for the surface, so a 72px thumbnail
 *     downloads a 160px file and not a 2048px one.
 *   · explicit width/height, so layout is reserved before the bytes land.
 *   · a COMPOSED alt — "{name}, {size}" from the API payload. Never
 *     "Product 3", and never a product name typed into a component (§10.21).
 *   · loading="lazy" by default; `priority` gives eager + fetchpriority="high"
 *     + a <link rel="preload"> — the hero frame and the PDP's first frame ONLY.
 *   · a REAL fallback when a product has no image: an empty lit shelf, never a
 *     broken src, and never the product's own name rendered as placeholder
 *     artwork (§7.5 rule 2 — that bug shipped once already).
 *
 * WHY THE DERIVATIVE LOOKUP IS A GENERATED MAP, NOT A CONVENTION:
 *   Inside <picture> a browser commits to the first <source> whose type it
 *   supports; a 404 there is a broken image, not a fallback to the next
 *   source. Product images are served from the API's /media/, and only the
 *   masters checked into public/images/products have derivatives. So the
 *   component asks `src/generated/derivedImages.js` (written by
 *   scripts/optimize-images.mjs) whether this exact file was derived, and
 *   renders a plain <img> at the original URL when it was not.
 *
 * NEVER tint, wash, overlay, grey or hue-shift the photograph (§1.2, §10.2,
 * §10.13). The hearth light is painted on the NICHE WALL by <Alcove>. The
 * grounds of the 19 masters include cyan #9DE1E7, deep blue #134F85 and pink
 * #F6A5C8; a warm wash over them produces mud, and dimming an out-of-stock
 * photograph is how a shop tells you not to want something.
 * ========================================================================== */

import { Helmet } from 'react-helmet-async';
import derivedImages, { DERIVED_BASE } from '../../generated/derivedImages';
import { productAlt, productImages } from '../product/productPresentation';

/* -- §7.3's table, verbatim. These are the only `sizes` strings on the site. */
export const SIZES = {
  card:  '(min-width:1200px) 384px, (min-width:680px) 348px, calc(100vw - 32px)',
  hero:  '(min-width:900px) 560px, calc(100vw - 32px)',
  pdp:   '(min-width:900px) 640px, calc(100vw - 32px)',
  thumb: '72px',
  row:   '88px',
};

/* -- §7.4's "Derivative" column. The browser still picks using `sizes`; this
      only keeps a 1600px file out of a 72px button's candidate list. */
const CANDIDATE_WIDTHS = {
  card:  [320, 480, 640, 960],
  hero:  [480, 640, 960, 1280, 1600],
  pdp:   [480, 640, 960, 1280, 1600],
  thumb: [160, 320],
  row:   [160, 320],
};

/* -- The nominal CSS box per surface, used for the width/height attributes so
      layout is reserved at the right aspect before any CSS or bytes arrive.
      Every niche photograph is 1:1 — the masters are 1:1, so `cover` crops
      nothing (§1.2) — hence square. */
const NOMINAL = { card: 384, hero: 560, pdp: 640, thumb: 72, row: 88 };

/** The master's basename stem: "/media/products/UVArmor.png?v=2" → "UVArmor". */
function stemOf(src) {
  if (typeof src !== 'string' || !src) return null;
  const withoutQuery = src.split('#')[0].split('?')[0];
  const base = withoutQuery.substring(withoutQuery.lastIndexOf('/') + 1);
  if (!base) return null;
  let decoded = base;
  try {
    decoded = decodeURIComponent(base);
  } catch {
    /* a malformed escape sequence is still a usable file name */
  }
  const dot = decoded.lastIndexOf('.');
  return dot > 0 ? decoded.slice(0, dot) : decoded;
}

function srcSetFor(base, stem, widths, ext) {
  if (!widths || widths.length === 0) return null;
  return widths.map((w) => `${base}${stem}-${w}.${ext} ${w}w`).join(', ');
}

/* -- Where a stem's derivatives live ------------------------------------------
   TWO sources, one shape, so there is exactly one rendering path below.

     1. `src/generated/derivedImages.js` — written at build time by
        scripts/optimize-images.mjs from the masters committed to the repo.
     2. `product.derived_images` — sent by the API, written by the server's
        `manage.py optimize_media` (backend/products/derived_images.py).

   Source 2 exists because source 1 structurally cannot reach the files that
   matter. A Vite build only ever sees the repo, and only two of the six live
   products are served from it; the other four are uploads in Django's
   MEDIA_ROOT. Measured before this existed: those four were 2.27 MB of the
   listing's weight, the PDP's 72px thumbnail rail pulled eight full-resolution
   masters for 4.88 MB, and LCP on a throttled mid-range Android was 9.7-14.2 s
   because the LCP element was always a raw /media/ master.

   Build-time wins a tie: it is same-origin with the document and immutable. */
function resolveDerived(stem, apiMap) {
  if (!stem) return null;
  const local = derivedImages[stem];
  if (local) return { entry: local, base: DERIVED_BASE };
  const remote = apiMap && apiMap.images ? apiMap.images[stem] : null;
  if (remote && apiMap.base) return { entry: remote, base: apiMap.base };
  return null;
}

/**
 * @param {object}  props
 * @param {object}  [props.product]   The API payload. Supplies the composed alt.
 * @param {number}  [props.frame=0]   Which image of `productImages(product)`.
 * @param {string}  [props.src]       An explicit URL, when there is no product
 *                                    (e.g. an already-resolved PDP thumbnail).
 * @param {string}  [props.alt]       Overrides the composed alt. Pass `alt=""`
 *                                    only when an adjacent label already names
 *                                    the product.
 * @param {'card'|'hero'|'pdp'|'thumb'|'row'} [props.surface='card']
 * @param {boolean} [props.priority=false] Hero frame / PDP frame 1 ONLY.
 * @param {boolean} [props.preload]   Defaults to `priority`. Set false to take
 *                                    the eager fetch without the <head> link.
 * @param {string}  [props.className]
 * @param {object}  [props.style]
 * @returns {JSX.Element}
 */
export default function ProductImage({
  product = null,
  frame = 0,
  derivedMap = null,
  src: srcProp = null,
  alt: altProp,
  surface = 'card',
  priority = false,
  preload,
  className,
  style,
  ...rest
}) {
  const sizes = SIZES[surface] || SIZES.card;
  const nominal = NOMINAL[surface] || NOMINAL.card;

  const frames = product ? productImages(product) : [];
  const src = srcProp || frames[frame] || null;

  /* The composed alt. `productAlt` builds "{name}, {size}" from the payload
     and numbers later frames; it never invents a name (§10.21). */
  const alt = typeof altProp === 'string'
    ? altProp
    : (product ? productAlt(product, frame) : '');

  /* ---- No image at all --------------------------------------------------
     §7.5 rule 2, binding on every future tile: a surface with no image never
     renders its own name as placeholder artwork and never renders that name
     twice. The niche still draws — it is the brand — but it holds an empty
     shelf. The accessible name survives for screen readers; nothing visible
     is invented and no `src` is emitted, so nothing can 404. */
  if (!src) {
    return (
      <div
        className={className}
        style={{ width: '100%', height: '100%', ...style }}
        data-empty="true"
        {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': 'true' })}
        {...rest}
      />
    );
  }

  const stem = stemOf(src);
  const resolved = resolveDerived(stem, derivedMap || (product ? product.derived_images : null));
  const derived = resolved ? resolved.entry : null;
  const base = resolved ? resolved.base : DERIVED_BASE;

  const imgProps = {
    alt,
    width: derived ? derived.w : nominal,
    height: derived ? derived.h : nominal,
    decoding: 'async',
    loading: priority ? 'eager' : 'lazy',
    /* lowercase deliberately: React 18.2 passes an all-lowercase unknown
       attribute straight through, where the camelCase spelling would warn. */
    fetchpriority: priority ? 'high' : 'auto',
    className,
    style,
    ...rest,
  };

  /* ---- Not derived: a remote /media/ file we cannot pre-encode ----------
     One honest <img>. No <source> is emitted, because a <source> pointing at
     a derivative that does not exist is a broken image, not a fallback. */
  if (!derived) {
    return <img src={src} {...imgProps} />;
  }

  const wanted = CANDIDATE_WIDTHS[surface] || CANDIDATE_WIDTHS.card;
  const avifWidths = derived.avif.filter((w) => wanted.includes(w));
  const webpWidths = derived.webp.filter((w) => wanted.includes(w));
  /* A master smaller than every candidate width (three are 1024²) still needs
     a source: fall back to every width it does have. */
  const avif = srcSetFor(base, stem, avifWidths.length ? avifWidths : derived.avif, 'avif');
  const webp = srcSetFor(base, stem, webpWidths.length ? webpWidths : derived.webp, 'webp');
  /* The server emits a JPEG only at its own fallback rung, so trust `derived.jpg`
     rather than assuming a width. When the server could not write one, the
     original upload is still a correct <img src> — never a 404. */
  const jpeg = derived.jpg ? `${base}${stem}-${derived.jpg}.jpg` : src;

  const shouldPreload = preload === undefined ? priority : preload;
  const preloadWidth = avifWidths[1] || avifWidths[0] || derived.avif[0] || derived.webp[0];
  const preloadType = derived.avif.length ? 'avif' : 'webp';
  const preloadHref = `${base}${stem}-${preloadWidth}.${preloadType}`;

  return (
    <>
      {shouldPreload && (avif || webp) ? (
        <Helmet>
          {/* §7.3: a preload on THE HERO FRAME ONLY. AVIF is preloaded rather
              than the <picture> as a whole, because `type` lets a browser
              without AVIF skip the hint instead of double-fetching. */}
          <link
            rel="preload"
            as="image"
            type={`image/${preloadType}`}
            href={preloadHref}
            imagesrcset={avif}
            imagesizes={sizes}
            fetchpriority="high"
          />
        </Helmet>
      ) : null}
      <picture>
        {avif ? <source type="image/avif" srcSet={avif} sizes={sizes} /> : null}
        {webp ? <source type="image/webp" srcSet={webp} sizes={sizes} /> : null}
        <img src={jpeg} {...imgProps} />
      </picture>
    </>
  );
}
