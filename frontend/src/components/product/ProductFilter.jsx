import React, { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, Checkbox, Slider, Divider, FormControl, InputLabel, Select, MenuItem, ListItemText } from '@mui/material';
import { getCategories, getSubCategories } from '../../services/mockApi';

const suitableForOptions = ['All', 'Oily', 'Dry', 'Sensitive', 'Acne-prone', 'Combination'];

const ProductFilter = ({ filters, onFilterChange }) => {
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 2000]);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const catResponse = await getCategories();
        setCategories(catResponse.data.results);
        const subCatResponse = await getSubCategories();
        setSubCategories(subCatResponse.data.results);
      } catch (error) {
        console.error('Failed to fetch filters:', error);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (filters.min_price !== undefined && filters.max_price !== undefined) {
      setPriceRange([filters.min_price, filters.max_price]);
    }
  }, [filters.min_price, filters.max_price]);

  const handleCategoryChange = (categoryId) => {
    const newCategories = filters.category?.includes(categoryId)
      ? filters.category.filter((id) => id !== categoryId)
      : [...(filters.category || []), categoryId];
    onFilterChange({ ...filters, category: newCategories });
  };

  const handleSubCategoryChange = (subCategoryId) => {
    const newSubCategories = filters.sub_category?.includes(subCategoryId)
      ? filters.sub_category.filter((id) => id !== subCategoryId)
      : [...(filters.sub_category || []), subCategoryId];
    onFilterChange({ ...filters, sub_category: newSubCategories });
  };

  const handleSuitableForChange = (type) => {
    const newSuitableFor = filters.suitable_for?.includes(type)
      ? filters.suitable_for.filter((t) => t !== type)
      : [...(filters.suitable_for || []), type];
    onFilterChange({ ...filters, suitable_for: newSuitableFor });
  };

  const handlePriceChange = (event, newValue) => {
    setPriceRange(newValue);
  };

  const handlePriceChangeCommitted = (event, newValue) => {
    onFilterChange({ ...filters, min_price: newValue[0], max_price: newValue[1] });
  };

  const handleSortChange = (event) => {
    onFilterChange({ ...filters, ordering: event.target.value });
  };

  return (
    <Box>


      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, fontSize: '0.938rem' }}>
        Suitable For
      </Typography>
      <List dense sx={{ py: 0 }}>
        {suitableForOptions.map((type) => (
          <ListItem key={type} disablePadding sx={{ py: 0.25 }}>
            <Checkbox
              edge="start"
              checked={filters.suitable_for?.includes(type) || false}
              onChange={() => handleSuitableForChange(type)}
              size="small"
            />
            <ListItemText primary={type} primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, fontSize: '0.938rem' }}>
        Price Range
      </Typography>
      <Slider
        value={priceRange}
        onChange={handlePriceChange}
        onChangeCommitted={handlePriceChangeCommitted}
        valueLabelDisplay="auto"
        min={0}
        max={2000}
        sx={{ ml: 1, width: '95%' }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
        <Typography variant="body2" fontSize="0.813rem">₹{priceRange[0]}</Typography>
        <Typography variant="body2" fontSize="0.813rem">₹{priceRange[1]}</Typography>
      </Box>
      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, fontSize: '0.938rem' }}>
        Sort By
      </Typography>
      <FormControl fullWidth size="small">
        <Select
          value={filters.ordering || ''}
          onChange={handleSortChange}
          displayEmpty
        >
          <MenuItem value="">None</MenuItem>
          <MenuItem value="price">Price: Low to High</MenuItem>
          <MenuItem value="-price">Price: High to Low</MenuItem>
          <MenuItem value="-created_at">Newest</MenuItem>
          <MenuItem value="-rating">Top Rated</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
};

export default ProductFilter;