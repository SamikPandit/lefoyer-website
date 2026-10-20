/**
 * /terms — LF-12 / LF-29 / §4.
 *
 * FOUR THINGS WERE WRONG WITH THIS PAGE, AND ALL FOUR WERE TRUST DEFECTS
 * 1. The "Last updated" line was computed from the browser clock at render time —
 *    a legal document that claimed to have been revised **today, every day, for
 *    ever**. That is a
 *    fabricated freshness signal on exactly the document where the date is part of
 *    the record. It is now a hardcoded constant that a human bumps when the text
 *    actually changes.
 * 2. The published domain was the wrong one — a dot-com this business does not
 *    own — so the document described a platform that is not this platform.
 * 3. The published support address was a **gmail.com** address. It is now the
 *    branded `support@lefoyerglobal.com` (the value already configured as
 *    `EMAIL_HOST_USER`), served from `content/brand.js` so one admin edit moves it
 *    everywhere.
 * 4. There was **no grievance-officer block at all**, which Indian consumer and IT
 *    rules require an e-commerce entity to publish.
 *
 * THE ENTITY-NAME CONFLICT IS NOT OURS TO RESOLVE — see TODO(business) below.
 * Clause 3 named "Le Foyer Global" while the contact block named "SITE COBALLO
 * PRIVATE LIMITED". Both names are left exactly as they were found. The ONE
 * assertion removed is "incorporated under the Companies Act, **1956**": that Act
 * was replaced in 2013, so the sentence is either wrong or about a different
 * company, and repeating a specific statutory fact we cannot verify is worse than
 * omitting it. No name was guessed, invented or swapped.
 */

import { Box, Container, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import SupportLink from '../components/common/SupportLink';
import { FOCUS_RING_SX } from '../components/common/EmptyState';
import { useBrand } from '../content/brand';

/**
 * Bump this BY HAND, and only when the text below actually changes. It is a
 * constant precisely so that it cannot quietly print today's date.
 */
const LAST_UPDATED = '21 October 2026';

/** The public domain. Replaces the incorrect dot-com that was published here. */
const PLATFORM_DOMAIN = 'https://lefoyerglobal.com';

/**
 * TODO(business): which entity is the contracting party on this Platform, and
 * what are its CIN and registered office address? Clause 3 below says
 * "Le Foyer Global"; the contact block says "SITE COBALLO PRIVATE LIMITED".
 * These cannot both be the seller of record. Until this is answered in writing:
 *   - both names stay exactly as they were published;
 *   - no incorporation statute, CIN, GSTIN or registered address is asserted;
 *   - the grievance officer is identified by role and channel, not by a
 *     person's name, because the repository contains none and §4 forbids
 *     inventing one.
 * Also needed: may the number 8401825693 (previously printed here as "Phone")
 * be published as the customer-facing support line? §4 ships no phone number
 * until that is confirmed, so it has been removed from the block below.
 */
const CONTACT_BUSINESS_NAME = 'SITE COBALLO PRIVATE LIMITED';

const CLAUSES = [
  'To access and use the Services, you agree to provide true, accurate and complete information to us during and after registration, and you shall be responsible for all acts done through the use of your registered account on the Platform.',
  'Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness, performance, completeness or suitability of the information and materials offered on this website or through the Services, for any specific purpose. You acknowledge that such information and materials may contain inaccuracies or errors and we expressly exclude liability for any such inaccuracies or errors to the fullest extent permitted by law.',
  'Your use of our Services and the Platform is solely and entirely at your own risk and discretion for which we shall not be liable to you in any manner. You are required to independently assess and ensure that the Services meet your requirements.',
  'The contents of the Platform and the Services are proprietary to us and are licensed to us. You will not have any authority to claim any intellectual property rights, title, or interest in its contents. The contents includes and is not limited to the design, layout, look and graphics.',
  'You acknowledge that unauthorized use of the Platform and/or the Services may lead to action against you as per these Terms of Use and/or applicable laws.',
  'You agree to pay us the charges associated with availing the Services.',
  'You agree not to use the Platform and/or Services for any purpose that is unlawful, illegal or forbidden by these Terms, or Indian or local laws that might apply to you.',
  'You agree and acknowledge that the website and the Services may contain links to other third party websites. On accessing these links, you will be governed by the terms of use, privacy policy and such other policies of such third party websites. These links are provided for your convenience and to provide further information.',
  'You understand that upon initiating a transaction for availing the Services you are entering into a legally binding and enforceable contract with the Platform Owner for the Services.',
  "You shall indemnify and hold harmless Platform Owner, its affiliates, group companies (as applicable) and their respective officers, directors, agents, and employees, from any claim or demand, or actions including reasonable attorney's fees, made by any third party or penalty imposed due to or arising out of Your breach of this Terms of Use, Privacy Policy and other Policies, or Your violation of any law, rules or regulations or the rights (including infringement of intellectual property rights) of a third party.",
  'Notwithstanding anything contained in these Terms of Use, the parties shall not be liable for any failure to perform an obligation under these Terms if performance is prevented or delayed by a force majeure event.',
  'These Terms and any dispute or claim relating to it, or its enforceability, shall be governed by and construed in accordance with the laws of India.',
  'All disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in India.',
  'All concerns or communications relating to these Terms must be communicated to us using the contact information published on this page.',
];

const Paragraph = ({ children, bold = false }) => (
  <Typography
    variant="body1"
    paragraph
    sx={{ color: 'var(--lf-ink-2)', fontWeight: bold ? 600 : 400 }}
  >
    {children}
  </Typography>
);

const TermsAndConditions = () => {
  const brand = useBrand();

  return (
    <>
      <SeoHead
        title="Terms & conditions"
        description={`The terms of use that govern ${brand.seo.siteName} and any order placed on it.`}
        canonical="/terms"
      />

      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
            <Typography variant="h1" component="h1" sx={{ color: 'var(--lf-ink)', mb: 1.5 }}>
              Terms &amp; conditions
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
              Last updated: {LAST_UPDATED}
            </Typography>
          </Box>

          <Box
            sx={{
              p: { xs: 3, md: 5 },
              backgroundColor: 'var(--lf-surface)',
              border: '1px solid var(--lf-hairline)',
              borderRadius: 'var(--lf-r-panel)',
            }}
          >
            <Paragraph>
              1. This document is an electronic record in terms of the Information
              Technology Act, 2000 and the rules thereunder as applicable, and the
              amended provisions pertaining to electronic records in various statutes
              as amended by the Information Technology Act, 2000. This electronic
              record is generated by a computer system and does not require any
              physical or digital signatures.
            </Paragraph>

            <Paragraph>
              2. This document is published in accordance with the provisions of Rule
              3 (1) of the Information Technology (Intermediaries guidelines) Rules,
              2011 that require publishing the rules and regulations, privacy policy
              and Terms of Use for access or usage of the domain name{' '}
              {PLATFORM_DOMAIN} (&lsquo;Website&rsquo;), including the related mobile
              site and mobile application (hereinafter referred to as
              &lsquo;Platform&rsquo;).
            </Paragraph>

            <Paragraph>
              3. The Platform is owned and operated by Le Foyer Global, based in India
              (hereinafter referred to as &lsquo;Platform Owner&rsquo;, &lsquo;we&rsquo;,
              &lsquo;us&rsquo;, &lsquo;our&rsquo;).
            </Paragraph>

            <Paragraph>
              4. Your use of the Platform and services and tools are governed by the
              following terms and conditions (&ldquo;Terms of Use&rdquo;) as applicable
              to the Platform including the applicable policies which are incorporated
              herein by way of reference. If You transact on the Platform, You shall be
              subject to the policies that are applicable to the Platform for such
              transaction. By mere use of the Platform, You shall be contracting with
              the Platform Owner and these terms and conditions including the policies
              constitute Your binding obligations, with Platform Owner. These Terms of
              Use relate to your use of our website, goods (as applicable) or services
              (as applicable) (collectively, &lsquo;Services&rsquo;). Any terms and
              conditions proposed by You which are in addition to or which conflict
              with these Terms of Use are expressly rejected by the Platform Owner and
              shall be of no force or effect. These Terms of Use can be modified at any
              time without assigning any reason. It is your responsibility to
              periodically review these Terms of Use to stay informed of updates.
            </Paragraph>

            <Paragraph>
              5. For the purpose of these Terms of Use, wherever the context so
              requires &lsquo;you&rsquo;, &lsquo;your&rsquo; or &lsquo;user&rsquo; shall
              mean any natural or legal person who has agreed to become a user/buyer on
              the Platform.
            </Paragraph>

            <Paragraph bold>
              6. ACCESSING, BROWSING OR OTHERWISE USING THE PLATFORM INDICATES YOUR
              AGREEMENT TO ALL THE TERMS AND CONDITIONS UNDER THESE TERMS OF USE, SO
              PLEASE READ THE TERMS OF USE CAREFULLY BEFORE PROCEEDING.
            </Paragraph>

            <Paragraph>
              7. The use of the Platform and/or availing of our Services is subject to
              the following Terms of Use:
            </Paragraph>

            <Box component="ol" sx={{ pl: 3, mb: 4 }}>
              {CLAUSES.map((clause) => (
                <Typography
                  component="li"
                  variant="body1"
                  key={clause.slice(0, 48)}
                  sx={{ color: 'var(--lf-ink-2)', mb: 1.5 }}
                >
                  {clause}
                </Typography>
              ))}
            </Box>

            {/* ------------------------------------- delivery / returns pointer */}
            <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 1.5 }}>
              Delivery, returns and refunds
            </Typography>
            <Paragraph>
              The delivery window, the return window and its start point, the
              conditions and exclusions, and the refund timeline that apply to every
              order are published, as one set of numbers, on our{' '}
              <Box
                component={RouterLink}
                to="/shipping-returns"
                sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
              >
                delivery, returns &amp; refunds page
              </Box>
              , and form part of these Terms.
            </Paragraph>

            {/* ------------------------------------------------- grievance block */}
            <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mt: 4, mb: 1.5 }}>
              Grievance redressal
            </Typography>
            <Paragraph>
              If you have a complaint about an order, a communication from us, or
              content on this Platform, write to the Grievance Officer, {brand.legalName},
              at <SupportLink channel="email" variant="inline" showAddress subject="Grievance" />{' '}
              with &ldquo;Grievance&rdquo; in the subject line. Please include your
              order number and what outcome you are asking for, so that the complaint
              can be acted on rather than acknowledged.
            </Paragraph>
            <Paragraph>
              Anything sent through our{' '}
              <Box
                component={RouterLink}
                to={brand.support.contactPath}
                sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
              >
                contact form
              </Box>{' '}
              is recorded with a reference number, which is the quickest way to give us
              a complaint we can trace.
            </Paragraph>

            {/* ------------------------------------------------------- contact */}
            <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mt: 4, mb: 1.5 }}>
              Contact information
            </Typography>
            <Stack component="dl" spacing={0.75} sx={{ m: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography component="dt" variant="subtitle2" sx={{ color: 'var(--lf-ink)' }}>
                  Business name:
                </Typography>
                <Typography component="dd" variant="body2" sx={{ color: 'var(--lf-ink-2)', m: 0 }}>
                  {CONTACT_BUSINESS_NAME}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography component="dt" variant="subtitle2" sx={{ color: 'var(--lf-ink)' }}>
                  Email:
                </Typography>
                <Box component="dd" sx={{ m: 0 }}>
                  <SupportLink channel="email" variant="inline" showAddress />
                </Box>
              </Box>
              {/* No phone row: `brand.support.phone` is null and §4 forbids
                  inventing one. If the business confirms a line, site-settings
                  fills `support_phone` and SupportLink starts rendering it with
                  no change here. */}
              {brand.support.hours ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Typography component="dt" variant="subtitle2" sx={{ color: 'var(--lf-ink)' }}>
                    Hours:
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ color: 'var(--lf-ink-2)', m: 0 }}>
                    {brand.support.hours}
                  </Typography>
                </Box>
              ) : null}
            </Stack>
          </Box>

          <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'var(--lf-ink-3)' }}>
            See also our{' '}
            <Box
              component={RouterLink}
              to="/privacy-policy"
              sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
            >
              privacy policy
            </Box>
            .
          </Typography>
        </Container>
      </Box>
    </>
  );
};

export default TermsAndConditions;
