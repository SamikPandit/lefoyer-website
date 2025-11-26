import React from 'react';
import { Box, Container, Grid, Typography, Link, TextField, Button, Stack, IconButton } from '@mui/material';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import PinterestIcon from '@mui/icons-material/Pinterest';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: '#FDFBF9',
        pt: 10,
        pb: 4,
        borderTop: '1px solid rgba(201, 169, 110, 0.1)'
      }}
    >
      <Container maxWidth="lg">
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
            <Stack direction="row" spacing={1}>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <InstagramIcon />
              </IconButton>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <FacebookIcon />
              </IconButton>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <PinterestIcon />
              </IconButton>
            </Stack>
          </Grid>

          {/* Column 2: Support */}
          <Grid item xs={12} md={2}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '0.875rem' }}>
              SUPPORT
            </Typography>
            <Stack spacing={2}>
              {['Contact Us', 'Shipping & Returns', 'FAQ', 'Privacy Policy', 'Terms of Service'].map((item) => (
                <Link
                  key={item}
                  href={item === 'Privacy Policy' ? '#/privacy-policy' : item === 'Terms of Service' ? '#/terms' : item === 'Shipping & Returns' ? '#/shipping-returns' : '#'}
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
            <Box component="form" noValidate autoComplete="off">
              <Stack direction="row" spacing={1}>
                <TextField
                  placeholder="Your email address"
                  variant="outlined"
                  size="small"
                  fullWidth
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
          </Grid>
        </Grid>

        <Box sx={{ mt: 10, pt: 3, borderTop: '1px solid #E8E8E8', textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} Le foyeR. Global. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
