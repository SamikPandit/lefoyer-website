/**
 * CustomerTestimonials — real reviews, or nothing at all.
 *
 * LF-22 / LF-01: this component shipped three fabricated people — "Priya
 * Sharma, Beauty Enthusiast", "Anjali Patel, **Verified Buyer**" and "Rahul
 * Verma, Happy Customer" — each with an invented five-star rating and an
 * invented quote, on a site whose `reviews.Review` table is empty. One of them
 * was literally titled "Verified Buyer" with nothing behind it.
 *
 * It now renders `listTopReviews({limit:3, min_rating:4})` (§2a / §2b #13) and
 * NOTHING ELSE:
 *   - no reviews -> the section does not render. On the seeded database (zero
 *     reviews, every product `rating=0.00`) the homepage therefore has no
 *     testimonial section. That is the correct output, not a bug;
 *   - a request failure also renders nothing: social proof is not something to
 *     apologise for in an error panel, and there is no honest placeholder;
 *   - the "Verified Buyer" chip appears ONLY when the server says
 *     `is_verified_purchase` (§2e: written server-side from a COMPLETED order,
 *     never client-writable);
 *   - the author line is the server's `author.display_name` — the serializer
 *     masks the email local part when a user has no name, so no user id and no
 *     raw address reaches the page;
 *   - the product the review is about is named and linked to its PDP.
 *
 * `react-slick` is gone with the fabricated carousel (DESIGN_SYSTEM §9.9 bans
 * reaching for it; the lead uninstalls the package). Three reviews are a grid.
 */

import { useEffect, useState } from 'react';

import { Box, Chip, Container, Grid, Rating, Stack, Typography } from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { Link } from 'react-router-dom';

import { listTopReviews } from '../../services/api';

const REVIEW_LIMIT = 3;
const MIN_RATING = 4;

const ReviewCard = ({ review }) => {
  const product = review.product || null;
  const author = (review.author && review.author.display_name) || null;

  return (
    <Box
      sx={{
        height: '100%',
        p: { xs: 2.5, md: 3 },
        borderRadius: 'var(--lf-r-card, 14px)',
        border: '1px solid var(--lf-hairline, #E7E0D6)',
        backgroundColor: 'var(--lf-surface, #FFFFFF)',
        boxShadow: 'var(--lf-e-edge)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FormatQuoteIcon
        aria-hidden="true"
        sx={{ fontSize: 32, color: 'var(--lf-gold-edge, #A8803A)', mb: 1 }}
      />

      <Rating
        value={Number(review.rating)}
        readOnly
        size="small"
        /* The accessible name states the number: a star row alone is not text. */
        aria-label={`${Number(review.rating)} out of 5`}
        sx={{ mb: 1.5 }}
      />

      {review.title ? (
        <Typography variant="h5" component="h3" sx={{ color: 'var(--lf-ink, #14110F)', mb: 0.75 }}>
          {review.title}
        </Typography>
      ) : null}

      <Typography
        variant="body2"
        className="lf-clamp-5"
        sx={{ color: 'var(--lf-ink-2, #4A433C)', mb: 2 }}
      >
        {review.comment}
      </Typography>

      <Box sx={{ mt: 'auto' }}>
        {product && product.slug ? (
          <Typography variant="caption" component="p" sx={{ mb: 0.75 }}>
            <Box
              component={Link}
              to={`/product/${product.slug}`}
              sx={{ color: 'var(--lf-gold-ink, #7A5A24)', textDecorationColor: 'currentColor' }}
            >
              {product.name}
            </Box>
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          {author ? (
            <Typography variant="subtitle2" sx={{ color: 'var(--lf-ink, #14110F)' }}>
              {author}
            </Typography>
          ) : null}

          {review.is_verified_purchase ? (
            <Chip label="Verified Buyer" variant="statusOk" size="small" />
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
};

const CustomerTestimonials = () => {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let alive = true;

    listTopReviews({ limit: REVIEW_LIMIT, min_rating: MIN_RATING })
      .then(({ items }) => {
        if (alive) setReviews(items || []);
      })
      .catch(() => {
        // No reviews we can prove -> no section. Never a placeholder person.
        if (alive) setReviews([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (reviews.length === 0) return null;

  return (
    <Box
      component="section"
      aria-labelledby="home-reviews-heading"
      sx={{ py: { xs: 5, md: 8 }, backgroundColor: 'var(--lf-surface, #FFFFFF)' }}
    >
      <Container>
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <Typography variant="overline" component="p" sx={{ color: 'var(--lf-gold-ink, #7A5A24)' }}>
            From our customers
          </Typography>
          <Typography
            id="home-reviews-heading"
            variant="h2"
            component="h2"
            sx={{ color: 'var(--lf-ink, #14110F)', mt: 0.5, mb: 1.5 }}
          >
            Reviews, as written
          </Typography>
          <Box className="lf-rule" component="hr" sx={{ maxWidth: 160 }} />
        </Box>

        <Grid container spacing={2}>
          {reviews.map((review) => (
            <Grid key={review.id} size={{ xs: 12, md: 4 }}>
              <ReviewCard review={review} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default CustomerTestimonials;
