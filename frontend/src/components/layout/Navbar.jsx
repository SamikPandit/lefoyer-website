/**
 * ============================================================================
 * <Navbar> — ART_DIRECTION.md §6.9, §2.9, §2.2, §5.5, §6.10.
 *
 * 56px mobile / 64px desktop, `position: sticky` (NOT fixed), and NO Toolbar
 * spacer anywhere — the bar reserves its own height in normal flow, which is
 * what deletes `Layout.jsx`'s old `{!isHome && <Toolbar />}` and with it the
 * reason the home hero rendered under the bar.
 *
 * THE FOUR CHANGES §6.9 ASKS FOR, AND WHY EACH ONE IS A FIX, NOT A TASTE:
 *
 * 1. THE TAGLINE IS DELETED from the centre. Two lines of centred type is the
 *    only reason the bar measured 72px in `home-desk.png` and was cramped at
 *    390. The tagline still ships — in the footer, where there is room for a
 *    sentence. The wordmark stays Fraunces 20px: licence 1 of 3 (§2.2), and
 *    20px is a HARD floor because the face is unreadable below it on a cheap
 *    Android panel.
 *
 * 2. ONE LABEL PER ROUTE. `Products` / `About` / `Help`. `/faq` was reached by
 *    five different names across the app ("FAQ", "FAQ & delivery", "Help",
 *    "Support", "Questions"); §5.8 ends that, here and in the drawer.
 *
 * 3. THE ACTIVE ROUTE IS MARKED BY A 2px `--lf-gold-edge` UNDERLINE
 *    (3.16:1, SC 1.4.11 ✓) — never by colour alone, never only on hover (A8,
 *    §10.14). `aria-current="page"` carries the same fact to a screen reader.
 *
 * 4. THE DEAD `data-scrolled` STATE, FINALLY GIVEN A WAY IN (§2.9).
 *    `theme.js` has styled `&[data-scrolled="true"]` since the system landed
 *    and NOTHING in the repository ever set it, so `--lf-e-nav` had zero
 *    consumers and the bar separated from content with a 1.27:1 hairline
 *    forever. One `IntersectionObserver` on a 1px sentinel writes the
 *    attribute to a REF'D DOM NODE — never React state (which is what was
 *    rightly deleted here), never a scroll listener (§10.17, P8). Scrolled,
 *    the bar gains `--lf-e-nav` plus the 2px gold ledge along its lower edge:
 *    this is how the brand hex reaches above the fold on every route. The
 *    transition is zeroed under `prefers-reduced-motion` by index.css §9, so
 *    the state survives the preference and only the animation goes.
 *
 * `chrome="minimal"` (§2.27, §5.5): on `/checkout` and `/order-confirmation`
 * the bar renders ONLY the wordmark linked to `/` and, on checkout, `Back to
 * bag`. No search, no nav links, no wishlist, no account, no bag icon —
 * eleven one-tap routes out of the funnel, gone.
 *
 * NOTHING `position: fixed` NESTS INSIDE THE BAR (§6.9, §10.15): a
 * backdrop-filtered ancestor becomes a containing block for fixed
 * descendants. The Drawer and the search overlay are siblings of the AppBar
 * and portal to `document.body`.
 *
 * LF-09 (search entry), LF-13 (`state.from` survives a detour through the
 * nav), LF-23 (every action reachable at 320px), LF-29, LF-30 (every string
 * from `brand.js`) are all preserved.
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppBar,
  Badge,
  Box,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import MenuIcon from '@mui/icons-material/Menu';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';

import { useBrand } from '../../content/brand';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import SearchOverlay from '../search/SearchOverlay';

/** Routes where "where should login send me back to?" must not answer "here". */
const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

/**
 * §6.9 — three links, one label per route. `match` exists because the PDP
 * lives at `/product/:slug` (singular) while the listing is `/products`: the
 * active mark has to survive the walk from the shelf to a bottle.
 */
const DESKTOP_LINKS = Object.freeze([
  {
    label: 'Products',
    to: '/products',
    match: (path) => path.startsWith('/products') || path.startsWith('/product/'),
  },
  { label: 'About', to: '/about', match: (path) => path.startsWith('/about') },
  { label: 'Help', to: '/faq', match: (path) => path.startsWith('/faq') },
]);

/** The drawer carries the same three routes under the same three labels. */
const DRAWER_LINKS = Object.freeze([
  { label: 'Products', to: '/products', icon: <StorefrontOutlinedIcon /> },
  { label: 'About', to: '/about', icon: <InfoOutlinedIcon /> },
  { label: 'Help', to: '/faq', icon: <HelpOutlineIcon /> },
  { label: 'Contact', to: '/contact', icon: <MailOutlineIcon /> },
]);

/** §6.5's success moment: the bag badge springs. One licensed spring (§3.12). */
const BADGE_BUMP_MS = 280;

/** True when the keystroke belongs to whatever the user is typing in. */
const isTypingTarget = (element) => {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/**
 * @param {object} props
 * @param {'full'|'minimal'} [props.chrome='full'] `minimal` withholds search,
 *   the nav links, wishlist, account and the bag (§2.27, §5.5).
 * @returns {JSX.Element}
 */
const Navbar = ({ chrome = 'full' }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const location = useLocation();
  const brand = useBrand();
  const { cart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { isAuthenticated, logout } = useAuth();

  const barRef = useRef(null);
  const sentinelRef = useRef(null);
  const bagRef = useRef(null);
  const lastCount = useRef(0);

  const minimal = chrome === 'minimal';
  const cartCount = cart?.count || 0;

  const closeDrawer = useCallback(() => setMobileOpen(false), []);
  const openSearch = useCallback(() => {
    setMobileOpen(false);
    setSearchOpen(true);
  }, []);

  /* ---- §2.9: the scroll state, written to the DOM, not to React ---------
     A 1px sentinel sits at the very top of the document, pulled flush under
     the bar by a −1px margin so it costs no layout. When it leaves the
     viewport the page has scrolled, and the bar takes its elevation and its
     gold ledge. Zero scroll listeners, zero re-renders (P8, §10.17). */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!sentinel || !bar) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        bar.setAttribute('data-scrolled', entry.isIntersecting ? 'false' : 'true');
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [minimal]);

  /* ---- §6.5: the bag badge springs on a successful add ------------------
     <AddToBag> has no reach into the nav, so the bump belongs to whoever owns
     the badge. `theme.js` already styles `.MuiBadge-badge[data-bump="true"]`
     with --lf-ease-spring; nothing had ever set the attribute. Written
     straight to the node: a 280ms decoration must not re-render the bar. */
  useEffect(() => {
    if (minimal) {
      lastCount.current = cartCount;
      return undefined;
    }
    const grew = cartCount > lastCount.current;
    lastCount.current = cartCount;
    if (!grew) return undefined;

    const badge = bagRef.current?.querySelector('.MuiBadge-badge');
    if (!badge) return undefined;
    badge.setAttribute('data-bump', 'true');
    const timer = setTimeout(() => badge.removeAttribute('data-bump'), BADGE_BUMP_MS);
    return () => clearTimeout(timer);
  }, [cartCount, minimal]);

  /* `/` and ⌘K/Ctrl+K open search — unless the user is typing into something. */
  useEffect(() => {
    if (minimal) return undefined;
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
      const commandK = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
      if (!slash && !commandK) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [minimal]);

  /* A route change closes the drawer; MUI's Dialog already unmounts on navigate. */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  /**
   * LF-13. `ProtectedRoute` navigates to /login with `state.from`. If the visitor
   * then uses the navbar instead of the form in front of them, that destination has
   * to survive the detour — otherwise they sign in and land on the homepage with a
   * full cart. When there is no captured destination the current page becomes one,
   * except on the auth pages themselves, where "return here" is a loop.
   */
  const signInState = (() => {
    const captured = location.state?.from;
    if (captured?.pathname) {
      return { from: { pathname: captured.pathname, search: captured.search || '' } };
    }
    if (AUTH_PATHS.some((path) => location.pathname.startsWith(path))) return undefined;
    return { from: { pathname: location.pathname, search: location.search || '' } };
  })();

  const accountTo = isAuthenticated ? '/profile' : '/login';
  const accountState = isAuthenticated ? undefined : signInState;

  const handleSignOut = () => {
    closeDrawer();
    logout();
  };

  /* The wordmark: Fraunces licence 1 of 3, 20px, one line, no tagline. */
  const wordmark = (
    <Typography
      variant="wordmark"
      component={Link}
      to="/"
      aria-label={`${brand.wordmark} — home`}
      sx={{
        textDecoration: 'none',
        color: 'var(--lf-ink)',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 44,
      }}
    >
      {brand.wordmark}
    </Typography>
  );

  return (
    <>
      {/* The §2.9 sentinel. 1px tall with a −1px bottom margin, so the sticky
          bar still starts at y=0 and nothing shifts. aria-hidden and
          pointer-events:none — it is a measurement, not an element. */}
      <Box
        ref={sentinelRef}
        aria-hidden="true"
        sx={{ height: '1px', mb: '-1px', flex: 'none', pointerEvents: 'none' }}
      />

      {/* `.lf-glass` is what lets index.css's `html[data-glass="off"]` gate
          turn the blur off wholesale on a low-end device; the media query
          below is A10's `prefers-reduced-transparency` opt-out, which the
          theme's own AppBar glass would otherwise outrank on source order.
          Both write a token, never a hex. */}
      <AppBar
        ref={barRef}
        position="sticky"
        component="header"
        className="lf-glass"
        sx={{
          '@media (prefers-reduced-transparency: reduce)': {
            backgroundColor: 'var(--lf-canvas)',
            WebkitBackdropFilter: 'none',
            backdropFilter: 'none',
          },
        }}
      >
        <Container>
          {/* `1fr auto 1fr`, so the wordmark takes the middle track and the
              two clusters can never overlap it at any width. The side tracks
              never shrink below their content, so nothing is ever clipped
              and the bar cannot overflow — which is also why the wordmark
              sits slightly left of true page centre on a phone, where the
              icon cluster is wider than a single hamburger. A truly centred
              wordmark is arithmetically impossible there; see the note on
              the right cluster. */}
          <Toolbar
            disableGutters
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: { xs: 0, sm: 1 },
            }}
          >
            {/* --- left --- */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifySelf: 'start', minWidth: 0 }}>
              {minimal ? (
                location.pathname.startsWith('/checkout') ? (
                  <Typography
                    component={Link}
                    to="/cart"
                    variant="subtitle2"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      minHeight: 44,
                      textDecoration: 'none',
                      color: 'var(--lf-ink-2)',
                      '@media (hover: hover)': { '&:hover': { color: 'var(--lf-ink)' } },
                    }}
                  >
                    <ArrowBackIcon fontSize="small" aria-hidden="true" />
                    Back to bag
                  </Typography>
                ) : null
              ) : (
                <>
                  <IconButton
                    aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileOpen}
                    aria-haspopup="dialog"
                    edge="start"
                    onClick={() => setMobileOpen((open) => !open)}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                  >
                    <MenuIcon />
                  </IconButton>

                  <Box
                    component="nav"
                    aria-label="Main"
                    sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, alignItems: 'center' }}
                  >
                    {DESKTOP_LINKS.map((link) => {
                      const current = link.match(location.pathname);
                      return (
                        <Typography
                          key={link.to}
                          component={Link}
                          to={link.to}
                          variant="subtitle2"
                          aria-current={current ? 'page' : undefined}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            minHeight: 44,
                            textDecoration: 'none',
                            color: 'var(--lf-ink)',
                            /* A8 — the active route is UNDERLINED, never
                               coloured only, and never only on hover. */
                            borderBottom: '2px solid',
                            borderBottomColor: current ? 'var(--lf-gold-edge)' : 'transparent',
                            transition: 'border-color var(--lf-dur-2) var(--lf-ease)',
                            '@media (hover: hover)': {
                              '&:hover': {
                                borderBottomColor: current
                                  ? 'var(--lf-gold-edge)'
                                  : 'var(--lf-border-strong)',
                              },
                            },
                          }}
                        >
                          {link.label}
                        </Typography>
                      );
                    })}
                  </Box>
                </>
              )}
            </Box>

            {/* --- centre: the wordmark, alone --- */}
            <Box sx={{ justifySelf: 'center', minWidth: 0, display: 'flex' }}>{wordmark}</Box>

            {/* --- right --- */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifySelf: 'end',
                minWidth: 0,
              }}
            >
              {minimal ? null : (
                <>
                  <IconButton
                    onClick={openSearch}
                    aria-label="Search products"
                    aria-haspopup="dialog"
                    aria-expanded={searchOpen}
                  >
                    <SearchIcon />
                  </IconButton>

                  {/* THE ONE THING THAT CANNOT FIT AT 320px, AND THE
                      ARITHMETIC THAT DECIDES IT (A6, LF-23).
                      At 320 the content column is 288px (--lf-gutter 16).
                      Five 44px targets plus the 20px Fraunces wordmark
                      (~83px) need 303px + gaps, so SOMETHING is withheld
                      below `sm` or the bar overflows and A6 fails. Account
                      stays — WP-08 named hiding it as a defect and signing in
                      is how an order survives a lost session — and wishlist
                      moves to the drawer, where it is one tap away WITH its
                      count, never hidden behind hover (§10.14). At `sm` and
                      up all four are in the bar. */}
                  <IconButton
                    component={Link}
                    to="/wishlist"
                    aria-label={wishlistCount > 0 ? `Wishlist, ${wishlistCount} saved` : 'Wishlist'}
                    sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                  >
                    <Badge badgeContent={wishlistCount} color="primary">
                      <FavoriteBorderIcon />
                    </Badge>
                  </IconButton>

                  <IconButton
                    component={Link}
                    to={accountTo}
                    state={accountState}
                    aria-label={isAuthenticated ? 'Your account' : 'Sign in'}
                  >
                    <PersonOutlineIcon />
                  </IconButton>

                  <IconButton
                    ref={bagRef}
                    component={Link}
                    to="/cart"
                    aria-label={cartCount > 0 ? `Bag, ${cartCount} items` : 'Bag, empty'}
                  >
                    <Badge badgeContent={cartCount} color="primary">
                      <ShoppingBagOutlinedIcon />
                    </Badge>
                  </IconButton>
                </>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {minimal ? null : (
        <>
          {/* ------------------------------------------------------------ *
           * Mobile drawer — LF-23. Everything in the bar is reachable here,
           * plus Contact and Sign out. Every row is a 48px ListItemButton
           * (theme.js), so the ROW is the hit target at 320px.
           * ------------------------------------------------------------ */}
          <Drawer
            variant="temporary"
            anchor="left"
            open={mobileOpen}
            onClose={closeDrawer}
            slotProps={{ root: { keepMounted: true } }}
            aria-label="Menu"
            sx={{ display: { xs: 'block', md: 'none' } }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.5,
                minHeight: 'var(--lf-nav-h)',
              }}
            >
              <Typography variant="wordmark" sx={{ color: 'var(--lf-ink)' }}>
                {brand.wordmark}
              </Typography>
              <IconButton onClick={closeDrawer} aria-label="Close menu">
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider />

            <List sx={{ px: 1, py: 1 }}>
              <ListItem disablePadding>
                <ListItemButton onClick={openSearch}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                    <SearchIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Search products"
                    slotProps={{ primary: { variant: 'subtitle2' } }}
                  />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton component={Link} to="/cart" onClick={closeDrawer}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                    <ShoppingBagOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={cartCount > 0 ? `Your bag (${cartCount})` : 'Your bag'}
                    slotProps={{ primary: { variant: 'subtitle2' } }}
                  />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton component={Link} to="/wishlist" onClick={closeDrawer}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                    <FavoriteBorderIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={wishlistCount > 0 ? `Wishlist (${wishlistCount})` : 'Wishlist'}
                    slotProps={{ primary: { variant: 'subtitle2' } }}
                  />
                </ListItemButton>
              </ListItem>
            </List>

            <Divider />

            <List sx={{ px: 1, py: 1 }} component="nav" aria-label="Main">
              {DRAWER_LINKS.map((link) => {
                const current = location.pathname.startsWith(link.to);
                return (
                  <ListItem key={link.to} disablePadding>
                    <ListItemButton
                      component={Link}
                      to={link.to}
                      onClick={closeDrawer}
                      selected={current}
                      aria-current={current ? 'page' : undefined}
                    >
                      <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                        {link.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={link.label}
                        slotProps={{ primary: { variant: 'subtitle2' } }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            <Divider />

            <List sx={{ px: 1, py: 1 }}>
              {isAuthenticated ? (
                <>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/profile" onClick={closeDrawer}>
                      <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                        <PersonOutlineIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Your account"
                        slotProps={{ primary: { variant: 'subtitle2' } }}
                      />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/orders" onClick={closeDrawer}>
                      <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                        <Inventory2OutlinedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Your orders"
                        slotProps={{ primary: { variant: 'subtitle2' } }}
                      />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton onClick={handleSignOut}>
                      <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                        <LogoutOutlinedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Sign out"
                        slotProps={{ primary: { variant: 'subtitle2' } }}
                      />
                    </ListItemButton>
                  </ListItem>
                </>
              ) : (
                <ListItem disablePadding>
                  <ListItemButton
                    component={Link}
                    to="/login"
                    state={signInState}
                    onClick={closeDrawer}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: 'var(--lf-ink-2)' }}>
                      <PersonOutlineIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sign in"
                      secondary="Track orders and save your wishlist"
                      slotProps={{
                        primary: { variant: 'subtitle2' },
                        secondary: { variant: 'caption' },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )}
            </List>

            {/* The tagline left the bar (§6.9) — it lands here and in the
                footer, where a sentence has room to be read. */}
            <Box sx={{ px: 2, py: 2, mt: 'auto' }}>
              <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
                {brand.tagline}
              </Typography>
            </Box>
          </Drawer>

          <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
      )}
    </>
  );
};

export default Navbar;
