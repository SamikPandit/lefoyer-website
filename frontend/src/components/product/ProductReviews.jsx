import React, { useEffect, useState } from 'react';
import { Box, Typography, Rating, TextField, Button, CircularProgress, Alert, Paper, Avatar, LinearProgress } from '@mui/material';
import { getProductReviews, createProductReview } from '../../services/mockApi';
import { useAuth } from '../../context/AuthContext';

const ProductReviews = ({ productSlug }) => {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newReview, setNewReview] = useState({ rating: 0, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await getProductReviews(productSlug);
      setReviews(response.data.results);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      setError('Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productSlug) {
      fetchReviews();
    }
  }, [productSlug]);

  const handleReviewChange = (event) => {
    setNewReview({ ...newReview, [event.target.name]: event.target.value });
  };

  const handleRatingChange = (event, newValue) => {
    setNewReview({ ...newReview, rating: newValue });
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!token) {
      setSubmitError('Please log in to submit a review.');
      return;
    }
    if (newReview.rating === 0 || newReview.comment.trim() === '') {
      setSubmitError('Please provide a rating and a comment.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await createProductReview(productSlug, newReview);
      setSubmitSuccess('Review submitted successfully!');
      setNewReview({ rating: 0, comment: '' });
      fetchReviews();
    } catch (err) {
      console.error('Failed to submit review:', err);
      setSubmitError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => Math.floor(r.rating) === star).length;
    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
    return { star, count, percentage };
  });

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Customer Reviews
      </Typography>

      {/* Rating Summary */}
      <Box sx={{ display: 'flex', gap: 4, mb: 4, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 500 }}>{averageRating}</Typography>
          <Rating value={parseFloat(averageRating)} precision={0.1} readOnly />
          <Typography variant="body2" color="text.secondary">
            {reviews.length} reviews
          </Typography>
        </Box>
        
        <Box sx={{ flex: 1, minWidth: 300 }}>
          {ratingDistribution.map(({ star, count, percentage }) => (
            <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" sx={{ minWidth: 50 }}>{star} star</Typography>
              <LinearProgress 
                variant="determinate" 
                value={percentage} 
                sx={{ flex: 1, height: 8, borderRadius: 1, backgroundColor: '#E0E0E0' }}
              />
              <Typography variant="body2" sx={{ minWidth: 40, color: 'text.secondary' }}>
                {percentage.toFixed(0)}%
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Write Review */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #E0E0E0' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Write a Review</Typography>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        {submitSuccess && <Alert severity="success" sx={{ mb: 2 }}>{submitSuccess}</Alert>}
        <Box component="form" onSubmit={handleSubmitReview} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5 }}>Your Rating</Typography>
            <Rating name="rating" value={newReview.rating} onChange={handleRatingChange} size="large" />
          </Box>
          <TextField
            name="comment"
            label="Your Review"
            multiline
            rows={4}
            fullWidth
            value={newReview.comment}
            onChange={handleReviewChange}
            variant="outlined"
            required
          />
          <Button 
            type="submit" 
            variant="contained" 
            disabled={submitting || !token}
            sx={{ alignSelf: 'flex-start', px: 4, textTransform: 'none' }}
          >
            {submitting ? <CircularProgress size={24} /> : 'Submit Review'}
          </Button>
          {!token && (
            <Typography variant="caption" color="text.secondary">
              Please log in to submit a review.
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Reviews List */}
      {loading ? (
        <CircularProgress />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : reviews.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No reviews yet. Be the first to review this product!
        </Typography>
      ) : (
        <Box>
          {reviews.map((review) => (
            <Paper key={review.id} elevation={0} sx={{ p: 2.5, mb: 2, border: '1px solid #E0E0E0' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                  {review.user.username.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {review.user.username}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Rating value={review.rating} precision={1} readOnly size="small" />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(review.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    {review.comment}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ProductReviews;