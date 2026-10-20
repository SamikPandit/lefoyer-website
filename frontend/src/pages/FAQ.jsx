/**
 * /faq — LF-05, LF-12, LF-29.
 *
 * WHAT WAS DELETED FROM THIS PAGE, AND WHY
 *   - the wholly-natural purity claim in the first answer (claims.js
 *     `wholly-natural-ingredients`) — nothing in the repo evidences it, and it
 *     directly contradicted the homepage's "natural-**inspired** ingredients" on
 *     the same site. §4 withdraws it; the ingredient claim we can make
 *     ("Botanical Actives") now arrives from `claims.js`.
 *   - the recyclable-packaging claim (claims.js `recyclable-packaging`) —
 *     withdrawn, no evidence.
 *   - "**Expedited shipping** options are available at checkout" — there is no
 *     such option and never was. Checkout's RadioGroup offers UPI and COD, full
 *     stop. A shipping upgrade a customer cannot find is a support ticket and a
 *     refund request.
 *   - "free shipping on all orders over ₹5000 · 3-5 business days · returns within
 *     **30 days of purchase** provided the product is **gently used**" — four
 *     numbers, none of which matched the policy page, the PDP, the cart or the
 *     backend. Every number on this page is now read from `content/policy.js`
 *     (§2b #35), the same source `/shipping-returns` and the PDP read, so one
 *     grep proves they agree.
 *
 * The answers are also emitted as `FAQPage` structured data from the SAME objects
 * the page renders, so the rich result can never quote a policy the page does not
 * show.
 */

import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import SeoHead from '../components/common/SeoHead';
import SupportLink from '../components/common/SupportLink';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
import { useBrand } from '../content/brand';
import { getClaim, useSubstantiatedClaims } from '../content/claims';
import { usePolicy } from '../content/policy';

/**
 * Build the groups from the live policy numbers and the live claim audit.
 * `answer` is plain text (it is also what goes into the JSON-LD); `extra` is the
 * optional React tail that carries the links.
 */
function buildGroups({ brand, copy, policy, claims }) {
  const crueltyFree = getClaim('cruelty-free');
  const derm = getClaim('dermatologist-tested');
  const botanical = getClaim('botanical-actives');
  const madeInIndia = getClaim('made-in-india');

  const products = [];
  if (claims.length > 0) {
    products.push({
      id: 'claims',
      question: 'What do you actually claim about your products?',
      answer: `Only these: ${claims
        .map((claim) => claim.label)
        .join(', ')}. We publish a claim when we can evidence it and we remove it when we cannot — which is why you will not find purity or results promises here.`,
    });
  }
  if (botanical) {
    products.push({
      id: 'botanical',
      question: 'Are your products natural?',
      answer: `${botanical.label}: ${botanical.description} That is an ingredient claim, not a purity claim — our formulations also contain the preservatives, emulsifiers and actives that make a cosmetic safe and stable. The full ingredient list is printed on every pack and on each product page.`,
    });
  }
  if (crueltyFree) {
    products.push({
      id: 'cruelty-free',
      question: 'Do you test on animals?',
      answer: `No. ${crueltyFree.description}`,
    });
  }
  if (derm) {
    products.push({
      id: 'derm',
      question: 'Are your products dermatologist-tested?',
      answer: `${derm.label}. ${derm.description} That is a skin-safety statement and nothing more — we do not claim a clinical efficacy study, because we have not published one.`,
    });
  }
  products.push({
    id: 'suitability',
    question: 'Will it suit my skin?',
    answer:
      'Each product page lists the skin or hair types that product is formulated for, rather than one promise for the whole range. If you are unsure, or you are patch-testing for a sensitivity, send us the ingredient you are avoiding and we will tell you which products are clear of it.',
  });
  if (madeInIndia) {
    products.push({
      id: 'made-in-india',
      question: 'Where are your products made?',
      answer: `${madeInIndia.description}`,
    });
  }

  const delivery = [
    {
      id: 'delivery-cost',
      question: 'How much is delivery?',
      answer:
        policy.freeShippingThreshold === null
          ? `${copy.shippingLabel} — on every order, with no minimum value.`
          : `${copy.shippingLabel}.`,
    },
    {
      id: 'delivery-time',
      question: 'How long will my order take?',
      answer: copy.deliveryDetail,
    },
    {
      id: 'delivery-cod',
      question: 'Can I pay cash on delivery?',
      answer: `${copy.codLine} Enter your pincode on a product page or in your bag and we will tell you before you get to checkout. We take UPI and cash on delivery — those are the two options at checkout.`,
    },
    {
      id: 'delivery-tracking',
      question: 'How do I track my order?',
      answer:
        'We email you when the shipment status changes, with a link to that order. The courier tracking number and its tracking page are shown on the order itself, which you can open from "Your orders" while signed in.',
      extra: (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          <Box component={RouterLink} to="/orders" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
            Go to your orders
          </Box>
        </Typography>
      ),
    },
  ];

  const returns = [
    {
      id: 'returns-window',
      question: 'Can I return something?',
      answer: `${copy.returnsLine} ${copy.returnsExclusionsLine}`,
    },
    {
      id: 'returns-how',
      question: 'How do I start a return?',
      answer: `Tell us within ${policy.returnWindowDays} days of ${
        policy.returnWindowFrom === 'purchase' ? 'ordering' : 'delivery'
      }, with your order number and which item it is. We reply with the return instructions and the address — please wait for that before posting anything.`,
      extra: (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          <Box component={RouterLink} to="/shipping-returns#returns" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
            Read the full returns steps
          </Box>
        </Typography>
      ),
    },
    {
      id: 'returns-refund',
      question: 'When do I get my refund?',
      answer: copy.refundDetail,
    },
    {
      id: 'returns-damaged',
      question: 'My order arrived damaged or wrong.',
      answer: `Tell us within ${policy.returnWindowDays} days, with a photo, and we will replace it or refund it. The unopened condition does not apply — this is our mistake, not a change of mind.`,
    },
  ];

  const account = [
    {
      id: 'account-verify',
      question: 'My verification email has not arrived.',
      answer:
        'Check your spam and promotions folders first. If it is genuinely not there, open the sign-in page and we will send another — up to three per hour, with a minute between them.',
      extra: (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          <Box component={RouterLink} to="/login" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
            Go to sign in
          </Box>
        </Typography>
      ),
    },
    {
      id: 'account-password',
      question: 'I have forgotten my password.',
      answer:
        'Use "Forgot your password?" on the sign-in page. We email you a single-use link to set a new one; it stops working as soon as the password changes.',
      extra: (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          <Box component={RouterLink} to="/forgot-password" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
            Reset your password
          </Box>
        </Typography>
      ),
    },
    {
      id: 'account-delete',
      question: 'How do I close my account or get my data deleted?',
      // Honest: the Privacy page used to promise a self-service control that
      // Profile.jsx does not have. It is a written request, and it says so.
      answer: `Write to ${brand.support.email} from the address on the account and we will action it, subject to any order still in flight. We will tell you what we have to keep and why.`,
      extra: (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          <Box component={RouterLink} to="/privacy-policy" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
            Read the privacy policy
          </Box>
        </Typography>
      ),
    },
  ];

  return [
    { id: 'products', title: 'Products & ingredients', items: products },
    { id: 'delivery', title: 'Delivery & payment', items: delivery },
    { id: 'returns', title: 'Returns & refunds', items: returns },
    { id: 'account', title: 'Orders & your account', items: account },
  ];
}

const FAQ = () => {
  const brand = useBrand();
  const { policy, copy } = usePolicy();
  const { claims } = useSubstantiatedClaims();
  const [expanded, setExpanded] = useState(null);

  const groups = useMemo(
    () => buildGroups({ brand, copy, policy, claims }),
    [brand, claims, copy, policy],
  );

  /* The same objects the page renders — a rich result cannot disagree with it. */
  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: groups.flatMap((group) =>
        group.items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      ),
    }),
    [groups],
  );

  return (
    <>
      <SeoHead
        title="Frequently asked questions"
        description={`Delivery, returns and product questions answered. ${copy.shippingLabel} · ${copy.returnsShort}.`}
        canonical="/faq"
        jsonLd={jsonLd}
      />

      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography variant="h1" component="h1" sx={{ color: 'var(--lf-ink)', mb: 2 }}>
              Frequently asked questions
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'var(--lf-ink-2)' }}>
              The delivery and returns numbers below are the same ones on{' '}
              <Box component={RouterLink} to="/shipping-returns" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
                our policy page
              </Box>
              , on every product page and in your bag.
            </Typography>
          </Box>

          <Stack spacing={{ xs: 4, md: 5 }}>
            {groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <Box component="section" key={group.id} id={group.id} sx={{ scrollMarginTop: 96 }}>
                  <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 0.5 }}>
                    {group.title}
                  </Typography>
                  <Box component="hr" className="lf-rule" sx={{ mb: 2 }} />

                  {group.items.map((item) => (
                    <Accordion
                      key={item.id}
                      elevation={0}
                      disableGutters
                      expanded={expanded === item.id}
                      onChange={() => setExpanded(expanded === item.id ? null : item.id)}
                      sx={{
                        backgroundColor: 'var(--lf-surface)',
                        border: '1px solid var(--lf-hairline)',
                        borderRadius: 'var(--lf-r-card)',
                        mb: 1.5,
                        '&:before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls={`${item.id}-content`}
                        id={`${item.id}-header`}
                        sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
                      >
                        <Typography variant="h6" component="h3" sx={{ color: 'var(--lf-ink)' }}>
                          {item.question}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails id={`${item.id}-content`}>
                        <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
                          {item.answer}
                        </Typography>
                        {item.extra || null}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              ))}
          </Stack>

          {/* LF-29: every dead end offers a human. */}
          <Box
            sx={{
              mt: { xs: 5, md: 7 },
              p: { xs: 3, md: 4 },
              textAlign: 'center',
              backgroundColor: 'var(--lf-surface-sunken)',
              borderRadius: 'var(--lf-r-panel)',
            }}
          >
            <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 1 }}>
              Not answered here?
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)', maxWidth: 480, mx: 'auto' }}>
              Send us the question and a person will answer it. You will get a
              reference number so you can follow it up.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="center"
              alignItems="center"
              sx={{ mt: 3 }}
            >
              <Button
                className="lf-press"
                component={RouterLink}
                to={brand.support.contactPath}
                variant="contained"
                color="primary"
                disableElevation
                sx={{ px: 3, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                Contact us
              </Button>
              <SupportLink channel="email" showAddress />
            </Stack>
          </Box>
        </Container>
      </Box>
    </>
  );
};

export default FAQ;
