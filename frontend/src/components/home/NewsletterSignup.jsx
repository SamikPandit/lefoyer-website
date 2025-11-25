import React, { useState } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Alert, Container } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

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

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (email.includes('@')) {
        setSuccess('Thank you for subscribing! Welcome to Le foyeR..');
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
    <Box 
      sx={{ 
        py: { xs: 10, md: 14 },
        background: 'linear-gradient(135deg, #FAF6F2 0%, #FFF8F9 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '40%',
          height: '140%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201, 169, 110, 0.08) 0%, transparent 70%)',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-20%',
          right: '-10%',
          width: '50%',
          height: '140%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245, 230, 232, 0.15) 0%, transparent 70%)',
        },
      }}
    >
      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center' }}>
          {/* Icon */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <MailOutlineIcon sx={{ fontSize: 36, color: 'primary.main' }} />
          </Box>

          {/* Header */}
          <Typography
            variant="caption"
            component="p"
            sx={{
              color: 'primary.main',
              mb: 2,
              fontWeight: 600,
            }}
          >
            Stay Connected
          </Typography>
          
          <Typography 
            variant="h2" 
            component="h2" 
            gutterBottom
            sx={{ 
              color: 'text.primary',
              mb: 2,
            }}
          >
            Join Our Newsletter
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              mb: 5,
              color: 'text.secondary',
              maxWidth: 550,
              mx: 'auto',
              lineHeight: 1.8,
            }}
          >
            Be the first to discover new arrivals, exclusive offers, and beauty tips 
            delivered to your inbox
          </Typography>

          {/* Newsletter Form */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              maxWidth: 550,
              mx: 'auto',
              mb: 3,
            }}
          >
            <TextField
              fullWidth
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              variant="outlined"
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                },
              }}
            />
            <Button 
              variant="contained" 
              type="submit"
              disabled={loading}
              sx={{
                minWidth: { xs: '100%', sm: '160px' },
                py: 1.75,
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Subscribe'}
            </Button>
          </Box>

          {/* Status Messages */}
          {success && (
            <Alert 
              severity="success" 
              sx={{ 
                maxWidth: 550, 
                mx: 'auto',
                borderRadius: 0,
                border: '1px solid',
                borderColor: 'success.main',
              }}
            >
              {success}
            </Alert>
          )}
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                maxWidth: 550, 
                mx: 'auto',
                borderRadius: 0,
                border: '1px solid',
                borderColor: 'error.main',
              }}
            >
              {error}
            </Alert>
          )}

          {/* Privacy Note */}
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              mt: 3,
              display: 'block',
            }}
          >
            We respect your privacy. Unsubscribe at any time.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default NewsletterSignup;