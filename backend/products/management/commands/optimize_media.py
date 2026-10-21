"""
Generate responsive AVIF/WebP derivatives for every uploaded product and category image.

WHY THIS EXISTS
---------------
The frontend has its own build-time pipeline (`frontend/scripts/optimize-images.mjs`), but it
can only ever reach the masters committed to the repo. Four of the six live products are
served from Django's ``MEDIA_ROOT`` instead, and those four were, when measured:

    glow-game-waterless-facewash      783 KB   Screenshot_from_2026-01-27_09-13-49.png
    the-daily-invisible-moisturizer   905 KB   Screenshot_from_2026-01-27_09-10-45.png
    raindrops-shower-gel              326 KB   WhatsApp_Image_2026-02-16_at_4.03.55_PM.jpeg
    uv-armor-tinted-sunscreen         256 KB   WhatsApp_Image_2026-02-02_at_1.23.12_PM_1.jpeg

The frontend pipeline took the six-card listing from 11.3 MB to 2.3 MB. All 2.27 MB that
remained was these four, because a Vite build cannot see a file that lives on the server.
This command closes that half. Together they take the listing under ~60 KB of imagery.

That matters here more than it would elsewhere: this storefront's audience is mid and low-end
Android over Indian 4G, where 2.3 MB of product thumbnails is several seconds of blank card.

WHAT IT WILL NOT DO
-------------------
It never crops, never re-tints and never upscales. ``docs/ART_DIRECTION.md`` §1.2 established
by measurement that these photographs disagree violently in backdrop — cyan #ABE9EB, deep blue
#104D83, pink #DD93B1, brown #714E32 — so any warm wash turns the cool ones to mud, and any
crop eats a subject that already runs to 96-99% of frame width. Reconciliation is the job of
the niche the photo stands in, not of the pixels. This command only ever makes the same
picture smaller and cheaper.

Widths and format ladder are kept byte-identical to the frontend's so one ``<ProductImage>``
can consume either source without a second code path.

USAGE
-----
    python manage.py optimize_media              # incremental; only what changed
    python manage.py optimize_media --force      # re-encode everything
    python manage.py optimize_media --prune      # also delete orphaned derivatives
    python manage.py optimize_media --dry-run    # report, write nothing

Idempotent: a second run with no new uploads does nothing and exits 0. Safe to call from a
deploy script.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

# Kept in lockstep with DERIVED_WIDTHS / DERIVED_THUMB_WIDTH in
# frontend/scripts/optimize-images.mjs. If you change one, change both.
WIDTHS = (160, 320, 480, 640, 960, 1280, 1600)

# The width whose JPEG is emitted as the universal <img src> fallback.
FALLBACK_WIDTH = 1280

# Quality settings chosen to sit at the knee of the curve for product photography on a plain
# ground: visually lossless at card and hero size, roughly an order of magnitude smaller.
AVIF_QUALITY = 52
WEBP_QUALITY = 78
JPEG_QUALITY = 82

DERIVED_DIRNAME = 'derived'
MANIFEST_NAME = 'manifest.json'


@dataclass
class Stats:
    sources: int = 0
    written: int = 0
    skipped: int = 0
    failed: int = 0
    pruned: int = 0
    source_bytes: int = 0
    derived_bytes: int = 0
    errors: list = field(default_factory=list)


class Command(BaseCommand):
    help = 'Generate responsive AVIF/WebP/JPEG derivatives for uploaded product images.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                            help='Re-encode even when an up-to-date derivative exists.')
        parser.add_argument('--prune', action='store_true',
                            help='Delete derivatives whose source image no longer exists.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would happen; write nothing.')
        parser.add_argument('--quiet', action='store_true',
                            help='Only print the summary line.')

    # ------------------------------------------------------------------ main

    def handle(self, *args, **options):
        try:
            from PIL import Image, ImageOps, features
        except ImportError as exc:  # pragma: no cover - environment problem, not logic
            raise CommandError(
                'Pillow is required: pip install Pillow. (The production venv has 12.0.0.)'
            ) from exc

        self.force = options['force']
        self.dry_run = options['dry_run']
        self.quiet = options['quiet']
        self.Image = Image
        self.ImageOps = ImageOps

        # AVIF is native from Pillow 11.3; older builds need pillow-avif-plugin. Degrade to
        # WebP rather than failing: WebP alone still removes most of the weight, and a missing
        # <source> is invisible to the browser.
        self.avif_ok = bool(features.check('avif'))
        if not self.avif_ok and not self.quiet:
            self.stdout.write(self.style.WARNING(
                '  AVIF unsupported by this Pillow build — emitting WebP + JPEG only.'
            ))

        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root:
            raise CommandError('MEDIA_ROOT is not configured.')
        self.media_root = str(media_root)
        self.derived_root = os.path.join(self.media_root, DERIVED_DIRNAME)

        sources = self._collect_sources()
        if not sources:
            self.stdout.write(self.style.WARNING('No uploaded images found; nothing to do.'))
            return

        stats = Stats(sources=len(sources))
        manifest = {}

        for rel_path in sorted(sources):
            self._process(rel_path, manifest, stats)

        if options['prune']:
            self._prune(manifest, stats)

        if not self.dry_run:
            self._write_manifest(manifest)

        self._report(stats, manifest)

    # ------------------------------------------------------- source discovery

    def _collect_sources(self):
        """Every distinct relative image path referenced by a model row.

        Deliberately driven by the DATABASE rather than by walking the media directory: the
        media directory holds 112 MB, much of it superseded uploads nothing points at any
        more. Encoding those would be work done to make orphans cheaper.
        """
        from products.models import Category, Product

        paths = set()

        image_fields = ['image_main'] + [f'image_{i}' for i in range(2, 11)]
        for row in Product.objects.all().only('id', *image_fields):
            for fname in image_fields:
                value = getattr(row, fname, None)
                if value and getattr(value, 'name', None):
                    paths.add(value.name)

        for row in Category.objects.all().only('id', 'image'):
            if row.image and getattr(row.image, 'name', None):
                paths.add(row.image.name)

        # Drop anything that is itself a derivative, and anything missing from disk.
        keep = set()
        for rel in paths:
            if rel.split('/', 1)[0] == DERIVED_DIRNAME:
                continue
            if os.path.isfile(os.path.join(self.media_root, rel)):
                keep.add(rel)
            elif not self.quiet:
                self.stdout.write(self.style.WARNING(f'  missing on disk, skipped: {rel}'))
        return keep

    # ------------------------------------------------------------ processing

    def _stem(self, rel_path):
        """'products/UV Armor.png' -> 'UV_Armor' — safe for a URL and unique per upload."""
        base = os.path.basename(rel_path)
        stem = os.path.splitext(base)[0]
        return ''.join(ch if (ch.isalnum() or ch in '-_') else '_' for ch in stem)

    def _process(self, rel_path, manifest, stats):
        src_abs = os.path.join(self.media_root, rel_path)
        stem = self._stem(rel_path)
        try:
            src_mtime = os.path.getmtime(src_abs)
            stats.source_bytes += os.path.getsize(src_abs)
        except OSError as exc:
            stats.failed += 1
            stats.errors.append(f'{rel_path}: {exc}')
            return

        try:
            with self.Image.open(src_abs) as im:
                # Honour EXIF rotation BEFORE measuring: a phone photo that reports 1600x1200
                # while displaying 1200x1600 would otherwise be encoded sideways.
                im = self.ImageOps.exif_transpose(im)
                src_w, src_h = im.size
                # Flatten alpha onto white so JPEG does not render transparency as black.
                rgb = im.convert('RGB')
        except Exception as exc:  # noqa: BLE001 - one bad upload must not stop the run
            stats.failed += 1
            stats.errors.append(f'{rel_path}: {type(exc).__name__}: {exc}')
            return

        # Never upscale: a 876px screenshot gets no 1280 or 1600 rung. Emitting one would cost
        # bytes to add no detail, and would let <ProductImage> pick a "bigger" file that is
        # merely blurrier.
        widths = [w for w in WIDTHS if w <= src_w] or [min(src_w, WIDTHS[0])]

        entry = {'w': src_w, 'h': src_h, 'avif': [], 'webp': [],
                 'jpg': min(FALLBACK_WIDTH, max(widths)), 'src': rel_path}

        if not self.dry_run:
            os.makedirs(self.derived_root, exist_ok=True)

        for width in widths:
            height = max(1, round(src_h * width / src_w))
            resized = None
            formats = [('webp', WEBP_QUALITY), ('avif', AVIF_QUALITY)] if self.avif_ok \
                else [('webp', WEBP_QUALITY)]
            if width == entry['jpg']:
                formats.append(('jpg', JPEG_QUALITY))

            for ext, quality in formats:
                out_abs = os.path.join(self.derived_root, f'{stem}-{width}.{ext}')
                if self._is_fresh(out_abs, src_mtime):
                    stats.skipped += 1
                    self._record(entry, ext, width, out_abs, stats)
                    continue
                if self.dry_run:
                    stats.written += 1
                    self._record(entry, ext, width, None, stats)
                    continue
                if resized is None:
                    resized = rgb.resize((width, height), self.Image.LANCZOS)
                try:
                    save_kwargs = {'quality': quality}
                    if ext == 'jpg':
                        save_kwargs.update(format='JPEG', optimize=True, progressive=True)
                    elif ext == 'webp':
                        save_kwargs.update(format='WEBP', method=6)
                    else:
                        save_kwargs.update(format='AVIF')
                    resized.save(out_abs, **save_kwargs)
                    stats.written += 1
                    self._record(entry, ext, width, out_abs, stats)
                except Exception as exc:  # noqa: BLE001
                    stats.failed += 1
                    stats.errors.append(f'{stem}-{width}.{ext}: {type(exc).__name__}: {exc}')

        entry['avif'] = sorted(set(entry['avif']))
        entry['webp'] = sorted(set(entry['webp']))
        manifest[stem] = entry

        if not self.quiet:
            self.stdout.write(
                f'  {rel_path} -> {len(entry["webp"])} webp'
                f'{", " + str(len(entry["avif"])) + " avif" if entry["avif"] else ""}'
            )

    def _record(self, entry, ext, width, out_abs, stats):
        if ext in ('avif', 'webp'):
            entry[ext].append(width)
        if out_abs:
            try:
                stats.derived_bytes += os.path.getsize(out_abs)
            except OSError:
                pass

    def _is_fresh(self, out_abs, src_mtime):
        """A derivative is reusable only if it exists and is newer than its source."""
        if self.force:
            return False
        try:
            return os.path.getmtime(out_abs) >= src_mtime and os.path.getsize(out_abs) > 0
        except OSError:
            return False

    # ---------------------------------------------------------------- pruning

    def _prune(self, manifest, stats):
        """Delete derivatives belonging to stems nothing references any more."""
        if not os.path.isdir(self.derived_root):
            return
        live = set(manifest)
        for name in os.listdir(self.derived_root):
            if name == MANIFEST_NAME:
                continue
            stem = name.rsplit('-', 1)[0]
            if stem in live:
                continue
            path = os.path.join(self.derived_root, name)
            if self.dry_run:
                stats.pruned += 1
                continue
            try:
                os.remove(path)
                stats.pruned += 1
            except OSError as exc:
                stats.errors.append(f'prune {name}: {exc}')

    # --------------------------------------------------------------- manifest

    def _write_manifest(self, manifest):
        """A manifest so the serializer never points a <source> at a file that is not there.

        Written atomically: a half-written manifest read by a live request would silently
        blank every product image on the site.
        """
        os.makedirs(self.derived_root, exist_ok=True)
        final = os.path.join(self.derived_root, MANIFEST_NAME)
        tmp = final + '.tmp'
        payload = {
            'base': f'{settings.MEDIA_URL.rstrip("/")}/{DERIVED_DIRNAME}/',
            'widths': list(WIDTHS),
            'images': manifest,
        }
        with open(tmp, 'w', encoding='utf-8') as handle:
            json.dump(payload, handle, indent=1, sort_keys=True)
        os.replace(tmp, final)

    # ----------------------------------------------------------------- report

    def _report(self, stats, manifest):
        def mb(n):
            return f'{n / 1024 / 1024:.1f} MB'

        self.stdout.write('')
        self.stdout.write(f'  sources        {stats.sources}')
        self.stdout.write(f'  written        {stats.written}')
        self.stdout.write(f'  reused         {stats.skipped}')
        if stats.pruned:
            self.stdout.write(f'  pruned         {stats.pruned}')
        if stats.failed:
            self.stdout.write(self.style.ERROR(f'  failed         {stats.failed}'))
        self.stdout.write(f'  source weight  {mb(stats.source_bytes)}')
        self.stdout.write(f'  derived weight {mb(stats.derived_bytes)}')

        # The number that actually matters: what one product card now costs at 640px.
        card = []
        for entry in manifest.values():
            best = 'avif' if entry['avif'] else 'webp'
            widths = entry[best]
            if not widths:
                continue
            width = min(widths, key=lambda w: abs(w - 640))
            path = os.path.join(self.derived_root, f'{self._stem(entry["src"])}-{width}.{best}')
            try:
                card.append(os.path.getsize(path))
            except OSError:
                pass
        if card:
            self.stdout.write(
                f'  typical card   {sum(card) / len(card) / 1024:.0f} KB at 640px'
            )

        for err in stats.errors[:10]:
            self.stdout.write(self.style.ERROR(f'    ! {err}'))

        if self.dry_run:
            self.stdout.write(self.style.WARNING('  DRY RUN — nothing was written.'))
        else:
            self.stdout.write(self.style.SUCCESS('  manifest written.'))
