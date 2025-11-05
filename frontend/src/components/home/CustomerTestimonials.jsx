import React from 'react';
import Slider from 'react-slick';
import { Box, Typography, Paper, Avatar } from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";

const testimonials = [
  {
    id: 1,
    name: 'Jane Doe',
    title: 'Skincare Enthusiast',
    quote: 'Le Foyer products have transformed my skin! I love the natural ingredients and how gentle they are. Highly recommend!',
    avatar: 'https://source.unsplash.com/random/100x100?person1',
  },
  {
    id: 2,
    name: 'John Smith',
    title: 'Happy Customer',
    quote: 'Finally, a brand that delivers on its promises. My hair feels amazing after using their haircare range.',
    avatar: 'https://source.unsplash.com/random/100x100?person2',
  },
  {
    id: 3,
    name: 'Emily White',
    title: 'Beauty Blogger',
    quote: 'The body care products are luxurious and leave my skin feeling incredibly soft and hydrated. A must-try!',
    avatar: 'https://source.unsplash.com/random/100x100?person3',
  },
];

const CustomerTestimonials = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    arrows: false,
  };

  return (
    <Box sx={{ my: 8, py: 4, backgroundColor: 'background.default' }}>
      <Typography variant="h4" component="h2" align="center" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, mb: 6 }}>
        What Our Customers Say
      </Typography>
      <Slider {...settings}>
        {testimonials.map((testimonial) => (
          <Box key={testimonial.id} sx={{ px: { xs: 2, md: 8 } }}>
            <Paper 
              elevation={3} 
              sx={{
                p: 4, 
                borderRadius: 4, 
                textAlign: 'center',
                maxWidth: 700,
                mx: 'auto',
                position: 'relative',
              }}
            >
              <FormatQuoteIcon sx={{ fontSize: 60, color: 'primary.main', position: 'absolute', top: 10, left: 10, opacity: 0.2 }} />
              <Avatar 
                src={testimonial.avatar} 
                alt={testimonial.name} 
                sx={{ width: 80, height: 80, mx: 'auto', mb: 2, border: '3px solid', borderColor: 'primary.main' }}
              />
              <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 2, color: 'text.secondary' }}>
                "{testimonial.quote}"
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {testimonial.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {testimonial.title}
              </Typography>
            </Paper>
          </Box>
        ))}
      </Slider>
    </Box>
  );
};

export default CustomerTestimonials;
