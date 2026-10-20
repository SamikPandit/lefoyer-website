/**
 * SupportLink — the one way to offer a customer a human.
 *
 * Every dead end on this site (a failed payment, an expired verification token, a 404,
 * a third failed retry) must offer a route to support, and all of them must point at
 * the same place with the same words. This component is that place.
 *
 * THERE IS NO PHONE NUMBER, AND THIS COMPONENT WILL NOT RENDER ONE.
 * `brand.support.phone` is `null` because no phone number exists anywhere in this
 * repository, and IMPL_SPEC §4 forbids inventing one. If the business supplies one, the
 * site-settings API fills `support_phone` and this component starts rendering a `tel:`
 * row — with no code change here. Until then, support is the contact form and email.
 *
 * Usage:
 *   <SupportLink />                                        "Contact support" -> /contact
 *   <SupportLink channel="email" />                        mailto: support@...
 *   <SupportLink orderNumber={order.order_number} />       prefills the form/subject
 *   <SupportLink variant="button" label="Get help" />
 */

import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';

import { useBrand } from '../../content/brand';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from './EmptyState';

/**
 * Build a mailto: URL for the support address. Everything is encoded, so an order
 * number or a customer-typed subject cannot break out of the URL.
 * @param {object} options
 * @param {string} options.email Support address (from brand.js — do not hard-code one).
 * @param {string} [options.subject]
 * @param {string} [options.body]
 * @param {string} [options.orderNumber] Appended to the subject when given.
 * @returns {string}
 */
export function supportMailto({ email, subject, body, orderNumber }) {
  const subjectParts = [];
  if (subject) subjectParts.push(subject);
  if (orderNumber) subjectParts.push(`Order ${orderNumber}`);
  const params = [];
  if (subjectParts.length > 0) {
    params.push(`subject=${encodeURIComponent(subjectParts.join(' - '))}`);
  }
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${params.length > 0 ? `?${params.join('&')}` : ''}`;
}

/**
 * Build the internal /contact path, carrying context so the form can prefill.
 * @param {object} options
 * @param {string} options.contactPath
 * @param {string} [options.orderNumber]
 * @param {string} [options.topic]
 * @returns {string}
 */
export function supportContactPath({ contactPath, orderNumber, topic }) {
  const params = new URLSearchParams();
  if (orderNumber) params.set('order', orderNumber);
  if (topic) params.set('topic', topic);
  const query = params.toString();
  return query ? `${contactPath}?${query}` : contactPath;
}

/**
 * @param {object} props
 * @param {'contact'|'email'} [props.channel='contact'] `contact` routes to the support
 *   form (client-side, no page load); `email` opens the customer's mail client. Prefer
 *   `contact` — it produces a ticket reference; use `email` where the form itself may be
 *   unreachable (for example inside a global error boundary).
 * @param {string} [props.label] Defaults to "Contact support", or the support address
 *   itself when `showAddress` is set.
 * @param {boolean} [props.showAddress=false] Render the address as the label. Use in a
 *   footer or a policy page, where the literal address is the useful thing.
 * @param {'text'|'button'|'inline'} [props.variant='text'] `inline` drops the 44px
 *   minimum because it sits inside a sentence; use it only mid-paragraph.
 * @param {string} [props.orderNumber] Prefills the subject / the form's order field.
 * @param {string} [props.topic] Prefills the form's topic field.
 * @param {string} [props.subject] Mailto subject (ignored for `channel="contact"`).
 * @param {string} [props.body] Mailto body (ignored for `channel="contact"`).
 * @param {'small'|'medium'|'large'} [props.size='medium'] Button size.
 * @param {object} [props.sx]
 */
const SupportLink = ({
  channel = 'contact',
  label,
  showAddress = false,
  variant = 'text',
  orderNumber,
  topic,
  subject,
  body,
  size = 'medium',
  sx,
  ...rest
}) => {
  const brand = useBrand();
  const { support } = brand;

  const text = label || (showAddress ? support.email : 'Contact support');

  const linkProps =
    channel === 'email'
      ? { href: supportMailto({ email: support.email, subject, body, orderNumber }) }
      : {
          component: RouterLink,
          to: supportContactPath({
            contactPath: support.contactPath,
            orderNumber,
            topic,
          }),
        };

  if (variant === 'button') {
    return (
      <Button
        className="lf-press"
        variant="outlined"
        size={size}
        {...linkProps}
        sx={{ ...TOUCH_TARGET_SX, px: 2.5, ...FOCUS_RING_SX, ...sx }}
        {...rest}
      >
        {text}
      </Button>
    );
  }

  const isInline = variant === 'inline';

  return (
    <Link
      {...linkProps}
      underline="always"
      sx={{
        color: 'var(--lf-gold-ink, #7A5A24)',
        textDecorationColor: 'currentColor',
        fontWeight: 500,
        '&:hover': { color: 'var(--lf-gold-ink-hv, #6E4F1E)' },
        ...(isInline
          ? {}
          : {
              // A standalone support link is a target, so it gets a target's size.
              display: 'inline-flex',
              alignItems: 'center',
              ...TOUCH_TARGET_SX,
            }),
        ...FOCUS_RING_SX,
        ...sx,
      }}
      {...rest}
    >
      {text}
    </Link>
  );
};

export default SupportLink;
