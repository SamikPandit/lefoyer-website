import React, { useState } from 'react';
import { Box, Container, Grid, Typography, Link, IconButton, TextField, Button, CircularProgress, Alert, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Facebook, Twitter, Instagram, YouTube, CreditCard, Payment } from '@mui/icons-material';

const Footer = () => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    // Placeholder for API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      if (newsletterEmail.includes('@')) {
        setSuccess('Subscribed to newsletter!');
        setNewsletterEmail('');
      } else {
        setError('Please enter a valid email address.');
      }
    } catch (err) {
      setError('Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      component="footer" 
      sx={{ 
        backgroundColor: 'background.default', 
        borderTop: '1px solid #ddd',
        py: 6, 
        mt: 'auto' 
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={5}>
          <Grid xs={12} sm={4}>
            <Typography variant="h6" gutterBottom sx={{ fontFamily: 'Playfair Display, serif' }}>
              Le Foyer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rejuvenate Your Natural Beauty. Gentle, effective formulations with natural-inspired ingredients.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <IconButton href="https://instagram.com" target="_blank" color="inherit">
                <Instagram />
              </IconButton>
              <IconButton href="https://facebook.com" target="_blank" color="inherit">
                <Facebook />
              </IconButton>
              <IconButton href="https://twitter.com" target="_blank" color="inherit">
                <Twitter />
              </IconButton>
              <IconButton href="https://youtube.com" target="_blank" color="inherit">
                <YouTube />
              </IconButton>
            </Box>
          </Grid>
          <Grid xs={6} sm={2}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Quick Links
            </Typography>
            <Link component={RouterLink} to="/products" color="text.secondary" display="block" underline="hover">Products</Link>
            <Link component={RouterLink} to="/about" color="text.secondary" display="block" underline="hover">About</Link>
            <Link component={RouterLink} to="/blog" color="text.secondary" display="block" underline="hover">Blog</Link>
            <Link component={RouterLink} to="/faqs" color="text.secondary" display="block" underline="hover">FAQs</Link>
          </Grid>
          <Grid xs={6} sm={3}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Customer Service
            </Typography>
            <Link component={RouterLink} to="/shipping-returns" color="text.secondary" display="block" underline="hover">Shipping & Returns</Link>
            <Link component={RouterLink} to="/track-order" color="text.secondary" display="block" underline="hover">Track Order</Link>
            <Link component={RouterLink} to="/contact" color="text.secondary" display="block" underline="hover">Contact Us</Link>
            <Link component={RouterLink} to="/privacy-policy" color="text.secondary" display="block" underline="hover">Privacy Policy</Link>
            <Link component={RouterLink} to="/terms-conditions" color="text.secondary" display="block" underline="hover">Terms & Conditions</Link>
          </Grid>
          <Grid xs={12} sm={3}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Contact Information
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Email: contact@lefoyerglobal.com
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Phone: +91-XXXXXXXXXX
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Address: Surat, Gujarat, India
            </Typography>
            
            {/* Newsletter Signup */}
            <Box component="form" onSubmit={handleNewsletterSubmit} sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Newsletter
              </Typography>
              <TextField
                fullWidth
                label="Your Email"
                variant="outlined"
                size="small"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                sx={{ mb: 1, '& fieldset': { borderColor: 'text.secondary' } }}
                InputLabelProps={{ style: { color: 'text.secondary' } }}
              />
              <Button 
                fullWidth 
                variant="contained" 
                color="primary" 
                type="submit"
                disabled={loading}
                sx={{ borderRadius: '25px', py: 1 }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Subscribe'}
              </Button>
              {success && <Alert severity="success" sx={{ mt: 1 }}>{success}</Alert>}
              {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            </Box>
          </Grid>
        </Grid>
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            © {new Date().getFullYear()} Le Foyer Global. All Rights Reserved.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <IconButton><CreditCard sx={{ color: 'text.secondary' }} /></IconButton>
            <IconButton><Payment sx={{ color: 'text.secondary' }} /></IconButton>
            {/* Add more payment icons as needed */}
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/UPI-Logo-vector.svg/1200px-UPI-Logo-vector.svg.png" alt="UPI" style={{ height: 24, marginLeft: 8, verticalAlign: 'middle' }} />
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
