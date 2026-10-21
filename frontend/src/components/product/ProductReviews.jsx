/**
 * ============================================================================
 * ProductReviews — the PDP review block. LF-01's centre of gravity, and
 * ART_DIRECTION.md §6's empty state.
 *
 * THE CRAFT DEFECT THIS CHANGE FIXES
 *   At zero reviews — which is EVERY product, verified: all six have an empty
 *   `Review` table — this block rendered a heading, a gold rule, a "Write a
 *   review" heading, a paragraph, a button, and then a page-variant
 *   `<EmptyState>` with a 64px beige circle and its own vertical padding. In
 *   pdp-desk.png that is roughly a third of a screen of nothing, below a
 *   section that had already said the same thing. The invitation and the
 *   action are now ONE compact row: the sentence on the left, the thing you
 *   press on the right, no circle, no second heading, no duplicate sentence.
 *   Nothing is lost — the form, the sign-in path and the honest copy all stay.
 *
 * WHAT IT ALREADY REPLACED, AND MUST KEEP REPLACING
 *  - It imported `getProductReviews` / `createProductReview` from the **mock
 *    review module**, so every star on the live site was fabricated.
 *  - It **averaged the page of reviews it happened to be holding**
 *    (`reviews.reduce(...) / reviews.length`) and built the histogram from that
 *    page. §2e mechanism 3 forbids exactly this. The average, the count, the
 *    histogram and the verified count come from `review_summary` and nowhere
 *    else, which is why the PDP, this block, the card and the JSON-LD are
 *    necessarily the same number.
 *  - With no reviews it printed `0` beside a zero-star `<Rating>` and a
 *    0%-everywhere histogram. §10.9: **no star row, no `0.0`, no `(0)`.**
 *    Production once shipped hand-typed 4.50/40-reviews with no review rows;
 *    inventing social proof is the worst thing available here.
 *  - `review.user.username.charAt(0)` would have thrown on the real payload,
 *    which emits `author: {display_name}` and no user id at all (§2b #11).
 *  - It read `token` off `useAuth()`, which that context does not expose, so
 *    `disabled={submitting || !token}` disabled submit permanently.
 *
 * TRUTHFUL SUCCESS COPY
 *   `Review.is_approved` defaults to `True` but is a moderation switch ops can
 *   flip. The `201` carries the recomputed `review_summary`, which counts
 *   approved rows only: if the count went up the review is live, if it did not
 *   it is awaiting moderation. Read from the response, never assumed.
 *
 * THE ANCHOR CONTRACT: `#reviews` is the section (<ProductCard> links to it)
 * and `#write-a-review` is the form itself (§5.3's "a real anchor that
 * scroll-targets the review form"). Both resolve on this page.
 * ========================================================================== */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Rating from '@mui/material/Rating';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  createProductReview,
  getApiErrorMessage,
  getReviewSummary,
  listProductReviews,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { reviewView } from './productPresentation';

const REVIEW_SORTS = Object.freeze([
  { value: '-created_at', label: 'Newest first' },
  { value: '-rating', label: 'Highest rated' },
  { value: 'rating', label: 'Lowest rated' },
  { value: '-is_verified_purchase', label: 'Verified buyers first' },
]);

const MAX_COMMENT = 2000;
const MAX_TITLE = 140;

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

/** First DRF field error for `field`, or null. */
const fieldError = (data, field) => {
  const value = data?.[field];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
};

/**
 * @param {object} props
 * @param {string} props.slug
 * @param {object} [props.summary] `product.review_summary`. The PDP passes it so the
 *   buy box's review link and this block are provably the same number; omitted,
 *   it is fetched.
 * @param {Function} [props.onSummaryChange] Called with a fresh `ReviewSummary` after a
 *   successful submission, so the PDP and the JSON-LD repaint from the server's
 *   numbers.
 * @param {string} [props.productName]
 */
const ProductReviews = ({ slug, summary, onSummaryChange, productName }) => {
  const baseId = useId();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [serverSummary, setServerSummary] = useState(summary ?? null);
  const [items, setItems] = useState([]);
  const [listStatus, setListStatus] = useState('loading');
  const [listError, setListError] = useState(null);
  const [ordering, setOrdering] = useState(REVIEW_SORTS[0].value);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submitMessage, setSubmitMessage] = useState(null);

  const aliveRef = useRef(true);
  const controllerRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  // The PDP is the owner of the summary; adopt its value whenever it changes.
  useEffect(() => {
    if (summary !== undefined && summary !== null) setServerSummary(summary);
  }, [summary]);

  const view = useMemo(() => reviewView(serverSummary), [serverSummary]);

  const loadReviews = useCallback(async () => {
    if (!slug) return;
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setListStatus('loading');
    setListError(null);
    try {
      const result = await listProductReviews(
        slug,
        { ordering, page: page > 1 ? page : undefined },
        { signal: controller.signal },
      );
      if (!aliveRef.current || controller.signal.aborted) return;
      setItems(result.items);
      setHasNext(Boolean(result.next));
      setListStatus(result.items.length ? 'ready' : 'empty');
    } catch (requestError) {
      if (requestError?.isCanceled || controller.signal.aborted || !aliveRef.current) return;
      setListError(requestError);
      setListStatus('error');
    }
  }, [slug, ordering, page]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Only when the PDP did not hand us one (a standalone mount, or a payload from an
  // older backend build). §2e: it is never computed from `items`.
  useEffect(() => {
    if (!slug || serverSummary) return;
    let alive = true;
    getReviewSummary(slug)
      .then((data) => {
        if (alive && data) setServerSummary(data);
      })
      .catch(() => {
        /* the block still works without it: no summary means no stars, which is honest */
      });
    return () => {
      alive = false;
    };
  }, [slug, serverSummary]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = {};
    if (!rating) nextErrors.rating = 'Please choose a star rating.';
    if (!comment.trim()) nextErrors.comment = 'Please tell other shoppers what you thought.';
    setFormErrors(nextErrors);
    setSubmitMessage(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    const countBefore = view.count;
    try {
      const response = await createProductReview(slug, {
        rating,
        title: title.trim(),
        comment: comment.trim(),
      });
      if (!aliveRef.current) return;

      const nextSummary = response?.review_summary ?? null;
      if (nextSummary) {
        setServerSummary(nextSummary);
        if (onSummaryChange) onSummaryChange(nextSummary);
      }

      const nextCount = reviewView(nextSummary).count;
      // Read from the response, never assumed: the summary counts approved rows only.
      setSubmitMessage({
        severity: 'success',
        text:
          nextCount > countBefore
            ? 'Thank you — your review is now published on this page.'
            : 'Thank you — your review has been submitted and is awaiting moderation.',
      });

      setRating(0);
      setTitle('');
      setComment('');
      setFormErrors({});
      setPage(1);
      loadReviews();
    } catch (requestError) {
      if (!aliveRef.current) return;
      const data = requestError?.response?.data;
      const status = requestError?.response?.status;

      const perField = {
        rating: fieldError(data, 'rating'),
        title: fieldError(data, 'title'),
        comment: fieldError(data, 'comment'),
      };
      const hasFieldErrors = Object.values(perField).some(Boolean);
      if (hasFieldErrors) {
        setFormErrors({
          ...(perField.rating ? { rating: perField.rating } : null),
          ...(perField.title ? { title: perField.title } : null),
          ...(perField.comment ? { comment: perField.comment } : null),
        });
      }

      setSubmitMessage({
        severity: status === 409 ? 'info' : 'error',
        // The server's own sentence, which is what §2b #12 promises
        // ("You have already reviewed this product. Edit your existing review instead.")
        text: hasFieldErrors
          ? 'Please check the highlighted fields.'
          : getApiErrorMessage(requestError, 'We could not save your review. Please try again.'),
      });
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  };

  const histogram = [5, 4, 3, 2, 1].map((star) => {
    const count = view.distribution[star] || 0;
    return { star, count, percent: view.count > 0 ? (count / view.count) * 100 : 0 };
  });

  /* The form, or the reason you cannot use it yet. One definition, rendered in
     the empty row at zero reviews and beneath the list once reviews exist, so
     there is never a second "Write a review" heading on the page. */
  const writeBlock = isAuthenticated ? (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ maxWidth: 640, minWidth: 0 }}>
      <Box sx={{ mb: 'var(--lf-4)' }}>
        <Typography
          component="label"
          htmlFor={`${baseId}-rating`}
          variant="subtitle2"
          sx={{ display: 'block', mb: 'var(--lf-1)' }}
        >
          Your rating
        </Typography>
        {/* A REAL, interactive input — not a readout. The ban in §10.9 is on
            rendering a rating nobody gave; this is how somebody gives one. */}
        <Rating
          id={`${baseId}-rating`}
          name="rating"
          value={rating}
          readOnly={false}
          onChange={(_event, next) => {
            setRating(next || 0);
            setFormErrors((previous) => ({ ...previous, rating: undefined }));
          }}
          size="large"
        />
        {formErrors.rating ? (
          <Typography
            variant="caption"
            role="alert"
            sx={{ display: 'block', color: 'var(--lf-err-ink)' }}
          >
            {formErrors.rating}
          </Typography>
        ) : null}
      </Box>

      <TextField
        id={`${baseId}-title`}
        label="Headline (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE))}
        error={Boolean(formErrors.title)}
        helperText={formErrors.title || `${title.length}/${MAX_TITLE}`}
        sx={{ mb: 'var(--lf-3)' }}
      />

      <TextField
        id={`${baseId}-comment`}
        label="Your review"
        value={comment}
        onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT))}
        multiline
        rows={4}
        required
        error={Boolean(formErrors.comment)}
        helperText={formErrors.comment || `${comment.length}/${MAX_COMMENT}`}
        sx={{ mb: 'var(--lf-3)' }}
      />

      <Button
        className="lf-press"
        type="submit"
        variant="contained"
        color="primary"
        aria-busy={submitting || undefined}
        sx={{
          minHeight: 48,
          px: 'var(--lf-6)',
          ...(submitting ? { pointerEvents: 'none' } : null),
          ...FOCUS_RING_SX,
        }}
        startIcon={
          submitting ? <CircularProgress size={16} thickness={3.6} sx={{ color: 'inherit' }} /> : null
        }
      >
        {submitting ? 'Submitting' : 'Submit review'}
      </Button>
    </Box>
  ) : (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mb: 'var(--lf-3)' }}>
        Reviews come from signed-in customers, so every one belongs to a real account.
      </Typography>
      <Button
        className="lf-press"
        component={RouterLink}
        to="/login"
        state={{ from: location }}
        variant="outlined"
        sx={{ ...TOUCH_TARGET_SX, minHeight: 48, ...FOCUS_RING_SX }}
      >
        Sign in to write a review
      </Button>
    </Box>
  );

  const isEmpty = !view.hasReviews && listStatus !== 'ready' && listStatus !== 'error';

  return (
    <Box component="section" id="reviews" aria-labelledby={`${baseId}-heading`} sx={{ minWidth: 0 }}>
      <Typography id={`${baseId}-heading`} variant="h3" component="h2">
        Reviews
      </Typography>
      {/* A neutral hairline, not a gold rule: this page spends its two licensed
          ledges on the buy box and the shelf (§3.3, max four per page). */}
      <Box className="lf-rule" sx={{ mt: 'var(--lf-3)', mb: 'var(--lf-5)' }} />

      {submitMessage ? (
        <Alert severity={submitMessage.severity} sx={{ mb: 'var(--lf-4)' }}>
          {submitMessage.text}
        </Alert>
      ) : null}

      {listStatus === 'error' ? (
        <ErrorState
          title="Couldn't load reviews"
          error={listError}
          onRetry={loadReviews}
          secondaryLabel={null}
          variant="inline"
          headingComponent="h3"
        />
      ) : isEmpty ? (
        /* ---------------- §6's EMPTY STATE: one compact row ----------------
           The invitation and the action, side by side. No 64px circle, no
           second heading, no page-variant padding — that is the vertical
           emptiness this section used to be. */
        <Box
          id="write-a-review"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
            gap: { xs: 'var(--lf-5)', md: 'var(--lf-10)' },
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h3">
              No reviews yet
            </Typography>
            <Typography variant="body2" sx={{ mt: 'var(--lf-2)', color: 'var(--lf-ink-2)' }}>
              {productName
                ? `Nobody has reviewed ${productName} yet. If you have tried it, yours would be the first.`
                : 'Nobody has reviewed this product yet. If you have tried it, yours would be the first.'}
            </Typography>
            {listStatus === 'loading' ? (
              <Typography
                role="status"
                aria-live="polite"
                variant="caption"
                sx={{ display: 'block', mt: 'var(--lf-2)', color: 'var(--lf-ink-3)' }}
              >
                Checking for reviews…
              </Typography>
            ) : null}
          </Box>
          {writeBlock}
        </Box>
      ) : (
        <>
          {/* ---------------- summary: from review_summary ONLY (§2e) ------- */}
          {view.hasReviews ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 180px) minmax(0, 1fr)' },
                gap: { xs: 'var(--lf-4)', sm: 'var(--lf-8)' },
                mb: 'var(--lf-6)',
                minWidth: 0,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="priceLg" component="p">
                  {view.averageLabel}
                </Typography>
                <Rating value={view.average} precision={0.1} readOnly />
                <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
                  {view.countLabel}
                  {view.verifiedCount > 0 ? ` · ${view.verifiedCount} verified` : ''}
                </Typography>
              </Box>

              <Box sx={{ minWidth: 0 }}>
                {histogram.map(({ star, count, percent }) => (
                  <Box
                    key={star}
                    sx={{ display: 'flex', alignItems: 'center', gap: 'var(--lf-2)', mb: 'var(--lf-1)' }}
                  >
                    <Typography variant="caption" sx={{ minWidth: 48, color: 'var(--lf-ink-2)' }}>
                      {star} star
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={percent}
                      aria-hidden="true"
                      sx={{ flex: 1, height: 8 }}
                    />
                    <Typography variant="caption" sx={{ minWidth: 40, color: 'var(--lf-ink-3)' }}>
                      {count}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}

          {/* ---------------- the list ---------------- */}
          {listStatus === 'ready' ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 'var(--lf-3)' }}>
                <FormControl size="small" sx={{ maxWidth: 240 }}>
                  <InputLabel id={`${baseId}-sort-label`}>Sort reviews</InputLabel>
                  <Select
                    labelId={`${baseId}-sort-label`}
                    label="Sort reviews"
                    value={ordering}
                    onChange={(event) => {
                      setPage(1);
                      setOrdering(event.target.value);
                    }}
                    sx={{ ...FOCUS_RING_SX }}
                  >
                    {REVIEW_SORTS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {items.map((review) => (
                <Box
                  key={review.id}
                  component="article"
                  sx={{ borderTop: '1px solid var(--lf-hairline)', py: 'var(--lf-5)' }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--lf-2)',
                      flexWrap: 'wrap',
                      mb: 'var(--lf-1)',
                    }}
                  >
                    <Rating value={Number(review.rating) || 0} readOnly size="small" />
                    <Typography variant="subtitle2">
                      {review.author?.display_name || 'Le foyeR. customer'}
                    </Typography>
                    {/* §2e: the chip exists ONLY for a server-computed verified purchase. */}
                    {review.is_verified_purchase ? (
                      <Chip label="Verified buyer" size="small" variant="statusOk" />
                    ) : null}
                    <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                      {formatDate(review.created_at)}
                    </Typography>
                  </Box>
                  {review.title ? (
                    <Typography variant="h6" component="h3" sx={{ mb: 'var(--lf-1)' }}>
                      {review.title}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                    {review.comment}
                  </Typography>
                </Box>
              ))}

              {page > 1 || hasNext ? (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 'var(--lf-2)',
                    justifyContent: 'center',
                    borderTop: '1px solid var(--lf-hairline)',
                    pt: 'var(--lf-3)',
                  }}
                >
                  <Button
                    className="lf-press"
                    variant="text"
                    aria-disabled={page <= 1 || undefined}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    sx={{
                      ...TOUCH_TARGET_SX,
                      ...(page <= 1 ? { pointerEvents: 'none', color: 'var(--lf-ink-3)' } : null),
                      ...FOCUS_RING_SX,
                    }}
                  >
                    Newer
                  </Button>
                  <Button
                    className="lf-press"
                    variant="text"
                    aria-disabled={!hasNext || undefined}
                    onClick={() => setPage((current) => current + 1)}
                    sx={{
                      ...TOUCH_TARGET_SX,
                      ...(!hasNext ? { pointerEvents: 'none', color: 'var(--lf-ink-3)' } : null),
                      ...FOCUS_RING_SX,
                    }}
                  >
                    Older
                  </Button>
                </Box>
              ) : null}
            </>
          ) : null}

          {/* The form sits beneath real reviews, where it belongs once there is
              something to read first. */}
          <Box
            id="write-a-review"
            sx={{ borderTop: '1px solid var(--lf-hairline)', pt: 'var(--lf-5)', mt: 'var(--lf-5)' }}
          >
            <Typography variant="h5" component="h3" sx={{ mb: 'var(--lf-3)' }}>
              Write a review
            </Typography>
            {writeBlock}
          </Box>
        </>
      )}
    </Box>
  );
};

export default ProductReviews;
