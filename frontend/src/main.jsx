import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import theme from './theme';
import { applyLegacyHashRedirect } from './components/common/LegacyHashRedirect';
import './index.css';

/* ---------------------------------------------------------------------------
 * Low-end Android gate: one attribute, set once. No component knows it
 * happened — index.css turns every .lf-glass / .lf-skel--media off under
 * html[data-glass="off"].
 * ------------------------------------------------------------------------- */
const lowEnd =
  (navigator.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
if (lowEnd) document.documentElement.setAttribute('data-glass', 'off');

/* ---------------------------------------------------------------------------
 * Legacy "#/..." URLs (every link already sitting in a customer's inbox) are
 * rewritten to their clean path BEFORE the first render, so an emailed
 * verification link never paints the homepage on its way to /verify-email/:t.
 * <LegacyHashRedirect /> inside the Router covers everything that happens
 * after boot. Both share one implementation.
 * ------------------------------------------------------------------------- */
applyLegacyHashRedirect();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
