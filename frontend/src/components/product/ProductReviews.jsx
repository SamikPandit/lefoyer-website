import React, { useEffect, useState } from 'react';
import { Box, Typography, Rating, Divider, TextField, Button, CircularProgress, Alert, Paper } from '@mui/material';
import { getProductReviews, createProductReview } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ProductReviews = ({ productSlug }) => {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newReview, setNewReview] = useState({
    rating: 0,
    comment: '',
  });
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
    setNewReview({
      ...newReview,
      [event.target.name]: event.target.value,
    });
  };

  const handleRatingChange = (event, newValue) => {
    setNewReview({
      ...newReview,
      rating: newValue,
    });
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
      fetchReviews(); // Refresh reviews
    } catch (err) {
      console.error('Failed to submit review:', err);
      setSubmitError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ my: 6, borderTop: '1px solid #eee', pt: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, mb: 3 }}>
        Customer Reviews ({reviews.length})
      </Typography>

      {/* Review Submission Form */}
      <Paper elevation={1} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>Write a Review</Typography>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        {submitSuccess && <Alert severity="success" sx={{ mb: 2 }}>{submitSuccess}</Alert>}
        <Box component="form" onSubmit={handleSubmitReview} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Rating 
            name="rating" 
            value={newReview.rating} 
            onChange={handleRatingChange} 
            precision={1} 
            size="large"
          />
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
            color="primary" 
            disabled={submitting || !token}
            sx={{ alignSelf: 'flex-start', borderRadius: '25px', px: 4, py: 1.5 }}
          >
            {submitting ? <CircularProgress size={24} /> : 'Submit Review'}
          </Button>
          {!token && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Please log in to submit a review.
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Existing Reviews */}
      {loading ? (
        <CircularProgress />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : reviews.length === 0 ? (
        <Typography variant="body1" color="text.secondary">No reviews yet. Be the first to review this product!</Typography>
      ) : (
        <Box>
          {reviews.map((review) => (
            <Box key={review.id} sx={{ mb: 3, pb: 3, borderBottom: '1px solid #eee' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Rating value={review.rating} precision={1} readOnly size="small" />
                <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 'bold' }}>
                  {review.user.username} 
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  - {new Date(review.created_at).toLocaleDateString()}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.primary">
                {review.comment}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ProductReviews;
