# Payment Flow — the contract

This replaces the previous version of this file, which documented the opposite
of what the system should do. That version told implementers that the
**frontend decides the payment outcome from the `code` query parameter** PhonePe
appends to the redirect URL, and it pointed at `payment.py line 35` for the
redirect. Both are gone:

- A query parameter is attacker-controlled. Anyone could open
  `/order-confirmation/5?code=PAYMENT_SUCCESS` on an unpaid order and be shown
  "Order Placed Successfully", with the Meta Pixel firing a `Purchase` for money
  that was never taken. **The outcome is now read from the server, always.**
- The `payment.py line 35` pointer was stale. The redirect URL is built in
  `PhonePeGateway.pay()`; see "The redirect contract" below for the rule rather
  than a line number.

Audience: whoever is changing payment code or debugging a stuck order.

---

## 1. Where the rules live

**All state transitions live in exactly one module: `backend/orders/services.py`.**
It has four public functions and nothing else may move an order between states:

| Function | What it owns |
|---|---|
| `create_order()` | creates the `Order`, its `OrderItem`s with a price snapshot, and the first `PaymentAttempt`. Returns the gateway redirect URL in the **same** response. |
| `confirm_order()` | the **only** writer of `COMPLETED`. Decrements stock, clears the cart, sends the confirmation email, queues shipment generation. |
| `fail_order(reason)` | the only writer of `FAILED`. |
| `cancel_order(reason)` | the only writer of `CANCELLED`. |

Each one:

- runs inside `transaction.atomic()` with `Order.objects.select_for_update().get(pk=…)`;
- is a **no-op when the order is already in a terminal state**, so a replayed
  callback cannot do the work twice;
- is the sole owner of stock movement, cart clearing, coupon release, the
  confirmation email and the purchase-tracking flag.

`complete_payment`, the initiate-payment action and the callback view all funnel
into these. They do not write `payment_status` themselves.

---

## 2. The states

| State | How it is entered | Who may enter it | What the customer sees | Recovery actions offered |
|---|---|---|---|---|
| `PENDING` | `POST /api/orders/` for a PREPAID order | `create_order()` only | "Order `LF000123` created — completing payment." The confirmation page polls `GET /api/orders/<id>/payment-status/` up to 5 times over ~30s. | Retry payment · Restore my cart · Contact support |
| `COMPLETED` | `confirm_order()` only, called from (a) the V2 S2S callback **after it has re-verified with a status query**, (b) `GET payment-status/`, (c) `create_order()` directly for COD, (d) the PENDING sweeper | `confirm_order()` only | "Order placed successfully", the order number, and the itemised subtotal / discount / shipping / total | View order · Continue shopping · FAQ / support |
| `FAILED` | `fail_order()`, from a callback reporting failure or from a status lookup returning FAILED | `fail_order()` only | "Payment failed. Order `LF000123` is awaiting payment — you have **not** been charged. Your cart is still here." | Retry payment (same order, new `PaymentAttempt`) · Restore my cart · Contact support with the order ref |
| `CANCELLED` | `cancel_order()`, from (a) `POST /api/orders/<id>/cancel/` by the customer, (b) the gateway reporting a user-cancelled payment, (c) the sweeper after the PENDING TTL | `cancel_order()` only | "Payment cancelled. Order `LF000123` was not completed. Nothing has been charged." | Retry payment · Restore my cart · Contact support |
| `EXPIRED` | the Celery beat sweeper, for orders `PENDING` longer than 30 minutes whose gateway status is still `PENDING` or unknown | sweeper only | "We could not confirm this payment. If you were charged we will refund it automatically — reference `LF000123`." | Contact support (prominent) · Restore my cart |
| `REFUNDED` | admin / ops only | admin | "Refunded" on the order page | — |

`PENDING`, `COMPLETED` and `FAILED` already existed. `CANCELLED`, `EXPIRED` and
`REFUNDED` are new. Before them, a cancelled or timed-out payment was never even
marked `FAILED`: it sat at `PENDING` forever and its stock was never restored.

---

## 3. Stock, the cart, and why this ordering is safe

- **Stock is decremented exactly once, inside `confirm_order()`**, as a
  conditional update per line:
  `Product.objects.filter(pk=…, stock_quantity__gte=qty).update(stock_quantity=F('stock_quantity') - qty)`,
  guarded by the `Order.stock_decremented` flag so a replayed callback cannot
  double-decrement.
- **Stock is restored exactly once, inside `fail_order()` / `cancel_order()`**,
  guarded by `Order.stock_restored` and only when `stock_decremented` is true.
  On the ordinary prepaid-failure path it is a **no-op**, because nothing was
  ever taken. This is the point: the old code called a restore helper on every
  `PAYMENT_ERROR` and so **inflated inventory** on a retried callback.
- **The cart is cleared exactly once, inside `confirm_order()`**, and
  `cart_cleared_at` is stamped. `POST /api/orders/` no longer deletes the cart,
  and the checkout page no longer calls `clearCart()` before redirecting. A
  customer who abandons the PhonePe page comes back to an intact cart with
  nothing to rebuild.
- **The confirmation email is sent only from `confirm_order()`**, gated on
  `confirmation_email_sent_at IS NULL`. A PREPAID order sends nothing at
  creation (or, at most, an explicit "order received — completing payment").
  The money block prints the stored `subtotal` / `discount_amount` /
  `shipping_amount` / `total` **verbatim, with no arithmetic** — the old email
  recomputed a percentage off an already-net total and so showed the customer
  less than was charged.
- **Shipment generation is not a signal.** The `post_save` receiver on `Order`
  is gone; `confirm_order()` calls
  `transaction.on_commit(lambda: generate_shipment_for_order.delay(order.id))`.
  That fixes three bugs at once: dispatch before commit, re-dispatch on every
  admin save, and dispatch for an order that was rolled back.
- **Idempotency.** `POST /api/orders/` honours an `Idempotency-Key` header and
  returns the existing order for a repeated key, so a double-click cannot mint
  two orders. The callback writes a `ProcessedCallback` row keyed on the
  provider event id and returns `200` immediately for a duplicate. Every retry
  creates a **new `PaymentAttempt`** instead of overwriting
  `Order.provider_order_id`, so a late callback for an earlier attempt is still
  resolvable.
- **The one remaining oversell window** is between the read-only stock check at
  order creation and the conditional decrement at confirm. If stock is short at
  confirm time, `confirm_order()` still marks the order `COMPLETED` — the money
  *was* taken, and pretending otherwise would be the worse lie — then sets
  `needs_manual_review=True`, skips shipment generation, and emails ops. Do not
  "fix" this by silently failing a paid order.

---

## 4. The redirect contract

**The redirect URL must be hash-free.**

The app is served by a `BrowserRouter` behind an nginx `try_files $uri $uri/ /index.html`,
so a plain path is the only valid form:

```
{SITE_URL}/order-confirmation/{order_id}
```

Not `{SITE_URL}/#/order-confirmation`, and not `{SITE_URL}/order-confirmation`
with the order identified only by a query parameter.

Rules:

- `SITE_URL` comes from the environment and carries **no** trailing slash
  (`settings.py` strips one). Build the path by concatenation, not by guessing.
- `settings.py` raises `ImproperlyConfigured` at startup if `DEBUG` is False and
  `SITE_URL` still points at `localhost`, because every payment redirect and
  every verification and password-reset link is built from it.
- The order id is in the **path**, so the confirmation page knows which order to
  ask the server about without trusting any gateway-supplied parameter.
- Any `code`, `transactionId` or similar parameter PhonePe appends is **ignored
  for decision-making**. It may be logged. It may not change what the page says.

---

## 5. How the confirmation page decides what to show

```
GET /api/orders/<id>/payment-status/        (owner only)
→ { order_id, order_number, payment_status, paid, payment_method,
    provider_reference, subtotal, discount_amount, shipping_amount, total,
    currency: 'INR', items[], can_retry, purchase_event_pending,
    next_actions[], message, verified_at }
```

- This endpoint performs the **authoritative** gateway status query. It is the
  only thing that may tell the customer a payment succeeded.
- If the gateway is unreachable it returns **`503`** with
  `{ error, payment_status: 'PENDING', message }`. It **never** reports
  `COMPLETED` on a failed lookup. A page that sees `503` says "we could not
  confirm this yet" and offers support — it does not guess.
- The S2S callback is a **hint**, not a verdict: it tells us something changed,
  and we then re-verify with the status query before `confirm_order()` runs.

### The Meta Pixel `Purchase` event

Fired from the order-confirmation page **only**, and only when the response
above has `payment_status === 'COMPLETED'` **and** `purchase_event_pending === true`.
Immediately after firing, the client calls
`POST /api/orders/<id>/mark-purchase-tracked/`, which stamps
`purchase_tracked_at` and returns `409` if it was already set.

`purchase_event_pending` is computed server-side as
`payment_status == 'COMPLETED' and purchase_tracked_at is None`. That is the
exactly-once guarantee. A refresh, a second tab, a back-navigation or a shared
link all see `false` and fire nothing. `eventID = 'order-<id>'` additionally lets
Meta de-duplicate against a future server-side Conversions API call. A
`sessionStorage` flag may be used as an in-flight lock, **never** as the source
of truth.

Nothing fires for `FAILED`, `CANCELLED`, `PENDING` or `EXPIRED`.

---

## 6. The callback

```
POST /api/orders/payment/callback/
Authorization: SHA256(username:password)
Content-Type: application/json

{ "event": "...", "payload": { "merchantOrderId": "...", "orderId": "...",
                               "state": "...", "amount": ..., ... } }
```

- This is the **V2** shape: raw JSON with an `Authorization` header. The
  previous implementation computed a **V1** `sha256(payload + salt) + "###" + index`
  X-VERIFY and required a `{"response": "<base64>"}` envelope — while the
  payment call itself used the V2 OAuth client. That mismatch is why every
  prepaid order sat at `PENDING` forever: the callback body never matched, so the
  view returned `{"status": "ok"}` and wrote nothing.
- Credentials come from `PHONEPE_CALLBACK_USERNAME` and
  `PHONEPE_CALLBACK_PASSWORD` in the environment. Both must be set, and both
  must be registered with PhonePe.
- Returns `200 {"status": "ok"}` for **every authenticated callback, including
  duplicates**. `401` only on a genuine authentication failure. Never a 500 for
  a body we did not expect — PhonePe retries on non-2xx and a retry storm is
  worse than a logged anomaly.

### Unverified: the SDK method names

`phonepe-sdk` is **not on public PyPI** (`pip install phonepe-sdk` → "No
matching distribution found"), there is no lockfile, and the version is not
pinned. The exact V2 method names for the status query and the callback
validator **cannot be determined from this repository and must not be guessed.**

The gateway code therefore resolves the method **by name at runtime** from a
short ordered list of candidates via `getattr`, logs which one resolved, and
raises a clear `PhonePeAPIError` if none exist. The real names **must be
confirmed on staging** against the SDK build PhonePe actually supplies.

---

## 7. Local development

There are no PhonePe credentials locally, and the SDK cannot be installed here.
Use the two dev-only management commands, which call the state machine directly:

```bash
cd backend
python manage.py fake_payment_success <order_id>
python manage.py fake_payment_failed  <order_id>
```

**These exercise our state machine, not PhonePe's.** Say so in any status
report. Everything in §3 and §5 is locally provable; nothing in §6 is.

Local setup (SQLite, eager Celery, console email) is in the repository
`README.md` under "Local development without credentials".

---

## 8. Staging sign-off — required before this is considered done

Local work proves our half only. Run all five on staging, logging the full
request and response for each:

1. **A successful sandbox payment, end to end.** Confirm the customer lands on
   `/order-confirmation/<id>`, the status call returns `COMPLETED`, stock
   decrements **once**, the cart clears, exactly one confirmation email is sent,
   and exactly one `Purchase` fires.
2. **A declined payment.** Confirm `FAILED`, an intact cart, no stock movement,
   no email, no pixel event.
3. **An abandoned payment** (close the tab). Confirm the 30-minute sweeper
   resolves it to `CANCELLED` or `EXPIRED`.
4. **A replayed callback.** Confirm one email and one stock movement in total.
5. **A retry on a FAILED order.** Confirm one order and a second
   `PaymentAttempt`.

Until (1)–(5) pass on staging, the payment integration is **not** done,
whatever the local screenshots show.

---

## 9. Troubleshooting

**An order is stuck at `PENDING`.**
Call `GET /api/orders/<id>/payment-status/` and read the response. If it is
`503`, the gateway is unreachable — look at the gateway logs, not at the order.
If it returns a real state, the status query has already driven the transition.
If it stays `PENDING` past 30 minutes, the sweeper will move it to `EXPIRED`;
check that Celery beat is running.

**The callback is returning 401.**
`PHONEPE_CALLBACK_USERNAME` / `PHONEPE_CALLBACK_PASSWORD` are unset or do not
match what is registered with PhonePe. Check both sides.

**The customer says they paid but the order shows `FAILED`.**
Find the `PaymentAttempt` rows for the order — each retry has its own, with its
`merchant_order_id` and raw response. Query the gateway with the
`merchant_order_id`. Do not edit `payment_status` by hand: call `confirm_order()`
so stock, cart, email and shipment all happen exactly once.

**A redirect sent the customer somewhere that 404s.**
Check `SITE_URL` has no trailing slash and no `#`, and confirm the host rewrite
(`try_files $uri $uri/ /index.html`) is in place. Every deep link in every
verification and reset email already in a customer's inbox depends on that
rewrite.
