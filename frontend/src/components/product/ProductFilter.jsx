import React, { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, Checkbox, Slider, Divider, FormControl, InputLabel, Select, MenuItem, ListItemText } from '@mui/material';
import { getCategories, getSubCategories } from '../../services/mockApi';

const ProductFilter = ({ filters, onFilterChange }) => {
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

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



  const handleSortChange = (event) => {
    onFilterChange({ ...filters, ordering: event.target.value });
  };

  return (
    <Box>




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