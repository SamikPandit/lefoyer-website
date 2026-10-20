/**
 * JsonLd — renders one `<script type="application/ld+json">` safely.
 *
 * WHY NOT JUST `{JSON.stringify(data)}` AS A CHILD?
 * Because React escapes text children, so `&` becomes `&amp;` INSIDE the script and the
 * JSON stops parsing. And because a raw `JSON.stringify` of anything containing a
 * product name like `</script><script>...` closes the tag early — a stored-XSS vector
 * straight out of the catalogue, since product names, descriptions and review text all
 * come from the database and all end up in JSON-LD.
 *
 * `serializeJsonLd` therefore rewrites `<`, `>` and `&` as JSON unicode escapes (legal
 * inside a JSON string, identical to every consumer, and impossible to parse as markup)
 * and does the same for U+2028 / U+2029, which are valid JSON but illegal unescaped in
 * a JavaScript string literal.
 *
 * Usage:
 *   <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Product' }} />
 *   <JsonLd data={[orgLd, websiteLd]} />          // emits one script per entry
 * Prefer passing the same object to `<SeoHead jsonLd={...} />`, which puts it in <head>.
 * This component is for the cases where the markup must sit next to the content it
 * describes; JSON-LD in <body> is equally valid to consumers.
 */

/**
 * Characters that could terminate the script element or break a JS string literal.
 * Built through `new RegExp` from an ASCII-only source string so the separators never
 * appear literally in this file (a raw U+2028 in source is invisible and corrupts
 * tooling that is not fully ES2019-aware).
 */
const UNSAFE = new RegExp('[<>&\\u2028\\u2029]', 'g');

/** `<` -> the six characters backslash-u-0-0-3-c. */
const escapeForScript = (char) =>
  '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');

/**
 * JSON for embedding in an HTML `<script>`. Returns `''` for anything unserialisable,
 * so a bad payload emits nothing rather than invalid markup.
 * @param {unknown} data
 * @returns {string}
 */
export function serializeJsonLd(data) {
  if (data === null || data === undefined) return '';
  try {
    const json = JSON.stringify(data);
    if (typeof json !== 'string') return '';
    return json.replace(UNSAFE, escapeForScript);
  } catch {
    // Circular structure, BigInt, etc. Emitting nothing is the only safe answer.
    return '';
  }
}

/**
 * Drop keys whose value is `null` / `undefined` / `''` so schema.org consumers never
 * see `"price": null`. Recurses through plain objects and arrays only.
 * @param {unknown} value
 * @returns {unknown} the pruned value, or `undefined` if nothing is left
 */
export function pruneJsonLd(value) {
  if (Array.isArray(value)) {
    const items = value.map(pruneJsonLd).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    Object.keys(value).forEach((key) => {
      const pruned = pruneJsonLd(value[key]);
      if (pruned !== undefined) out[key] = pruned;
    });
    return Object.keys(out).length > 0 ? out : undefined;
  }
  if (value === null || value === undefined || value === '') return undefined;
  return value;
}

/**
 * @param {object} props
 * @param {object|object[]} [props.data] A schema.org object, or an array of them
 *   (one `<script>` each).
 * @param {string} [props.id] Optional DOM id, applied only when a single object is
 *   passed.
 */
const JsonLd = ({ data, id }) => {
  const entries = Array.isArray(data) ? data : [data];
  const scripts = entries
    .map((entry) => serializeJsonLd(pruneJsonLd(entry)))
    .filter((json) => json.length > 0);

  if (scripts.length === 0) return null;

  return (
    <>
      {scripts.map((json, index) => (
        <script
          key={id ? `${id}-${index}` : `jsonld-${index}`}
          type="application/ld+json"
          id={id && scripts.length === 1 ? id : undefined}
          // The payload is escaped by serializeJsonLd above; React would otherwise
          // HTML-escape it and break the JSON.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
    </>
  );
};

export default JsonLd;
