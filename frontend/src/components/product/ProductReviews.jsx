/**
 * ProductReviews — the PDP review block. This file is LF-01's centre of gravity.
 *
 * WHAT IT REPLACES (verified in the file this overwrites)
 *  - It imported `getProductReviews` / `createProductReview` from the **mock review module**
 *    (§1 C-16), so every star on the live site was fabricated. The real catalogue has
 *    `rating = 0.00`, `reviews_count = 0` and an **empty `Review` table**.
 *  - It **averaged the page of reviews it happened to be holding**
 *    (`reviews.reduce(...) / reviews.length`) and built the histogram from that page.
 *    §2e mechanism 3 forbids exactly this: "No component may average a page of reviews
 *    client-side — that is the exact bug in `ProductReviews.jsx` today." The average,
 *    the count, the histogram and the verified count now come from `review_summary` and
 *    nowhere else, which is why the PDP hero stars, this block, the card badge and the
 *    JSON-LD `aggregateRating` are necessarily the same number.
 *  - With no reviews it printed `0` next to a zero-star `<Rating>` and a 0%-everywhere
 *    histogram. At `count === 0` nothing is rendered but the "No reviews yet" state
 *    (DESIGN_SYSTEM §6.9, §9 #13).
 *  - `review.user.username.charAt(0)` would have thrown on the real payload, which emits
 *    `author: {display_name}` and no user id at all (§2b #11).
 *  - It read `token` off `useAuth()`, which that context does not expose, so
 *    `disabled={submitting || !token}` disabled the submit button permanently.
 *  - It reported `'Review submitted successfully!'` from a `try` block regardless of what
 *    came back, and showed a generic `'Failed to submit review. Please try again.'`
 *    instead of the server's field errors.
 *
 * TRUTHFUL SUCCESS COPY
 * `Review.is_approved` defaults to `True` today, but it is a moderation switch that ops
 * can flip, and `ReviewViewSet.get_queryset()` shows an author their own unapproved row.
 * So we do not *assert* either outcome: the `201` response carries the recomputed
 * `review_summary`, which counts approved rows only. If the count went up, the review is
 * live; if it did not, it is awaiting moderation. That is read from the response, never
 * assumed.
 */

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
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';

import {
  createProductReview,
  getApiErrorMessage,
  getReviewSummary,
  listProductReviews,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import EmptyState, { FOCUS_RING_SX, TOUCH_TARGET_SX } from '../common/EmptyState';
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
 *   hero stars and this block are provably the same number; omitted, it is fetched.
 * @param {Function} [props.onSummaryChange] Called with a fresh `ReviewSummary` after a
 *   successful submission, so the PDP hero, the proof row and the JSON-LD repaint from
 *   the server's numbers.
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

  return (
    <Box component="section" id="reviews" aria-labelledby={`${baseId}-heading`} sx={{ minWidth: 0 }}>
      <Typography id={`${baseId}-heading`} variant="h4" component="h2" sx={{ mb: 1 }}>
        Reviews
      </Typography>
      <Box className="lf-rule" sx={{ mb: 3 }} />

      {/* ---------------- summary: from review_summary ONLY (§2e) ---------------- */}
      {view.hasReviews ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 4 },
            mb: 4,
          }}
        >
          <Box sx={{ minWidth: 140 }}>
            <Typography variant="priceLg" component="p">
              {view.averageLabel}
            </Typography>
            <Rating value={view.average} precision={0.1} readOnly />
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
              {view.countLabel}
              {view.verifiedCount > 0 ? ` · ${view.verifiedCount} verified` : ''}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {histogram.map(({ star, count, percent }) => (
              <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ minWidth: 48, color: 'var(--lf-ink-2)' }}>
                  {star} star
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={percent}
                  aria-hidden="true"
                  sx={{ flex: 1, height: 8 }}
                />
                <Typography variant="caption" sx={{ minWidth: 56, color: 'var(--lf-ink-3)' }}>
                  {count}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}

      {/* ---------------- write a review ---------------- */}
      <Box sx={{ borderTop: '1px solid var(--lf-hairline)', pt: 3, mb: 4 }}>
        <Typography variant="h5" component="h3" sx={{ mb: 1.5 }}>
          Write a review
        </Typography>

        {submitMessage ? (
          <Alert severity={submitMessage.severity} sx={{ mb: 2 }}>
            {submitMessage.text}
          </Alert>
        ) : null}

        {!isAuthenticated ? (
          <Box>
            <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)', mb: 1.5 }}>
              Reviews come from signed-in customers, so every one belongs to a real account.
            </Typography>
            <Button
              className="lf-press"
              component={RouterLink}
              to="/login"
              state={{ from: location }}
              variant="outlined"
              sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
            >
              Sign in to write a review
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ maxWidth: 640 }}>
            <Box sx={{ mb: 2 }}>
              <Typography component="label" htmlFor={`${baseId}-rating`} variant="subtitle2" sx={{ display: 'block', mb: 0.5 }}>
                Your rating
              </Typography>
              <Rating
                id={`${baseId}-rating`}
                name="rating"
                value={rating}
                onChange={(_event, next) => {
                  setRating(next || 0);
                  setFormErrors((previous) => ({ ...previous, rating: undefined }));
                }}
                size="large"
              />
              {formErrors.rating ? (
                <Typography variant="caption" role="alert" sx={{ display: 'block', color: 'var(--lf-err-ink)' }}>
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
              sx={{ mb: 2 }}
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
              sx={{ mb: 2 }}
            />

            <Button
              className="lf-press"
              type="submit"
              variant="contained"
              color="primary"
              disableElevation
              aria-busy={submitting}
              startIcon={submitting ? <CircularProgress size={16} thickness={3.6} sx={{ color: 'inherit' }} /> : null}
              sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX, px: 3 }}
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </Button>
          </Box>
        )}
      </Box>

      {/* ---------------- the list ---------------- */}
      {view.hasReviews || listStatus === 'ready' ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
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
      ) : listStatus === 'loading' ? (
        <Box role="status" aria-live="polite" sx={{ py: 2 }}>
          <Typography variant="body2" sx={{ color: 'var(--lf-ink-3)' }}>
            Loading reviews…
          </Typography>
        </Box>
      ) : listStatus === 'empty' ? (
        <EmptyState
          icon={<RateReviewOutlinedIcon />}
          title="No reviews yet"
          message={
            productName
              ? `Nobody has reviewed ${productName} yet. If you have tried it, yours would be the first.`
              : 'Nobody has reviewed this product yet.'
          }
          headingComponent="h3"
        />
      ) : (
        <Box>
          {items.map((review) => (
            <Box
              key={review.id}
              component="article"
              sx={{ borderTop: '1px solid var(--lf-hairline)', py: 2.5 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Rating value={Number(review.rating) || 0} readOnly size="small" />
                <Typography variant="subtitle2">{review.author?.display_name || 'Le foyeR. customer'}</Typography>
                {/* §2e: the chip exists ONLY for a server-computed verified purchase. */}
                {review.is_verified_purchase ? (
                  <Chip label="Verified buyer" size="small" variant="statusOk" />
                ) : null}
                <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                  {formatDate(review.created_at)}
                </Typography>
              </Box>
              {review.title ? (
                <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
                  {review.title}
                </Typography>
              ) : null}
              <Typography variant="body2" sx={{ color: 'var(--lf-ink-2)' }}>
                {review.comment}
              </Typography>
            </Box>
          ))}

          {(page > 1 || hasNext) ? (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                justifyContent: 'center',
                borderTop: '1px solid var(--lf-hairline)',
                pt: 2,
              }}
            >
              <Button
                className="lf-press"
                variant="text"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                Newer
              </Button>
              <Button
                className="lf-press"
                variant="text"
                disabled={!hasNext}
                onClick={() => setPage((current) => current + 1)}
                sx={{ ...TOUCH_TARGET_SX, ...FOCUS_RING_SX }}
              >
                Older
              </Button>
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
};

export default ProductReviews;
