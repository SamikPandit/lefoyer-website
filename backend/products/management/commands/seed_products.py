"""Development-only catalogue seeder.

READ THIS BEFORE RUNNING IT ANYWHERE THAT MATTERS.

This command used to open with an unconditional
``Product.objects.all().delete()`` and then re-create all ten rows from the
literals below. Three things made that dangerous:

1. It deleted the whole catalogue with no flag, no confirmation and no DEBUG
   check, so a mistyped command on a production shell wiped the catalogue.
2. ``OrderItem.product`` cascaded, so deleting products also deleted order
   history — and with it the evidence behind every "Verified Buyer" review.
3. The commercial values in this file disagree with
   ``backend/latest_products.json`` (see the banner below) and neither file is
   the live database, so re-creating rows from here silently overwrote whatever
   the business had actually set.

It is now a non-destructive upsert keyed on SKU. It refuses to run outside
DEBUG, the delete is behind ``--force``, and it never writes a product's price,
merchandising flags, visibility or stock level to an existing row. See
IMPL_SPEC §4 LF-19: the live database is authoritative, neither file is.
"""

import decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError
from django.utils.text import slugify

from products.models import Category, Product, SubCategory

# Fields this command will write to an EXISTING row: descriptive copy only.
# `slug` is deliberately absent — changing it breaks every live product URL and
# every inbound link.
COPY_FIELDS = (
    'name',
    'description',
    'key_benefits',
    'key_features',
    'ingredients',
    'how_to_use',
    'suitable_for',
    'size',
    'category',
    'sub_category',
)

# Fields written ONLY when creating a brand-new row, never on update.
# IMPL_SPEC §4 LF-19: no package in this change-set writes a price, an
# is_featured/is_bestseller flag or a show_at_website value, because the
# approved product master has not been supplied and the live database is the
# only authority. `stock_quantity` is here for the same reason — it is live
# inventory, not seed data.
CREATE_ONLY_FIELDS = (
    'slug',
    'sku',
    'price',
    'stock_quantity',
    'is_featured',
    'is_bestseller',
)

# IMPL_SPEC §1 C-10, verified by reading both files. Printed on every run so
# nobody treats either file as the master.
PRICE_CONFLICT_BANNER = """
================================================================================
 CATALOGUE SOURCE CONFLICT — neither this file nor latest_products.json is
 authoritative. The LIVE DATABASE is. (IMPL_SPEC §1 C-10, §4 LF-19)
--------------------------------------------------------------------------------
 PRICE disagreements (2 of 10 SKUs):
   LF-SK-CL01  Spotless Face Wash    this file 349.00  vs  fixture 280.00
   LF-SK-CL02  WhiteWave Face Wash   this file 399.00  vs  fixture 280.00
   The other 8 SKUs agree.

 is_featured disagreement:
   this file marks 6 featured (CL01, CL02, SK-SE01, SK-MO01, HA-SC01, HA-SE01)
   latest_products.json marks 2 featured (CL01, CL02 only)

 show_at_website disagreement:
   latest_products.json sets show_at_website=False on 8 of 10 SKUs — only
   Spotless Face Wash and WhiteWave Face Wash are visible in that fixture.

 CONSEQUENCE: this command writes price, is_featured, is_bestseller,
 show_at_website and stock_quantity ONLY when it creates a row that does not
 exist yet. On an existing SKU it updates descriptive copy and nothing else.
 TODO(business): supply the approved product master — per SKU, the selling
 price, the show_at_website flag, the is_featured / is_bestseller /
 display_order merchandising intent, and the approved description, benefits,
 ingredients and suitability text that must match the marketplace listings.
================================================================================
"""

# This is the main data structure containing all product information.
# It's designed to be easily readable and maintainable.
PRODUCTS_DATA = [
    {
        'category': 'Skincare',
        'sub_category': 'Cleansers',
        'name': 'Spotless Face Wash',
        'price': '349.00',
        'description': 'A deep cleansing face wash specifically formulated for acne-prone and oily skin. It effectively removes dirt, excess oil, and impurities to rejuvenate dull skin and prevent future breakouts.',
        'key_benefits': """- Deeply cleanses for clear, even-toned skin
- Helps reduce blemishes, dark spots, and pigmentation
- Gently exfoliates to unclog pores
- Controls excess oil production
- Smoothens and softens skin texture""",
        'key_features': """- Prevents Acne
- Gentle Exfoliation
- Unclogs Pores & Controls Oil
- pH-Balanced Formula""",
        'ingredients': 'Aqua, Salicylic Acid, Tea Tree Oil, Niacinamide, Glycerin, Cocamidopropyl Betaine, Sodium Lauroyl Sarcosinate.',
        'how_to_use': 'Apply a small amount to your wet face and gently massage with your fingertips in a circular motion. Rinse off with water and pat dry. Use twice daily for best results.',
        'suitable_for': 'Oily & Acne-Prone Skin',
        'size': '100 ml / 3.38 fl oz',
        'sku': 'LF-SK-CL01',
        'stock_quantity': 150,
        'is_featured': True,
        'is_bestseller': True,
    },
    {
        'category': 'Skincare',
        'sub_category': 'Cleansers',
        'name': 'WhiteWave Face Wash',
        'price': '399.00',
        'description': 'A soap-free, gentle cleanser designed for skin brightening and hydration. Its unique formula provides anti-pigmentation action while boosting moisture for a radiant complexion.',
        'key_benefits': """- Brightens skin tone and improves evenness
- Provides anti-pigmentation action to reduce dark spots
- Delivers a powerful hydration and moisture boost
- Offers antioxidant protection against environmental damage
- Deep yet gentle cleanse suitable for sensitive skin""",
        'key_features': """- Skin Brightening Complex
- Soap-Free Formula
- Hydration & Moisture Boost
- Antioxidant Protection""",
        'ingredients': 'Aqua, Vitamin C (Ethyl Ascorbic Acid), Licorice Extract, Mulberry Extract, Glycerin, Sodium Hyaluronate.',
        'how_to_use': 'Moisten face, apply a small quantity of face wash, and gently work up a lather using a circular motion. Wash off and pat dry. Use daily.',
        'suitable_for': 'All Skin Types, including Sensitive',
        'size': '100 ml / 3.38 fl oz',
        'sku': 'LF-SK-CL02',
        'stock_quantity': 120,
        'is_featured': True,
        'is_bestseller': False,
    },
    {
        'category': 'Skincare',
        'sub_category': 'Brightening & Anti-Pigmentation',
        'name': 'Glowing C Vitamin C Face Serum',
        'price': '649.00',
        'description': 'A high-potency antioxidant serum formulated with Pure Vitamin C (Ascorbic Acid) to boost collagen production, fade dark spots, and protect against sun damage for a revitalized, even skin tone.',
        'key_benefits': """- Boosts collagen production for firmer skin
- Fades dark spots, pigmentation, and sun damage
- Provides powerful antioxidant protection
- Hydrates and revitalizes for a radiant glow
- Evens out skin tone and texture""",
        'key_features': """- Pure Vitamin C (Ascorbic Acid)
- High-Potency Formula
- Hydrating & Revitalizing
- Lightweight & Fast-Absorbing""",
        'ingredients': 'Aqua, Ascorbic Acid (Vitamin C), Ferulic Acid, Hyaluronic Acid, Vitamin E, Glycerin, Witch Hazel Extract.',
        'how_to_use': 'After cleansing and toning, apply 2-3 drops of serum to your face and neck. Gently pat it into the skin. Use in the morning before sunscreen.',
        'suitable_for': 'All Skin Types',
        'size': '30 ml / 1 fl oz',
        'sku': 'LF-SK-SE01',
        'stock_quantity': 90,
        'is_featured': True,
        'is_bestseller': True,
    },
    {
        'category': 'Skincare',
        'sub_category': 'Brightening & Anti-Pigmentation',
        'name': 'Luminaa Skin Whitening Cream',
        'price': '799.00',
        'description': 'A multi-action cream with an advanced whitening complex to lighten skin tone, control pigmentation, and provide long-lasting moisture for a youthful, glowing appearance.',
        'key_benefits': """- Lightens and brightens overall skin tone
- Reduces dark spots, hyperpigmentation, and unevenness
- Provides long-lasting moisture and hydration
- Boosts skin with an antioxidant-rich formula
- Promotes a youthful and glowing complexion""",
        'key_features': """- Advanced Whitening Complex
- Pigmentation Control
- Non-Greasy & Fast-Absorbing
- Safe & Gentle Formula""",
        'ingredients': 'Aqua, Kojic Acid, Arbutin, Vitamin E, Niacinamide, Shea Butter, Titanium Dioxide.',
        'how_to_use': 'Apply evenly to face and neck after cleansing. Gently massage in an upward circular motion. For best results, use twice daily.',
        'suitable_for': 'All Skin Types, including Sensitive',
        'size': '20 gm / 0.7 oz',
        'sku': 'LF-SK-CR01',
        'stock_quantity': 110,
        'is_featured': False,
        'is_bestseller': False,
    },
    {
        'category': 'Skincare',
        'sub_category': 'Moisturizers & Hydrators',
        'name': 'Moisturize Me Moisturizer',
        'price': '499.00',
        'description': 'A daily moisturizer providing intense, 24-hour hydration and skin barrier repair. Formulated with SPF 30, it soothes irritation and improves skin texture while protecting from UV damage.',
        'key_benefits': """- Provides 24-hour moisture lock (lasts up to 48 hours)
- Restores the skin's natural moisture barrier
- Soothes irritation and dryness
- Improves skin texture and increases radiance
- Offers SPF 30 UV protection""",
        'key_features': """- 24-Hour Moisture Lock
- Barrier Repair Formula
- Lightweight & Non-Greasy
- SPF 30 UV Protection""",
        'ingredients': 'Aqua, Hyaluronic Acid, Ceramides, Glycerin, Octinoxate, Zinc Oxide, Shea Butter.',
        'how_to_use': 'Apply liberally to the face and neck 15 minutes before sun exposure. Reapply at least every 2 hours. Use daily as the last step in your skincare routine.',
        'suitable_for': 'All Skin Types, including Sensitive & Acne-Prone',
        'size': '200 ml / 6.76 fl oz',
        'sku': 'LF-SK-MO01',
        'stock_quantity': 130,
        'is_featured': True,
        'is_bestseller': False,
    },
    {
        'category': 'Skincare',
        'sub_category': 'Sun Protection',
        'name': 'UV Armor Tinted Sunscreen',
        'price': '549.00',
        'description': 'A broad-spectrum SPF 50+ sunscreen that protects against UVA, UVB, and blue light. Its lightweight, tinted formula provides a natural, even-toned finish, making it ideal for daily use.',
        'key_benefits': """- Prevents sunburn, premature aging, and tanning
- Provides a natural, even-toned finish with a light tint
- Water and sweat-resistant for long-lasting protection
- Non-comedogenic formula won't clog pores
- Leaves no white cast""",
        'key_features': """- Broad-Spectrum SPF 50+
- Tinted Coverage
- Lightweight & Non-Greasy
- Antioxidant Boost""",
        'ingredients': 'Aqua, Zinc Oxide, Titanium Dioxide, Vitamin E, Iron Oxides, Niacinamide, Cyclopentasiloxane.',
        'how_to_use': 'Apply generously and evenly to all exposed skin 15 minutes before sun exposure. Reapply frequently, especially after swimming, sweating, or towel drying.',
        'suitable_for': 'All Skin Types, including Sensitive',
        'size': '100 ml / 3.38 fl oz',
        'sku': 'LF-SK-SU01',
        'stock_quantity': 100,
        'is_featured': False,
        'is_bestseller': True,
    },
    {
        'category': 'Haircare',
        'sub_category': 'Shampoo & Conditioner',
        'name': 'HairSurance Shampoo + Conditioner',
        'price': '449.00',
        'description': 'A 2-in-1 formula that gently cleanses while deeply nourishing and hydrating. It controls hair fall, reduces frizz, and restores vitality for thicker, fuller, and more manageable hair.',
        'key_benefits': """- Controls hair fall and nourishes follicles
- Restores vitality for thicker and fuller hair
- Adds shine, softness, and manageability
- Reduces frizz and tangles for a smooth, silky finish
- Protects hair from styling, heat, and environmental damage""",
        'key_features': """- Controls Hair Fall
- Nourishes Hair Follicles
- Frizz & Tangle Reduction
- Suitable for Daily Use""",
        'ingredients': 'Aqua, Keratin, Argan Oil, Biotin, Caffeine, Sodium Lauroyl Sarcosinate, Cocamidopropyl Betaine.',
        'how_to_use': 'Apply to wet hair, lather, and gently massage the scalp and hair. Leave on for 2-3 minutes, then rinse thoroughly. No need for a separate conditioner.',
        'suitable_for': 'All Hair Types, including Damaged & Color-Treated',
        'size': '100 ml / 3.38 fl oz',
        'sku': 'LF-HA-SC01',
        'stock_quantity': 140,
        'is_featured': True,
        'is_bestseller': False,
    },
    {
        'category': 'Haircare',
        'sub_category': 'Serums & Treatments',
        'name': 'Bollywood Hair Serum',
        'price': '599.00',
        'description': 'A multi-benefit serum with advanced hair growth actives to reduce hair fall and thinning. Its non-greasy formula adds instant shine, controls frizz, and protects hair from heat and pollution.',
        'key_benefits': """- Reduces hair fall and thinning
- Strengthens hair from root to tip
- Promotes thicker, fuller, and healthier-looking hair
- Adds instant shine and smoothness
- Protects hair from heat, pollution, and styling damage""",
        'key_features': """- Advanced Hair Growth Actives
- Frizz Control
- Non-Greasy Formula
- Heat Protection""",
        'ingredients': 'Cyclopentasiloxane, Dimethiconol, Vitamin E, Argan Oil, Jojoba Oil, Fragrance.',
        'how_to_use': 'Take a few drops of serum onto your palms and apply evenly through damp or dry hair, focusing on the mid-lengths and ends. Style as desired.',
        'suitable_for': 'All Hair Types',
        'size': '50 ml / 1.69 fl oz',
        'sku': 'LF-HA-SE01',
        'stock_quantity': 80,
        'is_featured': True,
        'is_bestseller': True,
    },
    {
        'category': 'Body & Lip Care',
        'sub_category': 'Body Care',
        'name': 'Raindrops Shower Gel',
        'price': '299.00',
        'description': 'A hydrating and refreshing body wash for daily use. Its gentle, non-drying formula cleanses and energizes the skin, leaving it feeling soft, smooth, and revitalized.',
        'key_benefits': """- Gently cleanses and hydrates the skin
- Ideal for daily use to refresh and energize
- Leaves skin feeling soft, smooth, and refreshed
- Non-drying and antioxidant-rich formula""",
        'key_features': """- Gentle Cleansing Formula
- Hydrating & Nourishing
- Refreshing Fragrance
- Antioxidant-Rich""",
        'ingredients': 'Aqua, Aloe Vera Extract, Green Tea Extract, Glycerin, Sodium Laureth Sulfate, Cocamidopropyl Betaine.',
        'how_to_use': 'Pour a small amount onto a wet loofah or your palm. Apply gently over wet skin to create a lather and rinse off.',
        'suitable_for': 'All Skin Types, including Sensitive',
        'size': '100 ml / 3.38 fl oz',
        'sku': 'LF-BC-SG01',
        'stock_quantity': 200,
        'is_featured': False,
        'is_bestseller': False,
    },
    {
        'category': 'Body & Lip Care',
        'sub_category': 'Lip Care',
        'name': 'Lip Lock Lip Balm',
        'price': '249.00',
        'description': 'A nourishing lip balm that provides deep, long-lasting hydration. It protects lips from harsh weather, heals irritation, and soothes dryness for soft, healthy lips.',
        'key_benefits': """- Moisturizes dry and chapped lips
- Provides long-lasting hydration
- Protects lips from sun, wind, and cold
- Heals and soothes irritated lips""",
        'key_features': """- Deep Hydration & Moisture
- Protects Against Harsh Weather
- Natural Oils for Nourishment
- Gentle & Non-Irritating""",
        'ingredients': 'Beeswax, Shea Butter, Cocoa Butter, Jojoba Oil, Vitamin E, SPF 15.',
        'how_to_use': 'Apply liberally to lips as often as needed, particularly in dry, cold, or windy conditions.',
        'suitable_for': 'All Skin Types',
        'size': '15 gm / 0.53 oz',
        'sku': 'LF-BC-LB01',
        'stock_quantity': 180,
        'is_featured': False,
        'is_bestseller': True,
    },
]


class Command(BaseCommand):
    help = (
        'Development-only catalogue seeder. Non-destructive by default: upserts '
        'the ten built-in SKUs by SKU, writing descriptive copy only. Refuses to '
        'run unless DEBUG is True. Use --force to delete the existing catalogue '
        'first (dangerous, see --help on that flag).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help=(
                'DESTRUCTIVE. Delete every Product, SubCategory and Category '
                'before seeding. Without this flag the command only upserts.'
            ),
        )
        parser.add_argument(
            '--i-know-this-deletes-everything',
            action='store_true',
            dest='override_debug_guard',
            help=(
                'Permit the command to run while DEBUG is False. There is no '
                'legitimate reason to do this on a box that serves customers.'
            ),
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would change and roll back without writing.',
        )

    def handle(self, *args, **options):
        force = options['force']
        override = options['override_debug_guard']
        dry_run = options['dry_run']

        self.stdout.write(PRICE_CONFLICT_BANNER)

        # ---- Guard 1: never run against a non-debug database by accident. ----
        if not settings.DEBUG and not override:
            raise CommandError(
                'Refusing to run: DEBUG is False.\n'
                'This command writes to the product catalogue and, with --force, '
                'deletes it. The live catalogue is the authoritative source for '
                'prices and merchandising (IMPL_SPEC §4 LF-19) and must not be '
                'reseeded from the literals in this file.\n'
                'If you genuinely intend to run it here, pass '
                '--i-know-this-deletes-everything and take a database backup '
                'first.'
            )
        if not settings.DEBUG and override:
            self.stdout.write(self.style.WARNING(
                'DEBUG is False and the guard was overridden explicitly. '
                'Proceeding against a non-debug database.'
            ))

        try:
            with transaction.atomic():
                if force:
                    self._destroy_catalogue()
                else:
                    self.stdout.write(
                        'Running in upsert mode (no --force): nothing will be '
                        'deleted.'
                    )

                created, updated = self._upsert_products()

                self.stdout.write(self.style.SUCCESS(
                    f'\nProducts created: {created}\n'
                    f'Products updated (descriptive copy only): {updated}\n'
                ))

                if dry_run:
                    raise _DryRunRollback()
        except _DryRunRollback:
            self.stdout.write(self.style.WARNING(
                '--dry-run: all of the above was rolled back. Nothing was '
                'written.'
            ))

    # ------------------------------------------------------------------ #

    def _destroy_catalogue(self):
        """The old unconditional delete, now behind --force and explained."""
        product_count = Product.objects.count()
        self.stdout.write(self.style.WARNING(
            f'--force: deleting {product_count} product(s) and the whole '
            f'category tree.'
        ))
        try:
            # Order matters: products reference sub-categories, which reference
            # categories.
            Product.objects.all().delete()
            SubCategory.objects.all().delete()
            Category.objects.all().delete()
        except ProtectedError as exc:
            raise CommandError(
                'Refusing to delete: at least one product is referenced by an '
                'order line, which is protected so that order history and '
                'verified-purchase evidence survive a catalogue edit.\n'
                'Re-run without --force to upsert instead.\n'
                f'Protected objects: {exc.protected_objects!r}'
            ) from exc
        self.stdout.write(self.style.SUCCESS('Old catalogue deleted.'))

    def _upsert_products(self):
        created = 0
        updated = 0

        for data in PRODUCTS_DATA:
            category_obj, _ = Category.objects.get_or_create(
                name=data['category'],
                defaults={'slug': slugify(data['category'])},
            )
            subcategory_obj, _ = SubCategory.objects.get_or_create(
                name=data['sub_category'],
                defaults={
                    'slug': slugify(data['sub_category']),
                    'category': category_obj,
                },
            )

            copy_values = {
                'name': data['name'],
                'description': data['description'],
                'key_benefits': data['key_benefits'],
                'key_features': data['key_features'],
                'ingredients': data['ingredients'],
                'how_to_use': data['how_to_use'],
                'suitable_for': data['suitable_for'],
                'size': data['size'],
                'category': category_obj,
                'sub_category': subcategory_obj,
            }
            assert set(copy_values) == set(COPY_FIELDS)

            existing = Product.objects.filter(sku=data['sku']).first()

            if existing is None:
                # A brand-new row needs the commercial fields: price is NOT
                # NULL and a product with no price cannot exist. These values
                # are seed data for a development database only.
                create_values = {
                    'slug': slugify(data['name']),
                    'sku': data['sku'],
                    'price': decimal.Decimal(data['price']),
                    'stock_quantity': data['stock_quantity'],
                    'is_featured': data['is_featured'],
                    'is_bestseller': data['is_bestseller'],
                }
                assert set(create_values) == set(CREATE_ONLY_FIELDS)
                # Image fields are intentionally left blank: seeding images
                # needs real files and is done by hand.
                Product.objects.create(**create_values, **copy_values)
                created += 1
                self.stdout.write(
                    f"  created  {data['sku']:<12} {data['name']}"
                )
            else:
                for field, value in copy_values.items():
                    setattr(existing, field, value)
                # 'updated_at' is auto_now; without it in update_fields
                # the timestamp would not advance.
                existing.save(
                    update_fields=list(copy_values.keys()) + ['updated_at']
                )
                updated += 1
                self.stdout.write(
                    f"  updated  {data['sku']:<12} {data['name']}  "
                    f"(price {existing.price}, is_featured "
                    f"{existing.is_featured}, show_at_website "
                    f"{existing.show_at_website} left untouched)"
                )

        return created, updated


class _DryRunRollback(Exception):
    """Internal: unwinds the transaction for --dry-run."""
