/**
 * claims.js — every marketing claim the site is allowed to make, and the audit flag
 * that decides whether it renders.
 *
 * THE RULE, AND IT HAS NO EXCEPTIONS
 * Every claim carries `substantiated: true | false`. Consumers render ONLY substantiated
 * claims. Use `substantiatedClaims()`; do not iterate `CLAIM_DEFAULTS` directly and do
 * not filter in a component — that is how an unevidenced claim gets back onto a page.
 *
 * WHERE THE AUDIT CAME FROM (IMPL_SPEC §4, LF-05)
 * The previous code asserted a long list of claims and this repository contains ZERO
 * substantiation documents. The audit resolved to:
 *   Kept as-is      : "Made in India", "Cruelty Free"       (the brand's own practice)
 *   Softened        : the old dermatology line, which claimed both safety AND
 *                     performance, becomes "Dermatologist-tested formulations" — a
 *                     patch test evidences skin safety and nothing more
 *   Kept, re-framed : "Botanical Actives" as an ingredient claim, not a purity claim
 *   Switched OFF    : eight claims, listed below as `WITHDRAWN_CLAIMS`
 *
 * WHY THE WITHDRAWN CLAIMS HAVE NO `label` HERE
 * IMPL_SPEC §5.1 makes LF-05 provable by a grep: the withdrawn phrases must not appear
 * anywhere in `frontend/src`. A withdrawn claim never renders, so its wording is dead
 * weight in the bundle anyway — only the id, the reason and the evidence question have
 * any value, and those are what you see below. The human-readable labels live in the
 * backend `content.Claim` rows that WP-01 seeds, which is also where an admin flips one
 * back on. When that happens, the API overlay in `loadClaims()` picks the row up with
 * its label and it starts rendering with no frontend change.
 *
 * A withdrawn claim is NOT deleted from this file, because then the audit would be lost
 * and someone would re-add it from memory in six months.
 *
 * The site-wide "suitable for every skin type" promise is replaced by per-product
 * suitability rendered from `Product.suitable_for` / the `skin_types` M2M, so each page
 * states what that SKU actually claims. That is WP-10's job, not a sitewide badge.
 *
 * `iconKey` is a string, never a component: this module must stay importable from
 * anywhere without pulling in @mui/icons-material.
 */

import { useEffect, useState } from 'react';

import { loadSiteSettings } from './brand';

/** Icon keys consumers are expected to map. Anything else should fall back to a dot. */
export const CLAIM_ICON_KEYS = Object.freeze([
  'india',
  'cruelty-free',
  'derm',
  'botanical',
  'generic',
]);

/** The four claims cleared to appear on the site. */
const APPROVED_CLAIMS = [
  Object.freeze({
    id: 'made-in-india',
    label: 'Made in India',
    description: 'Formulated and manufactured in India.',
    footnote: null,
    evidenceUrl: null,
    iconKey: 'india',
    substantiated: true,
    evidenceRequired: null,
  }),
  Object.freeze({
    id: 'cruelty-free',
    label: 'Cruelty Free',
    description: 'Not tested on animals.',
    footnote: null,
    evidenceUrl: null,
    iconKey: 'cruelty-free',
    substantiated: true,
    evidenceRequired: null,
  }),
  Object.freeze({
    id: 'dermatologist-tested',
    // The softened form. It claims skin safety and deliberately claims nothing about
    // how well the product works — the previous wording claimed both.
    label: 'Dermatologist-tested formulations',
    description: 'Tested for skin safety under dermatological supervision.',
    footnote: null,
    evidenceUrl: null,
    iconKey: 'derm',
    substantiated: true,
    evidenceRequired: null,
  }),
  Object.freeze({
    id: 'botanical-actives',
    label: 'Botanical Actives',
    // An ingredient claim. NOT a purity claim: it does not describe the whole
    // formulation and must not be reworded into something that does.
    description: 'Plant-derived actives in every formulation.',
    footnote: null,
    evidenceUrl: null,
    iconKey: 'botanical',
    substantiated: true,
    evidenceRequired: null,
  }),
];

/**
 * The eight withdrawn claims, kept as an audit record. `label: null` is deliberate —
 * see the file header. Each entry says where the claim used to be rendered and exactly
 * what the business must supply to switch it back on.
 *
 * TODO(business): for every row below, supply the named certificate, lab report or test
 * number, or confirm permanent deletion. Each claim that comes back needs a one-line
 * footnote naming its evidence, which the `Claim` model renders on the page.
 */
const WITHDRAWN_CLAIMS = [
  Object.freeze({
    id: 'indias-first',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'Hero.jsx:34',
    evidenceRequired:
      'A primacy claim. It appeared exactly once in the codebase and was never ' +
      'qualified. Supply a dated, sourced statement of what the brand was genuinely ' +
      'first to do in India, and who verified it.',
  }),
  Object.freeze({
    id: 'lab-study-tested',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'Marquee.jsx:12-15',
    evidenceRequired:
      'A laboratory study claim, which is a far higher bar than the dermatologist ' +
      'safety testing we do ship. Supply the study report number, the issuing ' +
      'laboratory and the subject count.',
  }),
  Object.freeze({
    id: 'wholly-natural-ingredients',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'FAQ.jsx:9 (which contradicted Benefits.jsx:9 outright)',
    evidenceRequired:
      'A total-natural-origin purity claim. Supply the full INCI list per SKU with the ' +
      'natural-origin percentage for each, or confirm deletion. The FAQ asserted this ' +
      'while the homepage said "natural-inspired" on the same site.',
  }),
  Object.freeze({
    id: 'recyclable-packaging',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'FAQ.jsx:25',
    evidenceRequired:
      'A packaging recyclability claim. Supply the resin code and a recyclability ' +
      'assessment for every component — bottle, cap, pump, label and carton.',
  }),
  Object.freeze({
    id: 'universal-suitability',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'Benefits.jsx:18, About.jsx:194',
    evidenceRequired:
      'A sitewide universal-suitability promise, which cannot be evidenced for a ' +
      'catalogue containing SPF products and actives. Per-product suitability is ' +
      'already modelled as `suitable_for` and renders on the PDP, so confirm deletion ' +
      'of the sitewide badge.',
  }),
  Object.freeze({
    id: 'superlative-quality',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'Benefits.jsx:81',
    evidenceRequired:
      'A comparative superlative. Supply a named benchmark against identified ' +
      'competitors, or confirm deletion.',
  }),
  Object.freeze({
    id: 'visible-outcome',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'Benefits.jsx:81',
    evidenceRequired:
      'A visible-outcome performance claim. Supply the instrumental or ' +
      'consumer-perception study with its subject count, or confirm deletion.',
  }),
  Object.freeze({
    id: 'guaranteed-outcome',
    label: null,
    description: null,
    footnote: null,
    evidenceUrl: null,
    iconKey: 'generic',
    substantiated: false,
    retiredFrom: 'Hero.jsx:46',
    evidenceRequired:
      'An outcome guarantee in the old hero subhead. §4 replaced that line with the ' +
      'approved copy now in brand.js. Confirm the replacement is permanent.',
  }),
];

export const CLAIM_DEFAULTS = Object.freeze([
  ...APPROVED_CLAIMS,
  ...WITHDRAWN_CLAIMS,
]);

let current = CLAIM_DEFAULTS;

function normaliseApiClaim(apiClaim, index) {
  const label = typeof apiClaim.label === 'string' ? apiClaim.label.trim() : '';
  if (!label) return null;
  // Match an approved default by label so an admin edit keeps our id, icon and copy.
  // Withdrawn rows carry no label, so they can never be matched here — an admin who
  // re-enables one gets it rendered with the server's own label, which is correct.
  const existing = APPROVED_CLAIMS.find(
    (claim) => claim.label && claim.label.toLowerCase() === label.toLowerCase(),
  );
  const footnote =
    typeof apiClaim.footnote === 'string' && apiClaim.footnote.trim()
      ? apiClaim.footnote.trim()
      : (existing && existing.footnote) || null;
  const evidenceUrl =
    typeof apiClaim.evidence_url === 'string' && apiClaim.evidence_url.trim()
      ? apiClaim.evidence_url.trim()
      : (existing && existing.evidenceUrl) || null;
  return Object.freeze({
    id: (existing && existing.id) || `claim-${index}`,
    label,
    description: (existing && existing.description) || null,
    footnote,
    evidenceUrl,
    iconKey: (existing && existing.iconKey) || 'generic',
    // Strict: only a real `true` substantiates. A missing field, a null, or the string
    // "false" must never switch a claim on.
    substantiated: apiClaim.is_substantiated === true,
    evidenceRequired: (existing && existing.evidenceRequired) || null,
  });
}

function mergeClaims(settings) {
  if (!settings || !Array.isArray(settings.claims) || settings.claims.length === 0) {
    return CLAIM_DEFAULTS;
  }
  const merged = settings.claims
    .filter((claim) => claim && typeof claim === 'object')
    .map(normaliseApiClaim)
    .filter(Boolean);
  return merged.length > 0 ? Object.freeze(merged) : CLAIM_DEFAULTS;
}

/** Every claim, withdrawn ones included. For an audit view only — never for rendering. */
export function getAllClaims() {
  return current;
}

/**
 * THE accessor for UI. Returns only claims cleared to appear on the site, and only
 * those that actually have a label to show.
 * @param {{limit?: number, ids?: string[]}} [options]
 * @returns {Array<object>}
 */
export function substantiatedClaims(options = {}) {
  const { limit, ids } = options;
  let list = current.filter((claim) => claim.substantiated === true && claim.label);
  if (Array.isArray(ids) && ids.length > 0) {
    list = ids.map((id) => list.find((claim) => claim.id === id)).filter(Boolean);
  }
  return typeof limit === 'number' && limit >= 0 ? list.slice(0, limit) : list;
}

/** One claim by id, only if substantiated. `null` otherwise — so it renders nothing. */
export function getClaim(id) {
  return (
    current.find(
      (claim) => claim.id === id && claim.substantiated === true && claim.label,
    ) || null
  );
}

/** Hydrate (once) from `content/site-settings/`. Never rejects. */
export function loadClaims() {
  return loadSiteSettings().then((settings) => {
    current = mergeClaims(settings);
    return current;
  });
}

/** Test/SSR seam. */
export function resetClaims() {
  current = CLAIM_DEFAULTS;
}

/**
 * React binding. Returns `{ claims, loaded }` where `claims` is the substantiated set.
 * Renders the approved defaults immediately; re-renders once if the admin has changed
 * the audit. `loaded` lets a caller avoid a flash when it only wants API-driven claims.
 * @param {{limit?: number, ids?: string[]}} [options]
 */
export function useSubstantiatedClaims(options = {}) {
  const { limit, ids } = options;
  const idsKey = Array.isArray(ids) ? ids.join('|') : '';
  const [state, setState] = useState(() => ({
    claims: substantiatedClaims({ limit, ids }),
    loaded: false,
  }));

  useEffect(() => {
    let alive = true;
    loadClaims().then(() => {
      if (alive) setState({ claims: substantiatedClaims({ limit, ids }), loaded: true });
    });
    return () => {
      alive = false;
    };
    // `ids` is compared by content through `idsKey`, not identity, so an inline array
    // literal at the call site is safe and does not re-fire this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, idsKey]);

  return state;
}

export default CLAIM_DEFAULTS;
