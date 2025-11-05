import React, { useEffect, useState } from 'react';
import Slider from 'react-slick';
import { Box, Typography } from '@mui/material';
import ProductCard from '../product/ProductCard';
import { getRelatedProducts } from '../../services/api';
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";

const RelatedProducts = ({ productId }) => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!productId) return;

    const fetchRelatedProducts = async () => {
      try {
        const response = await getRelatedProducts(productId);
        setProducts(response.data);
      } catch (error) {
        console.error('Failed to fetch related products:', error);
      }
    };
    fetchRelatedProducts();
  }, [productId]);

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

  if (products.length === 0) return null;

  return (
    <Box sx={{ my: 6 }}>
      <Typography variant="h5" component="h2" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, mb: 4 }}>
        Related Products
      </Typography>
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

export default RelatedProducts;
