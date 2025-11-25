import React, { useEffect, useRef, useState } from 'react';
import { Box, Container, Typography, Card, CardContent, CardActionArea, IconButton } from '@mui/material';
import { Link } from 'react-router-dom';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import FaceRetouchingNaturalOutlinedIcon from '@mui/icons-material/FaceRetouchingNaturalOutlined';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const concerns = [
  {
    icon: <AutoAwesomeOutlinedIcon />,
    title: 'Brightening',
    description: 'Even tone & luminosity',
    link: '/products?concern=brightening',
    color: '#F5D5C8',
  },
  {
    icon: <WaterDropOutlinedIcon />,
    title: 'Hydration',
    description: 'Deep moisture & plumpness',
    link: '/products?concern=hydration',
    color: '#B8C5B4',
  },
  {
    icon: <FaceRetouchingNaturalOutlinedIcon />,
    title: 'Anti-Aging',
    description: 'Firm & rejuvenate',
    link: '/products?concern=anti-aging',
    color: '#E8DCE8',
  },
  {
    icon: <SpaOutlinedIcon />,
    title: 'Sensitive Skin',
    description: 'Calm & soothe',
    link: '/products?concern=sensitive',
    color: '#F5E6E8',
  },
  {
    icon: <WbSunnyOutlinedIcon />,
    title: 'Sun Protection',
    description: 'Shield & defend',
    link: '/products?concern=sun-protection',
    color: '#E8DCD3',
  },
  {
    icon: <NightsStayOutlinedIcon />,
    title: 'Night Repair',
    description: 'Restore & renew',
    link: '/products?concern=night-repair',
    color: '#C9A96E',
  },
];

const ShopByConcern = () => {
  const scrollRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let scrollAmount = 0;
    const speed = 1; // Pixels per frame
    let animationId;

    const scroll = () => {
      if (!isPaused) {
        scrollAmount += speed;
        if (scrollAmount >= scrollContainer.scrollWidth / 2) {
          scrollAmount = 0;
          scrollContainer.scrollLeft = 0;
        } else {
          scrollContainer.scrollLeft = scrollAmount;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    // Clone children for infinite loop effect
    // Note: For a true infinite loop with smooth scrolling, we need to duplicate the content
    // However, for simplicity and robustness, we'll use a simpler auto-scroll interval or CSS animation
    // Let's stick to a simpler auto-scroll interval for now which is easier to control

    // Reset implementation for interval based scrolling which is more stable
    return () => cancelAnimationFrame(animationId);
  }, [isPaused]);

  // Better approach: CSS Animation for smooth continuous scrolling
  // We will duplicate the array to create a seamless loop
  const duplicatedConcerns = [...concerns, ...concerns];

  return (
    <Box sx={{ py: { xs: 8, md: 10 }, backgroundColor: '#FAFAFA', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
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
            Personalized Solutions
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
            Shop by Concern
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              maxWidth: 650,
              mx: 'auto',
              mt: 2,
            }}
          >
            Targeted treatments for your unique skincare needs
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
              background: 'linear-gradient(to right, #FAFAFA, transparent)',
            },
            '&::after': {
              right: 0,
              background: 'linear-gradient(to left, #FAFAFA, transparent)',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              width: 'max-content',
              animation: 'scroll 40s linear infinite',
              '&:hover': {
                animationPlayState: 'paused',
              },
              '@keyframes scroll': {
                '0%': { transform: 'translateX(0)' },
                '100%': { transform: 'translateX(-50%)' },
              },
              py: 2, // Padding for hover effects
            }}
          >
            {duplicatedConcerns.map((concern, index) => (
              <Card
                key={`${concern.title}-${index}`}
                sx={{
                  width: 220,
                  flexShrink: 0,
                  backgroundColor: 'white',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 24px rgba(201, 169, 110, 0.2)',
                    '& .concern-icon': {
                      transform: 'scale(1.1)',
                      backgroundColor: concern.color,
                    },
                  },
                }}
              >
                <CardActionArea
                  component={Link}
                  to={concern.link}
                  sx={{
                    height: '100%',
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <Box
                    className="concern-icon"
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                      backgroundColor: concern.color,
                      color: 'text.primary',
                      transition: 'all 0.3s ease',
                      '& svg': { fontSize: 28 },
                    }}
                  >
                    {concern.icon}
                  </Box>

                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 500,
                      mb: 0.5,
                      fontSize: '1rem',
                      color: 'text.primary',
                    }}
                  >
                    {concern.title}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {concern.description}
                  </Typography>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default ShopByConcern;