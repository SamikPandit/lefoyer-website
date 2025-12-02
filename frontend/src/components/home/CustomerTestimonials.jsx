import React from 'react';
import Slider from 'react-slick';
import { Box, Typography, Container, Avatar, Rating } from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import PersonIcon from '@mui/icons-material/Person';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const testimonials = [
  {
    id: 1,
    name: 'Priya Sharma',
    title: 'Beauty Enthusiast',
    rating: 5,
    quote: 'The body care products are luxurious and leave my skin feeling incredibly soft and hydrated. The scents are subtle and beautiful. My skin has never felt so pampered!',
  },
  {
    id: 2,
    name: 'Anjali Patel',
    title: 'Verified Buyer',
    rating: 5,
    quote: 'Le foyeR. products have transformed my skin! I love the natural ingredients and how gentle they are. My skin has never felt so soft and looked so radiant.',
  },
  {
    id: 3,
    name: 'Rahul Verma',
    title: 'Happy Customer',
    rating: 5,
    quote: 'Finally, a brand that delivers on its promises. My hair feels amazing after using their haircare range. It\'s stronger, shinier, and much more manageable.',
  },
];

const CustomerTestimonials = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 6000,
    arrows: false,
    fade: true,
    dotsClass: 'slick-dots custom-dots',
  };

  return (
    <Box sx={{ py: { xs: 10, md: 14 }, backgroundColor: 'background.default' }}>
      <Container maxWidth="md">
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="caption"
            component="p"
            sx={{
              color: 'primary.main',
              mb: 2,
              fontWeight: 600,
            }}
          >
            Testimonials
          </Typography>

          <Typography
            variant="h2"
            component="h2"
            gutterBottom
            sx={{
              color: 'text.primary',
              mb: 2,
              position: 'relative',
              display: 'inline-block',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '60px',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #C9A96E, transparent)',
              },
            }}
          >
            What Our Customers Say
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 500, mx: 'auto', mt: 3 }}
          >
            Real experiences from our beloved community
          </Typography>
        </Box>

        {/* Testimonials Carousel */}
        <Box
          sx={{
            '& .custom-dots': {
              bottom: '-40px',
              '& li': {
                '& button:before': {
                  fontSize: '10px',
                  color: '#C9A96E',
                  opacity: 0.3,
                },
                '&.slick-active button:before': {
                  color: '#C9A96E',
                  opacity: 1,
                },
              },
            },
          }}
        >
          <Slider {...settings}>
            {testimonials.map((testimonial) => (
              <Box key={testimonial.id}>
                <Box
                  sx={{
                    p: { xs: 4, md: 6 },
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  {/* Quote Icon */}
                  <FormatQuoteIcon
                    sx={{
                      fontSize: 72,
                      color: 'secondary.main',
                      opacity: 0.3,
                      mb: 3,
                    }}
                  />

                  {/* Rating */}
                  <Rating
                    value={testimonial.rating}
                    readOnly
                    sx={{
                      mb: 3,
                      '& .MuiRating-iconFilled': {
                        color: '#C9A96E',
                      },
                    }}
                    size="large"
                  />

                  {/* Quote Text */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: 'Cormorant Garamond, serif',
                      fontStyle: 'italic',
                      mb: 4,
                      color: 'text.primary',
                      lineHeight: 1.8,
                      fontWeight: 400,
                      fontSize: { xs: '1.25rem', md: '1.5rem' },
                    }}
                  >
                    "{testimonial.quote}"
                  </Typography>

                  {/* Avatar & Name */}
                  <Avatar
                    sx={{
                      width: 72,
                      height: 72,
                      mx: 'auto',
                      mb: 2,
                      border: '3px solid',
                      borderColor: 'secondary.light',
                      bgcolor: 'grey.200',
                      color: 'text.secondary'
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 40 }} />
                  </Avatar>

                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary',
                      mb: 0.5,
                    }}
                  >
                    {testimonial.name}
                  </Typography>

                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {testimonial.title}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Slider>
        </Box>
      </Container>
    </Box>
  );
};

export default CustomerTestimonials;