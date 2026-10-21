import { createTheme } from '@mui/material/styles';

/* ----------------------------------------------------------------------------
 * Le foyeR. — "ALCOVE"   (docs/ART_DIRECTION.md §3 is binding)
 *
 * palette.*    : REAL HEX. MUI needs parseable colours for alpha() and
 *                augmentColor(). Never a var() here.
 * components.* : var(--lf-*). This is what makes .lf-hearth-section work with
 *                zero component changes.
 * cssVariables : deliberately OFF (§2.33). index.css is the single var source;
 *                two var layers is a debugging tax with no payoff.
 * spacing      : STAYS 8 (§2.17). Changing it to 4 silently halves ~40
 *                existing p:3 / py:8 / spacing={4} call sites.
 *
 * DELETED in this rewrite, each for a measured reason (§3.11, §3.12, §1.3):
 *   · the E1–E4 JS string consts — they were a SECOND, unreachable elevation
 *     ramp: every theme surface used them while components used
 *     var(--lf-e1..4), so a redefinition could never reach a themed surface.
 *     shadows[1..4] now map to the vars, and the duplicated boxShadow
 *     declarations on Paper/Card/Menu/Popover/Dialog/Drawer are gone, so
 *     `elevation` is the single way to ask for depth.
 *   · theme.transitions — it duplicated §3.12's ramp numerically, had ZERO
 *     consumers, and mapped MUI's `sharp` to cubic-bezier(.22,.61,.36,1),
 *     which is the system's DEFAULT curve, not a sharp one.
 *   · MuiDrawer/MuiDialog's hardcoded { enter: 380, exit: 260 }.
 *   · MuiDivider's `rule` variant (--lf-rule-gold composited to 1.30:1 over
 *     canvas — below the perception floor; .lf-ledge replaces it).
 *   · MuiAppBar's defaultProps.position — a default every call site overrides
 *     is a false default.
 *   · breakpoints that merely restated MUI's defaults, while the breakpoints
 *     the layout really uses (shelf 680, xl 1440) went undeclared.
 * -------------------------------------------------------------------------- */

const FONT_UI      = "'Inter', 'Inter-fallback', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_DISPLAY = "'Inter Tight', 'Inter', 'Inter-fallback', system-ui, -apple-system, sans-serif";
const FONT_BRAND   = "'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif";

const TNUM = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' };

/* §3.11 — ONE ramp, read by name from index.css so .lf-hearth-section's
 * redefinitions actually reach a theme-rendered surface. */
const E = (n) => `var(--lf-e${n})`;

/* -- Base theme: palette first, so augmentColor() has something to work with - */
const base = createTheme({
  palette: {
    mode: 'light',
    /* §2.17 upheld: the primary CTA stays INK. A grid of gold buy-buttons
       turns the accent into a theme colour; ink at 15.97:1 is the most
       legible and keeps gold precious. */
    primary:   { main: '#1A1410', dark: '#0F0B08', light: '#4C443B', contrastText: '#FBF4E8' },
    secondary: { main: '#7A5A24', dark: '#6E4F1E', light: '#8C6A24', contrastText: '#FFFFFF' },
    background:{ default: '#F6EFE4', paper: '#FFFCF6' },
    /* text.disabled is --lf-ink-3, NOT --lf-ink-4: an aria-disabled control is
       still focusable and in the tab order, so the SC 1.4.3 "inactive
       component" exemption does not apply. 4.65:1 on --lf-quiet (A5). */
    text:      { primary: '#1A1410', secondary: '#4C443B', disabled: '#6A6056' },
    success:   { main: '#1E7A4D', dark: '#15663D', light: '#E4F1E8', contrastText: '#FFFFFF' },
    warning:   { main: '#7A4F00', dark: '#5F3D00', light: '#FBEFD9', contrastText: '#FFFFFF' },
    error:     { main: '#A01C15', dark: '#7F160F', light: '#FBE9E6', contrastText: '#FFFFFF' },
    divider:   '#E0D2BC',
    action: {
      hover: 'rgba(26,20,16,0.04)',
      selected: 'rgba(26,20,16,0.07)',
      disabled: '#6A6056',
      disabledBackground: '#E9DFCF',
      focus: 'rgba(26,20,16,0.12)',
    },
    /* The grey ramp is warm end to end. #FAFAFA is banned sitewide. */
    grey: {
      50:'#FFFCF6', 100:'#F6EFE4', 200:'#F1E6D6', 300:'#E9DFCF', 400:'#E0D2BC',
      500:'#BFAD92', 600:'#8D8378', 700:'#6A6056', 800:'#4C443B', 900:'#1A1410',
    },
  },

  /* §3.13 — declare the breakpoints the design actually turns on.
     shelf 680 : the 1-up → 2-up card switch.
     lg 1200   : 2-up → 3-up, and the container cap (1232px).
     xl 1440   : the container widens to 1296px. The old build raised padding
                 to 40px at 1440 while capping the container at 1232, which
                 SHRANK the content column from 1168 to 1152 — a breakpoint
                 that cost you pixels. Verified safe: zero `xl:` usages in src. */
  breakpoints: { values: { xs: 0, sm: 600, shelf: 680, md: 900, lg: 1200, xl: 1440 } },
  spacing: 8,

  /* §3.9 — radius tiered by what the thing is (§2.5 overturned). */
  shape: { borderRadius: 12 },

  /* §3.11 — exactly 25 entries; 1–4 are the ramp, the rest saturate at e4. */
  shadows: [
    'none', E(1), E(2), E(3), E(4),
    E(4), E(4), E(4), E(4), E(4), E(4), E(4), E(4), E(4), E(4),
    E(4), E(4), E(4), E(4), E(4), E(4), E(4), E(4), E(4), E(4),
  ],

  zIndex: { appBar: 1100, drawer: 1200, modal: 1300, snackbar: 1400, tooltip: 1500 },
});

/* -- The gold scale. augmentColor() is what makes <Button color="brand"> work
      in v7 from plain JS, with no .d.ts module augmentation. ---------------- */
const brand = base.palette.augmentColor({
  color: { main: '#8C6A24', light: '#C9A96E', dark: '#6E4F1E', contrastText: '#FFFFFF' },
  name: 'brand',
});

const theme = createTheme(base, {
  palette: { brand },

  /* ==========================================================================
   * TYPOGRAPHY — §3.7
   * Inter Tight is already an optically tight face. ANY TRACKING VALUE PAST
   * −0.012em IS BANNED ABOVE 24px: stacking optical tracking on a tight face
   * is the Linear/Vercel signature, and it is a token value, not a typeface.
   * `display` was weight 700 at −0.026em with ZERO call sites, so the hero
   * rendered as `h1` — a brand moment drawn in the same register as the
   * Privacy Policy title. It is now 600 / −0.006em with exactly one call
   * site. A dead top register is worse than none: it hides the fact that the
   * scale has no apex.
   * Floors: prose 13px (caption), any text 12px. Nothing renders below 12px.
   * ======================================================================== */
  typography: {
    fontFamily: FONT_UI,
    htmlFontSize: 16,
    fontWeightRegular: 400, fontWeightMedium: 500, fontWeightBold: 700,

    /* 34px @390 · 47px @768 · 60px @1440. HERO ONLY. One per page, maximum. */
    display: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(2.125rem, 1.30rem + 3.4vw, 3.75rem)',  lineHeight: 1.07, letterSpacing: '-0.006em' },
    /* 30 → 44px. Editorial page titles, PDP product name. */
    h1:      { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(1.875rem, 1.42rem + 1.9vw, 2.75rem)',  lineHeight: 1.10, letterSpacing: '-0.010em' },
    /* 26 → 34px. Section headings. */
    h2:      { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(1.625rem, 1.33rem + 1.22vw, 2.125rem)',lineHeight: 1.14, letterSpacing: '-0.010em' },
    /* 22 → 26px. Utility page titles, rendered component="h1". */
    h3:      { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(1.375rem, 1.22rem + 0.63vw, 1.625rem)',lineHeight: 1.20, letterSpacing: '-0.008em' },
    /* THE PRODUCT NAME. 19px, not 17px — and Inter, not Inter Tight. */
    h4:      { fontFamily: FONT_UI, fontWeight: 600, fontSize: '1.1875rem', lineHeight: 1.26, letterSpacing: '-0.006em' },
    h5:      { fontFamily: FONT_UI, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.30, letterSpacing: '-0.004em' },
    h6:      { fontFamily: FONT_UI, fontWeight: 600, fontSize: '1rem',      lineHeight: 1.40, letterSpacing: '-0.004em', textTransform: 'none' },

    subtitle1: { fontWeight: 400, fontSize: 'clamp(1rem, 0.96rem + 0.17vw, 1.0625rem)', lineHeight: 1.58, letterSpacing: 0 },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem',  lineHeight: 1.40, letterSpacing: 0 },
    /* §3.7 caps body1's MEASURE at 62ch, but that cap MUST NOT live here.
       MuiCssBaseline builds its `body` rule as `{ ...theme.typography.body1 }`,
       so a `maxWidth` on this variant is emitted as `body { max-width: 62ch }`
       — which sized the whole document to 551.7px at every viewport and wrapped
       the hero headline one character per line. The cap is applied to the
       body1 VARIANT instead, in MuiTypography.variants below. */
    body1:     { fontWeight: 400, fontSize: '1rem',      lineHeight: 1.62, letterSpacing: 0 },
    body2:     { fontWeight: 400, fontSize: '0.9375rem', lineHeight: 1.56, letterSpacing: 0 },
    caption:   { fontWeight: 500, fontSize: '0.8125rem', lineHeight: 1.46, letterSpacing: '0.004em' },

    /* §3.7 — `eyebrow` REPLACES `overline`. 12px/600/+0.14em, --lf-gold-ink
       at 5.55:1 on canvas. `overline` survives this release only as a
       deprecated alias carrying eyebrow's metrics, so the ~13 call sites
       still on it render correctly; it is deleted after the sweep (9.10). */
    eyebrow:   { fontFamily: FONT_UI, fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.30, letterSpacing: '0.14em', textTransform: 'uppercase' },
    overline:  { fontFamily: FONT_UI, fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.30, letterSpacing: '0.14em', textTransform: 'uppercase' },

    button:    { fontFamily: FONT_UI, fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.2, letterSpacing: 0, textTransform: 'none' },

    badge:        { fontWeight: 600, fontSize: '0.75rem',   lineHeight: 1.2, letterSpacing: '0.03em' },
    price:        { fontFamily: FONT_UI, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.30, letterSpacing: '-0.008em', ...TNUM },
    /* 28 → 34px */
    priceLg:      { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(1.75rem, 1.56rem + 0.83vw, 2.125rem)', lineHeight: 1.10, letterSpacing: '-0.012em', ...TNUM },
    priceCompare: { fontWeight: 500, fontSize: '0.875rem',  lineHeight: 1.2, textDecoration: 'line-through', textDecorationThickness: '1px' },

    /* Fraunces: EXACTLY THREE licensed uses at a 20px/600 hard floor —
       nav wordmark (1), one home interstitial headline (2), footer wordmark
       (3). A fourth is a regression against an explicit owner decision. */
    brandDisplay: { fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 'clamp(1.75rem, 1.21rem + 2.3vw, 2.75rem)', lineHeight: 1.16, letterSpacing: '-0.008em' },
    wordmark:     { fontFamily: FONT_BRAND, fontWeight: 600, fontSize: '1.25rem', lineHeight: 1, letterSpacing: '0.01em' },
  },

  components: {

    /* ====================== GLOBAL ====================== */
    MuiCssBaseline: {
      styleOverrides: `
        /* Tokens, reset, focus, scrollbar, the niche and reduced-motion live
           in index.css. This block only carries what must beat MUI's own
           injected rules. */
        .MuiTypography-gutterBottom { margin-bottom: 0.5em; }
        .MuiPopover-paper, .MuiMenu-paper { background-image: none; }
        /* Labels are static (see MuiInputLabel), so the outline's notch
           spacer legend must collapse. SCOPED deliberately: a bare
           "legend { display:none }" also hides every real <fieldset><legend>
           — e.g. the Checkout payment-method radio group's accessible name. */
        .MuiOutlinedInput-notchedOutline legend { display: none; }
      `,
    },
    MuiButtonBase: { defaultProps: { disableRipple: true, disableTouchRipple: true } },
    MuiUseMediaQuery: { defaultProps: { noSsr: true } },

    /* ====================== BUTTON ====================== */
    MuiButton: {
      defaultProps: { disableElevation: true, variant: 'contained', color: 'primary' },
      styleOverrides: {
        root: {
          minHeight: 44,                       /* A6 — 44px floor, everywhere */
          padding: '12px 20px',
          borderRadius: 'var(--lf-r-field)',
          boxShadow: 'none',
          gap: 8,
          transition: [
            'background-color var(--lf-dur-2) var(--lf-ease)',
            'border-color var(--lf-dur-2) var(--lf-ease)',
            'color var(--lf-dur-2) var(--lf-ease)',
            'transform var(--lf-dur-1) var(--lf-ease)',
          ].join(','),
          '&:hover': { boxShadow: 'none' },
          '&:active': { transform: 'scale(0.972)' },
          '&.Mui-focusVisible': { outline: '2px solid var(--lf-focus)', outlineOffset: 2 },
          /* A4/A5: commerce buttons use aria-disabled, never the `disabled`
             attribute. Where a genuinely disabled button does render, its label is
             --lf-ink-3 on --lf-quiet = 4.65:1, not --lf-ink-4 at 3.25:1. */
          '&.Mui-disabled': {
            backgroundColor: 'var(--lf-quiet)',
            color: 'var(--lf-ink-3)',
            borderColor: 'var(--lf-border)',
            cursor: 'not-allowed',
            pointerEvents: 'auto',          /* so a tooltip/reason can still be read */
          },
          '& .MuiButton-startIcon > *:first-of-type, & .MuiButton-endIcon > *:first-of-type': { fontSize: 20 },
        },
        sizeSmall:  { minHeight: 36, padding: '8px 16px', fontSize: '0.9375rem' },
        /* 52px is the buy-box / ShelfBundle geometry (§6.5, §6.8). */
        sizeLarge:  { minHeight: 52, padding: '14px 28px', fontSize: '1rem', borderRadius: 'var(--lf-r-card)' },
        contained: {
          backgroundColor: 'var(--lf-ink)',
          color: 'var(--lf-on-ink)',
          '@media (hover:hover)': { '&:hover': { backgroundColor: '#2C221B' } },
          '&:active': { backgroundColor: '#0F0B08', transform: 'scale(0.972)' },
          '&.Mui-focusVisible': {
            outline: '2px solid var(--lf-focus-inner)', outlineOffset: -4,
            boxShadow: '0 0 0 2px var(--lf-focus-inner), 0 0 0 4px var(--lf-focus)',
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: 'var(--lf-border-ink)',
          color: 'var(--lf-ink)',
          backgroundColor: 'transparent',
          '@media (hover:hover)': {
            '&:hover': { borderWidth: 1, borderColor: 'var(--lf-border-ink)', backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)' },
          },
          '&:active': { backgroundColor: '#0F0B08', color: 'var(--lf-on-ink)' },
        },
        text: {
          padding: '10px 12px',
          color: 'var(--lf-gold-ink)',
          textDecoration: 'underline',
          textDecorationThickness: '1px',
          textUnderlineOffset: 3,
          '@media (hover:hover)': {
            '&:hover': { color: 'var(--lf-gold-ink-hv)', backgroundColor: 'var(--lf-gold-tint)' },
          },
        },
      },
      variants: [
        /* ---- GOLD GETS EXACTLY TWO LICENSED FILLS (§2.18, §10.8) ----------
           Rationing gold produced a brand hex that reached the screen on one
           chip variant while --lf-gold-fill and variant="brandFill" had ZERO
           call sites. Ink at 15.97:1 still outranks gold, so §2.3's hierarchy
           is unharmed. Do not add a third. */

        /* FILL 1 of 2 — `Notify me`. Half this catalogue is unbuyable, so the
           restock row becomes the WARMEST thing on the shelf rather than the
           dead half of the page. --lf-gold with an --lf-ink label = 8.15:1.
           The BACK SOON ledge sits above the name, so the words land before
           the eye reaches the button (misread-as-promotion mitigation). */
        { props: { variant: 'notify' }, style: {
            minHeight: 48, padding: '12px 20px', borderRadius: 'var(--lf-r-field)',
            fontWeight: 600, fontSize: '0.9375rem',
            backgroundColor: 'var(--lf-gold)', color: 'var(--lf-ink)',
            '@media (hover:hover)': { '&:hover': { backgroundColor: '#BE9B5B' } },
            '&:active': { transform: 'scale(0.972)' },
            /* NEVER the `disabled` attribute, never absent, never a dead grey
               button (§6.6, §10.12). aria-disabled keeps it focusable and
               keeps its colour. */
            '&[aria-disabled="true"]': {
              backgroundColor: 'var(--lf-gold)', color: 'var(--lf-ink)', opacity: 1,
            },
            '&.Mui-focusVisible': {
              outline: '2px solid var(--lf-focus-inner)', outlineOffset: -4,
              boxShadow: '0 0 0 2px var(--lf-focus-inner), 0 0 0 4px var(--lf-focus)',
            },
        }},

        /* FILL 2 of 2 — the newsletter `Join`. White label on
           --lf-gold-fill = 5.00:1. Licensed in §2.3 and never built. */
        { props: { variant: 'brandFill' }, style: {
            minHeight: 48, padding: '12px 20px', borderRadius: 'var(--lf-r-field)',
            fontWeight: 600, fontSize: '0.9375rem',
            backgroundColor: 'var(--lf-gold-fill)', color: '#FFFFFF',
            /* The hover is a LITERAL, not --lf-gold-ink-hv, and that is required:
               the one call site is the footer's `Join`, which lives inside
               `.lf-hearth-section`, where --lf-gold-ink-hv inverts to the light
               #EFD9AC — a white label on it measures ~1.1:1. --lf-gold-fill is
               NOT inverted there, so a fixed darker step of the same hue is the
               only value that holds on both surfaces. White on #75571D = 6.69:1.
               (Same reason `notify` writes its own #BE9B5B.) */
            '@media (hover:hover)': { '&:hover': { backgroundColor: '#75571D' } },
            '&:active': { transform: 'scale(0.972)' },
            '&.Mui-focusVisible': {
              outline: '2px solid var(--lf-focus-inner)', outlineOffset: -4,
              boxShadow: '0 0 0 2px var(--lf-focus-inner), 0 0 0 4px var(--lf-focus)',
            },
        }},

        /* Destructive: "Remove" must never be the loudest control on the page.
           A button never turns red to report an error (§6.5) — this variant
           is for genuinely destructive ACTIONS only. */
        { props: { variant: 'destructive' }, style: {
            minHeight: 44, padding: '10px 12px', borderRadius: 'var(--lf-r-field)',
            fontWeight: 600, fontSize: '0.9375rem', color: 'var(--lf-err-ink)',
            backgroundColor: 'transparent',
            '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-err-tint)' } },
        }},

        /* Over imagery only: gallery controls. The blur is legal here because
           it is never inside a scrolling list (P6). */
        { props: { variant: 'glass' }, style: {
            minHeight: 44, padding: '12px 20px', borderRadius: 'var(--lf-r-field)',
            fontWeight: 600, fontSize: '0.9375rem',
            color: 'var(--lf-ink)', backgroundColor: 'rgba(255,252,246,0.88)',
            WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)',
            boxShadow: 'var(--lf-e1)',
            '@media (hover:hover)': { '&:hover': { backgroundColor: 'rgba(255,252,246,0.96)' } },
        }},
      ],
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44, minHeight: 44,            /* A6 */
          borderRadius: 'var(--lf-r-field)',
          color: 'var(--lf-ink)',
          transition: 'background-color var(--lf-dur-2) var(--lf-ease), transform var(--lf-dur-1) var(--lf-ease)',
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'rgba(26,20,16,0.045)' } },
          '&:active': { transform: 'scale(0.972)' },
          /* A7, and a hard WCAG 2.4.7 failure without it: measured with real Tab
             keypresses, 10 of 56 tab stops on /products and 11 of 53 on / painted
             nothing. index.css's :focus-visible rule does not reach these because
             MUI's own root style wins on specificity. */
          '&.Mui-focusVisible': { outline: '2px solid var(--lf-focus)', outlineOffset: 2 },
          '&.Mui-disabled': { color: 'var(--lf-ink-3)' },
        },
        /* 36px visual circle; callers give it a 44px hit area via
           ::before{inset:-4px} (§6.2 item 1). */
        sizeSmall: { minWidth: 36, minHeight: 36, borderRadius: 'var(--lf-r-chip)' },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 44, borderRadius: 'var(--lf-r-field)', textTransform: 'none',
          fontWeight: 600, fontSize: '0.9375rem',
          color: 'var(--lf-ink-3)', borderColor: 'var(--lf-border-strong)',
          '&.Mui-selected': {
            backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)',
            '&:hover': { backgroundColor: '#2C221B' },
          },
        },
      },
    },

    /* ====================== FIELDS ======================
       Labels sit ABOVE the field, always. A floating label halves to 11px
       when filled — exactly the illegibility the owner rejected. */
    MuiTextField: {
      defaultProps: { variant: 'outlined', fullWidth: true, InputLabelProps: { shrink: true } },
    },
    MuiFormControl: { defaultProps: { fullWidth: true } },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          position: 'static', transform: 'none', maxWidth: '100%',
          fontFamily: FONT_UI, fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4,
          color: 'var(--lf-ink)', marginBottom: 6, pointerEvents: 'auto',
          '&.Mui-focused': { color: 'var(--lf-ink)' },
          '&.Mui-error':   { color: 'var(--lf-err-ink)' },
          '&.Mui-disabled':{ color: 'var(--lf-ink-3)' },
        },
        outlined: { '&.MuiInputLabel-shrink': { transform: 'none' } },
        asterisk: { display: 'none' },   /* we write "(optional)" instead */
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 48,
          borderRadius: 'var(--lf-r-field)',
          backgroundColor: 'var(--lf-paper)',
          fontSize: '1rem',                 /* >=16px or iOS Safari zooms on focus */
          transition: 'border-color var(--lf-dur-2) var(--lf-ease), background-color var(--lf-dur-2) var(--lf-ease)',
          /* A3 — --lf-border-field is 3.63:1 on canvas, 4.05:1 on paper. */
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-border-field)', borderWidth: 1, top: 0 },
          '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
          '@media (hover:hover)': {
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-ink-3)' },
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-ink)', borderWidth: 1 },
          '&.Mui-focused': { outline: '2px solid var(--lf-focus)', outlineOffset: 2 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-err-ink)', borderWidth: 1 },
          '&.Mui-disabled': {
            backgroundColor: 'var(--lf-quiet)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-border)' },
          },
          '&[readonly], &.lf-readonly': { backgroundColor: 'var(--lf-mat)' },
        },
        input: {
          padding: '13px 14px',
          color: 'var(--lf-ink)',
          '&::placeholder': { color: 'var(--lf-ink-3)', opacity: 1 },
          '&:-webkit-autofill': { WebkitBoxShadow: '0 0 0 100px var(--lf-paper) inset', WebkitTextFillColor: 'var(--lf-ink)' },
        },
        inputSizeSmall: { padding: '10px 12px' },
        multiline: { padding: 0 },
        sizeSmall: { minHeight: 44 },
        adornedEnd: { paddingRight: 8 },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          minHeight: 18, marginTop: 6, marginLeft: 0, marginRight: 0,
          fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.46,
          color: 'var(--lf-ink-3)',
          '&.Mui-error': { color: 'var(--lf-err-ink)' },
        },
      },
    },
    MuiSelect: {
      defaultProps: { MenuProps: { disableScrollLock: false } },
      styleOverrides: {
        select: { minHeight: 'unset', paddingRight: '40px !important' },
        icon: { color: 'var(--lf-ink-3)', right: 12, fontSize: 20 },
      },
    },
    MuiMenu: {
      defaultProps: { elevation: 3 },
      styleOverrides: {
        paper: {
          marginTop: 6, borderRadius: 'var(--lf-r-field)',
          backgroundColor: 'var(--lf-paper)', backgroundImage: 'none',
          border: '1px solid var(--lf-hairline)',
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 44, borderRadius: 'var(--lf-r-chip)', fontSize: '0.9375rem',
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-mat)' } },
          '&.Mui-selected': {
            backgroundColor: 'var(--lf-gold-tint)',
            '&:hover': { backgroundColor: 'var(--lf-gold-tint-2)' },
          },
        },
      },
    },
    MuiCheckbox: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          padding: 10, color: 'var(--lf-border-field)', borderRadius: 'var(--lf-r-chip)',
          '&.Mui-checked': { color: 'var(--lf-ink)' },
          '&.Mui-disabled': { color: 'var(--lf-border)' },
          '& .MuiSvgIcon-root': { fontSize: 22 },
        },
      },
    },
    MuiRadio: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          padding: 10, color: 'var(--lf-border-field)',
          '&.Mui-checked': { color: 'var(--lf-ink)' },
          '& .MuiSvgIcon-root': { fontSize: 22 },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { width: 56, height: 40, padding: 7 },
        switchBase: {
          padding: 9,
          '&.Mui-checked': {
            transform: 'translateX(18px)',
            '& + .MuiSwitch-track': { backgroundColor: 'var(--lf-ink)', opacity: 1 },
          },
        },
        thumb: { width: 22, height: 22, boxShadow: 'var(--lf-e1)', backgroundColor: '#FFFCF6' },
        track: { borderRadius: 'var(--lf-r-pill)', backgroundColor: 'var(--lf-border-strong)', opacity: 1 },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: { marginLeft: -10, marginRight: 0, minHeight: 44 },
        label: { fontSize: '0.9375rem', color: 'var(--lf-ink)' },
      },
    },

    /* ====================== SURFACES ======================
       §3.11: `elevation` is now the SINGLE way to ask for depth. With the
       card frame deleted (§2.6 — the niche is the frame), product cards cast
       no shadow at all; only genuinely floating things carry elevation. */
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: 'var(--lf-paper)', color: 'var(--lf-ink)' },
        rounded: { borderRadius: 'var(--lf-r-card)' },
        outlined: { border: '1px solid var(--lf-hairline)' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          position: 'relative',
          backgroundColor: 'var(--lf-paper)',
          backgroundImage: 'none',
          borderRadius: 'var(--lf-r-card)',
          /* No border, no --lf-e1 hairline ring, no --lf-e-edge highlight:
             decoration cannot fix a structural miscast, and removing them is
             what returns the full card width to the CTA (§2.6). */
          border: 0,
          overflow: 'hidden',
          isolation: 'isolate',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 14, '&:last-child': { paddingBottom: 16 } },
      },
    },
    MuiCardMedia: { styleOverrides: { root: { backgroundColor: 'var(--lf-mat)' } } },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'var(--lf-hairline)' },
      },
    },

    /* ====================== CHROME ====================== */
    MuiAppBar: {
      /* defaultProps.position removed: every call site overrode it, and §6.9
         requires sticky (not fixed) with no Toolbar spacer anywhere. */
      defaultProps: { color: 'transparent', elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: 'var(--lf-paper-glass)',
          WebkitBackdropFilter: 'var(--lf-blur)',
          backdropFilter: 'var(--lf-blur)',
          color: 'var(--lf-ink)',
          backgroundImage: 'none',
          borderBottom: '1px solid var(--lf-hairline)',
          isolation: 'isolate',
          transform: 'translateZ(0)',
          transition: 'box-shadow var(--lf-dur-2) var(--lf-ease), background-color var(--lf-dur-2) var(--lf-ease)',
          /* §2.9 — the dead data-scrolled state, finally given a way in by an
             IntersectionObserver sentinel writing to a ref'd DOM node (never
             React state, never a scroll listener). Scrolled, the bar gains
             --lf-e-nav PLUS the 2px gold ledge along its lower edge: this is
             how the brand hex reaches above the fold on every route. */
          '&[data-scrolled="true"]': {
            boxShadow: 'var(--lf-e-nav)',
            borderBottomColor: 'transparent',
            position: 'relative',
          },
          '&[data-scrolled="true"]::after': {
            content: '""', position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 2, background: 'var(--lf-gold)',
            boxShadow: '0 2px 0 rgba(201,169,110,.28)',
            pointerEvents: 'none',
          },
          '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
            backgroundColor: '#F6EFE4',
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: { minHeight: 'var(--lf-nav-h)', paddingLeft: 0, paddingRight: 0, '@media (min-width:600px)': { minHeight: 'var(--lf-nav-h)' } },
        dense: { minHeight: 48 },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: 'lg' },
      styleOverrides: {
        /* §3.8 — the page gutter is a TOKEN now, not four literals buried in
           this file. --lf-gutter: 16 / 24 / 32 / 40 at 0 / 600 / 900 / 1200. */
        root: {
          paddingLeft: 'var(--lf-gutter)',
          paddingRight: 'var(--lf-gutter)',
        },
        /* --lf-container is 1232px, widening to 1296px at xl 1440 (§3.13). */
        maxWidthLg: { '@media (min-width:1200px)': { maxWidth: 'var(--lf-container)' } },
        maxWidthXl: { '@media (min-width:1440px)': { maxWidth: 'var(--lf-container)' } },
      },
    },
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: {
        root: {
          color: 'var(--lf-gold-ink)',
          textDecorationThickness: '1px',
          textUnderlineOffset: 3,
          '@media (hover:hover)': { '&:hover': { color: 'var(--lf-gold-ink-hv)' } },
        },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        root: { fontSize: '0.8125rem', color: 'var(--lf-ink-3)' },
        separator: { marginLeft: 8, marginRight: 8, color: 'var(--lf-border-strong)' },
        li: { '& [aria-current="page"]': { color: 'var(--lf-ink)', fontWeight: 600 } },
      },
    },

    /* ====================== OVERLAYS ====================== */
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: 'var(--lf-overlay)' },
        invisible: { backgroundColor: 'transparent' },
      },
    },
    MuiDrawer: {
      /* §3.12 — overlay/drawer enter on --lf-dur-4 (340ms); every exit is
         faster than its entry (--lf-dur-3, 260ms). */
      defaultProps: { transitionDuration: { enter: 340, exit: 260 }, elevation: 4 },
      styleOverrides: {
        paper: {
          backgroundColor: 'var(--lf-canvas)', backgroundImage: 'none',
          border: 0, overscrollBehavior: 'contain',
        },
        paperAnchorLeft:   { width: '88vw', maxWidth: 360, borderTopRightRadius: 'var(--lf-r-panel)', borderBottomRightRadius: 'var(--lf-r-panel)' },
        paperAnchorRight:  { width: '88vw', maxWidth: 400, borderTopLeftRadius: 'var(--lf-r-panel)',  borderBottomLeftRadius: 'var(--lf-r-panel)' },
        paperAnchorBottom: { maxHeight: '92dvh', borderTopLeftRadius: 'var(--lf-r-panel)', borderTopRightRadius: 'var(--lf-r-panel)' },
      },
    },
    MuiDialog: {
      defaultProps: { fullWidth: true, maxWidth: 'sm', transitionDuration: { enter: 340, exit: 260 }, scroll: 'paper' },
      styleOverrides: {
        paper: {
          borderRadius: 'var(--lf-r-panel)',
          backgroundColor: 'var(--lf-paper)', backgroundImage: 'none',
          margin: 16, width: 'calc(100% - 32px)',
          '@media (max-width:599.95px)': {
            margin: 0, width: '100%', maxWidth: '100%',
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '92dvh',
            borderRadius: 'var(--lf-r-panel) var(--lf-r-panel) 0 0',
          },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { padding: '20px 24px 8px', fontFamily: FONT_DISPLAY, fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.2 } },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 20px' } } },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 24px calc(20px + env(safe-area-inset-bottom, 0px))',
          gap: 12,
          borderTop: '1px solid var(--lf-hairline)',
          '@media (max-width:599.95px)': { flexDirection: 'column-reverse', '& > *': { width: '100%', marginLeft: '0 !important' } },
        },
      },
    },
    MuiPopover: {
      defaultProps: { elevation: 3 },
      styleOverrides: {
        paper: { borderRadius: 'var(--lf-r-panel)', border: '1px solid var(--lf-hairline)', backgroundImage: 'none' },
      },
    },
    MuiTooltip: {
      defaultProps: { enterTouchDelay: 0, leaveTouchDelay: 4000, arrow: false },
      styleOverrides: {
        tooltip: {
          backgroundColor: 'var(--lf-hearth)', color: 'var(--lf-on-hearth)',
          fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.46,
          padding: '8px 12px', borderRadius: 'var(--lf-r-chip)', maxWidth: 280,
        },
        arrow: { color: 'var(--lf-hearth)' },
      },
    },

    /* ====================== NAVIGATION ====================== */
    MuiTabs: {
      defaultProps: { variant: 'scrollable', scrollButtons: false, allowScrollButtonsMobile: true },
      styleOverrides: {
        root: { minHeight: 48, borderBottom: '1px solid var(--lf-hairline)' },
        /* A8 — never colour alone: the indicator is a 2px --lf-gold-edge
           underline at 3.16:1, and the selected tab also changes to --lf-ink. */
        indicator: {
          height: 2, borderRadius: 2, backgroundColor: 'var(--lf-gold-edge)',
          transition: 'left var(--lf-dur-3) var(--lf-ease), width var(--lf-dur-3) var(--lf-ease)',
        },
        flexContainer: { gap: 4 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48, minWidth: 0, padding: '12px 14px',
          textTransform: 'none', fontSize: '0.9375rem', fontWeight: 600,
          color: 'var(--lf-ink-3)',
          borderRadius: 'var(--lf-r-field) var(--lf-r-field) 0 0',
          '@media (hover:hover)': { '&:hover': { color: 'var(--lf-ink)', backgroundColor: 'var(--lf-mat)' } },
          '&.Mui-selected': { color: 'var(--lf-ink)' },
          '&.Mui-focusVisible': { outlineOffset: -2 },
        },
      },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: true },
      styleOverrides: {
        root: {
          backgroundColor: 'transparent', backgroundImage: 'none',
          borderBottom: '1px solid var(--lf-hairline)',
          '&::before': { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
          '&:last-of-type': { borderBottom: 0 },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 56, padding: '0 4px',
          '&.Mui-expanded': { minHeight: 56 },
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-mat)' } },
          '&.Mui-focusVisible': { backgroundColor: 'transparent', outlineOffset: -2 },
        },
        content: {
          margin: '14px 0', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--lf-ink)',
          '&.Mui-expanded': { margin: '14px 0' },
        },
        expandIconWrapper: {
          color: 'var(--lf-ink-3)',
          transition: 'transform var(--lf-dur-2) var(--lf-ease)',
          '& .MuiSvgIcon-root': { fontSize: 22 },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: { root: { padding: '0 4px 20px', color: 'var(--lf-ink-2)', fontSize: '0.9375rem', lineHeight: 1.6 } },
    },
    MuiPagination: { defaultProps: { shape: 'rounded', siblingCount: 1, boundaryCount: 1 } },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          minWidth: 44, height: 44, margin: '0 3px',
          borderRadius: 'var(--lf-r-field)',
          fontSize: '0.9375rem', fontWeight: 600, color: 'var(--lf-ink)',
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-mat)' } },
          '&.Mui-selected': {
            backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)',
            '&:hover': { backgroundColor: '#2C221B' },
          },
        },
      },
    },

    /* ====================== DATA / FEEDBACK ====================== */
    MuiChip: {
      styleOverrides: {
        root: {
          height: 24, borderRadius: 'var(--lf-r-chip)',
          fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.03em',
          backgroundColor: 'var(--lf-mat)', color: 'var(--lf-ink)',
        },
        sizeMedium: { height: 28, fontSize: '0.8125rem' },
        label: { paddingLeft: 8, paddingRight: 8 },
        outlined: { borderColor: 'var(--lf-border-strong)', backgroundColor: 'transparent' },
        deleteIcon: {
          width: 18, height: 18, margin: '0 4px 0 -2px', color: 'var(--lf-ink-3)',
          '&:hover': { color: 'var(--lf-ink)' },
        },
      },
      variants: [
        { props: { variant: 'filter' }, style: {
            height: 32, borderRadius: 'var(--lf-r-pill)',
            backgroundColor: 'var(--lf-gold-tint)', color: 'var(--lf-ink)',
            fontSize: '0.8125rem',
            '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-gold-tint-2)' } },
            '&:active': { transform: 'scale(0.972)' },
            '& .MuiChip-deleteIcon': { width: 18, height: 18 },
        }},
        { props: { variant: 'statusOk'   }, style: { backgroundColor: 'var(--lf-ok-tint)',   color: 'var(--lf-ok-ink)'   } },
        { props: { variant: 'statusWarn' }, style: { backgroundColor: 'var(--lf-warn-tint)', color: 'var(--lf-warn-ink)' } },
        { props: { variant: 'statusErr'  }, style: { backgroundColor: 'var(--lf-err-tint)',  color: 'var(--lf-err-ink)'  } },
        { props: { variant: 'statusGold' }, style: { backgroundColor: 'var(--lf-gold-tint)', color: 'var(--lf-ink)'      } },
        /* --lf-gold as a fill with an --lf-ink label = 8.15:1. NOT one of the
           two licensed BUTTON fills; this is a badge. */
        { props: { variant: 'bestseller' }, style: { backgroundColor: 'var(--lf-gold)', color: 'var(--lf-ink)' } },
      ],
    },
    /* NOTE: MuiRating is styled, not licensed. All six products have ZERO
       Review rows, so no surface renders a star row, a 0.0 or a (0) count
       (§10.9). These overrides exist only for a real, interactive review
       form once real Review rows exist. */
    MuiRating: {
      defaultProps: { precision: 0.5, readOnly: true, size: 'small' },
      styleOverrides: {
        root: { color: 'var(--lf-gold-edge)' },     /* 3.16:1, not --lf-gold at 1.96:1 */
        iconFilled: { color: 'var(--lf-gold-edge)' },
        iconEmpty:  { color: 'var(--lf-border-strong)' },
        sizeSmall: { fontSize: '0.875rem' },
        sizeMedium:{ fontSize: '1rem' },
        sizeLarge: { fontSize: '1.25rem' },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          minWidth: 18, height: 18, padding: '0 5px',
          borderRadius: 'var(--lf-r-pill)',
          fontSize: '0.75rem', fontWeight: 600, lineHeight: '18px',
          fontVariantNumeric: 'tabular-nums',
          backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)',
          border: '1.5px solid var(--lf-canvas)',
          /* --lf-ease-spring, licensed moment 1 of 2 (§3.12). */
          transition: 'transform var(--lf-dur-3) var(--lf-ease-spring)',
          '&[data-bump="true"]': { transform: 'scale(1.28)' },
        },
        colorPrimary: { backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)' },
      },
    },
    MuiSnackbar: {
      defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'left' }, autoHideDuration: 4000 },
      styleOverrides: {
        root: {
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          '@media (max-width:599.95px)': {
            left: 16, right: 16, bottom: 'calc(16px + var(--lf-bar-h) + env(safe-area-inset-bottom, 0px))',
          },
        },
      },
    },
    MuiAlert: {
      defaultProps: { variant: 'standard', iconMapping: undefined },
      styleOverrides: {
        root: {
          borderRadius: 'var(--lf-r-card)',
          padding: '12px 16px',
          fontSize: '0.9375rem', fontWeight: 500,
          alignItems: 'flex-start',
          border: '1px solid var(--lf-hairline)',
          boxShadow: 'none',
        },
        icon: { fontSize: 20, padding: 0, marginRight: 12, opacity: 1 },
        message: { padding: 0, lineHeight: 1.5 },
        action: { paddingTop: 0, marginRight: -6 },
        standardSuccess: { backgroundColor: 'var(--lf-ok-tint)',   color: 'var(--lf-ok-ink)',   borderLeft: '3px solid var(--lf-ok)' },
        standardWarning: { backgroundColor: 'var(--lf-warn-tint)', color: 'var(--lf-warn-ink)', borderLeft: '3px solid var(--lf-warn-ink)' },
        standardError:   { backgroundColor: 'var(--lf-err-tint)',  color: 'var(--lf-err-ink)',  borderLeft: '3px solid var(--lf-err-ink)' },
        standardInfo:    { backgroundColor: 'var(--lf-gold-tint)', color: 'var(--lf-ink)',      borderLeft: '3px solid var(--lf-gold-edge)' },
      },
    },
    MuiSkeleton: {
      defaultProps: { animation: 'pulse', variant: 'rounded' },
      styleOverrides: {
        root: { backgroundColor: 'var(--lf-quiet)', transform: 'none' },
        rounded: { borderRadius: 'var(--lf-r-chip)' },
        text: { borderRadius: 4, transform: 'none' },
      },
    },
    MuiCircularProgress: {
      defaultProps: { size: 16, thickness: 3.6, color: 'inherit' },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 4, borderRadius: 'var(--lf-r-pill)', backgroundColor: 'var(--lf-quiet)' },
        bar: { borderRadius: 'var(--lf-r-pill)', backgroundColor: 'var(--lf-gold-edge)' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid var(--lf-hairline)', padding: '14px 12px', fontSize: '0.9375rem' },
        head: { fontWeight: 600, color: 'var(--lf-ink-3)', fontSize: '0.875rem' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 48, borderRadius: 'var(--lf-r-field)',
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-mat)' } },
          '&.Mui-selected': { backgroundColor: 'var(--lf-gold-tint)' },
        },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          display: 'h1', brandDisplay: 'h2', wordmark: 'span',
          eyebrow: 'p', overline: 'p',
          price: 'span', priceLg: 'span', priceCompare: 'span', badge: 'span',
          subtitle1: 'p', subtitle2: 'span', body1: 'p', body2: 'p',
        },
      },
      styleOverrides: {
        root: { '&[data-tnum]': TNUM },
        gutterBottom: { marginBottom: '0.5em' },
      },
      variants: [
        { props: { variant: 'display' },      style: { fontFamily: FONT_DISPLAY } },
        { props: { variant: 'brandDisplay' }, style: { fontFamily: FONT_BRAND } },
        /* Fraunces licences 1 and 3 of 3: 20px in the nav, 28px in the
           footer. 20px is a HARD FLOOR — the face is unreadable below it on a
           cheap Android panel. */
        { props: { variant: 'wordmark' },     style: { fontFamily: FONT_BRAND, '&[data-wordmark="footer"]': { fontSize: '1.75rem' } } },
        { props: { variant: 'eyebrow' },      style: { color: 'var(--lf-gold-ink)' } },
        { props: { variant: 'overline' },     style: { color: 'var(--lf-gold-ink)' } },
        /* §3.7's 62ch measure, on the variant rather than on <body>. A longer
           line than this is unreadable; a component that genuinely needs the
           full column (a flex row, a price line) overrides it with sx, which
           wins on specificity. */
        { props: { variant: 'body1' },        style: { maxWidth: '62ch' } },
        { props: { variant: 'price' },        style: TNUM },
        { props: { variant: 'priceLg' },      style: TNUM },
        { props: { variant: 'priceCompare' }, style: { ...TNUM, color: 'var(--lf-ink-3)' } },
      ],
    },
  },
});

export default theme;
