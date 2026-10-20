/**
 * /shipping-returns — LF-12. The one place the delivery, returns and refund
 * numbers are stated, and the page every other surface links to.
 *
 * THERE WERE FIVE CONTRADICTORY VERSIONS OF THIS POLICY IN THE APP, all verified:
 *   1. this page        delivery 3-7 days · returns 7 days from delivery ·
 *                       refunds 10 days, in a sentence that was not grammatical:
 *                       "we will initiate and credited the refund within 10 days"
 *   2. FAQ.jsx          free shipping over ₹5000 · 3-5 BUSINESS days · returns 30
 *                       days from PURCHASE "provided the product is gently used" ·
 *                       plus expedited shipping "available at checkout", which has
 *                       never existed (Checkout offers UPI and COD only)
 *   3. ProductDetail    "Free Delivery" unconditional · "Free 30 Days Delivery
 *                       Returns" — two different policies in one sentence
 *   4. Cart.jsx         Shipping = Free, beside a deleted CartSummary.jsx that
 *                       hard-coded `estimatedShipping = 50`
 *   5. OrderDetail.jsx  `const shipping = 0; // Add shipping logic if needed`
 *
 * After this change there is one: `content/policy.js`, hydrated from
 * `GET /api/content/policy/` (§2b #35). Every sentence below is BUILT from those
 * numbers by `policyCopy()`, so this page cannot drift from the PDP, the cart or
 * the FAQ — and `grep -rn "return_window_days" frontend/src` proves it in one
 * line. **If you find yourself typing "7-day" into this file, stop: you have
 * reintroduced LF-12.**
 *
 * The numbers themselves are the §4 safe default — the NARROWEST of the five
 * conflicting promises, and the one that matches what the backend actually
 * charges (nothing). `policy.js` carries the TODO(business) that must be answered
 * as a single set before these can be called final.
 */

import { Box, Container, Divider, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';

import SeoHead from '../components/common/SeoHead';
import SupportLink, { supportContactPath } from '../components/common/SupportLink';
import { FOCUS_RING_SX } from '../components/common/EmptyState';
import { usePolicy } from '../content/policy';
import { useBrand } from '../content/brand';

const Section = ({ id, icon, title, children }) => (
  <Box component="section" id={id} aria-labelledby={`${id}-heading`} sx={{ scrollMarginTop: 96 }}>
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 44,
          height: 44,
          flex: '0 0 auto',
          borderRadius: 'var(--lf-r-pill)',
          backgroundColor: 'var(--lf-gold-tint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& > svg': { fontSize: 22, color: 'var(--lf-gold-ink)' },
        }}
      >
        {icon}
      </Box>
      <Typography variant="h4" component="h2" id={`${id}-heading`} sx={{ color: 'var(--lf-ink)' }}>
        {title}
      </Typography>
    </Stack>
    <Box sx={{ color: 'var(--lf-ink-2)' }}>{children}</Box>
  </Box>
);

/** A labelled fact row. Keeps the numbers scannable instead of buried in prose. */
const Fact = ({ label, children }) => (
  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 0.25, sm: 2 }, py: 1 }}>
    <Typography
      variant="subtitle2"
      component="dt"
      sx={{ color: 'var(--lf-ink)', minWidth: { sm: 180 }, flex: '0 0 auto' }}
    >
      {label}
    </Typography>
    <Typography variant="body2" component="dd" sx={{ color: 'var(--lf-ink-2)', m: 0 }}>
      {children}
    </Typography>
  </Box>
);

const ShippingPolicy = () => {
  const { policy, copy } = usePolicy();
  const brand = useBrand();
  const returnsContactPath = supportContactPath({
    contactPath: brand.support.contactPath,
    topic: 'returns',
  });

  return (
    <>
      <SeoHead
        title="Delivery, returns & refunds"
        description={`${copy.shippingLabel} · ${copy.deliveryWindow}. ${copy.returnsLine}`}
        canonical="/shipping-returns"
      />

      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography variant="h1" component="h1" sx={{ color: 'var(--lf-ink)', mb: 2 }}>
              Delivery, returns &amp; refunds
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'var(--lf-ink-2)' }}>
              Three sections, one set of numbers. The same ones you see on a product
              page, in your bag and at checkout.
            </Typography>
            {/* In-page nav, because this page is linked to from the PDP, the cart,
                the order pages and the FAQ with a specific question in mind. */}
            <Stack
              direction="row"
              spacing={2}
              justifyContent="center"
              flexWrap="wrap"
              sx={{ mt: 3, rowGap: 1 }}
            >
              {[
                ['#delivery', 'Delivery'],
                ['#returns', 'Returns'],
                ['#refunds', 'Refunds'],
              ].map(([href, label]) => (
                <MuiLink
                  key={href}
                  href={href}
                  underline="always"
                  sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
                >
                  {label}
                </MuiLink>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              p: { xs: 3, md: 5 },
              backgroundColor: 'var(--lf-surface)',
              border: '1px solid var(--lf-hairline)',
              borderRadius: 'var(--lf-r-panel)',
            }}
          >
            {/* ------------------------------------------------------ delivery */}
            <Section id="delivery" icon={<LocalShippingOutlinedIcon />} title="Delivery">
              <Typography variant="body1" paragraph sx={{ color: 'var(--lf-ink-2)' }}>
                {copy.deliveryDetail}
              </Typography>
              <Box component="dl" sx={{ m: 0 }}>
                <Fact label="Delivery charge">
                  {copy.shippingLabel}
                  {policy.freeShippingThreshold === null
                    ? ' — there is no minimum order value.'
                    : null}
                </Fact>
                <Fact label="Delivery window">
                  {copy.deliveryWindow} from dispatch. Enter your pincode on any
                  product page for a date specific to your area.
                </Fact>
                <Fact label="Cash on delivery">{copy.codLine}</Fact>
                <Fact label="Tracking">
                  We email you when the shipment status changes, with a link to the
                  order; the courier&rsquo;s own tracking number and page are shown
                  there. You can also open any order from{' '}
                  <Box component={RouterLink} to="/orders" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
                    your orders
                  </Box>
                  .
                </Fact>
              </Box>
            </Section>

            <Divider sx={{ my: { xs: 4, md: 5 } }} />

            {/* ------------------------------------------------------- returns */}
            <Section id="returns" icon={<AssignmentReturnOutlinedIcon />} title="Returns">
              <Typography variant="body1" paragraph sx={{ color: 'var(--lf-ink-2)' }}>
                {copy.returnsDetail}
              </Typography>
              <Box component="dl" sx={{ m: 0 }}>
                <Fact label="Return window">{copy.returnsWindow}</Fact>
                <Fact label="When the window starts">
                  {policy.returnWindowFrom === 'purchase'
                    ? 'The day you place the order.'
                    : 'The day your parcel is delivered — not the day you ordered.'}
                </Fact>
                <Fact label="Condition">
                  Unopened, unused and in its original packaging, with any seal
                  intact.
                </Fact>
                <Fact label="We cannot accept">
                  {copy.returnsExclusionsLine ||
                    'Items outside the condition above.'}{' '}
                  Personal-care products are sealed for hygiene reasons, which is why
                  an opened item cannot go back into stock.
                </Fact>
              </Box>

              <Typography variant="subtitle2" component="h3" sx={{ mt: 3, mb: 1, color: 'var(--lf-ink)' }}>
                How to start a return
              </Typography>
              <Box component="ol" sx={{ pl: 3, m: 0, color: 'var(--lf-ink-2)' }}>
                <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                  Tell us within {policy.returnWindowDays} days of{' '}
                  {policy.returnWindowFrom === 'purchase' ? 'ordering' : 'delivery'}:
                  use the{' '}
                  <Box component={RouterLink} to={returnsContactPath} sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
                    contact form
                  </Box>{' '}
                  with the topic <em>Returns or refunds</em>, or email{' '}
                  <SupportLink channel="email" variant="inline" showAddress subject="Return request" />.
                  Quote your order number and tell us which item and why.
                </Typography>
                <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                  We reply with return instructions and the address to send it to.
                  Please wait for that reply before posting anything — an
                  unannounced parcel can take weeks to match to an order.
                </Typography>
                <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                  Pack the item as it arrived, with its original packaging, and send
                  it back.
                </Typography>
                <Typography component="li" variant="body2">
                  We check it on arrival and move straight to the refund below.
                </Typography>
              </Box>
            </Section>

            <Divider sx={{ my: { xs: 4, md: 5 } }} />

            {/* ------------------------------------------------------- refunds */}
            <Section id="refunds" icon={<CurrencyRupeeOutlinedIcon />} title="Refunds">
              {/* The old sentence here read "we will initiate and credited the
                  refund within 10 days". It is now built from `refund_days`. */}
              <Typography variant="body1" paragraph sx={{ color: 'var(--lf-ink-2)' }}>
                {copy.refundDetail}
              </Typography>
              <Box component="dl" sx={{ m: 0 }}>
                <Fact label="Refund timeline">
                  Within {policy.refundDays} days of us receiving and checking the
                  returned item.
                </Fact>
                <Fact label="Where it goes">
                  Back to the method you paid with. A cash-on-delivery order has no
                  payment to reverse, so we agree the refund method with you when the
                  return is approved.
                </Fact>
                <Fact label="What is refunded">
                  The price you paid for the returned item. Standard delivery is{' '}
                  {policy.shippingCharge ? 'charged separately' : 'free, so there is nothing to refund on it'}.
                </Fact>
                {/* TODO(business): damaged / wrong-item handling is NOT part of
                    the §4 policy set seeded into content.PolicySetting — the repo
                    asserted nothing about it anywhere. What ships here is the
                    narrow, conservative version (tell us inside the same window,
                    we replace or refund, the unopened condition does not apply to
                    our own mistake). Confirm it, or supply the correct remedy and
                    window, as part of answering the LF-12 question set in
                    content/policy.js. */}
                <Fact label="Damaged or wrong item">
                  Tell us within {policy.returnWindowDays} days, with a photo, and we
                  will replace it or refund it — this is not a change-of-mind return,
                  so the unopened condition above does not apply.
                </Fact>
              </Box>
            </Section>
          </Box>

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
              Still unsure? The{' '}
              <Box component={RouterLink} to="/faq" sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}>
                FAQ
              </Box>{' '}
              answers the common ones, and a person reads every message sent through{' '}
              <SupportLink variant="inline" label="our contact form" topic="delivery" />.
            </Typography>
          </Box>
        </Container>
      </Box>
    </>
  );
};

export default ShippingPolicy;
