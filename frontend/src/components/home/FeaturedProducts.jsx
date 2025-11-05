import React, { useEffect, useState } from 'react';
import Slider from 'react-slick';
import { Box, Typography } from '@mui/material';
import ProductCard from '../product/ProductCard';
import { getFeaturedProducts } from '../../services/api';
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";

const FeaturedProducts = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await getFeaturedProducts();
        setProducts(response.data);
      } catch (error) {
        console.error('Failed to fetch featured products:', error);
      }
    };
    fetchProducts();
  }, []);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    autoplay: true,
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          slidesToShow: 3,
        }
      },
      {
        breakpoint: 960,
        settings: {
          slidesToShow: 2,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
        }
      }
    ]
  };

  return (
    <Box sx={{ my: 6 }}>
      <Slider {...settings}>
        {products.map((product) => (
          <Box key={product.id} sx={{ p: 2 }}>
            <ProductCard product={product} />
          </Box>
        ))}
      </Slider>
    </Box>
  );
};

export default FeaturedProducts;
