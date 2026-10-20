"""Initial content/CMS schema, plus the IMPL_SPEC §4 SAFE DEFAULTS.

The seeding step at the bottom is what lets the storefront ship honest copy on
day one: the substantiated-only claim set, the approved replacement hero copy,
and ONE delivery/returns policy in place of the five contradictory versions the
repo previously asserted. Every value here is either provable from this
repository or the narrowest of the conflicting promises already published.

The seed is idempotent and reverses to a no-op: un-applying this migration drops
the tables, so there is nothing to un-seed.
"""

import content.models
from django.db import migrations, models
import django.db.models.deletion


# ============================================================================
# IMPL_SPEC §4 SAFE DEFAULTS
# ============================================================================
# Claim rows. `is_substantiated=True` means "approved to print"; False means the
# claim is on the register, retains its approved wording, and is NOT rendered
# until the named evidence in `notes` is attached to `footnote`/`evidence_url`.
#
# The four True rows are the §4 survivors: two the brand can verify from its own
# practice, one softened to a safety claim with the word "efficacy" removed, and
# one kept explicitly as an ingredient claim rather than a purity claim.
#
# Labels match frontend/src/content/claims.js exactly, because that file matches
# an API claim to its local copy by label.
CLAIM_SEED = [
    {
        'label': 'Made in India',
        'footnote': '',
        'is_substantiated': True,
        'display_order': 10,
        'notes': (
            'Kept unchanged per IMPL_SPEC §4 LF-05: ownable and verifiable from '
            'the brand\'s own manufacturing. TODO(business): supply the one-line '
            'evidence footnote (manufacturing address or licence number) so it '
            'renders beside the claim.'
        ),
    },
    {
        'label': 'Cruelty Free',
        'footnote': '',
        'is_substantiated': True,
        'display_order': 20,
        'notes': (
            'Kept unchanged per §4 LF-05: verifiable by the brand\'s own '
            'practice. TODO(business): is there a certifying body (PETA, Leaping '
            'Bunny, CCF) we may name, or is this a self-declaration? Name it in '
            'the footnote either way.'
        ),
    },
    {
        'label': 'Dermatologist-tested formulations',
        'footnote': '',
        'is_substantiated': True,
        'display_order': 30,
        'notes': (
            'SOFTENED per §4 LF-05 from "Dermatologically Tested - Rigorously '
            'tested for safety and efficacy by certified dermatologists". The '
            'word "efficacy" is deliberately gone: a patch test evidences '
            'safety, not performance. Do not reinstate it. '
            'TODO(business): supply the patch-test report number and the '
            'supervising dermatologist or laboratory for the footnote.'
        ),
    },
    {
        'label': 'Botanical Actives',
        'footnote': '',
        'is_substantiated': True,
        'display_order': 40,
        'notes': (
            'Kept per §4 LF-05 as an INGREDIENT claim. It must never be '
            'reworded into a purity claim ("natural", "100% natural", '
            '"natural-inspired") - those are separate, unevidenced rows below.'
        ),
    },
    # ---- Switched off until evidenced (§4 LF-05 "Delete entirely") ----
    {
        'label': "India's First",
        'footnote': '',
        'is_substantiated': False,
        'display_order': 100,
        'notes': (
            'TODO(business): "India\'s First" appeared exactly once in the '
            'codebase (Hero.jsx:34) and was never qualified. First at WHAT, on '
            'what date, verified by whom? Supply a dated, sourced statement or '
            'confirm permanent deletion.'
        ),
    },
    {
        'label': 'Clinically Tested',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 110,
        'notes': (
            'TODO(business): supply the clinical study - issuing laboratory, '
            'protocol, subject count and report number - or confirm deletion. '
            '"Dermatologist-tested formulations" already ships in its place.'
        ),
    },
    {
        'label': '100% natural',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 120,
        'notes': (
            'TODO(business): FAQ.jsx:9 said "100% natural ingredients" while '
            'Benefits.jsx:9 said "natural-inspired ingredients" - a direct '
            'self-contradiction, and the ingredient lists include synthetics '
            '(Cyclopentasiloxane, Sodium Laureth Sulfate, Titanium Dioxide). '
            'Supply the full INCI list with natural-origin percentage per SKU, '
            'or confirm deletion.'
        ),
    },
    {
        'label': 'Fully recyclable packaging',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 130,
        'notes': (
            'TODO(business): supply the resin codes and a recyclability '
            'assessment for every component (bottle, cap, pump, label, carton), '
            'or confirm deletion. Asserted at FAQ.jsx:25.'
        ),
    },
    {
        'label': 'All Skin Types',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 140,
        'notes': (
            'TODO(business): confirm deletion of the SITEWIDE badge. A catalogue '
            'containing SPF filters and actives (salicylic acid, kojic acid, '
            'ascorbic acid) cannot carry a blanket all-skin-types promise. '
            'Per-product suitability now renders from Product.suitable_for and '
            'the skin_types M2M instead, which states what each SKU claims.'
        ),
    },
    {
        'label': 'The highest quality in natural beauty care',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 150,
        'notes': (
            'TODO(business): a comparative superlative needs a named benchmark '
            'against identified competitors. Supply one or confirm deletion. '
            'Asserted at Benefits.jsx:81.'
        ),
    },
    {
        'label': 'Radiant results',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 160,
        'notes': (
            'TODO(business): a performance claim. Supply the instrumental or '
            'consumer-perception study with subject count, or confirm deletion.'
        ),
    },
    {
        'label': 'No fuss, just results',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 170,
        'notes': (
            'TODO(business): "results" is a performance claim. §4 replaced this '
            'hero line with the approved subhead seeded below. Confirm the '
            'replacement is permanent.'
        ),
    },
    # ---- Product formulation claims: kept on the SKUs that carry them, but
    # ---- registered here as unevidenced so ops can see exactly which numbers
    # ---- have no test report behind them (§4 LF-05).
    {
        'label': 'SPF 30 UV protection',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 200,
        'notes': (
            'On LF-SK-MO01 (Moisturize Me). A label fact, not a marketing '
            'superlative, so it stays on the product. '
            'TODO(business): supply the in-vivo or in-vitro SPF test report '
            '(ISO 24444 / ISO 24443) number and laboratory.'
        ),
    },
    {
        'label': 'Broad-spectrum SPF 50+ (UVA, UVB and blue light)',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 210,
        'notes': (
            'On LF-SK-SU01 (UV Armor). TODO(business): supply the SPF 50+ test '
            'report, the UVA protection factor / critical wavelength result, '
            'and - separately - the blue-light protection evidence, which is a '
            'distinct test and is not covered by an SPF measurement.'
        ),
    },
    {
        'label': '24-hour moisture lock (lasts up to 48 hours)',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 220,
        'notes': (
            'On LF-SK-MO01. Note the claim contradicts itself (24-hour lock, '
            'lasts up to 48 hours). TODO(business): supply the corneometry '
            'study with subject count and timepoints, and state ONE duration.'
        ),
    },
    {
        'label': 'Water and sweat-resistant',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 230,
        'notes': (
            'On LF-SK-SU01. TODO(business): supply the water-resistance test '
            '(40 or 80 minutes?) and report number. The duration must be stated '
            'on the label; "water-resistant" alone is not a permitted claim in '
            'most jurisdictions.'
        ),
    },
    {
        'label': 'Non-comedogenic',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 240,
        'notes': (
            'On LF-SK-SU01. TODO(business): supply the comedogenicity test '
            'report, or confirm deletion.'
        ),
    },
    {
        'label': 'Advanced Whitening Complex',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 250,
        'notes': (
            'On LF-SK-CR01 (Luminaa). TODO(business): "Advanced" and '
            '"Whitening" are both claims. Name the complex and supply the '
            'pigmentation study, or reword to an ingredient statement '
            '(e.g. "with kojic acid and arbutin"), which needs no study.'
        ),
    },
    {
        'label': 'Promotes thicker, fuller hair',
        'footnote': '',
        'is_substantiated': False,
        'display_order': 260,
        'notes': (
            'On LF-HA-SC01 and LF-HA-SE01. TODO(business): a hair-growth '
            'performance claim. Supply the trichological study, or reword to '
            'what the formulation does (conditions, reduces breakage), which '
            'needs no study.'
        ),
    },
]

# §4 LF-12 safe default: the single delivery and returns policy. These are the
# NARROWEST of the five contradictory versions the repo asserted (7-day returns,
# not 30) and the ones that match what the backend actually charges (free
# shipping, zero charge), because under-promising is recoverable and
# over-promising is a chargeback.
POLICY_SEED = {
    'delivery_window_min_days': 3,
    'delivery_window_max_days': 7,
    'free_shipping_threshold': None,
    'shipping_charge': 0,
    'return_window_days': 7,
    'return_window_from': 'delivery',
    'refund_days': 10,
    'return_exclusions': [
        'opened or used personal-care products',
        'items without original packaging',
    ],
    'cod_available': True,
}

# §4 LF-05 / LF-30 safe default: brand copy. No phone, no WhatsApp and no hours,
# because no such value exists anywhere in the repository and inventing one is a
# support failure. The email address is the one already configured as
# EMAIL_HOST_USER. The Instagram URL is the only social handle in the repo.
SITE_SETTING_SEED = {
    'brand_name': 'Le foyeR.',
    'tagline': 'Skincare for the whole family.',
    'positioning_statement': (
        "Le foyeR. is French for 'the hearth' - the heart of the home. Made in "
        'India, dermatologist-tested formulations for the whole family: one '
        'shelf, every skin.'
    ),
    'support_email': 'support@lefoyerglobal.com',
    'support_phone': '',
    'whatsapp': '',
    'hours': '',
    'instagram_url': 'https://instagram.com/lefoyerglobal',
}

# §4 LF-05 approved REPLACEMENT HERO COPY, carried verbatim.
#
# Seeded is_active=False on purpose. The live hero copy ships from
# frontend/src/content/brand.js so the page renders instantly with no API round
# trip; this row exists so that the approved wording is also in the database,
# ready for the day the hero becomes CMS-driven, without anyone retyping
# unapproved copy. Because it is inactive, GET /api/content/home-sections/
# correctly returns [] on a freshly migrated database.
HERO_SECTION_SEED = {
    'kind': 'hero',
    'display_order': 0,
    'title': 'Skincare that feels like coming home.',
    'subtitle': (
        'Made in India. Dermatologist-tested formulations for the whole family '
        '- one shelf, every skin.'
    ),
    'body': '',
    'cta_label': 'Shop Skincare',
    'cta_target': '/products',
    'starts_at': None,
    'ends_at': None,
    'is_active': False,
}


def seed_safe_defaults(apps, schema_editor):
    """Write the §4 safe defaults. Idempotent: existing rows are left alone."""
    Claim = apps.get_model('content', 'Claim')
    PolicySetting = apps.get_model('content', 'PolicySetting')
    SiteSetting = apps.get_model('content', 'SiteSetting')
    HomeSection = apps.get_model('content', 'HomeSection')

    for row in CLAIM_SEED:
        Claim.objects.get_or_create(
            label=row['label'],
            defaults={
                'footnote': row['footnote'],
                'evidence_url': '',
                'is_substantiated': row['is_substantiated'],
                'display_order': row['display_order'],
                'notes': row['notes'],
            },
        )

    if not PolicySetting.objects.filter(pk=1).exists():
        PolicySetting.objects.create(pk=1, **POLICY_SEED)

    if not SiteSetting.objects.filter(pk=1).exists():
        SiteSetting.objects.create(pk=1, **SITE_SETTING_SEED)

    if not HomeSection.objects.filter(kind='hero').exists():
        HomeSection.objects.create(**HERO_SECTION_SEED)



class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('products', '0005_product_manual_out_of_stock'),
        ('orders', '0004_order_payment_method'),
    ]

    operations = [
        migrations.CreateModel(
            name='Claim',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=160, unique=True)),
                ('footnote', models.CharField(blank=True, default='', help_text='One line naming the evidence. Rendered beside the claim.', max_length=300)),
                ('evidence_url', models.URLField(blank=True, default='', max_length=500)),
                ('is_substantiated', models.BooleanField(default=False, help_text='Tick ONLY when a named certificate, lab report or test number exists and is referenced above.')),
                ('display_order', models.PositiveIntegerField(db_index=True, default=0)),
                ('notes', models.TextField(blank=True, default='', help_text='Internal. Why this claim is or is not currently evidenced.')),
            ],
            options={
                'ordering': ['display_order', 'label'],
            },
        ),
        migrations.CreateModel(
            name='PolicySetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_window_min_days', models.PositiveSmallIntegerField(default=3)),
                ('delivery_window_max_days', models.PositiveSmallIntegerField(default=7)),
                ('free_shipping_threshold', models.DecimalField(blank=True, decimal_places=2, default=None, help_text='Order subtotal above which shipping is free. NULL means shipping is free on every order (the current default).', max_digits=10, null=True)),
                ('shipping_charge', models.DecimalField(decimal_places=2, default=0, help_text='Standard shipping charge below the threshold. 0 matches what order creation actually charges today.', max_digits=10)),
                ('return_window_days', models.PositiveSmallIntegerField(default=7)),
                ('return_window_from', models.CharField(choices=[('delivery', 'From delivery'), ('purchase', 'From purchase')], default='delivery', max_length=10)),
                ('refund_days', models.PositiveSmallIntegerField(default=10, help_text='Working days to credit a refund once approved.')),
                ('return_exclusions', models.JSONField(blank=True, default=list, help_text='List of plain-language strings naming what cannot be returned.')),
                ('cod_available', models.BooleanField(default=True, help_text='Whether cash on delivery is offered at all. Actual availability for a given address still comes from /api/shipping/check-serviceability/ per pincode.')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Delivery & returns policy',
                'verbose_name_plural': 'Delivery & returns policy',
            },
        ),
        migrations.CreateModel(
            name='SiteSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('brand_name', models.CharField(default='Le foyeR.', max_length=120)),
                ('tagline', models.CharField(blank=True, default='', max_length=255)),
                ('positioning_statement', models.TextField(blank=True, default='', help_text='One or two sentences. Must not contain an unevidenced claim — every claim belongs in the Claims table with its evidence.')),
                ('support_email', models.EmailField(blank=True, default='support@lefoyerglobal.com', max_length=254)),
                ('support_phone', models.CharField(blank=True, default='', help_text='Leave blank unless a real, staffed number is published. Blank is not rendered.', max_length=32)),
                ('whatsapp', models.CharField(blank=True, default='', help_text='Leave blank unless a real WhatsApp number is published.', max_length=32)),
                ('hours', models.CharField(blank=True, default='', help_text="e.g. 'Mon-Sat, 10am-6pm IST'. Leave blank unless staffed.", max_length=160)),
                ('instagram_url', models.URLField(blank=True, default='', max_length=300)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Site setting',
                'verbose_name_plural': 'Site settings',
            },
        ),
        migrations.CreateModel(
            name='SupportRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('email', models.EmailField(max_length=254)),
                ('order_reference', models.CharField(blank=True, default='', help_text='Exactly what the customer typed. Kept verbatim even when it does not resolve to a row above, so support can still act on a mistyped or marketplace reference.', max_length=64)),
                ('topic', models.CharField(choices=[('order', 'An order I placed'), ('delivery', 'Delivery or tracking'), ('returns', 'Returns or refunds'), ('product', 'Product question'), ('payment', 'Payment problem'), ('other', 'Something else')], default='other', max_length=20)),
                ('message', models.TextField()),
                ('ticket_ref', models.CharField(default=content.models.generate_ticket_ref, editable=False, max_length=24, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('handled_at', models.DateTimeField(blank=True, null=True)),
                ('handled_note', models.TextField(blank=True, default='')),
                ('order', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='support_requests', to='orders.order')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='HomeSection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('hero', 'Hero'), ('banner', 'Promotional banner'), ('product_rail', 'Product rail'), ('editorial', 'Editorial block'), ('category_grid', 'Category grid'), ('concern_grid', 'Concern grid'), ('testimonials', 'Testimonials'), ('newsletter', 'Newsletter signup')], max_length=32)),
                ('display_order', models.PositiveIntegerField(db_index=True, default=0)),
                ('title', models.CharField(blank=True, default='', max_length=200)),
                ('subtitle', models.CharField(blank=True, default='', max_length=300)),
                ('body', models.TextField(blank=True, default='')),
                ('image', models.ImageField(blank=True, null=True, upload_to='home_sections/')),
                ('cta_label', models.CharField(blank=True, default='', max_length=60)),
                ('cta_target', models.CharField(blank=True, default='', help_text="An in-app path such as /products?category=skincare. No leading '#'.", max_length=300)),
                ('starts_at', models.DateTimeField(blank=True, help_text='Blank = live immediately.', null=True)),
                ('ends_at', models.DateTimeField(blank=True, help_text='Blank = no end date.', null=True)),
                ('is_active', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('products', models.ManyToManyField(blank=True, related_name='home_sections', to='products.product')),
            ],
            options={
                'ordering': ['display_order', 'id'],
            },
        ),
        migrations.RunPython(seed_safe_defaults, migrations.RunPython.noop),
    ]
