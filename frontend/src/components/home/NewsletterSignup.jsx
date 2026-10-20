/**
 * NewsletterSignup — the homepage newsletter band.
 *
 * LF-04: the previous version was its own form with a 1500ms `setTimeout`
 * pretending to be a network call ("Thank you for subscribing!" was printed
 * whether or not anything was stored), its own email regex, and the wordmark
 * typo "Le foyeR..". It now delegates entirely to the shared
 * `<NewsletterForm variant="hero" />`, which posts to
 * `newsletter/subscribe/`, requires explicit consent, puts a 400 on the field
 * it belongs to, and reports `subscribed` vs `already_subscribed` honestly.
 *
 * `source="home"` is what distinguishes this row from the footer form in the
 * `NewsletterSubscriber` table. All copy comes from `brand.newsletter`.
 *
 * This file is deliberately a thin band: section chrome only. Any change to the
 * form belongs in `components/common/NewsletterForm.jsx` so the homepage and the
 * footer can never drift apart.
 */

import { Box, Container } from '@mui/material';

import NewsletterForm from '../common/NewsletterForm';

const NewsletterSignup = () => (
  <Box
    component="section"
    aria-label="Newsletter signup"
    sx={{
      py: { xs: 5, md: 8 },
      backgroundColor: 'var(--lf-canvas, #FDFBF9)',
      borderTop: '1px solid var(--lf-hairline, #E7E0D6)',
    }}
  >
    <Container>
      <NewsletterForm variant="hero" source="home" />
    </Container>
  </Box>
);

export default NewsletterSignup;
