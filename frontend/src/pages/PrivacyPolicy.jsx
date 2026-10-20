/**
 * /privacy-policy — §4, LF-29.
 *
 * THE FIVE CHANGES, AND WHY EACH ONE MATTERED
 * 1. The "Last updated" line no longer comes from the browser clock. A privacy
 *    policy that re-dates itself every morning is a fabricated freshness signal,
 *    and on
 *    this document the date is part of the record of what you consented to.
 * 2. The platform domain is corrected to `https://lefoyerglobal.com`. The policy
 *    described the processing done by a dot-com this business does not own.
 * 3. **The account-deletion promise is now true.** The old text said "You have an
 *    option to delete your account by visiting your profile and settings on our
 *    Platform" — `Profile.jsx` has no such control, and no endpoint exists to back
 *    one. Promising a privacy control that does not exist is the worst kind of
 *    privacy copy, so the wording is now the written-request process that we can
 *    actually honour. (If a self-service deletion is built later, this paragraph
 *    is the one to change back.)
 * 4. A **grievance officer** block, identified by role and channel. §4 forbids
 *    inventing a person's name, and the repo contains none — see the
 *    TODO(business) below.
 * 5. The support address moved off gmail to `brand.support.email`.
 *
 * The substantive processing text is otherwise unchanged: it is the disclosure
 * that was published, and rewriting what we claim to do with customer data is a
 * decision for the business, not a refactor.
 */

import { Box, Container, Divider, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import SeoHead from '../components/common/SeoHead';
import SupportLink from '../components/common/SupportLink';
import { FOCUS_RING_SX } from '../components/common/EmptyState';
import { useBrand } from '../content/brand';

/** Bump BY HAND when the text below changes. Never a computed date. */
const LAST_UPDATED = '21 October 2026';

/** The public domain this policy actually describes. */
const PLATFORM_DOMAIN = 'https://lefoyerglobal.com';

/**
 * TODO(business): publish the Grievance Officer's name and designation, and
 * confirm the entity of record (see the same TODO in TermsAndConditions.jsx —
 * clause 3 names "Le Foyer Global" while the contact block names "SITE COBALLO
 * PRIVATE LIMITED"). Until then this page names the role and the channel and
 * invents neither a person nor a response-time commitment.
 */

const Section = ({ id, title, children }) => (
  <Box component="section" id={id} sx={{ mb: 4, scrollMarginTop: 96 }}>
    <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const Paragraph = ({ children }) => (
  <Typography variant="body1" paragraph sx={{ color: 'var(--lf-ink-2)' }}>
    {children}
  </Typography>
);

const PrivacyPolicy = () => {
  const brand = useBrand();

  return (
    <>
      <SeoHead
        title="Privacy policy"
        description={`How ${brand.seo.siteName} collects, uses and protects your personal data.`}
        canonical="/privacy-policy"
      />

      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
            <Typography variant="h1" component="h1" sx={{ color: 'var(--lf-ink)', mb: 1.5 }}>
              Privacy policy
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
            <Section id="introduction" title="Introduction">
              <Paragraph>
                This Privacy Policy describes how Le Foyer Global and its affiliates
                (collectively &ldquo;Le Foyer Global, we, our, us&rdquo;) collect, use,
                share, protect or otherwise process your information / personal data
                through our website {PLATFORM_DOMAIN} (hereinafter referred to as
                Platform). Please note that you may be able to browse certain sections
                of the Platform without registering with us. We do not offer any
                product/service under this Platform outside India and your personal
                data will primarily be stored and processed in India. By visiting this
                Platform, providing your information or availing any product/service
                offered on the Platform, you expressly agree to be bound by the terms
                and conditions of this Privacy Policy, the Terms of Use and the
                applicable service/product terms and conditions, and agree to be
                governed by the laws of India including but not limited to the laws
                applicable to data protection and privacy. If you do not agree please
                do not use or access our Platform.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="collection" title="Collection">
              <Paragraph>
                We collect your personal data when you use our Platform, services or
                otherwise interact with us during the course of our relationship and
                related information provided from time to time. Some of the information
                that we may collect includes but is not limited to personal data /
                information provided to us during sign-up / registering or using our
                Platform such as name, date of birth, address, telephone / mobile
                number, email ID and/or any such information shared as proof of identity
                or address. Some of the sensitive personal data may be collected with
                your consent, such as your bank account or credit or debit card or other
                payment instrument information, all of the above being in accordance
                with applicable law(s). You always have the option to not provide
                information, by choosing not to use a particular service or feature on
                the Platform. We may track your behaviour, preferences, and other
                information that you choose to provide on our Platform. This information
                is compiled and analysed on an aggregated basis. We will also collect
                your information related to your transactions on the Platform and such
                third-party business partner platforms. When such a third-party business
                partner collects your personal data directly from you, you will be
                governed by their privacy policies. We shall not be responsible for the
                third-party business partner&rsquo;s privacy practices or the content of
                their privacy policies, and we request you to read their privacy policies
                prior to disclosing any information.
              </Paragraph>
              <Paragraph>
                If you receive an email or a call from a person or association claiming
                to be Le Foyer Global and seeking personal data such as a debit or credit
                card PIN, net-banking or mobile-banking password, we request you never to
                provide such information. We will never ask you for it. If you have
                already revealed such information, report it immediately to an
                appropriate law-enforcement agency, and tell us at{' '}
                <SupportLink channel="email" variant="inline" showAddress subject="Suspected phishing" />.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="usage" title="Usage">
              <Paragraph>
                We use personal data to provide the services you request. To the extent
                we use your personal data to market to you, we will provide you the
                ability to opt out of such uses — marketing consent is collected
                separately at sign-up and is never implied by placing an order. We use
                your personal data to handle and fulfil orders; to enhance the customer
                experience; to resolve disputes; to troubleshoot problems; to inform you
                about offers, products, services and updates where you have asked us to;
                to customise your experience; to detect and protect against error, fraud
                and other criminal activity; to enforce our terms and conditions; to
                conduct marketing research, analysis and surveys; and as otherwise
                described to you at the time of collection of information. You
                understand that your access to some products/services may be affected if
                permission is not provided to us.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="sharing" title="Sharing">
              <Paragraph>
                We may share your personal data internally within our group entities and
                affiliates to provide you access to the services and products offered by
                them. These entities and affiliates may market to you as a result of such
                sharing only where you have not opted out. We may disclose personal data
                to third parties such as business partners and third-party service
                providers including logistics partners and payment-instrument issuers.
                These disclosures may be required for us to provide you access to our
                services and products, to comply with our legal obligations, to enforce
                our user agreement, to facilitate our marketing and advertising
                activities, and to prevent, detect, mitigate and investigate fraudulent
                or illegal activities related to our services. We may disclose personal
                and sensitive personal data to government agencies or other authorised
                law-enforcement agencies if required to do so by law, or in the good
                faith belief that such disclosure is reasonably necessary to respond to
                subpoenas, court orders or other legal process. We may disclose personal
                data to law-enforcement offices, third-party rights owners, or others in
                the good faith belief that such disclosure is reasonably necessary to:
                enforce our Terms of Use or Privacy Policy; respond to claims that an
                advertisement, posting or other content violates the rights of a third
                party; or protect the rights, property or personal safety of our users or
                the general public.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="security" title="Security precautions">
              <Paragraph>
                To protect your personal data from unauthorised access or disclosure,
                loss or misuse, we adopt reasonable security practices and procedures.
                Once your information is in our possession, or whenever you access your
                account information, we adhere to our security guidelines to protect it
                against unauthorised access and offer the use of a secure server.
                However, the transmission of information is not completely secure for
                reasons beyond our control. By using the Platform, users accept the
                security implications of data transmission over the internet, which
                cannot always be guaranteed as completely secure, and therefore there
                would always remain certain inherent risks regarding use of the Platform.
                Users are responsible for protecting the login and password records for
                their account.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="deletion" title="Data deletion and retention">
              {/* The paragraph that used to promise a control Profile.jsx does not
                  have. This is the process we can actually honour today. */}
              <Paragraph>
                You can ask us to close your account and delete the personal data held
                against it by writing to{' '}
                <SupportLink channel="email" variant="inline" showAddress subject="Account deletion request" />{' '}
                from the email address registered on the account, or by using our{' '}
                <Box
                  component={RouterLink}
                  to={brand.support.contactPath}
                  sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
                >
                  contact form
                </Box>
                . We will verify that the request came from you before acting on it.
                Deleting the account means losing access to it and to the information
                associated with it. We may refuse or delay deletion where there is a
                pending order, shipment, claim or grievance, and we will tell you when
                that is the reason.
              </Paragraph>
              <Paragraph>
                We retain your personal data for no longer than is required for the
                purpose for which it was collected, or as required under applicable law —
                tax and accounting rules, for example, require us to keep records of a
                completed sale. We may also retain data where we believe it is necessary
                to prevent fraud or future abuse, or for other legitimate purposes, and
                we may continue to retain anonymised data for analytical and research
                purposes.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="your-rights" title="Your rights">
              {/* `Profile.jsx` is read-only today — it renders the account and has
                  no edit form and no endpoint behind one. So this paragraph does
                  not claim that you can change your details there. */}
              <Paragraph>
                You can see the personal data held on your account from your profile
                page while signed in. To correct or update anything the profile page
                does not let you edit, to ask for a copy of your data, or to ask for
                deletion, write to us using the addresses on this page and we will
                action it.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="consent" title="Consent">
              <Paragraph>
                By visiting our Platform or by providing your information, you consent to
                the collection, use, storage, disclosure and otherwise processing of your
                information on the Platform in accordance with this Privacy Policy. If
                you disclose to us any personal data relating to other people, you
                represent that you have the authority to do so and permit us to use the
                information in accordance with this Privacy Policy. While providing your
                personal data over the Platform you consent to us contacting you by SMS,
                instant messaging apps, call and/or email for the purposes specified in
                this Privacy Policy.
              </Paragraph>
              <Paragraph>
                You can withdraw a consent you have already given by writing to the
                Grievance Officer at the address below, mentioning &ldquo;Withdrawal of
                consent for processing personal data&rdquo; in the subject line. We may
                verify such a request before acting on it. A withdrawal is not
                retrospective and will be given effect in accordance with the Terms of
                Use, this Privacy Policy and applicable law. Where we consider the
                withdrawn information necessary to a service, we may restrict or decline
                that service.
              </Paragraph>
            </Section>

            <Divider sx={{ my: 3 }} />

            <Section id="grievance" title="Grievance officer">
              <Paragraph>
                For any complaint about how your personal data has been handled, write to
                the Grievance Officer, {brand.legalName}, at{' '}
                <SupportLink channel="email" variant="inline" showAddress subject="Privacy grievance" />{' '}
                with &ldquo;Privacy grievance&rdquo; in the subject line. Include the
                email address on your account and what you would like us to do, so the
                complaint can be acted on rather than acknowledged. The same office
                handles consent withdrawals and deletion requests.
              </Paragraph>
            </Section>

            <Section id="changes" title="Changes to this privacy policy">
              <Paragraph>
                Please check this policy periodically for changes. We may update it to
                reflect changes to our information practices, and we will alert or notify
                you about significant changes in the manner required under applicable
                law. The date at the top of this page is the date of the current version.
              </Paragraph>
            </Section>
          </Box>

          <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'var(--lf-ink-3)' }}>
            See also our{' '}
            <Box
              component={RouterLink}
              to="/terms"
              sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
            >
              terms &amp; conditions
            </Box>{' '}
            and our{' '}
            <Box
              component={RouterLink}
              to="/shipping-returns"
              sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
            >
              delivery &amp; returns policy
            </Box>
            .
          </Typography>
        </Container>
      </Box>
    </>
  );
};

export default PrivacyPolicy;
