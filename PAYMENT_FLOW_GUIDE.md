# Payment Flow - Testing Guide

## Issue: "This site can't be reached" Error

When you cancel a PhonePe payment, you see `ERR_CONNECTION_REFUSED` on `localhost:5173/order-conf`. This happens because:

1. **Frontend server not running** - The React dev server needs to be started
2. **URL mismatch** - PhonePe redirect vs actual route

## Solution

### 1. Start the Frontend Server

```bash
cd frontend
npm run dev
```

The server should start on `http://localhost:5173`

### 2. Payment Flow Now Works Like This:

#### **Successful Payment:**
1. User completes PhonePe payment
2. PhonePe redirects to: `http://localhost:5173/#/order-confirmation?code=PAYMENT_SUCCESS&transactionId=xxx`
3. Page shows:
   - ✅ Green success icon
   - "Order Placed Successfully!"
   - Order ID and amount
   - Buttons: "Continue Shopping" | "View Orders"

####  **Cancelled Payment:**
1. User cancels PhonePe payment
2. PhonePe redirects to: `http://localhost:5173/#/order-confirmation?code=PAYMENT_CANCELLED`
3. Page shows:
   - ❌ Red error icon
   - "Payment Cancelled"
   - Message: "You cancelled the payment. Your order has not been placed."
   - Buttons: "Go to Cart" | "Continue Shopping"

#### **Failed Payment:**
1. Payment fails (insufficient funds, etc.)
2. PhonePe redirects with `code=PAYMENT_ERROR`
3. Page shows:
   - ❌ Red error icon
   - "Payment Failed"
   - Message: "Your payment could not be processed. Please try again."
   - Buttons: "Go to Cart" | "Continue Shopping"

#### **Pending Payment:**
1. Payment is processing
2. PhonePe redirects with `code=PAYMENT_PENDING`
3. Page shows:
   - ⏳ Orange hourglass icon
   - "Payment Pending"
   - Message: "Your payment is being processed..."
   - Buttons: "View Orders" | "Continue Shopping"

## What Changed

### Before:
- OrderConfirmation page only showed success state
- Didn't handle PhonePe query parameters
- No handling for cancelled/failed payments

### After:
- ✅ Handles all payment states (success, failed, cancelled, pending)
- ✅ Reads PhonePe callback parameters (`code`, `transactionId`)
- ✅ Fetches order details from backend
- ✅ Shows appropriate icons, messages, and action buttons
- ✅ Loading state while fetching data

## Testing

### Test Cancellation Flow:
1. Ensure frontend server is running: `cd frontend && npm run dev`
2. Ensure backend is running: `cd backend && python manage.py runserver`
3. Add items to cart
4. Go to checkout
5. Click "Pay Now"
6. On PhonePe payment page, click "Cancel" or back button
7. You should see the updated order confirmation page with "Payment Cancelled" message

### Test Success Flow:
1. Complete the payment on PhonePe sandbox
2. You should be redirected back with success message

## Production Deployment

Update the redirect URL in your environment:

```bash
# .env
SITE_URL=https://www.lefoyerglobal.com
```

PhonePe will then redirect to:
`https://www.lefoyerglobal.com/#/order-confirmation?code=...`

## Troubleshooting

### Still seeing "ERR_CONNECTION_REFUSED"?

1. **Check if frontend is running:**
   ```bash
   curl http://localhost:5173
   ```
   
2. **Check the port:**
   - Vite usually runs on port 5173
   - Check `vite.config.js` or console output

3. **Start both servers:**
   ```bash
   # Terminal 1: Backend
   cd backend
   python manage.py runserver
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

### Payment shows "Unknown Status"?

- The transaction ID might not match any order
- Check backend logs for the order creation
- Verify the `provider_order_id` field in database

### PhonePe redirects to wrong URL?

- Check `SITE_URL` in backend `.env`
- Update redirect URL in `payment.py` line 35
