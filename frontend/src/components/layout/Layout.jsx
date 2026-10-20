/**
 * Layout — the global shell: skip link, fixed Navbar + its spacer, <main>, Footer.
 *
 * LF-03 / IMPL_SPEC §1 C-13, the bug this file existed to cause:
 * line 15 used to read `{!isHome && <Toolbar />}`. The AppBar is `position: fixed`,
 * so on the homepage — and ONLY the homepage — nothing reserved its height and the
 * first section of the page (the Marquee, ~59px) rendered underneath it and was
 * invisible. The spacer is now rendered unconditionally.
 *
 * WHY THE HEIGHTS CANNOT DRIFT APART AGAIN
 * `theme.js` sets `MuiToolbar.root { minHeight: var(--lf-nav-h) }` (56px, 64px from
 * 900px up) with zero vertical padding, and Navbar's AppBar adds no `py` of its own.
 * So this spacer `<Toolbar />` and the bar's own `<Toolbar />` resolve to the same
 * token on every breakpoint — there is no hardcoded pixel height in either file.
 *
 * The skip link is the first focusable element on every page. `index.css` has styled
 * `.lf-skip-link` since the design system landed and nothing rendered one.
 */

import { Box, Toolbar } from '@mui/material';

import Navbar from './Navbar';
import Footer from '../common/Footer';

const Layout = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <a className="lf-skip-link" href="#main-content">
      Skip to content
    </a>

    <Navbar />

    {/* Spacer for the fixed AppBar. Unconditional: see the note above. */}
    <Toolbar aria-hidden="true" />

    <Box
      component="main"
      id="main-content"
      tabIndex={-1}
      sx={{ flexGrow: 1, outline: 'none' }}
    >
      {children}
    </Box>

    <Footer />
  </Box>
);

export default Layout;
