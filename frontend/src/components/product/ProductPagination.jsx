/**
 * ProductPagination — the listing's page control.
 *
 * The component itself was never broken; its caller was. `ProductListing` computed
 * `count` from a hard-coded `Math.ceil(response.data.count / 10)` (LF-09), so the number
 * of pages was wrong the moment `page_size` differed from the global `PAGE_SIZE`. The
 * page count is now derived from `count` and the page size the listing actually sends,
 * and this component just renders what it is given.
 *
 * Kept here: a `<nav>` landmark with a label, a visually-hidden live announcement of the
 * current page (a bare `<Pagination>` announces nothing when the grid repaints), and no
 * hard-coded margin — the caller owns its own spacing.
 */

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';

/**
 * @param {object} props
 * @param {number} props.count Total pages. The caller derives it from `count / pageSize`.
 * @param {number} props.page Current 1-based page.
 * @param {Function} props.onChange `(event, page) => void`
 * @param {boolean} [props.disabled=false] Set while a page is in flight.
 */
const ProductPagination = ({ count, page, onChange, disabled = false }) => {
  if (!Number.isFinite(count) || count < 2) return null;

  return (
    <Box
      component="nav"
      aria-label="Product pages"
      sx={{ display: 'flex', justifyContent: 'center' }}
    >
      <Box component="span" className="lf-sr-only" role="status" aria-live="polite">
        {`Page ${page} of ${count}`}
      </Box>
      <Pagination
        count={count}
        page={page}
        onChange={onChange}
        disabled={disabled}
        color="primary"
        showFirstButton
        showLastButton
        sx={{ '& .MuiPaginationItem-root': { minWidth: 44, height: 44 } }}
      />
    </Box>
  );
};

export default ProductPagination;
