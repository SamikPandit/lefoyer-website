import React from 'react';
import { Grid, Box, Typography, Paper } from '@mui/material';
import { SpaOutlined, ScienceOutlined, AllInclusiveOutlined, CrueltyFreeOutlined } from '@mui/icons-material';

const benefits = [
  {
    icon: <SpaOutlined sx={{ fontSize: 40, color: 'primary.main' }} />,
    title: 'Natural Ingredients',
    description: 'Formulated with the finest natural and botanical ingredients.',
  },
  {
    icon: <ScienceOutlined sx={{ fontSize: 40, color: 'primary.main' }} />,
    title: 'Dermatologically Tested',
    description: 'Rigorously tested for safety and efficacy by dermatologists.',
  },
  {
    icon: <AllInclusiveOutlined sx={{ fontSize: 40, color: 'primary.main' }} />,
    title: 'Suitable for All Skin Types',
    description: 'Gentle formulations perfect for even the most sensitive skin.',
  },
  {
    icon: <CrueltyFreeOutlined sx={{ fontSize: 40, color: 'primary.main' }} />,
    title: 'Cruelty-Free',
    description: 'Committed to ethical practices and never tested on animals.',
  },
];

const Benefits = () => {
  return (
    <Box sx={{ my: 6 }}>
      <Grid container spacing={4}>
        {benefits.map((benefit) => (
          <Grid xs={12} sm={6} md={3} key={benefit.title}>
            <Paper 
              elevation={0}
              sx={{ 
                textAlign: 'center', 
                p: 3,
                bgcolor: 'transparent',
              }}
            >
              <Box sx={{ mb: 2 }}>{benefit.icon}</Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                {benefit.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {benefit.description}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Benefits;
