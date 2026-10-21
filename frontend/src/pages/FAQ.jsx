/**
 * /faq — ART_DIRECTION §5.8, §5.9 (EDITORIAL). LF-05, LF-12, LF-29.
 *
 * WHAT §5.8 CHANGES HERE
 *  - **One label per route: `Help`.** The route was called five different things across
 *    the app ("FAQ", "FAQs", "Frequently asked questions", "Help", "Read the FAQ"), so
 *    a shopper could not tell that the nav item and the footer link went to the same
 *    page. The `h1`, the document title and the nav item are all `Help` now. The route
 *    stays `/faq`; the `FAQPage` structured data stays, so nothing is lost to search.
 *  - **The fraud notice lands here**, reworded, sharing `<SecurityNotice>` with
 *    `/contact` so the two copies can never drift. It used to render on every route
 *    including `/checkout` — see the note in `Contact.jsx`.
 *  - §5.9's EDITORIAL frame replaces a centred header and a bespoke `py` pair.
 *
 * AND ONE ACCESSIBILITY/PERFORMANCE FIX THE SPEC MAKES CHECKABLE
 * A14: "Accordions animate `grid-template-rows: 0fr → 1fr`." P7 bans animating `height`.
 * MUI's `<Accordion>` is a `<Collapse>`, which animates `height` on every open and close
 * — twelve of them on this page, on the low-end Android P4 targets. `<Disclosure>` below
 * is the same affordance as a button and a grid row: `aria-expanded` / `aria-controls`,
 * a 48px target, one composited property, and `visibility` so the closed panel leaves
 * the tab order instead of hiding focusable links inside a zero-height box.
 *
 * WHAT WAS DELETED FROM THE ANSWERS, AND WHY (unchanged by this revision)
 *   - the wholly-natural purity claim in the first answer (claims.js
 *     `wholly-natural-ingredients`) — nothing in the repo evidences it, and it directly
 *     contradicted the homepage's "natural-**inspired** ingredients" on the same site.
 *   - the recyclable-packaging claim (claims.js `recyclable-packaging`) — withdrawn.
 *   - "**Expedited shipping** options are available at checkout" — there is no such
 *     option and never was. Checkout offers UPI and COD, full stop.
 *   - four delivery/returns numbers that matched neither the policy page, the PDP, the
 *     cart nor the backend. Every number here is read from `content/policy.js`, the
 *     same source `/shipping-returns` and the PDP read, so one grep proves they agree.
 *
 * The answers are also emitted as `FAQPage` structured data from the SAME objects the
 * page renders, so the rich result can never quote a policy the page does not show.
 */

import { useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import SeoHead from '../components/common/SeoHead';
import SupportLink from '../components/common/SupportLink';
import {
  FOCUS_RING_SX,
  MEASURE_SX,
  PRIMARY_ACTION_SX,
  PageShell,
  SecurityNotice,
} from '../components/common/EmptyState';
import { useBrand } from '../content/brand';
import { getClaim, useSubstantiatedClaims } from '../content/claims';
import { usePolicy } from '../content/policy';

/**
 * A link that sits inside running prose. SC 2.5.8's inline exception applies, so it is
 * NOT padded to 44px: forcing a 44px box around a word mid-sentence breaks the line box
 * it lives in and buys no reachability.
 */
const PROSE_LINK_SX = { color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX };

/** The standalone link that tails an answer. A6: a real 44px target. */
const ANSWER_LINK_SX = {
  ...PROSE_LINK_SX,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
};

/**
 * A14 / P7 — the accordion, as a button and one animated grid row.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.question
 * @param {boolean} props.open
 * @param {Function} props.onToggle
 * @param {React.ReactNode} props.children
 */
const Disclosure = ({ id, question, open, onToggle, children }) => (
  <Box
    sx={{
      backgroundColor: 'var(--lf-paper)',
      border: '1px solid var(--lf-hairline)',
      borderRadius: 'var(--lf-r-card)',
      mb: 1.5,
      overflow: 'hidden',
    }}
  >
    <Box
      component="button"
      type="button"
      id={`${id}-header`}
      aria-expanded={open}
      aria-controls={`${id}-content`}
      onClick={onToggle}
      className="lf-press"
      data-press="row"
      sx={{
        display: 'flex',
        width: '100%',
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        py: 1.5,
        textAlign: 'left',
        font: 'inherit',
        color: 'var(--lf-ink)',
        background: 'none',
        border: 0,
        cursor: 'pointer',
        ...FOCUS_RING_SX,
        '&:focus-visible': { ...FOCUS_RING_SX['&:focus-visible'], outlineOffset: '-2px' },
      }}
    >
      <Typography variant="h6" component="h3" sx={{ color: 'inherit' }}>
        {question}
      </Typography>
      <ExpandMoreIcon
        aria-hidden="true"
        sx={{
          flex: '0 0 auto',
          color: 'var(--lf-ink-3)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform var(--lf-dur-3) var(--lf-ease)',
        }}
      />
    </Box>

    <Box
      id={`${id}-content`}
      role="region"
      aria-labelledby={`${id}-header`}
      sx={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        /* Closed, the panel leaves the accessibility tree and the tab order, so the
           links inside an answer are not focusable inside a zero-height box. */
        visibility: open ? 'visible' : 'hidden',
        transition:
          'grid-template-rows var(--lf-dur-3) var(--lf-ease), visibility var(--lf-dur-3) var(--lf-ease)',
      }}
    >
      <Box sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
      </Box>
    </Box>
  </Box>
);

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
        <Box component={RouterLink} to="/orders" sx={{ mt: 1.5, ...ANSWER_LINK_SX }}>
          Go to your orders
        </Box>
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
        <Box component={RouterLink} to="/shipping-returns#returns" sx={{ mt: 1.5, ...ANSWER_LINK_SX }}>
          Read the full returns steps
        </Box>
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
        <Box component={RouterLink} to="/login" sx={{ mt: 1.5, ...ANSWER_LINK_SX }}>
          Go to sign in
        </Box>
      ),
    },
    {
      id: 'account-password',
      question: 'I have forgotten my password.',
      answer:
        'Use "Forgot your password?" on the sign-in page. We email you a single-use link to set a new one; it stops working as soon as the password changes.',
      extra: (
        <Box component={RouterLink} to="/forgot-password" sx={{ mt: 1.5, ...ANSWER_LINK_SX }}>
          Reset your password
        </Box>
      ),
    },
    {
      id: 'account-delete',
      question: 'How do I close my account or get my data deleted?',
      // Honest: the Privacy page used to promise a self-service control that
      // Profile.jsx does not have. It is a written request, and it says so.
      answer: `Write to ${brand.support.email} from the address on the account and we will action it, subject to any order still in flight. We will tell you what we have to keep and why.`,
      extra: (
        <Box component={RouterLink} to="/privacy-policy" sx={{ mt: 1.5, ...ANSWER_LINK_SX }}>
          Read the privacy policy
        </Box>
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
        title="Help"
        description={`Delivery, returns and product questions answered. ${copy.shippingLabel} · ${copy.returnsShort}.`}
        canonical="/faq"
        jsonLd={jsonLd}
      />

      <PageShell
        archetype="editorial"
        maxWidth="md"
        title="Help"
        intro={
          <>
            The delivery and returns numbers below are the same ones on{' '}
            <Box component={RouterLink} to="/shipping-returns" sx={PROSE_LINK_SX}>
              our policy page
            </Box>
            , on every product page and in your bag.
          </>
        }
      >
        <Stack spacing={{ xs: 4, md: 5 }}>
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <Box
                component="section"
                key={group.id}
                id={group.id}
                sx={{ scrollMarginTop: 'calc(var(--lf-nav-h) + 16px)' }}
              >
                <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 2 }}>
                  {group.title}
                </Typography>

                {group.items.map((item) => (
                  <Disclosure
                    key={item.id}
                    id={item.id}
                    question={item.question}
                    open={expanded === item.id}
                    onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
                  >
                    <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
                      {item.answer}
                    </Typography>
                    {item.extra || null}
                  </Disclosure>
                ))}
              </Box>
            ))}

          {/* §5.8 — the fraud notice, off every other route and onto this one. */}
          <SecurityNotice />

          {/* LF-29: every dead end offers a human. */}
          <Box
            component="section"
            sx={{
              p: { xs: 3, md: 4 },
              backgroundColor: 'var(--lf-mat)',
              borderRadius: 'var(--lf-r-panel)',
            }}
          >
            <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 1 }}>
              Not answered here?
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)', ...MEASURE_SX }}>
              Send us the question and a person will answer it. You will get a reference
              number so you can follow it up.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              sx={{ mt: 3 }}
            >
              <Button
                className="lf-press"
                component={RouterLink}
                to={brand.support.contactPath}
                variant="contained"
                color="primary"
                disableElevation
                sx={{ px: 3, ...PRIMARY_ACTION_SX, ...FOCUS_RING_SX }}
              >
                Contact us
              </Button>
              <SupportLink channel="email" showAddress />
            </Stack>
          </Box>
        </Stack>
      </PageShell>
    </>
  );
};

export default FAQ;
