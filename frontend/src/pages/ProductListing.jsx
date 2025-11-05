import React, { useEffect, useState, useCallback } from 'react';
import { Container, Grid, Box, Typography, Paper, Chip, Stack, Button } from '@mui/material';
import ProductCard from '../components/product/ProductCard';
import ProductFilter from '../components/product/ProductFilter';
import ProductViewToggle from '../components/product/ProductViewToggle';
import ProductPagination from '../components/product/ProductPagination';
import { getProducts, getCategories, getSubCategories } from '../services/api';
import { useLocation } from 'react-router-dom';

const ProductListing = () => {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({});
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const location = useLocation();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const catResponse = await getCategories();
        setCategories(catResponse.data.results);
        const subCatResponse = await getSubCategories();
        setSubCategories(subCatResponse.data.results);
      } catch (error) {
        console.error('Failed to fetch initial filter data:', error);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const categorySlug = params.get('category');
    if (categorySlug && categories.length > 0) {
      const category = categories.find(cat => cat.slug === categorySlug);
      if (category) {
        setFilters(prev => ({ ...prev, category: [category.id] }));
      }
    }
  }, [location.search, categories]);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await getProducts({ ...filters, page });
      setProducts(response.data.results);
      setTotalPages(Math.ceil(response.data.count / 10)); // Assuming 10 items per page
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page on filter change
  };

  const handleRemoveFilter = (filterType, valueToRemove) => {
    if (filterType === 'min_price' || filterType === 'max_price') {
      const newFilters = { ...filters };
      delete newFilters.min_price;
      delete newFilters.max_price;
      setFilters(newFilters);
    } else if (Array.isArray(filters[filterType])) {
      const newValues = filters[filterType].filter(item => item !== valueToRemove);
      setFilters({ ...filters, [filterType]: newValues });
    } else {
      const newFilters = { ...filters };
      delete newFilters[filterType];
      setFilters(newFilters);
    }
    setPage(1); // Reset to first page on filter change
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setPage(1); // Reset to first page on clear all
  };

  const handleViewChange = (event, nextView) => {
    if (nextView !== null) {
      setView(nextView);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const getFilterLabel = (filterType, value) => {
    if (filterType === 'category') {
      const cat = categories.find(c => c.id === value);
      return cat ? `Category: ${cat.name}` : `Category ID: ${value}`;
    } else if (filterType === 'sub_category') {
      const subCat = subCategories.find(sc => sc.id === value);
      return subCat ? `Sub-Category: ${subCat.name}` : `Sub-Category ID: ${value}`;
    } else if (filterType === 'suitable_for') {
      return `Suitable For: ${value}`;
    } else if (filterType === 'min_price') {
      return `Min Price: ₹${value}`;
    } else if (filterType === 'max_price') {
      return `Max Price: ₹${value}`;
    } else if (filterType === 'ordering') {
      const sortOptions = {
        'price': 'Price: Low to High',
        '-price': 'Price: High to Low',
        '-created_at': 'Newest',
        '-rating': 'Top Rated',
      };
      return `Sort: ${sortOptions[value] || value}`;
    }
    return `${filterType}: ${value}`;
  };

  const activeFilters = Object.entries(filters).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map(item => ({ type: key, value: item }));
    } else if (key === 'min_price' || key === 'max_price') {
      return [{ type: key, value: value }];
    } else if (key === 'ordering') {
      return [{ type: key, value: value }];
    }
    return [];
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={4}>
        {/* Filter Sidebar */}
        <Grid xs={12} md={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #eee', position: 'sticky', top: 80 }}>
            <Typography variant="h6" gutterBottom sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
              Filters
            </Typography>
            <ProductFilter filters={filters} onFilterChange={handleFilterChange} />
          </Paper>
        </Grid>

        {/* Product Grid */}
        <Grid xs={12} md={9}>
          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mr: 1 }}>Active Filters:</Typography>
                {activeFilters.map((filter, index) => (
                  <Chip
                    key={index}
                    label={getFilterLabel(filter.type, filter.value)}
                    onDelete={() => handleRemoveFilter(filter.type, filter.value)}
                    sx={{ mb: 1 }}
                  />
                ))}
                <Button 
                  onClick={handleClearAllFilters} 
                  size="small" 
                  sx={{ textTransform: 'none', mb: 1 }}
                >
                  Clear All
                </Button>
              </Stack>
            </Box>
          )}

          {/* View Toggle & Sort */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {products.length} Products Found
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ProductViewToggle view={view} onChange={handleViewChange} />
            </Box>
          </Box>

          {products.length > 0 ? (
            <Grid container spacing={4}>
              {products.map((product) => (
                <Grid key={product.id} xs={12} sm={view === 'grid' ? 6 : 12} md={view === 'grid' ? 4 : 12}>
                  <ProductCard product={product} view={view} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ textAlign: 'center', width: '100%', py: 10 }}>
              <Typography variant="h6">No products found</Typography>
              <Typography color="text.secondary">Try adjusting your filters.</Typography>
            </Box>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <ProductPagination count={totalPages} page={page} onChange={handlePageChange} />
          )}
        </Grid>
      </Grid>
    </Container>
  );
};

export default ProductListing;
