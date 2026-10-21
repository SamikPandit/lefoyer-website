/**
 * /contact — ART_DIRECTION §5.8, §5.9 (EDITORIAL). LF-29.
 *
 * Every dead end this change-set designs — a failed payment, an expired verification
 * link, a 404, an out-of-stock product — routes here through `SupportLink`, which is
 * why the form reads `?order=` and `?topic=` from the query string: the context travels
 * with the customer instead of being retyped.
 *
 * SOURCES
 *   `getSiteSettings()` (§2b #34), consumed through `content/brand.js`'s `useBrand()`
 *   so the fetch is memoised and shared with the navbar and footer rather than fired
 *   again here.
 *   `submitSupportRequest()` → `POST /api/content/support/contact/` (§2b #37), which
 *   answers `201 {detail, ticket_ref}`. The reference is shown prominently, because a
 *   support promise with no reference is not a support promise.
 *
 * WHAT §5.8 CHANGES HERE
 *  - **The global fraud notice lands on this page.** It used to render in the footer on
 *    *every* route — including `/checkout`, three scroll-seconds above a button that
 *    hands the customer to PhonePe — so the one place it was most likely to be read was
 *    the one place it read as a warning about the gateway itself. It is reworded so it
 *    cannot be, and it now appears exactly twice on the site: here and on `/faq`. Both
 *    render the one `<SecurityNotice>` from `components/common/EmptyState.jsx`, so the
 *    two copies can never drift into two different warnings.
 *  - **No phone row renders.** `brand.support.phone` is `null`; there is no
 *    customer-facing number anywhere in this repository and §10.11 forbids inventing
 *    one. The row stays *conditional* rather than deleted: the moment the business
 *    supplies one, site-settings fills `support_phone` and it appears with no code
 *    change. The same is true of WhatsApp and staffed hours. A `null` phone renders
 *    nothing — that is the whole contract.
 *  - The page frame, the title register and the section rhythm come from
 *    `<PageShell archetype="editorial">` (§5.9), replacing a centred header, a bespoke
 *    `py` pair and a hand-rolled 64px success circle.
 *  - The success state is `<StateShell tone="ok">` — the same 64px circle, heading and
 *    one line as every other state on the site, instead of a lookalike built in place.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';

import SeoHead from '../components/common/SeoHead';
import {
  FOCUS_RING_SX,
  PRIMARY_ACTION_SX,
  PageShell,
  SecurityNotice,
  StateShell,
  TOUCH_TARGET_SX,
  buildStateActions,
} from '../components/common/EmptyState';
import { getApiErrorMessage, submitSupportRequest } from '../services/api';
import { useBrand } from '../content/brand';
import { usePolicy } from '../content/policy';

/** Exactly `content.SupportRequest.TOPIC_CHOICES`. A value outside it is a 400. */
const TOPICS = Object.freeze([
  { value: 'order', label: 'An order I placed' },
  { value: 'delivery', label: 'Delivery or tracking' },
  { value: 'returns', label: 'Returns or refunds' },
  { value: 'product', label: 'Product question' },
  { value: 'payment', label: 'Payment problem' },
  { value: 'other', label: 'Something else' },
]);

/** The serializer rejects a message shorter than this, so the form says so first. */
const MESSAGE_MIN_LENGTH = 10;

const isTopic = (value) => TOPICS.some((topic) => topic.value === value);

const Contact = () => {
  const [searchParams] = useSearchParams();
  const brand = useBrand();
  const { copy } = usePolicy();

  const requestedTopic = searchParams.get('topic');
  const requestedOrder = searchParams.get('order') || '';

  const [form, setForm] = useState(() => ({
    name: '',
    email: '',
    order_id: requestedOrder,
    topic: isTopic(requestedTopic) ? requestedTopic : 'other',
    message: '',
  }));
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [sending, setSending] = useState(false);
  /** `{detail, ticketRef}` once the ticket exists. */
  const [sent, setSent] = useState(null);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (sending) return;

      const localErrors = {};
      if (!form.name.trim()) localErrors.name = 'Please tell us your name.';
      if (!form.email.trim()) localErrors.email = 'We need an address to reply to.';
      if (form.message.trim().length < MESSAGE_MIN_LENGTH) {
        localErrors.message = 'Please tell us a little more — at least a sentence.';
      }
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors);
        return;
      }

      setSending(true);
      setBanner('');
      setFieldErrors({});
      try {
        const response = await submitSupportRequest({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          // Sent verbatim: the server keeps whatever the customer typed on
          // `order_reference` even when it does not resolve to a row, so a
          // mistyped or marketplace reference is still actionable.
          order_id: form.order_id.trim(),
          topic: form.topic,
          message: form.message.trim(),
        });
        setSent({
          detail: response?.detail || 'Thanks — we have your message.',
          ticketRef: response?.ticket_ref || '',
        });
      } catch (error) {
        const data = error?.response?.data;
        const nextErrors = {};
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          for (const key of ['name', 'email', 'order_id', 'topic', 'message']) {
            const value = data[key];
            if (Array.isArray(value) && value.length > 0) nextErrors[key] = value.join(' ');
            else if (typeof value === 'string' && value.trim()) nextErrors[key] = value.trim();
          }
        }
        setFieldErrors(nextErrors);
        if (Object.keys(nextErrors).length === 0) {
          setBanner(
            getApiErrorMessage(
              error,
              'We could not send that just now. Please try again, or email us directly.',
            ),
          );
        }
      } finally {
        setSending(false);
      }
    },
    [form, sending],
  );

  /**
   * Only the channels that actually exist get a row. `brand.support.phone` is `null`,
   * so there is no phone row — §5.8 and §10.11.
   */
  const channels = useMemo(() => {
    const rows = [
      {
        key: 'email',
        icon: <MailOutlineIcon />,
        label: 'Email',
        value: brand.support.email,
        href: `mailto:${brand.support.email}`,
      },
    ];
    if (brand.support.phone) {
      rows.push({
        key: 'phone',
        icon: <PhoneOutlinedIcon />,
        label: 'Phone',
        value: brand.support.phone,
        href: `tel:${String(brand.support.phone).replace(/\s+/g, '')}`,
      });
    }
    if (brand.support.whatsapp) {
      rows.push({
        key: 'whatsapp',
        icon: <ChatOutlinedIcon />,
        label: 'WhatsApp',
        value: brand.support.whatsapp,
        href: `https://wa.me/${String(brand.support.whatsapp).replace(/[^0-9]/g, '')}`,
      });
    }
    if (brand.support.hours) {
      rows.push({
        key: 'hours',
        icon: <ScheduleOutlinedIcon />,
        label: 'Hours',
        value: brand.support.hours,
        href: null,
      });
    }
    return rows;
  }, [brand.support]);

  return (
    <>
      <SeoHead
        title="Contact us"
        description={`Questions about an order, a delivery or a product? Message ${brand.seo.siteName} and a person will answer.`}
        canonical="/contact"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: `Contact ${brand.seo.siteName}`,
          mainEntity: {
            '@type': 'Organization',
            name: brand.legalName,
            email: brand.support.email,
          },
        }}
      />

      <PageShell
        archetype="editorial"
        maxWidth="lg"
        title="Contact us"
        intro="Tell us what has happened and we will sort it. Every message gets a reference number so you can follow it up."
      >
        <Grid container spacing={{ xs: 4, md: 6 }}>
          {/* ------------------------------------------------------- the form */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Box
              sx={{
                p: { xs: 2.5, md: 4 },
                backgroundColor: 'var(--lf-paper)',
                border: '1px solid var(--lf-hairline)',
                borderRadius: 'var(--lf-r-panel)',
              }}
            >
              {sent ? (
                <StateShell
                  icon={<CheckCircleOutlineIcon />}
                  tone="ok"
                  title="Message received"
                  message={sent.detail}
                  headingComponent="h2"
                  sx={{ px: 0 }}
                  actions={buildStateActions({
                    primaryLabel: 'Keep shopping',
                    primaryTo: '/products',
                    secondaryLabel: 'Send another message',
                    onSecondary: () => {
                      setSent(null);
                      setForm((current) => ({ ...current, message: '' }));
                    },
                  })}
                >
                  {sent.ticketRef ? (
                    <Box
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        backgroundColor: 'var(--lf-mat)',
                        borderRadius: 'var(--lf-r-card)',
                      }}
                    >
                      <Typography variant="eyebrow" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
                        Your reference
                      </Typography>
                      <Typography
                        variant="h5"
                        component="p"
                        className="lf-num"
                        sx={{ color: 'var(--lf-ink)' }}
                      >
                        {sent.ticketRef}
                      </Typography>
                    </Box>
                  ) : null}
                </StateShell>
              ) : (
                <Box component="form" onSubmit={handleSubmit} noValidate>
                  {banner ? (
                    <Alert severity="error" role="alert" sx={{ mb: 2.5 }}>
                      {banner}
                    </Alert>
                  ) : null}

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        required
                        id="name"
                        name="name"
                        label="Your name"
                        autoComplete="name"
                        value={form.name}
                        onChange={handleChange}
                        error={Boolean(fieldErrors.name)}
                        helperText={fieldErrors.name || ' '}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        required
                        id="email"
                        name="email"
                        type="email"
                        label="Email address"
                        autoComplete="email"
                        value={form.email}
                        onChange={handleChange}
                        error={Boolean(fieldErrors.email)}
                        helperText={fieldErrors.email || 'We reply to this address.'}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        fullWidth
                        id="topic"
                        name="topic"
                        label="What is it about?"
                        value={form.topic}
                        onChange={handleChange}
                        error={Boolean(fieldErrors.topic)}
                        helperText={fieldErrors.topic || ' '}
                      >
                        {TOPICS.map((topic) => (
                          <MenuItem key={topic.value} value={topic.value}>
                            {topic.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        id="order_id"
                        name="order_id"
                        label="Order number (optional)"
                        value={form.order_id}
                        onChange={handleChange}
                        error={Boolean(fieldErrors.order_id)}
                        helperText={
                          fieldErrors.order_id || 'If it is about an order, it speeds things up.'
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        required
                        multiline
                        minRows={5}
                        id="message"
                        name="message"
                        label="Your message"
                        value={form.message}
                        onChange={handleChange}
                        error={Boolean(fieldErrors.message)}
                        helperText={
                          fieldErrors.message ||
                          'What happened, and what would you like us to do about it?'
                        }
                      />
                    </Grid>
                  </Grid>

                  <Button
                    className="lf-press"
                    type="submit"
                    variant="contained"
                    color="primary"
                    disableElevation
                    fullWidth
                    aria-disabled={sending}
                    aria-busy={sending ? 'true' : undefined}
                    startIcon={
                      sending ? <CircularProgress size={16} thickness={3.6} color="inherit" /> : null
                    }
                    sx={{ mt: 3, ...PRIMARY_ACTION_SX, ...FOCUS_RING_SX }}
                  >
                    {sending ? 'Sending…' : 'Send message'}
                  </Button>

                  <Typography
                    variant="caption"
                    component="p"
                    sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}
                  >
                    We use what you send us only to answer you — see our{' '}
                    <Link
                      component={RouterLink}
                      to="/privacy-policy"
                      underline="always"
                      sx={{ color: 'var(--lf-gold-ink)', ...FOCUS_RING_SX }}
                    >
                      privacy policy
                    </Link>
                    .
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* -------------------------------------------------- the aside */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={3}>
              <Box
                sx={{
                  p: { xs: 2.5, md: 3 },
                  backgroundColor: 'var(--lf-mat)',
                  borderRadius: 'var(--lf-r-panel)',
                }}
              >
                <Typography variant="h5" component="h2" sx={{ color: 'var(--lf-ink)', mb: 2 }}>
                  Other ways to reach us
                </Typography>
                <Stack component="dl" spacing={2} sx={{ m: 0 }}>
                  {channels.map((channel) => (
                    <Box
                      key={channel.key}
                      sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                    >
                      <Box
                        aria-hidden="true"
                        sx={{ color: 'var(--lf-ink-3)', display: 'flex', '& > svg': { fontSize: 20 } }}
                      >
                        {channel.icon}
                      </Box>
                      <Box>
                        <Typography component="dt" variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                          {channel.label}
                        </Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0, color: 'var(--lf-ink)' }}>
                          {channel.href ? (
                            <Link
                              href={channel.href}
                              underline="always"
                              sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
                            >
                              {channel.value}
                            </Link>
                          ) : (
                            channel.value
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {/* §5.8 — the fraud notice, off every other route and onto this one. */}
              <SecurityNotice />

              <Box
                sx={{
                  p: { xs: 2.5, md: 3 },
                  backgroundColor: 'var(--lf-paper)',
                  border: '1px solid var(--lf-hairline)',
                  borderRadius: 'var(--lf-r-panel)',
                }}
              >
                <Typography variant="h5" component="h2" sx={{ color: 'var(--lf-ink)', mb: 1.5 }}>
                  Answered already?
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mb: 2 }}>
                  {copy.shippingLabel} · {copy.deliveryWindow}. {copy.returnsLine}
                </Typography>
                <Stack spacing={1}>
                  <Link
                    component={RouterLink}
                    to={brand.support.faqPath}
                    underline="always"
                    sx={{
                      color: 'var(--lf-gold-ink)',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      ...TOUCH_TARGET_SX,
                      ...FOCUS_RING_SX,
                    }}
                  >
                    Help
                  </Link>
                  <Link
                    component={RouterLink}
                    to="/shipping-returns"
                    underline="always"
                    sx={{
                      color: 'var(--lf-gold-ink)',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      ...TOUCH_TARGET_SX,
                      ...FOCUS_RING_SX,
                    }}
                  >
                    Delivery, returns &amp; refunds
                  </Link>
                  <Link
                    component={RouterLink}
                    to="/orders"
                    underline="always"
                    sx={{
                      color: 'var(--lf-gold-ink)',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      ...TOUCH_TARGET_SX,
                      ...FOCUS_RING_SX,
                    }}
                  >
                    Track an order
                  </Link>
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </PageShell>
    </>
  );
};

export default Contact;
