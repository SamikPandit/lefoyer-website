/**
 * Marquee — the claims strip above the hero.
 *
 * LF-05: the four hardcoded strings are gone. The strip renders
 * `substantiatedClaims()` and nothing else, so an unevidenced claim cannot
 * reach the page and a claim switched back on in the admin appears here with no
 * code change. The old laboratory-testing string is withdrawn (claims.js
 * `lab-study-tested`), so it no longer renders anywhere.
 *
 * MOTION, LF-26 / WCAG 2.2.2: the old strip auto-scrolled for 30s with pause
 * available on hover only — unreachable on touch, which is most of this store's
 * traffic. Now:
 *   - under `prefers-reduced-motion: reduce` the strip renders STATIC, centred,
 *     with no animation and no control (nothing is moving to pause);
 *   - otherwise there is a real, visible, keyboard-reachable Pause/Play button;
 *   - the travelling copy is `aria-hidden`, and the claims are also exposed once
 *     as a plain visually-hidden list so assistive tech reads each claim once.
 *
 * `--lf-gold` is a NON-TEXT token (2.17:1); the dot uses it, the type uses
 * `--lf-gold-ink` (6.14:1). DESIGN_SYSTEM §9.2.
 */

import { useState } from 'react';

import { Box, Container, IconButton, Stack, Typography, useMediaQuery } from '@mui/material';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

import { useSubstantiatedClaims } from '../../content/claims';

/** One claim, as it appears in the strip. */
const ClaimItem = ({ label }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, mx: 2.5 }}>
    <Box
      aria-hidden="true"
      sx={{
        width: 6,
        height: 6,
        flexShrink: 0,
        borderRadius: '50%',
        backgroundColor: 'var(--lf-gold, #C9A96E)',
      }}
    />
    <Typography
      variant="overline"
      component="span"
      sx={{ color: 'var(--lf-gold-ink, #7A5A24)', whiteSpace: 'nowrap' }}
    >
      {label}
    </Typography>
  </Box>
);

const Marquee = () => {
  const { claims } = useSubstantiatedClaims();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [paused, setPaused] = useState(false);

  // No substantiated claim, no strip. Never a placeholder.
  if (claims.length === 0) return null;

  const labels = claims.map((claim) => claim.label);

  /* Four copies of the sequence means `translateX(-50%)` lands exactly on the
     start of copy 3, which is pixel-identical to copy 1 — a seamless loop that
     also stays wider than a 1440px viewport with only four claims. */
  const track = [...labels, ...labels, ...labels, ...labels];

  const animated = !reducedMotion;

  return (
    <Box
      component="section"
      aria-label="What we can evidence"
      sx={{
        position: 'relative',
        backgroundColor: 'var(--lf-surface, #FFFFFF)',
        borderBottom: '1px solid var(--lf-hairline, #E7E0D6)',
        py: 1.25,
        overflow: 'hidden',
      }}
    >
      {/* Read once by assistive tech, instead of four times by the track. */}
      <Box component="ul" className="lf-sr-only" sx={{ m: 0, p: 0 }}>
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </Box>

      {animated ? (
        <>
          <Box
            aria-hidden="true"
            sx={{
              display: 'inline-flex',
              width: 'max-content',
              whiteSpace: 'nowrap',
              animation: 'lf-marquee 38s linear infinite',
              animationPlayState: paused ? 'paused' : 'running',
              '@keyframes lf-marquee': {
                '0%': { transform: 'translateX(0)' },
                '100%': { transform: 'translateX(-50%)' },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            {track.map((label, index) => (
              <ClaimItem key={`${label}-${index}`} label={label} />
            ))}
          </Box>

          <IconButton
            size="small"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
            aria-label={paused ? 'Resume the scrolling strip' : 'Pause the scrolling strip'}
            sx={{
              position: 'absolute',
              top: '50%',
              right: 4,
              transform: 'translateY(-50%)',
              backgroundColor: 'var(--lf-surface, #FFFFFF)',
              border: '1px solid var(--lf-hairline, #E7E0D6)',
              color: 'var(--lf-ink-2, #4A433C)',
              '&:hover': { backgroundColor: 'var(--lf-surface-sunken, #F6F2EC)' },
            }}
          >
            {paused ? (
              <PlayArrowRoundedIcon fontSize="small" />
            ) : (
              <PauseRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </>
      ) : (
        <Container>
          <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            justifyContent="center"
            aria-hidden="true"
          >
            {labels.map((label) => (
              <ClaimItem key={label} label={label} />
            ))}
          </Stack>
        </Container>
      )}
    </Box>
  );
};

export default Marquee;
