"""Read the derivative manifest written by `manage.py optimize_media`.

The API's job here is narrow: tell the client which responsive derivatives actually exist on
disk for a given upload, so `<ProductImage>` can build a `srcset` without ever pointing a
`<source>` at a 404. A missing `<source>` is invisible; a broken one is a broken image, because
the browser will not fall back to the next candidate once it has committed to a format.

This mirrors `frontend/src/generated/derivedImages.js`, which does the same job for the masters
committed to the repo. Two sources, one shape, so the component needs one code path.

Everything degrades to `None`, which the serializer renders as `null` and the client reads as
"just use `image_main`". A missing, unreadable or malformed manifest therefore costs image
weight and nothing else — it can never blank a product image.
"""
from __future__ import annotations

import json
import logging
import os
import threading

from django.conf import settings

logger = logging.getLogger(__name__)

DERIVED_DIRNAME = 'derived'
MANIFEST_NAME = 'manifest.json'

# The manifest is a few KB and is read on every product serialization, so it is cached in
# process and invalidated by mtime. A lock keeps a reload from being done N times at once by
# concurrent gunicorn threads during a deploy.
_lock = threading.Lock()
_cache = {'mtime': None, 'payload': None}


def _manifest_path():
    media_root = getattr(settings, 'MEDIA_ROOT', None)
    if not media_root:
        return None
    return os.path.join(str(media_root), DERIVED_DIRNAME, MANIFEST_NAME)


def _load():
    """Return the parsed manifest, reloading only when the file on disk has changed."""
    path = _manifest_path()
    if not path:
        return None
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        # Not generated yet. Normal on a fresh install; not worth a log line per request.
        return None

    if _cache['mtime'] == mtime:
        return _cache['payload']

    with _lock:
        # Re-check inside the lock: another thread may have just loaded it.
        if _cache['mtime'] == mtime:
            return _cache['payload']
        try:
            with open(path, 'r', encoding='utf-8') as handle:
                payload = json.load(handle)
            if not isinstance(payload, dict) or not isinstance(payload.get('images'), dict):
                raise ValueError('manifest has no "images" mapping')
        except Exception as exc:  # noqa: BLE001 - a bad manifest must not 500 the catalogue
            logger.warning('Ignoring unreadable derivative manifest %s: %s', path, exc)
            _cache['mtime'], _cache['payload'] = mtime, None
            return None
        _cache['mtime'], _cache['payload'] = mtime, payload
        return payload


def stem_for(name):
    """'products/UV Armor.png' -> 'UV_Armor'. Must match Command._stem exactly."""
    base = os.path.basename(name or '')
    stem = os.path.splitext(base)[0]
    return ''.join(ch if (ch.isalnum() or ch in '-_') else '_' for ch in stem)


def derived_for(image_field, request=None):
    """Describe the derivatives of one ImageField, or None if there are none.

    Returns, e.g.::

        {
          "base": "https://host/media/derived/",
          "stem": "WhatsApp_Image_2026-02-16_at_4_03_55_PM",
          "w": 1600, "h": 1600,
          "avif": [160, 320, 480, 640, 960, 1280, 1600],
          "webp": [160, 320, 480, 640, 960, 1280, 1600],
          "jpg": 1280
        }

    Widths are only ever those that exist on disk, and `optimize_media` never upscales, so a
    876px screenshot reports four rungs rather than seven.
    """
    if not image_field or not getattr(image_field, 'name', None):
        return None

    payload = _load()
    if not payload:
        return None

    entry = payload['images'].get(stem_for(image_field.name))
    if not entry:
        return None

    avif = [w for w in entry.get('avif') or [] if isinstance(w, int)]
    webp = [w for w in entry.get('webp') or [] if isinstance(w, int)]
    if not avif and not webp:
        return None

    base = payload.get('base') or f'{settings.MEDIA_URL.rstrip("/")}/{DERIVED_DIRNAME}/'
    if request is not None and base.startswith('/'):
        base = request.build_absolute_uri(base)

    return {
        'base': base,
        'stem': stem_for(image_field.name),
        'w': entry.get('w'),
        'h': entry.get('h'),
        'avif': sorted(avif),
        'webp': sorted(webp),
        'jpg': entry.get('jpg'),
    }


def reset_cache():
    """Test seam: force the next read to hit disk."""
    with _lock:
        _cache['mtime'], _cache['payload'] = None, None
