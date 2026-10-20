/**
 * Navbar — the global bar. LF-09 (search entry), LF-23 (mobile nav), LF-29 (support
 * reachable from the nav), LF-30 (shell copy from brand.js), IMPL_SPEC §1 C-14.
 *
 * WHAT CHANGED AND WHY
 * 1. The search icon was a dead `IconButton` — no `onClick`, no `href`, no `component`
 *    — between two correctly wired `component={Link}` icons. It now opens
 *    `SearchOverlay`, as does `/` (and ⌘K/Ctrl+K) when focus is not in a field.
 * 2. `isScrolled` + the `window.addEventListener('scroll')` handler are gone. They
 *    re-rendered the whole bar on every scroll event and the state was never read
 *    (DESIGN_SYSTEM §9.12). `isHome` is gone too — nothing branched on it either.
 * 3. The wordmark and tagline come from `content/brand.js`. The repo spelled the name
 *    two ways; brand.js resolves it to `Le foyeR.` once, with the reasoning, and
 *    uppercase presentation is CSS where it is wanted — never a second string.
 * 4. The account icon no longer disappears below `sm`. Hiding the only route to
 *    sign-in on the narrowest screens is the LF-23 defect in miniature.
 * 5. The mobile Drawer held Products / About / Sign In. It now also holds search,
 *    the bag, the wishlist, FAQ, Contact us and Sign out.
 * 6. Both Sign In links forward `location.state.from`, so a guest bounced to /login
 *    by `ProtectedRoute` who wanders through the navbar still lands back on
 *    /checkout after signing in (LF-13).
 *
 * TWO DESIGN-SYSTEM NOTES, STATED RATHER THAN QUIETLY DROPPED
 * - §6.5 prescribes a *sticky* bar that condenses on scroll, with no spacer anywhere.
 *   IMPL_SPEC §3 WP-08 instead requires `Layout.jsx` to render `<Toolbar />`
 *   unconditionally, which only makes sense for a fixed bar. The package contract
 *   wins: the bar stays `position: fixed` and Layout reserves exactly `--lf-nav-h`.
 *   There is therefore no scroll-condense transition, and — per §9.12 — no scroll
 *   listener was added to fake one.
 * - The old bar painted itself `rgba(26,26,26,0.95)` with white text. theme.js styles
 *   `MuiAppBar` as the system's glass surface with ink text; the override is deleted
 *   rather than re-specified here (§9.11: no raw hex in a component).
 */

import { useCallback, useEffect, useState } from 'react';
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
import { FOCUS_RING_SX } from '../common/EmptyState';
import SearchOverlay from '../search/SearchOverlay';

/** Routes where "where should login send me back to?" must not answer "here". */
const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

const DESKTOP_LINKS = [
  { label: 'Products', to: '/products' },
  { label: 'About', to: '/about' },
  { label: 'Help', to: '/faq' },
];

const DRAWER_LINKS = [
  { label: 'Products', to: '/products', icon: <StorefrontOutlinedIcon /> },
  { label: 'About', to: '/about', icon: <InfoOutlinedIcon /> },
  { label: 'FAQ & delivery', to: '/faq', icon: <HelpOutlineIcon /> },
  { label: 'Contact us', to: '/contact', icon: <MailOutlineIcon /> },
];

/** True when the keystroke belongs to whatever the user is typing in. */
const isTypingTarget = (element) => {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const location = useLocation();
  const brand = useBrand();
  const { cart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { isAuthenticated, logout } = useAuth();

  const closeDrawer = useCallback(() => setMobileOpen(false), []);
  const openSearch = useCallback(() => {
    setMobileOpen(false);
    setSearchOpen(true);
  }, []);

  /* `/` and ⌘K/Ctrl+K open search — unless the user is typing into something. */
  useEffect(() => {
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
  }, []);

  /* A route change closes the drawer; MUI's Dialog already unmounts on navigate. */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  /**
   * LF-13. `ProtectedRoute` navigates to /login with `state.from`. If the visitor then
   * uses the navbar instead of the form in front of them, that destination has to
   * survive the detour — otherwise they sign in and land on the homepage with a full
   * cart. When there is no captured destination, the current page becomes one (except
   * on the auth pages themselves, where "return here" is a loop).
   */
  const signInState = (() => {
    const captured = location.state?.from;
    if (captured?.pathname) {
      return { from: { pathname: captured.pathname, search: captured.search || '' } };
    }
    if (AUTH_PATHS.some((path) => location.pathname.startsWith(path))) return undefined;
    return { from: { pathname: location.pathname, search: location.search || '' } };
  })();

  const cartCount = cart?.count || 0;
  const accountTo = isAuthenticated ? '/profile' : '/login';
  const accountState = isAuthenticated ? undefined : signInState;

  const handleSignOut = () => {
    closeDrawer();
    logout();
  };

  return (
    <>
      <AppBar position="fixed" component="header">
        {/* `lg` is the system container (1232px), so the wordmark and the icon
            cluster line up with every page's content and with the footer. */}
        <Container>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 1 }} disableGutters>
            {/* --- left: menu (mobile) / links (desktop) --- */}
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                flex: '0 0 auto',
              }}
            >
              <IconButton
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-haspopup="dialog"
                edge="start"
                onClick={() => setMobileOpen((open) => !open)}
                sx={FOCUS_RING_SX}
              >
                <MenuIcon />
              </IconButton>
            </Box>

            <Box
              component="nav"
              aria-label="Main"
              sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, flex: 1, alignItems: 'center' }}
            >
              {DESKTOP_LINKS.map((link) => {
                const current = location.pathname === link.to;
                return (
                  <Typography
                    key={link.to}
                    component={Link}
                    to={link.to}
                    variant="subtitle2"
                    aria-current={current ? 'page' : undefined}
                    sx={{
                      textDecoration: 'none',
                      color: 'var(--lf-ink)',
                      py: 1,
                      borderBottom: '2px solid',
                      // Visible without hovering (§9.5): the active route is underlined.
                      borderBottomColor: current ? 'var(--lf-gold-edge)' : 'transparent',
                      '@media (hover: hover)': {
                        '&:hover': { borderBottomColor: 'var(--lf-border-strong)' },
                      },
                      ...FOCUS_RING_SX,
                    }}
                  >
                    {link.label}
                  </Typography>
                );
              })}
            </Box>

            {/* --- centre: wordmark + tagline, both from brand.js --- */}
            <Box
              sx={{
                flex: { xs: 1, md: '0 1 auto' },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <Typography
                variant="wordmark"
                component={Link}
                to="/"
                aria-label={`${brand.wordmark} — home`}
                sx={{
                  textDecoration: 'none',
                  color: 'var(--lf-ink)',
                  whiteSpace: 'nowrap',
                  ...FOCUS_RING_SX,
                }}
              >
                {brand.wordmark}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  color: 'var(--lf-ink-3)',
                  mt: 0.25,
                  whiteSpace: 'nowrap',
                }}
              >
                {brand.tagline}
              </Typography>
            </Box>

            {/* --- right: search / wishlist / account / bag --- */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0, md: 0.5 },
                flex: { xs: '0 0 auto', md: 1 },
                justifyContent: 'flex-end',
              }}
            >
              <IconButton
                onClick={openSearch}
                aria-label="Search products"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                sx={FOCUS_RING_SX}
              >
                <SearchIcon />
              </IconButton>

              <IconButton
                component={Link}
                to="/wishlist"
                aria-label={
                  wishlistCount > 0 ? `Wishlist, ${wishlistCount} saved` : 'Wishlist'
                }
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, ...FOCUS_RING_SX }}
              >
                <Badge
                  badgeContent={wishlistCount}
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.6875rem', height: 16, minWidth: 16 } }}
                >
                  <FavoriteBorderIcon />
                </Badge>
              </IconButton>

              <IconButton
                component={Link}
                to={accountTo}
                state={accountState}
                aria-label={isAuthenticated ? 'Your account' : 'Sign in'}
                sx={FOCUS_RING_SX}
              >
                <PersonOutlineIcon />
              </IconButton>

              <IconButton
                component={Link}
                to="/cart"
                aria-label={cartCount > 0 ? `Bag, ${cartCount} items` : 'Bag, empty'}
                sx={FOCUS_RING_SX}
              >
                <Badge
                  badgeContent={cartCount}
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.6875rem', height: 16, minWidth: 16 } }}
                >
                  <ShoppingBagOutlinedIcon />
                </Badge>
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* ---------------------------------------------------------------- *
       * Mobile Drawer — LF-23. Everything in the bar is reachable here,
       * plus FAQ, Contact and Sign out. Every row is a 48px ListItemButton
       * (theme.js), so the row is the hit target at 320px.
       * ---------------------------------------------------------------- */}
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
          <IconButton onClick={closeDrawer} aria-label="Close menu" sx={FOCUS_RING_SX}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider />

        <List sx={{ px: 1, py: 1 }}>
          <ListItem disablePadding>
            <ListItemButton onClick={openSearch} sx={FOCUS_RING_SX}>
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
            <ListItemButton component={Link} to="/cart" onClick={closeDrawer} sx={FOCUS_RING_SX}>
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
            <ListItemButton
              component={Link}
              to="/wishlist"
              onClick={closeDrawer}
              sx={FOCUS_RING_SX}
            >
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
          {DRAWER_LINKS.map((link) => (
            <ListItem key={link.to} disablePadding>
              <ListItemButton
                component={Link}
                to={link.to}
                onClick={closeDrawer}
                selected={location.pathname === link.to}
                aria-current={location.pathname === link.to ? 'page' : undefined}
                sx={FOCUS_RING_SX}
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
          ))}
        </List>

        <Divider />

        <List sx={{ px: 1, py: 1 }}>
          {isAuthenticated ? (
            <>
              <ListItem disablePadding>
                <ListItemButton
                  component={Link}
                  to="/profile"
                  onClick={closeDrawer}
                  sx={FOCUS_RING_SX}
                >
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
                <ListItemButton
                  component={Link}
                  to="/orders"
                  onClick={closeDrawer}
                  sx={FOCUS_RING_SX}
                >
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
                <ListItemButton onClick={handleSignOut} sx={FOCUS_RING_SX}>
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
                sx={FOCUS_RING_SX}
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

        <Box sx={{ px: 2, py: 2, mt: 'auto' }}>
          <Typography variant="caption" sx={{ color: 'var(--lf-ink-3)' }}>
            {brand.tagline}
          </Typography>
        </Box>
      </Drawer>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default Navbar;
