# Le foyeR. — Final Design System: **"Counter"**
### One system, synthesised from Proposals A / B / C. Buildable with zero further decisions.

I read the real files before writing this. Everything below is a true replacement for `frontend/src/theme.js` and `frontend/src/index.css`, verified against the actual repo:

| Claim | Verified |
|---|---|
| MUI version | **7.3.5**, and `GridLegacy` exists → the 12 files using `<Grid item xs>` render **unstyled** today |
| `antd@^5.11.5` | installed, **zero imports** in all 55 src files |
| `Oswald` | referenced in `Hero.jsx`, `FeaturedProducts.jsx`, `NewYearBanner.jsx` — **never loaded** |
| `Playfair Display` | referenced in **7 files** (`CartSummary`, `Login`, `SignUp`, `Wishlist`, `VerifyEmail`, `OrderConfirmation`, `InstagramFeed`) — **never loaded** (all three proposals undercounted this) |
| `Cormorant Garamond` | hard-coded in **16 files** + `theme.js` + `index.css` |
| `mockApi` | imported by `ProductFilter.jsx`, `ProductReviews.jsx`, `RelatedProducts.jsx` while pages use `api.js` |
| PDP | `flexWrap:'nowrap'` + two hard `width:'50%'` columns at **every** breakpoint; `images.slice(0,4)` |
| `Layout.jsx:15` | `{!isHome && <Toolbar />}` → home hero renders under the fixed bar |
| `#FAFAFA` page bg | 6 files; Amazon `#FF9900`/`#B12704` in `ProductDetail.jsx` |
| Images | `Spotless_1-10` + `WhiteWave_1-9` at **1.18–6.10 MB** each; **35 of the 40** `product-N*.jpg` files are byte-identical placeholders (md5 `0a566111…`) |

---

# 1. Scorecard

Scored 1–5. Weighted by what actually ships revenue.

| | **A — Apothecary Grid** | **B — Hearthglass** | **C — Counter** |
|---|---|---|---|
| Brand fit | **5** — warm paper, brown-black ink, gold rationed to one hairline. The most *brand* of the three. | 4 — "hearth = warm light" is a genuine insight, but glass is a 2024 tech idiom, not an Indian skincare idiom. | 4 — warm but cooler-feeling; brand warmth is structural, not expressive. Needs the gold hairline grafted back in. |
| Legibility vs the owner's rejection | **3** — Fraunces at h1–h3 with `opsz 24` pinning is smart and well-argued, **but it is still a serif at 48–64px**. The owner rejected display serifs; answering with a different display serif is relitigating a settled decision. | **3** — same risk, plus `SOFT 45` and a variable `opsz` axis = more ways for the render to go wrong on a cheap Android. | **5** — Inter Tight is the *same skeleton* as Inter, so it can never read as "fancy". Fraunces rationed to 3 brand moments at a 20px floor. This is the only answer that cannot relitigate the complaint. |
| Commerce effectiveness | 4 — permanent Add-to-bag, StatusLabel always rendered, PriceBlock unified. Excellent. But "no cards, no shadows, no boxes" at **2-up on a 320px phone** = 134px tiles that cannot hold `₹1,299 ₹1,599 Save 19%`. | 4 — the floating glass purchase card in the hero is the single best merchandising idea in all three. But glass *over* commerce text is a contrast liability it then has to write three rules to escape. | **5** — 8 full product cards as the fold-breaker on home, pinned OrderSummary, buy-box sticky for the full gallery height, price in the CTA label, stock promoted to a first-class signal. |
| Mobile reality at 320px | 2 — asserts 2-up at 320px (134px cards). Does the arithmetic and then ignores what the arithmetic means. | 4 — correctly goes 1-up below 360px and switches the card to horizontal. `dvh` everywhere. Good. | **5** — 1-up below 360px, and **every** component has its 288px math written out and checked (buy bar 104+8+168=280; cart line 64+12+212=288). |
| MUI v7 implementability | 3 — `cssVariables` + `CssVarsProvider` + `InitColorSchemeScript` + dark scheme, **all in the same pass as 16 component rewrites**. That is the heroics the brief forbids. | 2 — `palette.lf` with 40 keys authored as `var(--lf-x, fallback)`, a `[data-glass]` runtime attribute, drag-dismiss physics, scroll-reveal IO, a design-token indirection layer. This is a 6-week platform project wearing a design spec. | **5** — `augmentColor` for the gold scale, a correct 25-entry `shadows` array, `spacing` deliberately left at 8 to avoid silently halving ~40 existing `p:3`/`py:8` call sites, `MuiUseMediaQuery.noSsr`. It knows the library. |
| Low-end Android perf | **5** — no blur except nav + search overlay; no autoplay; transform/opacity only. | 2 — and B *knows* it: it prices `backdrop-filter` at 4–9 ms/frame on a 16.6 ms budget, then ships a device-gate to turn its own signature move off. A design whose fallback is "lose the glass, keep 90% of the design" has told you the glass was decoration. | **5** — blur on nav + overlays only, `@supports` fallback, pulse over travelling shimmer. |

**Pretty but impractical:** B's glass-everything (self-admittedly gated off on the exact Android population this store sells to); B's `palette.lf` var-indirection layer; A's `cssVariables` + dark mode + 16 rewrites in one pass; A's 2-up 320px grid.

**Practical but cheap-looking:** C's `--lf-surface #FFFFFF` card on `--lf-canvas #FDFBF9` with a `--lf-hairline` border is one notch from a generic SaaS card — it needs A's gold section hairline and B's `inset 0 1px 0` top edge to earn the premium read. C's footer is also under-designed next to A's.

**Honest scores:** C **4.7** · A **3.7** · B **3.2**.

---

# 2. Verdict and the conflict decisions

**Spine: Proposal C.** It is the only one that respects the owner's font rejection without reopening it, the only one whose 320px claims survive arithmetic, and the only one written by someone who has actually shipped MUI v7.

Conflicts, decided, one line each:

1. **Display face → Inter Tight 700, not Fraunces.** The owner rejected display serifs; answering with a sturdier serif is still arguing — Inter Tight shares Inter's skeleton so it is structurally incapable of reading as "fancy".
2. **Fraunces survives, rationed.** Three uses only — nav wordmark (20px), one home interstitial headline, footer wordmark (28px) — at a hard **20px/600 floor**, because the brand needs one warm voice and 20px+ at weight 600 is not where Cormorant failed.
3. **Primary CTA → ink `#14110F`, not gold.** Gold-with-ink-label passes contrast (8.4:1) but a 9-card grid of gold buttons turns the accent into a theme colour; ink is the most legible and most Apple-like, and it keeps gold precious.
4. **Gold is retiered, not retired (A's rule, C's values).** `#C9A96E` stays the brand mark but is **typed non-text**; `--lf-gold-ink #7A5A24` (6.14:1) carries type, `--lf-gold-edge #A8803A` (3.50:1) carries indicators.
5. **Radius 14, not 0.** A's "paper is sharp" is a defensible luxury idiom but it is the *opposite* of the stated reference; Apple's store is built on continuous corners.
6. **No auto dark mode this release** (B+C over A). Every real product shot is on a blown-out white sweep — on `#121110` each card becomes a glowing white rectangle, and the brand's equity *is* warm light. We ship `color-scheme: light`, a proven dark surface (`.lf-ink-section`) for footer + interstitial, and the full dark table ready behind `[data-theme="dark"]`.
7. **Glass: nav + overlays only** (A's discipline over B's ambition), with `@supports` fallback and a `prefers-reduced-transparency` opt-out. No blur on anything inside a scrolling list, ever.
8. **Card chrome: C's frame + A's gold section rule + B's inset top edge.** `--lf-e1` already contains a `0 0 0 1px` hairline, and `--lf-e-edge` adds a 1px warm-white top highlight — that is what stops the card reading as a SaaS card.
9. **Grid at 320px: 1-up** (B+C over A). 134px cannot hold a price, a compare-at, a savings chip and a 44px button.
10. **Section pattern: A's editorial unit, kept.** overline → h2 → 1px gold hairline is the single most repeated gold element on the site, and it is how one accent still reads as a brand.
11. **`overflow-x: clip` on `html`, not `hidden` on `body`** (A). `hidden` masks the three real overflows *and* silently breaks `position: sticky`, which this design depends on in four places.
12. **Press gesture: B's scale ladder by surface size**, because one scale value distorts visibly across a 36px chip and a 400px panel.
13. **Toast: B's shell** (thumbnail, progress hairline, pause-on-hover, stack-of-2) on **C's geometry and semantics** (`role=region`, bottom-offset above the buy bar).
14. **Filters on mobile: staged, with "Show N products"** (B), not live — live refetch per tick is unusable on Indian 4G.
15. **Hero: C's layout + B's floating purchase card.** A real transaction above the fold is what makes this a store rather than a mood board; it is translucent-*looking* (opaque `#FFFDFB`), not real glass, because it sits over an image.
16. **Empty/error: no illustrations, ever.** A glyph in a tinted circle, a heading, one line, one primary, one escape, and real products. Decided in §6.9.
17. **`spacing` stays at 8** (B+C). Changing it to 4 silently halves ~40 existing call sites.
18. **MUI `cssVariables` stays OFF.** `index.css` is the single var source; `theme.palette` holds real hex so `alpha()` and `augmentColor` keep working. One var layer, not two.

---

# 3. Fonts

Three families, six files, ~96 KB woff2 (latin). **Delete the blocking `@import` at the top of `index.css`** — it serialises the font fetch behind the CSS parse.

### `frontend/index.html` — replace the existing font `<link>` block with exactly this

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#FDFBF9" />
<meta name="color-scheme" content="only light" />

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&family=Fraunces:opsz,wght@72,600&display=swap">

<link rel="preload" as="image" fetchpriority="high" href="/images/hero-1200.webp">
```

`viewport-fit=cover` is **required** or every `env(safe-area-inset-*)` in this system resolves to 0.

| Role | Family | Weights | Licence of use |
|---|---|---|---|
| Display — `display`, `h1`–`h4`, `priceLg` | **Inter Tight** | 600, 700 | Unlimited |
| UI, body, all commerce text | **Inter** | 400, 500, 600, 700 | Unlimited |
| Brand voice | **Fraunces** `opsz 72 / wght 600` | 600 | **Exactly 3 places. 20px hard floor.** Never body, never prices, never product names, never nav links. |

Stacks:
```
--lf-font-ui:      'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
--lf-font-display: 'Inter Tight', 'Inter', system-ui, -apple-system, sans-serif
--lf-font-brand:   'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif
```

---

# 4. `frontend/src/index.css` — complete replacement

```css
/* ============================================================================
   Le foyeR. — "Counter" design system
   Single source of truth for design tokens. theme.js reads these by name.
   Fonts are loaded in index.html via <link>. NEVER @import them here.
   ========================================================================== */

/* --- Fallback metric override: kills the font-swap layout shift ----------- */
@font-face {
  font-family: 'Inter-fallback';
  src: local('Arial'), local('Helvetica'), local('Roboto');
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

/* ============================================================================
   1. TOKENS
   Contrast ratios are measured against the surface named. Any token marked
   NON-TEXT is forbidden as a text colour — it exists for fills and borders.
   ========================================================================== */
:root {
  color-scheme: only light;

  /* --- Typeface stacks --- */
  --lf-font-ui:      'Inter', 'Inter-fallback', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --lf-font-display: 'Inter Tight', 'Inter', 'Inter-fallback', system-ui, -apple-system, sans-serif;
  --lf-font-brand:   'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;

  /* --- Surfaces: warm, never neutral grey. #FAFAFA is banned sitewide. --- */
  --lf-canvas:         #FDFBF9;  /* page background, EVERY page */
  --lf-surface:        #FFFFFF;  /* cards, buy-box, panels, inputs */
  --lf-surface-raised: #FFFDFB;  /* panel on a panel; the hero purchase card */
  --lf-surface-sunken: #F6F2EC;  /* image mats, gallery frame, inert wells */
  --lf-surface-quiet:  #F0ECE6;  /* disabled fills, skeleton base */
  --lf-surface-glass:  rgba(253, 251, 249, 0.82); /* nav + sticky bars ONLY */
  --lf-sheet-glass:    rgba(253, 251, 249, 0.92); /* drawers + overlays ONLY */
  --lf-overlay:        rgba(20, 17, 15, 0.56);    /* modal / drawer scrim */
  --lf-blur:           blur(20px) saturate(180%);

  /* --- Ink tiers --- */
  --lf-ink:    #14110F;  /* 18.4:1 canvas · 18.8:1 white — headings, body, PRICE */
  --lf-ink-2:  #4A433C;  /*  9.42:1 canvas — long-form body, descriptions */
  --lf-ink-3:  #6B635A;  /*  5.72:1 canvas · 5.29:1 sunken — captions, meta */
  --lf-ink-4:  #8A8178;  /*  3.70:1 — NON-TEXT ONLY: field borders, disabled glyphs */
  --lf-on-ink: #FFFFFF;  /* 18.8:1 on --lf-ink */

  /* --- Gold, RETIERED. This is the brand-equity fix. --- */
  --lf-gold:        #C9A96E;  /* 2.17:1 — NON-TEXT ONLY. Badge fills (ink label = 8.4:1),
                                 hairline rules, stars on dark, wordmark on ink. */
  --lf-gold-edge:   #A8803A;  /* 3.50:1 — NON-TEXT indicators: selected thumb border,
                                 active tab underline, star fill on light, progress */
  --lf-gold-ink:    #7A5A24;  /* 6.14:1 canvas · 6.33:1 white — gold AS TEXT: eyebrows,
                                 tertiary links, "Notify me" */
  --lf-gold-ink-hv: #6E4F1E;  /* 7.27:1 — hover/visited for the above */
  --lf-gold-fill:   #8C6A24;  /* white label = 5.00:1 — the ONE gold solid button (Join) */
  --lf-gold-tint:   #F7F0E2;  /* eyebrow/badge wash. ink on it = 15.9:1 */
  --lf-gold-tint-2: #EFE4CE;  /* pressed state of the above */
  --lf-rule-gold:   rgba(201, 169, 110, 0.42); /* THE section hairline under every h2 */

  /* --- Borders --- */
  --lf-hairline:      #E7E0D6;  /* default separator (decorative) */
  --lf-border:        #DED6C9;  /* card hover border, table rules */
  --lf-border-strong: #C9BFAE;  /* chip outlines, weighted dividers */
  --lf-border-field:  #8A8178;  /* 3.70:1 — MANDATORY on input/checkbox/radio (SC 1.4.11) */
  --lf-border-ink:    #14110F;  /* secondary button, selected tile */

  /* --- Semantic --- */
  --lf-ok-ink:    #15663D;  /* 6.78:1 — "In stock", "Save 19%", "Free delivery" */
  --lf-ok:        #1E7A4D;  /* 5.16:1 — the 6px stock dot, check glyphs */
  --lf-ok-tint:   #E7F4EC;  /* ok-ink on it = 6.18:1 */
  --lf-warn-ink:  #7A4F00;  /* 6.91:1 — "Only 3 left", "Ships in 5-7 days" */
  --lf-warn-tint: #FDF3E0;  /* warn-ink on it = 6.47:1 */
  --lf-err-ink:   #A01C15;  /* 7.61:1 canvas · 7.86:1 white-on-it */
  --lf-err-tint:  #FCECEA;  /* err-ink on it = 6.86:1 */

  /* --- Focus --- */
  --lf-focus:         #14110F;  /* 18.4:1 ring on every light surface */
  --lf-focus-on-ink:  #E3C78C;  /* 11.5:1 ring inside .lf-ink-section */
  --lf-focus-inner:   #FDFBF9;  /* the 1px separator that keeps the ring alive on ink fills */

  /* --- Spacing: 4px scale for raw CSS. MUI spacing() stays at 8. --- */
  --lf-1:4px;   --lf-2:8px;   --lf-3:12px;  --lf-4:16px;  --lf-5:20px;
  --lf-6:24px;  --lf-8:32px;  --lf-10:40px; --lf-12:48px; --lf-16:64px;
  --lf-20:80px; --lf-24:96px; --lf-30:120px;--lf-40:160px;

  /* --- Radii: tiered by component class. shape.borderRadius = 14. --- */
  --lf-r-chip:6px;    --lf-r-field:10px; --lf-r-card:14px;
  --lf-r-panel:18px;  --lf-r-media:24px; --lf-r-pill:999px;

  /* --- Elevation: warm-tinted rgba(20,17,15). Never neutral black. --- */
  --lf-e0: none;
  --lf-e1: 0 1px 2px rgba(20,17,15,0.05), 0 0 0 1px rgba(20,17,15,0.045);
  --lf-e2: 0 2px 4px rgba(20,17,15,0.05), 0 8px 20px -6px rgba(20,17,15,0.09);
  --lf-e3: 0 4px 8px rgba(20,17,15,0.06), 0 18px 36px -10px rgba(20,17,15,0.13);
  --lf-e4: 0 8px 16px rgba(20,17,15,0.07), 0 36px 72px -18px rgba(20,17,15,0.19);
  --lf-e-nav: 0 1px 0 rgba(20,17,15,0.07), 0 6px 20px -10px rgba(20,17,15,0.10);
  --lf-e-bar: 0 -1px 0 rgba(20,17,15,0.08), 0 -10px 28px -10px rgba(20,17,15,0.11);
  --lf-e-edge: inset 0 1px 0 rgba(255,255,255,0.72); /* the 1px top highlight */

  /* --- Motion --- */
  --lf-dur-1:110ms;  /* press, tick, badge bump */
  --lf-dur-2:180ms;  /* colour, border, shadow, icon rotate, nav condense */
  --lf-dur-3:260ms;  /* image crossfade, card raise, accordion, tab indicator */
  --lf-dur-4:380ms;  /* overlay, drawer, modal, route transition */
  --lf-ease:        cubic-bezier(0.22, 0.61, 0.36, 1);
  --lf-ease-out:    cubic-bezier(0.16, 1.00, 0.30, 1);
  --lf-ease-in:     cubic-bezier(0.40, 0.00, 1.00, 1.00);
  --lf-ease-inout:  cubic-bezier(0.45, 0.05, 0.55, 0.95);
  --lf-ease-spring: cubic-bezier(0.34, 1.26, 0.64, 1);

  /* --- Layout --- */
  --lf-nav-h: 56px;
  --lf-bar-h: 0px;          /* set to 68px by JS while a sticky bottom bar is mounted */
  --lf-container: 1232px;
}

@media (min-width: 900px) { :root { --lf-nav-h: 64px; } }

/* --- The inverted surface. Redeclares the SAME names, so every child
       component works unchanged inside it with zero overrides. ------------- */
.lf-ink-section {
  --lf-canvas:#14110F; --lf-surface:#1C1917; --lf-surface-raised:#211E1B;
  --lf-surface-sunken:#211E1B; --lf-surface-quiet:#262320;
  --lf-ink:#F7F4F0;    /* 17.2:1 */
  --lf-ink-2:#D3CBC2;  /* 11.0:1 */
  --lf-ink-3:#A8A099;  /*  7.30:1 */
  --lf-ink-4:#8F877E;  /*  5.33:1 */
  --lf-on-ink:#14110F;
  --lf-gold:#C9A96E;       /* 8.4:1 — legible as TEXT here, and only here */
  --lf-gold-edge:#C9A96E;
  --lf-gold-ink:#E3C78C;   /* 11.5:1 */
  --lf-gold-ink-hv:#EFD9AC;
  --lf-gold-fill:#DDBE84;
  --lf-gold-tint:rgba(201,169,110,0.16);
  --lf-gold-tint-2:rgba(201,169,110,0.24);
  --lf-rule-gold:rgba(201,169,110,0.34);
  --lf-hairline:rgba(247,244,240,0.12); --lf-border:rgba(247,244,240,0.18);
  --lf-border-strong:rgba(247,244,240,0.28); --lf-border-field:rgba(247,244,240,0.46);
  --lf-border-ink:#F7F4F0;
  --lf-ok-ink:#5FCB93;  --lf-ok:#5FCB93;  --lf-ok-tint:rgba(95,203,147,0.14);
  --lf-warn-ink:#EFBC6A; --lf-warn-tint:rgba(239,188,106,0.14);
  --lf-err-ink:#F4A49F;  --lf-err-tint:rgba(244,164,159,0.14);
  --lf-focus:var(--lf-focus-on-ink);
  --lf-focus-inner:#14110F;
  --lf-e-edge: inset 0 1px 0 rgba(255,255,255,0.08);
  background: var(--lf-canvas);
  color: var(--lf-ink);
  color-scheme: dark;
}

/* --- Dark theme: SPECIFIED, NOT ENABLED. Do not wire a toggle until the
       catalogue is re-shot on a dark set or image_main_dark exists. -------- */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* INTENTIONALLY EMPTY THIS RELEASE */ }
}
html[data-theme="dark"] {
  color-scheme: dark;
  --lf-canvas:#121110; --lf-surface:#1A1816; --lf-surface-raised:#211E1B;
  --lf-surface-sunken:#211E1B; --lf-surface-quiet:#262320;
  --lf-surface-glass:rgba(18,17,16,0.82); --lf-sheet-glass:rgba(18,17,16,0.94);
  --lf-overlay:rgba(0,0,0,0.68);
  --lf-ink:#F5F2EE; --lf-ink-2:#D3CBC2; --lf-ink-3:#A8A099; --lf-ink-4:#8F877E;
  --lf-on-ink:#121110;
  --lf-gold:#C9A96E; --lf-gold-edge:#C9A96E; --lf-gold-ink:#E3C78C;
  --lf-gold-ink-hv:#EFD9AC; --lf-gold-fill:#DDBE84;
  --lf-gold-tint:rgba(201,169,110,0.14); --lf-gold-tint-2:rgba(201,169,110,0.22);
  --lf-rule-gold:rgba(201,169,110,0.34);
  --lf-hairline:rgba(245,242,238,0.10); --lf-border:rgba(245,242,238,0.16);
  --lf-border-strong:rgba(245,242,238,0.26); --lf-border-field:rgba(245,242,238,0.46);
  --lf-border-ink:#F5F2EE;
  --lf-ok-ink:#5FCB93; --lf-ok:#5FCB93; --lf-ok-tint:rgba(95,203,147,0.14);
  --lf-warn-ink:#EFBC6A; --lf-warn-tint:rgba(239,188,106,0.14);
  --lf-err-ink:#F4A49F; --lf-err-tint:rgba(244,164,159,0.14);
  --lf-focus:#E3C78C; --lf-focus-inner:#121110;
  --lf-e1:0 0 0 1px rgba(245,242,238,0.08);
  --lf-e2:0 0 0 1px rgba(245,242,238,0.14), 0 8px 24px -8px rgba(0,0,0,0.6);
  --lf-e3:0 0 0 1px rgba(245,242,238,0.16), 0 20px 48px -12px rgba(0,0,0,0.7);
  --lf-e4:0 0 0 1px rgba(245,242,238,0.18), 0 40px 80px -20px rgba(0,0,0,0.8);
  --lf-e-edge: inset 0 1px 0 rgba(255,255,255,0.08);
}
html[data-theme="dark"] img[data-product] { background: #F5F2EE; }

/* ============================================================================
   2. RESET
   ========================================================================== */
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; padding: 0; }

html {
  font-size: 100%;                 /* never a % reset — rem must track user prefs */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  overflow-x: clip;                /* NOT overflow:hidden on body — that kills sticky */
  scroll-padding-top: calc(var(--lf-nav-h) + 16px);
}

body {
  font-family: var(--lf-font-ui);
  font-size: 1rem;
  line-height: 1.6;
  background: var(--lf-canvas);
  color: var(--lf-ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  -webkit-tap-highlight-color: transparent;
  min-height: 100dvh;
}

body.lf-scroll-locked { position: fixed; inset: 0; width: 100%; overflow: hidden; }

h1, h2, h3, h4 { font-family: var(--lf-font-display); text-wrap: balance; }
h1, h2, h3 { overflow-wrap: anywhere; hyphens: none; }
p  { text-wrap: pretty; }
img, svg, video { display: block; max-width: 100%; }
button, input, select, textarea { font: inherit; color: inherit; }
button { background: none; border: 0; cursor: pointer; touch-action: manipulation; }
a { color: var(--lf-gold-ink); text-underline-offset: 3px; }
a:hover { color: var(--lf-gold-ink-hv); }
[hidden] { display: none !important; }

/* ============================================================================
   3. FOCUS — one ring, everywhere, no exceptions
   ========================================================================== */
*:focus-visible {
  outline: 2px solid var(--lf-focus);
  outline-offset: 2px;
  border-radius: inherit;
}
*:focus:not(:focus-visible) { outline: none; }

/* Inside a scroll container the ring must not be clipped */
.lf-scroll *:focus-visible,
[data-scroll-region] *:focus-visible { outline-offset: -2px; }

/* On an ink fill or a gold fill: two-layer ring so it survives any backdrop */
.lf-ring-inset:focus-visible,
.MuiButton-containedPrimary.Mui-focusVisible,
[data-on-fill]:focus-visible {
  outline: 2px solid var(--lf-focus-inner);
  outline-offset: -4px;
  box-shadow: 0 0 0 2px var(--lf-focus-inner), 0 0 0 4px var(--lf-focus);
}
.lf-ink-section *:focus-visible { outline-color: var(--lf-focus-on-ink); }

/* Skip link — the first focusable element on every page */
.lf-skip-link {
  position: fixed; top: -200px; left: 16px; z-index: 2000;
  display: inline-flex; align-items: center; height: 44px; padding: 0 20px;
  background: var(--lf-ink); color: var(--lf-on-ink);
  font: 600 0.9375rem/1 var(--lf-font-ui);
  border-radius: var(--lf-r-pill); text-decoration: none;
  transition: top var(--lf-dur-2) var(--lf-ease-out);
}
.lf-skip-link:focus-visible { top: 8px; }

/* ============================================================================
   4. SELECTION + SCROLLBAR
   ========================================================================== */
::selection { background: var(--lf-gold-tint-2); color: var(--lf-ink); } /* was 1.9:1 */

* { scrollbar-width: thin; scrollbar-color: var(--lf-border) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--lf-border); border-radius: 999px;
  border: 3px solid transparent; background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background: var(--lf-ink-3); background-clip: content-box; }
.lf-rail::-webkit-scrollbar { height: 0; width: 0; }
.lf-rail { scrollbar-width: none; }

/* ============================================================================
   5. UTILITIES
   ========================================================================== */
.lf-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.lf-rupee::before { content: "\20B9"; margin-right: 0.08em; }
.lf-clamp-1,.lf-clamp-2,.lf-clamp-3,.lf-clamp-4,.lf-clamp-5 {
  display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;
}
.lf-clamp-1{-webkit-line-clamp:1}.lf-clamp-2{-webkit-line-clamp:2}
.lf-clamp-3{-webkit-line-clamp:3}.lf-clamp-4{-webkit-line-clamp:4}
.lf-clamp-5{-webkit-line-clamp:5}

.lf-sr-only {
  position:absolute; width:1px; height:1px; padding:0; margin:-1px;
  overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0;
}

/* THE section rule. One line of gold under every h2 on the site. */
.lf-rule { height:1px; border:0; background: var(--lf-rule-gold); width:100%; }

/* Image mat: every product image lives in one of these */
.lf-media {
  position: relative; overflow: hidden;
  background: var(--lf-surface-sunken);
  border-radius: var(--lf-r-field);
  box-shadow: inset 0 0 0 1px var(--lf-hairline);
}
.lf-media > img { width:100%; height:100%; object-fit:cover; }
.lf-media[data-fit="contain"] > img { object-fit: contain; padding: 8%; }
.lf-ar-1x1 { aspect-ratio: 1 / 1; }
.lf-ar-4x5 { aspect-ratio: 4 / 5; }
.lf-ar-21x9 { aspect-ratio: 21 / 9; }

/* Translucent chrome — nav and sticky bars only. Never inside a list. */
.lf-glass {
  background: var(--lf-surface-glass);
  -webkit-backdrop-filter: var(--lf-blur);
  backdrop-filter: var(--lf-blur);
  box-shadow: var(--lf-e-edge);
  isolation: isolate;           /* keeps the compositing layer stable */
  transform: translateZ(0);
}
.lf-sheet-glass {
  background: var(--lf-sheet-glass);
  -webkit-backdrop-filter: var(--lf-blur);
  backdrop-filter: var(--lf-blur);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .lf-glass { background: #FDFBF9; }
  .lf-sheet-glass { background: #FDFBF9; }
  html[data-theme="dark"] .lf-glass,
  html[data-theme="dark"] .lf-sheet-glass { background: #121110; }
}
@media (prefers-reduced-transparency: reduce) {
  .lf-glass, .lf-sheet-glass {
    background: var(--lf-canvas);
    -webkit-backdrop-filter: none; backdrop-filter: none;
  }
}
/* Low-end Android gate. One attribute, set once at boot. No component knows. */
html[data-glass="off"] .lf-glass,
html[data-glass="off"] .lf-sheet-glass {
  background: var(--lf-canvas);
  -webkit-backdrop-filter: none; backdrop-filter: none;
}

/* Scroll-snap rail */
.lf-rail {
  display: flex; gap: var(--lf-3);
  overflow-x: auto; overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory; scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scroll-padding-inline: var(--lf-4);
}
.lf-rail > * { scroll-snap-align: start; flex: 0 0 auto; }

.lf-safe-bottom { padding-bottom: calc(var(--lf-4) + env(safe-area-inset-bottom, 0px)); }
.lf-above-bar { bottom: calc(var(--lf-4) + var(--lf-bar-h) + env(safe-area-inset-bottom, 0px)); }

/* The press gesture. Scale by surface size so nothing visibly distorts. */
.lf-press       { transition: transform var(--lf-dur-1) var(--lf-ease); }
.lf-press:active            { transform: scale(0.972); }  /* button, chip, icon */
.lf-press[data-press="card"]:active { transform: scale(0.985); }
.lf-press[data-press="row"]:active  { transform: scale(0.992); }
.lf-press[data-press="panel"]:active{ transform: none; opacity: 0.94; } /* >320px */

/* ============================================================================
   6. SKELETONS
   ========================================================================== */
@keyframes lf-shimmer { from { transform: translate3d(-100%,0,0); } to { transform: translate3d(100%,0,0); } }
@keyframes lf-pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }

.lf-skel {
  position: relative; overflow: hidden;
  background: var(--lf-surface-quiet);
  border-radius: var(--lf-r-chip);
}
.lf-skel--text { animation: lf-pulse 1400ms var(--lf-ease-inout) infinite; }
.lf-skel--media::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(100deg,
    rgba(255,255,255,0) 20%,
    rgba(255,255,255,0.62) 50%,
    rgba(255,255,255,0) 80%);
  animation: lf-shimmer 1400ms linear infinite;
}
html[data-glass="off"] .lf-skel--media::after { animation: none; content: none; }

/* ============================================================================
   7. REDUCED MOTION — behavioural, not just durational
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  :root {
    --lf-dur-1:1ms; --lf-dur-2:1ms; --lf-dur-3:1ms; --lf-dur-4:1ms;
    --lf-ease-spring: var(--lf-ease);
  }
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  html, .lf-rail { scroll-behavior: auto !important; }
  .lf-skel--text  { animation: none; opacity: 1; }
  .lf-skel--media::after { animation: none; content: none; }
  .lf-press:active, .lf-press[data-press]:active { transform: none; }
  /* Overlays and drawers appear in place rather than travelling */
  [data-motion="enter"] { transform: none !important; }
}

/* ============================================================================
   8. HIGH CONTRAST
   ========================================================================== */
@media (prefers-contrast: more) {
  :root {
    --lf-hairline: rgba(20,17,15,0.24);
    --lf-border: rgba(20,17,15,0.34);
    --lf-ink-3: #514A41;
  }
  *:focus-visible { outline-width: 3px; }
}

/* ============================================================================
   9. HOVER GUARD — every hover style in the app lives inside this query.
      A tap must never leave a control stuck in its hover state.
   ========================================================================== */
@media (hover: none) {
  .lf-media > img { transform: none !important; }
}
```

**Deleted from the old file:** the blocking `@import`, `.font-serif`, `.font-sans`, `.glass-panel`, `.glass-header`, `.animate-fade-in`, `@keyframes fadeIn`, the unconditional `html { scroll-behavior: smooth }` (a vestibular trigger), `body { overflow-x: hidden }`, `::selection { background:#C9A96E; color:white }` (1.9:1 — selecting text currently makes it *harder* to read), and the `--color-*` variable set.

---

# 5. `frontend/src/theme.js` — complete replacement

```js
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
        legend { display: none; }
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
```

### `main.jsx` boot additions (3 lines, before `render`)

```js
// Low-end Android gate: one attribute, set once. No component knows it happened.
const lowEnd = (navigator.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
if (lowEnd) document.documentElement.setAttribute('data-glass', 'off');
```

---

# 6. The Apple-grade details the proposals under-specified

### 6.1 Focus-visible ring — exact, three cases

| Case | Declaration |
|---|---|
| Any control on a light surface | `outline: 2px solid #14110F; outline-offset: 2px; border-radius: inherit` → **18.4:1**, 6× the SC 1.4.11 minimum |
| Control on an **ink or gold fill** (primary button, ink section CTA) | `outline: 2px solid var(--lf-focus-inner); outline-offset: -4px;` **plus** `box-shadow: 0 0 0 2px var(--lf-focus-inner), 0 0 0 4px var(--lf-focus)` — the inner `#FDFBF9` line is what keeps the ring alive against the fill |
| Inside a scroll container (search results, filter rail, buy box, gallery strip) | same ring at `outline-offset: -2px` so it is **never clipped** |

Rules: `:focus-visible` only, never `:focus`. `outline: none` without a replacement is banned — grep for it in review. `disableRipple: true` removes Material's ink drop but the ring is never removed. Any ancestor with `overflow: hidden` holding a focusable child gets `padding: 3px; margin: -3px`.

### 6.2 Press / active transform — the system's physical signature

```
button · chip · icon button      scale(0.972)
product card · tile              scale(0.985)
full-width row · sheet row       scale(0.992)
panel wider than 320px           no scale → opacity 0.94
```
In: `110ms cubic-bezier(0.22,0.61,0.36,1)`. Out: `260ms` on the same curve. Overshoot (`--lf-ease-spring`) is licensed for **exactly two** moments: the nav bag badge (`scale 1 → 1.28 → 1`, 320 ms) and the inline success tick. Bound to `:active` and pointer events, never `:hover`. `-webkit-tap-highlight-color: transparent` + `touch-action: manipulation` globally (also kills the 300 ms iOS tap delay).

**Deleted:** the current global `MuiButton:hover { transform: translateY(-2px); boxShadow: 0 4px 12px rgba(201,169,110,0.2) }`. It applies to icon buttons and link-buttons too, it makes a 9-card grid twitch, it is unreachable on touch, and `transition: all 0.3s ease` animates layout properties.

### 6.3 Image aspect ratios and object-fit — one table, no exceptions

| Surface | Ratio | Fit | Mat | Notes |
|---|---|---|---|---|
| Product card media | **1 / 1** | `cover` | `--lf-surface-sunken`, `--lf-r-field` | Sources are 2048², so `cover` on 1:1 crops **nothing**. The current `paddingTop:'125%'` portrait box crops every real asset. |
| Card media < 360px | 1 / 1 | `cover` | same | buys vertical room in the 1-up layout |
| PDP gallery stage | **1 / 1** | **`contain`** + 32px padding | `--lf-surface-sunken`, `--lf-r-panel` | the bottle floats on a warm mat instead of bleeding to a hard edge |
| PDP thumbnail | 1 / 1 | `cover` | `--lf-r-field` | 72px desktop / 56px mobile |
| Hero media | **4 / 5** | `cover` | `--lf-r-media` | `fetchpriority="high"`, `loading="eager"`, explicit `width`/`height` |
| Concern tile | **4 / 5** | `cover` | `--lf-r-media` | bottom-anchored `rgba(20,17,15,0.52)→transparent` scrim |
| Editorial / interstitial | **21 / 9** desktop · 16/9 <900 · 4/5 <600 | `cover` | `--lf-r-media` | |
| Cart line · search row · summary row | 1 / 1 | `cover` | `--lf-r-field` | 88 / 48 / 48 px |

**Mandatory on every `<img>`:** explicit `width` + `height` (or the `.lf-ar-*` class), `decoding="async"`, `loading="lazy"` except the hero and the PDP's first frame, a composed `alt` (`"{name}, {size}"` — never `"Product 3"`), and `data-product` on real product shots so the dark-mode backplate rule can find them.

**Non-negotiable asset prerequisite.** The real catalogue is **1.18–6.10 MB PNGs**, ~87 MB total, served into 288px card slots. Pre-generate `-480/-768/-1200/-1600.webp` + a JPEG fallback, `srcset` with `sizes="(max-width:599px) 100vw, (max-width:899px) 50vw, 288px"`, **180 KB budget for the largest shipped variant**. This is part of the visual spec, not an optimisation ticket: "large product imagery on calm surfaces" dies on contact with a 6 MB PNG on Indian 4G more decisively than any blur radius could. Also delete the 35 byte-identical `product-N*.jpg` placeholders.

### 6.4 Skeleton treatment — two animations, one rule

- **Text / price / chip bars** → `lf-pulse`, opacity `1 ↔ 0.55`, 1400 ms `ease-in-out`. A travelling shimmer on a 60%-width text bar reads cheap.
- **Media blocks only** → `lf-shimmer`, a `translate3d(-100% → 100%)` warm-white sweep over 1400 ms linear, on a `::after` so it is one composited layer, never a repaint.
- **The rule that matters:** skeletons are laid out at the **real element's final dimensions**, so nothing shifts when data lands. Three presets: `SkeletonCard` (1:1 media block + bars at 60/90/40/70/50% width), `SkeletonRow` (72px), `SkeletonPanel` (the BuyBox at its final height — the single biggest CLS risk on the site).
- Appear only after **220 ms** of waiting; below that, nothing. A 120 ms flash of shimmer reads as a bug.
- Count matches what actually fits: **6** on desktop, **4** on mobile — not 9 shimmering elements laying out during a slow fetch.
- `aria-busy="true"` on the region plus **one** visually-hidden `aria-live="polite"` "Loading products" — not one per skeleton.
- Off entirely under `prefers-reduced-motion` and `[data-glass="off"]` → static `--lf-surface-quiet`.

### 6.5 Sticky nav transition on scroll

Detected by an **`IntersectionObserver` on an 8px sentinel `<div>` placed above the nav** — not `window.addEventListener('scroll')` + `setIsScrolled`, which is what ships today and re-renders the entire nav subtree on every scroll event.

The observer sets one attribute: `data-scrolled="true"` on the `AppBar`. Everything else is CSS:

```
rest            height 64px (56 mobile) · 1px --lf-hairline bottom · no shadow
scrolled        inner row translateY(-4px) → effective 56px (52 mobile)
                box-shadow: var(--lf-e-edge), var(--lf-e-nav)   [180ms --lf-ease]
                wordmark scale(1 → 0.92), transform-origin: left
```
Only `transform` and `box-shadow` animate. `backdrop-filter` is a **discrete** value toggled at the start of the transition, never interpolated — interpolating it forces a full backdrop re-sample per frame.

The 36px AnnouncementRail sits **above** the sticky bar at `position: static`, so it scrolls away and never returns on that scroll. `Layout.jsx:15`'s `{!isHome && <Toolbar />}` is deleted outright: with a sticky (not fixed) bar no spacer is needed anywhere, and `html { scroll-padding-top: calc(var(--lf-nav-h) + 16px) }` makes anchors and focus-scrolls clear the bar.

Nothing `position: fixed` may be nested inside the glass bar — a `backdrop-filter`ed ancestor becomes a containing block for fixed descendants.

### 6.6 Search overlay choreography — frame by frame

The current `SearchIcon` is a dead `IconButton` with **no `onClick`**. This is the fix.

**Open** — triggered by the nav button, `⌘K`/`Ctrl+K`, or `/` when focus is not in a field:

| t | Desktop | Mobile |
|---|---|---|
| 0 ms | page behind gets `inert` + `aria-hidden`; body scroll locked via `body.lf-scroll-locked` + saved offset | same |
| 0–180 ms | scrim `opacity 0→1` | sheet begins |
| 0–380 ms | panel `opacity 0→1` + `translateY(-8px)→0` + `scale(0.985)→1`, `--lf-ease-out` | full-screen sheet `translateY(100%)→0`, `--lf-ease-out`, `100dvh` |
| +1 rAF after transition start | focus moves to the input | focus moves to the input — **after**, not before, or iOS drops the keyboard |

**Typing** — 120 ms debounce, abort the in-flight request per keystroke, min 2 characters. Skeleton rows after 220 ms; **never a centred spinner**, which makes the panel jump. **Results do not stagger** — a staggered list feels slow when you are typing.

**Close** — 260 ms `--lf-ease-in` (every exit is faster than its entry). Focus returns to the trigger, never to `<body>`. `Esc` clears a non-empty query on the first press and closes on the second.

**Keyboard contract:** input is `role="combobox" aria-expanded aria-controls="lf-search-list" aria-autocomplete="list" aria-activedescendant`; list is `role="listbox"`, rows `role="option" aria-selected`. ↓/↑ move `aria-activedescendant` **without moving DOM focus** so typing keeps working; `Home`/`End` jump; `Enter` opens the active option or falls through to `/products?q=`. Count announced through one `role="status" aria-live="polite"` throttled to **500 ms** so a fast typist is not read a stream of numbers.

**Matched substrings** use a real `<mark>` styled `background: var(--lf-gold-tint); color: var(--lf-ink)` — an element, so it is announced as emphasis, not an invisible colour change.

**Data (ship today, upgrade in one line):** the DRF product viewset has no `SearchFilter` — only `products/admin.py` sets `search_fields`. So: on first open, `getProducts({page_size:200})` once into a module-level `searchIndex.js` cache; `haystack = name|category|sub_category|key_benefits|suitable_for|sku`, lowercased, NFD-stripped. Every query token must be a substring; rank by name-prefix → name-substring → other, then in-stock, then alphabetical. **Upgrade path:** add `filter_backends=[filters.SearchFilter]` + `search_fields=['name','description','key_benefits','sku']` to the viewset and swap the matcher for `getProducts({search:q})`. Keep the component contract identical so it is a one-file change.

### 6.7 Filter drawer on mobile

Today `ProductFilter.jsx` renders **only a Sort select** — its category/sub-category/price handlers are written and never mounted, and it imports from `services/mockApi` while the page imports `services/api`. Both are fixed before the UI is worth designing.

- **Trigger:** two equal 44px buttons in a sticky 56px glass sub-bar at `top: var(--lf-nav-h)` — `Filters (2)` and `Sort`. Sticky, so filtering stays reachable deep in a long grid.
- **Sheet:** bottom `Drawer`, `maxHeight: 92dvh`, `--lf-r-panel` top corners, `--lf-e4`. A 36×5px `--lf-r-pill` `--lf-ink-4` drag handle, a sticky 56px header (`Filters` h4 + 44×44 close), a scrollable body with `overscroll-behavior: contain`, and a **pinned footer** on `--lf-surface` with a top hairline and `padding-bottom: max(16px, env(safe-area-inset-bottom))`.
- **Footer:** text `Clear all` + primary **`Show 28 products`** at 52px full width.
- **Filters are STAGED, not live.** Nothing refetches until `Show` is tapped. The count in the button updates live as you tick, so the result is known before dismissing. Live refetch per tick is unusable on a slow connection.
- **Rows** grow to 48px with 20px boxes; the whole row is the `<label>`, so the 48px row *is* the hit target.
- **Drag-to-dismiss** cancels the staged changes and announces it. `Esc` does the same. The handle and the × both close. **Nothing in this system is gesture-only** — same rule as nothing being hover-only.
- **Keyboard:** trigger is `<button aria-haspopup="dialog" aria-expanded>`; sheet is `role="dialog" aria-modal="true" aria-labelledby`; focus moves to the **close button** (not the first checkbox — that would read the first facet as the dialog's purpose); Tab trapped; background `inert`; on close, focus returns to the trigger and the new count is announced.
- Each facet is a `<fieldset>` with a `<legend>` so a screen reader hears "Category, group" first; counts live **inside** the label text (`Serums (4)`) so they are announced; zero-count facets use `aria-disabled` (not `disabled`) so they stay discoverable, with the count explaining why.
- **Desktop rail** is the same content as a `<nav aria-label="Filters">` in normal tab order before the grid — no dialog role, no trap, **no `Paper`, no border, no background**. It sits directly on `--lf-canvas`, structured by type and 1px hairlines. That is "type does the hierarchy, not boxes" in practice.

### 6.8 How a disabled Add to Cart looks — exactly

```
background:   var(--lf-surface-quiet)   /* #F0ECE6 */
color:        var(--lf-ink-4)           /* #8A8178 */
border:       1px solid var(--lf-border)
cursor:       not-allowed
pointer-events: auto                    /* so the reason can still be read */
aria-disabled="true"                    /* NOT the `disabled` attribute */
```

Four rules that matter more than the colours:

1. **`aria-disabled`, not `disabled`.** A `disabled` button leaves the tab order, so a screen-reader user cannot discover *why* they cannot buy.
2. **The reason is ALWAYS stated adjacent**, in `caption` 13px `--lf-ink-3`, directly beneath the button. Never left to the grey alone. `"Out of stock — we'll email you when it's back"`, `"Enter a delivery pincode"`, `"One item is out of stock — remove it to continue"`.
3. **An unbuyable item offers a path, not a dead button.** Out of stock → the disabled CTA is **replaced** by a primary `Notify me when it's back` that reveals a one-field email row; `Buy now` and the quantity stepper are **removed, not disabled** (a disabled stepper on an unbuyable item is pure noise).
4. **A disabled state never advertises a discount.** `PriceBlock` drops to `--lf-ink-3`, the strike-through is removed and the `Save 19%` chip is suppressed — promoting a discount on something nobody can buy is the exact failure the audit flags.

Loading is a separate state: `min-width` frozen at the measured label width, label to `opacity 0.45`, a 16px `thickness 3.6` `currentColor` spinner centred, `aria-busy="true"`, pointer events off, **400 ms minimum display** so it cannot flicker. On success the label crossfades to a check + `Added` for 900 ms while the nav badge springs. A button **never turns red** — it returns to default and the error appears adjacent.

### 6.9 Empty and error states — the illustration decision

**Decision: no illustrations. No mascots. No spot art. Ever.**

Three reasons: (a) there is no illustration system, and one invented per-state would be the fourth visual language on a site that is being reduced to one; (b) a custom SVG per empty state is 8–20 KB of weight carrying zero information; (c) a cartoon in an empty cart is the single most common way a premium store tells you it is not premium.

**The one approved form**, used identically for every empty and every error state:

```
64px circle, --lf-surface-sunken (empty) or the semantic tint (error), --lf-r-pill
  └─ a 28px MUI outline icon, --lf-ink-3 (empty) or the semantic ink (error)
h2/h4   the state, in plain words
body1   ONE line, 16px --lf-ink-2, max two sentences
        → one PRIMARY action   (the way forward)
        → one TEXT action      (the way out)
        → and where commercially sensible, a real 3-4 card product rail
```

| State | Heading | Primary | Text | Rail |
|---|---|---|---|---|
| Empty cart | `Your bag is empty` | `Shop all products` | — | `You might like` ×4 |
| No filter results | `No products match these filters` | `Clear all filters` | `Shop all` | `Popular right now` ×3 |
| No search results | `No products match "xyz"` | `Shop all products` | — | concern tiles + bestsellers |
| Empty wishlist | `Nothing saved yet` | `Shop all products` | — | ×4 |
| No reviews | `No reviews yet` | `Write a review` (eligible buyers) | — | — |
| Load failed (inline) | `Couldn't load products` | `Try again` | `Go to home` | — |
| Product failed | `Couldn't load this product` | `Try again` | `Shop all` | — |
| 404 | `We can't find that page` | `Shop all products` | `Go home` | bestsellers ×4 |

Error panels get a `3px solid` semantic left edge on `--lf-err-tint`, a plain-language message that **never shows a status code**, `role="alert"`, and focus moved to the panel only if the failure was user-initiated (a Retry tap), not on a background load. Retry re-runs the real request with backoff `600ms → 1.5s → 4s`, three attempts, then offers support. An **inline** error keeps the rest of the page alive — a failed filter fetch must not take the grid down with it.

Two states that must **never** render: a `0.0`-star row on a product with no reviews (`reviews_count === 0` → the row is replaced by `New arrival` 13px `--lf-ink-3`, and the aggregate is suppressed sitewide for that product), and `₹undefined` / `₹NaN` / `₹0` (reachable today whenever `discount_price` is null → render `Price on request` and force the CTA to secondary `View details`).

---

# 7. Component contracts (the eight that carry the money)

**ProductCard.** `<article>` + `Card`. 1:1 mat. Permanently visible, no hover reveal, in this fixed order: category `overline` → title `h5` 17px 2-line clamp with `min-height: 45px` (so prices align across a grid row) → proof row → size → `PriceBlock` → `StockPill` → **full-width 44px Add to Bag**. Wishlist is a 36px glass circle at `opacity 0.78` → `1`, **never `opacity: 0`**, with a 44px hit area via `::before { inset: -4px }`. The title's `<a>` carries `::after { position:absolute; inset:0 }` so the whole card is clickable **without** nesting the buttons inside an anchor — fixing today's invalid nested-interactive markup. `coming_soon` keeps the card a working link; today's `pointerEvents:'none'` on the whole card is deleted. Grid: `repeat(auto-fill, minmax(156px,1fr))`, 12px gap → **1-up at 320px**, 2-up from 360px, 3-up at 1232px, 4-up at ≥1440px. Second image is a `scroll-snap` pair with dot indicators under `@media (hover:none)` and **is not fetched at all** on touch.

**PriceBlock.** One component for card, buy-box, cart line, summary and search row, so price can never disagree with itself. Current price `--lf-ink` at **18.4:1** (the Amazon `#B12704` is rejected — the discount colour belongs on the *savings*, never on the price). `Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0})` so ₹1,29,900 groups the Indian way; today's bare `₹{price}` prints `₹1299.00` from the DRF decimal. Optional `· ₹13 / ml` unit line in 13px `--lf-ink-3` — the quiet premium-pharmacy signal that makes a ₹1,299 cream feel *priced* rather than expensive.

**StockPill.** One derivation, exported once from `utils/stock.js`, consumed by card, PDP, search and cart — because that expression currently lives in `ProductCard.jsx` and `ProductDetail.jsx` with **different fallbacks**, which is exactly how a tile and a PDP end up disagreeing. `in_stock === false → out`; `(available_quantity ?? stock_quantity) <= 0 → out`, `<= 5 → low`, else `in`; `coming_soon` overrides. Four states, each with its own **words and a dot**, never colour alone. Rendered **always**, including when in stock.

**BuyBox.** Sticky at `calc(var(--lf-nav-h) + 24px)`, columns 8–12, `max-height: calc(100vh - var(--lf-nav-h) - 48px)`, internal scroll, `overscroll-behavior: contain`. Order: eyebrow → `h1` name → proof row (the `128 reviews` link actually scroll-anchors; today it is a `Typography` with `cursor:pointer` and no handler) → `PriceBlock` `priceLg` → `StockPill` + size + SKU → gold hairline → stepper → **primary `Add to Bag` 52px** → **secondary `Buy now` 52px** → wishlist icon → three flat trust rows → `Buy on Amazon` as a **tertiary text link** → `About this item` bullets. The Amazon-orange-Buy-Now-first hierarchy is inverted: the site's own primary action gets the site's primary style.

**Delivery and returns are two rows with two wordings**, never merged. Today's single `Free 30 Days Delivery Returns` conflates two different policies and overstates the window. Numbers come from config, never hard-coded in the component, so they cannot drift from the policy page. And `PincodeCheck` either ships with a real lookup or **the promise copy is deleted with it** — the current PDP says "Enter your postal code for Delivery Availability" with no input anywhere on the page.

**MobileBuyBar.** Revealed by an `IntersectionObserver` on the inline Add to Bag, `translateY(100%)→0` over 260 ms `--lf-ease-out`. `68px + env(safe-area-inset-bottom)`, `.lf-glass`, `--lf-e-bar`. 320px math: **104px price + 8px gap + 168px CTA = 280px** inside 288px. `aria-hidden` while hidden so it is not double-announced; the page gets matching `padding-bottom` while visible; sets `--lf-bar-h: 68px` so the toast can never cover it; hidden while the keyboard is open.

**Toast.** One app-level `ToastProvider` replacing the **four** independent `Snackbar` implementations (including the one in `Checkout.jsx` that passes both a `message` prop and an `<Alert>` child). 48px product thumbnail, `Added to bag` + name, a 36px `View bag`, a 2px `--lf-gold-edge` progress hairline along the bottom edge, pause on hover **and** on focus-within, max 2 stacked. Durations: success 4 s, with-action 6 s, **errors never auto-dismiss** — auto-hiding a failure is how a customer ends up believing an order succeeded. On mobile the add-to-bag toast carries a compact `−/1/+` stepper, since the bar adds quantity 1.

**OrderSummary.** One component shared by `/cart` and `/checkout` so the number cannot disagree between them. Fix the live contradictions while building it: `Checkout.jsx` renders `Shipping: Free` while `CartSummary.jsx` hard-codes `estimatedShipping = 50`; `CartSummary.jsx` also does `<Box component={Paper}>` **without importing `Paper`** (a guaranteed crash the moment it renders) and sets `Playfair Display`, a font the app never loads. Coupons call `coupons/validate/` and render the discount **only** on a confirmed response — today `handleApplyCoupon` sets `{code, discount: 0}` and reports "Coupon applied!" regardless, so the UI claims a discount it has not confirmed and the customer discovers the truth at Place Order.

---

# 8. Page layouts (compressed)

**Global shell.** `html { overflow-x: clip; scroll-padding-top: calc(var(--lf-nav-h) + 16px) }`. Skip link first. `Container maxWidth="lg"` → 1232px. 12 columns, gutters 16/24/32/40. Sticky nav, no spacer, on every route. Route change: content `opacity 0→1` + `translateY(6px)→0` over 240 ms. Nothing else.

**Home — max 7 sections, atmosphere rationed to exactly two.** ① 36px AnnouncementRail (static, dismissible) ② Hero, 7/5 asymmetric, with `From ₹1,299`, a proof row, and B's floating purchase card overlapping the media's bottom-left by 24px *(atmosphere 1/2)* ③ static 72px ValueRow ④ **`Shop all skincare` — 8 full ProductCards, the fold-breaker** ⑤ Shop by concern, 4 tiles at 4/5 ⑥ brand interstitial on `.lf-ink-section`, 120px, Fraunces headline *(atmosphere 2/2 — the page's entire serif budget)* ⑦ Proof + bestsellers rail ⑧ footer newsletter.
**Deleted:** `Marquee` (a 30 s infinite auto-scroll pausable only on hover — a WCAG 2.2.2 failure *and* the first thing a visitor sees), `CircularProductSlider` (circular crops, no price, no CTA, occupying the slot where the shoppable grid belongs), `NewYearBanner` (a 600px pure-`#000` panel, hard-coded to a seasonal campaign, shipping in October), `Benefits`' triple-duplicated auto-scrolling row, and the duplicate `NewsletterSignup`/footer pair.

**Listing.** `--lf-canvas` (the `#FAFAFA` is gone). Breadcrumb → `h1` + indexable category copy **above** the grid → 264px borderless sticky rail + results column with **`minWidth: 0`** (without it the grid overflows the flex parent — this is one of the three overflows `overflow-x:hidden` is currently masking) → one 52px toolbar row → chips → grid → pagination. The three stacked bordered `Paper` strips collapse into that one row: **~160px of chrome recovered above the first product.** In-stock sorts first unless the customer explicitly sorted. Fix `totalPages` — it is computed from a hard-coded `/10`.

**PDP.** 12-col grid collapsing to one column below 900px, replacing `flexWrap:'nowrap'` + two hard `width:'50%'` columns at every breakpoint — the single worst layout bug in the codebase and the direct cause of the 1rem title and 0.6rem category text on phones. Gallery 1–7 (**all** images, not `slice(0,4)`), BuyBox 8–12 sticky. Below: tabs on desktop → **stacked accordion on mobile** (four labels will not fit 288px, and off-screen tabs are undiscoverable). `Product Information` becomes a definition list, not an MUI `Table` with a fixed `width: 200` cell that cannot fit 288px. `Product` JSON-LD emitted from the **same** source the UI renders, `aggregateRating` only when real reviews exist.

**Cart / Checkout / Confirmation.** Cart: lines 1–7 in one panel with internal hairlines, summary 8–12 sticky, free-delivery progress bar, cross-sell rail. **Checkout: one page, three numbered progressive-disclosure sections, all mounted** so nothing typed is ever lost — the 3-step `Stepper` loses data on back-navigation, hides the total behind a step, and gives no sense of remaining work. Reduced chrome (wordmark + lock + back-to-bag, no search, no nav links, no footer links). `navigate('/cart')` moves out of render into an effect. Auth redirect carries `?next=/checkout`. Confirmation ships **four** designed terminal states — success / pending (polls 3→6→12→24 s, never claims success while polling) / failed (three recovery actions, cart intact) / cancelled — and the Meta `Purchase` event fires **once**, keyed by order id, on server-verified success only.

---

# 9. DO NOT DO THIS

1. **Do not reintroduce a display serif for headings.** Not Cormorant, not Fraunces, not Playfair, not "just for the hero". Fraunces has exactly three licensed uses at a 20px/600 floor. A fourth use is a regression against an explicit owner decision.
2. **Do not set `color: var(--lf-gold)` on text.** It is **2.17:1**. The token's comment says NON-TEXT ONLY. Use `--lf-gold-ink` (#7A5A24) for type and `--lf-gold-edge` (#A8803A) for indicators. The one exception is inside `.lf-ink-section`, where the variable is redefined to 8.4:1 for you.
3. **Do not change `spacing` to 4.** It silently halves ~40 existing `p:3` / `py:8` / `spacing={4}` call sites across the repo. Use `var(--lf-n)` in raw CSS.
4. **Do not put `backdrop-filter` on anything inside a scrolling list.** Not product cards, not cart lines, not search rows. Blur is for the nav and overlays. A card that should look translucent uses the opaque `--lf-surface-raised` (`#FFFDFB`) against a `--lf-surface-sunken` band.
5. **Do not hide anything behind `:hover`.** Not Add to Bag, not the wishlist heart, not the active-nav indicator, not a second image, not a carousel pause, not a tooltip carrying meaning. If it is only reachable by hovering, it does not exist on the device most of this store's customers use.
6. **Do not animate `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`, `backdrop-filter`, or `all`.** `transform` and `opacity` only (plus `box-shadow`/`background-color`/`border-color`/`color`). Accordions animate `grid-template-rows: 0fr → 1fr`, never a JS-measured pixel height.
7. **Do not put `overflow-x: hidden` back on `body`.** It masks the three real overflows *and* can silently break every `position: sticky` descendant — and this design has four.
8. **Do not add a second display font, a second shadow ramp, a second card style, or a second toast.** If you need something the system lacks, add a token or a `variants` entry. Four `Snackbar`s is how the current build got here.
9. **Do not reach for `antd`, `react-slick`, or Tailwind.** `npm uninstall antd react-slick slick-carousel` in the same commit as this theme. An unused parallel design system is a loaded gun pointed at this spec; the first developer who imports an antd `<Table>` under deadline pressure undoes all of it in one file.
10. **Do not use `disabled` on a commerce button.** `aria-disabled` + a visible reason adjacent. A dead grey button with no explanation is a lost sale you cannot even diagnose.
11. **Do not write a raw hex in a component.** 16 files hard-code `#C9A96E` and 23 hard-code a font family. Every one becomes a `theme.palette` key or a `var(--lf-*)` in this same pass, or the site ships half-migrated — and remember `primary.main` flips from gold to ink, so every existing `color:'primary.main'` that meant *gold text* silently becomes black. Sweep it: `grep -rn "primary\.main\|#C9A96E\|#B08D55\|#9D7E4A\|#E8D4B0\|Cormorant\|Oswald\|Playfair" frontend/src`.
12. **Do not animate a scroll handler.** `IntersectionObserver` sentinels for the nav, the mobile buy bar, and the single scroll reveal. `window.addEventListener('scroll')` + `setState` re-renders a subtree per scroll event.
13. **Do not render a `0.0`-star row, a `(0)` review count, `₹undefined`, "Coupon applied!" without a server response, "Verified buyer" without a verified-purchase flag, or a success screen the client inferred from a redirect landing.** Every one of these is a trust defect, and four of the five are in the build right now.
14. **Do not ship a 6 MB PNG into a 288px slot.** `<picture>` + `srcset` + a 180 KB cap on the largest variant, or the calm surfaces this system is built on arrive four seconds late.
15. **Do not leave `<Grid item xs={12}>` in place.** MUI 7.3.5 ships the new `Grid` API; the legacy props are **ignored**, so the 12 files using them render unstyled today. Migrate to `<Grid size={{ xs: 12, md: 8 }}>`, or import `GridLegacy` explicitly as a temporary bridge — but do not pretend it works.

---

# 10. Implementation order (so no page is ever half-migrated)

1. `npm uninstall antd react-slick slick-carousel` · rewrite `index.html`, `index.css`, `theme.js`.
2. **In the same commit**: the `primary.main` gold→ink sweep across all 16+ call sites, delete every Cormorant / Oswald / Playfair reference, delete every `#FAFAFA` / `#FF9900` / `#B12704` / `#F0F2F2` / `#E7F6E7`, delete `{!isHome && <Toolbar/>}`.
3. `utils/stock.js`, `components/common/PriceBlock`, `StockPill`, `ToastProvider`, `StateBlocks` — the shared primitives, before any page touches them.
4. Point `ProductFilter`, `ProductReviews`, `RelatedProducts` at `services/api`; fix `CartSummary`'s missing `Paper` import and the `estimatedShipping = 50` / `Shipping: Free` contradiction; move `Checkout`'s `navigate` out of render; wire `coupons/validate/`.
5. `Grid` v1 → v7 migration in the 12 files.
6. `ProductCard` → `CompactNav` + `SearchOverlay` → `BuyBox`/`PdpGallery` → `FilterRail`/`FilterSheet` → `Cart`/`Checkout` → `Footer`/`Hero`/`Home`.
7. Image pipeline (WebP variants + `srcset`), then delete the 35 placeholder JPEGs.
8. Verify: axe on Home, PLP, PDP, Cart, Checkout at **320 / 768 / 1440**; one keyboard-only run from home to a completed order; one run with the OS forced to dark to confirm the `only light` opt-out holds; `grep -rn "outline: *none\|outline:none" frontend/src` returns nothing.