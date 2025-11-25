import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#C9A96E', // Refined Gold
      light: '#E8D4B0',
      dark: '#9D7E4A',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#1A1A1A', // Soft Black
      light: '#333333',
      dark: '#000000',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FDFBF9', // Warm Off-White
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#666666',
    },
    divider: 'rgba(201, 169, 110, 0.15)',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h1: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 400,
      fontSize: '4.5rem',
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 400,
      fontSize: '3.5rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 500,
      fontSize: '2.5rem',
      lineHeight: 1.3,
    },
    h4: {
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 500,
      fontSize: '2rem',
      lineHeight: 1.4,
    },
    h5: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 500,
      fontSize: '1.25rem',
      letterSpacing: '0.02em',
    },
    h6: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      fontSize: '1rem',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
    subtitle1: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '1.125rem',
      lineHeight: 1.6,
      color: '#666666',
    },
    button: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 500,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    },
  },
  shape: {
    borderRadius: 0, // Sharp corners for luxury feel
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: '12px 32px',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(201, 169, 110, 0.2)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(201, 169, 110, 0.2)',
          },
        },
        outlined: {
          borderWidth: '1px',
          '&:hover': {
            borderWidth: '1px',
            backgroundColor: 'rgba(201, 169, 110, 0.05)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: 'none',
          border: '1px solid transparent',
          transition: 'all 0.3s ease',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundColor: 'transparent',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: '24px',
          paddingRight: '24px',
          '@media (min-width: 600px)': {
            paddingLeft: '32px',
            paddingRight: '32px',
          },
        },
      },
    },
  },
});

export default theme;