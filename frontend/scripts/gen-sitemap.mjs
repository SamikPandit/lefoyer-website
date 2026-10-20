#!/usr/bin/env node
/**
 * Generates frontend/public/sitemap.xml from the live catalogue API.
 *
 * Runs as part of `npm run build`. If the API is unreachable it writes a sitemap containing just
 * the static routes and exits 0 — a deploy must never be blocked by this, but it also must never
 * silently publish a sitemap listing products that do not exist.
 *
 * Usage:  node scripts/gen-sitemap.mjs [--api <base>] [--site <origin>]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'public', 'sitemap.xml')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const SITE = (arg('site', process.env.VITE_SITE_URL || 'https://www.lefoyerglobal.com')).replace(/\/$/, '')
const API = (arg('api', process.env.VITE_API_URL || `${SITE}/api/`)).replace(/\/$/, '') + '/'

// Static routes worth indexing. Transactional and authenticated routes are excluded here and in
// robots.txt; /search is deliberately omitted as infinite-space.
const STATIC = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/products', changefreq: 'daily', priority: '0.9' },
  { loc: '/about', changefreq: 'monthly', priority: '0.5' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.5' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.4' },
  { loc: '/shipping-returns', changefreq: 'monthly', priority: '0.4' },
  { loc: '/privacy-policy', changefreq: 'yearly', priority: '0.2' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.2' },
]

const xmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function getJson(url) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 15000)
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

// The catalogue list is paginated; walk every page so a growing catalogue is never truncated.
async function fetchAll(path, params = '') {
  const out = []
  let page = 1
  for (;;) {
    const sep = params ? '&' : ''
    const data = await getJson(`${API}${path}?page=${page}${sep}${params}`)
    const items = Array.isArray(data) ? data : data.results || []
    out.push(...items)
    const hasNext = !Array.isArray(data) && data.next
    if (!hasNext || items.length === 0 || page > 100) break
    page += 1
  }
  return out
}

const entries = [...STATIC]
let note = 'static routes only'

try {
  const [products, categories] = await Promise.all([
    fetchAll('products/products/', 'page_size=48'),
    getJson(`${API}products/categories/`).then((d) => (Array.isArray(d) ? d : d.results || [])),
  ])

  for (const c of categories) {
    // Only categories that actually have something sellable behind them — a sitemap entry for an
    // empty category is a soft-404 invitation.
    if (c.slug && (c.product_count ?? 1) > 0) {
      entries.push({ loc: `/products?category=${encodeURIComponent(c.slug)}`, changefreq: 'weekly', priority: '0.7' })
    }
  }

  for (const p of products) {
    if (!p.slug) continue
    entries.push({
      loc: `/product/${encodeURIComponent(p.slug)}`,
      lastmod: p.updated_at ? String(p.updated_at).slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: '0.8',
    })
  }
  note = `${products.length} products, ${categories.filter((c) => (c.product_count ?? 1) > 0).length} categories`
} catch (err) {
  console.warn(`[sitemap] catalogue unreachable at ${API} (${err.message}); writing static routes only.`)
}

const body = entries
  .map((e) => {
    const parts = [`    <loc>${xmlEscape(SITE + e.loc)}</loc>`]
    if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`)
    if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`)
    if (e.priority) parts.push(`    <priority>${e.priority}</priority>`)
    return `  <url>\n${parts.join('\n')}\n  </url>`
  })
  .join('\n')

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
)
console.log(`[sitemap] wrote ${entries.length} urls to public/sitemap.xml (${note})`)
