/**
 * ============================================================================
 * <Layout> — the global shell. ART_DIRECTION.md §6.10, §6.9, §2.27, §5.5.
 *
 * TWO CHANGES, BOTH STRUCTURAL.
 *
 * 1. THE SPACER IS GONE (§6.9). This file used to render a `<Toolbar />`
 *    beneath the bar to reserve the height of a `position: fixed` AppBar —
 *    and before that, to render it on every route EXCEPT home, which is why
 *    the home page's first section rendered underneath the bar. §6.9 makes
 *    the bar `position: sticky`, so it reserves its own height in normal flow
 *    and there is nothing left to spare. No spacer anywhere. `index.css`
 *    carries `scroll-padding-top: calc(var(--lf-nav-h) + 16px)` so an anchor
 *    target is never parked under the glass.
 *
 * 2. `chrome="full" | "minimal"` (§6.10, §2.27). `App.jsx:240` wraps every
 *    route in ONE Layout, so the payment screen carried three outbound nav
 *    links, search, wishlist, account and a nine-link footer — ELEVEN one-tap
 *    routes out of the funnel, against §8's explicit "no search, no nav links,
 *    no footer links". Minimal is applied to `/checkout` and
 *    `/order-confirmation` ONLY (§5.5): the bar keeps the wordmark linked to
 *    `/` and, on checkout, `Back to bag`; the footer collapses to one
 *    copyright line.
 *
 *    The mode is a PROP, exactly as §6.10 specifies, but it defaults to the
 *    route when no prop is passed, because the single call site in `App.jsx`
 *    is outside this package and cannot pass one. Passing `chrome` explicitly
 *    always wins, so the prop contract is real rather than decorative.
 *
 * WHAT STAYS MOUNTED IN BOTH MODES (§6.10): everything global. The skip link,
 * <main>, the toast host and the bag drawer live wherever they live today and
 * are not conditional — only the nav links, search, wishlist, account and the
 * footer link farm are withheld.
 * ========================================================================== */

import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';

import Navbar from './Navbar';
import Footer from '../common/Footer';

/**
 * §2.27 / §5.5 — the funnel. Both are checkout-flow screens where an outbound
 * link is a lost order, and both are reached only from a cart that already
 * exists, so nothing is stranded by withholding the nav.
 */
export const MINIMAL_CHROME_PATHS = Object.freeze(['/checkout', '/order-confirmation']);

/**
 * The default chrome for a path. Exported so a page can ask the same question
 * this file asks, rather than keeping a second list of funnel routes.
 * @param {string} pathname
 * @returns {'full'|'minimal'}
 */
export function chromeForPath(pathname) {
  const path = typeof pathname === 'string' ? pathname : '';
  return MINIMAL_CHROME_PATHS.some(
    (funnel) => path === funnel || path.startsWith(`${funnel}/`)
  )
    ? 'minimal'
    : 'full';
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {'full'|'minimal'} [props.chrome] Omit to derive it from the route.
 * @returns {JSX.Element}
 */
const Layout = ({ children, chrome }) => {
  const location = useLocation();
  const mode = chrome === 'minimal' || chrome === 'full' ? chrome : chromeForPath(location.pathname);

  return (
    /* 100dvh, not 100vh: on mobile Safari and Chrome Android 100vh is the
       LARGEST viewport, so a 100vh shell guarantees a scrollbar on every
       page. The same mistake is why §5.9 deletes Wishlist's minHeight. */
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* A15 — the first focusable element on every route. */}
      <a className="lf-skip-link" href="#main-content">
        Skip to content
      </a>

      <Navbar chrome={mode} />

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{ flexGrow: 1, outline: 'none', minWidth: 0 }}
      >
        {children}
      </Box>

      <Footer chrome={mode} />
    </Box>
  );
};

export default Layout;
