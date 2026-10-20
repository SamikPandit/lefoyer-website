# SHARED BRIEF — Le foyeR. storefront change-set (waves 2 & 3)

You are one of ten agents implementing a 31-requirement change-set in parallel.
Read this file, then your work package in `docs/IMPLEMENTATION_SPEC.md` §3.

## Repo

`/home/samikpandit/Downloads/LeFoyer/lefoyer-website` — git repo, branch `main`.
- `frontend/` React 18 + Vite 5 + **MUI v7.3.5** + react-router-dom v6 + axios + react-slick + react-helmet-async@2.0.5.
- `backend/` Django 4.2.7 + DRF + SimpleJWT + django-filter + drf-nested-routers + Celery + jazzmin.

## The documents (all in `docs/`, inside the repo — durable)

| File | What it is |
|---|---|
| `docs/IMPLEMENTATION_SPEC.md` | **The contract.** §1 verified corrections to the codebase (read the ones touching your files — they have exact line numbers and quoted code). §2 shared contracts. §3 the 12 work packages. §4 content safe-defaults. §5 verification. |
| `docs/DESIGN_SYSTEM.md` | Design system "Counter". §3 fonts, §4 literal `index.css`, §5 literal `theme.js`, §6 micro-details, §7 component contracts, §8 page layouts, §9 a DO-NOT list. **Already implemented** — read it to match the system, do not re-apply it. |

## WAVE 1 IS ALREADY DONE — build on it, do not redo it

Landed and verified (`manage.py check` clean, `makemigrations --check` clean, fresh `migrate` succeeds):

- **`backend/lefoyer/settings.py` and `backend/lefoyer/urls.py` are FINISHED and owned by nobody now.**
  `newsletter` and `content` are already in `INSTALLED_APPS`; `api/newsletter/` and `api/content/` are
  already mounted; `SearchFilter`+`OrderingFilter` are already in `DEFAULT_FILTER_BACKENDS`; the
  `SIMPLE_JWT` block exists; the throttle scopes `catalogue` (300/min), `resend_verification`,
  `newsletter`, `coupon_validate`, `notify_me`, `support`, `register`, `password_reset` all exist;
  `CELERY_TASK_ALWAYS_EAGER=DEBUG` and a console email backend are active under `DEBUG`.
  **Do NOT edit either file.** If you need a setting or a URL mount, report it as a
  `cross_package_request` — do not add it yourself.
- **New apps `backend/content/` and `backend/newsletter/` are complete** with `0001_initial`, admin, and
  a data migration seeding the §4 safe defaults (19 `Claim` rows, the policy numbers, brand copy with
  no phone number, the approved hero copy as an inactive `HomeSection`).
- **`frontend/src/services/api.js` is COMPLETE** — the full §2a surface, 60 exports. Import from it by
  these exact names. It already does: list normalisation to `{items,count,next,previous}`,
  `paramsSerializer:{indexes:null}` for repeated array keys, a one-shot token-refresh 401 interceptor
  that queues concurrent 401s and dispatches `AUTH_EXPIRED_EVENT` instead of touching
  `window.location`, and `error.isThrottled` / `error.isNetwork` flags. Also exports helpers
  `getApiErrorMessage(err)`, `effectivePrice(product)`, `CURRENCY`, `AUTH_EXPIRED_EVENT`.
  **Verify the exact signature by reading the file before calling anything.**
- **`frontend/src/services/analytics.js` is COMPLETE** — the §2g plan, incl. `usePageViewTracking()`.
  Fire events only through this module. It no-ops when `window.fbq` is absent.
- **`theme.js` (788 lines) and `index.css` (422 lines) are COMPLETE** — design system "Counter".
  Inter for all commerce text, **Inter Tight** for display, **Fraunces** rationed to 3 brand moments at
  a 20px floor. `Cormorant Garamond` is GONE. Use theme tokens and `sx`; do not hardcode hex values,
  and do not reintroduce a display serif for headings.
- **`App.jsx` is COMPLETE** — now **`BrowserRouter`** (no more `#` URLs), `HelmetProvider`, an
  ErrorBoundary, `usePageViewTracking()`, `LegacyHashRedirect`, and the routes `/search`,
  `/order-confirmation/:id`, `/orders`, `/forgot-password`, `/reset-password/:uid/:token`, `/contact`
  already declared. **Your page must exist at the path App.jsx already references.** Do not edit App.jsx.
- **Contexts are COMPLETE**: `AuthContext` (exposes `user`, `isAuthenticated`, `isEmailVerified`,
  `loading`, `login`, `logout`), `CartContext` (exposes `{cart, loading, initialised, error,
  pendingItemIds, addToCart, removeFromCart, updateQuantity, clearCart, refresh}` and **every mutation
  returns the parsed backend message, not a boolean**), `WishlistContext`. Read each file for the exact
  shape before consuming it.
- **12 shared components are COMPLETE and you must compose from them rather than rolling your own:**
  `components/common/SeoHead.jsx`, `JsonLd.jsx`, `NewsletterForm.jsx` (variant `inline`|`hero`),
  `PincodeCheck.jsx`, `ErrorState.jsx`, `EmptyState.jsx`, `ProductCardSkeleton.jsx`,
  `NotifyMeDialog.jsx`, `SupportLink.jsx`, plus `content/brand.js`, `content/policy.js`,
  `content/claims.js`. **Read each one's props before using it.**
- **`frontend/src/content/{brand,policy,claims}.js` are the ONLY source for marketing and policy
  strings.** Never hardcode a claim, a delivery promise, a return window or a tagline in a component.
  `claims.js` marks each claim `substantiated: true|false` — render only substantiated ones.
- **Deleted already** (do not import): `components/common/Header.jsx`, `common/Button.jsx`,
  `common/Card.jsx`, `layout/Sidebar.jsx`, `product/ProductGrid.jsx`, `cart/CartItem.jsx`,
  `cart/CartSummary.jsx`.
- **Still present on purpose**: `frontend/src/services/mockApi.js` and `frontend/src/data/mockData.js`.
  Three components still import them and WP-10 repoints those. **The lead deletes both files at the end
  of wave 3.** If you own one of those three components, removing its mock import is part of your job.

## Hard rules

1. **Own only your files.** Your package lists them. Nine other agents are editing other files right
   now. Editing a file you do not own will be discarded and will break their work. Need a change
   elsewhere? Put it in `cross_package_requests`.
2. **The §2 contracts are binding.** Do not invent endpoint paths, response shapes, field names or
   state names. Backend and frontend agents are building to the same §2 table right now without
   talking to each other — that only works if you both follow it exactly.
3. **Do not run:** `npm run build`, `npm run lint`, `npm install`, `manage.py migrate`, or any `git`
   command. The lead runs them centrally.
4. **Do run:**
   - Backend: `SCRATCH/dj check` and `SCRATCH/dj makemigrations <your_app>` — writes only your app's
     migrations dir. `SCRATCH` = `/tmp/claude-1000/-home-samikpandit-Downloads-LeFoyer/e79ca2a3-4ca5-4179-bedf-d8afdf081a08/scratchpad`.
     You may also use `SCRATCH/dj shell -c "..."` to exercise endpoints with Django's test client.
   - Frontend: `cd frontend && npx vite build --outDir SCRATCH/viteout-<YOUR_WP_ID>` — your own private
     output dir, never the shared `dist/`.
   - If `SCRATCH/dj` is missing, the scratchpad was cleared: say so in your report and fall back to
     `python3 -m py_compile` on the files you changed. Do not try to rebuild the venv.
5. **Finish the whole package.** `TODO: implement`, placeholder components and commented-out blocks are
   failures. If something genuinely cannot be done, say so with the reason.
6. **No invented facts.** No fake reviews, ratings, testimonials, phone numbers, certifications or
   prices. Where the business must decide (§4), ship the stated safe default and mark it
   `TODO(business): <the exact question>`.
7. **MUI v7:** `<Grid item xs={6}>` does nothing in v7 — it is ex-Grid2. Use `<Grid size={{xs:12,md:6}}>`.
   Migrate every `<Grid item` in the files you own. Do not use `GridLegacy`.

## Environment facts — established, do not re-derive

- **Production nginx already serves `try_files $uri $uri/ /index.html`** (verified over SSH). The
  BrowserRouter switch needs no infra change. Deploy paths: `/var/www/lefoyer/frontend/dist` and
  `/var/www/lefoyer/backend` (gunicorn over a unix socket).
- **`phonepe-sdk` is NOT on public PyPI** — `pip install phonepe-sdk` fails. It cannot be installed or
  introspected here. The venv has a hand-written **stub** exposing only
  `StandardCheckoutClient(client_id, client_secret, client_version, env)`, `.pay(request)`,
  `.get_order_status(merchant_order_id, details=False)` and `StandardCheckoutPayRequest.build_request`.
  **The stub is a local type-check convenience, NOT evidence of the real API.** So: resolve the gateway
  method **by name at runtime** (try an ordered list of candidate names via `getattr`, raise a clear
  `PhonePeAPIError` if none match), log which resolved, and comment that the real name must be
  confirmed on staging. **Do not hardcode one guessed name. Do not claim the integration is verified.**
- **Local catalogue** (`SCRATCH/dj seed_products`): 10 products; categories `skincare`, `haircare`,
  `body-lip-care`; sub-categories `cleansers`, `brightening-anti-pigmentation`,
  `moisturizers-hydrators`, `sun-protection`, `shampoo-conditioner`, `serums-treatments`, `body-care`,
  `lip-care`. **All 10 products have `rating=0.00`, `reviews_count=0`, and the `Review` table is
  empty.** Every star rating on the live site today is fabricated by `mockApi`. The honest consequence:
  with no reviews the UI shows **no rating at all**, never a zero and never empty stars.
- `suitable_for` holds exactly six free-text strings (§1 C-11). Splitting on `,` yields garbage —
  map by exact string.
- **35 of the 40 `frontend/public/images/products/product-N*.jpg` are byte-identical placeholders.**
  Real photography exists only as `Spotless_1-10.png` / `WhiteWave_1-9.png`, at 1.18–6.10 MB each.
  Do not design for per-product art that does not exist, and do not put a 6 MB image in a card.
- Next migration numbers: `products` 0006, `reviews` 0002, `orders` 0005, `accounts` 0003,
  `coupons` 0003, `cart` 0003. `makemigrations --check` is clean right now.

## Definition of done

- Every file you own is complete and self-consistent.
- Your package's **Acceptance** list in §3 is satisfied, or each unmet item is named with why.
- Backend: `dj check` clean; `makemigrations <app>` yields exactly the migrations §2c specifies.
- Frontend: your private `npx vite build --outDir …` resolves every import in files you own.
- **You report honestly.** A report claiming green for a command you never ran is the worst possible
  outcome — the lead is merging ten packages on the strength of these reports.
