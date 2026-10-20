import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Resets the scroll position on navigation.
 *
 * Search-param aware: listing filters, sort and pagination are URL-driven now,
 * so "?page=3" or a changed filter set is a new result page and must land at
 * the top — watching `pathname` alone left the customer mid-list on page 3.
 *
 * Two deliberate exemptions:
 *  - POP (Back/Forward): the browser restores the previous offset itself, and
 *    overriding it is the classic "back button loses my place" bug.
 *  - a fragment in the URL: an in-page anchor owns the scroll position, and
 *    index.css already sets scroll-padding-top so it clears the sticky nav.
 */
const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search, hash, navigationType]);

  return null;
};

export default ScrollToTop;
