import React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { GridView, ViewList } from '@mui/icons-material';

const ProductViewToggle = ({ view, onChange }) => {
  return (
    <ToggleButtonGroup
      value={view}
      exclusive
      onChange={onChange}
      aria-label="product view toggle"
      size="small"
    >
      <ToggleButton value="grid" aria-label="grid view">
        <GridView />
      </ToggleButton>
      <ToggleButton value="list" aria-label="list view">
        <ViewList />
      </ToggleButton>
    </ToggleButtonGroup>
  );
};

export default ProductViewToggle;
