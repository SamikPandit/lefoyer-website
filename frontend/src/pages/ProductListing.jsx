import React, { useEffect, useState, useCallback } from 'react';
import { Container, Grid, Box, Typography, Paper, Chip, Stack, Button, Drawer, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Close as CloseIcon, FilterList } from '@mui/icons-material';
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
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
      if (response.data && response.data.results) {
        setProducts(response.data.results);
        setTotalPages(Math.ceil(response.data.count / 10));
      } else {
        setProducts([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
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
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setPage(1);
  };

  const handleViewChange = (event, nextView) => {
    if (nextView !== null) {
      setView(nextView);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getFilterLabel = (filterType, value) => {
    if (filterType === 'category') {
      const cat = categories.find(c => c.id === value);
      return cat ? cat.name : `Category ${value}`;
    } else if (filterType === 'sub_category') {
      const subCat = subCategories.find(sc => sc.id === value);
      return subCat ? subCat.name : `Sub-Category ${value}`;
    } else if (filterType === 'suitable_for') {
      return value;
    } else if (filterType === 'min_price') {
      return `Min: ₹${value}`;
    } else if (filterType === 'max_price') {
      return `Max: ₹${value}`;
    } else if (filterType === 'ordering') {
      const sortOptions = {
        'price': 'Price: Low to High',
        '-price': 'Price: High to Low',
        '-created_at': 'Newest',
        '-rating': 'Top Rated',
      };
      return sortOptions[value] || value;
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

  const FilterContent = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Filters
        </Typography>
        {isMobile && (
          <IconButton onClick={() => setMobileFiltersOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      <ProductFilter filters={filters} onFilterChange={handleFilterChange} />
    </Box>
  );

  return (
    <Box sx={{ backgroundColor: '#FAFAFA', minHeight: '100vh', py: 3 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', gap: 2.5 }}>
          {/* Desktop Filter Sidebar - Fixed Width */}
          {!isMobile && (
            <Box sx={{ width: '260px', flexShrink: 0 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  position: 'sticky',
                  top: 80,
                  border: '1px solid',
                  borderColor: 'grey.200',
                  backgroundColor: 'white',
                }}
              >
                <FilterContent />
              </Paper>
            </Box>
          )}

          {/* Mobile Filter Drawer */}
          <Drawer
            anchor="left"
            open={mobileFiltersOpen}
            onClose={() => setMobileFiltersOpen(false)}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': {
                width: '80%',
                maxWidth: 320,
                p: 2,
              },
            }}
          >
            <FilterContent />
          </Drawer>

          {/* Product Grid - Flexible Width */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Mobile Filter Button */}
            {isMobile && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setMobileFiltersOpen(true)}
                sx={{ mb: 2 }}
              >
                Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
              </Button>
            )}

            {/* Active Filters */}
            {activeFilters.length > 0 && (
              <Paper elevation={0} sx={{ p: 1.5, mb: 2, border: '1px solid', borderColor: 'grey.200' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.813rem' }}>
                    Active Filters
                  </Typography>
                  <Button
                    onClick={handleClearAllFilters}
                    size="small"
                    sx={{ textTransform: 'none', fontSize: '0.75rem', minWidth: 'auto', p: 0.5 }}
                  >
                    Clear All
                  </Button>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {activeFilters.map((filter, index) => (
                    <Chip
                      key={index}
                      label={getFilterLabel(filter.type, filter.value)}
                      onDelete={() => handleRemoveFilter(filter.type, filter.value)}
                      size="small"
                      sx={{ fontSize: '0.75rem', height: '26px' }}
                    />
                  ))}
                </Stack>
              </Paper>
            )}

            {/* Toolbar */}
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1.5,
                mb: 2,
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                {products.length} Products
              </Typography>
              {!isMobile && <ProductViewToggle view={view} onChange={handleViewChange} />}
            </Paper>

            {/* Products */}
            {products.length > 0 ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: view === 'grid'
                      ? { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }
                      : 'repeat(1, 1fr)',
                    gap: 2,
                  }}
                >
                  {products.map((product) => (
                    <Box key={product.id}>
                      <ProductCard product={product} view={view} />
                    </Box>
                  ))}
                </Box>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Box sx={{ mt: 3 }}>
                    <ProductPagination count={totalPages} page={page} onChange={handlePageChange} />
                  </Box>
                )}
              </>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  textAlign: 'center',
                  py: 8,
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Typography variant="h6" sx={{ mb: 1, fontSize: '1.125rem' }}>No products found</Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your filters
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default ProductListing;