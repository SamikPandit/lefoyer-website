/**
 * ============================================================================
 * <Alcove> — ART_DIRECTION.md §6.1 / §2.30 / §3.10
 *
 * THE BRAND, AS A COMPONENT.
 *
 * Le foyeR. is French for the hearth, and a hearth is not an adjective — it is
 * an arched opening in a wall with light falling out of it. One shallow
 * segmental niche, cut into warm paper, lit from the upper left, with a warm
 * shade pooling at its foot. The SAME niche holds a 72px footer thumbnail and
 * a 490px hero photograph, so tapping a product on the shelf opens it into a
 * larger version of the exact frame it was standing in.
 *
 * THE ONE RULE THIS COMPONENT EXISTS TO ENFORCE:
 *
 *     The arch is not a mask on the photograph.
 *     The arch is the NICHE the photograph stands in.
 *
 * All nineteen masters were decoded before this was designed (§1.2): they are
 * RGB with no alpha, only 3 of 19 are centred packshots, sixteen run to 96–99%
 * of frame width, and the grounds include cyan #9DE1E7, deep blue #134F85 and
 * pink #F6A5C8. So `contain` on a warm mat paints a cyan rectangle inside a
 * warm arch; `cover` into a 4/5 arch cuts the subject; a cream wash turns cyan
 * to sage. The resolution is none of those: the photograph is rendered 1:1
 * from a 1:1 master — `cover` therefore crops EXACTLY NOTHING — inset at the
 * foot of a taller arched niche, and THE HEARTH LIGHT AND THE FOOT-SHADE ARE
 * PAINTED ON THE NICHE WALL, NEVER ON THE PHOTOGRAPH. A cyan photograph stays
 * cyan; the warm light falls on the wall around it, which is also what light
 * physically does.
 *
 * Everything visual lives in `.lf-alcove` in index.css (§3.10): two STATIC
 * gradients, a percentage radius and a box-shadow. No backdrop-filter, no
 * filter(), no blur — legal inside a scrolling list under §9.4 and free on a
 * mid-range Android. Because the radii are percentages the proportion holds
 * identically at every size with no breakpoint maths: at any niche width W,
 * height is 1.18W, the photograph is 0.86W square and the dome zone is 0.26W.
 *
 * NO PAGE COMPOSES A NICHE BY HAND (§2.30). Borderless product cards lean
 * entirely on the niche for grouping, so a surface must not be able to render
 * a product without its frame.
 *
 * OUT OF STOCK (§2.11, §10.13): the light goes out, the niche does not, and
 * the photograph is untouched. No greyscale, no opacity drop, no desaturation,
 * no diagonal ribbon. The wall goes --lf-mat → --lf-mat-deep and its
 * hearth-light gradient is replaced by the foot-shade alone. The photograph is
 * what creates desire, and dimming it is how a shop tells you not to want
 * something.
 * ========================================================================== */

import ProductImage from './ProductImage';
import { productImages } from '../product/productPresentation';

/**
 * `--lf-alcove-max` is a HEIGHT cap; `.lf-alcove` divides it by the locked
 * --lf-arch-ratio to get the niche's inline size. The per-surface values live
 * in index.css §6 so a page cannot override the brand's proportions:
 *   card  340px below the `shelf` breakpoint (340 ÷ 1.18 = 288 = --lf-card-min),
 *         uncapped at 2-up and 3-up
 *   hero  clamp(420px, 64svh, 660px)
 *   pdp   min(74vh, 640px)
 *   thumb 72px · row 88px
 */
const SURFACES = ['card', 'hero', 'pdp', 'thumb', 'row'];

/**
 * @param {object}  props
 * @param {object}  [props.product]  The API payload — alt text and the frames.
 * @param {'card'|'hero'|'pdp'|'thumb'|'row'} [props.surface='card']
 *   Sets --lf-alcove-max and the <ProductImage> `sizes` string.
 * @param {boolean} [props.priority=false]
 *   true → fetchpriority="high" + loading="eager" + a preload link.
 *   The home hero and the PDP's FRAME 1 ONLY (§7.4). Never a card.
 * @param {number}  [props.frame=0]  Which image of `productImages(product)`.
 * @param {'in'|'low'|'out'|'coming_soon'} [props.stock]
 *   Optional. Lights or unlights the niche. OMIT IT inside <ProductCard>:
 *   §6.2's `<article data-stock>` is an ancestor and index.css matches it, so
 *   the single derivation in `stockState()` stays single (§6.4). Pass it on
 *   surfaces with no card ancestor — hero, PDP stage, footer row, cart line.
 * @param {string}  [props.alt]      Overrides the composed alt.
 * @param {React.ReactNode} [props.children]
 *   Painted INSIDE the niche, above the photograph — the wishlist heart at the
 *   niche's bottom-right (§6.2 item 1). Never a badge: the status ledge is a
 *   full-width row BENEATH the niche, which is what makes the
 *   badge/heart collision structurally impossible at any card width (§2.14).
 * @param {string}  [props.className]
 * @param {object}  [props.style]
 * @returns {JSX.Element}
 */
export default function Alcove({
  product = null,
  surface = 'card',
  priority = false,
  frame = 0,
  stock,
  alt,
  children = null,
  className,
  style,
  ...rest
}) {
  const safeSurface = SURFACES.includes(surface) ? surface : 'card';

  /* §7.5 rule 2: a product with no photograph gets an empty lit shelf, not a
     broken src and not its own name rendered as placeholder artwork. The flag
     lives on the photograph box so the CSS can style the empty state without
     a :has() selector. */
  const hasPhotograph = Boolean(productImages(product)[frame]);

  return (
    <div
      className={className ? `lf-alcove ${className}` : 'lf-alcove'}
      data-surface={safeSurface}
      {...(stock ? { 'data-stock': stock } : null)}
      style={style}
      {...rest}
    >
      {/* `.lf-alcove::before` paints the hearth light on THIS element — the
          wall — and sits at z-index 0, below the photograph at z-index 1. */}
      <div className="lf-alcove-img" data-empty={hasPhotograph ? undefined : 'true'}>
        <ProductImage
          product={product}
          frame={frame}
          surface={safeSurface}
          priority={priority}
          alt={alt}
        />
      </div>
      {children}
    </div>
  );
}
