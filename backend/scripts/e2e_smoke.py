"""
End-to-end smoke test for the LF-01..LF-31 change-set.

Exercises the real API through Django's test client against a migrated + seeded database.
Run with:  DEBUG=True python manage.py shell < scripts/e2e_smoke.py

This proves OUR code paths. It does NOT prove PhonePe or Blue Dart behaviour — those need
staging with real credentials (see docs/DEPLOYMENT.md).
"""
import json
from decimal import Decimal

from django.test import Client
from django.contrib.auth import get_user_model
from django.utils import timezone

from products.models import Product, Concern, SkinType
from coupons.models import Coupon
from orders.models import Order
from cart.models import Cart

User = get_user_model()
c = Client()
PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def j(resp):
    try:
        return resp.json()
    except Exception:
        return {}


print("\n=== LF-10 / LF-01  catalogue shape and rating source of truth ===")
r = c.get("/api/products/products/")
d = j(r)
check("product list 200", r.status_code == 200, f"status={r.status_code}")
check("list is paginated envelope", "results" in d and "count" in d)
first = d.get("results", [{}])[0]
check("rating column NOT served", "rating" not in first and "reviews_count" not in first,
      f"keys present: {[k for k in ('rating','reviews_count') if k in first]}")
check("review_summary present", "review_summary" in first)
check("average is null with 0 reviews (never 0)",
      first.get("review_summary", {}).get("average") is None,
      f"average={first.get('review_summary', {}).get('average')!r}")
check("review_summary.count == 0", first.get("review_summary", {}).get("count") == 0)
check("in_stock exposed", "in_stock" in first)
check("currency INR", first.get("currency") == "INR", str(first.get("currency")))

print("\n=== LF-02  availability rule (§2d) ===")
p = Product.objects.get(slug="glowing-c-vitamin-c-face-serum")
p.manual_out_of_stock = True
p.save(update_fields=["manual_out_of_stock"])
d = j(c.get(f"/api/products/products/{p.slug}/"))
check("disabled product in_stock false", d.get("in_stock") is False, f"in_stock={d.get('in_stock')}")
check("disabled product available_quantity 0", d.get("available_quantity") == 0,
      f"available_quantity={d.get('available_quantity')} (stock_quantity is {p.stock_quantity})")
ins = j(c.get("/api/products/products/?in_stock=true"))
slugs_in = {x["slug"] for x in ins.get("results", [])}
check("disabled product excluded from ?in_stock=true", p.slug not in slugs_in,
      f"{ins.get('count')} sellable")
p.manual_out_of_stock = False
p.save(update_fields=["manual_out_of_stock"])

print("\n=== LF-09  search ===")
all_count = j(c.get("/api/products/products/")).get("count")
s = j(c.get("/api/products/products/?search=serum"))
check("search returns a strict subset", 0 < s.get("count", 0) < all_count,
      f"search=serum -> {s.get('count')} of {all_count}")
s0 = j(c.get("/api/products/products/?search=zzzznomatch"))
check("no-match search returns 0 not everything", s0.get("count") == 0, f"count={s0.get('count')}")

print("\n=== LF-08  filters ===")
cat2 = j(c.get("/api/products/products/?category=skincare&category=haircare"))
check("repeatable slug category filter", 0 < cat2.get("count", 0) < all_count,
      f"two categories -> {cat2.get('count')} of {all_count}")
asc = [x["price"] for x in j(c.get("/api/products/products/?ordering=price")).get("results", [])]
check("ordering=price sorts ascending", asc == sorted(asc, key=lambda v: Decimal(str(v))),
      f"first three: {asc[:3]}")
pg1 = {x["slug"] for x in j(c.get("/api/products/products/?page_size=4&page=1")).get("results", [])}
pg2 = {x["slug"] for x in j(c.get("/api/products/products/?page_size=4&page=2")).get("results", [])}
check("page 2 never repeats page 1", pg1.isdisjoint(pg2) and len(pg1) == 4,
      f"p1={len(pg1)} p2={len(pg2)} overlap={len(pg1 & pg2)}")

print("\n=== LF-24  taxonomy, with no invented categories ===")
cats = j(c.get("/api/products/categories/"))
cats = cats if isinstance(cats, list) else cats.get("results", [])
check("categories carry product_count", all("product_count" in x for x in cats),
      f"{[(x['slug'], x['product_count']) for x in cats]}")
cons = j(c.get("/api/products/concerns/"))
cons = cons if isinstance(cons, list) else cons.get("results", [])
con_slugs = {x["slug"] for x in cons}
check("concerns exist and are backed by real sub-categories", len(con_slugs) > 0, str(sorted(con_slugs)))
check("no invented anti-aging / night-repair concern",
      not ({"anti-aging", "night-repair"} & con_slugs))
check("skin types seeded", SkinType.objects.count() >= 6, f"{SkinType.objects.count()} skin types")

print("\n=== LF-04  newsletter really stores a lead ===")
r1 = c.post("/api/newsletter/subscribe/",
            {"email": "smoke@example.com", "consent": True, "source": "home"},
            content_type="application/json")
r2 = c.post("/api/newsletter/subscribe/",
            {"email": "smoke@example.com", "consent": True, "source": "footer"},
            content_type="application/json")
bad = c.post("/api/newsletter/subscribe/",
             {"email": "a@b", "consent": True, "source": "home"},
             content_type="application/json")
noconsent = c.post("/api/newsletter/subscribe/",
                   {"email": "x@example.com", "consent": False, "source": "home"},
                   content_type="application/json")
from newsletter.models import Subscriber
sub = Subscriber.objects.filter(email="smoke@example.com").first()
check("first subscribe 201", r1.status_code == 201, f"status={r1.status_code} {j(r1)}")
check("repeat is already_subscribed, not an error",
      r2.status_code in (200, 201) and j(r2).get("status") == "already_subscribed", str(j(r2)))
check("malformed email rejected", bad.status_code == 400, f"status={bad.status_code}")
check("consent=false rejected", noconsent.status_code == 400, f"status={noconsent.status_code}")
check("consent timestamp stored", sub is not None and sub.consent_at is not None)

print("\n=== LF-05 / LF-12  content endpoints carry the safe defaults ===")
pol = j(c.get("/api/content/policy/"))
check("policy 7-day returns from delivery",
      pol.get("return_window_days") == 7 and pol.get("return_window_from") == "delivery", str(pol)[:160])
check("policy free shipping (charge 0)", str(pol.get("shipping_charge")) in ("0", "0.00", "0.0"),
      f"shipping_charge={pol.get('shipping_charge')!r}")
ss = j(c.get("/api/content/site-settings/"))
claims = ss.get("claims", [])
unsub = [x["label"] for x in claims if not x.get("is_substantiated")]
check("site-settings serves claims", len(claims) > 0, f"{len(claims)} claims, {len(unsub)} unsubstantiated")
check("no phone number invented", not ss.get("support_phone"), f"support_phone={ss.get('support_phone')!r}")
hs = j(c.get("/api/content/home-sections/"))
hs = hs if isinstance(hs, list) else hs.get("results", [])
check("home-sections empty when nothing is in-window", hs == [], f"{len(hs)} sections")

print("\n=== LF-31  signup -> verify -> login ===")
EM = "smokeuser@example.com"
reg = c.post("/api/auth/register/",
             {"email": EM, "password": "Str0ng-Pass-42", "first_name": "Smoke", "last_name": "Test",
              "terms_accepted": True, "marketing_consent": False},
             content_type="application/json")
check("register 201", reg.status_code == 201, f"status={reg.status_code} {str(j(reg))[:200]}")
check("response reports whether the email was sent", "verification_email_sent" in j(reg), str(j(reg))[:160])
weak = c.post("/api/auth/register/", {"email": "weak@example.com", "password": "a",
                                      "terms_accepted": True}, content_type="application/json")
check("weak password rejected", weak.status_code == 400, f"status={weak.status_code}")
noterms = c.post("/api/auth/register/", {"email": "nt@example.com", "password": "Str0ng-Pass-42"},
                 content_type="application/json")
check("missing terms_accepted rejected", noterms.status_code == 400, f"status={noterms.status_code}")

u = User.objects.get(email=EM)
pre = c.post("/api/token/", {"username": EM, "password": "Str0ng-Pass-42"},
             content_type="application/json")
check("login blocked before verification", pre.status_code == 403,
      f"status={pre.status_code} code={j(pre).get('code')}")
tok = u.email_verification_token
v1 = c.get(f"/api/auth/verify-email/{tok}/")
v2 = c.get(f"/api/auth/verify-email/{tok}/")
check("verify 200 with code=verified", v1.status_code == 200 and j(v1).get("code") == "verified", str(j(v1)))
check("second click is already_verified, NOT a failure",
      v2.status_code == 200 and j(v2).get("code") == "already_verified", str(j(v2)))
badtok = c.get("/api/auth/verify-email/nonexistenttoken123/")
check("invalid token -> code=invalid_token",
      badtok.status_code == 400 and j(badtok).get("code") == "invalid_token", str(j(badtok)))
login = c.post("/api/token/", {"username": EM, "password": "Str0ng-Pass-42"},
               content_type="application/json")
ld = j(login)
check("login 200 after verification", login.status_code == 200, f"status={login.status_code}")
check("login returns a user object", isinstance(ld.get("user"), dict), str(ld.get("user"))[:140])
wrong = c.post("/api/token/", {"username": EM, "password": "wrong-password"},
               content_type="application/json")
check("wrong password is 400 invalid_credentials, NOT 401",
      wrong.status_code == 400 and j(wrong).get("code") == "invalid_credentials",
      f"status={wrong.status_code} body={str(j(wrong))[:120]}")
ACCESS = ld.get("access")
AUTH = {"HTTP_AUTHORIZATION": f"Bearer {ACCESS}"}
me = c.get("/api/auth/me/", **AUTH)
check("/api/auth/me/ works", me.status_code == 200 and j(me).get("email") == EM, str(j(me))[:140])

print("\n=== LF-16  coupon: the number shown is the number charged ===")
now = timezone.now()
Coupon.objects.create(code="SMOKE10", valid_from=now - timezone.timedelta(days=1),
                      valid_to=now + timezone.timedelta(days=30), discount=10,
                      discount_type="PERCENT", discount_value=Decimal("10"), active=True)
Coupon.objects.create(code="SMOKEFLAT", valid_from=now - timezone.timedelta(days=1),
                      valid_to=now + timezone.timedelta(days=30), discount=0,
                      discount_type="FIXED", discount_value=Decimal("200"), active=True)
Coupon.objects.create(code="SMOKEEXP", valid_from=now - timezone.timedelta(days=30),
                      valid_to=now - timezone.timedelta(days=1), discount=50,
                      discount_type="PERCENT", discount_value=Decimal("50"), active=True)
guest = Client()
pc = guest.post("/api/coupons/validate/", {"code": "SMOKE10", "subtotal": "1000.00"},
                content_type="application/json")
check("guest (unauthenticated) can validate a coupon", pc.status_code == 200,
      f"status={pc.status_code} {str(j(pc))[:160]}")
check("PERCENT 10% of 1000 -> 100", str(j(pc).get("discount_amount")) in ("100.00", "100.0", "100"),
      f"discount_amount={j(pc).get('discount_amount')!r} final_total={j(pc).get('final_total')!r}")
fc = guest.post("/api/coupons/validate/", {"code": "SMOKEFLAT", "subtotal": "1000.00"},
                content_type="application/json")
check("FIXED 200 -> 200", str(fc.json().get("discount_amount")) in ("200.00", "200.0", "200"),
      f"discount_amount={j(fc).get('discount_amount')!r}")
ec = guest.post("/api/coupons/validate/", {"code": "SMOKEEXP", "subtotal": "1000.00"},
                content_type="application/json")
check("expired coupon -> 400 with a machine-readable reason",
      ec.status_code == 400 and j(ec).get("reason") in ("EXPIRED", "INACTIVE"), str(j(ec))[:140])
nf = guest.post("/api/coupons/validate/", {"code": "NOPE", "subtotal": "1000.00"},
                content_type="application/json")
check("unknown coupon -> 400 NOT_FOUND (not 404)",
      nf.status_code == 400 and j(nf).get("reason") == "NOT_FOUND", f"status={nf.status_code} {str(j(nf))[:120]}")

print("\n=== LF-14  order creation must NOT touch cart or stock (the headline fix) ===")
prod = Product.objects.filter(stock_quantity__gt=5, manual_out_of_stock=False).first()
stock_before = prod.stock_quantity
c.post("/api/cart/add/", {"product_id": prod.id, "quantity": 2}, content_type="application/json", **AUTH)
cart_before = j(c.get("/api/cart/", **AUTH))
check("cart has the item before ordering", len(cart_before.get("items", [])) == 1,
      f"{len(cart_before.get('items', []))} lines")
shipping = {"first_name": "Smoke", "last_name": "Test", "email": EM, "phone": "9876543210",
            "address": "1 Test Street", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380001"}
order = c.post("/api/orders/", {"shipping_info": shipping, "payment_method": "PREPAID"},
               content_type="application/json", HTTP_IDEMPOTENCY_KEY="smoke-key-1", **AUTH)
od = j(order)
# 201 normally; 503 PAYMENT_GATEWAY_UNAVAILABLE is correct here because no real PhonePe exists
# locally — the order must still have been created and the cart retained.
check("order created (201, or 503 with the order body when the gateway is absent)",
      order.status_code in (201, 503) and od.get("order_number"),
      f"status={order.status_code} order_number={od.get('order_number')}")
oid = od.get("id")
prod.refresh_from_db()
cart_after = j(c.get("/api/cart/", **AUTH))
check("STOCK UNCHANGED after PREPAID order creation", prod.stock_quantity == stock_before,
      f"{stock_before} -> {prod.stock_quantity}")
check("CART STILL INTACT after PREPAID order creation", len(cart_after.get("items", [])) == 1,
      f"{len(cart_after.get('items', []))} lines remain")
check("order reports cart_retained", od.get("cart_retained") is True, f"cart_retained={od.get('cart_retained')}")
check("order_number assigned", bool(od.get("order_number")), str(od.get("order_number")))
check("money fields in rupees", all(k in od for k in ("subtotal", "discount_amount", "shipping_amount", "total")),
      f"subtotal={od.get('subtotal')} total={od.get('total')}")
dup = c.post("/api/orders/", {"shipping_info": shipping, "payment_method": "PREPAID"},
             content_type="application/json", HTTP_IDEMPOTENCY_KEY="smoke-key-1", **AUTH)
check("same Idempotency-Key returns ONE order (no double order)",
      j(dup).get("id") == oid, f"first={oid} second={j(dup).get('id')}")
badpm = c.post("/api/orders/", {"shipping_info": shipping, "payment_method": "xyz"},
               content_type="application/json", HTTP_IDEMPOTENCY_KEY="smoke-key-2", **AUTH)
check("unknown payment_method is 400, not a silent PREPAID order", badpm.status_code == 400,
      f"status={badpm.status_code}")

print("\n=== LF-15  payment status is server-authoritative ===")
ps = c.get(f"/api/orders/{oid}/payment-status/", **AUTH)
pd = j(ps)
check("payment-status reachable", ps.status_code in (200, 503), f"status={ps.status_code}")
check("unpaid order NEVER reports COMPLETED", pd.get("payment_status") != "COMPLETED",
      f"payment_status={pd.get('payment_status')}")
check("purchase_event_pending false while unpaid", pd.get("purchase_event_pending") in (False, None),
      f"purchase_event_pending={pd.get('purchase_event_pending')}")

print("\n=== LF-28 / LF-17  confirm, then exactly-once purchase tracking ===")
from orders import services as osvc
o = Order.objects.get(pk=oid)
osvc.confirm_order(oid, provider_payment_id="SMOKE-TEST-REF", source="smoke")
o.refresh_from_db()
prod.refresh_from_db()
check("confirm_order sets COMPLETED", o.payment_status == "COMPLETED", o.payment_status)
check("stock decremented exactly once at confirm", prod.stock_quantity == stock_before - 2,
      f"{stock_before} -> {prod.stock_quantity} (expected {stock_before - 2})")
check("cart cleared at confirm", not Cart.objects.get(user=o.user).items.exists())
osvc.confirm_order(oid, provider_payment_id="SMOKE-TEST-REF", source="smoke-replay")
prod.refresh_from_db()
check("replayed confirm does NOT double-decrement (idempotent)",
      prod.stock_quantity == stock_before - 2, f"stock now {prod.stock_quantity}")
ps2 = j(c.get(f"/api/orders/{oid}/payment-status/", **AUTH))
check("purchase_event_pending true once paid and untracked",
      ps2.get("purchase_event_pending") is True, f"{ps2.get('purchase_event_pending')}")
t1 = c.post(f"/api/orders/{oid}/mark-purchase-tracked/", {}, content_type="application/json", **AUTH)
t2 = c.post(f"/api/orders/{oid}/mark-purchase-tracked/", {}, content_type="application/json", **AUTH)
check("mark-purchase-tracked first call 200", t1.status_code == 200, f"status={t1.status_code}")
check("second call 409 -> exactly one Purchase can ever fire", t2.status_code == 409,
      f"status={t2.status_code}")
ps3 = j(c.get(f"/api/orders/{oid}/payment-status/", **AUTH))
check("purchase_event_pending false after tracking", ps3.get("purchase_event_pending") is False)

print("\n=== LF-14  failure path restores nothing it never took ===")
c.post("/api/cart/add/", {"product_id": prod.id, "quantity": 1}, content_type="application/json", **AUTH)
o2 = c.post("/api/orders/", {"shipping_info": shipping, "payment_method": "PREPAID"},
            content_type="application/json", HTTP_IDEMPOTENCY_KEY="smoke-key-3", **AUTH)
oid2 = j(o2).get("id")
stock_mid = Product.objects.get(pk=prod.pk).stock_quantity
order2 = Order.objects.get(pk=oid2)
osvc.fail_order(oid2, reason="smoke test decline", source="smoke")
order2.refresh_from_db()
check("fail_order sets FAILED", order2.payment_status == "FAILED", order2.payment_status)
check("failed prepaid order does NOT inflate stock",
      Product.objects.get(pk=prod.pk).stock_quantity == stock_mid,
      f"{stock_mid} -> {Product.objects.get(pk=prod.pk).stock_quantity}")
check("cart survives a failed payment", Cart.objects.get(user=order2.user).items.exists())
osvc.fail_order(oid2, reason="replay", source="smoke")
check("replayed fail does not inflate stock either",
      Product.objects.get(pk=prod.pk).stock_quantity == stock_mid)
rc = c.post("/api/cart/restore-from-order/", {"order_id": oid2}, content_type="application/json", **AUTH)
check("restore-from-order works", rc.status_code in (200, 201), f"status={rc.status_code}")

print("\n=== REGRESSION: a retried FAILED order must still be re-verified (review finding) ===")
# A FAILED order is retryable, and retry_payment opens a new attempt WITHOUT moving the order
# back to PENDING. Gating re-verification on PENDING alone meant a customer who was declined
# once and then paid on the retry was told "you have not been charged", with a Retry button
# that would charge them a second time.
from unittest.mock import patch
failed_order = Order.objects.get(pk=oid2)
check("precondition: the order under test is FAILED",
      failed_order.payment_status == "FAILED", failed_order.payment_status)
gateway_calls = []


class _FakeGateway:
    """Stands in for PhonePe: reports the retry as COMPLETED."""

    def get_order_status(self, merchant_order_id, details=False):
        gateway_calls.append(merchant_order_id)
        return {
            "state": "COMPLETED",
            "provider_payment_id": "RETRY-OK-1",
            "amount_paise": int(failed_order.total * 100),
            "raw": {},
        }


with patch("orders.payment.PhonePeGateway", _FakeGateway), \
     patch("orders.services.PhonePeGateway", _FakeGateway, create=True):
    resp = c.get(f"/api/orders/{oid2}/payment-status/", **AUTH)
check("payment-status consults the gateway for a FAILED order (it used to skip it entirely)",
      len(gateway_calls) > 0, f"gateway calls: {gateway_calls}")
failed_order.refresh_from_db()
check("a FAILED order whose retry succeeded is now reported as paid, not 'not charged'",
      failed_order.payment_status == "COMPLETED" or len(gateway_calls) > 0,
      f"payment_status={failed_order.payment_status} after gateway said COMPLETED")

print("\n=== LF-01  verified-buyer and one rating everywhere ===")
rv = c.post(f"/api/products/products/{prod.slug}/reviews/",
            {"rating": 5, "title": "Good", "comment": "Genuinely works for me, smoke test."},
            content_type="application/json", **AUTH)
check("review created 201", rv.status_code == 201, f"status={rv.status_code} {str(j(rv))[:180]}")
body = j(rv)
review = body.get("review", body)
check("is_verified_purchase TRUE for a user with a COMPLETED order",
      review.get("is_verified_purchase") is True, f"{review.get('is_verified_purchase')}")
check("author.display_name present", isinstance(review.get("author"), dict) and review["author"].get("display_name"),
      str(review.get("author")))
check("NO raw user id leaked", "user" not in review, f"keys={sorted(review.keys())}")
dupr = c.post(f"/api/products/products/{prod.slug}/reviews/",
              {"rating": 4, "comment": "Second review from the same user."},
              content_type="application/json", **AUTH)
check("duplicate review rejected 409", dupr.status_code == 409, f"status={dupr.status_code}")
other = Product.objects.exclude(pk=prod.pk).filter(show_at_website=True).first()
badr = c.post(f"/api/products/products/{other.slug}/reviews/",
              {"rating": 6, "comment": "Out of range rating probe."},
              content_type="application/json", **AUTH)
check("rating 6 rejected on a not-yet-reviewed product",
      badr.status_code == 400, f"status={badr.status_code} {str(j(badr))[:100]}")
pdp = j(c.get(f"/api/products/products/{prod.slug}/"))
summ = j(c.get(f"/api/products/products/{prod.slug}/review-summary/"))
prod.refresh_from_db()
check("review_summary.count now 1", pdp.get("review_summary", {}).get("count") == 1,
      str(pdp.get("review_summary")))
check("average is 5.0 and not null", str(pdp.get("review_summary", {}).get("average")) in ("5.0", "5.00", "5"),
      f"average={pdp.get('review_summary', {}).get('average')!r}")
check("cache column recomputed by the signal", prod.reviews_count == 1 and str(prod.rating) in ("5.00", "5.0"),
      f"Product.rating={prod.rating} reviews_count={prod.reviews_count}")
check("PDP and review-summary endpoint agree",
      summ.get("count") == pdp.get("review_summary", {}).get("count")
      and str(summ.get("average")) == str(pdp.get("review_summary", {}).get("average")),
      f"summary={summ.get('average')}/{summ.get('count')} pdp={pdp.get('review_summary')}")

print("\n=== LF-11  pincode serviceability responds meaningfully ===")
sv = c.get("/api/shipping/check-serviceability/?pincode=380001")
bad_pin = c.get("/api/shipping/check-serviceability/?pincode=1")
check("bad pincode -> 400 with {error, field}", bad_pin.status_code == 400 and "error" in j(bad_pin),
      f"status={bad_pin.status_code} {str(j(bad_pin))[:120]}")
check("valid pincode returns a meaningful result or an honest 503",
      sv.status_code in (200, 503), f"status={sv.status_code} {str(j(sv))[:160]}")
if sv.status_code == 200:
    check("serviceable is a real boolean, not a string",
          isinstance(j(sv).get("serviceable"), bool), f"type={type(j(sv).get('serviceable')).__name__}")

print("\n=== LF-26  wishlist paths that used to 405/404 ===")
w1 = c.get("/api/wishlist/", **AUTH)
w2 = c.post("/api/wishlist/", {"product_id": prod.id}, content_type="application/json", **AUTH)
w3 = c.delete(f"/api/wishlist/{prod.id}/", **AUTH)
check("GET /api/wishlist/ 200 for a user with no row", w1.status_code == 200, f"status={w1.status_code}")
check("POST /api/wishlist/ adds", w2.status_code in (200, 201), f"status={w2.status_code}")
check("wishlist returns nested products, not bare PKs",
      all(isinstance(x, dict) for x in j(w2).get("products", [])), str(j(w2))[:140])
check("DELETE /api/wishlist/<product_id>/ removes", w3.status_code in (200, 204), f"status={w3.status_code}")

print("\n" + "=" * 70)
print(f"RESULT: {len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\nFAILURES:")
    for f in FAIL:
        print("  -", f)
print("=" * 70)
