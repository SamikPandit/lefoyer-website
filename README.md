# Le foyeR. E-Commerce Website

This is the repository for the Le foyeR. e-commerce website, a full-stack application built with React and Django.

## Project Structure

- `backend/`: Django project
- `frontend/`: React project

## Setup

### Backend

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    ```
3.  Activate the virtual environment:
    -   **Windows:**
        ```bash
        venv\Scripts\activate
        ```
    -   **macOS/Linux:**
        ```bash
        source venv/bin/activate
        ```
4.  Install the dependencies:
    ```bash
    pip install -r requirements.txt
    ```
    > **Note:** `requirements.txt` is a `pip freeze` of a developer's whole
    > machine and its last line, `phonepe-sdk`, is **not on public PyPI**, so
    > `pip install -r requirements.txt` will fail on that line on a clean
    > machine. Read the comment block at the top of the file before touching it.
    > The PhonePe SDK must be installed separately from the artefact PhonePe
    > supplies; nothing in local development needs it.
5.  Create `backend/.env` — see **Local development without credentials** below.
    `DEBUG` now defaults to **False**, so without this step the settings module
    will refuse to start rather than quietly run on SQLite.
6.  Run the database migrations:
    ```bash
    python manage.py migrate
    ```
7.  Start the development server:
    ```bash
    python manage.py runserver
    ```

### Frontend

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

---

## Local development without credentials

The production system needs PhonePe, Blue Dart and SMTP credentials that live in
a server-side `.env`. **None of them are needed locally.** This section is what
makes signup, email verification, password reset, review creation, coupon
validation, cart, order creation and the whole COD path exercisable on a laptop
with nothing but Python and SQLite.

### 1. `backend/.env`

Create it with exactly this:

```ini
# Local development only. Never commit a real credential to this file.
DEBUG=True
SECRET_KEY=local-dev-only-not-a-secret
ALLOWED_HOSTS=localhost,127.0.0.1
SITE_URL=http://localhost:5173
API_URL=http://localhost:8000
```

That is the whole list. Everything else has a safe local default.

### 2. What `DEBUG=True` switches on

`DEBUG` is the single local-development switch. It is no longer a value you can
forget: it **defaults to `False`**, because the old default of `True` meant a
production box that omitted the variable silently ran on the bundled
`db.sqlite3` with the development CORS list. With `DEBUG=True`:

| Setting | Value under `DEBUG=True` | Why |
|---|---|---|
| `DATABASES` | SQLite at `backend/db.sqlite3` | No Postgres needed. With `DEBUG=False` and no `DATABASE_URL`, settings raise `ImproperlyConfigured` instead of falling back to SQLite. |
| `EMAIL_BACKEND` | `console.EmailBackend` | Every email — verification links, password resets, order confirmations — is **printed to the `runserver` console**. Copy the link straight out of the terminal. No SMTP credential, no mailbox. |
| `CELERY_TASK_ALWAYS_EAGER` | `True` | Tasks run inline in the request. **No Redis and no Celery worker are required.** Without this, signup appears to succeed but no verification email is ever produced. |
| `CORS_ALLOWED_ORIGINS` | includes `localhost:5173/5174/3000` | The Vite dev server can call the API. |
| `BLUEDART_DEMO_MODE` | `True` (default, independent of `DEBUG`) | Pincode serviceability answers from the demo endpoint instead of the live WSDL. |

With `DEBUG=False`, settings also refuse to start if `SECRET_KEY` is still the
placeholder or if `SITE_URL` still points at `localhost` — every payment
redirect and every verification link is built from `SITE_URL`.

### 3. Seed a catalogue

```bash
cd backend
python manage.py migrate
python manage.py seed_products          # upsert, non-destructive
python manage.py createsuperuser        # for /admin/
python manage.py runserver
```

`seed_products` creates 3 categories, 8 sub-categories and 10 products.

**It is development-only and it refuses to run unless `DEBUG=True`.** Two flags
matter:

- `--force` — **destructive.** Deletes every `Product`, `SubCategory` and
  `Category` first. Without it the command only upserts by SKU.
- `--dry-run` — report what would change, then roll back.

Without `--force` the command **never** writes a price, an `is_featured` /
`is_bestseller` flag, a `show_at_website` value or a `stock_quantity` to a row
that already exists; it updates descriptive copy only. That is deliberate: the
literals in `seed_products.py` disagree with `backend/latest_products.json` on
two prices and on which products are featured and visible, and **neither file is
the live catalogue**. The command prints that conflict as a banner on every run.

### 4. What the content app seeds for you

The `content` app's initial migration seeds the approved brand copy, the claims
register and one delivery/returns policy, so the site renders honest copy with
no manual setup:

```bash
curl -s localhost:8000/api/content/site-settings/   # brand copy + claims register
curl -s localhost:8000/api/content/policy/          # one policy, not five
curl -s localhost:8000/api/content/home-sections/   # [] until a section is in-window
```

`site-settings` ships **no phone number, no WhatsApp number and no support
hours**, because no such value exists anywhere in this repository. A blank field
is not rendered. Claims are served with an `is_substantiated` flag and a client
must render only the ones that are `true`; the unevidenced rows stay in the
register, visible in `/admin/content/claim/`, each carrying the exact evidence
question for the business.

### 5. Exercising the payment flow locally

The PhonePe SDK is not installable here, so the gateway cannot be called. Drive
the state machine directly:

```bash
python manage.py fake_payment_success <order_id>
python manage.py fake_payment_failed  <order_id>
```

**These exercise our state machine, not PhonePe's.** See
[`PAYMENT_FLOW_GUIDE.md`](./PAYMENT_FLOW_GUIDE.md) for the full contract and for
the five scenarios that can only be signed off on staging.

### 6. Frontend against the local API

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, talks to http://localhost:8000
```
