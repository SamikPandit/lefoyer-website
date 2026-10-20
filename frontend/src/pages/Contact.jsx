/**
 * /contact — NEW. LF-29.
 *
 * Before this page there was no way to reach a human from the storefront: no
 * contact route, no form, no address outside the legal pages' footers, and the
 * only phone number anywhere in the repo sat inside the Terms page's contact
 * block. Every dead end this change-set designs — a failed payment, an expired
 * verification link, a 404, an out-of-stock product — routes here through
 * `SupportLink`, which is why the form reads `?order=` and `?topic=` from the
 * query string: the context travels with the customer instead of being retyped.
 *
 * SOURCES
 *   `getSiteSettings()` (§2b #34), consumed through `content/brand.js`'s
 *   `useBrand()` so the fetch is memoised and shared with the navbar and footer
 *   rather than fired again here.
 *   `submitSupportRequest()` → `POST /api/content/support/contact/` (§2b #37),
 *   which answers `201 {detail, ticket_ref}`. The reference is shown prominently,
 *   because a support promise with no reference is not a support promise.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   No phone number and no response-time commitment. `brand.support.phone` is
 *   `null` — there is no customer-facing number anywhere in this repository and
 *   §4 forbids inventing one. The moment the business supplies one,
 *   site-settings fills `support_phone` and the row below appears with no code
 *   change. The same is true of WhatsApp and staffed hours.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
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
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../components/common/EmptyState';
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
  /** `{detail, ticket_ref}` once the ticket exists. */
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

  /** Only the channels that actually exist get a row. */
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

      <Box sx={{ backgroundColor: 'var(--lf-canvas)', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
            <Typography variant="h1" component="h1" sx={{ color: 'var(--lf-ink)', mb: 2 }}>
              Contact us
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'var(--lf-ink-2)', maxWidth: 620, mx: 'auto' }}>
              Tell us what has happened and we will sort it. Every message gets a
              reference number so you can follow it up.
            </Typography>
          </Box>

          <Grid container spacing={{ xs: 4, md: 6 }}>
            {/* ------------------------------------------------------- the form */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Box
                sx={{
                  p: { xs: 2.5, md: 4 },
                  backgroundColor: 'var(--lf-surface)',
                  border: '1px solid var(--lf-hairline)',
                  borderRadius: 'var(--lf-r-panel)',
                }}
              >
                {sent ? (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 64,
                        height: 64,
                        mx: 'auto',
                        mb: 2.5,
                        borderRadius: 'var(--lf-r-pill)',
                        backgroundColor: 'var(--lf-ok-tint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '& > svg': { fontSize: 28, color: 'var(--lf-ok-ink)' },
                      }}
                    >
                      <CheckCircleOutlineIcon />
                    </Box>
                    <Typography variant="h4" component="h2" sx={{ color: 'var(--lf-ink)', mb: 1 }}>
                      Message received
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'var(--lf-ink-2)' }}>
                      {sent.detail}
                    </Typography>

                    {sent.ticketRef ? (
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          backgroundColor: 'var(--lf-surface-sunken)',
                          borderRadius: 'var(--lf-r-card)',
                        }}
                      >
                        <Typography variant="overline" component="p" sx={{ color: 'var(--lf-ink-3)' }}>
                          Your reference
                        </Typography>
                        <Typography variant="h5" component="p" className="lf-num" sx={{ color: 'var(--lf-ink)' }}>
                          {sent.ticketRef}
                        </Typography>
                      </Box>
                    ) : null}

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      justifyContent="center"
                      sx={{ mt: 3 }}
                    >
                      <Button
                        className="lf-press"
                        component={RouterLink}
                        to="/products"
                        variant="contained"
                        color="primary"
                        disableElevation
                        sx={{ px: 3, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
                      >
                        Keep shopping
                      </Button>
                      <Button
                        className="lf-press"
                        variant="text"
                        onClick={() => {
                          setSent(null);
                          setForm((current) => ({ ...current, message: '' }));
                        }}
                        sx={{ color: 'var(--lf-ink-2)', ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
                      >
                        Send another message
                      </Button>
                    </Stack>
                  </Box>
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
                          helperText={fieldErrors.order_id || 'If it is about an order, it speeds things up.'}
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
                      startIcon={sending ? <CircularProgress size={16} color="inherit" /> : null}
                      sx={{ mt: 3, py: 1.5, ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
                    >
                      {sending ? 'Sending…' : 'Send message'}
                    </Button>

                    <Typography variant="caption" component="p" sx={{ mt: 1.5, color: 'var(--lf-ink-3)' }}>
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
                    backgroundColor: 'var(--lf-surface-sunken)',
                    borderRadius: 'var(--lf-r-panel)',
                  }}
                >
                  <Typography variant="h5" component="h2" sx={{ color: 'var(--lf-ink)', mb: 2 }}>
                    Other ways to reach us
                  </Typography>
                  <Stack component="dl" spacing={2} sx={{ m: 0 }}>
                    {channels.map((channel) => (
                      <Box key={channel.key} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
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

                <Box
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    backgroundColor: 'var(--lf-surface)',
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
                      to="/faq"
                      underline="always"
                      sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
                    >
                      Read the FAQ
                    </Link>
                    <Link
                      component={RouterLink}
                      to="/shipping-returns"
                      underline="always"
                      sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
                    >
                      Delivery, returns &amp; refunds
                    </Link>
                    <Link
                      component={RouterLink}
                      to="/orders"
                      underline="always"
                      sx={{ color: 'var(--lf-gold-ink)', fontWeight: 500, ...FOCUS_RING_SX }}
                    >
                      Track an order
                    </Link>
                  </Stack>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
};

export default Contact;
