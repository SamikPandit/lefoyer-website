/**
 * ProductCardSkeleton — the ALCOVE card at its FINAL silhouette, so nothing shifts
 * when the data lands (ART_DIRECTION.md §7.5 rule 3, P5, CLS ≤ 0.05).
 *
 * REBUILT IN THE INTEGRATION STEP. It previously drew the pre-ALCOVE card: a bordered
 * `--lf-surface` box with `p: 1.5`, a 4/5 `--lf-r-media` mat, `minHeight: 45` on the
 * title and a 44px button. Every page group flagged it, because the real card
 * (§6.2) is now:
 *
 *   1. <Alcove surface="card">   — 1 : var(--lf-arch-ratio), var(--lf-r-arch)
 *   2. 14px → the status ledge row (12px/600 uppercase + a 6px dot)
 *   3.  6px → the category eyebrow (12px)
 *   4.  2px → the product name, h4 19px, two lines clamped
 *   5.  4px → "Be the first to review" (13px)
 *   6.  2px → size (13px)
 *   7. 10px → price (17px)
 *   8. 14px → the CTA, 48px
 *
 * …borderless, no padding, no shadow, transparent background. Those are the exact
 * offsets ProductCard.jsx writes, so first paint and loaded paint are one shape.
 *
 * Shimmer split is unchanged from DESIGN_SYSTEM §6.4: the niche gets
 * `lf-skel--media` (a composited sweep), text bars get `lf-skel--text` (an opacity
 * pulse) — a travelling shimmer on a 60%-wide bar reads cheap.
 *
 * It must not appear before 220ms of waiting (`useSkeletonDelay`), and the whole
 * group is `aria-hidden` with ONE visually-hidden announcement.
 *
 * Count comes from `skeletonCount()` in components/product/productGrid.js — derived
 * from the expected payload, never hardcoded. `SKELETON_COUNT` is kept only as a
 * deprecated constant for any caller still reaching for it.
 */

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';

/**
 * DEPRECATED. §7.5 rule 3: the count is derived from the expected number of
 * products, which is what `skeletonCount()` does. Kept so no import breaks.
 */
export const SKELETON_COUNT = Object.freeze({ mobile: 4, desktop: 6 });

/** §6.4: skeletons appear only after 220ms of waiting. */
export const SKELETON_DELAY_MS = 220;

/**
 * `true` once `active` has been true for `delay` ms. Flips back to `false` immediately
 * when `active` goes false, so a fast response shows nothing at all.
 * @param {boolean} active Usually your `loading` flag.
 * @param {number} [delay=220]
 * @returns {boolean}
 */
export function useSkeletonDelay(active, delay = SKELETON_DELAY_MS) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return visible;
}

/**
 * A single text bar. `w` is a percentage of the card width, `h` the real row's
 * line box, `mt` the real card's own offset in px (not theme.spacing — §6.2's
 * rhythm is written in px and the card writes the same literals).
 */
const Bar = ({ w, h, mt = 0, radius = 'var(--lf-r-chip)' }) => (
  <Box
    className="lf-skel lf-skel--text"
    sx={{
      width: `${w}%`,
      height: h,
      mt: `${mt}px`,
      borderRadius: radius,
      backgroundColor: 'var(--lf-quiet)',
    }}
  />
);

/**
 * @param {object} props
 * @param {number} [props.count=1] How many cards to render — pass `skeletonCount(n)`.
 *   One `<>` fragment is returned, so this drops straight into `PRODUCT_GRID_SX`.
 * @param {boolean} [props.showButton=true] Reserve the 48px CTA row. Turn off only
 *   where the real card has no CTA.
 * @param {boolean} [props.announce=true] Emit one visually-hidden polite announcement
 *   for the group. Set false if the parent region already announces loading.
 * @param {string} [props.label="Loading products"] What that announcement says.
 * @param {object} [props.sx] Applied to each card.
 */
const ProductCardSkeleton = ({
  count = 1,
  showButton = true,
  announce = true,
  label = 'Loading products',
  sx,
}) => {
  const cards = Array.from({ length: Math.max(1, count) });

  return (
    <>
      {announce ? (
        <Box
          component="span"
          className="lf-sr-only"
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Box>
      ) : null}

      {cards.map((_, index) => (
        <Box
          // Skeletons are positional placeholders with no identity of their own, so
          // the index is the correct key here. (No eslint-disable: the project's lint
          // run uses --report-unused-disable-directives, and react/no-array-index-key
          // is registered but not enabled, so a directive for it would itself error.)
          key={`product-card-skeleton-${index}`}
          aria-hidden="true"
          sx={{
            // §6.2: the card is borderless, unpadded, transparent. The niche is the
            // frame; a skeleton that draws a box draws a box the card never has.
            width: '100%',
            minWidth: 0,
            ...sx,
          }}
        >
          {/* 1. The niche. The ONLY shimmering element in the card. */}
          <Box
            className="lf-skel lf-skel--media lf-skel--alcove"
            sx={{ width: '100%', backgroundColor: 'var(--lf-mat)' }}
          />

          {/* 2. 14px → the status ledge row (always rendered, §6.4). */}
          <Bar w={46} h={12} mt={14} />

          {/* 3. 6px → category eyebrow */}
          <Bar w={34} h={12} mt={6} />

          {/* 4. 2px → the name, h4 19px, two lines at 1.25 line-height = 24px each */}
          <Bar w={92} h={19} mt={2} />
          <Bar w={58} h={19} mt={5} />

          {/* 5. 4px → "Be the first to review" */}
          <Bar w={40} h={13} mt={4} />

          {/* 6. 2px → size */}
          <Bar w={26} h={13} mt={2} />

          {/* 7. 10px → price */}
          <Bar w={30} h={17} mt={10} />

          {/* 8. 14px → the CTA at the real 48px (§6.5), not 44px */}
          {showButton ? (
            <Box
              className="lf-skel lf-skel--text"
              sx={{
                width: '100%',
                height: 48,
                mt: '14px',
                borderRadius: 'var(--lf-r-field)',
                backgroundColor: 'var(--lf-quiet)',
              }}
            />
          ) : null}
        </Box>
      ))}
    </>
  );
};

export default ProductCardSkeleton;
