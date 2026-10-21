#!/usr/bin/env node
/* ============================================================================
 * Le foyeR. — ALCOVE  §7.2  the image pipeline
 *
 * A PREREQUISITE, NOT AN OPTIMISATION. Today the repo ships 19 masters of
 * 1.18–6.12 MB plus 35 byte-identical placeholder JPEGs — ~87 MB — to render
 * six 161px thumbnails. `Hero.jsx:15-20` uses that unsolved weight problem to
 * justify a hero with no photograph in it: a build step is currently making
 * the brand's biggest design decision. This script takes that decision back.
 *
 * WHAT IT DOES
 *   For every 1:1 master in public/images/products it emits, into
 *   public/images/derived/<stem>-<w>.<ext>:
 *     · AVIF + WebP at 320 / 480 / 640 / 960 / 1280 / 1600  (never upscaled)
 *     · a 160px thumb in both formats  (PDP thumbnail rail, footer row)
 *     · ONE JPEG at 1280 as the final fallback
 *   plus  public/images/derived/manifest.json   (§7.2: measured corner
 *   uniformity + subject extent, so §7.6's data review is done against
 *   numbers rather than eyeballs)
 *   plus  src/generated/derivedImages.js        (the build-time map
 *   <ProductImage> reads so it never points a <source> at a 404)
 *
 * WHAT IT MUST NEVER DO  (§1.2, §10.1–10.3)
 *   The masters' grounds disagree violently and many are COOL — Spotless_3
 *   #ABE9EB cyan, Spotless_5 #104D83 deep blue, WhiteWave_4 #CC618B magenta.
 *   So this script RESIZES AND RE-ENCODES ONLY. No crop, no extend, no fit,
 *   no tint, no modulate, no flatten, no colourspace conversion. The ICC
 *   profile is carried through. The hearth light is painted on the NICHE WALL
 *   by .lf-alcove::before — never on the photograph.
 *
 * WHAT MUST NEVER SHIP  (§1.3, P11)
 *   The PNG masters, WhiteWave_4.jpg, the 35 placeholder JPEGs and
 *   State_Emblem_of_India.png (commercial use restricted under Indian law,
 *   no authorisation held) stay in the repo as build INPUTS and are pruned
 *   out of dist/ by `--prune-dist` after `vite build` copies publicDir.
 *
 * USAGE
 *   node scripts/optimize-images.mjs              derive what is missing/stale
 *   node scripts/optimize-images.mjs --check      ... and fail over P1 budget
 *   node scripts/optimize-images.mjs --force      re-encode everything
 *   node scripts/optimize-images.mjs --prune-dist drop masters from dist/
 *
 * Node >=18.17 (local v18.20.6, server v20.19.6). sharp ^0.33.5 covers both.
 * ========================================================================== */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const MASTERS_DIR = path.join(ROOT, 'public', 'images', 'products');
const DERIVED_DIR = path.join(ROOT, 'public', 'images', 'derived');
const MANIFEST = path.join(DERIVED_DIR, 'manifest.json');
const GENERATED_DIR = path.join(ROOT, 'src', 'generated');
const GENERATED_MODULE = path.join(GENERATED_DIR, 'derivedImages.js');
const DIST_PRODUCTS_DIR = path.join(ROOT, 'dist', 'images', 'products');

/* -- §7.2, verbatim ------------------------------------------------------- */
const WIDTHS = [320, 480, 640, 960, 1280, 1600];
const THUMB_WIDTH = 160;
const JPEG_WIDTH = 1280;

/* -- P1, enforced. Bytes, not "about". ------------------------------------ */
const BUDGETS = [
  { width: 1600, ext: 'avif', max: 140 * 1024 },
  { width: 1600, ext: 'webp', max: 220 * 1024 },
  { width: 480, ext: 'avif', max: 28 * 1024 },
  { width: 480, ext: 'webp', max: 28 * 1024 },
];

/* Tuned against these 19 masters so every budget above passes with margin.
 * If a future master blows a budget, `--check` fails the build rather than
 * letting a 400 KB hero onto Indian 4G. */
const ENCODE = {
  avif: { quality: 46, effort: 4, chromaSubsampling: '4:2:0' },
  webp: { quality: 68, effort: 5, smartSubsample: true },
  jpeg: { quality: 76, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' },
};

/* State_Emblem_of_India.png — §1.3 and §10.25. Never derived, never shipped. */
const FORBIDDEN = new Set(['State_Emblem_of_India.png']);
/* The 35 byte-identical placeholder JPEGs: product-7.jpg, product-7-alt2.jpg … */
const PLACEHOLDER_RE = /^product-\d+(?:-alt\d*)?\.jpe?g$/i;
const MASTER_RE = /\.(png|jpe?g)$/i;

const argv = new Set(process.argv.slice(2));
const FORCE = argv.has('--force');
const CHECK = argv.has('--check');
const PRUNE = argv.has('--prune-dist');
const QUIET = argv.has('--quiet');

const log = (...a) => { if (!QUIET) console.log(...a); };
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

/* ========================================================================== *
 * dist pruning — §1.3 / P11
 * Vite copies publicDir wholesale, so the masters land in dist/ no matter
 * what this script emits. Everything in dist/images/products is either a
 * multi-MB master, a placeholder JPEG or the State Emblem; none of the three
 * may ship. The derived/ folder beside it is what the site actually loads.
 * ========================================================================== */
async function pruneDist() {
  let entries;
  try {
    entries = await fs.readdir(DIST_PRODUCTS_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      log('prune: dist/images/products is absent — nothing to prune.');
      return 0;
    }
    throw err;
  }
  let bytes = 0;
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = path.join(DIST_PRODUCTS_DIR, entry.name);
    bytes += (await fs.stat(file)).size;
    await fs.rm(file);
    count += 1;
  }
  await fs.rm(DIST_PRODUCTS_DIR, { recursive: true, force: true });
  log(`prune: removed ${count} master/placeholder files (${mb(bytes)}) from dist/images/products.`);
  return bytes;
}

/* ========================================================================== *
 * Measurement — §7.2's manifest. Numbers, not eyeballs.
 * ========================================================================== */
const SAMPLE = 96;

/** Max per-channel spread across the four corner patches of a 96x96 sample.
 *  Spotless_4 measures ~209 — a scene with foliage, not a packshot ground. */
function cornerUniformity(data, channels) {
  const patch = 8;
  const corners = [[0, 0], [SAMPLE - patch, 0], [0, SAMPLE - patch], [SAMPLE - patch, SAMPLE - patch]];
  let spread = 0;
  for (const [ox, oy] of corners) {
    const lo = [255, 255, 255];
    const hi = [0, 0, 0];
    for (let y = oy; y < oy + patch; y += 1) {
      for (let x = ox; x < ox + patch; x += 1) {
        const i = (y * SAMPLE + x) * channels;
        for (let c = 0; c < 3; c += 1) {
          if (data[i + c] < lo[c]) lo[c] = data[i + c];
          if (data[i + c] > hi[c]) hi[c] = data[i + c];
        }
      }
    }
    for (let c = 0; c < 3; c += 1) spread = Math.max(spread, hi[c] - lo[c]);
  }
  return spread;
}

/** Mean of the four corner pixels — the ground colour, reported as hex so a
 *  human can see at a glance that these grounds do not agree (§1.2). */
function groundHex(data, channels) {
  const px = [[0, 0], [SAMPLE - 1, 0], [0, SAMPLE - 1], [SAMPLE - 1, SAMPLE - 1]];
  const sum = [0, 0, 0];
  for (const [x, y] of px) {
    const i = (y * SAMPLE + x) * channels;
    for (let c = 0; c < 3; c += 1) sum[c] += data[i + c];
  }
  return `#${sum.map((s) => Math.round(s / px.length).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Subject extent at mid-height, as a percentage of frame width. 96–99% means
 *  a full-bleed SCENE; a narrow band means a centred PACKSHOT (§7.1). */
function subjectExtent(data, channels) {
  const y = Math.floor(SAMPLE / 2);
  const px = [[0, 0], [SAMPLE - 1, 0], [0, SAMPLE - 1], [SAMPLE - 1, SAMPLE - 1]];
  const ground = [0, 0, 0];
  for (const [gx, gy] of px) {
    const i = (gy * SAMPLE + gx) * channels;
    for (let c = 0; c < 3; c += 1) ground[c] += data[i + c] / px.length;
  }
  const THRESHOLD = 26;
  let min = null;
  let max = null;
  for (let x = 0; x < SAMPLE; x += 1) {
    const i = (y * SAMPLE + x) * channels;
    let delta = 0;
    for (let c = 0; c < 3; c += 1) delta = Math.max(delta, Math.abs(data[i + c] - ground[c]));
    if (delta > THRESHOLD) {
      if (min === null) min = x;
      max = x;
    }
  }
  if (min === null) return null;
  return [
    Number(((min / SAMPLE) * 100).toFixed(1)),
    Number((((max + 1) / SAMPLE) * 100).toFixed(1)),
  ];
}

async function measure(sharp, file) {
  const { data, info } = await sharp(file)
    .resize(SAMPLE, SAMPLE, { fit: 'fill' })   // measurement only — never written out
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    cornerUniformity: cornerUniformity(data, info.channels),
    groundHex: groundHex(data, info.channels),
    subjectExtentPct: subjectExtent(data, info.channels),
  };
}

/* ========================================================================== *
 * Derivation
 * ========================================================================== */
async function isStale(out, masterMtimeMs) {
  if (FORCE) return true;
  try {
    const stat = await fs.stat(out);
    return stat.size === 0 || stat.mtimeMs < masterMtimeMs;
  } catch {
    return true;
  }
}

/** One derivative. RESIZE ONLY — see the header. */
async function derive(sharp, file, out, width, ext) {
  const pipeline = sharp(file, { failOn: 'error' })
    .keepIccProfile()                                   // never recolour (§1.2)
    .resize({ width, withoutEnlargement: true, fit: 'inside' });  // never crop (§10.1)
  if (ext === 'avif') pipeline.avif(ENCODE.avif);
  else if (ext === 'webp') pipeline.webp(ENCODE.webp);
  else pipeline.jpeg(ENCODE.jpeg);
  await pipeline.toFile(out);
  return (await fs.stat(out)).size;
}

async function main() {
  if (PRUNE && argv.size === 1) {
    await pruneDist();
    return;
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error(
      '\noptimize-images: `sharp` is not installed.\n'
      + '  npm install --save-dev sharp\n'
      + 'The ALCOVE direction treats the image pipeline as a prerequisite (§2.12),\n'
      + 'so the build stops here rather than shipping multi-MB PNGs.\n',
    );
    process.exitCode = 1;
    return;
  }
  sharp.cache(false);
  sharp.concurrency(Math.max(1, Math.min(4, (await import('node:os')).cpus().length - 1)));

  const all = await fs.readdir(MASTERS_DIR);
  const masters = all
    .filter((f) => MASTER_RE.test(f) && !FORBIDDEN.has(f) && !PLACEHOLDER_RE.test(f))
    .sort();
  const excluded = all.filter((f) => FORBIDDEN.has(f) || PLACEHOLDER_RE.test(f));

  let masterBytes = 0;
  for (const f of all) masterBytes += (await fs.stat(path.join(MASTERS_DIR, f))).size;

  log(`\nLe foyeR. image pipeline (ALCOVE §7.2)`);
  log(`  masters:   ${masters.length} derivable, ${excluded.length} excluded (placeholders + State Emblem)`);
  log(`  input dir: ${mb(masterBytes)} total, none of which may ship (§1.3)\n`);

  await fs.mkdir(DERIVED_DIR, { recursive: true });

  const entries = {};
  const violations = [];
  let written = 0;
  let skipped = 0;
  let derivedBytes = 0;

  for (const name of masters) {
    const file = path.join(MASTERS_DIR, name);
    const stem = name.replace(MASTER_RE, '');
    const { mtimeMs, size: masterSize } = await fs.stat(file);
    const meta = await sharp(file).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    /* §1.2 / §7.5: a master that is not square would be cropped by the niche's
     * 1:1 photograph box. Report it rather than silently cutting product. */
    const square = width === height;

    const widths = [...new Set([THUMB_WIDTH, ...WIDTHS].filter((w) => w <= width))];
    if (widths.length === 0) widths.push(width);

    const record = {
      master: name,
      width,
      height,
      square,
      masterBytes: masterSize,
      widths,
      formats: { avif: [], webp: [], jpg: [] },
      bytes: {},
      ...(await measure(sharp, file)),
    };
    record.class = record.subjectExtentPct
      && (record.subjectExtentPct[1] - record.subjectExtentPct[0]) >= 90 ? 'scene' : 'packshot';

    for (const w of widths) {
      for (const ext of ['avif', 'webp']) {
        const outName = `${stem}-${w}.${ext}`;
        const out = path.join(DERIVED_DIR, outName);
        let bytes;
        if (await isStale(out, mtimeMs)) {
          bytes = await derive(sharp, file, out, w, ext);
          written += 1;
        } else {
          bytes = (await fs.stat(out)).size;
          skipped += 1;
        }
        derivedBytes += bytes;
        record.formats[ext].push(w);
        record.bytes[outName] = bytes;

        const budget = BUDGETS.find((b) => b.width === w && b.ext === ext);
        if (budget && bytes > budget.max) {
          violations.push(`${outName} is ${kb(bytes)} — P1 budget is ${kb(budget.max)}`);
        }
      }
    }

    /* One JPEG, the final fallback for a browser with neither AVIF nor WebP. */
    const jw = Math.min(JPEG_WIDTH, width);
    const jpgName = `${stem}-${jw}.jpg`;
    const jpgOut = path.join(DERIVED_DIR, jpgName);
    let jpgBytes;
    if (await isStale(jpgOut, mtimeMs)) {
      jpgBytes = await derive(sharp, file, jpgOut, jw, 'jpeg');
      written += 1;
    } else {
      jpgBytes = (await fs.stat(jpgOut)).size;
      skipped += 1;
    }
    derivedBytes += jpgBytes;
    record.formats.jpg.push(jw);
    record.bytes[jpgName] = jpgBytes;

    entries[stem] = record;
    log(
      `  ${stem.padEnd(26)} ${String(width).padStart(4)}²  ${mb(masterSize).padStart(8)}`
      + `  →  ${widths.length} widths  ground ${record.groundHex}  ${record.class}`,
    );
  }

  /* ---- manifest.json (§7.2) -------------------------------------------- */
  const manifest = {
    generatedBy: 'scripts/optimize-images.mjs',
    generatedAt: new Date().toISOString(),
    spec: 'docs/ART_DIRECTION.md §7.2',
    note: 'Resize + re-encode only. No crop, no tint, no colourspace change (§1.2, §10.1-10.3).',
    base: '/images/derived/',
    widths: WIDTHS,
    thumbWidth: THUMB_WIDTH,
    jpegWidth: JPEG_WIDTH,
    budgets: BUDGETS.map(({ width, ext, max }) => ({ width, ext, maxBytes: max })),
    images: entries,
  };
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  /* ---- src/generated/derivedImages.js ----------------------------------
   * <ProductImage> must never emit a <source> that 404s: inside <picture> a
   * browser commits to the first supported type and a missing file is a
   * broken image, not a fallback. So the component asks this map whether a
   * stem was derived, and renders a plain <img> at the original URL when it
   * was not (every image served from the API's /media/ is in that case).
   * GENERATED — do not hand-edit; `npm run images` rewrites it.           */
  const compact = Object.fromEntries(
    Object.entries(entries).map(([stem, r]) => [stem, {
      w: r.width, h: r.height, avif: r.formats.avif, webp: r.formats.webp, jpg: r.formats.jpg[0],
    }]),
  );
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(
    GENERATED_MODULE,
    '/* GENERATED FILE — do not edit.\n'
    + ' * Written by frontend/scripts/optimize-images.mjs (ALCOVE §7.2).\n'
    + ' * Maps a master\'s basename stem to the derivative widths that exist on disk,\n'
    + ' * so <ProductImage> (§7.3) never points a <source> at a 404.\n'
    + ' * Run `npm run images` to regenerate. */\n\n'
    + `export const DERIVED_BASE = '/images/derived/';\n\n`
    + `export const DERIVED_WIDTHS = ${JSON.stringify(WIDTHS)};\n\n`
    + `export const DERIVED_THUMB_WIDTH = ${THUMB_WIDTH};\n\n`
    + `const derivedImages = ${JSON.stringify(compact, null, 2)};\n\n`
    + 'export default derivedImages;\n',
  );

  /* ---- report ----------------------------------------------------------- */
  const shippable = masterBytes;
  log('');
  log(`  wrote ${written} derivatives, skipped ${skipped} already up to date`);
  log(`  BEFORE  ${mb(shippable)}  (${all.length} files in public/images/products — all excluded from dist)`);
  log(`  AFTER   ${mb(derivedBytes)}  (${Object.keys(manifest.images).length} masters × AVIF/WebP/JPEG derivatives)`);
  log(`  manifest: ${path.relative(ROOT, MANIFEST)}`);
  log(`  module:   ${path.relative(ROOT, GENERATED_MODULE)}`);

  if (violations.length) {
    console.error('\n  P1 BUDGET VIOLATIONS:');
    for (const v of violations) console.error(`    ${v}`);
    if (CHECK) {
      console.error('\n  Build stopped. Lower ENCODE quality or re-master the offending image.\n');
      process.exitCode = 1;
      return;
    }
  } else {
    log(`  P1 budgets: all ${BUDGETS.length} limits clear`);
  }
  log('');

  if (PRUNE) await pruneDist();
}

main().catch((err) => {
  console.error('optimize-images failed:', err);
  process.exitCode = 1;
});
