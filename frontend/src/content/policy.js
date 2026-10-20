/**
 * policy.js — the ONE place delivery, returns and refund numbers live, and the ONE place
 * the sentences that state them are built.
 *
 * ============================================================================
 * TODO(business): LF-12 — resolve the five-way policy contradiction.
 * ============================================================================
 * This repo asserted five mutually incompatible policies, all verified in the code:
 *
 *   1. ShippingPolicy.jsx  delivery 3-7 days · returns 7 days FROM DELIVERY ·
 *                          refunds 10 days (in a broken sentence: "we will initiate
 *                          and credited the refund")
 *   2. FAQ.jsx             free shipping over Rs 5000 · 3-5 BUSINESS days ·
 *                          returns 30 days FROM PURCHASE, "provided the product is
 *                          gently used" · plus "expedited shipping available at
 *                          checkout" — NO SUCH OPTION EXISTS (Checkout offers UPI
 *                          and COD only)
 *   3. ProductDetail.jsx   "Free Delivery" unconditional ·
 *                          "Free 30 Days Delivery Returns" (two policies conflated
 *                          into one sentence)
 *   4. Cart.jsx            Shipping = Free  ·  the deleted CartSummary.jsx had
 *                          `estimatedShipping = 50 // Static for now`
 *   5. OrderDetail.jsx     `const shipping = 0; // Add shipping logic if needed`
 *
 * The backend charges NOTHING — shipping never enters orders/views.py's arithmetic.
 * There is no ShippingRate model, no settings entry and no constant, so the true
 * policy IS NOT RECOVERABLE FROM THIS REPOSITORY.
 *
 * What we ship (IMPL_SPEC §4): the NARROWEST of the conflicting promises (7 days, not
 * 30) and the one that matches what the code actually does (free shipping, Rs 0
 * charge). Under-promising is recoverable; over-promising is a chargeback.
 *
 * THE QUESTION FOR THE OWNER, as a single set — do not answer one and leave the rest:
 *   (a) the return window and its START POINT (delivery or purchase?)
 *   (b) the free-shipping threshold and the standard shipping charge
 *   (c) the delivery window, and whether it is calendar or business days
 *   (d) the refund timeline
 *   (e) the non-returnable categories
 * Do NOT pick one of the five existing variants by guesswork.
 * ============================================================================
 *
 * HOW TO USE THIS FILE
 * Never retype a number. Import `policyCopy()` (or `usePolicy()`) and render the string.
 * Every sentence below is BUILT from `POLICY_DEFAULTS`, which is why a grep for `7` in
 * this one file proves the PDP, the cart, the FAQ and /shipping-returns all agree.
 * If you find yourself writing "7-day" in a component, you have reintroduced LF-12.
 */

import { useEffect, useMemo, useState } from 'react';

import { getPolicy } from '../services/api';

export const POLICY_DEFAULTS = Object.freeze({
  /** [min, max] calendar days, from the most policy-shaped source we had. */
  deliveryWindowDays: Object.freeze([3, 7]),
  /** `null` = there is no threshold, i.e. standard delivery is free on every order. */
  freeShippingThreshold: null,
  /** Rupees. 0 is what the backend actually charges. */
  shippingCharge: 0,
  returnWindowDays: 7,
  /** 'delivery' | 'purchase' — the window starts when the parcel ARRIVES. */
  returnWindowFrom: 'delivery',
  refundDays: 10,
  returnExclusions: Object.freeze([
    'opened or used personal-care products',
    'items without original packaging',
  ]),
  /**
   * `null` = not a sitewide fact. COD is decided PER PINCODE by
   * `GET shipping/check-serviceability/`. Never render an unconditional COD badge:
   * drive it off `cod_available` from that response (see PincodeCheck).
   */
  codAvailable: null,
  currency: 'INR',
});

let currentPolicy = POLICY_DEFAULTS;

/** Only used for the free-shipping nudge. Price display belongs to PriceBlock. */
function rupees(amount) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${Math.round(amount)}`;
  }
}

/**
 * Build every policy sentence the app is allowed to print, from the numbers.
 * @param {typeof POLICY_DEFAULTS} [policy]
 */
export function policyCopy(policy = currentPolicy) {
  const [minDays, maxDays] = policy.deliveryWindowDays;
  const window = `${minDays}-${maxDays} days`;
  const isFree = !policy.shippingCharge && policy.freeShippingThreshold === null;
  const from = policy.returnWindowFrom === 'purchase' ? 'purchase' : 'delivery';
  const exclusions = policy.returnExclusions;
  const exclusionsSentence =
    exclusions.length === 0
      ? ''
      : exclusions.length === 1
        ? `We can't accept returns on ${exclusions[0]}.`
        : `We can't accept returns on ${exclusions
            .slice(0, -1)
            .join(', ')}, or ${exclusions[exclusions.length - 1]}.`;

  return Object.freeze({
    /* ---- delivery ---- */
    /** "3-7 days" */
    deliveryWindow: window,
    /** "Free standard delivery" / "Standard delivery ₹49" */
    shippingLabel: isFree ? 'Free standard delivery' : `Standard delivery ${rupees(policy.shippingCharge)}`,
    /** The cart/summary shipping amount cell. */
    shippingAmountLabel: policy.shippingCharge ? rupees(policy.shippingCharge) : 'Free',
    /** THE PDP delivery block. One sentence, three facts, no promise we can't keep. */
    deliveryLine: `${
      isFree ? 'Free standard delivery' : `Standard delivery ${rupees(policy.shippingCharge)}`
    } · ${window} · enter your pincode for an exact date`,
    /** For the policy page and FAQ body copy. */
    deliveryDetail: `Orders are delivered in ${window} once dispatched. ${
      isFree
        ? 'Standard delivery is free on all orders.'
        : `Standard delivery is ${rupees(policy.shippingCharge)}.`
    } Enter your pincode on any product page for a date specific to your area.`,

    /* ---- returns ---- */
    /** "7-day returns" — chips, trust rows, compact strips. */
    returnsShort: `${policy.returnWindowDays}-day returns`,
    /** "7-day returns from delivery" */
    returnsWindow: `${policy.returnWindowDays}-day returns from ${from}`,
    /** THE PDP returns block. Must match /shipping-returns word for word. */
    returnsLine: `${policy.returnWindowDays}-day returns from ${from}. Unopened items in original packaging. Refunds in ${policy.refundDays} days.`,
    returnsDetail: `You have ${policy.returnWindowDays} days from the day your order is ${
      from === 'purchase' ? 'placed' : 'delivered'
    } to request a return. Items must be unopened and in their original packaging.`,
    returnsExclusionsLine: exclusionsSentence,
    returnExclusions: exclusions,

    /* ---- refunds ---- */
    /** "Refunds in 10 days" */
    refundLine: `Refunds in ${policy.refundDays} days`,
    refundDetail: `Once we receive and check the returned item, your refund is issued to the original payment method within ${policy.refundDays} days.`,

    /* ---- payment ---- */
    /** COD is never asserted sitewide — it is a per-pincode answer. */
    codLine: 'Cash on delivery depends on your pincode.',
    /** Call with the `cod_available` boolean from check-serviceability. */
    codLabelFor: (codAvailable) =>
      codAvailable === true
        ? 'Cash on delivery available'
        : codAvailable === false
          ? 'Cash on delivery not available here'
          : 'Check cash on delivery for your pincode',

    /* ---- the one D2C statement we can prove (§4 LF-18) ---- */
    d2cAdvantage: `Order here for the full range, ${policy.returnWindowDays}-day returns handled directly by us, and pincode-accurate delivery dates.`,

    /* ---- raw numbers, for anyone who needs the value not the sentence ---- */
    numbers: policy,
  });
}

/**
 * "Spend ₹X more for free delivery" — or `null` when there is no threshold, which is
 * the shipped default. Returning `null` is how the cart knows not to render a nudge.
 */
export function freeShippingNudge(subtotal) {
  const threshold = currentPolicy.freeShippingThreshold;
  if (threshold === null || typeof threshold !== 'number') return null;
  const remaining = threshold - Number(subtotal || 0);
  if (remaining <= 0) return 'Free delivery unlocked';
  return `Spend ${rupees(remaining)} more for free delivery`;
}

/** 0..1 progress toward the threshold, or `null` when there is no threshold. */
export function freeShippingProgress(subtotal) {
  const threshold = currentPolicy.freeShippingThreshold;
  if (threshold === null || typeof threshold !== 'number' || threshold <= 0) return null;
  return Math.max(0, Math.min(1, Number(subtotal || 0) / threshold));
}

function mergePolicy(data) {
  if (!data || typeof data !== 'object') return POLICY_DEFAULTS;
  const d = POLICY_DEFAULTS;
  const win = Array.isArray(data.delivery_window_days) && data.delivery_window_days.length === 2
    ? data.delivery_window_days.map((n) => Number(n))
    : null;
  const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

  return Object.freeze({
    deliveryWindowDays:
      win && win.every((n) => Number.isFinite(n) && n > 0)
        ? Object.freeze([win[0], win[1]])
        : d.deliveryWindowDays,
    // `null` is a MEANINGFUL value here (no threshold), so it is not treated as absent.
    freeShippingThreshold:
      data.free_shipping_threshold === null
        ? null
        : num(data.free_shipping_threshold, d.freeShippingThreshold),
    shippingCharge: num(data.shipping_charge, d.shippingCharge),
    returnWindowDays: num(data.return_window_days, d.returnWindowDays),
    returnWindowFrom:
      data.return_window_from === 'purchase' || data.return_window_from === 'delivery'
        ? data.return_window_from
        : d.returnWindowFrom,
    refundDays: num(data.refund_days, d.refundDays),
    returnExclusions:
      Array.isArray(data.return_exclusions) && data.return_exclusions.length > 0
        ? Object.freeze(
            data.return_exclusions
              .filter((s) => typeof s === 'string' && s.trim())
              .map((s) => s.trim()),
          )
        : d.returnExclusions,
    codAvailable: typeof data.cod_available === 'boolean' ? data.cod_available : d.codAvailable,
    currency: d.currency,
  });
}

let policyPromise = null;

/** The policy as currently known: defaults before hydration, API-overlaid after. */
export function getPolicyValues() {
  return currentPolicy;
}

/** Hydrate (once) from `GET content/policy/`. Never rejects. */
export function loadPolicy() {
  if (!policyPromise) {
    policyPromise = Promise.resolve()
      .then(() => getPolicy())
      .then((data) => {
        currentPolicy = mergePolicy(data);
        return currentPolicy;
      })
      .catch(() => {
        // Do NOT cache a failure: the content app may simply not be deployed yet, and
        // the next mount should get a chance to hydrate rather than being stuck on the
        // compile-time defaults for the whole session.
        policyPromise = null;
        return currentPolicy;
      });
  }
  return policyPromise;
}

/** Test/SSR seam. */
export function resetPolicy() {
  policyPromise = null;
  currentPolicy = POLICY_DEFAULTS;
}

/**
 * React binding. `{ policy, copy }` — the safe defaults on first paint, the API values
 * after. One fetch is shared by every caller.
 */
export function usePolicy() {
  const [policy, setPolicy] = useState(currentPolicy);
  useEffect(() => {
    let alive = true;
    loadPolicy().then((next) => {
      if (alive) setPolicy(next);
    });
    return () => {
      alive = false;
    };
  }, []);
  // `copy` is memoised so consumers can safely put it in a dependency array.
  const copy = useMemo(() => policyCopy(policy), [policy]);
  return { policy, copy };
}

export default POLICY_DEFAULTS;
