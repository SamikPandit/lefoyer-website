import React from 'react';
import { Box, Typography, Button, Container, Stack, Fade } from '@mui/material';
import { Link } from 'react-router-dom';
import { keyframes } from '@mui/system';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
`;

const Hero = () => {
  return (
    <Box
      sx={{
        position: 'relative',
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#FAF6F2',
      }}
    >
      {/* Background Image Layer */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?q=80&w=2070&auto=format&fit=crop)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.95)', // Slightly brighter to keep the fresh look
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // Simpler, more subtle gradient to let the image shine through
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.1) 100%)',
          },
        }}
      />

      {/* Content */}
      <Container
        maxWidth="lg"
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Fade in={true} timeout={1000}>
          <Box
            sx={{
              // Glassmorphic Card Styles
              background: 'rgba(255, 255, 255, 0.15)', // Very transparent white
              backdropFilter: 'blur(12px)', // Strong blur for readability
              borderRadius: '24px',
              padding: { xs: 4, md: 8 },
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
              maxWidth: '900px',
              textAlign: 'center',
            }}
          >
            {/* Overline */}
            <Typography
              variant="caption"
              component="p"
              sx={{
                color: 'text.primary',
                mb: 2,
                fontWeight: 700,
                letterSpacing: '0.25em',
                animation: `${fadeInUp} 1s ease-out 0.2s both`,
                textShadow: '0 0 20px rgba(255,255,255,0.8)', // Glow effect
              }}
            >
              NATURAL • GENTLE • RADIANT
            </Typography>

            {/* Main Headline */}
            <Typography
              variant="h1"
              component="h1"
              sx={{
                color: 'text.primary',
                mb: 3,
                animation: `${fadeInUp} 1s ease-out 0.4s both`,
                // Refined text shadow for better contrast without being muddy
                textShadow: '0 2px 4px rgba(255,255,255,0.5)',
                fontSize: { xs: '2.5rem', md: '4.5rem' }, // Responsive font size
              }}
            >
              Rejuvenate Your Natural Beauty
            </Typography>

            {/* Subtitle */}
            <Typography
              variant="subtitle1"
              component="p"
              sx={{
                color: 'text.primary', // Use primary for better contrast in glass card
                maxWidth: '600px',
                mx: 'auto',
                mb: 5,
                animation: `${fadeInUp} 1s ease-out 0.6s both`,
                lineHeight: 1.8,
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 500,
                opacity: 0.9,
              }}
            >
              Gentle, effective formulations with natural-inspired ingredients.
              Experience the art of mindful beauty.
            </Typography>

            {/* CTA Buttons */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              justifyContent="center"
              alignItems="center"
              sx={{
                animation: `${fadeInUp} 1s ease-out 0.8s both`,
              }}
            >
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/products"
                sx={{
                  px: 5,
                  py: 1.8,
                  minWidth: '180px',
                  fontSize: '0.9rem',
                  backgroundColor: 'primary.main',
                  color: 'white',
                  boxShadow: '0 4px 14px 0 rgba(201, 169, 110, 0.39)',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px 0 rgba(201, 169, 110, 0.23)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Explore Collection
              </Button>

              <Button
                variant="outlined"
                size="large"
                component={Link}
                to="/about"
                sx={{
                  px: 5,
                  py: 1.8,
                  minWidth: '180px',
                  fontSize: '0.9rem',
                  borderColor: 'text.primary',
                  color: 'text.primary',
                  borderWidth: '1.5px',
                  '&:hover': {
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    borderWidth: '1.5px',
                  },
                }}
              >
                Our Story
              </Button>
            </Stack>
          </Box>
        </Fade>
      </Container>

      {/* Scroll Indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          animation: `${fadeInUp} 1s ease-out 1.2s both, ${bounce} 2s infinite 2s`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: 'white', // Changed to white for better visibility at bottom
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          cursor: 'pointer',
        }}
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
      >
        <Typography variant="caption" sx={{ mb: 1, letterSpacing: '0.1em', fontWeight: 600 }}>SCROLL</Typography>
        <KeyboardArrowDownIcon />
      </Box>
    </Box>
  );
};

export default Hero;