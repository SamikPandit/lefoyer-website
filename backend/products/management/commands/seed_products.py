import decimal
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from django.db import transaction
from products.models import Category, SubCategory, Product

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
    help = 'Seeds the database with initial product data for Le foyeR.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write('Deleting old product data...')
        # Order of deletion is important due to foreign key constraints
        Product.objects.all().delete()
        SubCategory.objects.all().delete()
        Category.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('Old data deleted.'))

        self.stdout.write('Creating new data...')
        
        products_created = 0
        categories_created = 0
        subcategories_created = 0

        for data in PRODUCTS_DATA:
            # Get or create the Category
            category_obj, created = Category.objects.get_or_create(
                name=data['category'],
                defaults={'slug': slugify(data['category'])}
            )
            if created:
                categories_created += 1

            # Get or create the SubCategory, linking it to the Category
            subcategory_obj, created = SubCategory.objects.get_or_create(
                name=data['sub_category'],
                defaults={
                    'slug': slugify(data['sub_category']),
                    'category': category_obj
                }
            )
            if created:
                subcategories_created += 1

            # Create the Product
            Product.objects.create(
                name=data['name'],
                slug=slugify(data['name']),
                category=category_obj,
                sub_category=subcategory_obj,
                price=decimal.Decimal(data['price']),
                description=data['description'],
                key_benefits=data['key_benefits'],
                key_features=data['key_features'],
                ingredients=data['ingredients'],
                how_to_use=data['how_to_use'],
                suitable_for=data['suitable_for'],
                size=data['size'],
                sku=data['sku'],
                stock_quantity=data['stock_quantity'],
                is_featured=data['is_featured'],
                is_bestseller=data['is_bestseller'],
                # NOTE: Image fields are intentionally left blank.
                # Seeding images requires actual image files and is typically
                # handled manually or via a more complex script.
            )
            products_created += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nSuccessfully seeded database!\n'
            f'- Categories created: {categories_created}\n'
            f'- Sub-Categories created: {subcategories_created}\n'
            f'- Products created: {products_created}\n'
        ))