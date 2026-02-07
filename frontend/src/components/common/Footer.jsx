import React, { useState } from 'react';
import { Box, Container, Grid, Typography, Link, TextField, Button, Stack, IconButton, Alert } from '@mui/material';
import InstagramIcon from '@mui/icons-material/Instagram';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: '#FDFBF9',
        pt: 0,
        pb: 4,
        borderTop: '1px solid rgba(201, 169, 110, 0.1)'
      }}
    >
      {/* Security Disclaimer Banner */}
      <Box sx={{ bgcolor: '#FFE6E6', py: 2.5 }}>
        <Container maxWidth="lg">
          <Alert
            icon={<WarningAmberIcon />}
            severity="error"
            sx={{
              bgcolor: 'transparent',
              border: 'none',
              '& .MuiAlert-icon': {
                color: '#D32F2F'
              },
              '& .MuiAlert-message': {
                width: '100%'
              }
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                color: '#D32F2F',
                textAlign: 'center',
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              Please be careful of fraudulent calls & SMSes! Le foyeR. Global will never call you with offers, free gifts, or ask you for payments through links.
            </Typography>
          </Alert>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pt: 10 }}>
        <Grid container spacing={8}>

          {/* Column 1: Brand */}
          <Grid item xs={12} md={5}>
            <Typography
              variant="h4"
              sx={{
                fontFamily: "'Cormorant Garamond', serif",
                mb: 3,
                letterSpacing: '0.05em'
              }}
            >
              LE FOYER
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
              Curating the finest natural beauty products for your daily ritual.
              We believe in the power of nature to rejuvenate and restore.
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                component="a"
                href="https://instagram.com/lefoyerglobal"
                target="_blank"
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <InstagramIcon />
              </IconButton>
              <Link
                href="https://instagram.com/lefoyerglobal"
                target="_blank"
                color="text.secondary"
                underline="hover"
                variant="body2"
                sx={{ '&:hover': { color: 'primary.main' } }}
              >
                @lefoyerglobal
              </Link>
            </Stack>
          </Grid>

          {/* Column 2: Support */}
          <Grid item xs={12} md={2}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '0.875rem' }}>
              SUPPORT
            </Typography>
            <Stack spacing={2}>
              {['Shipping & Returns', 'Privacy Policy', 'Terms of Service'].map((item) => (
                <Link
                  key={item}
                  href={item === 'Privacy Policy' ? '#/privacy-policy' : item === 'Terms of Service' ? '#/terms' : item === 'Shipping & Returns' ? '#/shipping-returns' : item === 'FAQ' ? '#/faq' : '#'}
                  color="text.secondary"
                  underline="none"
                  sx={{
                    fontSize: '0.875rem',
                    transition: 'color 0.2s',
                    '&:hover': { color: 'primary.main' }
                  }}
                >
                  {item}
                </Link>
              ))}
            </Stack>
          </Grid>

          {/* Column 3: Newsletter */}
          <Grid item xs={12} md={5}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '0.875rem' }}>
              NEWSLETTER
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Subscribe to receive updates, access to exclusive deals, and more.
            </Typography>
            {subscribed ? (
              <Box sx={{ p: 2, bgcolor: 'rgba(201, 169, 110, 0.1)', borderRadius: 1 }}>
                <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600, mb: 1 }}>
                  Thank you for subscribing!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You'll receive our latest updates and exclusive offers soon.
                </Typography>
              </Box>
            ) : (
              <Box component="form" noValidate autoComplete="off" onSubmit={handleSubscribe}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    placeholder="Your email address"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 0,
                        bgcolor: 'white',
                        '& fieldset': { borderColor: '#E8E8E8' },
                        '&:hover fieldset': { borderColor: '#C9A96E' },
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disableElevation
                    sx={{
                      minWidth: '100px',
                      bgcolor: 'primary.main',
                      '&:hover': { bgcolor: 'primary.dark' }
                    }}
                  >
                    JOIN
                  </Button>
                </Stack>
              </Box>
            )}
          </Grid>
        </Grid>

        {/* Made in India Section */}
        <Box sx={{ mt: 8, mb: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="/images/products/State_Emblem_of_India.png"
              alt="State Emblem of India"
              sx={{
                width: 150,
                height: 'auto',
                opacity: 0.7,
                mb: 1
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontFamily: "'Cormorant Garamond', serif",
                color: 'text.secondary',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600
              }}
            >
              Exclusively made in India
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #E8E8E8', textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} Le foyeR. Global. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
