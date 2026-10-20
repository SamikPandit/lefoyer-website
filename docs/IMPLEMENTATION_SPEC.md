# LE FOYER — IMPLEMENTATION SPEC

Repo: `/home/samikpandit/Downloads/LeFoyer/lefoyer-website` · branch `main` · remote `git@github.com:SamikPandit/lefoyer-website.git`
All paths below are repo-relative. Every claim in §1 was re-verified by reading the file.

---

## 1. Contradictions and corrections

**C-1 — LF-16: the ESTABLISHED list is wrong about order-time coupon enforcement. CORRECTED.**
ESTABLISHED says coupon validation "never calls `coupon.is_valid()`, never checks `max_uses` or `min_order_amount`". Verified `backend/orders/views.py:107-128`: order creation **does** call `coupon.is_valid()` (line 111, which covers `active`, the date window **and** `max_uses`) and **does** check `min_order_amount` (line 117). Only `backend/coupons/views.py:17` is unguarded. **Resolution:** this is a split-brain, not a missing check. `/api/coupons/validate/` is permissive and total-blind; `POST /api/orders/` is strict. Fix = extract one shared evaluator (`coupons/services.py::evaluate_coupon`) called by both. Note also `orders/views.py:109` looks up `Coupon.objects.get(code__iexact=...)` with no active/date filter — harmless only because `is_valid()` follows it; keep that ordering in the extracted helper.

**C-2 — LF-17: the Meta Pixel does NOT double-count PageView. ESTABLISHED is wrong; recon agents 1 and 4 are right.**
Verified `frontend/index.html:12-23` defines `window.fbq` synchronously in `<head>` and fires `init`+`PageView`. Verified `frontend/src/App.jsx:29-31`: the effect's first statement is `if (window.fbq) return;`, so on every cold load the App block (including its `init`/`PageView` at lines 52-53) is unreachable **dead code**. **Resolution:** the real LF-17 defects are (a) zero PageViews on SPA route change, (b) zero `Purchase` anywhere — `grep -rn "Purchase\|InitiateCheckout\|AddToCart\|gtag\|dataLayer" frontend/` returns nothing. Delete the App.jsx block, keep the single inline init, add router-driven PageView.

**C-3 — MUI v7 Grid. CONFIRMED, with exact scope.**
Verified `node_modules/@mui/material/package.json` = `7.3.5`. Verified **40** occurrences of `<Grid item`/`<Grid xs` across **15** files: `pages/OrderDetail.jsx`, `pages/Profile.jsx`, `pages/Wishlist.jsx`, `pages/Checkout.jsx`, `pages/About.jsx`, `pages/SignUp.jsx`, `pages/Cart.jsx`, `components/cart/CartItem.jsx`, `components/common/Footer.jsx`, `components/home/NewYearBanner.jsx`, `components/home/ProductCategories.jsx`, `components/home/FeaturedProducts.jsx`, `components/home/InstagramFeed.jsx`, `components/order/OrderCard.jsx`, `components/product/RelatedProducts.jsx`. In v7 `Grid` is ex-Grid2: `item`/`xs`/`md` are not props, so no column widths apply. **Resolution:** migrate to `<Grid size={{ xs, md }}>`. Do not use `GridLegacy`. This is a precondition for every visual task; each package migrates the Grid usages in the files it owns (no file is shared, so there is no conflict).

**C-4 — PhonePe V1/V2 split. CONFIRMED and it is fatal in production.**
Verified `backend/orders/payment.py:6-8` imports the **V2** OAuth surface (`phonepe.sdk.pg.payments.v2.standard_checkout_client.StandardCheckoutClient`) and pays with it, while `verify_callback` (line 67) computes the **V1** `sha256(payload + client_secret) + "###" + version` X-VERIFY, and `PaymentCallbackView` (`orders/views.py:305`) requires a V1 `{'response': <base64>}` envelope — else it returns `{'status':'ok'}` and writes nothing. Verified `requirements.txt:221` pins the SDK as the bare, unversioned line `phonepe-sdk`, there is no lockfile, and `import phonepe` → `ModuleNotFoundError` in this environment. **Resolution:** the mismatch is real and every prepaid order would sit at `PENDING` forever. The exact V2 status-query and callback-validator method names **cannot be determined from this repo and must not be guessed**. WP-05 step 1 is: `pip install phonepe-sdk`, pin the resolved version in `requirements.txt`, then `python -c "import inspect, phonepe.sdk.pg.payments.v2.standard_checkout_client as m; print([x for x in dir(m.StandardCheckoutClient) if not x.startswith('_')])"` and record the real names in a comment above `PhonePeGateway.get_order_status`.

**C-5 — `products/featured/` vs `?is_featured=true`. CONFIRMED.**
Verified `products/filters.py:8-10` `Meta.fields = ['category','sub_category','suitable_for']` — no `is_featured`. Verified `components/home/FeaturedProducts.jsx:14` sends `{is_featured:true}` to `products/products/`; django-filter drops unknown params silently. Verified `products/views.py:32,38`: `featured`/`bestsellers` have no stock predicate, no `order_by`, no pagination — and `getFeaturedProducts` in api.js:35 has zero callers. The "Curated Essentials" rail is page 1 of the unordered catalogue, sliced client-side.

**C-6 — `related` is slug-routed and called with an id. CONFIRMED, plus one addition.**
Verified `products/views.py:24` `lookup_field='slug'`, `:43` `def related(self, request, slug=None)`, vs `api.js:38` `products/products/${productId}/related/`. Addition: `:49` `except Product.DoesNotExist` cannot catch the `Http404` that `get_object()` raises, so the intended `{'error':'Product not found'}` is unreachable.

**C-7 — Nested review URL. CONFIRMED.** Real path is `/api/products/products/<slug>/reviews/` (`lefoyer/urls.py:28` mounts `products.urls` under `api/products/`; `products/urls.py:7,11` adds a second `products` prefix). `api.js:52` calls one segment short → 404. Same class: `api.js:35` `products/featured/` should be `products/products/featured/`.

**C-8 — Wishlist routes: precise failure modes.** Verified `wishlist/urls.py:6` registers at `r''`. `WishlistViewSet` is a plain `ViewSet` with `list`/`create`/`destroy`, so the router exposes `GET|POST /api/wishlist/` and `DELETE /api/wishlist/<pk>/`. `api.js:57` `POST wishlist/add/` matches the **detail** route with `pk='add'`, which has no `post` mapping → **405**, not 404. `api.js:58` `DELETE wishlist/<id>/remove/` matches nothing → **404**. Also `wishlist/views.py:30` `Wishlist.objects.get(user=...)` is unguarded → 500 for a user with no row, and `wishlist/serializers.py:6` `fields='__all__'` on an M2M returns `products` as bare integer PKs.

**C-9 — `Product.rating` / `reviews_count` have NO writer at all. ESTABLISHED softened; recon agent 6 is right.**
Verified: `grep -rn "reviews_count\|\.rating" --include=*.py backend | grep -v migrations` returns **exactly one line** — `products/models.py:37`, the field declaration. There is no `save()` override, no signal, no management command, no task. They are not "hand-maintained and drifting"; they are **permanently 0.00 / 0** unless a human types into the Django admin change form (`ProductAdmin` declares no `fields`/`fieldsets`/`exclude`, so both columns are editable there).

**C-10 — seed vs fixture: recon agent 6 is PARTIALLY wrong. CORRECTED.**
Verified by loading `backend/latest_products.json` and reading `seed_products.py`:
- **Prices differ on 2 SKUs only**: `LF-SK-CL01` 349.00 (seed) vs 280.00 (fixture); `LF-SK-CL02` 399.00 vs 280.00. The other 8 match.
- **`is_featured` differs**: seed marks 6 featured (`CL01, CL02, SK-SE01, SK-MO01, HA-SC01, HA-SE01`); the fixture marks **only `CL01` and `CL02`** featured. The recon claim that "the fixture marks all four False" is wrong in implying the fixture has no featured products — pk 11 and 12 are `is_featured: true`.
- **`show_at_website: false` on 8 of 10. CONFIRMED.** Only `LF-SK-CL01` (Spotless Face Wash) and `LF-SK-CL02` (WhiteWave Face Wash) are visible in the fixture.
**Resolution:** neither file is authoritative; the live DB is, and it is not available locally (§5). Treat the fixture as the better proxy for production. **Operative consequence for LF-24: build category/concern navigation from the live, annotated taxonomy endpoint with `product_count > 0` as a hard render condition.** Do not hardcode tiles. If production really has 2 visible SKUs, the grid will correctly collapse to one category instead of shipping broken links.

**C-11 — `suitable_for` values. CONFIRMED exactly.** Six distinct strings, verified: `Oily & Acne-Prone Skin`, `All Skin Types, including Sensitive`, `All Skin Types`, `All Skin Types, including Sensitive & Acne-Prone`, `All Hair Types, including Damaged & Color-Treated`, `All Hair Types`. Commas occur only inside the phrase `All Skin Types, including X`, so splitting on `,` yields garbage like `" including Sensitive & Acne-Prone"`. `ProductFilter` exposes it as an **exact** match, so a "Sensitive" facet can never hit. Nine of ten rows begin "All Skin/Hair Types" — itself an LF-05 claim.

**C-12 — Hero CTA. CONFIRMED.** `components/home/Hero.jsx:49-72`: the entire `<Button component={Link} to="/products">Discover More</Button>` is inside a `/* */` comment; `Button` and `Link` are imported (line 2-3) and unused. There is nothing clickable above the fold at any breakpoint.

**C-13 — Home layout and omissions. CONFIRMED.** `pages/Home.jsx:15` `// Force rebuild`; renders `Marquee, Hero, CircularProductSlider, Benefits, FeaturedProducts, NewYearBanner, CustomerTestimonials, NewsletterSignup`; imports `ProductCategories` (line 6) and `ShopByConcern` (line 7) and renders neither. `components/layout/Layout.jsx:15` `{!isHome && <Toolbar />}` → on `/` the Marquee sits under the fixed AppBar.

**C-14 — Navbar search is a dead button. CONFIRMED.** Bare `<IconButton sx={{ color: 'inherit' }}><SearchIcon /></IconButton>` with no `onClick`, `href` or `component`, directly adjacent to two correctly-wired `component={Link}` icons.

**C-15 — Footer SUPPORT column. CONFIRMED.** Array is `['Shipping & Returns','Privacy Policy','Terms of Service']`; the `item === 'FAQ' ? '#/faq'` branch is unreachable and the chain ends `: '#'`. Every link is MUI `Link href="#/..."` — not a RouterLink — so all of them die the moment `HashRouter` is replaced.

**C-16 — ProductFilter renders one control. CONFIRMED.** `components/product/ProductFilter.jsx`: lines 45-48 are blank, the only JSX is a "Sort By" `<Select>`, `handleCategoryChange`/`handleSubCategoryChange` are dead, and line 3 imports `getCategories`/`getSubCategories` from **mockApi**. Live mockApi importers are exactly three files: `ProductFilter.jsx:3`, `ProductReviews.jsx:3`, `RelatedProducts.jsx:4`.

**C-17 — Sort is a no-op on the server. CONFIRMED.** `settings.py:188` `DEFAULT_FILTER_BACKENDS` = `DjangoFilterBackend` only; `ProductViewSet` sets no `filter_backends`/`ordering_fields`/`search_fields`. `?ordering=` and `?search=` are silently discarded. `Product` has no `Meta.ordering`, so the globally paginated list is paginated over an **unordered** queryset.

**C-18 — Taxonomy endpoints ARE paginated.** `CategoryViewSet`/`SubCategoryViewSet` are `ModelViewSet`s, so global `PageNumberPagination` (`PAGE_SIZE: 10`) applies: `/api/products/categories/` returns `{count,…,results}`. `ProductFilter.jsx:13` and `ProductListing.jsx` both read `.data.results`, which happens to work today only because there are 3 categories and 8 sub-categories. **Resolution:** make `api.js` normalise every list response (`res.data.results ?? res.data`) so no consumer ever handles the envelope again — §2a.

**C-19 — Order has no `status` field. CONFIRMED.** `orders/models.py` has `paid`, `payment_status`, `payment_method` and no `status`. `OrderDetail.jsx` and `OrderTimeline.jsx` both read `order.status` → always falls back to `'Pending'`.

**C-20 — Money model. CONFIRMED.** `Coupon.discount` and `Order.discount` are both `IntegerField(0..100)` — percentage only. `orders/views.py:131-132` computes `discount_amount = total*discount/100` and stores `total=final_total` (already net) while `discount` keeps the percent. `orders/models.py:41-43 get_total_cost()` subtracts the percent a **second** time; it has zero callers.

**C-21 — `payment_status` has no CANCELLED. CONFIRMED.** Choices are `PENDING/COMPLETED/FAILED` only. The callback handles only `PAYMENT_SUCCESS` and `PAYMENT_ERROR` — a cancelled or timed-out payment is never even marked FAILED and stock is never restored.

**C-22 — Checkout destroys the cart twice before payment. CONFIRMED.** Server: `orders/views.py:168-180` decrements stock **and** `cart.items.all().delete()` inside the creation transaction, then `:191` queues the "Order Confirmed!" email — all before PhonePe is contacted. Client: `Checkout.jsx` `await clearCart()` on both the prepaid and COD branches before `window.location.href = redirect_url`. Also confirmed: `Checkout.jsx:37-40` calls `navigate('/cart')` in the render body; no `submitting` state on Place Order; the `formData.paymentMethod === 'card'` arm is unreachable (the RadioGroup offers only `upi` and `cod`); backend normalises any non-`COD` string to `PREPAID`.

**C-23 — OrderConfirmation. CONFIRMED.** `setPaymentStatus(status || 'success')` defaults an unverified client-supplied value to success; the PhonePe branch trusts the `code` query param; and `api.get('/orders/')` + `orders.find(...)` throws `TypeError` because the list is paginated (`Profile.jsx:18` gets this right with `.results || response.data`).

**C-24 — `payment.py:42` redirect has no hash. CONFIRMED.** `redirect_url = f"{settings.SITE_URL}/order-confirmation"` while the app is a `HashRouter`, so the only valid URL is `/#/order-confirmation`. `accounts/email_service.py:80` remembers the `/#/`; payment.py forgot it. `PAYMENT_FLOW_GUIDE.md` is at the **repo root**, not `backend/`, and it enshrines the trust-the-`code`-param anti-pattern as the design.

**C-25 — Email verification: token generated twice. CONFIRMED.** `accounts/serializers.py:25-28` generates token A, saves it, then `.delay()`; `accounts/email_service.py:74-78 send_verification_email` generates token **B**, overwrites the row, and mails B. Works only when Celery is up. `send_mail` is wrapped in `try/except → return False` (line 111) and `tasks.py` discards the return value, so `max_retries=3` never fires and the API still returns 201 after a silent SMTP failure.

**C-26 — Verification token cannot expire and self-destructs. CONFIRMED.** `accounts/models.py:7` has no sent-at column; `email_service.py` line reading `This link will expire in 24 hours.` is therefore false. `secrets.token_urlsafe(48)` is exactly 64 chars against `max_length=64` — zero headroom. `accounts/views.py:85` nulls the token on success, which makes the friendly `Email is already verified.` branch at `:78-82` unreachable, so a second click (or a mail-scanner prefetch of the state-mutating GET) shows "Verification Failed" for a verified account.

**C-27 — `SIMPLE_JWT` is absent. CONFIRMED.** `grep -rn "SIMPLE_JWT" backend --include=*.py` → nothing. SimpleJWT's default `ACCESS_TOKEN_LIFETIME` of **5 minutes** applies. `AuthContext` stores `refreshToken` and nothing ever reads it; `/api/token/refresh/` is mounted and never called. `api.js:27`'s 401 handler then does `window.location.href = '/login'` — a non-hash path — so a user is silently teleported to the homepage every five minutes.

**C-28 — Login throws away the captured destination. CONFIRMED.** `ProtectedRoute.jsx:19` correctly does `<Navigate to="/login" state={{from: location}} replace />`; `Login.jsx:31` does `navigate('/')` and never imports `useLocation`. LF-13 is a two-line fix plus removing `Checkout.jsx`'s duplicate state-less guard.

**C-29 — No SEO mechanism exists at all. CONFIRMED.** `grep -rn "ld+json|schema.org|helmet|document.title" frontend/src frontend/index.html` → **zero matches**. No head manager is installed.

**C-30 — Two typefaces are referenced and never loaded. CONFIRMED.** `index.html:10` loads only Cormorant Garamond + Inter. `'Oswald'` is used in `Hero.jsx`, `FeaturedProducts.jsx`, `NewYearBanner.jsx`; `'Playfair Display'` in `Login.jsx`, `SignUp.jsx`, `VerifyEmail.jsx`, `Wishlist.jsx` (×2), `OrderConfirmation.jsx`, `CartSummary.jsx`, `InstagramFeed.jsx`. All fall back to system faces.

**C-31 — `shipping/signals.py`. CONFIRMED.** One `post_save` receiver on `Order`, no `dispatch_uid`, no `update_fields` check, condition exactly `payment_status == 'COMPLETED' and not hasattr(instance,'shipment')`. For COD this fires **inside** `OrderViewSet.create`'s `transaction.atomic()`, i.e. `.delay()` is dispatched pre-commit.

**C-32 — Cart stock checks ignore `manual_out_of_stock`. CONFIRMED.** `cart/views.py:33,62` compare against `product.stock_quantity` only; nothing consults `manual_out_of_stock` or `show_at_website`, so a manually-disabled or unpublished product can be added and ordered.

**C-33 — `DEBUG` defaults True → silent SQLite in production. CONFIRMED.** `settings.py:28` `DEBUG = os.getenv('DEBUG','True')…`; `:111` `if DATABASE_URL and not DEBUG:`. A prod box that omits `DEBUG` runs on `db.sqlite3` with the dev CORS list. `:64` the hardcoded jazzmin `custom_css` absolute path is confirmed.

---

## 2. The shared contracts

> **Ownership rule.** §2 is authored by WP-01 (backend) and WP-07 (frontend) **before any other package starts**. `backend/lefoyer/settings.py`, `backend/lefoyer/urls.py` and `frontend/src/services/api.js` have exactly one owner each. WP-01 pre-registers **every** new app in `INSTALLED_APPS` and **every** new URL mount up front, so no later package ever edits those three files. WP-07 writes the full api.js surface below up front, against endpoints that do not exist yet, so frontend packages are never blocked on backend packages.

### 2a. `frontend/src/services/api.js` — complete surface

Owner: **WP-07**. Rules binding on all consumers:

- **Normalisation.** Every `list*`/`get*s` helper returns `{ items, count, next, previous }` — `api.js` unwraps `res.data.results ?? res.data` internally (resolves C-18). Every single-object helper returns the object. **No component ever touches `.data.results` again.**
- **Params.** The axios instance sets `paramsSerializer: { indexes: null }` so `{category:['skincare','haircare']}` serialises as `category=skincare&category=haircare`, not `category[]=…` (resolves the array-filter bug).
- **401.** The interceptor attempts **one** `POST token/refresh/` with the stored `refreshToken`, queues concurrent 401s behind it, replays the original request on success, and only on refresh failure clears `authToken`+`refreshToken`+`user`+`cart` and dispatches a `window` event `lefoyer:auth-expired` that `AuthContext` listens for. It **never** touches `window.location`. A 401 from `POST token/` (a failed login) is passed straight through and never triggers logout.
- **429 / network.** The interceptor attaches `error.isThrottled` / `error.isNetwork` so UI can render "too many requests, retrying" rather than "no products found".

```js
// ---------- Catalogue ----------
listProducts(params)              GET    products/products/        -> {items,count,next,previous}
//   params: {search, category[], sub_category[], concern[], skin_type[], in_stock,
//            is_featured, is_bestseller, min_price, max_price, ordering, page, page_size}
getProduct(slug)                  GET    products/products/:slug/              -> Product
getRelatedProducts(slug)          GET    products/products/:slug/related/      -> {items}
getFeaturedProducts(params)       GET    products/products/featured/           -> {items}
//   params: {limit, include_out_of_stock, section}
getBestsellers(params)            GET    products/products/bestsellers/        -> {items}
listCategories()                  GET    products/categories/      -> {items}  // each: {id,name,slug,image,display_order,product_count}
listSubCategories(params)         GET    products/subcategories/   -> {items}  // params: {category}
listConcerns()                    GET    products/concerns/        -> {items}  // {id,name,slug,description,icon_key,display_order,product_count}
listSkinTypes()                   GET    products/skin-types/      -> {items}
notifyMe(slug, {email, consent})  POST   products/products/:slug/notify-me/    -> {status}

// ---------- Reviews  (REPLACES mockApi.getProductReviews / createProductReview) ----------
listProductReviews(slug, params)  GET    products/products/:slug/reviews/      -> {items,count,next,previous}
createProductReview(slug, body)   POST   products/products/:slug/reviews/      -> {review, review_summary}
//   body: {rating:1..5, title?, comment}   — product & user are set server-side
getReviewSummary(slug)            GET    products/products/:slug/review-summary/ -> ReviewSummary
listTopReviews(params)            GET    products/reviews/top/     -> {items}  // params: {limit, min_rating}

// ---------- Search ----------
// no separate endpoint: searchProducts(q, params) is listProducts({search:q, ...params})
searchProducts(q, params)         GET    products/products/?search=q           -> {items,count,…}

// ---------- Cart ----------
getCart()                         GET    cart/                     -> Cart
getCartSummary(params)            GET    cart/summary/             -> CartSummary   // params:{pincode?, coupon?}
addToCartApi(productId, qty)      POST   cart/add/                 -> Cart
updateCartItemApi(itemId, qty)    PATCH  cart/:itemId/update_item/ -> Cart
removeCartItemApi(itemId)         DELETE cart/:itemId/remove_item/ -> Cart
clearCartApi()                    DELETE cart/clear/               -> Cart
mergeCart(items)                  POST   cart/merge/               -> {cart, merged[], skipped[]}
restoreCartFromOrder(orderId)     POST   cart/restore-from-order/  -> {cart, restored[], skipped[]}

// ---------- Coupons ----------
validateCoupon({code, subtotal})  POST   coupons/validate/         -> CouponResult   // AllowAny

// ---------- Orders & payment ----------
createOrder(payload, idemKey)      POST   orders/                          -> OrderCreateResult
getOrder(id)                       GET    orders/:id/                      -> Order
listOrders(params)                 GET    orders/                          -> {items,count,…}
initiatePayment(id, {payment_method}) POST orders/:id/initiate-payment/    -> {redirect_url, merchant_order_id, attempt_id}
getPaymentStatus(id, ref)          GET    orders/:id/payment-status/        -> PaymentStatus
retryPayment(id, {payment_method}) POST   orders/:id/retry-payment/         -> {redirect_url,…} | {payment_status:'COMPLETED'}
cancelOrder(id, {reason})          POST   orders/:id/cancel/                -> {order_id, payment_status:'CANCELLED', …}
markPurchaseTracked(id, eventId)   POST   orders/:id/mark-purchase-tracked/ -> {purchase_tracked:true, tracked_at}

// ---------- Shipping ----------
checkServiceability(pincode)       GET    shipping/check-serviceability/?pincode= -> Serviceability

// ---------- Wishlist (paths CHANGED to match the router — see C-8) ----------
getWishlist()                      GET    wishlist/                 -> {id, products:[Product]}
addToWishlistApi(productId)        POST   wishlist/                 -> {id, products:[Product]}
removeFromWishlistApi(productId)   DELETE wishlist/:productId/      -> {id, products:[Product]}

// ---------- Auth ----------
loginUser({username,password})     POST   token/                    -> {access, refresh, user}
refreshToken(refresh)              POST   token/refresh/            -> {access, refresh?}
getMe()                            GET    auth/me/                  -> User
registerUser(body)                 POST   auth/register/             -> {id,email,verification_email_sent,detail}
verifyEmail(token)                 GET    auth/verify-email/:token/  -> {detail, code}
resendVerification(email)          POST   auth/resend-verification/  -> {detail, retry_after?}
requestPasswordReset(email)        POST   auth/password-reset/        -> {detail}
confirmPasswordReset(uid,tok,pw)   POST   auth/password-reset/confirm/:uid/:tok/ -> {detail}

// ---------- Content / newsletter / support ----------
subscribeNewsletter(body)          POST   newsletter/subscribe/      -> {status, detail}
//   body: {email, consent:true, source:'home'|'footer'|'cart'|'oos_notify', utm?}
getSiteSettings()                  GET    content/site-settings/     -> SiteSettings
getPolicy()                        GET    content/policy/            -> Policy
listHomeSections()                 GET    content/home-sections/     -> {items}
submitSupportRequest(body)         POST   content/support/contact/   -> {detail, ticket_ref}
```

**Deleted by WP-07:** `frontend/src/services/mockApi.js`, `frontend/src/data/mockData.js`. The three live importers (C-16) are repointed by their owning packages: `ProductFilter.jsx` → `listCategories`/`listSubCategories`/`listConcerns` (WP-10); `ProductReviews.jsx` → `listProductReviews`/`createProductReview`/`getReviewSummary` (WP-10); `RelatedProducts.jsx` → `getRelatedProducts(product.slug)` (WP-10). WP-07 adds an ESLint `no-restricted-imports` rule blocking `**/services/mockApi` and `**/data/mockData`, so `npm run lint` fails if anything re-imports them.

### 2b. Backend API changes

| # | Method | Path | Auth | Request | Response | Lives in | State |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/products/products/` | AllowAny | `search, category[]` (slug), `sub_category[]` (slug), `concern[]`, `skin_type[]`, `in_stock`, `is_featured`, `is_bestseller`, `min_price`, `max_price`, `ordering`, `page`, `page_size` | `{count,next,previous,results:[Product]}` | `products/filters.py`, `products/views.py` | **CHANGED** |
| 2 | GET | `/api/products/products/featured/` | AllowAny | `limit`, `include_out_of_stock=false`, `section` | `{count, results:[Product]}` ordered by `display_order`, sellable first | `products/views.py` | **CHANGED** (shape + ordering + stock) |
| 3 | GET | `/api/products/products/bestsellers/` | AllowAny | same | same | `products/views.py` | **CHANGED** |
| 4 | GET | `/api/products/products/<slug>/related/` | AllowAny | `limit=4` | `{count, results:[Product]}`; excludes OOS/unpublished, falls back sub-category → bestseller so it is never empty | `products/views.py` | **CHANGED** (was id-callable, bare list) |
| 5 | GET | `/api/products/products/<slug>/review-summary/` | AllowAny | — | `ReviewSummary` | `products/views.py` | **NEW** |
| 6 | POST | `/api/products/products/<slug>/notify-me/` | AllowAny, throttle `5/hour` | `{email, consent:true}` | `201 {status:'subscribed'}` / `200 {status:'already_subscribed'}` / `400` | `products/views.py`, `products/models.py` | **NEW** |
| 7 | GET | `/api/products/concerns/` | AllowAny | — | `[{id,name,slug,description,icon_key,display_order,product_count}]` | `products/views.py`, `products/urls.py` | **NEW** |
| 8 | GET | `/api/products/skin-types/` | AllowAny | — | same shape | `products/views.py` | **NEW** |
| 9 | GET | `/api/products/categories/` | AllowAny | — | `[{id,name,slug,image,display_order,product_count}]`, `product_count` counts only sellable+visible | `products/views.py` | **CHANGED** |
| 10 | GET | `/api/products/subcategories/` | AllowAny | `category` (id or slug, repeatable) | `[{id,name,slug,category:{id,name,slug},display_order,product_count}]` | `products/views.py`, `products/filters.py` | **CHANGED** |
| 11 | GET | `/api/products/products/<slug>/reviews/` | Read AllowAny / write IsAuthenticated | `ordering`, `page` | `{count,…,results:[Review]}` where `Review = {id,rating,title,comment,created_at,author:{display_name},is_verified_purchase}` — **never** a raw user id | `reviews/serializers.py`, `reviews/views.py` | **CHANGED** |
| 12 | POST | `/api/products/products/<slug>/reviews/` | IsAuthenticated | `{rating:1..5,title?,comment}` | `201 {review, review_summary}`; `400` field errors; `409` duplicate | `reviews/views.py` | **CHANGED** |
| 13 | GET | `/api/products/reviews/top/` | AllowAny | `limit`, `min_rating` | `[{…Review, product:{name,slug,image_main}}]`, approved + verified first | `reviews/views.py`, `products/urls.py` | **NEW** |
| 14 | POST | `/api/coupons/validate/` | **AllowAny**, throttle `20/hour` | `{code, subtotal}` | `200 {valid:true,code,discount_type,discount_value,discount_amount,subtotal,final_total,message}` / `400 {valid:false,reason:'NOT_FOUND'\|'EXPIRED'\|'INACTIVE'\|'EXHAUSTED'\|'MIN_ORDER_NOT_MET',message,min_order_amount?}` | `coupons/views.py`, `coupons/serializers.py`, **new** `coupons/services.py` | **CHANGED** |
| 15 | GET | `/api/cart/summary/` | IsAuthenticated | `pincode?`, `coupon?` | `CartSummary` (server-computed effective prices, subtotal, discount, shipping, total, per-line stock, free-ship progress, delivery+returns copy keys, cross-sell) | `cart/views.py`, `cart/serializers.py` | **NEW** |
| 16 | POST | `/api/cart/merge/` | IsAuthenticated | `{items:[{product_id,quantity}]}` | `{cart, merged[], skipped:[{product_id,name,reason,available}]}` | `cart/views.py` | **NEW** |
| 17 | POST | `/api/cart/restore-from-order/` | IsAuthenticated | `{order_id}` | `{cart, restored[], skipped[]}` | `cart/views.py` | **NEW** |
| 18 | POST | `/api/orders/` | IsAuthenticated | header `Idempotency-Key`; `{shipping_info{…}, payment_method:'PREPAID'\|'COD', coupon_code?}` | `201 OrderCreateResult` = `{id, order_number, payment_status, subtotal, discount_amount, discount_type, shipping_amount, total, currency:'INR', items[], cart_retained:bool, payment:{redirect_url, merchant_order_id, attempt_id}\|null}`; `400 {error:'OUT_OF_STOCK', items[]}`; `400 {error, field}` | `orders/views.py`, **new** `orders/services.py` | **CHANGED** |
| 19 | GET | `/api/orders/<id>/payment-status/` | IsAuthenticated (owner) | `?ref=` | `PaymentStatus` = `{order_id, order_number, payment_status, paid, payment_method, provider_reference, subtotal, discount_amount, shipping_amount, total, currency:'INR', items[], can_retry, purchase_event_pending, next_actions[], message, verified_at}`; `503 {error, payment_status:'PENDING', message}` on gateway unreachable — **never** reports COMPLETED on a failed lookup | `orders/views.py`, `orders/payment.py` | **NEW** |
| 20 | POST | `/api/orders/<id>/retry-payment/` | IsAuthenticated (owner) | `{payment_method}` | `200 {redirect_url, merchant_order_id, attempt_id}` \| `200 {payment_status:'COMPLETED'}` (COD); `409 {error:'OUT_OF_STOCK', items[]}`; `409 {error:'ALREADY_PAID'}`; `409 {error:'ALREADY_SHIPPED'}` | `orders/views.py` | **NEW** |
| 21 | POST | `/api/orders/<id>/cancel/` | IsAuthenticated (owner) | `{reason?}` | `{order_id, payment_status:'CANCELLED', stock_restored, coupon_released}` | `orders/views.py` | **NEW** |
| 22 | POST | `/api/orders/<id>/mark-purchase-tracked/` | IsAuthenticated (owner) | `{event_id?}` | `200 {purchase_tracked:true, tracked_at}` / `409` if already set | `orders/views.py` | **NEW** |
| 23 | POST | `/api/orders/<id>/initiate-payment/` | IsAuthenticated (owner) | `{payment_method:'PREPAID'}` | `200 {redirect_url, merchant_order_id, attempt_id}`; `400 {error:'ALREADY_PAID'}`; `503 {error:'PAYMENT_GATEWAY_UNAVAILABLE', message}` | `orders/views.py` | **CHANGED** (one envelope; writes `PaymentAttempt` not `Order.provider_order_id`) |
| 24 | POST | `/api/orders/payment/callback/` | gateway auth | **V2**: raw JSON `{event, payload:{merchantOrderId, orderId, state, amount, …}}` + header `Authorization: SHA256(user:pass)` | `200 {status:'ok'}` for every authenticated callback **including duplicates**; `401` only on genuine auth failure | `orders/views.py`, `orders/payment.py` | **CHANGED** (V1→V2, idempotent, becomes a *hint* that triggers #19's authoritative status call) |
| 25 | GET | `/api/orders/<id>/` | IsAuthenticated (owner) | — | explicit field list + `status` (derived), `shipping_address:{first_name,…}` **and** flat `shipping_*` aliases, `subtotal/discount_amount/shipping_amount/total` in rupees, `shipment.tracking_url` as an **absolute external** URL. `payment_id`/`provider_order_id` removed; `payment_reference` masked | `orders/serializers.py` | **CHANGED** |
| 26 | GET | `/api/wishlist/` · POST `/api/wishlist/` · DELETE `/api/wishlist/<product_id>/` | IsAuthenticated | `{product_id}` on POST | `{id, products:[Product]}` — nested, not PKs; `destroy` uses `get_or_create` | `wishlist/serializers.py`, `wishlist/views.py` | **CHANGED** (api.js moves to these paths; no new routes) |
| 27 | GET | `/api/auth/me/` | IsAuthenticated | — | `{id,email,first_name,last_name,phone_number,is_email_verified,date_joined}` | `accounts/views.py`, `accounts/urls.py` | **NEW** |
| 28 | POST | `/api/token/` | AllowAny | `{username:<email>, password}` | `200 {access, refresh, user:{…}}`; `403 {detail, code:'email_not_verified', email}`; `400 {code:'invalid_credentials', detail}` — **not 401**, so the client never mistakes it for session expiry | `accounts/token_views.py` | **CHANGED** |
| 29 | POST | `/api/auth/register/` | AllowAny, throttle `10/hour` | `{email,password,first_name?,last_name?,phone_number?,terms_accepted:true,marketing_consent:bool}` | `201 {id,email,verification_email_sent:bool,detail}`; `400` incl. `password` validator errors | `accounts/serializers.py`, `accounts/views.py` | **CHANGED** |
| 30 | GET | `/api/auth/verify-email/<token>/` | AllowAny | — | `200 {detail, code:'verified'\|'already_verified'}`; `400 {detail, code:'invalid_token'\|'token_expired'}` | `accounts/views.py` | **CHANGED** |
| 31 | POST | `/api/auth/resend-verification/` | AllowAny, `ScopedRateThrottle 3/hour` keyed on **email** | `{email}` | `200 {detail}` — identical neutral body for unknown / unverified / already-verified; `429 {detail, retry_after}` | `accounts/views.py` | **CHANGED** |
| 32 | POST | `/api/auth/password-reset/` | AllowAny, `3/hour` | `{email}` | **always** `200 {detail:'If an account exists…'}` (enumeration leak removed) | `accounts/serializers.py` | **CHANGED** |
| 33 | POST | `/api/newsletter/subscribe/` | AllowAny, `10/hour` | `{email, consent:true, source, utm?}` | `201 {id,email,status:'subscribed'\|'already_subscribed',created_at}`; `400 {email:[…]}`; `429` | **new app** `backend/newsletter/` | **NEW** |
| 34 | GET | `/api/content/site-settings/` | AllowAny, cached 300s | — | `{support_email,support_phone,whatsapp,hours,brand_name,tagline,positioning_statement,claims:[{label,footnote,evidence_url,is_substantiated}],social:{instagram}}` | **new app** `backend/content/` | **NEW** |
| 35 | GET | `/api/content/policy/` | AllowAny, cached 300s | — | `{delivery_window_days:[min,max], free_shipping_threshold, shipping_charge, return_window_days, return_window_from:'delivery'\|'purchase', refund_days, return_exclusions[], cod_available}` | `backend/content/` | **NEW** |
| 36 | GET | `/api/content/home-sections/` | AllowAny | — | `[{id,kind,display_order,title,subtitle,body,image,cta_label,cta_target,starts_at,ends_at,products[]}]`, server-filtered to `is_active AND starts_at<=now<=ends_at` | `backend/content/` | **NEW** |
| 37 | POST | `/api/content/support/contact/` | AllowAny, `5/hour` | `{name,email,order_id?,topic,message}` | `201 {detail, ticket_ref}` | `backend/content/` | **NEW** |
| 38 | GET | `/api/shipping/check-serviceability/` | AllowAny, cached per pincode 24h | `?pincode=NNNNNN` | `{serviceable,cod_available,expected_delivery_date,transit_days,area_code,error}`; error body normalised to `{error, field}`; `503 {error}` on Blue Dart failure | `shipping/views.py` | **CHANGED** (error envelope + cache + strict bool coercion only) |

**Settings changes (WP-01, `backend/lefoyer/settings.py`):** add `rest_framework.filters.SearchFilter` and `OrderingFilter` to `DEFAULT_FILTER_BACKENDS`; add a `SIMPLE_JWT` block (`ACCESS_TOKEN_LIFETIME=60min`, `REFRESH_TOKEN_LIFETIME=14d`, `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`); add `DEFAULT_THROTTLE_RATES` scopes `resend_verification:'3/hour'`, `newsletter:'10/hour'`, `coupon_validate:'20/hour'`, `notify_me:'5/hour'`, `support:'5/hour'`, `catalogue:'300/minute'` and set `throttle_scope='catalogue'` on the read-only catalogue viewsets (resolves C-33's sibling: the global `anon:'30/minute'` would 429 an ordinary browsing session and a debounced search instantly); replace the absolute jazzmin `custom_css` with `'admin/css/custom.css'`; make the DB choice depend on `DATABASE_URL` alone and `raise ImproperlyConfigured` when `not DEBUG` and it is unset; `raise ImproperlyConfigured` if `not DEBUG and SITE_URL` still points at localhost; add `CELERY_TASK_ALWAYS_EAGER = DEBUG` and a console `EMAIL_BACKEND` under `DEBUG`; add `PHONEPE_CALLBACK_USERNAME`/`PHONEPE_CALLBACK_PASSWORD`; delete the hardcoded PhonePe UAT merchant-id and salt literals; register `newsletter` and `content` in `INSTALLED_APPS`; mount `api/newsletter/` and `api/content/` in `lefoyer/urls.py`.

### 2c. Model changes, per app, with migration numbers

**`products`** — latest is `0005_product_manual_out_of_stock` → create **`0006`**, **`0007`**, **`0008`**.

`0006_product_merchandising_and_flags`:
| Field | Type | Default / migration note |
|---|---|---|
| `Product.display_order` | `PositiveIntegerField(db_index=True)` | `default=0` |
| `Product.coming_soon` | `BooleanField` | `default=False` (makes `ProductCard`'s dead branch real — C-16 sibling) |
| `Product.is_new` | `BooleanField` | `default=False` |
| `Product.brand` | `CharField(max_length=100)` | `default='Le foyeR.'` |
| `Category.image` | `ImageField(upload_to='categories/', blank=True, null=True)` | nullable |
| `Category.display_order` | `PositiveIntegerField` | `default=0` |
| `SubCategory.display_order` | `PositiveIntegerField` | `default=0` |
| `Product.Meta.ordering` | `['display_order', '-created_at']` | **required** — fixes pagination over an unordered queryset (C-17) |
| `Product.Meta.indexes` | `(is_featured, display_order)`, `(stock_quantity,)` | — |

`0007_concern_skintype_stocknotification`: new `Concern(name, slug unique, description blank, icon_key blank, display_order default 0)`; new `SkinType(name, slug unique, display_order default 0)`; `Product.concerns = M2M(Concern, blank=True, related_name='products')`; `Product.skin_types = M2M(SkinType, blank=True, related_name='products')`; new `StockNotification(product FK PROTECT, email EmailField, consent_at DateTimeField, created_at auto, notified_at null)` with `unique_together=('product','email')`. M2M and nullables need no default.

`0008_backfill_taxonomy_from_suitable_for` — **data migration, idempotent, reversible to a no-op.** Creates the `SkinType` rows `normal, dry, oily, combination, sensitive, acne-prone` and the `Concern` rows derived **only** from real catalogue evidence (C-11): `brightening-anti-pigmentation`, `moisturizers-hydrators`, `sun-protection`, `cleansers`, `serums-treatments`, `shampoo-conditioner`, `body-care`, `lip-care` — i.e. the eight existing `SubCategory` slugs, mapped 1:1. **No concern is invented** (LF-24 forbids it): `anti-aging` and `night-repair` from `ShopByConcern.jsx` are **deleted, not created**. Then maps each of the six verified `suitable_for` strings onto skin types by exact string match (not by splitting): `'Oily & Acne-Prone Skin'→{oily,acne-prone}`; `'All Skin Types'→{normal,dry,oily,combination}`; `'All Skin Types, including Sensitive'→ +{sensitive}`; `'All Skin Types, including Sensitive & Acne-Prone'→ +{sensitive,acne-prone}`; the two `All Hair Types…` strings map to **no** skin type (they are haircare). Any string not in that table is left unmapped and **logged** — it must not be guessed. `suitable_for` is kept as the human-readable display line; filtering moves to the M2M.

**`reviews`** — latest is `0001_initial` → create **`0002_review_verification_and_moderation`**.
| Field | Type | Default / note |
|---|---|---|
| `Review.is_verified_purchase` | `BooleanField` | `default=False`; set server-side at create; never client-writable |
| `Review.is_approved` | `BooleanField` | `default=True` (ship-safe: existing rows stay visible) |
| `Review.title` | `CharField(max_length=140, blank=True)` | `default=''` |
| `Review.order_item` | `FK(orders.OrderItem, null=True, blank=True, on_delete=SET_NULL)` | nullable |
| `Review.rating` | add `validators=[MinValueValidator(1), MaxValueValidator(5)]` | — |
| `Review.Meta` | `ordering=['-created_at']`, `unique_together=('product','user')` | **Pre-check required:** the migration must run a `RunPython` that de-duplicates existing `(product,user)` pairs (keep the newest) *before* `AlterUniqueTogether`, or it will fail on live data |

**`orders`** — latest is `0004_order_payment_method` → create **`0005`**, **`0006`**.

`0005_order_money_and_payment_state`:
| Field | Type | Default / migration note |
|---|---|---|
| `Order.payment_status` choices | add `('CANCELLED','Cancelled')`, `('EXPIRED','Expired')`, `('REFUNDED','Refunded')` | existing `PENDING` label is **kept** — no data migration needed |
| `Order.subtotal` | `DecimalField(10,2)` | `default=0`; `RunPython` backfills `subtotal = total + round(total*discount/(100-discount))` is lossy — instead backfill `subtotal = total` and `discount_amount = 0` for historic rows and log them, because the gross is unrecoverable from a net total plus a percent when rounding occurred |
| `Order.discount_amount` | `DecimalField(10,2)` | `default=0` |
| `Order.discount_type` | `CharField(max_length=10, choices PERCENT/FIXED)` | `default='PERCENT'` |
| `Order.shipping_amount` | `DecimalField(10,2)` | `default=0` |
| `Order.coupon_code` | `CharField(max_length=50, blank=True)` | `default=''` — snapshot, survives `coupon` SET_NULL |
| `Order.order_number` | `CharField(max_length=24, unique=True, null=True)` | nullable + `RunPython` backfill `f'LF{pk:06d}'`, then a follow-up `AlterField` to non-null in `0006` |
| `Order.stock_decremented` | `BooleanField` | `default=False`; `RunPython` sets `True` where `payment_status='COMPLETED'` (historic orders did decrement) |
| `Order.stock_restored` | `BooleanField` | `default=False` |
| `Order.cart_cleared_at` | `DateTimeField(null=True)` | nullable |
| `Order.confirmation_email_sent_at` | `DateTimeField(null=True)` | nullable |
| `Order.purchase_tracked_at` | `DateTimeField(null=True)` | nullable |
| `Order.needs_manual_review` | `BooleanField` | `default=False` |
| `Order.idempotency_key` | `CharField(max_length=64, null=True, db_index=True)` | nullable |
| `Order.provider_order_id` | add `db_index=True` | keep nullable; **do not** make unique (historic NULLs) |
| `OrderItem.product` | change `on_delete=CASCADE` → **`PROTECT`** | plus `OrderItem.product_name`/`product_sku` snapshot `CharField`s, `default=''`, backfilled by `RunPython`. This is what stops `seed_products.py`'s `Product.objects.all().delete()` from cascading away order history and verified-buyer evidence |
| delete | `Order.get_total_cost()` | zero callers; double-discounts (C-20) |

`0006_paymentattempt_processedcallback`: new `PaymentAttempt(order FK CASCADE related_name='attempts', merchant_order_id CharField(64) unique db_index, provider_payment_id blank, amount Decimal(10,2), state CharField choices CREATED/PENDING/COMPLETED/FAILED/CANCELLED default 'CREATED', raw_response JSONField default=dict, created_at, updated_at)`; new `ProcessedCallback(event_key CharField(128) unique, order FK SET_NULL null, payload JSONField, received_at)`; `AlterField Order.order_number → unique, non-null`.

**`coupons`** — latest is `0002_coupon_max_uses_coupon_min_order_amount_and_more` → create **`0003_coupon_discount_type`**.
`discount_type CharField(max_length=10, choices PERCENT/FIXED, default='PERCENT')`; `discount_value DecimalField(10,2, default=0)` with a `RunPython` backfill `discount_value = discount`; `max_discount_amount DecimalField(10,2, null=True, blank=True)` (cap for percent coupons); `active BooleanField(default=False)` (it currently has **no** default, so `Coupon()` in a shell raises); `Coupon.discount` is retained as a deprecated read-only column, excluded from every serializer. New method `Coupon.compute_discount(subtotal) -> Decimal` — `PERCENT → min(subtotal*value/100, max_discount_amount or ∞)`, `FIXED → min(value, subtotal)`, always `quantize(Decimal('0.01'))`, never exceeding subtotal.

**`accounts`** — latest is `0002_add_email_verification_fields` → create **`0003_user_verification_and_consent`**.
`email_verification_sent_at DateTimeField(null=True)`; `email_verified_at DateTimeField(null=True)` with a `RunPython` that leaves it **NULL** for the users grandfathered to `is_email_verified=True` by `0002` — this is what makes genuinely-verified mailboxes distinguishable from grandfathered ones going forward; `terms_accepted_at DateTimeField(null=True)`; `marketing_consent BooleanField(default=False)`; `marketing_consent_at DateTimeField(null=True)`; `AlterField email_verification_token → max_length=128` (64 chars against a 64-char column is zero headroom, C-26); `AlterField email → EmailField(unique=True)` **preceded by a `RunPython` that reports duplicate emails and aborts with a clear message if any exist** (`token_views.py:31`'s `User.objects.get(email=…)` currently 500s on duplicates).

**`cart`** — latest is `0002_alter_cart_user` → create **`0003_cartitem_unique_and_snapshot`**: `unique_together=('cart','product')` preceded by a de-dup `RunPython` (merge quantities); `CartItem.added_at DateTimeField(auto_now_add=True, null=True)`.

**`shipping`**, **`wishlist`** — no model changes. New apps `newsletter` and `content` each get `0001_initial`:
- `newsletter.Subscriber(email EmailField unique, source CharField, consent_at DateTimeField, ip GenericIPAddressField null, utm JSONField default=dict, is_confirmed BooleanField default=False, unsubscribe_token CharField(64) unique, created_at)`.
- `content.SiteSetting(singleton: key/value or one row)`, `content.PolicySetting(singleton)`, `content.Claim(label, footnote, evidence_url blank, is_substantiated BooleanField default=False, display_order)`, `content.HomeSection(kind, display_order, title, subtitle, body, image, cta_label, cta_target, starts_at, ends_at, is_active default=False, products M2M to Product blank)`, `content.SupportRequest(name, email, order FK null SET_NULL, topic, message, ticket_ref unique, created_at, handled_at null)`.

### 2d. The canonical product-availability rule

Written once; both sides implement **exactly this** and nothing else.

```
visible   := show_at_website == True
sellable  := visible AND manual_out_of_stock == False AND stock_quantity > 0 AND coming_soon == False
available_quantity := 0 if (manual_out_of_stock OR coming_soon OR stock_quantity < 0) else stock_quantity
```

- **Visibility is enforced only server-side.** Every public queryset starts `Product.objects.filter(show_at_website=True)`. `visible` never appears in a payload; an invisible product simply is not served, and a detail request for one returns **404**, not a hidden page.
- **Backend ORM form**, used identically in `products/filters.py` (`in_stock` filter), `products/views.py` (`featured`/`bestsellers`/`related` ordering), `cart/views.py` (`add`, `update_item`, `merge`), `orders/services.py` (order creation check and confirm-time re-check):
  `SELLABLE_Q = Q(manual_out_of_stock=False) & Q(stock_quantity__gt=0) & Q(coming_soon=False)`
  Availability-first ordering uses `.annotate(is_sellable=Case(When(SELLABLE_Q, then=Value(1)), default=Value(0), output_field=IntegerField())).order_by('-is_sellable', 'display_order', '-created_at')`.
- **Serializer contract.** `ProductSerializer` exposes `in_stock` (boolean, = `sellable`), `available_quantity` (integer, per the rule above — **it must zero out when `manual_out_of_stock` or `coming_soon` is set**; today `get_available_quantity` returns raw `stock_quantity` and ignores both, which is how a disabled product reports `in_stock:false, available_quantity:150`), and `coming_soon`.
- **Frontend contract.** `const isSellable = product.in_stock === true;` and `const maxQty = product.available_quantity;`. **No component may recompute availability from `stock_quantity`.** `ProductCard.jsx` and `ProductDetail.jsx` must drop their `in_stock !== undefined ? … : stock_quantity > 0` fallbacks. Low-stock copy uses one shared constant `LOW_STOCK_THRESHOLD = 5` (today the PDP uses `<=5` in one place and `<=10` in another).
- **The cart is not a promise.** Items already in a cart are re-validated against `sellable` on every `GET /api/cart/summary/`; a now-unsellable line is returned with `in_stock:false` and the row is rendered disabled with a "no longer available — remove" action. Stock is enforced server-side in `cart/add`, `cart/merge` and `orders/services.confirm_order`, not only in the card.
- **Unsellable means an action, not a dead end.** Where Quick Add / Add to Cart is suppressed, a **"Notify me when available"** control takes its place (endpoint #6), on both the card and the PDP.

### 2e. The canonical rating / review source of truth (LF-01)

**Single source: `reviews.Review` rows where `is_approved=True`.** Three mechanisms together make drift impossible:

1. **The denormalised columns stop being served.** `ProductSerializer` switches from `exclude=[…]` to an **explicit field list** that omits `rating` and `reviews_count` entirely, and adds:
   ```
   review_summary = {average: number|null, count: int,
                     distribution: {"5":int,"4":int,"3":int,"2":int,"1":int},
                     verified_count: int}
   ```
   `average` is **`null`** when `count == 0` — never `0`. It is read from an annotation, not a column: `ProductViewSet.get_queryset()` adds `.annotate(rv_avg=Avg('reviews__rating', filter=Q(reviews__is_approved=True)), rv_count=Count('reviews', distinct=True, filter=Q(reviews__is_approved=True)))`, and `review_summary` is a `SerializerMethodField` that prefers those annotations and falls back to a direct aggregate for single-object reads. `distribution` and `verified_count` come from one grouped query per product on the detail/summary endpoints only.
2. **The columns become an un-editable cache, kept only so `?ordering=-rating` and `?ordering=-reviews_count` can hit an index.** They are recomputed in a `post_save`/`post_delete` receiver on `Review` (registered with `dispatch_uid`, wrapped in `transaction.on_commit`), plus a `recompute_product_ratings` management command for backfill. `ProductAdmin` adds `readonly_fields = ('rating','reviews_count')`, so the admin text box that is currently their only writer (C-9) is removed.
3. **One number everywhere.** The PDP hero stars, the PDP review-block average and histogram, the `ProductCard` badge, the listing, and the JSON-LD `aggregateRating` all read `product.review_summary`. **No component may average a page of reviews client-side** — that is the exact bug in `ProductReviews.jsx` today. `ProductCard` hides the `<Rating>` widget entirely when `count === 0` and renders a "Be the first to review" link instead of an empty five-star row with `(0)`.

**"Verified Buyer" — computed once, server-side, at review creation, stored on the row:**
```python
is_verified = OrderItem.objects.filter(
    order__user=user, product=product
).filter(
    Q(order__payment_status='COMPLETED') |
    Q(order__payment_method='COD', order__shipment__status='delivered')
).exists()
```
Rationale, from the verified code: `Order.paid`/`payment_status='COMPLETED'` is the only reliable prepaid signal and is set by the payment path; a COD order is marked COMPLETED at creation, which is *not* evidence of receipt, so COD is additionally gated on a **delivered shipment**. The flag is written in `perform_create`, is `read_only` in the serializer, and is **never** recomputed (so a later refund does not retroactively erase a genuine review). `is_verified_purchase: false` renders **no chip at all** — the UI has no other way to print "Verified Buyer", and no hardcoded array may supply one.

**Consequences that must land in the same change-set:** `reviews/serializers.py` must stop using `fields='__all__'` — it currently emits `user` as a bare integer PK (leaking user ids publicly) with no display name, while `ProductReviews.jsx:169` does `review.user.username.charAt(0)`. The replacement emits `author: {display_name}` where `display_name` = `first_name + ' ' + last_name[0] + '.'`, falling back to a masked local part of the email — **the fallback is mandatory**, because `SignUp.jsx` never collects `first_name`/`last_name`, so most real users have blank names. `product` and `user` must be set in `perform_create`, never accepted from the client. Add an `IsOwnerOrReadOnly` object permission (today any authenticated user can `PATCH`/`DELETE` any review). `CustomerTestimonials.jsx` is rebuilt on `listTopReviews()`; if `count === 0` the section is **not rendered** rather than filled with placeholders.

### 2f. The payment state machine (LF-14 / LF-15 / LF-28)

All transitions live in **one** module, `backend/orders/services.py`, with exactly four public functions — `create_order()`, `confirm_order()`, `fail_order(reason)`, `cancel_order(reason)`. Each runs inside `transaction.atomic()` with `Order.objects.select_for_update().get(pk=…)`, each is a **no-op when the order is already in a terminal state**, and each is the *sole* owner of stock movement, cart clearing, coupon release, the confirmation email and the purchase-tracking flag. `complete_payment`, `InitiatePaymentView` and `PaymentCallbackView` all funnel into them; `InitiatePaymentView` collapses into an `OrderViewSet` action so there is one response envelope (today the two differ: `{success, redirect_url}` vs `{redirect_url}`, which is why Checkout and PaymentCompletionDialog parse differently).

| State | How it is entered | Who may enter it | Customer sees | Recovery action |
|---|---|---|---|---|
| `PENDING` (PREPAID) | `POST /api/orders/` creates the order + `OrderItem`s with a price snapshot + a `PaymentAttempt`, and returns the PhonePe `redirect_url` in the **same** response | `create_order()` only | "Order `LF000123` created — completing payment." Confirmation page polls `GET payment-status/` up to 5 times over ~30s | *Retry payment*, *Restore my cart*, *Contact support* |
| `COMPLETED` | **Only** `confirm_order()`, called from (a) the V2 S2S callback after it has *re-verified* with `get_order_status()`, (b) `GET /orders/<id>/payment-status/`, (c) `create_order()` directly for COD, (d) the PENDING-sweeper beat job | `confirm_order()` only | "Order placed successfully" + order number + itemised subtotal / discount / shipping / total | *View order*, *Continue shopping*, FAQ/support link |
| `FAILED` | `fail_order()` from the callback's `FAILED` state or from a `payment-status` lookup returning FAILED | `fail_order()` only | "Payment failed. Order `LF000123` is awaiting payment — you have **not** been charged. Your cart is still here." | *Retry payment* (same order, new `PaymentAttempt`), *Restore my cart*, *Contact support* with the order ref |
| `CANCELLED` **(new)** | `cancel_order()` from (a) `POST /orders/<id>/cancel/` by the customer, (b) the gateway reporting a user-cancelled payment, (c) the sweeper after the PENDING TTL | `cancel_order()` only | "Payment cancelled. Order `LF000123` was not completed. Nothing has been charged." | *Retry payment*, *Restore my cart*, *Contact support* |
| `EXPIRED` **(new)** | The Celery beat sweeper, for orders `PENDING` longer than 30 minutes whose gateway status is still `PENDING` or unknown | sweeper only | "We could not confirm this payment. If you were charged we will refund it automatically — reference `LF000123`." | *Contact support* (prominent), *Restore my cart* |
| `REFUNDED` **(new)** | Admin / ops only | admin | "Refunded" on the order page | — |

**When stock moves, when the cart clears, and why the ordering is now safe:**

- **Stock is decremented exactly once, inside `confirm_order()`**, as a conditional update per line — `Product.objects.filter(pk=…, stock_quantity__gte=qty).update(stock_quantity=F('stock_quantity')-qty)` — guarded by the `Order.stock_decremented` flag so a replayed callback cannot double-decrement.
- **Stock is restored exactly once, inside `fail_order()`/`cancel_order()`**, guarded by `Order.stock_restored`, and *only if* `stock_decremented` is True. On the normal prepaid-failure path it is a **no-op**, because nothing was ever taken. This is the whole point: today a replayed `PAYMENT_ERROR` calls `restore_stock_for_order` again and **inflates inventory**.
- **The cart is cleared exactly once, inside `confirm_order()`**, and `cart_cleared_at` is stamped. `POST /api/orders/` no longer deletes the cart (remove `cart.items.all().delete()`), and `Checkout.jsx` no longer calls `clearCart()` before redirecting. The cart therefore survives an abandoned PhonePe page with **nothing to rebuild** — which is what LF-14 asks for, and it removes the render-phase `navigate('/cart')` race in Checkout at the same time.
- **The confirmation email is sent only from `confirm_order()`**, gated on `confirmation_email_sent_at IS NULL`. At creation a PREPAID order sends nothing (or an explicit "Order received — completing payment"). The email's money block prints the stored `subtotal` / `discount_amount` / `shipping_amount` / `total` **verbatim, with no arithmetic** — today it recomputes a percentage off an already-net total and shows less than was charged.
- **Shipment generation stops being a signal.** `shipping/signals.py`'s `post_save` receiver is removed; `confirm_order()` calls `transaction.on_commit(lambda: generate_shipment_for_order.delay(order.id))`. That fixes the pre-commit dispatch, the re-dispatch on every admin save, and the rolled-back-order dispatch in one move. `generate_shipment_for_order` switches to `get_or_create` on `Shipment` and separates "waybill failed, retry me" from "a shipment row exists", so a transient Blue Dart failure is actually retried instead of being permanently masked by its own error row.
- **Idempotency.** `POST /api/orders/` honours an `Idempotency-Key` header and returns the existing order for a repeated key, so a double-click cannot mint two orders. The callback writes a `ProcessedCallback` row keyed on the provider event id and returns `200` immediately on a duplicate. Every retry creates a new `PaymentAttempt` instead of overwriting `Order.provider_order_id`, so a late callback for an earlier attempt is still resolvable.
- **The one remaining oversell window** is between the read-only stock check at order creation and the conditional decrement at confirm. If confirm-time stock is short, `confirm_order()` still marks the order `COMPLETED` (the money *was* taken — pretending otherwise would be the worse lie), sets `needs_manual_review=True`, skips shipment generation, and emails ops. This is stated here so no implementer "fixes" it by silently failing a paid order.

### 2g. Meta Pixel event plan (LF-17)

One init only: keep the inline snippet in `index.html` (pixel id `4302094446724267`), **delete the entire `useEffect` block from `App.jsx:29-54`** (dead code, C-2). All events go through one module, `frontend/src/services/analytics.js` (owned by WP-07), which no-ops safely when `window.fbq` is absent.

| Event | Fires where | Parameters |
|---|---|---|
| `PageView` | `usePageViewTracking()` hook mounted inside the Router, on every `location.pathname + search` change (debounced one frame) | — |
| `ViewContent` | `ProductDetail.jsx`, once per slug after the product loads | `{content_type:'product', content_ids:[sku], content_name, value:effectivePrice, currency:'INR'}` |
| `AddToCart` | `CartContext.addToCart`, on success only | `{content_ids:[sku], content_name, value:effectivePrice*qty, currency:'INR'}` |
| `InitiateCheckout` | `Checkout.jsx`, when Place Order is pressed (before the network call) | `{num_items, value:cart subtotal, currency:'INR', content_ids:[…]}` |
| **`Purchase`** | `OrderConfirmation.jsx` **only**, and **only** when `GET /api/orders/<id>/payment-status/` returns `payment_status === 'COMPLETED' && purchase_event_pending === true` | `{value: Number(total), currency:'INR', content_ids:[sku…], contents:[{id,quantity,item_price}], num_items}`, plus `{eventID: 'order-<id>'}` |

**Exactly-once guarantee — server-side, not `localStorage`.** `purchase_event_pending` is computed by the server as `payment_status == 'COMPLETED' and purchase_tracked_at is None`. Immediately after firing, the client calls `POST /api/orders/<id>/mark-purchase-tracked/`, which sets `purchase_tracked_at` and returns `409` if it was already set. A refresh, a second tab, a back-navigation, or a shared link therefore all see `purchase_event_pending: false` and fire nothing. `eventID = 'order-<id>'` additionally lets Meta de-duplicate against a future server-side Conversions API call. A `sessionStorage` guard is added as a belt-and-braces in-flight lock only, never as the source of truth.

**Nothing fires for `FAILED`, `CANCELLED`, `PENDING` or `EXPIRED`.** `Purchase` is never fired from a redirect query parameter — which is the only reason it could ever be fired by an attacker today.

---

## 3. Work packages

Twelve packages. **No file appears in two packages.** WP-01 and WP-07 must land before anything that consumes their contracts; WP-02…WP-06 are mutually parallel; WP-08…WP-12 are mutually parallel once WP-07 lands.

---

### WP-01 — Backend platform, config, and the content/CMS app
**Closes (contributes to):** LF-04 scaffolding, LF-05, LF-12, LF-25, LF-29, LF-30, plus the config fixes every other package needs.
**Depends on:** §2b (settings/throttle/mount list), §2c.

**Owns:**
- `backend/lefoyer/settings.py` — all settings changes listed at the end of §2b. **Pre-register `newsletter` and `content` in `INSTALLED_APPS` now**, so no other package touches this file.
- `backend/lefoyer/urls.py` — mount `api/newsletter/` and `api/content/` now. Delete nothing else.
- `backend/requirements.txt` — pin `phonepe-sdk==<resolved>` (see WP-05 step 1), add `django-cors-headers` if absent, `drf-spectacular` optional.
- `backend/content/` (new app, all files): `__init__.py`, `apps.py`, `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `migrations/0001_initial.py`.
  Implements endpoints #34 `site-settings/`, #35 `policy/`, #36 `home-sections/`, #37 `support/contact/` per §2b, each `AllowAny`, the first two cached 300s. Singletons seeded by a data migration carrying the **safe-default copy from §4** — so the site ships with substantiated-only claims and one policy source on day one. `HomeSection` is server-filtered to `is_active AND starts_at <= now <= ends_at`, which is what retires `NewYearBanner` without a deploy. Admin: `Claim` with an `is_substantiated` checkbox and an `evidence_url`; `HomeSection` with a date-window inline; `SupportRequest` read-mostly with a `handled_at` action.
- `backend/newsletter/` (new app, all files): models/serializers/views/urls/admin + `migrations/0001_initial.py`. Endpoint #33. Idempotent on an existing email (returns `already_subscribed`, never reveals it as an error), throttle scope `newsletter`, consent recorded with a timestamp and IP, `unsubscribe_token` generated at create, admin list + **CSV export action** so the list is actually usable.
- `backend/products/management/commands/seed_products.py` — guard the destructive block: require `--force`, refuse unless `settings.DEBUG` or `--i-know-this-deletes-everything`, and switch to `update_or_create(sku=…)`. Print a banner naming the price conflicts from C-10. *(Owned here, not by WP-02, because it is a config/ops concern and WP-02 is rewriting the models it writes to.)*
- `PAYMENT_FLOW_GUIDE.md` → **rewrite** at the repo root: document the new state machine from §2f, remove the "frontend decides the outcome from the `code` query param" instruction and the stale `payment.py line 35` pointer, and state the hash-free redirect contract.
- `README.md` — add a "local dev without credentials" section (seeded SQLite, `CELERY_TASK_ALWAYS_EAGER`, console email) that §5 depends on.

**Acceptance:** `python manage.py check` clean; `python manage.py migrate` from empty on SQLite succeeds; `GET /api/content/policy/` and `/api/content/site-settings/` return the §4 safe defaults; `GET /api/content/home-sections/` returns `[]` when no section is in-window; `POST /api/newsletter/subscribe/` stores a row with a consent timestamp, returns `already_subscribed` on repeat, and `429` on the 11th attempt in an hour; a prod-shaped env (`DEBUG=False`, no `DATABASE_URL`) raises `ImproperlyConfigured` instead of silently using SQLite; `grep -rn "/home/samikpandit" backend/lefoyer/settings.py` is empty.

---

### WP-02 — Catalogue backend: taxonomy, filters, search, merchandising, availability
**Closes:** LF-02 (backend), LF-08, LF-09 (backend), LF-10 (backend), LF-19 (backend), LF-20, LF-24 (backend).
**Depends on:** §2b #1–#10, §2c `products` 0006/0007/0008, §2d.

**Owns:** `backend/products/models.py`, `backend/products/serializers.py`, `backend/products/views.py`, `backend/products/filters.py`, `backend/products/urls.py`, `backend/products/admin.py`, `backend/products/migrations/0006_*.py`, `0007_*.py`, `0008_*.py`, and new `backend/products/management/commands/recompute_product_ratings.py`.

**Per file:**
- `models.py` — add the §2c `0006`/`0007` fields; add `Concern`, `SkinType`, `StockNotification`; add `Product.Meta.ordering` and indexes. **Do not** touch `rating`/`reviews_count` declarations (WP-03 owns their recompute).
- `filters.py` — rewrite. `category`/`sub_category` become `ModelMultipleChoiceFilter(field_name='…__slug', to_field_name='slug')`; add `concern`, `skin_type` (same pattern), `in_stock = BooleanFilter(method=…)` implementing §2d's `SELLABLE_Q`, `is_featured`, `is_bestseller`, keep `min_price`/`max_price`. `suitable_for` becomes `icontains` (kept for continuity; the real facet is the M2M).
- `views.py` — add `filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]`, `search_fields = ['name','description','key_benefits','key_features','ingredients','sku','category__name','sub_category__name']`, `ordering_fields = ['price','created_at','name','rating','reviews_count','display_order']`, default `ordering`. `get_queryset()` filters `show_at_website=True`, annotates `is_sellable` (§2d) and `rv_avg`/`rv_count` (§2e), and `select_related('category','sub_category').prefetch_related('concerns','skin_types')`. Rewrite `featured`/`bestsellers` to take `limit`/`include_out_of_stock`/`section`, order `-is_sellable, display_order`, and return the `{count, results}` envelope. Fix `related` to be slug-keyed (it already is — the *caller* was wrong), exclude unsellable/unpublished, add a sub-category → bestseller fallback, honour `limit`. Add `review-summary/` and `notify-me/` actions. `CategoryViewSet`/`SubCategoryViewSet`/new `ConcernViewSet`/`SkinTypeViewSet` become **`ReadOnlyModelViewSet`** (they are currently staff-writable `ModelViewSet`s through the public API), annotated with `product_count=Count('products', filter=Q(products__show_at_website=True) & SELLABLE_Q, distinct=True)`, ordered by `display_order`, `pagination_class=None`, and `SubCategory` gains a `category` filter. Set `throttle_scope='catalogue'`.
- `serializers.py` — `ProductSerializer` moves from `exclude` to an **explicit field list** (omitting `show_at_website`, `manual_out_of_stock`, `rating`, `reviews_count`); nests `category`/`sub_category` as `{id,name,slug}`; adds `concerns`/`skin_types` as `[{id,name,slug}]`, `review_summary` (§2e), `brand`, `currency:'INR'`, `canonical_url` (absolute, from `SITE_URL`), `coming_soon`, `is_new`, `effective_price`; **fixes `get_available_quantity` per §2d**. Add a light `ProductCardSerializer` used by list/featured/related to stop shipping ten image fields and four prose blobs per card.
- `admin.py` — `readonly_fields = ('rating','reviews_count')` (§2e mechanism 2); `display_order`, `coming_soon`, `is_new` in `list_editable`; `filter_horizontal` for concerns/skin types; `StockNotification` admin with a CSV export; `Category`/`SubCategory` gain `image`/`display_order`.
- `0008` data migration — exactly as specified in §2c, including the "log, do not guess" rule for unmapped `suitable_for` strings and the explicit **non-creation** of `anti-aging` and `night-repair`.

**Acceptance:** `?search=serum` returns a strict subset; `?in_stock=true` excludes a product with `manual_out_of_stock=True` *and* one with `stock_quantity=0`; `?ordering=price` changes the order; `?category=skincare&category=haircare` filters to both (not the full catalogue); `/products/products/featured/?limit=3` returns ≤3, sellable first, in `display_order`; `/products/products/<slug>/related/` returns a non-empty list for a product whose category has one sibling; `/products/concerns/` lists only slugs backed by real sub-categories and **never** `anti-aging`/`night-repair`; `/products/categories/` carries `product_count`, and a category with zero sellable products reports `0`; a manually-disabled product serialises `in_stock:false, available_quantity:0`; page 2 of the product list never repeats a row from page 1.

---

### WP-03 — Reviews, ratings and wishlist backend
**Closes:** LF-01 (backend), LF-22 (backend), plus the live wishlist breakage (C-8).
**Depends on:** §2b #11–#13, #26; §2c `reviews` 0002; §2e.

**Owns:** `backend/reviews/models.py`, `backend/reviews/serializers.py`, `backend/reviews/views.py`, `backend/reviews/admin.py`, `backend/reviews/signals.py` (new), `backend/reviews/apps.py`, `backend/reviews/migrations/0002_*.py`, `backend/reviews/urls.py` (**delete** — empty, routing is the nested router), `backend/wishlist/serializers.py`, `backend/wishlist/views.py`.

**Per file:** `models.py` + `0002` per §2c (including the mandatory de-dup `RunPython` before `unique_together`). `serializers.py` — full rewrite per §2e: explicit fields, `author:{display_name}` with the masked-email fallback, `is_verified_purchase` read-only, `product`/`user` never client-writable. `views.py` — `perform_create` sets product+user, computes `is_verified_purchase` with the §2e query, rejects a duplicate with `409`; add `IsOwnerOrReadOnly`; add the `top/` list action; return `{review, review_summary}` on create. `signals.py` — `post_save`/`post_delete` on `Review` recomputing `Product.rating`/`reviews_count` inside `transaction.on_commit`, registered with `dispatch_uid` from `apps.ready()`. `admin.py` — add `is_approved`/`is_verified_purchase` to `list_display`/`list_filter`, bulk approve/unapprove, and **remove `user` from `list_filter`** (it renders a dropdown of every user). `wishlist/serializers.py` — `products` via the read-only nested product serializer, `user` dropped. `wishlist/views.py` — `destroy` uses `get_or_create`; keep the router paths and let api.js move to them (§2a).

**Acceptance:** the PDP review endpoint returns `author.display_name` and no `user` id; a review by a user with a COMPLETED order for that product has `is_verified_purchase:true`, one by a user with no order has `false`; a second review by the same user on the same product is rejected; `rating=0` and `rating=6` are rejected; deleting a review drops `review_summary.count` and `Product.reviews_count` together; `rating`/`reviews_count` cannot be edited in admin; `GET /api/wishlist/` returns full product objects; `POST /api/wishlist/` with `{product_id}` and `DELETE /api/wishlist/<product_id>/` both succeed for a user with no prior wishlist row.

---

### WP-04 — Accounts, auth and email backend
**Closes:** LF-31 (backend), LF-13 (backend half), LF-06 (email-link half).
**Depends on:** §2b #27–#32; §2c `accounts` 0003.

**Owns:** `backend/accounts/models.py`, `serializers.py`, `views.py`, `urls.py`, `token_views.py`, `email_service.py`, `tasks.py`, `admin.py`, `throttles.py` (new), `migrations/0003_*.py`.

**Per file:**
- `0003` per §2c — including the **duplicate-email pre-check that aborts with a clear message** before `email` becomes unique, and `email_verified_at` left NULL for users grandfathered by `0002`.
- `serializers.py` — add `validate_password` against `AUTH_PASSWORD_VALIDATORS`, `min_length=8`; accept and require `terms_accepted`, accept `marketing_consent`; **generate the token in exactly one place** and pass it to the task (`send_verification_email_task.delay(user.id, token)`), so `email_service` no longer rotates it (C-25); wrap the enqueue in `try/except` with an inline-send fallback and `transaction.on_commit`, and report `verification_email_sent` in the response so the UI can tell the truth; `PasswordResetSerializer.validate_email` stops raising "does not exist" (enumeration).
- `email_service.py` — `send_verification_email(user, token)` becomes a **pure sender** that never mutates the user and **re-raises** on failure (drop the `try/except → return False`); strip `/#` from all five link builders (`verify-email`, `products`, `reset-password`, two `orders/<id>`) and add a comment tying that to WP-07's legacy-hash redirect shim; replace the false "expire in 24 hours" sentence with the real configured window; print the order email's money block from the stored `subtotal`/`discount_amount`/`shipping_amount`/`total` with **no arithmetic** (today it double-discounts) and label the discount by `discount_type` rather than hardcoding `%`; move the header tagline to the §4 approved line.
- `tasks.py` — `@shared_task(bind=True, max_retries=3)` with `raise self.retry(exc=exc, countdown=60)`, so the declared retry policy actually fires.
- `views.py` — `VerifyEmailView`: enforce the 24h window against `email_verification_sent_at`, **stop nulling the token**, set `email_verified_at`, return a machine-readable `code` so the UI branches without string-matching, and make a second click resolve to `already_verified` (C-26). `ResendVerificationView`: add the scoped per-email throttle and a cooldown returning `429 {retry_after}`, and return an **identical neutral body** for unknown / unverified / already-verified. Add `MeView` (#27). **Delete `LoginView`** (dead, returns a hardcoded 404) and its route.
- `token_views.py` — override `serializer_class` so `validate()` adds `data['user'] = {id,email,first_name,last_name,phone_number,is_email_verified}`; change `User.objects.get(email=…)` to `.filter(email=…).first()`; return `400 {code:'invalid_credentials'}` for bad credentials instead of letting a 401 escape (C-27/C-28 interaction).
- `admin.py` — add a "Resend verification email" action; make `email_verification_token` readonly.

**Acceptance:** signup with password `a` is rejected with a field error; signup without `terms_accepted` is rejected; signup with Redis down still returns `201` with `verification_email_sent:false`; the emailed link contains **no** `/#/`; clicking it twice yields `verified` then `already_verified` (not "Verification Failed"); a token with `email_verification_sent_at` 25h old yields `code:'token_expired'`; the 4th resend for one email in an hour returns `429` with `retry_after`; `POST /api/token/` returns a `user` object; a wrong password returns `400 code:'invalid_credentials'`; `GET /api/auth/me/` returns the profile; `/api/auth/login/` is gone.

---

### WP-05 — Orders, payments, coupons, cart backend
**Closes:** LF-14, LF-15, LF-16 (backend), LF-17 (server flag), LF-27 (backend), LF-28 (backend).
**Depends on:** §2b #14–#25, §2c `orders` 0005/0006 + `coupons` 0003 + `cart` 0003, §2d, §2f.

**Owns:** `backend/orders/models.py`, `serializers.py`, `views.py`, `services.py` (new), `payment.py`, `urls.py`, `admin.py`, `analytics_views.py`, `tasks.py` (new — the PENDING sweeper), `migrations/0005_*.py`, `0006_*.py`; `backend/coupons/models.py`, `serializers.py`, `views.py`, `services.py` (new), `admin.py`, `migrations/0003_*.py`; `backend/cart/views.py`, `serializers.py`, `migrations/0003_*.py`; `backend/shipping/signals.py`, `backend/shipping/tasks.py`.

**Step 1, before any code:** resolve C-4. `pip install phonepe-sdk`, pin the resolved version, introspect `StandardCheckoutClient`, and write the real status-query and callback-validator method names into a comment above `PhonePeGateway.get_order_status`. **Do not guess them.** If the SDK does not expose a status query, call PhonePe's Order Status REST endpoint with the OAuth token and say so in the comment.

**Per file:** `services.py` is the heart — the four functions of §2f, each `select_for_update`, terminal-state no-op, sole owner of stock/cart/coupon/email/pixel-flag. `payment.py` — add `get_order_status(merchant_order_id) -> {state, provider_payment_id, amount_paise, raw}`; replace the V1 `verify_callback` with the V2 validator; pass the callback URL (`settings.PHONEPE_CALLBACK_URL`, which is currently referenced **nowhere**) and our order metadata into `build_request`; make `merchant_order_id` deterministic (`LF-<order>-<attempt>`) and persist the `PaymentAttempt` **before** `pay()`; build `redirect_url` as `f"{SITE_URL}/order-confirmation/{order.id}?ref={merchant_order_id}"` with **no `/#/`** (C-24). `views.py` — `create` delegates to `services.create_order` (no stock decrement, no cart delete, no email, `Idempotency-Key`, `payment_method` against an explicit allowlist that **400s** on anything unrecognised instead of defaulting to PREPAID, and format validation for email/phone/pincode); collapse `InitiatePaymentView` into an action with one envelope; add `payment-status/`, `retry-payment/`, `cancel/`, `mark-purchase-tracked/`; rewrite the callback to authenticate → dedupe via `ProcessedCallback` → persist raw → **re-verify with `get_order_status`** → funnel into `services` → return `200` for anything understood, including duplicates. `serializers.py` — explicit fields, derived `status`, `shipping_address` + flat `shipping_*` aliases (so `OrderDetail.jsx`'s eleven references stop rendering blank), rupee money fields, absolute `shipment.tracking_url`, `payment_id`/`provider_order_id` removed, `except:` narrowed to `Shipment.DoesNotExist`. `coupons/services.py::evaluate_coupon(code, subtotal, user)` is the single evaluator (C-1), called by both `coupons/views.py` (now `AllowAny`, throttled, `400` not `404`, narrow serializer) and `services.create_order`; `used_count` is claimed with a conditional update `filter(Q(max_uses=0)|Q(used_count__lt=F('max_uses'))).update(used_count=F('used_count')+1)` and released on fail/cancel. `cart/views.py` — add `summary/`, `merge/`, `restore-from-order/`; make `add`/`update_item` honour §2d (not just `stock_quantity`); return the backend's precise message so the UI can show it. `analytics_views.py` — scope the sales aggregate to `payment_status='COMPLETED'` (it currently counts abandoned PENDING orders as revenue). `shipping/signals.py` — delete the receiver (replaced by `on_commit` in `services`). `shipping/tasks.py` — `get_or_create` the `Shipment`, separate retry-worthy failures from "row exists". `orders/tasks.py` — the beat job sweeping `PENDING` orders older than 30 minutes through `payment-status` → `cancel`/`expire`.

**Acceptance:** `POST /api/orders/` for PREPAID leaves the cart intact (`GET /api/cart/` still returns the items) and `stock_quantity` unchanged, and returns `cart_retained:true` plus `payment.redirect_url`; the same `Idempotency-Key` twice returns one order; `payment_method:'xyz'` is a `400`, not a PREPAID order; `POST /api/coupons/validate/` as a **guest** with `{code, subtotal}` returns an exact `discount_amount` and `final_total`, and returns `reason:'MIN_ORDER_NOT_MET'` / `'EXHAUSTED'` / `'EXPIRED'` correctly — and the numbers it returns equal what `POST /api/orders/` then charges; a `FIXED` ₹200 coupon works; replaying a callback twice sends one email, decrements stock once, and restores it once; `payment-status/` on an unpaid order never returns COMPLETED and returns `503` with `payment_status:'PENDING'` when the gateway is unreachable; `cancel/` sets CANCELLED and releases the coupon; `mark-purchase-tracked/` returns `409` on the second call; `GET /api/orders/<id>/` carries `shipping_first_name`, a derived `status`, and rupee `discount_amount`; `grep -n "get_total_cost" backend` is empty.

---

### WP-06 — Shipping serviceability hardening
**Closes:** LF-11 (backend half), LF-26 (error envelope).
**Depends on:** §2b #38.

**Owns:** `backend/shipping/views.py`, `backend/shipping/serializers.py`, `backend/shipping/client.py`, `backend/shipping/constants.py`, `backend/shipping/utils.py`, `backend/shipping/models.py`, `backend/shipping/admin.py`, `backend/shipping/apps.py`, `backend/shipping/urls.py`.
*(`shipping/signals.py` and `shipping/tasks.py` belong to WP-05 — they are payment-flow files.)*

**What to do:** normalise every error body to `{error, field?}` (today a bad pincode returns raw DRF field errors `{"pincode":[…]}` while every other failure returns `{"error":…}` — two shapes for one client); actually use `PincodeCheckResponseSerializer` (imported and never used) so the response shape is enforced; **coerce `serviceable`/`cod_available` through a strict `str|bool` normaliser** — they come from zeep with `Settings(strict=False)`, so if the WSDL types them as strings the string `'false'` is truthy and every pincode would report serviceable (unverifiable from the repo: the WSDL is fetched at runtime); cache per pincode for 24h so a debounced input cannot exhaust the throttle; make the Blue Dart `tracking_url` an absolute external URL on the `Shipment` serializer. Leave the Blue Dart client logic otherwise alone — it works.

**Acceptance:** `?pincode=1` → `400 {error, field:'pincode'}`; an unserviceable pincode → `200` with `serviceable:false` and a message, not an error; credentials missing → `503 {error}`; two identical requests inside the cache window produce one upstream call; `serviceable` is a real boolean in the JSON.

---

### WP-07 — Frontend foundation: api.js, router, theme, contexts, shared components
**Closes:** LF-06 (routing + head manager), LF-10 (mock deletion), LF-13 (api.js half), LF-17 (analytics module), LF-26 (shared states), plus the contracts every other frontend package consumes.
**Depends on:** §2a, §2d, §2e, §2g.

**Owns:**
- `frontend/src/services/api.js` — the complete §2a surface, including `paramsSerializer`, list normalisation, the refresh-and-retry 401 interceptor, the `lefoyer:auth-expired` event, and `isThrottled`/`isNetwork` flags.
- `frontend/src/services/analytics.js` **(new)** — §2g, plus a `usePageViewTracking()` hook.
- `frontend/src/App.jsx` — `HashRouter` → **`BrowserRouter`**; **delete the pixel `useEffect` entirely** (C-2); add `usePageViewTracking` inside the Router; add routes `/search`, `/order-confirmation/:id`, `/orders`, `/forgot-password`, `/reset-password/:uid/:token`, `/contact`; wrap in a `HelmetProvider` and an `ErrorBoundary`.
- `frontend/src/components/common/LegacyHashRedirect.jsx` **(new)** — on mount, rewrite a legacy `#/verify-email/:t`, `#/reset-password/:uid/:t`, `#/orders/:id`, `#/order-confirmation`, `#/products` hash to the equivalent clean path. **This is the hard ordering dependency between LF-06 and LF-31:** every verification, reset, order and tracking link already in customers' inboxes is hash-based, and without this shim they all land on the homepage the moment the router changes.
- `frontend/index.html` — real `<title>`, meta description, canonical, `og:`/`twitter:` tags, favicon, `theme-color`; **one** font link carrying exactly the families `theme.js` declares; keep the single pixel init; remove the duplicate `@import` overlap with `index.css`.
- `frontend/src/main.jsx`, `frontend/src/theme.js`, `frontend/src/index.css` — settle the type system (one display serif + Inter; **either load Oswald/Playfair or delete every inline override** — C-30 lists all 11 sites, and the owning packages delete their own), add `responsiveFontSizes`, component overrides for `MuiTextField`/`MuiAlert`/`MuiChip`/`MuiAccordion`/`MuiButton` (minimum 44px touch target), focus-visible styles, `prefers-reduced-motion` handling for the three infinite marquees, and a 16px side gutter rule.
- `frontend/src/context/AuthContext.jsx` — consume `user` from the login response and `getMe()` on mount; add `isEmailVerified`; listen for `lefoyer:auth-expired`; `logout()` clears `authToken`, **`refreshToken`** (currently left behind), `user`, `wishlist` **and `cart`**.
- `frontend/src/context/CartContext.jsx` — expose `{cart, loading, initialised, error, pendingItemIds, addToCart, removeFromCart, updateQuantity, clearCart, refresh}`; every mutation **returns the parsed backend message** instead of a bare boolean (so `cart/views.py`'s `"Only N units available"` finally reaches the user, and `ProductDetail.jsx`'s `typeof result === 'string'` branch stops being dead); replace the per-item merge loop with `mergeCart()` and only clear `localStorage.cart` on a successful response, surfacing `skipped[]`; gate initialisation on `AuthContext.loading === false`; fire `AddToCart` via `analytics.js`.
- `frontend/src/context/WishlistContext.jsx` — fetch only when authenticated; use the corrected paths; optimistic add/remove.
- `frontend/src/components/ProtectedRoute.jsx` — keep as-is (it is already correct); only confirm the `from` state shape.
- New shared components, all owned here: `components/common/SeoHead.jsx` (title/description/canonical/og + a `jsonLd` slot), `components/common/JsonLd.jsx`, `components/common/NewsletterForm.jsx` (one implementation, `variant="inline"|"hero"`, real validation, **explicit consent checkbox**, in-flight disable, truthful messaging driven by the HTTP response), `components/common/PincodeCheck.jsx` (6-digit validation, loading/result/error states, last-pincode persistence), `components/common/ErrorState.jsx` (message + Retry + "browse all products"), `components/common/ProductCardSkeleton.jsx`, `components/common/EmptyState.jsx`, `components/common/NotifyMeDialog.jsx`, `components/common/SupportLink.jsx`.
- New content modules: `frontend/src/content/brand.js`, `frontend/src/content/policy.js`, `frontend/src/content/claims.js` — each hydrated from `getSiteSettings()`/`getPolicy()` with the §4 safe defaults as the compile-time fallback, each claim carrying `substantiated: true|false` and **only substantiated claims rendered**. These are the single source for every marketing and policy string in the app.
- `frontend/.eslintrc.cjs` — `no-restricted-imports` for `mockApi`/`mockData`; a rule or CI grep banning `<Grid item` and `href="#/`.
- **Delete:** `frontend/src/services/mockApi.js`, `frontend/src/data/mockData.js`, `frontend/src/components/common/Header.jsx`, `frontend/src/components/common/Button.jsx`, `frontend/src/components/common/Card.jsx`, `frontend/src/components/layout/Sidebar.jsx`, `frontend/src/components/product/ProductGrid.jsx`, `frontend/src/components/cart/CartItem.jsx`, `frontend/src/components/cart/CartSummary.jsx`. All verified importer-free, except the three mockApi consumers which WP-10 repoints in the same release. `CartSummary.jsx` must go rather than be repaired — it is the only file in the repo that calls the real coupon endpoint and it cannot even render (`Paper` is used and never imported), so the next implementer would copy it.
- `frontend/src/components/common/ScrollToTop.jsx` — keep; add a search-param-aware reset now that filters are URL-driven.
- `frontend/package.json` — add `react-helmet-async` (pinned), `vite-plugin-sitemap` or a prerender plugin (see §5 on the SSR caveat).

**Acceptance:** `npm run build` succeeds; `npm run lint` passes with the new rules and **fails** if `mockApi` is re-imported or a `<Grid item` is reintroduced; `grep -rn "mockApi\|mockData" frontend/src` is empty; URLs have no `#`; opening `/#/verify-email/abc` lands on `/verify-email/abc`; a 401 on a protected call silently refreshes and replays once and only logs out if the refresh fails; `grep -rn "window.location.href" frontend/src/services/api.js` is empty; `grep -rn "fbq" frontend/src/App.jsx` is empty.

---

### WP-08 — Global shell: navbar, search, layout, footer
**Closes:** LF-03 (spacer), LF-09 (frontend), LF-23 (mobile nav), LF-29, LF-30 (shell copy), LF-06 (footer links).
**Depends on:** WP-07 (`api.js`, `brand.js`, `SupportLink`); §2a.

**Owns:** `frontend/src/components/layout/Navbar.jsx`, `frontend/src/components/layout/Layout.jsx`, `frontend/src/components/common/Footer.jsx`, and new `frontend/src/components/search/SearchOverlay.jsx`, `frontend/src/components/search/SearchResultRow.jsx`, `frontend/src/pages/Search.jsx`.

**What to do:** `Layout.jsx` — render `<Toolbar />` **unconditionally** (delete `{!isHome && …}`), so the Marquee stops hiding under the fixed AppBar. `Navbar.jsx` — wire the dead search icon to `SearchOverlay` (also opened by `/` keypress), add a search row + cart + wishlist + FAQ/Support + logout to the mobile Drawer (it currently holds only Products / About / Sign In), stop hiding the account icon below `sm`, delete the unused `isScrolled`/`isHome` state, take the wordmark and tagline from `brand.js` (resolving `LE FOYER` vs `Le foyeR.`), and forward `location.state.from` through both Sign In links so the LF-13 journey survives a detour through the navbar. `SearchOverlay` — Apple-style full-width overlay, 300ms debounce with request cancellation, `searchProducts(q, {in_stock:true, page_size:6})`, thumbnail/name/price/stock rows, "See all N results" → `/search?q=`, and a **useful no-results state** (`No products match "x"` + link to all products + the real concern chips from `listConcerns()`). `pages/Search.jsx` — a linkable, indexable `/search?q=` results page with `SeoHead` (`noindex` for empty queries), loading skeletons, an error state, and the same no-results copy. `Footer.jsx` — rewrite: replace the ternary chain with a declarative `[{label, to}]` array **including FAQ and Contact Us** (so no label can fall through to `'#'`), convert every internal link to `component={RouterLink} to=…` and keep `href`+`target="_blank"`+`rel="noopener"` only for Instagram, replace the fake newsletter state machine with `<NewsletterForm variant="inline" />`, **demote the red `severity="error"` fraud Alert** to quiet neutral small print in the legal row (it currently opens the footer on every page, including directly under the payment step), replace the **State Emblem of India** image with a neutral "Made in India" mark (its commercial use is restricted under Indian law and the repo holds no authorisation), pull the brand blurb and support details from `brand.js`/`getSiteSettings()`, and migrate its three `<Grid item>` usages.

**Acceptance:** on `/` the Marquee is fully visible below the AppBar; clicking the search icon opens an overlay and typing "fa" returns matching products; `/search?q=xyz` renders the no-results state with working recovery links; the mobile Drawer at 320px exposes search, cart, wishlist, FAQ and sign-out; every footer link navigates client-side with no `#`; FAQ and Contact Us are reachable from the footer; `grep -n 'href="#/' frontend/src/components/common/Footer.jsx` is empty; the footer newsletter stores a row with consent.

---

### WP-09 — Homepage
**Closes:** LF-02 (home), LF-03, LF-04 (home form), LF-05 (home copy), LF-20, LF-24, LF-25, LF-26 (home), LF-30 (home copy), LF-22 (testimonials).
**Depends on:** WP-07; §2a; §2b #2, #7, #9, #13, #33, #36; §2d; §2e.

**Owns:** `frontend/src/pages/Home.jsx` and **all** of `frontend/src/components/home/`: `Hero.jsx`, `Marquee.jsx`, `CircularProductSlider.jsx`, `FeaturedProducts.jsx`, `ProductCategories.jsx`, `ShopByConcern.jsx`, `Benefits.jsx`, `CustomerTestimonials.jsx`, `NewsletterSignup.jsx`, plus new `CampaignSlot.jsx`; **delete** `NewYearBanner.jsx` and `InstagramFeed.jsx`.

**What to do:** `Home.jsx` — remove `// Force rebuild` and the indecisive comment; render `Marquee, Hero, ProductCategories, ShopByConcern, FeaturedProducts, CampaignSlot, Benefits, CustomerTestimonials, NewsletterSignup` — **category and concern discovery directly under the Hero**, so a product group is one click away (LF-24); add `SeoHead` with the home title/description/canonical and `Organization`+`WebSite` JSON-LD. `Hero.jsx` — **render a real primary CTA** `<Button component={Link} to="/products">Shop Skincare</Button>` (44px min height) plus a secondary, sitting directly under the subtitle so it clears the first viewport on a 667px phone; delete the commented block; take the headline and subhead from `brand.js` (§4 safe default, so "India's First" and "No fuss, just results" go). `ProductCategories.jsx` — drive tiles from `listCategories()`, render **only** categories with `product_count > 0`, use the admin `image` with a brand fallback (the three Unsplash URLs go), link by real slug (the hardcoded `body-care` is wrong — the real Category slug is `body-lip-care`). `ShopByConcern.jsx` — drive from `listConcerns()`, link `?concern=<slug>`, delete the dead `requestAnimationFrame` effect and the unused `scrollRef`/`isPaused`; **no invented concerns**. `FeaturedProducts.jsx` — call `getFeaturedProducts({limit:3, include_out_of_stock:false})`, stop slicing client-side, add 3 card skeletons and an `ErrorState` with Retry (today an outage and an empty catalogue both `return null`), and honest section copy. `CircularProductSlider.jsx` — same curated source, loading/error/empty states, price + stock label, a heading and a "View all" affordance, scroll-snap with desktop arrow buttons; delete the unused `IconButton`/`ArrowForwardIcon` imports. `CampaignSlot.jsx` — render `listHomeSections()` filtered to `kind in ('campaign','editorial')`, falling back to an evergreen editorial block; this is what replaces the always-on "NEW YEAR, NEW YOU." block. `Benefits.jsx`/`Marquee.jsx` — source from `claims.js`, render only `substantiated` claims, add `prefers-reduced-motion`, delete the unused `isPaused`. `CustomerTestimonials.jsx` — `listTopReviews({limit:3, min_rating:4})`; show the product name linked; render a "Verified Buyer" chip **only** when `is_verified_purchase`; **do not render the section at all** when there are no real reviews; delete the three fabricated people (one of whom is literally titled "Verified Buyer"). `NewsletterSignup.jsx` — becomes a thin wrapper around `<NewsletterForm variant="hero" />`; delete the `setTimeout` and the "Le foyeR.." typo. Migrate all `<Grid item>` in these files.

**Acceptance:** at 320px and at 1440px a "Shop Skincare" button is visible without scrolling; the category grid shows only categories with sellable products and every tile lands on a filtered listing (not the full catalogue); every concern card lands on a filtered listing; "Curated Essentials" shows exactly 3 sellable products in `display_order` and shows skeletons then an error-with-Retry when the API is stopped; no "New Year" string remains (`grep -rni "new year" frontend/src` empty); the testimonial section is absent on a seeded DB with no reviews; the homepage newsletter stores a row and refuses `a@b`; `grep -rn "unsplash" frontend/src/components/home/` is empty.

---

### WP-10 — Discovery and PDP
**Closes:** LF-01 (frontend), LF-02 (cards/PDP), LF-07, LF-08 (frontend), LF-09 (listing), LF-10, LF-11 (PDP), LF-12 (PDP panel), LF-21, LF-22 (PDP), LF-23, LF-26 (listing/PDP).
**Depends on:** WP-07; §2a; §2b #1, #4, #5, #6, #7, #10, #11, #12, #26, #38; §2d; §2e.

**Owns:** `frontend/src/pages/ProductListing.jsx`, `frontend/src/pages/ProductDetail.jsx`, `frontend/src/pages/Wishlist.jsx`, and all of `frontend/src/components/product/`: `ProductCard.jsx`, `ProductFilter.jsx`, `ProductReviews.jsx`, `RelatedProducts.jsx`, `ProductPagination.jsx`, `ProductViewToggle.jsx`.

**What to do:** `ProductListing.jsx` — **the URL becomes the single source of truth**: derive filters/ordering/page from `useSearchParams`, write back with `setSearchParams` (replace for filter tweaks, push for pages), use **slugs** not numeric ids so URLs stay shareable and indexable, read `search` from the URL, add explicit `status` state (`loading|error|empty|ready`) with skeleton cards, a distinct error panel with Retry, and **three separate empty copies** (no results for a search / no results for these filters + Clear all / genuinely empty category) — today a backend outage reads as "No products found. Try adjusting your filters"; show `count` as the total instead of `products.length` (which is the page size); derive `totalPages` from `count` and the real page size instead of a hardcoded `/10`; surface an explicit "filter not found" fallback for an unknown slug instead of silently showing the full catalogue; add `SeoHead` + `BreadcrumbList`/`CollectionPage` JSON-LD. `ProductFilter.jsx` — **full rewrite**: Category, Sub-category (dependent), Concern, Skin type, "In stock only", Price range, Sort — each individually removable, with Clear all, driven by props from `ProductListing` (which already fetches the real taxonomy); repoint off mockApi; works identically in the desktop sidebar and the mobile Drawer. `ProductCard.jsx` — make Quick Add and the wishlist heart **permanently visible** under `(hover: none)`/below `md` via `useMediaQuery`, keeping the hover reveal as a desktop-only enhancement; **move the action controls out of the `<Link>` wrapper** so a tap cannot be swallowed by navigation; **wire the wishlist heart to `useWishlist()`** (its `onClick` is an empty placeholder today) with an optimistic state, `aria-label`, and a redirect-to-login-with-return for guests; fix the OOS-overlay z-index so the heart stays usable; replace the hidden Quick Add on OOS/coming-soon with **"Notify me"** → `NotifyMeDialog`; read availability only from §2d; read stars only from `review_summary` and render "Be the first to review" at `count === 0`; implement the `view` prop (`ProductListing` passes it and the component ignores it) or have WP-10 remove the toggle; drop the silent `category?.name || 'Skincare'` fallback. `ProductDetail.jsx` — `flexDirection:{xs:'column',md:'row'}` and `width:{xs:'100%',md:'50%'}` (it is hard-forced to two 50% columns at *every* breakpoint, which is why the name shrinks to 1rem on a phone); drop the xs font shrinking; swipeable full-width gallery on mobile showing all available images, not `slice(0,4)` of ten; **sticky bottom add-to-cart bar on xs**; re-tier the buy box per LF-21 (benefit → suitability → price+savings → availability → **Add to Cart as the visual primary** → trust/proof row linking to reviews → delivery/pincode); move every hardcoded Amazon hex (`#FF9900`, `#B12704`, `#F0F2F2`) onto the theme palette and **demote "Buy on Amazon" below the fold**; add `<PincodeCheck />` under the delivery line (the page currently *tells* the shopper to "Enter your postal code" next to no input) and drive the COD badge off `cod_available` instead of asserting it unconditionally; **split the grey box into labelled Delivery and Returns blocks** sourced from `policy.js`, which removes the PDP's "Free 30 Days Delivery Returns" vs the policy page's 7 days; keep the existing (correct) availability logic and unify the two low-stock thresholds into one; loading skeleton, a 404 "no longer available" page, and an error-with-Retry instead of the permanent "Loading…"; `SeoHead` + **Product JSON-LD** — `name, image (absolute), description, sku, brand, offers{price:effectivePrice, priceCurrency:'INR', availability derived from the SAME in_stock the page renders, url}`, and `aggregateRating` **only when `review_summary.count > 0`**; fire `ViewContent`; store benefits as structured rows instead of comma-splitting `key_benefits` prose. `ProductReviews.jsx` — repoint to the real nested endpoint; **render the average and histogram from `review_summary`, never computed client-side**; `author.display_name`; "Verified Buyer" chip only on `is_verified_purchase`; surface real server validation errors and show success only on a `201`, stating truthfully whether the review is published or pending moderation. `RelatedProducts.jsx` — `getRelatedProducts(product.slug)` from the real api, loading/empty states instead of `return null`. `Wishlist.jsx` — render real nested products, use the corrected context, remove the unused snackbar state and the unused `removeFromWishlist` destructure, and replace `'Playfair Display'` with the theme face. Migrate all `<Grid item>` in these files.

**Acceptance:** `/products?category=skincare&in_stock=true&ordering=price&page=2` round-trips through a refresh and through browser Back; every filter is individually removable and Clear all empties the URL; at 320px the filter Drawer opens, Quick Add and the wishlist heart are visible **without hover**, and tapping the heart adds to the wishlist; stopping the API shows an error-with-Retry, not "No products found"; the PDP stacks to one column at 375px with a sticky buy bar; entering a 6-digit pincode returns a real serviceability result and the COD badge follows it; the PDP's Returns block matches `/shipping-returns` word for word; the PDP rating, the review-block average and the JSON-LD `aggregateRating` are the same number, and `aggregateRating` is absent for a product with no reviews; the emitted JSON-LD validates (§5); an OOS card offers "Notify me" and the email is stored; `grep -rn "mockApi" frontend/src/components/product/` is empty.

---

### WP-11 — Cart, checkout, payment and order pages
**Closes:** LF-14 (frontend), LF-15 (frontend), LF-16 (frontend), LF-17 (Purchase), LF-26 (cart/checkout), LF-27, LF-28.
**Depends on:** WP-07; §2a; §2b #14–#25, #38; §2f; §2g.

**Owns:** `frontend/src/pages/Cart.jsx`, `frontend/src/pages/Checkout.jsx`, `frontend/src/pages/OrderConfirmation.jsx`, `frontend/src/pages/OrderDetail.jsx`, `frontend/src/pages/Profile.jsx`, `frontend/src/pages/Orders.jsx` (new), `frontend/src/components/order/OrderCard.jsx`, `frontend/src/components/order/OrderTimeline.jsx`, `frontend/src/components/order/PaymentCompletionDialog.jsx`, new `frontend/src/components/cart/CartLine.jsx`, `frontend/src/components/cart/CartTotals.jsx`, `frontend/src/components/cart/CrossSell.jsx`.

**What to do:** `Cart.jsx` — **full rewrite** on `getCartSummary()`: skeleton while `!initialised` (the current empty state flashes "Your Cart is Empty" on every load), an inline Alert with Retry on error, per-row spinners, server-computed effective prices (today it prices from `item.price`, the list price, while the backend charges `discount_price` — the displayed total can differ from the amount charged), a **coupon field** with server-validated discount, a real shipping line from `policy.js` with a free-shipping threshold and a "spend ₹X more" nudge, a `<PincodeCheck />` delivery estimate, one compact reassurance strip linking to the real shipping/returns policy and FAQ, a single 3-item `CrossSell`, disabled rows for lines that are no longer sellable; delete the `Size: {item.size}` line (no such field) and the bare "Secure Checkout - SSL Encrypted" caption. `Checkout.jsx` — **full rewrite**: `handleApplyCoupon` calls `validateCoupon({code, subtotal})` and renders an explicit `Discount (CODE) −₹X` row in **both** the review block and the Order Summary, recomputing the displayed total (today it is a placebo that always reports success and never changes the total — the developer's abandoned reasoning is shipped in the comments); per-field validation with inline `helperText` (email, 10-digit phone, 6-digit pincode) plus `autoComplete` and prefill from the profile and last order; a serviceability check on a valid pincode that blocks the order or hides COD when not serviceable; **`placing` state** with `disabled` + spinner + an `Idempotency-Key` generated once per checkout session (a double-click currently creates two orders); **remove `clearCart()` from both branches** and the unreachable `'card'` arm; move the empty-cart guard out of the render body into a `<Navigate>` element so it cannot race the success navigation; navigate to `/order-confirmation/:id` on COD; fire `InitiateCheckout`; show a persistent Alert plus the created order number and a retry action if `initiate-payment` fails after the order exists. `OrderConfirmation.jsx` — **keep its good six-state machine** and drive it entirely from `getPaymentStatus(id)` taken from the **route param**; delete the `status || 'success'` default and the whole `code`-query-param branch; poll while PENDING (5 attempts / ~30s) then show a terminal "we'll email you"; clear the cart only after a verified COMPLETED; **fire `Purchase` exactly once** per §2g then `markPurchaseTracked`; give every state real actions — Retry payment, Restore my cart (`restoreCartFromOrder`), View order, Contact support — and show the order number in all of them; correct the false "Your order has not been placed" copy. `OrderDetail.jsx` — read the corrected `shipping_*` fields, the derived `status`, rupee `discount_amount` (not a percent printed as currency), and open `shipment.tracking_url` with `window.open` instead of handing an `/api/` path to `navigate()`. `OrderTimeline.jsx` — add the **error branch** (FAILED/CANCELLED render the Payment step with `error` + an explanation + Retry and the timeline stops there — today a failed order looks like a healthy in-progress one) and rewrite the inert legacy-JSS `ColorlibConnector` with MUI v7 `stepConnectorClasses` selectors. `OrderCard.jsx` — same `status`/tracking fixes. `PaymentCompletionDialog.jsx` — point at the unified retry action, re-validate stock, and warn when switching a previously-FAILED order to COD. `Profile.jsx` — add an error state, link to the new `/orders` list (today page 1 of 10 is the only reachable order history and it is the **only** path to payment recovery), add email-verification status and a support link. `Orders.jsx` — paginated order history exposing the retry flow. Migrate all `<Grid item>` in these files.

**Acceptance:** abandoning the PhonePe page and pressing Back leaves the cart **intact** and `stock_quantity` unchanged; the confirmation page shows success only after a server-verified COMPLETED, and hand-crafting `?code=PAYMENT_SUCCESS` shows the real state instead; a FAILED order's page offers Retry payment and Restore my cart, and Restore repopulates the cart; applying a real coupon changes the displayed total by exactly the amount the server then charges, and an invalid code shows the server's reason; a double-click on Place Order creates one order; exactly one `Purchase` fires per paid order and a refresh fires none (verified in the Pixel Helper / network tab); no `Purchase` fires for a failed payment; the order page's Shipping Address card is populated; a failed order's timeline shows a red Payment step; Cart and Checkout show skeletons then an error-with-Retry when the API is stopped.

---

### WP-12 — Auth pages, static content, support
**Closes:** LF-05 (page copy), LF-12 (policy pages), LF-13 (frontend), LF-29, LF-30, LF-31 (frontend).
**Depends on:** WP-07; §2a; §2b #27–#32, #34, #35, #37; §4.

**Owns:** `frontend/src/pages/Login.jsx`, `SignUp.jsx`, `VerifyEmail.jsx`, `ForgotPassword.jsx` (new), `ResetPassword.jsx` (new), `About.jsx`, `FAQ.jsx`, `ShippingPolicy.jsx`, `TermsAndConditions.jsx`, `PrivacyPolicy.jsx`, `NotFound.jsx`, `Contact.jsx` (new), and new `frontend/src/components/auth/CheckYourInbox.jsx`.

**What to do:** `Login.jsx` — `const from = location.state?.from?.pathname + (location.state?.from?.search || '')` then `navigate(from || '/', {replace:true})` — this single change is LF-13's frontend half; either use the "Remember me" checkbox or delete it; pass `from` through the Login↔SignUp links; replace the `/forgot-password` dead link with the real route. `SignUp.jsx` — collect `first_name`/`last_name` (the serializer accepts them and the form never sends them, which is why reviewer display names need a fallback), send `terms_accepted` and a separate unchecked `marketing_consent`, surface `password` field errors, and replace the inline green Alert with `<CheckYourInbox />`: the submitted address echoed, a **Resend** button with a 60s cooldown and attempt counter, an "Edit email address" link, a check-spam note, a support link, and an honest warning instead of a success message when the API reports `verification_email_sent:false`. `VerifyEmail.jsx` — branch on the server `code`: `verified` → success + Continue; `already_verified` → route to `/login` with an info banner; `invalid_token`/`token_expired` → an email field + **"Send me a new link"** + "Back to sign in" + support. **Delete the "Sign Up Again" button** — it is a hard dead end, since the account already exists and `validate_email` rejects it. `ForgotPassword.jsx`/`ResetPassword.jsx` — new, wired to the two existing backend endpoints that no page has ever called; always show the same neutral message. `About.jsx` — one approved positioning line from `brand.js`, delete the "Curating… natural beauty products" retailer framing that contradicts "we are a modern cosmetic company", keep the hearth/ritual territory, add the §4 functional differentiator, and **fix the broken layout**: the "Welcome to the Hearth" `Grid container` has a single `md={6}` child, so half the row is empty. `FAQ.jsx` — rewrite from `policy.js`/`getPolicy()`; delete "100% natural", "fully recyclable" and the expedited-shipping sentence (no such option exists — Checkout offers only UPI and COD); add grouping and a support CTA. `ShippingPolicy.jsx` — rewrite as three clearly separated **Delivery / Returns / Refunds** sections from the same `policy.js`, with charges, thresholds, window start point, conditions, exclusions and the how-to-initiate steps; fix the broken refund sentence. `Terms`/`Privacy` — replace `https://lefoyer.com` with `lefoyerglobal.com`, replace `new Date().toLocaleDateString()` with a hardcoded real "Last updated" constant per document (an always-today date on a legal page is a fabricated freshness signal), move the support address off gmail, add a grievance-officer block, and either build account deletion or change the Privacy wording to a written-request process (it promises a control `Profile.jsx` does not have). **The entity-name conflict is a §4 decision — flag it in the code with a `TODO(business)` and ship the current name unchanged rather than guessing.** `Contact.jsx` — new, from `getSiteSettings()` + `submitSupportRequest()`. `NotFound.jsx` — theme tokens instead of hardcoded hex, plus search/FAQ/support recovery links. Delete every `'Playfair Display'` inline override in these files. Migrate all `<Grid item>`.

**Acceptance:** guest → add to cart → Proceed to Checkout → login → **lands back on `/checkout` with the cart intact**; signup shows a Check-your-inbox screen with the address echoed and a working Resend on a 60s cooldown; clicking a verification link twice gives success then "already verified → sign in", never "Verification Failed"; an expired token offers an inline resend; `/forgot-password` and a reset link both work end to end; `grep -rni "100% natural\|India's First\|Clinically Tested" frontend/src` is empty; the return window on the PDP, in the cart, in the FAQ and on `/shipping-returns` is the same number; `grep -rn "lefoyer.com" frontend/src` is empty; FAQ and Contact are reachable from the footer and from the cart, checkout and order-confirmation pages.

---

## 4. Content decisions needing a human

These four are commercial decisions. For each: what the code asserts today, the **safe default we ship now** (claiming only what the repo can prove), and the exact question for the business owner. The safe defaults are seeded by WP-01's `content` data migration and mirrored in WP-07's `brand.js` / `claims.js` / `policy.js` fallbacks, so the site is shippable the moment the packages land and a single admin edit flips a claim back on once evidence arrives.

### LF-05 — Claims audit

**Currently asserted, verbatim and sourced:** `Hero.jsx:34` "India's First" + "Luxury Family Skincare"; `Hero.jsx:46` "Nature meets modern science… No fuss, just results."; `Marquee.jsx:12-15` "Clinically Tested / Botanical Actives / Cruelty Free / Made in India"; `Benefits.jsx:13-14` "Dermatologically Tested — Rigorously tested for safety and **efficacy** by certified dermatologists"; `Benefits.jsx:18` "All Skin Types"; `Benefits.jsx:23` "Cruelty-Free"; `Benefits.jsx:81` "the highest quality in natural beauty care… radiant results"; `Benefits.jsx:9` "natural-**inspired** ingredients" vs `FAQ.jsx:9` "**100% natural** ingredients" (a direct self-contradiction); `FAQ.jsx:25` "fully recyclable"; `About.jsx:189` "Derma-tested… pigmentation, dryness, and sun damage"; `About.jsx:194` "suitable for all skin and hair types"; `seed_products.py` "SPF 30 UV protection", "SPF 50+ broad-spectrum… UVA, UVB and blue light", "24-hour moisture lock (lasts up to 48 hours)", "water and sweat-resistant", "non-comedogenic", "Advanced Whitening Complex", "promotes thicker, fuller hair"; `Footer.jsx:184` the **State Emblem of India** used as a trust badge. **The repo contains zero substantiation documents.** "India's First" appears exactly once in the whole codebase and is never explained or qualified.

**Ship now (safe default):**
- **Keep, unchanged:** "Made in India", "Cruelty Free" (ownable, verifiable by the brand's own practice).
- **Soften:** "Dermatologically Tested" → **"Dermatologist-tested formulations"** with the word *efficacy* removed (a safety patch test is a plausible, cheap-to-evidence claim; an efficacy study is not).
- **Keep as an ingredient claim, not a purity claim:** "Botanical Actives".
- **Delete entirely until evidenced:** "India's First", "Clinically Tested", "100% natural", "fully recyclable", "All Skin Types" as a site-wide promise, "highest quality", "radiant results", "No fuss, just results".
- **Replace "All Skin Types"** with per-product suitability rendered from `Product.suitable_for` / the new `skin_types` M2M, so the page states what each SKU actually claims.
- **SPF and water-resistance numbers stay on the products that carry them** (they are formulation facts on the label, not marketing superlatives) but every one is marked `is_substantiated: false` in the `Claim` table until a test report is attached, and WP-01's admin shows ops exactly which are unevidenced.
- **Replacement Hero copy we will ship:** headline **"Skincare that feels like coming home."** / subhead **"Made in India. Dermatologist-tested formulations for the whole family — one shelf, every skin."** This keeps the hearth/family territory, adds a functional differentiator the code can support, and asserts nothing unprovable.
- **Replace the State Emblem** with a plain "Made in India" typographic mark.

**Decision required:** for each of **India's First**, **Clinically Tested**, **Dermatologically Tested**, **All Skin Types**, **100% natural**, **fully recyclable**, and each **SPF / water-resistance / hair-growth** claim — supply the named certificate, lab report or test number, or confirm deletion. Each surviving claim needs a one-line footnote naming its evidence, which the `Claim` model renders on the page.

### LF-12 — Delivery and returns policy

**Currently asserted — five mutually contradictory versions, all verified:** `ShippingPolicy.jsx` delivery **3-7 days**, returns **7 days from delivery**, refunds 10 days (with broken grammar: "we will initiate and credited the refund"); `FAQ.jsx` free shipping over **₹5000**, **3-5 business days**, returns **30 days from purchase** "provided the product is gently used", plus expedited shipping "available at checkout" (**no such option exists** — the RadioGroup offers UPI and COD only); `ProductDetail.jsx` "Free Delivery" unconditional and "Free **30 Days** Delivery Returns"; `Cart.jsx` Shipping = **Free**; the now-deleted `CartSummary.jsx` `estimatedShipping = 50 // Static for now`; `OrderDetail.jsx` `const shipping = 0; // Add shipping logic if needed`. The backend charges **nothing** — shipping never appears in `orders/views.py`'s arithmetic. There is no `ShippingRate` model, no policy constant and no settings entry, so **the true policy is not recoverable from this repo.**

**Ship now (safe default), seeded into `content.PolicySetting` and `policy.js`:**
```
delivery_window_days   = [3, 7]        # the ShippingPolicy page is the most policy-shaped source
free_shipping_threshold = null          # i.e. "Free standard delivery on all orders"
shipping_charge        = 0              # matches what the backend actually charges
return_window_days     = 7
return_window_from     = 'delivery'
refund_days            = 10
return_exclusions      = ['opened or used personal-care products', 'items without original packaging']
cod_available           = per-pincode, from check-serviceability
```
We ship the **narrowest** of the conflicting promises (7 days, not 30) and the one that matches the code (free shipping, ₹0 charge), because under-promising is recoverable and over-promising is a chargeback. Replacement copy: PDP Delivery block **"Free standard delivery · 3-7 days · enter your pincode for an exact date"**; PDP Returns block **"7-day returns from delivery. Unopened items in original packaging. Refunds in 10 days."** — both linking to `/shipping-returns`. The expedited-shipping sentence is deleted outright.

**Decision required:** confirm or correct, as a single set, the **return window and its start point**, the **free-shipping threshold and standard charge**, the **delivery window**, the **refund timeline**, and the **non-returnable categories**. Do **not** pick one of the five existing variants by guesswork.

### LF-18 — D2C vs marketplace

**Currently asserted:** `ProductDetail.jsx` renders a full-width **"Buy on Amazon"** button *above the fold inside the D2C buy box*, styled in Amazon's own palette (`#FF9900` Buy Now, `#B12704` price, `#F0F2F2` delivery panel) on a brand whose accent is `#C9A96E` — so the page actively diverts traffic to the marketplace the requirement says undercuts it. There is **no** statement anywhere of a D2C advantage. The repo holds no marketplace price data, so the price gap cannot be measured from code.

**Ship now (safe default):** keep `amazon_link` in the data, but **move the Amazon button out of the buy box to a quiet text link below the tabs**, labelled "Also available on Amazon". Make Add to Cart the visual primary and Buy Now secondary, both on the brand palette. Beside the Amazon link, state only what we can prove from the code we are shipping: **"Order here for the full range, 7-day returns handled directly by us, and pincode-accurate delivery dates."** No price-match or lowest-price claim — we cannot verify one.

**Decision required:** either (a) align marketplace prices to D2C, or (b) approve a concrete D2C benefit we can honour and state — the realistic candidates are a first-order discount code, free samples, loyalty points, or an extended return window. Until (b) is approved, no price-advantage language ships.

### LF-19 — Approved product master

**Currently asserted — two files that disagree (C-10):** `seed_products.py` has `LF-SK-CL01 = ₹349.00` and `LF-SK-CL02 = ₹399.00` and marks **six** products `is_featured`; `latest_products.json` has both SKUs at **₹280.00**, marks **two** featured, and sets `show_at_website: false` on **8 of 10** products. All 10 rows in the fixture carry `rating: 0.00 / reviews_count: 0`. Neither file is the live database, which is not available locally.

**Ship now (safe default):** **the live database is authoritative; neither file is.** No price, no `is_featured` flag and no `show_at_website` value is written by any package in this change-set. `seed_products.py` becomes `--force`-guarded, `update_or_create`-based and documented as dev-only (WP-01), and `OrderItem.product` moves to `PROTECT` with name/SKU snapshots so a catalogue edit can never cascade away order history. Every homepage and listing module renders from the live annotated API with `product_count > 0` as a hard condition, so **if production really has two visible SKUs the UI collapses gracefully instead of shipping broken category links**. `rating`/`reviews_count` stop being served at all (§2e), so the zeros cannot surface as a zero-star product.

**Decision required:** supply the approved master — for each of the 10 SKUs, the **selling price**, the **`show_at_website` flag** (is the catalogue genuinely 2 products or 10?), the **`is_featured`/`is_bestseller`/`display_order`** merchandising intent, and the **approved description / benefits / ingredients / suitability** text that must match the marketplaces. Until that arrives, the implementers must not edit production product rows.

Three further items are commercial, not code, and must be flagged in-code as `TODO(business)` rather than guessed: the **legal entity** (`TermsAndConditions.jsx:34` says "Le Foyer Global, incorporated under the Companies Act, **1956**" — an Act replaced in 2013 — while `:101` gives contact details for **"SITE COBALLO PRIVATE LIMITED"** with a **gmail.com** support address); the **support contact set** (email, phone, WhatsApp, hours — none exist anywhere customer-facing); and **authorisation to use the State Emblem of India**, whose commercial use is restricted under Indian law. The safe default ships a branded `support@lefoyerglobal.com` (the value already configured as `EMAIL_HOST_USER`), no phone number, and no emblem.

---

## 5. Verification plan

There is no test suite, the production database is unavailable locally, and PhonePe / Blue Dart / SMTP credentials live in a server-side `.env`. The honest division is below. **Nothing in the "staging only" column may be reported as done on the basis of local work.**

### 5.0 The local harness every package relies on

Build it once, as part of WP-01: `DEBUG=True` + SQLite + `python manage.py migrate` + `python manage.py seed_products --force` + `CELERY_TASK_ALWAYS_EAGER=True` + console `EMAIL_BACKEND`. That makes signup, verification, review creation, coupon validation, cart, order creation and the COD path fully exercisable with no external credentials. Add two throwaway dev-only management commands (not shipped as tests, just operator tools): `fake_payment_success <order_id>` and `fake_payment_failed <order_id>`, which call `orders.services.confirm_order`/`fail_order` directly. **These exercise our state machine, not PhonePe's** — that distinction must be stated in every status report.

Minimum gates on every package: `python manage.py check`, `python manage.py makemigrations --check --dry-run` (clean — no model drift), `python manage.py migrate` from empty, `cd frontend && npm run build`, `npm run lint` (which now fails on a `mockApi` import, a `<Grid item`, or an `href="#/`).

### 5.1 Provable locally

| LF | How it is demonstrated |
|---|---|
| LF-01 | Seed 3 reviews via the API; screenshot the PDP hero stars, the review-block average and the `aggregateRating` in View-Source showing the **same** number; delete one review and show all three drop together; show `rating`/`reviews_count` are absent from the `/products/<slug>/` JSON and read-only in admin; show a zero-review product renders "Be the first to review" and emits **no** `aggregateRating`. |
| LF-02 | Set `manual_out_of_stock=True` on a product: it serialises `in_stock:false, available_quantity:0`, drops out of `?in_stock=true`, sorts last in `featured/`, its card shows "Notify me" instead of Quick Add, `POST /api/cart/add/` for it returns `400`, and the notify email lands in the `StockNotification` table. |
| LF-03 | Screenshots at 320 / 375 / 768 / 1440 showing a working "Shop Skincare" CTA above the fold, and the Marquee no longer hidden by the AppBar. |
| LF-04 | `POST /api/newsletter/subscribe/` from both the home and footer forms creates a `Subscriber` row with a consent timestamp; `a@b` is rejected; a repeat returns `already_subscribed`; the 11th attempt returns `429`; both forms are the same component. |
| LF-05 | `grep -rni "India's First\|Clinically Tested\|100% natural\|All Skin Types\|fully recyclable" frontend/src` is empty; every rendered claim comes from `claims.js`/`Claim` with `is_substantiated: true`. |
| LF-06 | **Partly.** Locally provable: no `#` in any URL, a unique `<title>`/description/canonical per route in View-Source, deep links work on the dev server, and the legacy-hash shim redirects `/#/verify-email/x` → `/verify-email/x`. **Not provable locally:** that Googlebot sees it — see 5.3. |
| LF-07 | Paste the PDP's rendered `<script type="application/ld+json">` into Google's Rich Results Test and schema.org's validator; confirm `offers.price` equals the visible price, `offers.availability` equals the visible badge, and `aggregateRating` is present **only** when the visible count is > 0. |
| LF-08 | Exercise every facet against seeded data; confirm the URL round-trips through refresh and Back; confirm Clear all empties it; repeat inside the 320px Drawer. |
| LF-09 | `?search=serum` returns a strict subset (not the catalogue); the overlay opens from the icon and from `/`; `/search?q=zzz` shows the no-results state with working recovery links; repeat at 320px. |
| LF-10 | `grep -rn "mockApi\|mockData" frontend/src` empty; the files are deleted; `npm run lint` fails if reintroduced. |
| LF-11 | **Partly.** With `BLUEDART_DEMO_MODE=True` the PDP/cart/checkout pincode widget renders loading → result → error; the 503 path can be forced by pointing the WSDL at an unreachable host, proving the "temporarily unavailable, you can still order" copy. **Real serviceability data: staging only.** |
| LF-12 | One grep proves one number: `grep -rn "RETURN_WINDOW_DAYS\|return_window_days" frontend/src` shows every surface reading the same constant; screenshot the PDP, cart, FAQ and `/shipping-returns` side by side. |
| LF-13 | Walk it: guest adds to cart → Proceed to Checkout → `/login` → sign in → **lands on `/checkout`** with the cart intact. Repeat for `/wishlist` and `/profile`. |
| LF-14 | With `fake_payment_*`: `POST /api/orders/` leaves `GET /api/cart/` populated and `stock_quantity` unchanged; the browser Back button from a stubbed gateway page shows an intact cart; `fail_order` then `restore-from-order` rebuilds nothing because nothing was lost. |
| LF-15 | **Our half only.** Hand-craft `/order-confirmation/5?code=PAYMENT_SUCCESS` on an unpaid order and show the page reports PENDING/FAILED from the server, not success. Point `get_order_status` at an unreachable host and show `503` with `payment_status:'PENDING'` and the honest message. **The real PhonePe status call: staging only.** |
| LF-16 | Seed a PERCENT coupon, a FIXED coupon, an expired one, an exhausted one and one with a `min_order_amount`; show `validate/` as a **guest** returns the exact `discount_amount` and `final_total` for each, and that `POST /api/orders/` charges **the same number**; show each invalid reason renders the server's message. |
| LF-17 | With the Pixel Helper and the network tab: one `PageView` per route change; `ViewContent` on a PDP; `AddToCart`; `InitiateCheckout`; after `fake_payment_success`, exactly one `Purchase` with the right `value`/`currency`/`content_ids` and `eventID=order-<id>`; refresh and a second tab fire none; `fake_payment_failed` fires none. |
| LF-19 | `seed_products --force` without the flag refuses; `OrderItem.product` is `PROTECT` and deleting a reviewed, ordered product is blocked. **The approved master itself: §4.** |
| LF-20 | Change `display_order` in admin and show the homepage rail reorders with no deploy; set a featured product OOS and show it moves last or disappears per `include_out_of_stock`. |
| LF-21 | Annotated PDP screenshots at 375 and 1440 showing the benefit → suitability → price → availability → Add to Cart → proof → delivery order, the sticky mobile buy bar, no Amazon hex, and "Buy on Amazon" below the fold. |
| LF-22 | A review from a user with a COMPLETED order shows the chip; one from a user with no order shows none; the homepage testimonial section is **absent** on a DB with no reviews. |
| LF-23 | A full 320px pass over home, listing, filter Drawer, PDP, cart, checkout, order pages: every action reachable by tap, no hover-only control (verified with DevTools touch emulation **and** by disabling hover via `(hover: none)`), no horizontal page scroll. |
| LF-24 | On seeded data the category and concern grids render only groups with `product_count > 0` and every tile lands on a filtered listing; with the 2-visible-SKU fixture loaded, the grid collapses instead of showing dead links; `grep -rn "anti-aging\|night-repair" frontend/src backend` is empty. |
| LF-25 | `grep -rni "new year" frontend/src` empty; create a `HomeSection` with `ends_at` yesterday and show it does not render; move `ends_at` to tomorrow and show it does. |
| LF-26 | Stop the API and screenshot home rails, listing, PDP, cart, checkout and order pages each showing a skeleton then an understandable error with Retry — and **never** "No products found". Throttle the network to show skeletons rather than a false empty cart. |
| LF-27 | Cart screenshot showing subtotal, a server-validated coupon line, a real shipping line with threshold, a pincode-driven ETA, policy reassurance, one 3-item cross-sell, and a disabled row for a product set OOS after it was added. |
| LF-28 | `fake_payment_failed` then `fake_payment_success` then `cancel`: each of COMPLETED / FAILED / CANCELLED / PENDING / EXPIRED shows its own message, the order number, and working Retry / Restore-cart / Support actions; the timeline shows a red Payment step for FAILED. |
| LF-29 | FAQ and Contact reachable from the footer, the navbar, the cart, the checkout, the order confirmation (all five states) and the PDP delivery block; `/contact` submits a `SupportRequest`. |
| LF-30 | One grep shows Hero, Navbar, Footer, About and the email tagline all read the same `brand.js`/`SiteSetting` values; `grep -rn "Curating the finest" frontend/src` is empty. |
| LF-31 | Full local walk with the console email backend: signup → "check your inbox" with the address echoed → copy the link from the console → verify → log in → reach `/checkout`. Then: click the link twice (second = "already verified → sign in"); backdate `email_verification_sent_at` 25h and confirm `token_expired` + inline resend; 4 resends in an hour → `429`; `/forgot-password` → console link → `/reset-password/...` → log in with the new password. |

### 5.2 Verifiable on staging only — stated plainly

- **LF-15 / LF-14 / LF-28, the gateway half.** Everything above exercises *our* state machine via `fake_payment_*`. The actual PhonePe V2 `get_order_status` call, the V2 S2S callback signature, the real `redirect_url` round-trip, and the callback's idempotency under PhonePe's genuine retries **cannot be tested locally** — the SDK is not even installed here (C-4), its version is unpinned, and the credentials are server-side. **Required staging runs, each with the full request/response logged:** (1) a successful sandbox payment end to end, confirming the customer lands on `/order-confirmation/<id>`, the status call returns COMPLETED, stock decrements **once**, the cart clears, one confirmation email sends and one `Purchase` fires; (2) a declined payment, confirming FAILED, an intact cart, no stock movement, no email, no pixel; (3) an abandoned payment (close the tab), confirming the 30-minute sweeper resolves it to CANCELLED/EXPIRED; (4) a **replayed** callback, confirming one email and one stock movement; (5) a retry on a FAILED order, confirming one order and a second `PaymentAttempt`. Until (1)–(5) pass on staging, LF-15 is **not** done, whatever the local screenshots show.
- **LF-11, real data.** Blue Dart credentials default to `''` and `BLUEDART_DEMO_MODE` defaults `True`; the demo finder endpoint is plain HTTP; the WSDL is fetched at runtime, so the `strict=False` boolean-coercion risk (C-10's shipping sibling: a string `'false'` is truthy, which would report **every** pincode serviceable) **can only be confirmed against the live WSDL**. Staging must check one serviceable and one unserviceable pincode and assert both booleans are real booleans.
- **LF-31, real deliverability.** The console backend proves the journey, not that mail arrives. Staging must confirm an actual inbox delivery, that the link has no `/#/`, that `SITE_URL` is the production host (it defaults to `http://localhost:5173`), and that Redis/Celery are genuinely running — the register endpoint's Celery-failure fallback is only meaningful if someone verifies the happy path works too.
- **LF-06, crawlability.** The app is a Vite SPA. `react-helmet-async` sets the title, description, canonical and JSON-LD **at runtime**, which Googlebot does render but which no local check can prove. The honest statement: removing `HashRouter` makes product and category pages *independently addressable*, and the head tags are correct in the live DOM — but **"independently indexable" additionally requires prerendering or SSR plus host-side SPA rewrites, and that is an infrastructure decision this change-set does not make.** The interim deliverables are: host rewrites configured (all paths → `index.html`), a `sitemap.xml` and `robots.txt` generated at build from the live product list, and a `curl` of a product URL recorded so the gap between the served HTML and the rendered DOM is documented rather than papered over. A follow-up prerender step should be scheduled; claiming LF-06 fully closed without it would be overstating.
- **LF-19 / LF-05 / LF-12 / LF-18.** Blocked on §4. Each ships its safe default and is marked **"shipped safe, pending business sign-off"** — not done.
- **Production data truths we cannot see:** which of the 10 SKUs is actually visible, what `suitable_for` strings production really holds (the `0008` migration logs anything outside the six verified strings rather than guessing), how many users were grandfathered to `is_email_verified=True` by `accounts/0002`, and whether duplicate emails exist (WP-04's migration **aborts with a clear message** rather than failing halfway). All four must be checked against the production DB before the migrations are run there, and the `reviews/0002` and `cart/0003` de-dup `RunPython` steps must be dry-run on a production **dump** first.

### 5.3 Release gate

Merge order follows the package order. One deploy, in this sequence: run all migrations on a production dump first and record the de-dup and backfill counts → deploy backend → deploy frontend → **immediately** confirm the host SPA rewrite and the legacy-hash shim, because every verification, reset and order link already in a customer's inbox depends on them → then run the five staging payment scenarios. Commits end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`; the PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.