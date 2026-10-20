/**
 * ESLint for the storefront — IMPL_SPEC §3 WP-07.
 *
 * This config exists to enforce three specific regressions out of existence, and
 * it is deliberately narrow: `npm run lint` runs with `--max-warnings 0`, so a
 * broad stylistic preset would bury the three rules that actually matter under a
 * few hundred pre-existing findings in files nobody is being asked to touch, and
 * the gate would be turned off within a week. Correctness rules are added, style
 * rules are not.
 *
 *   1. no-restricted-imports — `services/mockApi` and `data/mockData` are deleted.
 *      Re-importing either one is how fabricated star ratings, fabricated reviews
 *      and a fabricated category list got in front of customers in the first
 *      place (LF-01, LF-10), so it has to fail the build rather than a review.
 *
 *   2. `<Grid item>` — removed in MUI v7. It does not warn at runtime; it is
 *      simply ignored, so the layout silently collapses to full-width rows.
 *      Use `<Grid size={{ xs: 12, md: 6 }}>`.
 *
 *   3. `href="#/..."` — the app moved from HashRouter to BrowserRouter (LF-06).
 *      A hash href is now a same-page anchor: it changes the URL and renders
 *      nothing. Internal links use `component={RouterLink} to="/path"`.
 *
 * Rule 1 is EXPECTED TO FAIL until WP-10 repoints the last three mockApi
 * importers (`components/product/ProductFilter.jsx`, `ProductReviews.jsx`,
 * `RelatedProducts.jsx`) and the lead deletes the two files. That is the intended
 * ordering: the rule is the thing that proves the deletion is complete.
 */

module.exports = {
  root: true,

  env: {
    browser: true,
    es2022: true,
    node: true,
  },

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },

  settings: {
    react: { version: 'detect' },
  },

  // Both plugins are registered, but only the three rules named under `rules`
  // below are switched on. Registration alone matters: an inline
  // `/* eslint-disable react/... */` in application code has to resolve to a
  // known rule, or the run fails with "Definition for rule not found".
  plugins: ['react', 'react-hooks'],

  ignorePatterns: ['dist', 'build', 'node_modules', 'public', '*.config.js', '.eslintrc.cjs'],

  rules: {
    // --- 1. the deleted mock layer -------------------------------------------
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '**/services/mockApi',
              '**/services/mockApi.js',
              '**/data/mockData',
              '**/data/mockData.js',
              'mockApi',
              'mockData',
            ],
            message:
              'mockApi/mockData are deleted. Import the real helper from src/services/api.js (IMPL_SPEC §2a) — never a fabricated rating, review, category or price.',
          },
        ],
      },
    ],

    // --- 2 & 3. the two syntactic bans ---------------------------------------
    'no-restricted-syntax': [
      'error',
      {
        selector: 'JSXOpeningElement[name.name="Grid"] JSXAttribute[name.name="item"]',
        message:
          'MUI v7 removed the `item` prop on Grid; it is ignored at runtime and the layout silently collapses. Use <Grid size={{ xs: 12, md: 6 }}> instead.',
      },
      {
        // NB: the slash is written \x2f. esquery's own selector lexer scans for the
        // closing delimiter and chokes on an escaped "/" inside the literal.
        selector: 'JSXAttribute[name.name="href"] > Literal[value=/^#\\x2f/]',
        message:
          'The app uses BrowserRouter (LF-06); a "#/..." href is a dead same-page anchor. Use component={RouterLink} to="/path" for internal links.',
      },
      {
        selector: 'JSXAttribute[name.name="to"] > Literal[value=/^#\\x2f/]',
        message:
          'A react-router `to` must be a clean path, not a legacy hash route. Use to="/path".',
      },
    ],

    // --- correctness rules worth the noise -----------------------------------
    // Conditional/looped hooks are a real crash, not a style opinion.
    'react-hooks/rules-of-hooks': 'error',

    // A stale closure in an effect is the quietest class of bug in this codebase
    // (a filter that never refetches, a poll that reads the first order forever).
    // Measured at 2 findings across src/ when this was written, so it is cheap.
    'react-hooks/exhaustive-deps': 'error',

    // One legitimate use exists (JsonLd.jsx, which must emit raw JSON into a
    // <script type="application/ld+json">), and it carries an explicit disable.
    // Anything else injecting raw HTML should have to argue for itself.
    'react/no-danger': 'error',

    // NOTE on `npm run lint`'s --report-unused-disable-directives: it makes an
    // inline `eslint-disable-next-line <rule>` an ERROR unless <rule> is both
    // registered and enabled here AND genuinely firing at that line. The two
    // rules above are enabled for exactly that reason — src/content/claims.js and
    // src/components/common/JsonLd.jsx each carry one such directive. If you add
    // a disable comment for a rule this file does not enable, the lint run fails.
  },
};
