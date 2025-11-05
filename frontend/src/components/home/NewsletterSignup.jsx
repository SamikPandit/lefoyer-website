import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, CircularProgress, Alert } from '@mui/material';

const NewsletterSignup = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    // Placeholder for API call
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      if (email.includes('@')) {
        setSuccess('Thank you for subscribing!');
        setEmail('');
      } else {
        setError('Please enter a valid email address.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ my: 8, py: 6, backgroundColor: 'primary.light', color: 'white', textAlign: 'center' }}>
      <Typography variant="h4" component="h2" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
        Join Our Newsletter
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        Stay up-to-date with our latest products and exclusive offers.
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Paper 
          sx={{
            p: 1,
            display: 'flex',
            alignItems: 'center',
            width: { xs: '100%', sm: 400 },
            borderRadius: '25px',
          }}
        >
          <TextField
            sx={{ ml: 1, flex: 1, '& fieldset': { border: 'none' } }}
            placeholder="Enter your email"
            inputProps={{ 'aria-label': 'enter your email' }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <Button 
            variant="contained" 
            color="primary" 
            type="submit"
            disabled={loading}
            sx={{ borderRadius: '25px', px: 3, py: 1.2 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Subscribe'}
          </Button>
        </Paper>
      </Box>
      {success && <Alert severity="success" sx={{ mt: 2, maxWidth: 400, mx: 'auto' }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2, maxWidth: 400, mx: 'auto' }}>{error}</Alert>}
    </Box>
  );
};

export default NewsletterSignup;
