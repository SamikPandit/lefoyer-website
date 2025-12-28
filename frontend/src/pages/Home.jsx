import React from 'react';
import Hero from '../components/home/Hero';
import Marquee from '../components/home/Marquee';
import CircularProductSlider from '../components/home/CircularProductSlider';
import FeaturedProducts from '../components/home/FeaturedProducts';
import ProductCategories from '../components/home/ProductCategories';
import ShopByConcern from '../components/home/ShopByConcern';
import Benefits from '../components/home/Benefits';
import CustomerTestimonials from '../components/home/CustomerTestimonials';
import NewsletterSignup from '../components/home/NewsletterSignup';

import NewYearBanner from '../components/home/NewYearBanner';

const Home = () => {
  // Force rebuild
  return (
    <>
      <Marquee />
      <Hero />
      <CircularProductSlider />
      {/* Keeping some sections but maybe we can reduce them if the user wants a VERY minimal look. 
          For now, let's keep the content rich sections below the fold. */}
      <Benefits />
      <FeaturedProducts />
      <NewYearBanner />
      <CustomerTestimonials />
      <NewsletterSignup />
    </>
  );
};

export default Home;