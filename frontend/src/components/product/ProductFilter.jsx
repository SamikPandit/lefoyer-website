import React, { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Checkbox, Slider, Divider, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { getCategories, getSubCategories } from '../../services/api';

const suitableForOptions = [
  'All', 'Oily', 'Dry', 'Sensitive', 'Acne-prone', 'Combination'
];

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
      <Typography variant="h6" gutterBottom>
        Category
      </Typography>
      <List dense>
        {categories.map((category) => (
          <ListItem key={category.id} disablePadding>
            <Checkbox
              edge="start"
              checked={filters.category?.includes(category.id) || false}
              onChange={() => handleCategoryChange(category.id)}
            />
            <ListItemText primary={category.name} />
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        Sub-Category
      </Typography>
      <List dense>
        {subCategories.map((subCategory) => (
          <ListItem key={subCategory.id} disablePadding>
            <Checkbox
              edge="start"
              checked={filters.sub_category?.includes(subCategory.id) || false}
              onChange={() => handleSubCategoryChange(subCategory.id)}
            />
            <ListItemText primary={subCategory.name} />
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        Suitable For
      </Typography>
      <List dense>
        {suitableForOptions.map((type) => (
          <ListItem key={type} disablePadding>
            <Checkbox
              edge="start"
              checked={filters.suitable_for?.includes(type) || false}
              onChange={() => handleSuitableForChange(type)}
            />
            <ListItemText primary={type} />
          </ListItem>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        Price Range
      </Typography>
      <Slider
        value={priceRange}
        onChange={handlePriceChange}
        onChangeCommitted={handlePriceChangeCommitted}
        valueLabelDisplay="auto"
        min={0}
        max={2000}
        sx={{ ml: 1, width: '95%'}}
      />
       <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2">₹{priceRange[0]}</Typography>
        <Typography variant="body2">₹{priceRange[1]}</Typography>
      </Box>
      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        Sort By
      </Typography>
      <FormControl fullWidth size="small">
        <InputLabel>Sort By</InputLabel>
        <Select
          value={filters.ordering || ''}
          label="Sort By"
          onChange={handleSortChange}
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
