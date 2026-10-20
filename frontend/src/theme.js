import { createTheme } from '@mui/material/styles';

/* ----------------------------------------------------------------------------
 * Le foyeR. — "Counter"
 *
 * palette.*            : REAL HEX. MUI needs parseable colours for alpha()
 *                        and augmentColor(). Never a var() here.
 * components.*         : var(--lf-*). This is what makes .lf-ink-section and
 *                        [data-theme="dark"] work with zero component changes.
 * cssVariables         : deliberately OFF. index.css is the single var source;
 *                        two var layers is a debugging tax with no payoff.
 * spacing              : stays 8. Changing it to 4 silently halves ~40
 *                        existing p:3 / py:8 / spacing={4} call sites.
 * -------------------------------------------------------------------------- */

const FONT_UI      = "'Inter', 'Inter-fallback', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_DISPLAY = "'Inter Tight', 'Inter', 'Inter-fallback', system-ui, -apple-system, sans-serif";
const FONT_BRAND   = "'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif";

const E1 = '0 1px 2px rgba(20,17,15,0.05), 0 0 0 1px rgba(20,17,15,0.045)';
const E2 = '0 2px 4px rgba(20,17,15,0.05), 0 8px 20px -6px rgba(20,17,15,0.09)';
const E3 = '0 4px 8px rgba(20,17,15,0.06), 0 18px 36px -10px rgba(20,17,15,0.13)';
const E4 = '0 8px 16px rgba(20,17,15,0.07), 0 36px 72px -18px rgba(20,17,15,0.19)';

const TNUM = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' };

/* -- Base theme: palette first, so augmentColor() has something to work with - */
const base = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#14110F', dark: '#000000', light: '#4A433C', contrastText: '#FFFFFF' },
    secondary: { main: '#7A5A24', dark: '#6E4F1E', light: '#8C6A24', contrastText: '#FFFFFF' },
    background:{ default: '#FDFBF9', paper: '#FFFFFF' },
    text:      { primary: '#14110F', secondary: '#4A433C', disabled: '#8A8178' },
    success:   { main: '#1E7A4D', dark: '#15663D', light: '#E7F4EC', contrastText: '#FFFFFF' },
    warning:   { main: '#7A4F00', dark: '#5F3D00', light: '#FDF3E0', contrastText: '#FFFFFF' },
    error:     { main: '#A01C15', dark: '#7F160F', light: '#FCECEA', contrastText: '#FFFFFF' },
    divider:   '#E7E0D6',
    action: {
      hover: 'rgba(20,17,15,0.04)',
      selected: 'rgba(20,17,15,0.07)',
      disabled: '#8A8178',
      disabledBackground: '#F0ECE6',
      focus: 'rgba(20,17,15,0.12)',
    },
    grey: {
      50:'#FDFBF9', 100:'#F6F2EC', 200:'#F0ECE6', 300:'#E7E0D6', 400:'#DED6C9',
      500:'#C9BFAE', 600:'#8A8178', 700:'#6B635A', 800:'#4A433C', 900:'#14110F',
    },
  },
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
  spacing: 8,
  shape: { borderRadius: 14 },
  shadows: [
    'none', E1, E2, E3, E4,
    E4, E4, E4, E4, E4, E4, E4, E4, E4, E4,
    E4, E4, E4, E4, E4, E4, E4, E4, E4, E4,   // must be exactly 25 entries
  ],
  transitions: {
    duration: {
      shortest: 110, shorter: 180, short: 260, standard: 260,
      complex: 380, enteringScreen: 380, leavingScreen: 260,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.45,0.05,0.55,0.95)',
      easeOut:   'cubic-bezier(0.16,1.00,0.30,1)',
      easeIn:    'cubic-bezier(0.40,0.00,1.00,1.00)',
      sharp:     'cubic-bezier(0.22,0.61,0.36,1)',
    },
  },
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
   * TYPOGRAPHY
   * Floors: prose 13px (caption), any text 12px (badge, inside >=15:1 pills).
   * Nothing renders below 12px. Ever.
   * ======================================================================== */
  typography: {
    fontFamily: FONT_UI,
    htmlFontSize: 16,
    fontWeightRegular: 400, fontWeightMedium: 500, fontWeightBold: 700,

    display: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(2.5rem, 1.42rem + 4.5vw, 4.25rem)',  lineHeight: 1.04, letterSpacing: '-0.026em' },
    h1:      { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(2rem, 1.38rem + 2.6vw, 3rem)',       lineHeight: 1.08, letterSpacing: '-0.022em' },
    h2:      { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(1.75rem, 1.4rem + 1.46vw, 2.5rem)',  lineHeight: 1.12, letterSpacing: '-0.020em' },
    h3:      { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(1.5rem, 1.31rem + 0.83vw, 2rem)',    lineHeight: 1.18, letterSpacing: '-0.016em' },
    h4:      { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 'clamp(1.25rem, 1.15rem + 0.42vw, 1.5rem)', lineHeight: 1.25, letterSpacing: '-0.012em' },
    h5:      { fontFamily: FONT_UI, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.30, letterSpacing: '-0.008em' },
    h6:      { fontFamily: FONT_UI, fontWeight: 600, fontSize: '1rem',      lineHeight: 1.40, letterSpacing: '-0.004em', textTransform: 'none' },

    subtitle1: { fontWeight: 400, fontSize: 'clamp(1rem, 0.96rem + 0.17vw, 1.0625rem)', lineHeight: 1.58, letterSpacing: '-0.004em' },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem',  lineHeight: 1.40, letterSpacing: 0 },
    body1:     { fontWeight: 400, fontSize: '1rem',      lineHeight: 1.60, letterSpacing: '-0.003em' },
    body2:     { fontWeight: 400, fontSize: '0.9375rem', lineHeight: 1.56, letterSpacing: 0 },
    caption:   { fontWeight: 500, fontSize: '0.8125rem', lineHeight: 1.46, letterSpacing: '0.004em' },
    overline:  { fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.30, letterSpacing: '0.09em', textTransform: 'uppercase' },

    button:    { fontFamily: FONT_UI, fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.2, letterSpacing: 0, textTransform: 'none' },

    badge:        { fontWeight: 600, fontSize: '0.75rem',   lineHeight: 1.2, letterSpacing: '0.03em' },
    price:        { fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.3, letterSpacing: '-0.010em', ...TNUM },
    priceLg:      { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 'clamp(1.75rem, 1.56rem + 0.83vw, 2.25rem)', lineHeight: 1.1, letterSpacing: '-0.022em', ...TNUM },
    priceCompare: { fontWeight: 500, fontSize: '0.875rem',  lineHeight: 1.2, textDecoration: 'line-through', textDecorationThickness: '1px' },
    brandDisplay: { fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 'clamp(1.75rem, 1.21rem + 2.3vw, 2.75rem)', lineHeight: 1.16, letterSpacing: '-0.012em' },
    wordmark:     { fontFamily: FONT_BRAND, fontWeight: 600, fontSize: '1.25rem', lineHeight: 1, letterSpacing: '0.01em' },
  },

  components: {

    /* ====================== GLOBAL ====================== */
    MuiCssBaseline: {
      styleOverrides: `
        /* Tokens, reset, focus, scrollbar and reduced-motion live in index.css.
           This block only carries what must beat MUI's own injected rules. */
        .MuiTypography-gutterBottom { margin-bottom: 0.5em; }
        .MuiPopover-paper, .MuiMenu-paper { background-image: none; }
        /* Labels are static (see MuiInputLabel), so the outline's notch
           spacer legend must collapse. SCOPED deliberately: the design
           system's literal code had a bare "legend { display:none }", which
           also hides every real <fieldset><legend> — e.g. the Checkout
           payment-method radio group's accessible name. */
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
          minHeight: 44,
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
          '&.Mui-disabled': {
            backgroundColor: 'var(--lf-surface-quiet)',
            color: 'var(--lf-ink-4)',
            borderColor: 'var(--lf-border)',
            cursor: 'not-allowed',
            pointerEvents: 'auto',          // so a tooltip/reason can still be read
          },
          '& .MuiButton-startIcon > *:first-of-type, & .MuiButton-endIcon > *:first-of-type': { fontSize: 20 },
        },
        sizeSmall:  { minHeight: 36, padding: '8px 16px', fontSize: '0.9375rem' },
        sizeLarge:  { minHeight: 52, padding: '14px 28px', fontSize: '1rem', borderRadius: 'var(--lf-r-card)' },
        contained: {
          backgroundColor: 'var(--lf-ink)',
          color: 'var(--lf-on-ink)',
          '@media (hover:hover)': { '&:hover': { backgroundColor: '#2A2522' } },
          '&:active': { backgroundColor: '#000000', transform: 'scale(0.972)' },
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
          '&:active': { backgroundColor: '#000000', color: 'var(--lf-on-ink)' },
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
        /* The ONE gold solid button on the site: newsletter Join. */
        { props: { variant: 'brandFill' }, style: {
            minHeight: 44, padding: '12px 20px', borderRadius: 'var(--lf-r-field)',
            fontWeight: 600, fontSize: '0.9375rem',
            backgroundColor: 'var(--lf-gold-fill)', color: '#FFFFFF',
            '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-gold-ink-hv)' } },
            '&:active': { transform: 'scale(0.972)' },
        }},
        /* Destructive: "Remove" must never be the loudest control on the page. */
        { props: { variant: 'destructive' }, style: {
            minHeight: 44, padding: '10px 12px', borderRadius: 'var(--lf-r-field)',
            fontWeight: 600, fontSize: '0.9375rem', color: 'var(--lf-err-ink)',
            backgroundColor: 'transparent',
            '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-err-tint)' } },
        }},
        /* Over imagery only: hero secondary, gallery controls. */
        { props: { variant: 'glass' }, style: {
            minHeight: 44, padding: '12px 20px', borderRadius: 'var(--lf-r-field)',
            fontWeight: 600, fontSize: '0.9375rem',
            color: 'var(--lf-ink)', backgroundColor: 'rgba(255,255,255,0.88)',
            WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)',
            boxShadow: 'var(--lf-e-edge), var(--lf-e1)',
            '@media (hover:hover)': { '&:hover': { backgroundColor: 'rgba(255,255,255,0.96)' } },
        }},
      ],
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44, minHeight: 44,
          borderRadius: 'var(--lf-r-field)',
          color: 'var(--lf-ink)',
          transition: 'background-color var(--lf-dur-2) var(--lf-ease), transform var(--lf-dur-1) var(--lf-ease)',
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'rgba(20,17,15,0.045)' } },
          '&:active': { transform: 'scale(0.972)' },
          '&.Mui-disabled': { color: 'var(--lf-ink-4)' },
        },
        sizeSmall: { minWidth: 36, minHeight: 36, borderRadius: 8 },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 36, borderRadius: 'var(--lf-r-field)', textTransform: 'none',
          fontWeight: 600, fontSize: '0.9375rem',
          color: 'var(--lf-ink-3)', borderColor: 'var(--lf-border-strong)',
          '&.Mui-selected': {
            backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)',
            '&:hover': { backgroundColor: '#2A2522' },
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
          '&.Mui-disabled':{ color: 'var(--lf-ink-4)' },
        },
        outlined: { '&.MuiInputLabel-shrink': { transform: 'none' } },
        asterisk: { display: 'none' },   // we write "(optional)" instead
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 48,
          borderRadius: 'var(--lf-r-field)',
          backgroundColor: 'var(--lf-surface)',
          fontSize: '1rem',                 // >=16px or iOS Safari zooms on focus
          transition: 'border-color var(--lf-dur-2) var(--lf-ease), background-color var(--lf-dur-2) var(--lf-ease)',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-border-field)', borderWidth: 1, top: 0 },
          '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
          '@media (hover:hover)': {
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-ink-3)' },
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-ink)', borderWidth: 1 },
          '&.Mui-focused': { outline: '2px solid var(--lf-focus)', outlineOffset: 2 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-err-ink)', borderWidth: 1 },
          '&.Mui-disabled': {
            backgroundColor: 'var(--lf-surface-quiet)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--lf-border)' },
          },
          '&[readonly], &.lf-readonly': { backgroundColor: 'var(--lf-surface-sunken)' },
        },
        input: {
          padding: '13px 14px',
          color: 'var(--lf-ink)',
          '&::placeholder': { color: 'var(--lf-ink-3)', opacity: 1 },
          '&:-webkit-autofill': { WebkitBoxShadow: '0 0 0 100px var(--lf-surface) inset', WebkitTextFillColor: 'var(--lf-ink)' },
        },
        inputSizeSmall: { padding: '10px 12px' },
        multiline: { padding: 0 },
        sizeSmall: { minHeight: 40 },
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
      defaultProps: { elevation: 0 },
      styleOverrides: {
        paper: {
          marginTop: 6, borderRadius: 'var(--lf-r-field)',
          backgroundColor: 'var(--lf-surface)', backgroundImage: 'none',
          border: '1px solid var(--lf-hairline)', boxShadow: E3,
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 44, borderRadius: 8, fontSize: '0.9375rem',
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-surface-sunken)' } },
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
          padding: 10, color: 'var(--lf-border-field)', borderRadius: 8,
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
        thumb: { width: 22, height: 22, boxShadow: '0 1px 2px rgba(20,17,15,0.2)', backgroundColor: '#FFFFFF' },
        track: { borderRadius: 999, backgroundColor: 'var(--lf-border-strong)', opacity: 1 },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: { marginLeft: -10, marginRight: 0, minHeight: 44 },
        label: { fontSize: '0.9375rem', color: 'var(--lf-ink)' },
      },
    },

    /* ====================== SURFACES ====================== */
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: 'var(--lf-surface)', color: 'var(--lf-ink)' },
        rounded: { borderRadius: 'var(--lf-r-card)' },
        outlined: { border: '1px solid var(--lf-hairline)' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          position: 'relative',
          backgroundColor: 'var(--lf-surface)',
          backgroundImage: 'none',
          borderRadius: 'var(--lf-r-card)',
          border: '1px solid var(--lf-hairline)',
          boxShadow: `var(--lf-e-edge), ${E1}`,
          overflow: 'hidden',
          isolation: 'isolate',
          transition: 'box-shadow var(--lf-dur-3) var(--lf-ease), border-color var(--lf-dur-3) var(--lf-ease), transform var(--lf-dur-1) var(--lf-ease)',
          '@media (hover:hover)': {
            '&:hover': { boxShadow: `var(--lf-e-edge), ${E2}`, borderColor: 'var(--lf-border)' },
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 14, '&:last-child': { paddingBottom: 16 } },
      },
    },
    MuiCardMedia: { styleOverrides: { root: { backgroundColor: 'var(--lf-surface-sunken)' } } },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'var(--lf-hairline)' },
      },
      variants: [
        /* Gold is OPT-IN. The old divider:'rgba(201,169,110,0.15)' default put an
           invisible gold line on every Divider in the app — worst of both. */
        { props: { variant: 'rule' }, style: { borderColor: 'var(--lf-rule-gold)' } },
      ],
    },

    /* ====================== CHROME ====================== */
    MuiAppBar: {
      defaultProps: { position: 'sticky', color: 'transparent', elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: 'var(--lf-surface-glass)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          color: 'var(--lf-ink)',
          backgroundImage: 'none',
          borderBottom: '1px solid var(--lf-hairline)',
          boxShadow: 'var(--lf-e-edge)',
          isolation: 'isolate',
          transform: 'translateZ(0)',
          transition: 'box-shadow var(--lf-dur-2) var(--lf-ease), background-color var(--lf-dur-2) var(--lf-ease)',
          '&[data-scrolled="true"]': { boxShadow: `var(--lf-e-edge), var(--lf-e-nav)` },
          '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
            backgroundColor: '#FDFBF9',
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
        root: {
          paddingLeft: 16, paddingRight: 16,
          '@media (min-width:600px)': { paddingLeft: 24, paddingRight: 24 },
          '@media (min-width:900px)': { paddingLeft: 32, paddingRight: 32 },
          '@media (min-width:1440px)':{ paddingLeft: 40, paddingRight: 40 },
        },
        maxWidthLg: { '@media (min-width:1200px)': { maxWidth: 1232 } },
        maxWidthXl: { '@media (min-width:1536px)': { maxWidth: 1512 } },
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
        root: { backgroundColor: 'var(--lf-overlay)', backdropFilter: 'blur(2px)' },
        invisible: { backgroundColor: 'transparent', backdropFilter: 'none' },
      },
    },
    MuiDrawer: {
      defaultProps: { transitionDuration: { enter: 380, exit: 260 }, elevation: 0 },
      styleOverrides: {
        paper: {
          backgroundColor: 'var(--lf-canvas)', backgroundImage: 'none',
          boxShadow: E4, border: 0, overscrollBehavior: 'contain',
        },
        paperAnchorLeft:   { width: '88vw', maxWidth: 360, borderTopRightRadius: 'var(--lf-r-panel)', borderBottomRightRadius: 'var(--lf-r-panel)' },
        paperAnchorRight:  { width: '88vw', maxWidth: 400, borderTopLeftRadius: 'var(--lf-r-panel)',  borderBottomLeftRadius: 'var(--lf-r-panel)' },
        paperAnchorBottom: { maxHeight: '92dvh', borderTopLeftRadius: 'var(--lf-r-panel)', borderTopRightRadius: 'var(--lf-r-panel)' },
      },
    },
    MuiDialog: {
      defaultProps: { fullWidth: true, maxWidth: 'sm', transitionDuration: { enter: 380, exit: 260 }, scroll: 'paper' },
      styleOverrides: {
        paper: {
          borderRadius: 'var(--lf-r-panel)',
          backgroundColor: 'var(--lf-surface)', backgroundImage: 'none',
          boxShadow: `var(--lf-e-edge), ${E4}`,
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
      styleOverrides: { root: { padding: '20px 24px 8px', fontFamily: FONT_DISPLAY, fontSize: '1.25rem', fontWeight: 600 } },
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
      defaultProps: { elevation: 0 },
      styleOverrides: {
        paper: { borderRadius: 'var(--lf-r-field)', border: '1px solid var(--lf-hairline)', boxShadow: E3, backgroundImage: 'none' },
      },
    },
    MuiTooltip: {
      defaultProps: { enterTouchDelay: 0, leaveTouchDelay: 4000, arrow: false },
      styleOverrides: {
        tooltip: {
          backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)',
          fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.46,
          padding: '8px 12px', borderRadius: 'var(--lf-r-chip)', maxWidth: 280,
        },
        arrow: { color: 'var(--lf-ink)' },
      },
    },

    /* ====================== NAVIGATION ====================== */
    MuiTabs: {
      defaultProps: { variant: 'scrollable', scrollButtons: false, allowScrollButtonsMobile: true },
      styleOverrides: {
        root: { minHeight: 48, borderBottom: '1px solid var(--lf-hairline)' },
        indicator: {
          height: 2, borderRadius: 2, backgroundColor: 'var(--lf-gold-edge)',
          transition: 'left var(--lf-dur-3) var(--lf-ease-inout), width var(--lf-dur-3) var(--lf-ease-inout)',
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
          '@media (hover:hover)': { '&:hover': { color: 'var(--lf-ink)', backgroundColor: 'var(--lf-surface-sunken)' } },
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
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-surface-sunken)' } },
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
          minWidth: 40, height: 40, margin: '0 3px',
          borderRadius: 'var(--lf-r-field)',
          fontSize: '0.9375rem', fontWeight: 600, color: 'var(--lf-ink)',
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-surface-sunken)' } },
          '&.Mui-selected': {
            backgroundColor: 'var(--lf-ink)', color: 'var(--lf-on-ink)',
            '&:hover': { backgroundColor: '#2A2522' },
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
          backgroundColor: 'var(--lf-surface-sunken)', color: 'var(--lf-ink)',
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
        /* The one place --lf-gold is a fill: "Bestseller", with an ink label (8.4:1). */
        { props: { variant: 'bestseller' }, style: { backgroundColor: 'var(--lf-gold)', color: 'var(--lf-ink)' } },
      ],
    },
    MuiRating: {
      defaultProps: { precision: 0.5, readOnly: true, size: 'small' },
      styleOverrides: {
        root: { color: 'var(--lf-gold-edge)' },     /* 3.50:1, not #C9A96E at 1.76:1 */
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
        root: { backgroundColor: 'var(--lf-surface-quiet)', transform: 'none' },
        rounded: { borderRadius: 'var(--lf-r-chip)' },
        text: { borderRadius: 4, transform: 'none' },
      },
    },
    MuiCircularProgress: {
      defaultProps: { size: 16, thickness: 3.6, color: 'inherit' },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 4, borderRadius: 999, backgroundColor: 'var(--lf-surface-quiet)' },
        bar: { borderRadius: 999, backgroundColor: 'var(--lf-gold-edge)' },
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
          '@media (hover:hover)': { '&:hover': { backgroundColor: 'var(--lf-surface-sunken)' } },
          '&.Mui-selected': { backgroundColor: 'var(--lf-gold-tint)' },
        },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          display: 'h1', brandDisplay: 'h2', wordmark: 'span',
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
        { props: { variant: 'wordmark' },     style: { fontFamily: FONT_BRAND } },
        { props: { variant: 'price' },        style: TNUM },
        { props: { variant: 'priceLg' },      style: TNUM },
        { props: { variant: 'priceCompare' }, style: { ...TNUM, color: 'var(--lf-ink-3)' } },
      ],
    },
  },
});

export default theme;
