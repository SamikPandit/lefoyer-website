/**
 * brand.js — the single source for every brand / marketing / support string.
 *
 * WHY THIS FILE EXISTS
 * The repo previously carried the brand voice in nine different components, which is
 * how an unevidenced primacy-and-luxury strapline ended up on the homepage (see the
 * withdrawn `indias-first` entry in claims.js) and how the wordmark ended up spelled
 * two different ways in two files.
 * Every consumer now imports from here. Nothing marketing-shaped is typed into a
 * component again.
 *
 * HOW IT HYDRATES
 * `BRAND_DEFAULTS` is the COMPILE-TIME FALLBACK: the IMPL_SPEC §4 safe defaults, which
 * claim only what this repo can actually prove. `loadBrand()` overlays
 * `GET /api/content/site-settings/` on top of it exactly once per page load. If the API
 * is down, slow, or not deployed yet, the site still renders honest, approved copy —
 * it never renders an empty string or a placeholder.
 *
 * WORDMARK DECISION (resolved here, once)
 * The repo spelled it two ways: `LE FOYER` (Navbar.jsx:121, Footer.jsx:72 — both of which
 * are simply uppercase presentation) and `Le foyeR.` (index.html <title>, About.jsx's
 * etymology paragraph, backend/lefoyer/settings.py jazzmin block, every transactional
 * email in backend/accounts/email_service.py, and the PDP brand cell).
 * CHOSEN: **`Le foyeR.`** — it is the spelling the backend, the emails and the page title
 * already use, and it is the one the About page explains ("French for 'the hearth'").
 * `LE FOYER` was never a different name, only `text-transform: uppercase` written out by
 * hand. Components that want the uppercase look must apply CSS, not retype the name.
 */

import { useEffect, useState } from 'react';

import { getSiteSettings } from '../services/api';

/** Normalise a value that may be an empty string, whitespace, or null, to null. */
const clean = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const BRAND_DEFAULTS = Object.freeze({
  /** The one approved spelling. Uppercase presentation is CSS, never a second string. */
  wordmark: 'Le foyeR.',

  /**
   * Trading name used in the footer copyright and transactional email signature.
   * TODO(business): the legal entity is unresolved — TermsAndConditions.jsx:34 says
   * "Le Foyer Global, incorporated under the Companies Act, 1956" (an Act replaced in
   * 2013) while TermsAndConditions.jsx:101 gives contact details for "SITE COBALLO
   * PRIVATE LIMITED" with a gmail.com address. Which is the contracting entity, and
   * what is its CIN and registered address? Until answered, we ship the trading name
   * that is already everywhere and assert no incorporation facts.
   */
  legalName: 'Le foyeR. Global',

  /**
   * Short tagline — nav, footer, meta. Derived strictly from the §4-approved hero
   * subhead ("…for the whole family…"), so it adds no new claim.
   */
  tagline: 'Skincare for the whole family.',

  /** §4 LF-05 approved replacement hero copy. The only hero copy that may ship. */
  hero: Object.freeze({
    headline: 'Skincare that feels like coming home.',
    subhead:
      'Made in India. Dermatologist-tested formulations for the whole family — one shelf, every skin.',
    primaryCta: Object.freeze({ label: 'Shop Skincare', to: '/products' }),
    secondaryCta: Object.freeze({ label: 'Our story', to: '/about' }),
  }),

  /**
   * Positioning paragraph for About / Contact / meta description.
   * Both sentences are sourced: sentence 1 is the etymology already in About.jsx:119,
   * sentence 2 is the §4-approved hero subhead. Nothing here is newly invented.
   */
  positioningStatement:
    "Le foyeR. is French for 'the hearth' — the heart of the home. Made in India, " +
    'dermatologist-tested formulations for the whole family: one shelf, every skin.',

  /**
   * The hearth/ritual territory line, kept because §4 explicitly preserves it.
   */
  territoryLine:
    'The hearth is where a family gathers. We make the shelf it gathers around.',

  support: Object.freeze({
    /** Already configured as EMAIL_HOST_USER in backend/lefoyer/settings.py:252. */
    email: 'support@lefoyerglobal.com',
    /**
     * NO PHONE NUMBER. There is not one anywhere in this repository, and §4 forbids
     * inventing one. `null` means "do not render a phone row" — it does not mean
     * "fill this in with something plausible".
     * TODO(business): supply the customer-facing support contact set — phone,
     * WhatsApp number and staffed hours — or confirm email-only support.
     */
    phone: null,
    whatsapp: null,
    hours: null,
    /** Internal route for the support form (WP-12 owns the page). */
    contactPath: '/contact',
    faqPath: '/faq',
  }),

  social: Object.freeze({
    /** The only social handle that appears anywhere in the repo. */
    instagram: 'https://instagram.com/lefoyerglobal',
    instagramHandle: '@lefoyerglobal',
  }),

  seo: Object.freeze({
    siteName: 'Le foyeR.',
    /** Used verbatim when a page supplies no title of its own. */
    defaultTitle: 'Le foyeR. — Skincare for the whole family',
    /** `%s` is replaced with the page title. */
    titleTemplate: '%s | Le foyeR.',
    defaultDescription:
      'Made in India. Dermatologist-tested skincare for the whole family — cleansers, ' +
      'moisturisers, sun protection and haircare, with free standard delivery and 7-day returns.',
    /**
     * No share card exists in this repo. frontend/public/images/products holds product
     * photography only, and inventing a path would ship a broken og:image.
     * `null` makes SeoHead omit the og:image/twitter:image tags entirely.
     * TODO(business): supply a 1200x630 share card and set this to its public path.
     */
    ogImage: null,
    ogImageAlt: null,
    twitterCard: 'summary_large_image',
    locale: 'en_IN',
  }),

  newsletter: Object.freeze({
    heading: 'Join the Le foyeR. list',
    body: 'New formulations, restocks and the occasional note on looking after your family’s skin.',
    buttonLabel: 'Join',
    placeholder: 'you@example.com',
    /** The consent text that is submitted alongside the address. */
    consentLabel:
      'Email me about new products, restocks and offers. I can unsubscribe at any time.',
    privacyNote: 'We never sell your address.',
  }),
});

/** The mutable "current" brand — starts as the defaults, replaced once on hydration. */
let current = BRAND_DEFAULTS;

/** Deep-ish merge: only overlays values the API actually sent. */
function mergeSettings(defaults, settings) {
  if (!settings || typeof settings !== 'object') return defaults;

  const social = settings.social && typeof settings.social === 'object' ? settings.social : {};
  const instagram = clean(social.instagram);

  return Object.freeze({
    ...defaults,
    wordmark: clean(settings.brand_name) || defaults.wordmark,
    tagline: clean(settings.tagline) || defaults.tagline,
    positioningStatement:
      clean(settings.positioning_statement) || defaults.positioningStatement,
    support: Object.freeze({
      ...defaults.support,
      email: clean(settings.support_email) || defaults.support.email,
      // A missing phone stays null. The API sending "" must not produce an empty tel: link.
      phone: clean(settings.support_phone),
      whatsapp: clean(settings.whatsapp),
      hours: clean(settings.hours),
    }),
    social: Object.freeze({
      ...defaults.social,
      instagram: instagram || defaults.social.instagram,
      instagramHandle: instagram
        ? `@${instagram.replace(/\/+$/, '').split('/').pop()}`
        : defaults.social.instagramHandle,
    }),
    seo: Object.freeze({
      ...defaults.seo,
      siteName: clean(settings.brand_name) || defaults.seo.siteName,
    }),
  });
}

/** `getSiteSettings()` is fetched at most once per page load, by whoever asks first. */
let settingsPromise = null;

/**
 * Raw `GET content/site-settings/`, memoised, never throwing.
 * Resolves to `null` when the endpoint is unavailable — callers keep their defaults.
 * Exported because claims.js reads the same response and must not fetch it twice.
 */
export function loadSiteSettings() {
  if (!settingsPromise) {
    settingsPromise = Promise.resolve()
      .then(() => getSiteSettings())
      .then((data) => (data && typeof data === 'object' ? data : null))
      .catch(() => {
        // Do NOT cache a failure. The content app may not be deployed yet; a later
        // mount should get another chance instead of being pinned to the defaults.
        settingsPromise = null;
        return null;
      });
  }
  return settingsPromise;
}

/** The brand as currently known: defaults before hydration, API-overlaid after. */
export function getBrand() {
  return current;
}

/** Hydrate (once) and resolve with the brand object to use. Never rejects. */
export function loadBrand() {
  return loadSiteSettings().then((settings) => {
    if (settings) current = mergeSettings(BRAND_DEFAULTS, settings);
    return current;
  });
}

/** Test/SSR seam: drop the memoised fetch and revert to the compile-time defaults. */
export function resetBrand() {
  settingsPromise = null;
  current = BRAND_DEFAULTS;
}

/** Convenience: the support email, hydrated if available. */
export function getSupportEmail() {
  return current.support.email;
}

/**
 * React binding. Renders the compile-time defaults on the first paint (so there is no
 * blank flash and no layout shift) and re-renders once with the API values if they
 * differ. Safe to call from any number of components — one fetch is shared.
 */
export function useBrand() {
  const [brand, setBrand] = useState(current);
  useEffect(() => {
    let alive = true;
    loadBrand().then((next) => {
      if (alive) setBrand(next);
    });
    return () => {
      alive = false;
    };
  }, []);
  return brand;
}

export default BRAND_DEFAULTS;
