import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#D4A5A5', // Dusty Rose
    },
    secondary: {
      main: '#8B7B8B', // Muted Purple
    },
    accent: {
      main: '#C8A882', // Warm Gold/Beige
    },
    success: {
      main: '#7FB069', // Sage Green
    },
    background: {
      default: '#FDFBF7', // Cream White
    },
    text: {
      primary: '#4E4E4E', // Dark Warm Gray
      secondary: '#6B6B6B', // Medium Gray
    },
  },
  typography: {
    fontFamily: [
      'Lato',
      'sans-serif',
    ].join(','),
    h1: {
      fontFamily: 'Playfair Display, serif',
    },
    h2: {
      fontFamily: 'Playfair Display, serif',
    },
    h3: {
      fontFamily: 'Playfair Display, serif',
    },
    h4: {
      fontFamily: 'Playfair Display, serif',
    },
    h5: {
      fontFamily: 'Playfair Display, serif',
    },
    h6: {
      fontFamily: 'Playfair Display, serif',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '25px',
          textTransform: 'none',
          padding: '10px 20px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
          },
        },
      },
    },
  },
});

export default theme;
