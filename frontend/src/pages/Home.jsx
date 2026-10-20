/**
 * Home — the storefront homepage.
 *
 * LF-24 (IMPL_SPEC §1 C-13): this page imported `ProductCategories` and
 * `ShopByConcern` and rendered NEITHER, so no product group was reachable from
 * the homepage. Both now render DIRECTLY under the hero, which is the whole
 * point of LF-24: a product group is one click away.
 *
 * LF-25: `NewYearBanner` (a hardcoded seasonal headline that was still live in
 * October) is deleted and replaced by `CampaignSlot`, which renders whatever
 * the admin has scheduled in `content.HomeSection` and falls back to an
 * evergreen editorial block. `InstagramFeed` is deleted too: it rendered a
 * hardcoded grid of product photographs dressed up as social posts.
 *
 * LF-26 / C-29: `SeoHead` gives this page a real title, description and
 * canonical, plus `Organization` and `WebSite` JSON-LD serialised through
 * `JsonLd.jsx` (which escapes `<`, `>` and `&` so a brand string can never
 * close the script tag). Before this change-set the app had no head manager and
 * no structured data anywhere.
 *
 * The `// Force rebuild` marker and the "maybe we can reduce them if the user
 * wants a VERY minimal look" block comment are gone; so is the commented-out
 * hero CTA (LF-03) one file down.
 *
 * SECTION ORDER (IMPL_SPEC §3 WP-09, with one documented insertion):
 *   Marquee -> Hero -> ProductCategories -> ShopByConcern -> FeaturedProducts
 *   -> CampaignSlot -> Benefits -> CircularProductSlider -> CustomerTestimonials
 *   -> NewsletterSignup
 * The spec's render list omits `CircularProductSlider` while its per-file
 * instructions require rebuilding it, and DESIGN_SYSTEM §8 lists a bestsellers
 * rail as home section 7; it is mounted here rather than shipped as dead code.
 * Reported as a deviation.
 *
 * Several sections render nothing when the data behind them does not exist —
 * no sellable categories, no evidenced claims, no real reviews. That is by
 * design: an absent section is honest, a fabricated one is not.
 */

import SeoHead, { absoluteUrl } from '../components/common/SeoHead';
import { useBrand } from '../content/brand';

import Benefits from '../components/home/Benefits';
import CampaignSlot from '../components/home/CampaignSlot';
import CircularProductSlider from '../components/home/CircularProductSlider';
import CustomerTestimonials from '../components/home/CustomerTestimonials';
import FeaturedProducts from '../components/home/FeaturedProducts';
import Hero from '../components/home/Hero';
import Marquee from '../components/home/Marquee';
import NewsletterSignup from '../components/home/NewsletterSignup';
import ProductCategories from '../components/home/ProductCategories';
import ShopByConcern from '../components/home/ShopByConcern';

const Home = () => {
  const brand = useBrand();
  const siteUrl = absoluteUrl('/');

  /* Only fields we can actually evidence: no logo (this repo ships no brand
     mark asset), no telephone (brand.support.phone is null by §4 and inventing
     one is forbidden), no founding date, no address. `pruneJsonLd` drops the
     nulls before serialisation. */
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.seo.siteName,
    legalName: brand.legalName,
    url: siteUrl,
    description: brand.positioningStatement,
    sameAs: brand.social.instagram ? [brand.social.instagram] : undefined,
    contactPoint: brand.support.email
      ? {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: brand.support.email,
          availableLanguage: ['en'],
        }
      : undefined,
  };

  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand.seo.siteName,
    url: siteUrl,
    inLanguage: 'en-IN',
    publisher: { '@type': 'Organization', name: brand.seo.siteName, url: siteUrl },
    potentialAction: siteUrl
      ? {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl.replace(/\/+$/, '')}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        }
      : undefined,
  };

  return (
    <>
      <SeoHead
        title={brand.seo.defaultTitle}
        appendSiteName={false}
        description={brand.seo.defaultDescription}
        canonical="/"
        jsonLd={[organizationLd, websiteLd]}
      />

      <Marquee />
      <Hero />
      <ProductCategories />
      <ShopByConcern />
      <FeaturedProducts />
      <CampaignSlot />
      <Benefits />
      <CircularProductSlider />
      <CustomerTestimonials />
      <NewsletterSignup />
    </>
  );
};

export default Home;
