/**
 * ============================================================================
 * ② THE HEARTH — ART_DIRECTION.md §5.1② / §2.2 / §2.7 / §3.5.
 *
 * MOVED FROM SECTION 6 TO SECTION 2. The brand's single warm moment used to
 * sit ~2,400px down, on section 6 of 8, printing a sentence the page had
 * already printed twice. §2.2: A RATIONED RESOURCE SPENT WHERE NOBODY LOOKS
 * IS NOT RATIONED, IT IS WASTED. At position 2 it lands while people are
 * still reading, and it gives the page its one hard contrast of scale — lit
 * niche, then dark hearth — which is the structural fix for four consecutive
 * sections being the same module.
 *
 * Full-bleed `.lf-hearth-section` (§3.5): the fire is in the bottom-left
 * corner and the light falls up and right across the band. Every token is
 * redefined inside that class with every ratio re-measured across the ENTIRE
 * gradient, so nothing in here overrides a colour by hand.
 *
 * FRAUNCES LICENCE 2 OF 3 (§2.2, §10.6). `brandDisplay` at 44px rendering
 * `brand.territoryLine` is this page's ENTIRE serif budget. The other two
 * licences are the nav wordmark and the footer wordmark, both owned elsewhere.
 * A fourth use is a regression against an explicit owner decision.
 *
 * NO LEDGE IN THIS SECTION. §3.3 caps the page at four: hero, shelf, evidence,
 * footer. This band gets its separation from the inversion itself.
 *
 * LF-25 IS PRESERVED IN FULL. This is still the one admin-driven slot on the
 * homepage: `listHomeSections()` is server-filtered to
 * `is_active AND starts_at <= now <= ends_at`, so a campaign starts and
 * retires on a date in the admin with no deploy. What changed is the
 * composition it renders into, and that the slot no longer paints a raw
 * `<img>`: §7.3 makes `<ProductImage>` the only thing on the site that writes
 * an `<img>`, and §5.1②'s hearth band is type and one button. An admin image
 * on a `HomeSection` therefore no longer renders here — reported, because it
 * is a capability this file used to have.
 *
 * THE BODY LINE (§5.1②: "one new line of body copy that is not
 * `positioningStatement`"). `brand.js` carries no such line, and inventing
 * marketing copy inside a component is the harder rule to break — it is how an
 * unevidenced strapline reached the homepage in the first place. So the
 * fallback renders `positioningStatement`'s FIRST sentence only: the
 * etymology, which is what §5.1② objects to losing and which appears nowhere
 * else on the new homepage. Its second sentence — the one that is the hero
 * subhead verbatim, and the actual complaint — is dropped. Reported.
 * ========================================================================== */

import { useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import { useBrand } from '../../content/brand';
import { listHomeSections } from '../../services/api';

/** The kinds that belong in this slot. `content.HomeSection.KIND_CHOICES` has
 *  no `campaign` member today; it stays in the set so that adding the choice
 *  later needs no frontend change. */
const SLOT_KINDS = ['campaign', 'banner', 'editorial'];

/** An in-app path routes client-side; anything else is left to the browser. */
const isInternal = (target) => typeof target === 'string' && target.startsWith('/');

/**
 * The first sentence of a brand paragraph. The wordmark is `Le foyeR.` — it
 * ENDS IN A FULL STOP — so a naive split on ". " cuts the brand's own name in
 * half. It is peeled off before the sentence boundary is looked for.
 * @param {string} statement
 * @param {string} wordmark
 * @returns {string}
 */
export function firstSentence(statement, wordmark) {
  if (typeof statement !== 'string' || !statement.trim()) return '';
  const mark = typeof wordmark === 'string' && wordmark ? wordmark : '';
  const head = mark && statement.startsWith(mark) ? mark : '';
  const rest = statement.slice(head.length);
  const match = rest.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (match ? `${head}${match[0]}` : statement).trim();
}

const CampaignSlot = () => {
  const brand = useBrand();
  const [section, setSection] = useState(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;

    listHomeSections()
      .then(({ items }) => {
        if (!alive) return;
        const candidates = (items || [])
          .filter((item) => SLOT_KINDS.includes(item.kind))
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        setSection(candidates[0] || null);
        setResolved(true);
      })
      .catch(() => {
        /* A decorative slot does not get an error panel: the evergreen band
           below is a complete, honest module in its own right. */
        if (!alive) return;
        setSection(null);
        setResolved(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  /* Nothing renders until the request settles. Showing the evergreen band
     first and then swapping in a campaign headline would rewrite a heading
     under the reader, and this band is the page's second section — a layout
     shift here is charged straight to CLS (P5). */
  if (!resolved) return null;

  const eyebrow = section && section.subtitle ? section.subtitle : null;
  const heading = section && section.title ? section.title : brand.territoryLine;
  const body =
    section && section.body
      ? section.body
      : firstSentence(brand.positioningStatement, brand.wordmark);
  const ctaLabel = section && section.cta_label ? section.cta_label : 'Shop all products';
  const ctaTarget = section && section.cta_target ? section.cta_target : '/products';

  const ctaProps = isInternal(ctaTarget)
    ? { component: RouterLink, to: ctaTarget }
    : { component: 'a', href: ctaTarget, rel: 'noopener' };

  return (
    <Box
      component="section"
      className="lf-hearth-section"
      aria-labelledby="home-hearth-heading"
      sx={{ py: 'var(--lf-sect-lg)' }}
    >
      <Container>
        {/* Left-aligned, 56ch measure (§5.1②). */}
        <Box sx={{ maxWidth: '56ch', minWidth: 0 }}>
          {eyebrow ? (
            <Typography variant="eyebrow" sx={{ mb: 'var(--lf-2)' }}>
              {eyebrow}
            </Typography>
          ) : null}

          <Typography id="home-hearth-heading" variant="brandDisplay" component="h2">
            {heading}
          </Typography>

          {body ? (
            <Typography variant="body1" component="p" sx={{ mt: '20px', color: 'var(--lf-ink-2)' }}>
              {body}
            </Typography>
          ) : null}

          {/* A GHOST BUTTON (§5.1②): --lf-ink label, which the class has
              already inverted to #FBF4E8 at 16.59:1, a 1px --lf-gold-edge
              boundary (5.10:1 on the band, 3.19:1 at the glow's brightest
              point — SC 1.4.11 holds across the whole gradient), and the
              #E3C78C focus ring the class supplies as --lf-focus. */}
          <Button
            {...ctaProps}
            variant="outlined"
            className="lf-press"
            sx={{
              mt: '28px',
              minHeight: 52,
              px: 'var(--lf-6)',
              borderColor: 'var(--lf-gold-edge)',
              '@media (hover:hover)': {
                '&:hover': { borderColor: 'var(--lf-gold-edge)' },
              },
            }}
          >
            {ctaLabel}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default CampaignSlot;
