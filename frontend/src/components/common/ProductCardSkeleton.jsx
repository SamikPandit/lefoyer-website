/**
 * ProductCardSkeleton — a ProductCard at its FINAL dimensions, so nothing shifts when
 * the data lands.
 *
 * DESIGN_SYSTEM §6.4, encoded here so no caller has to remember it:
 *   - media block gets `lf-skel--media` (a composited shimmer sweep); text bars get
 *     `lf-skel--text` (an opacity pulse). A travelling shimmer on a 60%-wide text bar
 *     reads cheap, which is why they are two different animations.
 *   - bar widths are 60 / 90 / 40 / 70 / 50 %, matching the real card's rows.
 *   - the title block keeps the real card's `min-height: 45px`, so prices align across
 *     a grid row both before and after loading.
 *   - the whole thing is `aria-hidden`, with ONE visually-hidden live announcement for
 *     the group — not one per skeleton.
 *   - it must not appear before 220ms of waiting. Use `useSkeletonDelay` for that; a
 *     120ms flash of shimmer reads as a bug.
 *   - count matches what actually fits: 6 on desktop, 4 on mobile. `SKELETON_COUNT`
 *     carries those numbers.
 *
 * Usage:
 *   const showSkeletons = useSkeletonDelay(loading);
 *   ...
 *   {showSkeletons && <ProductCardSkeleton count={isMobile ? 4 : 6} />}
 *
 * The parent owns the grid and `aria-busy`:
 *   <Box aria-busy={loading} sx={{ display:'grid',
 *        gridTemplateColumns:'repeat(auto-fill, minmax(156px, 1fr))', gap: 1.5 }}>
 */

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';

/** §6.4: "6 on desktop, 4 on mobile — not 9 shimmering elements." */
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

/** A single text bar. `w` is a percentage of the card width. */
const Bar = ({ w, h = 12, mt = 0, radius = 'var(--lf-r-chip, 6px)' }) => (
  <Box
    className="lf-skel lf-skel--text"
    sx={{
      width: `${w}%`,
      height: h,
      mt,
      borderRadius: radius,
      // Fallback so the bar is visible even before index.css lands.
      backgroundColor: 'var(--lf-surface-quiet, #F0ECE6)',
    }}
  />
);

const ASPECTS = { '1x1': '1 / 1', '4x5': '4 / 5' };

/**
 * @param {object} props
 * @param {number} [props.count=1] How many cards to render. One `<>` fragment is
 *   returned, so this drops straight into your existing grid container.
 * @param {'1x1'|'4x5'} [props.aspect='1x1'] Must match the real card's mat.
 * @param {boolean} [props.showButton=true] Reserve the 44px Add to Bag row. Turn off
 *   only where the real card has no button (a compact search row, for example).
 * @param {boolean} [props.announce=true] Emit one visually-hidden polite announcement
 *   for the group. Set false if the parent region already announces loading.
 * @param {string} [props.label="Loading products"] What that announcement says.
 * @param {object} [props.sx] Applied to each card.
 */
const ProductCardSkeleton = ({
  count = 1,
  aspect = '1x1',
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
            width: '100%',
            minWidth: 0,
            backgroundColor: 'var(--lf-surface, #FFFFFF)',
            border: '1px solid var(--lf-hairline, #E7E0D6)',
            borderRadius: 'var(--lf-r-card, 14px)',
            overflow: 'hidden',
            p: 1.5,
            ...sx,
          }}
        >
          {/* Media mat — the only shimmering element in the card. */}
          <Box
            className="lf-skel lf-skel--media"
            sx={{
              width: '100%',
              aspectRatio: ASPECTS[aspect] || ASPECTS['1x1'],
              borderRadius: 'var(--lf-r-media, 24px)',
              backgroundColor: 'var(--lf-surface-quiet, #F0ECE6)',
            }}
          />

          {/* category overline */}
          <Bar w={60} h={10} mt={1.5} />

          {/* title: two lines, held at the real card's min-height so prices align */}
          <Box sx={{ minHeight: 45, mt: 1 }}>
            <Bar w={90} h={13} />
            <Bar w={40} h={13} mt={0.75} />
          </Box>

          {/* price */}
          <Bar w={70} h={18} mt={1} />

          {/* stock pill */}
          <Bar w={50} h={12} mt={1} radius="var(--lf-r-pill, 999px)" />

          {showButton ? (
            <Box
              className="lf-skel lf-skel--text"
              sx={{
                width: '100%',
                height: 44,
                mt: 1.5,
                borderRadius: 'var(--lf-r-field, 10px)',
                backgroundColor: 'var(--lf-surface-quiet, #F0ECE6)',
              }}
            />
          ) : null}
        </Box>
      ))}
    </>
  );
};

export default ProductCardSkeleton;
