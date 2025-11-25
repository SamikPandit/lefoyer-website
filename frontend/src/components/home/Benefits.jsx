import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Container, Paper } from '@mui/material';
import { SpaOutlined, ScienceOutlined, AllInclusiveOutlined, FavoriteBorderOutlined } from '@mui/icons-material';

const benefits = [
  {
    icon: <SpaOutlined />,
    title: 'Natural Ingredients',
    description: 'Formulated with the finest botanicals and natural-inspired ingredients for gentle, effective care.',
  },
  {
    icon: <ScienceOutlined />,
    title: 'Dermatologically Tested',
    description: 'Rigorously tested for safety and efficacy by certified dermatologists.',
  },
  {
    icon: <AllInclusiveOutlined />,
    title: 'All Skin Types',
    description: 'Gentle, balanced formulations perfect for sensitive and reactive skin.',
  },
  {
    icon: <FavoriteBorderOutlined />,
    title: 'Cruelty-Free',
    description: 'Committed to ethical practices, never tested on animals.',
  },
];

const Benefits = () => {
  const scrollRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate benefits for seamless scrolling
  const duplicatedBenefits = [...benefits, ...benefits, ...benefits];

  return (
    <Box
      sx={{
        py: { xs: 12, md: 16 },
        backgroundColor: '#FDFBF9', // Warm off-white
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 8, md: 10 } }}>
          <Typography
            variant="caption"
            component="p"
            sx={{
              color: 'primary.main',
              mb: 2,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            The Le foyeR. Promise
          </Typography>

          <Typography
            variant="h2"
            component="h2"
            sx={{
              color: 'text.primary',
              mb: 3,
            }}
          >
            Why Choose Le foyeR.?
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              maxWidth: 650,
              mx: 'auto',
              fontSize: '1.1rem',
              lineHeight: 1.6,
            }}
          >
            We're committed to bringing you the highest quality in natural beauty care,
            combining tradition with innovation for radiant results.
          </Typography>
        </Box>

        {/* Carousel Container */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              width: '100px',
              height: '100%',
              zIndex: 2,
              pointerEvents: 'none',
            },
            '&::before': {
              left: 0,
              background: 'linear-gradient(to right, #FDFBF9, transparent)',
            },
            '&::after': {
              right: 0,
              background: 'linear-gradient(to left, #FDFBF9, transparent)',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 4,
              width: 'max-content',
              animation: 'scroll 60s linear infinite',
              '&:hover': {
                animationPlayState: 'paused',
              },
              '@keyframes scroll': {
                '0%': { transform: 'translateX(0)' },
                '100%': { transform: 'translateX(-33.33%)' }, // Adjust based on duplication
              },
              py: 2,
            }}
          >
            {duplicatedBenefits.map((benefit, index) => (
              <Paper
                key={`${benefit.title}-${index}`}
                elevation={0}
                sx={{
                  width: 300, // Strict width
                  height: 320, // Strict height
                  flexShrink: 0,
                  p: 4,
                  textAlign: 'center',
                  backgroundColor: 'white',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.06)',
                    borderColor: 'primary.main',
                    '& .icon-box': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    }
                  }
                }}
              >
                {/* Icon Container */}
                <Box
                  className="icon-box"
                  sx={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                    backgroundColor: 'rgba(201, 169, 110, 0.1)',
                    color: 'primary.main',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {React.cloneElement(benefit.icon, { sx: { fontSize: 32 } })}
                </Box>

                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 2,
                    fontSize: '1.1rem',
                  }}
                >
                  {benefit.title}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.7,
                  }}
                >
                  {benefit.description}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Benefits;