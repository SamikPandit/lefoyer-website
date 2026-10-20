"""Populate the taxonomy from what the catalogue actually evidences.

IMPL_SPEC §2c, `products` 0008. Data only: idempotent, non-destructive, and
reversible to a no-op.

Three rules govern this migration, and all three exist because the alternative
was tried and shipped broken navigation.

**1. No concern is invented (LF-24).** The `Concern` rows are the eight real
sub-category slugs, plus any further `SubCategory` row this database actually
holds — catalogue evidence is the only thing that creates a navigation group.
The dead frontend component `ShopByConcern.jsx` offers two more concerns on
top of those; no product in the catalogue is tagged for either, so a tile for
them would be a link to an empty listing, and one of the two is an
unsubstantiated anti-ageing claim besides (LF-05). Neither can appear here,
because neither is a sub-category: the derivation is the guard.

**2. `suitable_for` is mapped by exact string, never split.** The column holds
six verified free-text phrases (§1 C-11) and the only commas in them are
inside `"All Skin Types, including Sensitive"`. Splitting on `,` yields
`" including Sensitive & Acne-Prone"`, which is how a facet gets a garbage
value. Anything outside the six-string table is **logged and left unmapped**:
production's exact strings cannot be read from here, and a guessed mapping
would put a product in front of the wrong skin type.

**3. The two hair strings map to no skin type.** `"All Hair Types"` is not a
skin type. Leaving them unmapped is correct, not an omission.

Reverse is a no-op on purpose. Rolling back must not delete taxonomy rows: by
the time anybody rolls back, a merchandiser may have attached products to a
concern by hand, and `0008` cannot tell those apart from its own writes.

**Running it on a database that was empty when it first ran.** On production
the catalogue already exists, so one pass tags everything. Locally the order is
the other way round — `migrate` runs against an empty database and
`seed_products` loads the catalogue afterwards — so the concern and skin-type
rows get created but nothing is tagged. Because forwards is idempotent and
reverse is a no-op, the fix is to replay it:

    python manage.py migrate products 0007 && python manage.py migrate products

That is the supported way to backfill after a seed; it is not a workaround.
"""

import logging

from django.db import migrations
from django.utils.text import slugify

logger = logging.getLogger(__name__)

# §2c. `slug -> display name`, in the order they should appear in navigation.
SKIN_TYPES = (
    ('normal', 'Normal'),
    ('dry', 'Dry'),
    ('oily', 'Oily'),
    ('combination', 'Combination'),
    ('sensitive', 'Sensitive'),
    ('acne-prone', 'Acne-Prone'),
)

# §2c, verified against the live sub-category list (§1 C-11): the eight real
# sub-category slugs, mapped 1:1 onto concerns. Created unconditionally so the
# facet list exists on a database whose catalogue has not been loaded yet; any
# *additional* sub-category found in the database gets a concern too, so this
# list is a floor, not a ceiling.
CONCERNS = (
    ('cleansers', 'Cleansers'),
    ('brightening-anti-pigmentation', 'Brightening & Anti-Pigmentation'),
    ('moisturizers-hydrators', 'Moisturizers & Hydrators'),
    ('sun-protection', 'Sun Protection'),
    ('serums-treatments', 'Serums & Treatments'),
    ('shampoo-conditioner', 'Shampoo & Conditioner'),
    ('body-care', 'Body Care'),
    ('lip-care', 'Lip Care'),
)

_ALL_SKIN = ('normal', 'dry', 'oily', 'combination')

# The six verified `suitable_for` strings and nothing else (§1 C-11).
SUITABLE_FOR_MAP = {
    'Oily & Acne-Prone Skin': ('oily', 'acne-prone'),
    'All Skin Types': _ALL_SKIN,
    'All Skin Types, including Sensitive': _ALL_SKIN + ('sensitive',),
    'All Skin Types, including Sensitive & Acne-Prone': _ALL_SKIN + ('sensitive', 'acne-prone'),
    # Haircare. Deliberately empty: a hair type is not a skin type.
    'All Hair Types': (),
    'All Hair Types, including Damaged & Color-Treated': (),
}


def forwards(apps, schema_editor):
    Concern = apps.get_model('products', 'Concern')
    SkinType = apps.get_model('products', 'SkinType')
    SubCategory = apps.get_model('products', 'SubCategory')
    Product = apps.get_model('products', 'Product')

    # -- skin types --------------------------------------------------------
    skin_types = {}
    for index, (slug, name) in enumerate(SKIN_TYPES, start=1):
        obj, created = SkinType.objects.get_or_create(
            slug=slug, defaults={'name': name, 'display_order': index * 10}
        )
        skin_types[slug] = obj
        if created:
            logger.info("0008: created SkinType %s", slug)

    # -- concerns, one per real sub-category -------------------------------
    concerns_by_slug = {}
    candidates = list(CONCERNS)
    known = {slug for slug, _ in CONCERNS}
    for sub in SubCategory.objects.order_by('category_id', 'id'):
        slug = sub.slug or slugify(sub.name)
        if slug not in known:
            logger.info(
                "0008: SubCategory %r is not in the verified eight; deriving a "
                "Concern from it anyway, because the catalogue evidences it.", slug
            )
            candidates.append((slug, sub.name))
            known.add(slug)

    for index, (slug, name) in enumerate(candidates, start=1):
        obj, created = Concern.objects.get_or_create(
            slug=slug,
            defaults={'name': name, 'display_order': index * 10, 'icon_key': slug},
        )
        concerns_by_slug[slug] = obj
        if created:
            logger.info("0008: created Concern %s", slug)

    # -- tag the products --------------------------------------------------
    # `add()` rather than `set()`: this migration must never remove a tag a
    # merchandiser added by hand, and `add()` is already idempotent.
    unmapped = {}
    products = Product.objects.select_related('sub_category').only(
        'id', 'suitable_for', 'sub_category__slug'
    )
    for product in products:
        concern = concerns_by_slug.get(getattr(product.sub_category, 'slug', None))
        if concern is not None:
            product.concerns.add(concern)

        raw = (product.suitable_for or '').strip()
        if raw in SUITABLE_FOR_MAP:
            slugs = SUITABLE_FOR_MAP[raw]
            if slugs:
                product.skin_types.add(*[skin_types[s] for s in slugs])
        elif raw:
            unmapped.setdefault(raw, 0)
            unmapped[raw] += 1

    for value, count in sorted(unmapped.items()):
        logger.warning(
            "0008: suitable_for %r (%s product(s)) is not one of the six "
            "verified strings and was LEFT UNMAPPED. Map it by hand in the "
            "admin; do not guess it here. (IMPL_SPEC §1 C-11)",
            value, count,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_concern_skintype_stocknotification'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
