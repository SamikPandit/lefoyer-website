# Le foyeR. — **ALCOVE**: the binding art direction

**Status:** binding. Supersedes `docs/DESIGN_SYSTEM.md` ("Counter") wherever the two disagree.
Counter remains in force for everything this document does not touch. Every §2 decision this
document overturns is named in §2 below with the reason its original reasoning fails.

**Scope:** `frontend/` — React 18 + Vite 5 + MUI 7.3.5 + react-router 6.
**Non-negotiable context, restated** (violating any of these fails the work):

- **Six products. Three out of stock.** ₹280–₹480. Every density decision assumes this.
  In stock today: The Daily Invisible Moisturizer ₹300 · UV Armor Tinted Sunscreen ₹480 ·
  Raindrops Shower Gel ₹300. Out of stock: Glow Game WaterLess Face Wash ₹300 ·
  WhiteWave Face Wash ₹280 · Spotless Face Wash ₹280.
- **No fabricated ratings or reviews.** All six products have zero `Review` rows. Every surface
  renders `Be the first to review`. No star row, no `0.0`, no `(0)` count, no `aggregateRating`
  in JSON-LD. Ever.
- **No withdrawn claims.** Only `frontend/src/content/claims.js` substantiated entries may render.
  These must never appear anywhere in `frontend/src`: *India's First, Clinically Tested,
  100% natural, fully recyclable, chemical-free, dermatologically certified.*
- **No invented phone number.** `brand.support.phone` is `null` → no phone row renders.
  `@lefoyerglobal` is the only social handle.
- **No nonexistent asset paths.** Every needed asset that does not exist is a `TODO(business)`
  in §7 with exact dimensions, and nothing renders a broken `src`.
- **WCAG 2.2 AA.** Every ratio in §3 is computed with the relative-luminance formula, not estimated.
- **Low-end Android on Indian 4G.** No blur in scrolling lists, no autoplay, no `filter()`,
  transform/opacity only.
- **MUI v7:** `<Grid size={{...}}>`, never `item`. `theme.spacing` **stays 8**.
- **`docs/IMPLEMENTATION_SPEC.md` LF-01..LF-31 behaviours must not regress.** §9 sequences the
  work so nothing is dropped; §1 lists which behaviour moves where for every deletion.

---

# 1. Thesis, and what we are deleting

## 1.1 The thesis

**Le foyeR. is French for the hearth. A hearth is not an adjective — it is an arched opening in a
wall with light falling out of it. Every photograph on this site stands inside one.**

The current build translates "hearth" into the *word* hearth, printed three times, and expresses it
zero times as interface. ALCOVE translates it into geometry and light: one shallow segmental niche,
cut into warm paper, lit from the upper left, with a warm shade pooling at its foot. The same niche
holds a 72px footer thumbnail and a 490px hero photograph. You tap a product on the shelf and it
opens into a larger version of the exact frame it was standing in.

It is the right shape for this brand specifically, not for skincare generally: a segmental arch is
simultaneously a French fireplace opening and an Indian diya niche / jharokha — the most common
warm-domestic feature in the home this brand is named after. A mother in Bengaluru does not need to
read the word "hearth" to recognise the wall in her own house. And it reads as **a shelf, not a
vitrine**, which is the correct register for ₹280–480 family skincare. Cold luxury minimalism and
clinical pharma are both failures here.

It scales *down* with the catalogue instead of up. Six niches is a complete composition — two rows
of three at desktop — and because exactly three of six are in stock, the data resolves by itself
into **a lit row and an unlit row**. A 40-SKU brand could not use this direction. It works
*because* there are six.

## 1.2 The finding that reshapes the whole direction

Every previous proposal specified an image treatment against assets nobody opened. I decoded all
nineteen masters in `frontend/public/images/products` (`ffmpeg` → 96×96 RGB, corner sampling and
subject-extent measurement at mid-height). The results:

| Measured fact | Consequence |
|---|---|
| **All PNGs are colour-type 2 — RGB, no alpha channel.** | No cut-outs. A product can never be composited onto a mat. |
| **Only 3 of 19 are centred packshots on a near-uniform ground** (`Spotless_1` subject x 39–60%, `WhiteWave_1` 43–82%, `WhiteWave_7` 44–56%). | "Every packshot is a bottle on a white sweep" is **false**. |
| **The other sixteen are full-bleed compositions** running to 96–99% of frame width, many touching y=0. | **`object-fit: cover` into a 4/5 frame cuts the subject on most masters.** |
| **Backgrounds disagree violently and many are COOL.** `Spotless_1` #E3E5EA blue-grey · `Spotless_3` #9DE1E7 cyan · `Spotless_5` #134F85 deep blue · `Spotless_10` #D1E9F5 pale blue · `WhiteWave_6` #F6A5C8 pink · `WhiteWave_8` #C982A0 pink · `Spotless_4` corner-uniformity **209** (a scene with foliage). | A warm cream wash over cyan produces **sage mud**, not hearth light. A warm mat behind `contain` produces **a cyan rectangle inside a warm arch**. |

**All three candidate directions prescribed an image rule that these files break.** `cover` into a
4/5 arch with a cream overlay (ALCOVE as proposed) crops subjects and muddies cool grounds.
`contain` on a warm mat (Ledge, Two Lights, and Counter §6.3's PDP rule) paints a cyan, pink or
deep-blue rectangle inside the warm frame. The resolution is neither:

> **The arch is not a mask on the photograph. The arch is the niche the photograph stands in.**

The photograph is rendered **1:1 from a 1:1 master, so `cover` crops exactly nothing** — which is
what `DESIGN_SYSTEM.md` §6.3 already observed and then failed to apply. It sits at the **bottom** of
a taller arched niche, inset, with its own small radius and a hairline ring. The niche's dome rises
above it in `--lf-mat`. **The hearth light and the foot-shade are painted on the niche wall, not on
the photograph.** A cyan photograph stays cyan; the warm light falls on the wall around it, which is
also what light physically does.

This single change kills every fatal flaw the judges identified: nothing is cropped, no hue is
shifted, no alpha is needed, no re-shoot blocks the work, no per-SKU numbers are hand-tuned, and
nineteen mutually disagreeing photographs are reconciled by an identical frame rather than by a
wash that cannot reconcile them.

## 1.3 What we are deleting

Deleted outright. Every behaviour attached to a deleted component moves — nothing with a documented
LF- behaviour disappears without its behaviour landing somewhere named here.

| Deleted | Why | Where its behaviour goes |
|---|---|---|
| `components/home/Marquee.jsx` | Renders the identical four `useSubstantiatedClaims()` labels as §Home④ does 2,000px below it; a 38 s infinite auto-scroll (WCAG 2.2.2 risk) whose pause button collides with the viewport edge; and it is the first thing a visitor sees. Counter §8 specified a *static, dismissible* 36 px rail here, so deleting it returns the build to its own spec. | Claims → Home ④, once. No announcement rail replaces it: there is nothing to announce, and an empty announcement slot is how a marquee comes back. |
| `components/home/ProductCategories.jsx` | The empty-box defect at its root: the `Category` model has no `image`, so the tile prints the name as giant `--lf-ink-3` placeholder text **and then prints the same name again** as the real label. No category has an image, so this is the **only state that ever ships**. Two categories is not a browse mode. | Navigation → the shelf itself (§5 Home ③) + the PLP toolbar chips. The placeholder rule that prevents recurrence is §7.5. |
| `components/home/ShopByConcern.jsx` | The same navigation a second time. `ShopByConcern.jsx:163-166` documents that backend migration `products/0008` derives Concern rows **1:1** from sub-categories. | Concern chips → PLP toolbar (§5 PLP). `concern` URL param stays fully supported. |
| `components/home/CircularProductSlider.jsx` + `RailTile` | A second, incompatible product-card language (240 px circle, `object-fit: contain`, no price, no stock, no CTA) 800 px from the first. Its own comment claims it avoids duplicating the rail above it; that claim fails arithmetically at three sellable SKUs. | Nothing. One card, used everywhere. |
| `components/home/FeaturedProducts.jsx` | An `md:8` column containing an inner grid of `md:4` cards, so the permanently-empty third slot is ~256 px of blank canvas, and the skeleton promises three products when two arrive. | Absorbed into Home ③, which shows all six. |
| `components/home/Benefits.jsx` (card grid) | Four bordered cards drawing the same four claims as the marquee, preceded by a third printing of `brand.territoryLine`. | Home ④, as one flat row, no cards. |
| `components/home/NewsletterSignup.jsx` (standalone) | Two newsletters on one page. | The footer, which is the only newsletter on the site. |
| `CustomerTestimonials` from `Home.jsx`'s render list | Already returns `null` correctly at zero `Review` rows. Keeping it in the list makes the list lie. | Nothing. It returns when real reviews exist. |
| The **264 px desktop filter rail** (`ProductListing.jsx:741`) | ~1,300 px of facets (21 rows at 48 px) forced into a ~790 px nested scroller with no visible scrollbar on overlay-scrollbar platforms, consuming 23% of content width to filter six items, eight of whose rows read `(0)` and are inert. | **LF-08 is preserved**: every facet survives inside a desktop **popover** that reuses the existing `ProductFilter` component and the existing staged mobile sheet, same URL params, same Clear-all, same refresh/Back round-trip. Only the always-open rail dies. |
| The `Sub-category` facet **UI** | Renders the same eight options with the same counts as `Concern`, character for character, because the backend derives one 1:1 from the other. | One taxonomy facet, labelled **Concern** (the shopper-facing word). The `sub_category` URL parameter stays supported for old links and campaigns. |
| `RelatedProducts` as a PDP module | `limit={4}` on a six-SKU catalogue returns four of the other five — almost the whole shop, again, at the bottom of every PDP — rendered through an auto-fill template that opens six tracks for four items. | **The rest of the shelf** (§5 PDP): all five remaining products, scroll-snapped, filling their row at every width. |
| `PRODUCT_GRID_SX` at `RelatedProducts.jsx:28` | `repeat(auto-fill, minmax(156px,1fr))` — verified imported by `ProductListing.jsx:74` and `Wishlist.jsx:36`. One number causes four of the site's most visible defects. A related-products rail does not own the catalogue's geometry. | **`frontend/src/components/product/productGrid.js`**, owned by the listing. §4. |
| `--lf-surface-raised`, `--lf-rule-gold`, `--lf-e-edge`, `--lf-20/24/30/40`, the `E1`–`E4` JS consts, `theme.transitions` | Each is dead or imperceptible; itemised with measurements in §3. | §3. |
| The **State Emblem of India** image (`State_Emblem_of_India.png`, verified present) | Commercial use is restricted under Indian law and this repository holds no authorisation. | "Made in India" renders as **plain text** in the footer legal row. |
| The **35 byte-identical placeholder JPEGs** and all **PNG masters** from the deploy | ~87 MB of fiction and weight. | §7 pipeline. The PNGs stay in the repo as build inputs; they never ship. |
| The global **fraud notice** (`Footer.jsx:225`) | Warns on *every* page — including `/checkout` — that the brand "will never ask you to make a payment through a link", three scroll-seconds above a button that calls `window.location.assign()` to a **PhonePe link**. | `/contact` and `/faq`, reworded (§5). |
| The footer **SHOP** link column | *All products / Search / Your bag / Our story* — three are nav items one row above, and "Your bag" is a stateful user destination, not a footer link. | The footer's six-product row **is** the shop link. |

Home goes from **eight visible sections to five**; ~3,200 px to **~2,250 px** at 1440, with more
product visible above 1,000 px than the current page shows in its entire length.

---

# 2. Conflict decisions

Numbered, one line of reasoning each, in the style of `DESIGN_SYSTEM.md` §2. **O** = overturns a
numbered Counter §2 decision. **U** = upholds it against a challenger. **N** = new.

### Decisions about the brand's voice

1. **(U) §2.1 — the display face stays Inter Tight. No serif headline.** The owner rejected display
   serifs and §9.1 bans a fourth Fraunces use; answering a rejection with a different serif is
   relitigating, so the credibility is spent elsewhere — and the hero does not read techy because of
   its *family*. It reads techy for three measurable reasons that are all token values: it renders
   `variant="h1"` because `typography.display` has **zero call sites** (verified by grep), so a brand
   moment is drawn in the same register as the Privacy Policy title; `display` is weight **700** at
   **−0.026em**, a tight face double-tightened, which is the literal Linear/Vercel signature; and it
   sits centred on near-white with no photograph, which is the SaaS-landing-page composition itself.
   Fix those three and the family was never the problem. **The arch is the warmth argument** — it
   costs one CSS property, it cannot render badly on a cheap Android the way Cormorant did, and no
   owner has ever rejected it.
2. **(U) §2.2 on licence, (O) on placement — Fraunces stays at exactly three uses, and the
   interstitial moves from section 6 to section 2.** Three uses: nav wordmark 20 px, **one** home
   interstitial headline, footer wordmark 28 px, 20 px hard floor, weight 600 — the count is upheld
   against the proposal to expand it to five, because an expansion reopens a decision the owner made
   personally to buy warmth the niche already supplies for free. But the original placement fails:
   a grep shows `brandDisplay`'s single usage sits at section 6 of 8, ~2,400 px down, printing a
   sentence the page has already printed twice. **A rationed resource spent where nobody looks is
   not rationed, it is wasted.**
3. **(O) §2.10 — the 1 px gold section hairline is deleted and replaced by the 2 px ledge.** The
   premise is measurably false: `--lf-rule-gold: rgba(201,169,110,0.42)` composites to **1.30:1**
   over canvas and every call site then caps it at 96 px (`Benefits.jsx:71`) or 160 px
   (`ProductCategories.jsx:195`) — an accent below the perception floor repeated four times is not a
   brand, it is a template. Replaced by `.lf-ledge`: **2 px solid `#C9A96E` at 1.96:1**, full column
   width, with a warm under-shadow so it reads as the lit front edge of a shelf. Decorative, not an
   SC 1.4.11 boundary, so 1.96:1 is the correct target. **Four appearances per page, maximum.**

### Decisions about surface, shape and chrome

4. **(O) §4 surfaces — the warm axis is pushed until it is perceptible, not merely measurable.**
   `--lf-canvas #FDFBF9` has an R−B spread of **4/255**, `--lf-surface` is literally `#FFFFFF`
   (spread 0), and `--lf-surface-raised #FFFDFB` sits at **1.0147:1** against surface with one call
   site in the entire app — so the three surfaces a customer actually looks at are white,
   almost-white and almost-white. Canvas → `#F6EFE4` (spread 18), surface → `--lf-paper #FFFCF6`
   (spread 9), new `--lf-mat #F1E6D6` (spread 27). `--lf-surface-raised` is **deleted**, not
   repaired: a tier nobody can see is worse than none, because it lets people believe depth exists
   where it does not.
5. **(O) §2.5 — radius 14 everywhere becomes radius tiered by what the thing is.** "Apple's store is
   built on continuous corners" is true and is exactly why it cannot be this brand's signature: a
   uniform 14 px corner on every card, field and panel is the single most common shape language on
   the web in 2025, and it is why the current surface layer reads as one notch from a generic SaaS
   card. Chip 6 / field 10 / card 12 / panel 16 / foot 18, and **image frames take the niche**.
6. **(O) §2.8 — the product card's frame is deleted entirely.** §1 of Counter diagnosed the card
   honestly ("one notch from a generic SaaS card") and then prescribed *more chrome* — a frame plus
   a gold rule plus an inset top edge. Decoration cannot fix a structural miscast. **The niche is the
   frame.** Removing the 1 px border, the `--lf-e1` hairline ring and the `--lf-e-edge` highlight is
   also what returns the full card width to the CTA, which is half the fix for the two-line button
   wrap.
7. **(U) §2.6 on dark mode, (O) on coverage — `.lf-hearth-section` is applied to the footer, which
   §2.6 decided and the build never did.** No auto dark mode (every master is shot on a bright
   ground). But §2.6 said "a proven dark surface for **footer + interstitial**", the class has
   existed at `index.css:122` from day one with 28 contrast-audited redefinitions, and
   `Footer.jsx:114` paints `var(--lf-canvas)` — the identical colour as the page body. The brand's
   last moment is a weightless link farm. Two dark anchors, one mid-page and one terminal, costs
   nothing: every child already works inside it with zero overrides.
8. **(U) §2.7 — glass on nav and overlays only.** Unchanged, and now easier to honour: the niche's
   hearth light is two static gradients, not a `backdrop-filter`, so it is legal inside a scrolling
   list under §9.4.
9. **(N) The nav's dead `data-scrolled` state gets a way in.** `theme.js:454` styles
   `&[data-scrolled="true"]` and **nothing in the repository ever sets it** (verified: one grep hit,
   that line), so `--lf-e-nav` has zero consumers and the bar separates from content with a 1.27:1
   hairline forever. One `IntersectionObserver` sentinel writes the attribute to a **ref'd DOM node,
   not React state** — React state is what was rightly deleted. Scrolled, the nav gains `--lf-e-nav`
   **plus the 2 px gold ledge along its lower edge**, which is how the brand hex reaches above the
   fold on every route.

### Decisions about the image treatment — where all three proposals were wrong

10. **(O) §6.3 and every proposal's image rule — the niche frames the photograph; the photograph is
    never masked, never cropped, never washed.** §6.3 prescribes `cover` on the card and `contain`
    on the PDP, so the same photograph is cropped on the listing and whole on the detail page. The
    proposed fixes were `contain` everywhere (Ledge, Two Lights) and `cover`-into-an-arch-with-a-
    cream-overlay (ALCOVE). **Measurement kills all three** (§1.2): the masters are RGB with no
    alpha, only 3 of 19 are centred packshots, sixteen run to 96–99% of frame width, and the grounds
    include cyan `#9DE1E7`, deep blue `#134F85` and pink `#F6A5C8`. `contain` paints a cyan rectangle
    inside a warm arch; `cover` into 4/5 cuts the subject; a cream wash turns cyan to sage.
    **Binding rule: the photograph is 1:1 from a 1:1 master with `object-fit: cover` — zero crop —
    inset at the foot of a taller arched niche, and the hearth light falls on the niche wall, never
    on the photograph.** One treatment, chosen for the assets that exist.
11. **(N) Out of stock: the light goes out, the niche does not — and the photograph is never
    touched.** No greyscale, no opacity drop, no desaturation, no diagonal ribbon. The niche wall
    goes from `--lf-mat` to `--lf-mat-deep` and its hearth-light gradient is removed; the photograph
    renders at full strength. The photograph is what creates desire, and dimming it is how a shop
    tells you not to want something. This also avoids every hue risk a veil over a cool photograph
    would carry.
12. **(N) The image pipeline is a prerequisite, not a follow-up.** `Hero.jsx:15-20`'s own header
    comment uses the unsolved image-weight problem to justify why the brand's most important moment
    has no photograph in it — **a build step is currently making the brand's biggest design
    decision.** Verified: `grep -rn "srcset|srcSet|<picture|webp|avif" frontend/src` returns **zero
    hits**, masters are 1.18–6.12 MB, and `ProductDetail.jsx:702` loads full-resolution sources into
    72 px thumbnail buttons. **No hero merges without AVIF/WebP derivatives and a measured LCP on a
    throttled mid-range Android.**

### Decisions about the grid and the card

13. **(O) §2.9 and §7's grid — `auto-fill` is banned on the catalogue grid.** §2.9's conclusion
    (134 px cannot hold a price and a 44 px button) is right; §7 then implemented it as a template
    that packs as many columns as fit, so its own prose ("3-up at 1232") never matches what the CSS
    does. Verified arithmetic at 1440: container 1232 − 80 gutters = 1152, minus the 264 px rail and
    a 32 px gap = **856 px** results column; `floor((856+12)/168)` = **5 tracks**; `(856−48)/5` =
    **161.6 px cards**. That one number causes the mid-word name truncation, the two-line wrap inside
    the buttons, and the heart overlapping the Out-of-stock chip. Replaced by an explicit,
    catalogue-aware schedule in `productGrid.js` with a **288 px absolute floor** (§4).
14. **(O) §7's ProductCard — the status badge leaves the image frame.** Today the "Out of stock"
    Chip sits inside the mat at `left:8` while the wishlist `IconButton` sits at `right:20,
    width:36`; clearance needs a card wider than ~175 px and the real widths are 161/157/171/173 px,
    so the badge is physically overlapped **at every breakpoint the PLP renders at** — visible in
    `plp-desk.png` on Glow Game, WhiteWave and Spotless. It becomes a **full-width status ledge row
    beneath the niche, above the name**, where it has the entire card width. The collision becomes
    *structurally impossible at any card width in any language*, not narrowly avoided. All three
    directions converged on this; that convergence is evidence.
15. **(N) The `startIcon` is deleted from the card CTA.** The bag glyph carries no information the
    label does not and costs 28 px of the only space that matters. The bag icon is reserved for the
    PDP buy box and the mobile buy bar.
16. **(U) §7's title clamp, demoted to a safety net.** The 2-line clamp stays but `minHeight: 45`
    goes: the card is a grid whose CTA row bottom-aligns, so prices and buttons align across a row
    without a magic number. Measured against **all six real names** (§4.3), the clamp never fires
    above 316 px.

### Decisions about commerce

17. **(U) §2.3 — the primary CTA stays ink `#14110F`.** A grid of gold buy-buttons turns the accent
    into a theme colour; ink at ~16:1 is the most legible and keeps gold precious.
18. **(O) §2.4's rationing, upheld on tiering — gold gets exactly two licensed *fills*, and
    `Notify me` is one of them.** The four-tier gold is correct and kept with ratios recomputed; the
    rationing is not, because it produced a brand hex that reaches the screen as a fill on **one chip
    variant** while `--lf-gold-fill` and `variant="brandFill"` have **zero call sites** (verified).
    The two fills: **(a) `Notify me`** on out-of-stock cards and the PDP — half this catalogue is
    unbuyable, so the restock row becomes the *warmest* thing on the shelf rather than the dead half
    of the page, and email capture is this shop's highest-value action while stock is out; **(b) the
    newsletter `Join`**, the one §2.3 already licensed and nobody built. Ink at 15.97:1 still
    outranks gold at 1.96:1, so §2.3's hierarchy is unharmed, and the `BACK SOON` ledge reads
    *before* the eye reaches the button (the misread-as-promotion mitigation).
19. **(N, grafted from Two Lights) The shelf bundle — one ink button that adds every in-stock
    product.** Every CTA on the site otherwise adds one bottle at ₹280–480 with free delivery and
    COD exposure; this is the only basket-raising mechanic in the brief and it is **not
    architecturally exclusive to routine IA**. `Add the shelf · ₹1,080` (₹300 + ₹480 + ₹300,
    computed at render from real product prices, never typed). **No invented discount, no invented
    urgency, no invented bundle price** — `policy.js` already makes delivery free with no threshold,
    so there is no nudge available to fake, and the value offered is completeness and one arrival,
    both of which are true.
20. **(O) the bundle button is INK, not gold.** The proposal made it the one gold fill; a gold
    button 300 px from three ink *Add to bag* buttons inverts the hierarchy — the action that adds
    three products should be the **biggest ink action on the page**, not a different hue. It gets
    prominence from scale (52 px, full panel width) and position, and gold stays at two fills.
21. **(U + hardened) Out-of-stock keeps `Notify me`, always.** `aria-disabled`, never the `disabled`
    attribute, never absent, never a dead grey button — §6.8 rules 1–3 upheld verbatim. **§6.8 rule
    4 is narrowly overturned:** the price stays at full `--lf-ink` weight on an out-of-stock card.
    That rule exists to stop a shop advertising a *discount* on something nobody can buy; zero of the
    six products carry a `discount_price`, so there is nothing to suppress, and dimming a true price
    on an item you can still reserve is a sales decision wearing an accessibility costume.
22. **(O) §8's listing rail and §8's home — both were written for a catalogue that does not exist.**
    "8 full ProductCards as the fold-breaker" cannot happen at six products, and a 264 px sticky
    facet rail beside six items is chrome outweighing merchandise. Five home sections; the
    fold-breaker is all six, 3-up, in-stock first.
23. **(N) In-stock sorts first by default, everywhere, unless the customer explicitly sorts.**
    Rejecting the proposal to default to a fixed taxonomy order: opening `/products` on three
    sold-out cards for cold traffic reads as *sold out*, not as *organised*, and a known-adverse
    default shipped behind a two-week measurement plan is a design decision wearing a measurement
    costume.
24. **(N) The search overlay stops hiding half the catalogue.** `SearchOverlay.jsx:233` passes
    `in_stock: true` while `Search.jsx` passes no such filter, so the same query returns two
    different shops depending on which surface you used. Dropped.
25. **(N) `buildPriceBands` is repaired, not deleted.** Verified dead: `edges = [500,1000,2000,5000]
    .filter(e => ceiling > e)` against a ₹480 ceiling empties `bands`, `previous` stays `null` so no
    "and above" band is pushed, and `ProductFilter.jsx:374`'s `if (priceBands.length)` can never be
    true — **the facet has never rendered once in production.** Deleting the UI leaves the bug in the
    tree for the next person. Derive from real min/max. **Rule: never ship a facet whose render
    condition can be false for the entire catalogue without anyone noticing.**
26. **(N) Cash on delivery gets an arm on the confirmation screen.** `OrderConfirmation.jsx` contains
    the string "COD" **zero times** (verified), while `Checkout.jsx:487-490` routes COD orders
    straight to it — so a paying customer lands on an amber hourglass reading "Confirming your
    payment" with a progress bar, a 3→6→12→24 s poll, and, because `showMoney` is gated on
    `paymentStatus === 'COMPLETED'`, **no items, no total and no address.** The highest-trust moment
    in the store tells a paying customer something went wrong.
27. **(U) §8's reduced checkout chrome, finally built.** `App.jsx:240` wraps every route in one
    `Layout`, so the payment screen carries three outbound nav links, search, wishlist, account and a
    nine-link footer — **eleven one-tap routes out of the funnel** — against §8's explicit "no
    search, no nav links, no footer links".
28. **(O) §2.16 on emptiness, upheld on illustrations.** "No illustrations, ever… and real products"
    is right, but the last three words were never built: `EmptyState.jsx:214` ships a `children` slot
    whose own docstring example is the empty cart with a product rail, and **no caller passes it**
    (verified). Six routes render a 64 px beige circle and stop. With six SKUs every empty state can
    show the entire shop.
29. **(N, grafted from Ledge) A shelf is complete at whatever its row count is.** The governing
    principle for a small catalogue: six products fall into **two full rows of three** at ≥1200, three
    of two at 680–1199, six of one below — **never a ragged final row at any breakpoint**. That is
    the structural property that makes a small catalogue read as curation rather than scarcity, and
    it is why the grid gets a fixed column count instead of an auto-fill template.
30. **(N, grafted from Ledge) The niche is a component contract, not a style a page can forget.**
    Borderless products lean entirely on the niche for grouping, so `<Alcove>` owns the frame, the
    light, the ring and the foot-shade. No page composes one by hand.
31. **(N, grafted from Ledge) `prefers-reduced-motion` preserves the affordance, not just the
    animation.** Where a hover/focus gesture is removed, the **ledge beneath the item thickens
    2 px → 3 px and the name underlines**. The meaning survives; the movement does not. Better than
    zeroing the transition.
32. **(N, grafted from Two Lights) The PDP gains "The ritual", built verbatim from `how_to_use`.**
    A real `TextField` on `Product`, served by the detail serializer, currently buried in a tab.
    Numbered rows split on sentence boundaries — **new on-site editorial content, zero invention,
    zero new assets**, on a site whose last trust failure was hand-typed ratings.
33. **(U) §2.17 and §2.18 — `spacing` stays 8, `cssVariables` stays off.** Changing spacing silently
    halves ~40 call sites; `index.css` stays the single var source so `alpha()` and `augmentColor`
    keep working.
34. **(N) Two page archetypes, applied mechanically.** Nine pages currently use five heading sizes
    and five padding pairs — "Saved items" renders 50% larger than "My orders" and "My account",
    three pages of the same kind reached from the same menu. **EDITORIAL** and **UTILITY** (§5.9).
35. **(N) One hard rule against product names in code.** The direction brief itself miscalled
    `LF-SK-MO02` a *sunscreen* when the live API says **The Daily Invisible Moisturizer**. No product
    name, price, size or stock state is ever typed into a component — all of it renders from the API
    payload. (Separately: `TODO(data)` in §7.6, that SKU is filed under sub-category *Cleansers*.)

---

# 3. Tokens

`frontend/src/index.css` is the single source of truth. `theme.js` **reads `var(--lf-*)` by name**
and holds real hex only where MUI needs it for `alpha()`/`augmentColor`.

## 3.1 Surfaces — the warm axis, pushed until it is visible

Spread = R−B channel difference out of 255. Every surface-to-surface ratio below is a **real step**;
the deleted `--lf-surface-raised` sat at 1.0147:1.

```css
--lf-canvas:      #F6EFE4;  /* spread 18 — page background, every route */
--lf-paper:       #FFFCF6;  /* spread  9 — cards, inputs, panels, buy box (replaces --lf-surface) */
--lf-mat:         #F1E6D6;  /* spread 27 — THE NICHE WALL, image wells, gallery frame */
--lf-mat-deep:    #EADCC7;  /* spread 35 — the UNLIT niche, sunken bands. NON-TEXT / large-text only */
--lf-quiet:       #E9DFCF;  /* spread 26 — disabled fills, skeleton base */
--lf-hearth:      #1C1411;  /* the dark band + footer (warmer than today's #14110F) */
--lf-hearth-glow: #4A3524;  /* the lit corner of the hearth gradient */
--lf-paper-glass: rgba(246, 239, 228, 0.86);  /* nav + sticky bars ONLY */
--lf-sheet-glass: rgba(246, 239, 228, 0.94);  /* drawers + overlays ONLY */
--lf-overlay:     rgba(28, 20, 17, 0.56);
--lf-blur:        blur(20px) saturate(180%);
```

| Pair | Measured |
|---|---|
| canvas → paper | **1.115:1** |
| canvas → mat | **1.080:1** |
| paper → mat | **1.204:1** |
| mat → mat-deep | **1.094:1** |
| canvas → mat-deep | **1.182:1** |
| canvas → quiet | **1.155:1** |

`--lf-surface` is kept as an **alias of `--lf-paper`** for one release so no component breaks mid-sweep,
and deleted in step 9.10. `--lf-surface-raised` is deleted immediately (one call site, `About.jsx:223`).

## 3.2 Ink — warmed to match the paper, headline ratio untouched

```css
--lf-ink:           #1A1410;  /* headings, body, PRICE */
--lf-ink-2:         #4C443B;  /* long-form body, descriptions */
--lf-ink-3:         #6A6056;  /* captions, meta, AND disabled labels */
--lf-ink-4:         #8D8378;  /* NON-TEXT ONLY: field borders, disabled glyphs */
--lf-border-field:  #857B70;  /* MANDATORY on input/checkbox/radio (SC 1.4.11) */
--lf-hairline:      #E0D2BC;  /* decorative separators only */
--lf-border:        #D4C3A8;  /* card hover border, table rules */
--lf-border-strong: #BFAD92;  /* chip outlines, weighted dividers */
--lf-border-ink:    #1A1410;  /* secondary button, selected tile */
--lf-on-hearth:     #FBF4E8;
--lf-on-hearth-2:   #D9CCB8;
```

| Token | canvas | paper | mat | mat-deep | quiet |
|---|---|---|---|---|---|
| `--lf-ink` | **15.97** | **17.81** | **14.79** | 13.51 | 13.83 |
| `--lf-ink-2` | **8.37** | **9.33** | **7.75** | 7.08 | 7.25 |
| `--lf-ink-3` | **5.38** | **6.00** | **4.98** | **4.55** | **4.65** |
| `--lf-ink-4` | 3.25 | 3.63 | 3.01 | 2.75 | 2.82 |
| `--lf-border-field` | **3.63** | **4.05** | 3.36 | 3.07 | 3.14 |
| `--lf-hairline` | 1.30 | 1.45 | 1.21 | — | — |
| `--lf-border` | 1.51 | 1.68 | 1.40 | — | — |
| `--lf-border-strong` | 1.91 | 2.13 | 1.77 | — | — |

**This fixes the §6.8 disabled-label failure by name.** `theme.js:158` pairs `--lf-ink-4` on
`--lf-surface-quiet` at **3.25:1** on a control that is `aria-disabled` and therefore still focusable
and in the tab order — so the SC 1.4.3 "inactive component" exemption does **not** apply and it
fails. Disabled labels move to `--lf-ink-3` → **4.65:1** on `--lf-quiet`. Passes, still visibly
recessive. `--lf-ink-4` keeps its documented non-text role.

**`--lf-mat-deep` is restricted to non-text and large text** (`--lf-ink-3` is 4.55:1 on it — passing,
but with no margin). Body copy never sits on an unlit niche.

## 3.3 Gold — four tiers, two licensed fills

```css
--lf-gold:        #C9A96E;  /* 1.96:1 canvas — NON-TEXT: the ledge, badge fills, wordmark on hearth */
--lf-gold-edge:   #A8803A;  /* 3.16:1 canvas — indicators: selected thumb, active underline (SC 1.4.11 ✓) */
--lf-gold-ink:    #7A5A24;  /* 5.55:1 canvas · 6.19:1 paper · 5.14:1 mat — gold AS TEXT */
--lf-gold-ink-hv: #6E4F1E;  /* 6.57:1 canvas */
--lf-gold-fill:   #8C6A24;  /* white label 5.00:1 — a LICENSED FILL */
--lf-gold-tint:   #F4E9D2;  /* ink on it 15.14:1 · gold-ink on it 5.26:1 */
/* --lf-rule-gold: DELETED. rgba(201,169,110,0.42) composites to 1.30:1 over canvas. */
```

| Label on fill | Measured |
|---|---|
| `--lf-ink` on `--lf-gold` | **8.15:1** |
| `#FFFFFF` on `--lf-gold-fill` | **5.00:1** |
| `--lf-gold` as text on `--lf-hearth` | **8.11:1** (5.14:1 at the glow's brightest point) |
| `--lf-ink` on `--lf-gold-tint` | **15.14:1** |

**Gold's three jobs:** (1) the **ledge** — every section eyebrow, the nav when scrolled, the hero
purchase card's price row, the footer legal row; (2) **`Notify me`** — `--lf-gold` fill with an
`--lf-ink` label at 8.15:1; (3) the newsletter **`Join`** — `variant="brandFill"`, `--lf-gold-fill`,
white label at 5.00:1, finally wired.

### `.lf-ledge` — replaces the §2.10 hairline

```css
.lf-ledge {
  height: 2px; width: 100%; border: 0; flex: none;
  background: var(--lf-gold);
  box-shadow: 0 2px 0 rgba(201,169,110,.28), 0 10px 18px -10px rgba(74,53,36,.30);
}
```

Full column width, never capped by a call site. Maximum **four per page**.

## 3.4 Semantic

```css
--lf-ok-ink:   #15663D;  /* 6.13:1 canvas — "In stock", "Free delivery" */
--lf-ok:       #1E7A4D;  /* 4.66:1 — the 6px stock dot (non-text) */
--lf-ok-tint:  #E4F1E8;  /* ok-ink on it 6.02:1 */
--lf-warn-ink: #7A4F00;  /* 6.24:1 canvas — "Back soon" */
--lf-warn-tint:#FBEFD9;  /* warn-ink on it 6.26:1 */
--lf-err-ink:  #A01C15;  /* 6.88:1 canvas */
--lf-err-tint: #FBE9E6;  /* err-ink on it 6.70:1 */
```

## 3.5 The inverted surface — `.lf-hearth-section`

Replaces and renames `.lf-ink-section` (the old name survives as an alias through step 9.10).
Applied to **exactly two** surfaces: the home interstitial and the footer.

```css
.lf-hearth-section {
  background: radial-gradient(90% 130% at 12% 100%, #4A3524 0%, #2A201A 38%, #1C1411 74%);
  --lf-canvas:#1C1411; --lf-paper:#241B16; --lf-mat:#2A201A; --lf-mat-deep:#241B16;
  --lf-ink:#FBF4E8; --lf-ink-2:#D9CCB8; --lf-ink-3:#A89C8B;
  --lf-gold-ink:#E3C78C; --lf-hairline:rgba(251,244,232,.14); --lf-border:rgba(251,244,232,.22);
  --lf-focus:#E3C78C;
  /* the four overrides the current build is missing: without them every card inside the
     dark band carries a 0 0 0 1px rgba(20,17,15,.045) ring that is invisible on #1C1411 */
  --lf-e1: 0 0 0 1px rgba(251,244,232,.14);
  --lf-e2: 0 2px 4px rgba(0,0,0,.30), 0 0 0 1px rgba(251,244,232,.14);
  --lf-e3: 0 8px 20px -6px rgba(0,0,0,.42), 0 0 0 1px rgba(251,244,232,.16);
  --lf-e4: 0 24px 56px -16px rgba(0,0,0,.52), 0 0 0 1px rgba(251,244,232,.18);
}
```

**Every value passes AA across the entire gradient**, which is why a gradient is safe here:

| Token | on `#1C1411` (darkest) | at the glow's brightest `#4A3524` |
|---|---|---|
| `--lf-ink` `#FBF4E8` | **16.59:1** | **10.52:1** |
| `--lf-ink-2` `#D9CCB8` | **11.47:1** | **7.27:1** |
| `--lf-gold-ink` `#E3C78C` | **11.07:1** | **7.02:1** |
| `--lf-gold` `#C9A96E` (wordmark, as text) | **8.11:1** | **5.14:1** |

## 3.6 Focus

```css
--lf-focus:       #1A1410;  /* 15.97:1 canvas · 14.79:1 mat */
--lf-focus-inner: #FBF4E8;
```

2 px solid, `outline-offset: 2px`, `border-radius: inherit`. On an ink or gold fill:
`outline-offset: -4px` plus `box-shadow: 0 0 0 2px var(--lf-focus-inner), 0 0 0 4px var(--lf-focus)`.
Inside any scroll container: `outline-offset: -2px` so it is never clipped.

## 3.7 Type

Three families, unchanged files. `Inter Tight` (display/h1–h3), `Inter` (everything commercial),
`Fraunces opsz 72 / wght 600` (three licensed moments).

**Tracking rule, written into the system:** Inter Tight is already an optically tight face. **Any
value past −0.012em is banned above 24 px.** Stacking optical tracking on a tight face is the
Linear/Vercel signature and it is a token value, not a typeface.

| Role | Family / weight | Size | Line-height | Tracking | Notes |
|---|---|---|---|---|---|
| `display` | Inter Tight **600** | `clamp(2.125rem, 1.30rem + 3.4vw, 3.75rem)` → **34px @390 · 47px @768 · 60px @1440** | 1.07 | **−0.006em** | **Hero only. One per page, maximum.** Was 700 / −0.026em / 68px with **zero call sites**. |
| `h1` | Inter Tight 600 | `clamp(1.875rem, 1.42rem + 1.9vw, 2.75rem)` → 30 → 44px | 1.10 | −0.010em | Editorial page titles, PDP product name |
| `h2` | Inter Tight 600 | `clamp(1.625rem, 1.33rem + 1.22vw, 2.125rem)` → 26 → 34px | 1.14 | −0.010em | Section headings |
| `h3` | Inter Tight 600 | `clamp(1.375rem, 1.22rem + 0.63vw, 1.625rem)` → 22 → 26px | 1.20 | −0.008em | Utility page titles (`component="h1"`) |
| `h4` | Inter **600** | **19px** | 1.26 | −0.006em | **THE PRODUCT NAME.** 19px, not 17px. |
| `h5` | Inter 600 | 17px | 1.30 | −0.004em | |
| `h6` | Inter 600 | 16px | 1.40 | −0.004em | |
| `body1` | Inter 400 | 16px | 1.62 | 0 | measure capped at **62ch** |
| `body2` | Inter 400 | 15px | 1.56 | 0 | |
| `caption` | Inter 500 | 13px | 1.46 | +0.004em | |
| `eyebrow` | Inter 600 | 12px | 1.30 | **+0.14em** | uppercase, `--lf-gold-ink`. Replaces `overline`. |
| `price` | Inter 600, `tnum` | 17px | 1.30 | −0.008em | |
| `priceLg` | Inter Tight 700, `tnum` | `clamp(1.75rem, 1.56rem + 0.83vw, 2.125rem)` → 28 → 34px | 1.10 | −0.012em | |
| `brandDisplay` | **Fraunces 600** | `clamp(1.75rem, 1.21rem + 2.3vw, 2.75rem)` → 28 → 44px | 1.16 | −0.008em | **Fraunces licence 2 of 3** |
| `wordmark` | **Fraunces 600** | 20px nav / 28px footer | 1.00 | +0.01em | **licences 1 and 3 of 3** |

`display` now has **exactly one call site** (the home hero `h1`). A dead top register is worse than
none, because it hides the fact that the scale has no apex. `overline` is deleted after the sweep.

## 3.8 Spacing — the two missing tokens, added

`theme.spacing` **stays 8** (§2.17 upheld). These are for raw CSS and full-bleed components.

```css
--lf-1:4px;  --lf-2:8px;  --lf-3:12px; --lf-4:16px; --lf-5:20px;
--lf-6:24px; --lf-8:32px; --lf-10:40px; --lf-12:48px; --lf-16:64px;
/* --lf-20/24/30/40 DELETED — zero consumers */

/* THE PAGE GUTTER — the most-used spatial value on the site, which today exists only as
   four literals inside MuiContainer.styleOverrides. Marquee's pause button sits at right:4
   on a full-bleed Box and collides with the viewport edge precisely because it had no
   gutter value to reference. */
--lf-gutter: 16px;
@media (min-width:600px)  { :root { --lf-gutter: 24px; } }
@media (min-width:900px)  { :root { --lf-gutter: 32px; } }
@media (min-width:1200px) { :root { --lf-gutter: 40px; } }

/* THE SECTION RHYTHM — replaces six ad-hoc py pairs scattered across the app
   ({xs:3,md:5} {xs:4,md:6} {xs:4,md:7} {xs:5,md:8} {xs:6,md:10} {xs:7,md:12}) */
--lf-sect-sm: 40px; --lf-sect: 56px; --lf-sect-lg: 72px;
@media (min-width:900px) { :root { --lf-sect-sm:64px; --lf-sect:96px; --lf-sect-lg:128px; } }

/* THE CARD FLOOR — so the grid minimum and the button padding can never drift apart again */
--lf-card-min: 288px;
```

## 3.9 Radii — tiered by what the thing is (§2.5 overturned)

```css
--lf-r-chip:6px;  --lf-r-field:10px; --lf-r-card:12px;
--lf-r-panel:16px; --lf-r-foot:18px;  --lf-r-pill:999px;
--lf-r-photo:8px;  /* the photograph inside the niche */
```

`shape.borderRadius` → **12**. The four off-scale literals inside `theme.js` are swept to these.
**No component writes a raw radius.**

## 3.10 The niche — the one shape that carries the brand

`--lf-r-arch` is a **locked token**. Push the vertical radius past ~30% and the shallow dome becomes
a pointed niche with memorial or religious connotations; the 18px foot keeps it reading as furniture.

```css
:root {
  --lf-arch-ratio: 1.18;   /* niche height ÷ niche width — LOCKED */
  --lf-arch-inset: 7%;     /* photograph side inset, of niche width */
  --lf-arch-foot:  6%;     /* photograph bottom inset, of niche width */
  --lf-r-arch: 50% 50% var(--lf-r-foot) var(--lf-r-foot) / 26% 26% var(--lf-r-foot) var(--lf-r-foot);
}

.lf-alcove {
  position: relative;
  aspect-ratio: 1 / var(--lf-arch-ratio);
  inline-size: min(100%, calc(var(--lf-alcove-max, 9999px) / var(--lf-arch-ratio)));
  margin-inline: auto;
  background: var(--lf-mat);
  border-radius: var(--lf-r-arch);
  overflow: hidden;
  isolation: isolate;
}

/* THE HEARTH LIGHT — painted on the WALL, never on the photograph.
   Two static gradients. No backdrop-filter, no filter(), no blur: legal inside a
   scrolling list under §9.4 and free on a mid-range Android. */
.lf-alcove::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(118% 86% at 26% 10%, rgba(255,246,228,.92) 0%, rgba(252,240,219,.42) 44%, rgba(252,240,219,0) 70%),
    linear-gradient(180deg, rgba(28,20,17,0) 58%, rgba(44,31,20,.14) 100%);
}

/* THE PHOTOGRAPH — 1:1 from a 1:1 master. object-fit: cover therefore crops NOTHING. */
.lf-alcove > .lf-alcove-img {
  position: absolute; z-index: 1;
  left: var(--lf-arch-inset); right: var(--lf-arch-inset); bottom: var(--lf-arch-foot);
  aspect-ratio: 1 / 1;
  border-radius: var(--lf-r-photo);
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(26,20,16,.10),         /* the identical edge around every ground */
              0 10px 20px -10px rgba(44,31,20,.34);  /* the foot-shade: it stands ON the floor */
}
.lf-alcove > .lf-alcove-img > img { width:100%; height:100%; object-fit:cover; display:block; }

/* OUT OF STOCK: the light goes out, the niche does not, the photograph is untouched. */
[data-stock="out"] .lf-alcove { background: var(--lf-mat-deep); }
[data-stock="out"] .lf-alcove::before { background: linear-gradient(180deg, rgba(28,20,17,0) 62%, rgba(44,31,20,.16) 100%); }
```

Because the radii are **percentages**, the proportion holds identically from a 72 px footer thumb to
a 490 px hero frame **with no breakpoint maths**. Geometry at any niche width *W*: height `1.18W`,
photograph `0.86W` square, dome zone `0.26W`.

`--lf-alcove-max` per surface: card at 1-up **340px** · card at 2-up and 3-up **none** ·
hero `clamp(420px, 64svh, 660px)` · PDP stage `min(74vh, 640px)` · thumbs/rows a fixed px height.

## 3.11 Elevation — ONE ramp, and it actually reaches the surfaces

Today two ramps exist and only one is reachable: `theme.js:20-23` defines `E1`–`E4` as JS string
literals used by every theme surface, while components use `var(--lf-e1..4)`; the `[data-theme=
"dark"]` redefinitions can therefore never affect a theme-rendered surface.

```css
--lf-e0: none;
--lf-e1: 0 1px 2px rgba(44,31,20,.055);
--lf-e2: 0 2px 4px rgba(44,31,20,.05), 0 8px 20px -6px rgba(44,31,20,.10);
--lf-e3: 0 4px 8px rgba(44,31,20,.06), 0 18px 36px -10px rgba(44,31,20,.14);
--lf-e4: 0 8px 16px rgba(44,31,20,.07), 0 36px 72px -18px rgba(44,31,20,.20);
--lf-e-nav: 0 1px 0 rgba(44,31,20,.07), 0 6px 20px -10px rgba(44,31,20,.11);
--lf-e-bar: 0 -1px 0 rgba(44,31,20,.08), 0 -10px 28px -10px rgba(44,31,20,.12);
/* --lf-e-edge DELETED along with the card frame it was propping up. */
```

- **Delete the `E1`–`E4` JS consts.** `theme.js` reads `var(--lf-e1..4)` everywhere, exactly as it
  already does for `--lf-e-nav`.
- **The 25-entry `shadows` array maps indices 1–4 to those vars** and the duplicated `boxShadow`
  declarations in `MuiPaper`/`Card`/`Menu`/`Popover`/`Dialog`/`Drawer` are removed, so `elevation`
  becomes the single way to ask for depth.
- `.lf-hearth-section` redefines all four (§3.5).
- **With the card frame gone, product cards cast no shadow at all.** Only the photograph's foot-shade,
  the ledge, and genuinely floating things (nav-when-scrolled, hero purchase card, toast, sheets,
  popover) carry elevation.

## 3.12 Motion — one ramp, declared once

`theme.transitions` (`theme.js:59-70`) is **deleted**: it duplicates this ramp numerically, has zero
consumers, and maps MUI's `sharp` to `cubic-bezier(.22,.61,.36,1)` — which is the system's *default*
curve, not a sharp one. `MuiDrawer`/`MuiDialog`'s hardcoded `{enter:380, exit:260}` are replaced.

```css
--lf-dur-1:110ms;  /* press, tick, badge bump */
--lf-dur-2:180ms;  /* colour, border, shadow */
--lf-dur-3:260ms;  /* image crossfade, accordion, reveal, popover */
--lf-dur-4:340ms;  /* overlay, drawer, route */
--lf-ease:        cubic-bezier(.22,.61,.36,1);
--lf-ease-out:    cubic-bezier(.16,1,.30,1);
--lf-ease-in:     cubic-bezier(.40,0,1,1);
--lf-ease-spring: cubic-bezier(.34,1.26,.64,1);  /* licensed for exactly two moments: bag badge, success tick */
```

**Press ladder**, scaled by element size (§2.12 upheld): button/chip `.972` · card `.985` ·
full-width row `.992` · panel >320px no scale, opacity `.94`.

**Hover/focus on a card:** the photograph lifts `translateY(-4px)` over `--lf-dur-2` and its
foot-shade tightens. **Under `prefers-reduced-motion: reduce` the ledge beneath the card thickens
2 px → 3 px and the name underlines instead** (§2.31). Every exit is faster than its entry.
`transform` and `opacity` only, plus colour/border/shadow.

**Reveal:** ONE `IntersectionObserver`, `opacity 0→1` + `translateY(8px)→0` over `--lf-dur-3`, fired
once, skipped entirely under reduced motion (which also zeroes every duration to 1 ms globally except
opacity crossfades, capped at 120 ms).

## 3.13 Breakpoints — declare the ones the design actually turns on

`theme.js:51` currently restates MUI's defaults verbatim (a no-op) while the breakpoints the layout
really uses are undeclared. **Verified safe: zero `xl:` usages in `frontend/src`.**

```js
breakpoints: { values: { xs: 0, sm: 600, shelf: 680, md: 900, lg: 1200, xl: 1440 } }
```

- **shelf 680** — the 1-up → 2-up card switch.
- **lg 1200** — 2-up → 3-up, and the container cap.
- **xl 1440** — the container widens to **1296px**. The current build raises padding to 40px at 1440
  while capping the container at 1232, which **shrinks** the content column from 1168 to 1152: a
  breakpoint that costs you pixels. Deleted and replaced.
- `MuiContainer` consumes `var(--lf-gutter)`; `defaultProps.position` on `MuiAppBar` is removed (a
  default every call site overrides is a false default).

---

# 4. The grid, arithmetically checked

## 4.1 `frontend/src/components/product/productGrid.js` — new, owned by the listing

```js
/** The catalogue's geometry. Never auto-fill. Never defined in a related-products rail. */
export const PRODUCT_GRID_SX = {
  display: 'grid',
  minWidth: 0,                                   // without this the grid overflows its flex parent
  gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
  gap: 'var(--lf-grid-gap, 20px)',
  '@media (min-width:680px)':  { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', '--lf-grid-gap': '24px' },
  '@media (min-width:1200px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', '--lf-grid-gap': '32px' },
};
```

## 4.2 Measured card widths

Container `maxWidth="lg"` = **1232px**, widening to **1296px** at ≥1440. Gutters 16 / 24 / 32 / 40.
The desktop filter rail is gone, so the grid gets the **full** content width.

| Viewport | Gutter | Container | Content | Cols | Gap | **Card width** | Rows for 6 |
|---|---|---|---|---|---|---|---|
| **320** | 16 | 320 | **288** | 1 | 20 | **288px** | 6 × 1 |
| **390** | 16 | 390 | **358** | 1 | 20 | **358px** | 6 × 1 |
| **680** | 24 | 680 | **632** | 2 | 24 | **304px** | 3 × 2 |
| **768** | 24 | 768 | **720** | 2 | 24 | **348px** | 3 × 2 |
| **1024** | 32 | 1024 | **960** | 2 | 24 | **468px** | 3 × 2 |
| **1200** | 40 | 1232 | **1152** | 3 | 32 | **362px** | 2 × 3 |
| **1440** | 40 | 1296 | **1216** | 3 | 32 | **384px** | **2 × 3** |

**Absolute floor: 288px** (1-up at 320). **Narrowest multi-column card: 304px** (2-up at 680).
Against today's **161.6px at 1440** and **157px at 1024**.
**Never a ragged final row at any breakpoint** (§2.29).

## 4.3 Proof that everything fits at the narrowest size (288px)

The card is **borderless with no `CardContent` padding**, so every element gets the **full 288px**.

**Product name.** All six real names measured — a six-product catalogue lets you simply check them
all. Inter 600 at 19px, advance ≈ 0.68em per capital, 0.54em per lowercase, 0.26em per space:

| Name | chars | measured |
|---|---|---|
| Glow Game WaterLess Face Wash | 29 | **~292px** ← longest |
| The Daily Invisible Moisturizer | 31 | ~287px |
| UV Armor Tinted Sunscreen | 25 | ~255px |
| Raindrops Shower Gel | 20 | ~198px |
| WhiteWave Face Wash | 19 | ~192px |
| Spotless Face Wash | 18 | ~180px |

The longest sets on **one line at 304px and above** — i.e. at every multi-column breakpoint — and
wraps to **two** at 288px, inside the 2-line clamp. **The clamp never truncates a name at any width
the site renders.** Today at 161px the line box is 137px, which holds ~15 characters, so the word
being cut is the word that says what the thing *is* ("Glow Game WaterLess…", "UV Armor Tinted…").

**Price.** `₹300` at `price` 17px/600 `tnum` ≈ 38px. Trivial.

**Stock line.** The status ledge row is full width. `IN STOCK` = 8 chars at 12px/600 +0.14em ≈ 82px
plus a 6px dot and an 8px gap = **96px** of 288. `BACK SOON` ≈ 92px + 14 = **106px**. The wishlist
control is in the niche's bottom-right corner and is **structurally incapable** of meeting it.

**The 44px button.** CTA is full card width, **48px tall**, `startIcon` deleted.
Label box = 288 − 2×20 (MUI horizontal padding) = **248px**.

| Label | 15px/600 Inter | fits in 248px |
|---|---|---|
| `Add to bag` | **~75px** | ✓ by 173px |
| `Notify me` | **~68px** | ✓ by 180px |

Today the same button inside a `p:1.5` box with a 20px bag icon leaves **~59px** of label box for a
label needing ~76px — which is why "Add to bag" and "Notify me" **both wrap to two lines inside
their own buttons on all six cards** in `plp-desk.png`. Fixed with 2.3× the room to spare.

**Touch targets.** CTA 48px ✓. Wishlist 36px visual with a 44px hit area via `::before{inset:-4px}` ✓.
Status ledge is not interactive. Name link inherits the card's full-bleed `::after{inset:0}` ✓.

**Card height at 1440 (384px wide).** Niche 384 × 453 → status ledge 20 + 6 → eyebrow 16 + 2 →
name 24 (one line) + 4 → review link 19 + 2 → size 19 + 10 → price 22 + 14 → CTA 48 = **~659px**.
Two rows + 32px gap = **1,350px** of grid.

**Card height at 390 (1-up, niche capped at 340px).** Niche 288 × 340 (centred in the 358px card) +
~230px of content = **~570px**. Six cards + gaps ≈ **3,520px**. This is the direction's one honest
density cost: see §10's measurement gate.

## 4.4 Other load-bearing arithmetic

| Surface | At 1440 | Check |
|---|---|---|
| **Hero** | content 1216: media col **560** + gap **48** + text col **608** | niche `clamp(420px, 64svh, 660px)` tall → at 900vh **576×488**, centred in the media column |
| **Hero fold @1440×900** | nav 64 + pad 72 + niche 576 + card overhang 28 = **740** | ✓ inside 900. The purchase card's `Add to bag` is above 740. |
| **Hero fold @1366×768** | content 1152, niche `64svh` = 491 → 64 + 72 + 491 + 28 = **655** | ✓ inside 768 — the resolution that breaks a fixed-height hero |
| **Hero fold @360×640** | nav 56 + 24 + eyebrow 26 + headline 2 lines @34px = 89 + niche 300 + card overhang −24 | CTA bottom ≈ **559** ✓ inside the 584 visible |
| **PDP @1440** | content 1216, 7/5 with 40px gap → gallery **686**, buy box **490** | §5.3 |
| **MobileBuyBar @320** | 104 price + 8 gap + 168 CTA = **280** | ✓ inside 288 |

---

# 5. Page by page

## 5.1 Home — five sections, ~2,250px at 1440

### ① HERO — the lit alcove. §2.15 finally built.

`py: var(--lf-sect-lg)`. Background `--lf-canvas`.

**Desktop (content 1216).** Media column **560px**, text column **608px**, 48px gap.

- **Media column:** `<Alcove>` with **UV Armor Tinted Sunscreen** — the bestseller, in stock, ₹480 —
  `height: clamp(420px, 64svh, 660px)`, width following the locked ratio, centred.
- **Text column**, vertically centred:
  eyebrow `SKINCARE FOR THE WHOLE FAMILY` (12px, +0.14em, `--lf-gold-ink`) → **`variant="display"`**
  60px/600/−0.006em `"Skincare that feels like coming home."` in `--lf-ink` (15.97:1), left-aligned,
  measure capped so it breaks to 2 lines → 16px → subhead `body1` `--lf-ink-2` (8.37:1) at 46ch,
  `brand.js` verbatim → 28px → **ledge** → 20px → a three-item proof row from
  `useSubstantiatedClaims({limit:3})`: 13px `--lf-ink-3` with 16px `--lf-gold-edge` glyphs.
- **THE PURCHASE CARD.** 396px wide, `--lf-paper`, `--lf-r-panel`, `--lf-e3` **plus a real
  `0 0 0 1.5px rgba(26,20,16,.16)` edge** (on a warm ground a near-white panel with only a shadow
  reads as a smudge on a cheap Android panel). Absolutely positioned at the niche's bottom-left,
  `left:32px; bottom:-28px`, so it overlaps the niche's foot and sits half on the canvas.
  **Opaque paper, never real glass** (§2.15's own instruction, §9.4).
  Contents at 20px padding: 56px `<Alcove size="thumb">` of the same product → eyebrow category →
  `h4` 19px product name → `priceLg` ₹480 → `<StockLabel>` → **52px full-width ink `Add to bag`**
  (no `startIcon`) → 13px `--lf-ink-2` delivery line **read from `policy.js`**, never typed.

**Mobile (390, content 358).** Order changes so the transaction clears the fold:
eyebrow → `display` 34px headline (2 lines) → `<Alcove>` with `--lf-alcove-max: 300px` →
purchase card 326px centred, overlapping the niche foot by −24px, **price and the 52px CTA on one
row** → **subhead below the card**. Arithmetic in §4.4: the CTA clears a 360×640 fold.

> **Why:** a skincare brand whose equity is warm light currently opens with **406px** of centred
> Inter Tight and no photograph, because `Hero.jsx:15-20` uses an unsolved build problem to settle a
> brand decision. Fix the pipeline, delete that comment, put the product in the first viewport with a
> real price and a real `Add to bag`.

### ② THE HEARTH — moved from section 6 to section 2

Full-bleed `.lf-hearth-section`, `--lf-sect-lg` padding, the radial gradient of §3.5 — the fire is in
the bottom-left corner and the light falls up and right across the band.

Left-aligned, 56ch measure: **`brandDisplay`** (Fraunces 44px — **the page's entire serif budget**,
licence 2 of 3) rendering `brand.territoryLine` → 20px → **one new line of body copy that is not
`positioningStatement`** (today `CampaignSlot.jsx:130` reprints it, and its second sentence is the
hero subhead verbatim) → 28px → a ghost `Shop all products` button in `--lf-ink` with a 1px
`--lf-gold-edge` border and the `#E3C78C` focus ring (11.07:1).

> **Why moved:** the brand's single warm moment currently sits ~2,400px down on section 6 of 8,
> printing a sentence the page has already printed. At position 2 it lands while people are still
> reading, and it gives the page its one **hard contrast of scale** — lit niche, then dark hearth —
> which is the structural fix for four consecutive sections being the same module.

### ③ THE SHELF — all six products, the fold-breaker

`py: var(--lf-sect)`. Background `--lf-canvas`.

eyebrow `THE SHELF` → `h2` `Six formulations.` → **ledge** → 12px `--lf-ink-3`
`Three on the shelf today. The other three come back — we'll tell you when.` → 40px → **the catalogue
grid: the identical `<ProductCard>` at the identical `PRODUCT_GRID_SX` as the PLP.** One card
language, one grid token, site-wide.

At 1440 that is **two rows of three at 384px**. **In-stock sorts first** (§2.23), so row 1 is three
lit niches with ink `Add to bag` and row 2 is three unlit niches with gold `Notify me`. A single 13px
`--lf-ink-3` line sits above row 2: `Back soon`. Nothing is hidden and nothing is apologised for —
the catalogue's biggest liability becomes the page's clearest composition.

**Beneath the grid: `<ShelfBundle>`** (§6.8). A full-width panel on `--lf-gold-tint` (`--lf-ink` on it
= 15.14:1), 64px tall at desktop: left, `h4` `Everything on the shelf today` + 13px
`Three formulations, one delivery.`; right, a **52px ink** `Add the shelf · ₹1,080` — the total
computed at render from real prices, never typed. **No discount is claimed**: `policy.js` already
makes delivery free with no threshold, so there is no nudge available to fake.

### ④ WHAT WE CAN EVIDENCE — the claims, once, flat

`py: var(--lf-sect-sm)`. Full-bleed `--lf-mat` with a **ledge along its top edge**.

eyebrow `WHAT WE CAN EVIDENCE` → `h3` → **one 72px row** of four claims: 20px `--lf-gold-edge` glyph,
15px/600 label, 13px `--lf-ink-3` description, separated by 1px `--lf-hairline` verticals.
**No cards, no borders, no boxes.** 2×2 below 680. All four from `useSubstantiatedClaims()`.
`brand.territoryLine` is **not** reprinted here — the section already has an eyebrow and a heading.

### ⑤ FOOTER — §5.11. The footer does the newsletter's job; the standalone block is deleted.

## 5.2 PLP — `/products`

**Header.** Breadcrumb 13px → **`h3` 26px** `The shelf` (not `h1` 48px: `All products` is currently
the largest, boldest, highest-contrast element on a page whose products are 161px of mostly-white
packshot) → 8px → 15px `--lf-ink-3` `Six formulations. Three on the shelf today.` → **ledge** → 24px.

**ONE 52px toolbar row**, replacing ~160px of chrome and the 264px / ~1,300px rail:

- **Left:** the three concern chips that actually have products — `Cleansers (1)` · `Sun Protection (1)` ·
  `Body Care (1)` — plus an **`In stock (3)`** toggle. 36px pills, 1px `--lf-border-strong`,
  selected = ink fill with a 2px `--lf-gold-edge` underline. **Never colour alone.**
- **Right:** a **`Refine`** button (`aria-haspopup="dialog"`, 44px) and **Sort**.

**Sort is fixed, not re-decorated.** Today it is wrapped in `<FacetGroup legend="Sort by">` **and**
given its own `<InputLabel>Sort by</InputLabel>`, so the label prints twice — once as a gold overline,
once as the field's floating label — above a **blank outlined box with only a caret**, because the
default value is `''` and MUI treats that as empty. Drop the `FacetGroup` wrapper (it is not a facet),
keep one `InputLabel`, and give the `Select` a `renderValue` so `''` displays **`Recommended`**.

**LF-08 is preserved in full.** `Refine` opens a **desktop popover** that renders the *existing*
`ProductFilter` component; mobile keeps the existing staged bottom sheet with `Show N products`
(the best-built thing on the page — live refetch per tick is unusable on Indian 4G). Same URL params,
same `Clear all`, same refresh/Back round-trip, same `aria-disabled` + visible count on zero-count
rows (§6.7). Inside it: **`Sub-category` is dropped from the UI** (identical to `Concern`;
`sub_category` stays a supported URL param) and **`Price` is repaired** (§2.25) to
`Under ₹300 (2)` · `₹300–₹400 (3)` · `₹400+ (1)`, derived from real min/max.

**Grid.** §4. **Default order: in-stock first** unless the shopper has explicitly sorted, so the
catalogue falls into exactly two full rows of three at ≥1200 — a lit row and an unlit row — with no
ragged final row at any breakpoint.

**The page ends.** Grid → 64px → a 96px hearth-band footer-lead carrying `brand.territoryLine` →
footer. **No pagination** for six products (the control is removed, not rendered-and-empty), no
"You might also like", no filler. ~**1,700px** at 1440 against today's ~2,600 with 1,000px of void.

## 5.3 PDP — `/products/:slug`

**7/5, not 50/50.** §8 line 1523 already specified gallery 1–7 / buy box 8–12 and it was never built:
the page ships two hard `width:'50%'` columns, and inside the gallery a 72px thumbnail rail plus a
16px gap squeezes the main image to ~468px — **the photograph of the thing being sold occupies 32% of
the content width.** At 1440: gallery **686**, buy box **490**, 40px gap.

**Gallery.** `<Alcove surface="pdp">`, `--lf-alcove-max: min(74vh, 640px)`. **The same niche, the same
hearth light, the same foot-shade as the card** — so a product you tapped on the shelf opens into a
larger version of the exact frame it was standing in. *That continuity is the design.*
`data-fit="contain"` is removed from the PDP mat (§2.10): the masters have no alpha and six different
grounds, so `contain` paints a cyan or pink rectangle inside a warm arch.

**The thumbnail rail moves beneath the main image**, horizontal, 72px squares, `scroll-snap`,
selected = 2px `--lf-gold-edge` (3.16:1, clears SC 1.4.11). **Thumbnails load the 160px derivative** —
today they render `<img src={image} width="144" height="144">` from the full-resolution source, so a
ten-image PDP downloads **~50 MB**, most of it to paint ten 72px squares. `fetchpriority="high"` on
frame 1 only; frames 3+ `loading="lazy"`.

**Buy box**, 490px, sticky at `calc(var(--lf-nav-h) + 24px)`, `max-height: calc(100dvh - var(--lf-nav-h)
- 48px)`, internal scroll, `overscroll-behavior: contain`. Order:
eyebrow category → `h1` 44px name → **`Be the first to review` as a real anchor that scroll-targets the
review form** (today it is a `Typography` with `cursor:pointer` and no handler) → `priceLg` →
`<StockLabel>` → size + SKU 13px → **ledge** (the page's one gold rule) → quantity stepper →
52px primary → 52px secondary → wishlist **text** button → **delivery and returns as two rows with two
wordings**, numbers from `policy.js` → `Buy on Amazon` as a tertiary text link →
`About this item` as a **definition list**, not an MUI `Table` with a fixed `width:200` cell that
cannot fit 288px.

- **In stock:** primary ink `Add to bag · ₹480` (the bag icon is licensed **here** and in the sticky
  bar, nowhere else), secondary outlined `Buy now`.
- **Out of stock:** the stepper and `Buy now` are **removed, not disabled**; primary becomes
  `--lf-gold` fill with an `--lf-ink` label (8.15:1) `Notify me when it's back`, revealing one inline
  email field plus a 13px honest line: `One email, the day it's back. Nothing else.`
  **Never `disabled`** — `aria-disabled` with a visible adjacent reason (§6.8).

**THE RITUAL** (§2.32), directly beneath the gallery. `h3` `The ritual`, then `how_to_use` split on
sentence boundaries into numbered rows separated by 1px `--lf-hairline`. For UV Armor that renders,
verbatim, with zero invention:
> **01** Apply generously and evenly to all exposed skin 15 minutes before sun exposure.
> **02** Reapply frequently, especially after swimming, sweating, or towel drying.

Beneath it, `suitable_for` as one plain line and `skin_types` as chips — per-product suitability,
which is what replaced the withdrawn sitewide universal-suitability claim.

**Below the fold.** Tabs at ≥900, **stacked accordion below** (four labels do not fit 288px and
off-screen tabs are undiscoverable). Accordions animate `grid-template-rows: 0fr → 1fr`, never a
measured pixel height.

**THE REST OF THE SHELF** replaces `RelatedProducts`. On `--lf-mat` with a ledge: eyebrow →
`h3` → **all five** remaining products as a horizontal `scroll-snap` row of `<ProductCard>` at 300px
with a visible 2px `--lf-gold-edge` scroll indicator — it fills its row at every width and never
leaves an empty track. Then `<ShelfBundle>` with the current product already counted in the total.

**JSON-LD.** `Product` emitted from the **same source the UI renders** — `offers.price` equal to the
visible price, `offers.availability` from the same `in_stock` the badge reads. **`aggregateRating` is
omitted entirely**, because `review_summary.count` is 0 on all six.

**Mobile.** One column, niche full width, thumb rail scroll-snapped beneath with dot indicators, buy
box stacked, `MobileBuyBar` revealed by `IntersectionObserver` on the inline CTA (§4.4 arithmetic).

## 5.4 Cart — `/cart`

UTILITY archetype. Lines 1–7 in one panel with internal hairlines, 88px `<Alcove size="row">`
thumbnails, summary 8–12 sticky, free-delivery line read from `policy.js`.
**The empty state passes `<CrossSell />` as `children`** — `EmptyState.jsx:214` exists solely for this
and its own docstring uses the empty cart as THE example (§2.28).

## 5.5 Checkout — `/checkout`

**`chrome="minimal"`** (§2.27): `Layout` gains the mode, applied to `/checkout` and
`/order-confirmation`. It renders only the Fraunces wordmark linked to `/`, the lock +
`Payments handled by PhonePe` line `Checkout.jsx:601-605` already composes, and a `Back to bag` link.
No search, no nav links, no wishlist, no account, no bag icon. The footer is **one copyright line**.

- **At xs**, the order-summary column is the second grid child and therefore stacks **below** the
  `Place Order` button, so the coupon field and `Edit your bag` render *after* the CTA the shopper has
  already pressed. Give the grid children explicit `order` so the coupon sits inside review section 3
  **above** the CTA, and add a **sticky bottom pay bar** carrying total + Pay with
  `padding-bottom: max(16px, env(safe-area-inset-bottom))` so the amount never scrolls away.
  This requires `viewport-fit=cover` in `index.html` or **every `env()` in this system resolves to 0.**
- **At md+**, delete the duplicated totals stack at `Checkout.jsx:851-895`: it renders Subtotal /
  Discount / Shipping / Total payable with byte-for-byte the same figures as the sticky `CartTotals`
  at line 934, in a different type treatment. **Two "Total" blocks on one screen is a trust defect.**
  The review panel keeps only line items and `Delivering to`.

## 5.6 Order confirmation — the COD arm (§2.26)

Branch on **`payment_method === 'COD'` before `paymentStatus`**:
`tone: 'ok'`, `CheckCircleOutline`, headline **`Order placed`**, body `Pay ₹X to the courier when it
arrives.` **Never poll. Never render `LinearProgress`.**
`showMoney` becomes `paymentStatus === 'COMPLETED' || isCOD`, and the `Paid` row relabels to
**`To pay on delivery`**.

Then rebuild it as a brand moment rather than a bank receipt: widen `Container` from `sm` to `md`,
put **56px `<Alcove size="thumb">`** beside each line item, show the delivery address and the
`expected_delivery_date` checkout already computes, and close with a hearth band carrying
`brand.territoryLine`. It is the highest-trust moment in the store and it currently looks like a
failure screen.

## 5.7 About — `/about`

EDITORIAL. **H1 becomes the brand's own words:** `The hearth is where a family gathers`, subhead
`We make the shelf it gathers around.` The hand-typed `The art of the everyday ritual` — a line that
appears nowhere in `brand.js` and belongs to no brand in particular — is deleted.
**The claims grid is cut from this page** (it would be the third rendering of the same four strings
after the marquee and the home grid; substantiation belongs once).
In its place, the only image this page can own: **the six-product shelf at full width, in order, as
the thing the family gathers around.** Until `TODO(business) 4` lands, that is a better page than a
text-only story.

## 5.8 Contact · FAQ · 404 · auth · empty and error states

- **Contact / FAQ** — EDITORIAL. **The fraud notice lands here**, reworded so it cannot be read as
  being about the gateway: *"We will never call or message you asking for a payment. All payments
  happen on this site or on PhonePe's own page."* Support email only; **no phone row renders**,
  because `brand.support.phone` is `null`. One label per route — `Help` — ending the five different
  names currently used for `/faq`.
- **Auth** (`/login`, `/signup`, `/verify-email`, `/forgot-password`) — UTILITY, single column capped
  at 420px, `--lf-paper` panel on `--lf-canvas`, `--lf-border-field` on every input (SC 1.4.11),
  one 48px ink primary, one text escape. No marketing copy, no product rail, no social proof.
- **Empty / error states** — §2.16's form upheld (64px tinted circle, 28px outline glyph, heading,
  one line, one primary, one text escape, **no illustrations ever**), and §2.28's `children` slot
  finally used on all six routes:

| Route | Heading | Rail passed as `children` |
|---|---|---|
| Empty cart (`Cart.jsx:326`) | `Your bag is empty` | `<CrossSell />` |
| Empty wishlist (`Wishlist.jsx:67`) | `Nothing saved yet` | `<CrossSell />` |
| No orders (`Orders.jsx`) | `No orders yet` | the three in-stock products |
| Profile (`Profile.jsx:309`) | per state | the three in-stock products |
| Idle search (`Search.jsx:192`) | — | **the whole shelf, six rows** |
| **404** (`NotFound.jsx:40`) | `We can't find that page` | the three in-stock products |
| No filter results | `No products match these filters` | primary `Clear all filters` |

Nothing new is built — `CrossSell` and the grid token already exist and are imported in neighbouring
files. Error panels keep their `3px` semantic left edge, `role="alert"`, plain language, **never a
status code**, and backoff `600ms → 1.5s → 4s`.

## 5.9 The two page archetypes (§2.34) — nine one-line edits

| Archetype | Pages | Heading | Alignment | Padding |
|---|---|---|---|---|
| **EDITORIAL** | About, Contact, FAQ, 404 | `variant="h1"` (44px) | left, 56ch measure | `py: var(--lf-sect-lg)` |
| **UTILITY** | Cart, Checkout, Orders, Profile, Wishlist, Search, Confirmation | `variant="h3" component="h1"` (26px) | left | `py: var(--lf-sect)` |

**`Wishlist.jsx:44`'s `minHeight: '100vh'` is deleted.** It sits inside `Layout`'s flex column, below
a nav spacer and above the footer, so it guarantees a vertical scrollbar and pushes the footer
off-screen **on every single visit** — including when the page is showing a 64px empty-state circle.
`Layout`'s `flexGrow: 1` on `<main>` already does what it was reaching for.

## 5.10 Search overlay

**Drop `in_stock: true`** (§2.24). Out-of-stock rows render with a muted `Back soon · notify me`
label. The idle state stops being one line of grey text in a 60vh panel and becomes **the whole
shelf**: six rows, 48px `<Alcove size="row">` + name + price + status. Opening search on an empty
query shows you the shop.

## 5.11 Footer

`.lf-hearth-section` (§2.7). Remove the explicit `backgroundColor: 'var(--lf-canvas)'` at
`Footer.jsx:114` and let the class take over — **nothing else in the file needs a colour change**,
because every gold token inside the class is already redefined to 8.11:1 / 11.07:1. Three bands,
separated by `rgba(251,244,232,.14)` hairlines:

1. **Fraunces wordmark 28px** (licence 3 of 3) + `brand.territoryLine` at `brandDisplay`-minus-one-step
   in `--lf-ink` (16.59:1). **The brand's last word is the hearth sentence, not a link farm.**
2. **All six products** as a single row of 72px `<Alcove size="thumb">` with name and price, linked.
   **This is the shop link**; the entire SHOP column is deleted.
3. **Gold ledge**, then one compressed caption row: Support, legal links, `@lefoyerglobal`,
   `Made in India` **as plain text** (the State Emblem image is removed — §1.3), and the newsletter
   field with the Join button finally wired to **`variant="brandFill"`** — the one licensed gold solid
   button, which has had zero call sites since the system was written.

Support email only. **No phone row.** The fraud notice has moved to `/contact` and `/faq`.

---

# 6. Component contracts — the ones that carry money

## 6.1 `<Alcove>` — the brand, as a component (§2.30)

```jsx
<Alcove
  product={product}            // for alt text, slug, and the stock attribute
  surface="card|hero|pdp|thumb|row"   // sets --lf-alcove-max and the <ProductImage> sizes string
  priority={false}             // true → fetchpriority="high" + loading="eager"; hero and PDP frame 1 only
  frame={0}                    // which image of productImages()
/>
```

It owns the niche, the hearth light, the photograph's ring and the foot-shade. **No page composes one
by hand**, so a surface can never render a product without its frame. It renders
`<ProductImage>` internally and sets `data-stock` from `utils/stock.js` on its root — which is how the
light goes out without a single component knowing about gradients.

## 6.2 `<ProductCard>` — borderless, one card, used everywhere

`<article data-stock={state}>`, `display: grid`, `grid-template-rows: auto auto auto auto 1fr auto`
so **the CTA bottom-aligns across every card in a row regardless of whether a name wrapped**. This
replaces the `minHeight: 45` hack on the title. No `Card`, no border, no `CardContent` padding,
no shadow — **the niche is the frame** (§2.6).

Fixed order, every element at full card width:

1. `<Alcove surface="card">`. **Wishlist** at its bottom-**right**, inset 12px: 36px circle on
   `--lf-paper` at 0.82 → 1 opacity, 44px hit area via `::before{inset:-4px}`, **permanently visible,
   never `opacity: 0`** (§9.5).
2. **14px → `<StatusLedge>`** — the full-width status row (§2.14). In stock: 6px `--lf-ok` dot +
   `IN STOCK` 12px/600 +0.14em `--lf-ok-ink` (6.13:1). Out: 6px dot + `BACK SOON` `--lf-warn-ink`
   (6.24:1). **Words and a dot, never colour alone.**
3. 6px → category eyebrow, 12px `--lf-gold-ink`.
4. 2px → **`h4` 19px product name**, `--lf-ink`, 2-line clamp as a safety net only (§4.3). Its `<a>`
   carries `::after{position:absolute;inset:0}` so the whole card is clickable **without nesting the
   buttons inside an anchor** — fixing today's invalid nested-interactive markup.
5. 4px → `Be the first to review`, 13px `--lf-ink-3`, **a real link to the PDP review form**.
   **Never a star row, never a count** — all six products have zero `Review` rows.
6. 2px → size line, 13px `--lf-ink-3`.
7. 10px → `<PriceBlock>`.
8. 14px → **the CTA, 48px, full card width, no `startIcon`.**

`coming_soon` keeps the card a working link; today's `pointerEvents:'none'` on the whole card is
deleted. The second image is **not fetched at all** under `@media (hover:none)`.

## 6.3 `<PriceBlock>` — one component, five surfaces

Card, buy box, cart line, summary row, search row — so **price can never disagree with itself**.
`Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0})` (today's bare
`₹{price}` prints `₹1299.00` from the DRF decimal). Current price `--lf-ink` at **15.97:1**.
`price` 17px / `priceLg` 28–34px, `font-variant-numeric: tabular-nums` always.
**Never renders `₹undefined` / `₹NaN` / `₹0`** — a missing price renders `Price on request` and forces
the CTA to secondary `View details`. **§6.8 rule 4 is narrowly overturned** (§2.21): the price stays
full-weight on an out-of-stock card, because zero products carry a `discount_price` so there is no
discount to suppress.

## 6.4 `<StockLabel>` — one derivation, `utils/stock.js`

The expression currently lives in `ProductCard.jsx` **and** `ProductDetail.jsx` with **different
fallbacks**, which is exactly how a tile and a PDP end up disagreeing. One export, consumed by card,
PDP, search row and cart line.

```
in_stock === false                      → 'out'
(available_quantity ?? stock_quantity) <= 0 → 'out'
                                     <= 5 → 'low'
otherwise                               → 'in'
coming_soon overrides everything        → 'soon'
```

Four states, each with **its own words and a dot**, never colour alone. **Rendered always, including
when in stock.** It also sets the `data-stock` attribute `<Alcove>` reads.

## 6.5 `<AddToBag>` — ink, always

48px on a card, 52px in a buy box, full width of its container, **no `startIcon` on a card**.
Loading: `min-width` frozen at the measured label width, label to `opacity .45`, a 16px
`thickness 3.6` `currentColor` spinner, `aria-busy="true"`, pointer events off, **400ms minimum
display** so it cannot flicker. Success: label crossfades to a check + `Added` for 900ms while the
nav badge springs (`--lf-ease-spring`, licensed moment 1 of 2).
**A button never turns red** — it returns to default and the error appears adjacent.

## 6.6 `<NotifyMe>` — gold fill, never absent, never `disabled`

`--lf-gold` fill with an `--lf-ink` label at **8.15:1** (licensed fill 1 of 2, §2.18). Same 48/52px
geometry as `AddToBag`. On a card the label is `Notify me`; in a buy box it is
`Notify me when it's back` and it reveals one inline email field plus
`One email, the day it's back. Nothing else.`
**`aria-disabled`, never the `disabled` attribute**, with the reason always stated adjacent in 13px
`--lf-ink-3` (§6.8 rules 1–3). The button **never vanishes**.

## 6.7 `<BuyBox>` — §5.3's order, verbatim

Sticky, columns 8–12, `max-height: calc(100dvh - var(--lf-nav-h) - 48px)`, internal scroll,
`overscroll-behavior: contain`. **Delivery and returns are two rows with two wordings**, numbers from
`policy.js` so they cannot drift from the policy page. `PincodeCheck` either ships with a real lookup
**or the promise copy is deleted with it.**

## 6.8 `<ShelfBundle>` — the one basket-raising mechanic (§2.19)

```jsx
<ShelfBundle products={inStockProducts} exclude={bagProductIds} />
```

- Renders **only** when ≥2 in-stock products are not already in the bag; otherwise it renders `null`.
- Label: `Add the shelf · ₹{total}`, where `total` is the summed `price` of exactly the products it
  will add, formatted by `PriceBlock`'s formatter. **Never a typed number.**
- **Ink fill, 52px, full panel width** (§2.20) — the biggest ink action on the page.
- It issues N calls through the **existing** cart service with one optimistic toast. **No new
  endpoint.** If any call fails, the toast names exactly which products were added and which were not.
- **No discount, no urgency, no threshold copy.** The subtext is `Three formulations, one delivery.`

## 6.9 `<Navbar>`

56px mobile / 64px desktop, `position: sticky` (not `fixed`), **no `Toolbar` spacer anywhere**,
`html { scroll-padding-top: calc(var(--lf-nav-h) + 16px) }`. This also deletes
`Layout.jsx:15`'s `{!isHome && <Toolbar />}`, which is why the home hero renders under the bar today.

`.lf-glass` with `--lf-paper-glass` + `--lf-blur`, an `@supports` fallback to solid `--lf-canvas`, and
a `prefers-reduced-transparency` opt-out. **Nothing `position: fixed` nests inside it** — a
`backdrop-filter`ed ancestor becomes a containing block for fixed descendants.

Left: **three links, `Products` / `About` / `Help`** — one label per route. Centre: the Fraunces
wordmark at 20px (licence 1 of 3), **with the 11px tagline line deleted** — two lines of centred type
is why the bar is 72px tall in `home-desk.png` and cramped at 390. Right: search, wishlist, account,
bag, each with a 44px hit area. Active route marked by a 2px `--lf-gold-edge` underline, **never by
colour alone, never only on hover**.

**Scroll state, finally wired** (§2.9): one `IntersectionObserver` on a 1px sentinel at the top of
`<main>` writes `data-scrolled` to a **ref'd DOM node**. Scrolled, the bar gains `--lf-e-nav` **plus
the 2px gold ledge along its lower edge** — the brand hex above the fold on every route. Guarded by
`prefers-reduced-motion`.

## 6.10 `<Footer>` — §5.11, and `<Layout chrome="minimal">`

`Layout` takes `chrome="full" | "minimal"`. Minimal is applied to `/checkout` and
`/order-confirmation` only (§2.27). Everything mounted globally — `ToastProvider`, the bag drawer —
stays mounted in both modes; only the nav links, search, wishlist, account and the footer link farm
are withheld.

---

# 7. Imagery

## 7.1 What we actually have

`frontend/public/images/products` — **19 masters** (18 PNG + `WhiteWave_4.jpg`), 1.18–6.12 MB,
2048² (three at 1024²), **all RGB colour-type 2, no alpha**. Plus **35 byte-identical placeholder
JPEGs** and `State_Emblem_of_India.png`.
**There is no logo file, no hero art and no og:image in this repository.** The Fraunces wordmark is
the mark until one exists.

Per §1.2, the masters fall into two measurable classes:

- **PACKSHOT** — near-uniform ground, subject inside the frame. `Spotless_1`, `WhiteWave_1`,
  `WhiteWave_7`, and `Spotless_6` marginally.
- **SCENE** — full-bleed composition, subject running to 96–99% of frame width, varied and often cool
  ground. The other fifteen.

**The niche frames both classes identically**, which is the entire point of §2.10. Nothing is
cropped, nothing is washed, nothing needs re-shooting to ship.

## 7.2 The pipeline — a prerequisite, not an optimisation (§2.12)

`scripts/derive-images.mjs` (sharp), run as a Vite prebuild:

- From each master emit **AVIF + WebP at 320 / 480 / 640 / 960 / 1280 / 1600**, plus a **160px thumb**
  derivative, into `public/images/derived/<slug>-<w>.<ext>`.
- Budgets, **enforced in CI**: AVIF ≤ **140 KB** and WebP ≤ **220 KB** at 1600; ≤ **28 KB** at 480.
- Keep **one 1280 JPEG** as the final fallback. **Delete the PNGs and the 35 placeholder JPEGs from
  the deploy.** The PNGs stay in the repo as build inputs.
- Emit `derived/manifest.json` recording, per image, the measured corner-uniformity and subject
  extent, so §7.6's data review can be done against numbers rather than eyeballs.

## 7.3 `<ProductImage>` — the only thing that writes an `<img>`

**No component ever writes `<img src>` again.** It emits `<picture>` with AVIF → WebP → JPEG,
`srcset`/`sizes`, explicit `width`/`height`, `decoding="async"`, and a composed `alt`
(`"{name}, {size}"` — **never `"Product 3"`**).

| Surface | `sizes` |
|---|---|
| card | `(min-width:1200px) 384px, (min-width:680px) 348px, calc(100vw - 32px)` |
| hero | `(min-width:900px) 560px, calc(100vw - 32px)` |
| pdp | `(min-width:900px) 640px, calc(100vw - 32px)` |
| thumb | `72px` |
| row | `88px` |

`fetchpriority="high"` + a `<link rel="preload">` on **the hero frame only**. Everything else
`loading="lazy"`.

**Today:** `grep -rn "srcset\|srcSet\|<picture\|webp\|avif" frontend/src` → **0 hits**. The PLP ships
~30 MB to render six 161px thumbnails and a PDP ships ~50 MB. After the pipeline, six cards at 480w
AVIF ≈ **180 KB total**.

## 7.4 What each surface uses

| Surface | Component | Frame | Derivative |
|---|---|---|---|
| Home hero | `<Alcove surface="hero" priority>` | UV Armor, frame 0 | 960–1280 |
| Card (home shelf, PLP, wishlist, rest-of-shelf) | `<Alcove surface="card">` | frame 0 | 480 / 640 |
| PDP stage | `<Alcove surface="pdp" priority>` (frame 1 only) | all frames | 960–1280 |
| PDP thumbnails | plain `<ProductImage>` in a 72px button | all frames | **160** |
| Footer row · search row · cart line · confirmation line | `<Alcove surface="thumb\|row">` | frame 0 | 160 / 320 |

## 7.5 The category-tile placeholder bug — solved concretely

**Root cause:** the `Category` model has **no `image` field**, so `ProductCategories.jsx:86` falls into
a branch that renders the category name as `variant="h3"` in `--lf-ink-3` grey, centred in an empty
beige 4/5 box, and then the permanent bottom label at line 105 renders **the same name again**. No
category has an image, so this is the **only state that ever ships** — visible in both screenshots as
"Body & Lip Care" printed twice in one tile.

**The fix is threefold and all three parts are binding:**

1. **The component is deleted** (§1.3). Two categories over three concerns is the same navigation
   twice; with six products the shelf *is* the navigation.
2. **The rule that prevents recurrence, binding on every future tile:** *a navigation tile must never
   render its own name as placeholder artwork, and must never render its name twice. If a tile has no
   image it does not render as a tile.*
3. **If a category or concern tile is ever reinstated**, it is composed from the products it contains
   — **not** from a new CMS field: a `<Alcove surface="card">` showing the category's bestselling
   product, with the category name rendered **once**, as the real label beneath it. No backend change,
   no empty box, no duplicate name. And `SKELETON_TILES` is derived from the expected count, never
   hardcoded to 3 when 2 arrive.

## 7.6 `TODO(business)` — assets and data that genuinely do not exist

None of these block this direction. Nothing renders a broken path while they are outstanding.

1. **og:image / share card** — **1200×630 JPEG, ≤120 KB.** `brand.seo.ogImage` stays `null` and
   `SeoHead` **omits the tags entirely** until it exists.
2. **Favicon + PWA set** — **32 / 180 / 192 / 512 PNG.** No logo file exists; the Fraunces wordmark is
   the mark until one does.
3. **Re-photograph the two screenshot masters.** Two of the six live `image_main` files are literally
   `Screenshot_from_2026-01-27_*.png` — screenshots, not photography. **2000×2000**, same warm ground,
   single soft key from the upper left. Until then they render in the niche like everything else,
   which is the honest treatment.
4. **One editorial hearth/family frame** — **2400×1600**, warm morning light, for the About page.
   Until it lands, About uses the six-niche shelf, which is a better page than a text-only story.
5. **Shoot note for all future photography** (a standing constraint, now that the niche is the frame):
   *square 1:1 output, subject centred with ~12% headroom, nothing critical in the outer 7% on either
   side.* The niche insets the photograph by 7% and gives it a 1:1 frame, so a 1:1 master is never
   cropped — but a subject bleeding off the master's own edge will still look cut off *in the
   photograph*.
6. **`TODO(data)` — fix the taxonomy in admin before launch.** `The Daily Invisible Moisturizer`
   (`LF-SK-MO02`) is filed under sub-category **Cleansers**. Also resolve the live contradiction
   between the UV Armor carton ("Net Wt. 50 gm / 1.76 oz") and the API `size` ("100 ml / 3.38 fl oz")
   — one of them is wrong on a live product page and it is an active returns risk.

---

# 8. Accessibility and performance — stated as checkable requirements

## 8.1 Accessibility (each line is a test)

| # | Requirement | How it is checked |
|---|---|---|
| A1 | Every text/background pair in §3 meets **4.5:1** (3:1 for ≥24px or ≥19px bold). | The §3 tables. Re-run the luminance script on any token change. |
| A2 | `--lf-ink-4` and `--lf-gold` never carry text. | `grep -rn "color:.*--lf-ink-4\|color:.*var(--lf-gold)[^-]" frontend/src` → 0 hits outside `.lf-hearth-section`. |
| A3 | Every input, checkbox and radio has a **≥3:1** boundary. | `--lf-border-field` **3.63:1** on canvas, **4.05:1** on paper. |
| A4 | Disabled commerce controls use **`aria-disabled`, never `disabled`**, with the reason stated adjacent. | `grep -rn "disabled" frontend/src/components/product frontend/src/pages/ProductDetail.jsx` → no bare `disabled` on a CTA. |
| A5 | Disabled label contrast ≥4.5:1. | `--lf-ink-3` on `--lf-quiet` = **4.65:1**. |
| A6 | Every interactive target is **≥44×44 CSS px**, including the wishlist heart and the filter trigger. | DevTools box model at 320px. |
| A7 | Focus is visible on every surface, never clipped inside a scroller. | §3.6; `outline-offset: -2px` inside scroll containers. |
| A8 | **No meaning carried by colour alone.** Stock, active nav, selected chip, selected thumbnail all carry words, an underline or a dot. | §6.4, §6.9. |
| A9 | `prefers-reduced-motion: reduce` zeroes every duration to 1ms, removes the reveal and every translate, and **preserves affordances** via the thickened ledge (§2.31). | Toggle in DevTools; the card still signals hover/focus. |
| A10 | `prefers-reduced-transparency` removes every `backdrop-filter`. | `html[data-glass="off"]` path. |
| A11 | **No auto-scrolling content.** The marquee is deleted (WCAG 2.2.2). | `grep -rn "Marquee" frontend/src` → 0 hits. |
| A12 | No nested interactive elements. The card link uses `::after{inset:0}`, not a wrapping `<a>`. | axe-core: 0 `nested-interactive` violations. |
| A13 | Every `<img>` has a composed `alt`, explicit `width`/`height`. | `<ProductImage>` is the only emitter. |
| A14 | Accordions animate `grid-template-rows: 0fr → 1fr`. | §9.6. |
| A15 | Skip link first in the DOM; `scroll-padding-top` accounts for the sticky nav. | Keyboard-only pass on every route. |

## 8.2 Performance (each line is a budget)

| # | Requirement | Budget |
|---|---|---|
| P1 | Largest shipped image variant. | **AVIF ≤140 KB · WebP ≤220 KB** at 1600. **Enforced in CI**; the build fails over budget. |
| P2 | PLP total image weight at 390px. | **≤400 KB** for six cards (today ~30 MB). |
| P3 | PDP total image weight. | **≤900 KB** including all gallery frames (today ~50 MB). |
| P4 | LCP on a throttled mid-range Android (4× CPU, Fast 3G), home. | **≤2.5 s.** **The hero does not merge without this measurement.** |
| P5 | CLS. | **≤0.05.** Every image has explicit dimensions; skeletons lay out at the real element's final size. |
| P6 | No `backdrop-filter` inside any scrolling list. | `grep` for `blur(` outside nav/overlay/sheet → 0 hits. |
| P7 | Animated properties. | `transform`, `opacity`, `color`, `background-color`, `border-color`, `box-shadow` **only**. No `width`/`height`/`top`/`left`/`margin`/`padding`/`font-size`/`filter`/`all`. |
| P8 | Scroll listeners. | **Zero.** `IntersectionObserver` sentinels for the nav, the mobile buy bar and the single reveal. |
| P9 | Autoplay / video. | **None.** |
| P10 | Fonts. | Three families, six files, ~96 KB woff2 latin, `<link>` in `index.html`, **never `@import`**. |
| P11 | Dead weight removed. | `npm uninstall antd react-slick slick-carousel`; PNGs and the 35 placeholder JPEGs out of the deploy. |

---

# 9. Implementation order — so no page is ever half-migrated

Each step is a commit that leaves the site working.

1. **The pipeline first.** `scripts/derive-images.mjs`, `<ProductImage>`, the CI budget check.
   Nothing visual merges before this: §2.12, and P4 gates the hero.
2. **Tokens.** Rewrite `index.css` (§3) with `--lf-surface` kept as an alias of `--lf-paper` and
   `.lf-ink-section` kept as an alias of `.lf-hearth-section`. Rewrite `theme.js`: breakpoints,
   type scale, `var(--lf-e1..4)` everywhere, `shadows[1..4]` mapped, `theme.transitions` deleted,
   `E1`–`E4` consts deleted, hardcoded 380/260 replaced, radii swept, `MuiContainer` reading
   `--lf-gutter`, `defaultProps.position` removed. **In the same commit:** the raw-hex and font sweep
   (`grep -rn "primary\.main\|#C9A96E\|#FDFBF9\|#FFFFFF\|Cormorant\|Oswald\|Playfair"`).
3. **Shared primitives, before any page touches them.** `utils/stock.js`, `<PriceBlock>`,
   `<StockLabel>`, `<Alcove>`, `.lf-ledge`, `<AddToBag>`, `<NotifyMe>`, `ToastProvider`.
   `productGrid.js` is created and `PRODUCT_GRID_SX` is re-exported from `RelatedProducts.jsx` so
   `ProductListing.jsx:74` and `Wishlist.jsx:36` keep compiling.
4. **`<ProductCard>`** rebuilt on those primitives (§6.2). Point the three `mockApi` importers at
   `services/api`. Finish the two remaining legacy `<Grid item>` migrations.
5. **PLP.** Swap to `productGrid.js`, delete the rail, build the toolbar + `Refine` popover reusing
   `ProductFilter`, repair `buildPriceBands`, drop the Sub-category facet UI, fix Sort's double label
   and `renderValue`, drop the `h1` to `h3`, delete pagination. **Verify LF-08's URL round-trip
   through refresh and browser Back before merging** — a popover that loses `Clear all` or breaks
   Back is worse than the rail it replaces.
6. **PDP.** 7/5 columns, `<Alcove>` stage, thumbnail rail beneath on the 160px derivative, buy box
   order, The Ritual, The rest of the shelf, JSON-LD without `aggregateRating`, mobile accordion.
   Delete `RelatedProducts`.
7. **Nav + Layout + search overlay.** Sticky nav, tagline deleted, `data-scrolled` sentinel, the
   `{!isHome && <Toolbar/>}` deletion, `chrome="minimal"`, search `in_stock` dropped and the idle
   shelf.
8. **Home.** Hero (§5.1①), hearth moved to ②, the shelf ③ + `<ShelfBundle>`, claims ④.
   **Delete `Marquee`, `ProductCategories`, `ShopByConcern`, `CircularProductSlider`,
   `FeaturedProducts`, `NewsletterSignup`, `Benefits`** and remove `CustomerTestimonials` from the
   render list — all in this one commit, so the page is never half-migrated.
9. **Commerce tail.** Footer on `.lf-hearth-section` with the product row, `brandFill` Join and the
   State Emblem removed; the fraud notice moved to `/contact` + `/faq`; Cart; Checkout (`order`,
   duplicate totals deleted, sticky pay bar, `viewport-fit=cover`); **the COD arm** (§5.6).
10. **The sweep that closes the system.** Apply the two page archetypes to all nine pages, delete
    `Wishlist`'s `minHeight`, pass `children` into all six `EmptyState` call sites, About's H1 and
    shelf, drop the `--lf-surface` and `.lf-ink-section` aliases, delete `overline`,
    `--lf-surface-raised`, `--lf-rule-gold`, `--lf-e-edge`, `--lf-20/24/30/40`. Delete the PNGs and
    the 35 placeholder JPEGs from the deploy. Run the §8 checklists.

---

# 10. DO NOT DO THIS

1. **Do not mask a photograph into the arch, and do not crop it.** The arch is the *niche*; the
   photograph is a 1:1 image standing inside it. Nineteen masters measured: no alpha, only 3 of 19
   centred, sixteen running to 96–99% of frame width. A mask cuts product.
2. **Do not paint the hearth light over the photograph.** The grounds include cyan `#9DE1E7`, deep
   blue `#134F85` and pink `#F6A5C8`; a warm wash over them produces mud. **The light falls on the
   wall.**
3. **Do not use `object-fit: contain` on a product photograph.** The masters are RGB with no alpha
   and six different grounds — `contain` paints a coloured rectangle inside a warm frame. This is the
   defect visible in `plp-desk.png` today, and it is what §6.3's PDP rule and two of the three
   proposals would have preserved.
4. **Do not change `--lf-arch-ratio` or the 26% vertical radius.** Past ~30% the shallow dome becomes
   a pointed niche with memorial or religious connotations. It is a locked token, never a
   per-component value.
5. **Do not reintroduce `repeat(auto-fill, …)` on the catalogue grid**, and do not define the grid
   anywhere but `productGrid.js`. One number in a related-products rail caused four of this site's
   most visible defects.
6. **Do not reintroduce a display serif for headings.** Fraunces has exactly **three** licensed uses
   at a 20px/600 floor: nav wordmark, one home interstitial headline, footer wordmark. A fourth is a
   regression against an explicit owner decision (§9.1 upheld).
7. **Do not set `color: var(--lf-gold)` on text** (1.96:1). `--lf-gold-ink` for type, `--lf-gold-edge`
   for indicators. The one exception is inside `.lf-hearth-section`, where it is redefined to 8.11:1.
8. **Do not add a third gold fill.** Exactly two: `Notify me` and the newsletter `Join`. The primary
   buy action is ink, always.
9. **Do not render a star row, a `0.0`, a `(0)` review count, or `aggregateRating` in JSON-LD.**
   Zero `Review` rows exist. Production once shipped hand-typed 4.50/40-reviews with no review rows;
   inventing social proof is the worst thing available here.
10. **Do not render a withdrawn claim.** *India's First, Clinically Tested, 100% natural, fully
    recyclable, chemical-free, dermatologically certified* must not appear anywhere in
    `frontend/src`. `claims.js` is the only source.
11. **Do not invent a phone number.** `brand.support.phone` is `null` → no row renders.
12. **Do not use `disabled` on a commerce button**, and **do not let `Notify me` vanish, grey out or
    lose its adjacent reason**. `aria-disabled` + a visible reason.
13. **Do not grey, dim, desaturate or ribbon an out-of-stock product.** The niche goes unlit; the
    photograph is untouched.
14. **Do not hide anything behind `:hover`** — not the CTA, not the wishlist heart, not the active-nav
    indicator, not a second image, not a carousel pause.
15. **Do not put `backdrop-filter` on anything inside a scrolling list**, and do not nest anything
    `position: fixed` inside the blurred nav.
16. **Do not animate `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`,
    `backdrop-filter`, `filter` or `all`.** Accordions use `grid-template-rows: 0fr → 1fr`.
17. **Do not add a scroll listener.** `IntersectionObserver` sentinels, writing to ref'd DOM
    attributes, never React state.
18. **Do not change `spacing` from 8** (it silently halves ~40 call sites) and **do not turn
    `cssVariables` on** (`index.css` is the one var layer).
19. **Do not leave `<Grid item>` in place** — MUI 7.3.5 ignores the legacy props, so those files
    render unstyled. `size={{ xs: 12, md: 8 }}`.
20. **Do not write a raw hex, a raw radius, a raw duration or a raw font family in a component.**
    If the system lacks something, add a token or a `variants` entry.
21. **Do not type a product name, price, size or stock state into a component.** All of it renders
    from the API payload — the brief that produced this document miscalled a moisturiser a sunscreen.
22. **Do not ship a facet whose render condition can be false for the entire catalogue.** `Price` has
    never rendered once in production and nobody noticed.
23. **Do not add a second card language, a second shadow ramp, a second motion ramp, a second
    newsletter or a second toast.** Each one is how the current build got here.
24. **Do not merge the hero without the image pipeline and a measured LCP.** A 6 MB PNG in the first
    viewport on Indian 4G is strictly worse than the text-only hero it replaces, and it would
    retroactively vindicate the `Hero.jsx:15` comment this document deletes.
25. **Do not re-render the State Emblem of India.** Its commercial use is restricted under Indian law
    and this repository holds no authorisation.

---

## Appendix — the risks this direction accepts, and the measurement that governs them

| Risk | Mitigation already built in | The gate |
|---|---|---|
| **Six full-width cards at 390px is ~3,520px of scroll** (§4.3). | The hero transacts above the fold; the PLP header states the catalogue size; the niche is capped at 340px at 1-up. | Measure scroll-depth-to-first-add. If it regresses, the fallback is a 128px-niche horizontal row card at 1-up — **same card component, same arch**, half the height. Do not introduce a second card language to fix it. |
| **Gold on `Notify me` could read as a promotion.** | The `BACK SOON` status ledge sits **above** the name, so the words land before the eye reaches the button; the label is `Notify me`; ink at 15.97:1 still outranks gold at 1.96:1. | A/B the ledge wording, not the colour. |
| **Canvas at spread 18 (`#F6EFE4`) is a visible cream** and can tip yellow on an uncalibrated warm Android panel. | Every ink and semantic ratio was recomputed against it; worst case is `--lf-ink-3` at 4.55:1 on `--lf-mat-deep`, which is why mat-deep is non-text/large-text only. | If device testing reads too yellow, `#F8F2E8` (spread 14) is a **one-token retreat** that keeps every ratio above AA. |
| **Warming the canvas off `#FDFBF9` breaks colour-matching** with existing email templates, PDFs and ad creative. | Ink ratios are unaffected (15.97:1 / 17.81:1), so nothing fails AA. | Someone owns re-exporting the extended assets. Name them before step 2. |
| **Eight components and the desktop rail are deleted.** Large diff across LF-01..LF-31 surfaces. | §1.3 names where every behaviour lands; `sub_category` and `price` URL params stay supported; the mobile sheet is untouched; `Notify me` gains prominence. | Check each deletion against `IMPLEMENTATION_SPEC.md` **before** removing it, and land them in §9's order. |
| **The `Refine` popover is the largest engineering item here.** | It reuses the existing `ProductFilter` and the existing mobile sheet rather than rewriting them. | If it slips, the fallback is a rail collapsed to the three non-zero facets plus the in-stock toggle — **never** 21 rows, eight of them inert `(0)`. |
| **The hero is a packshot doing an editorial plate's job.** | UV Armor is a genuine studio frame on a warm ground with a soft upper-left key, and the niche is designed around a 1:1 image, so nothing is cropped. | `TODO(business) 4`. Until it lands the hero is a very good packshot in a lit niche — acceptable, and clearly better than 406px of centred type. |
