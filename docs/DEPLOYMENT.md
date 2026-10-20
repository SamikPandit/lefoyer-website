# Deployment runbook — lefoyerglobal.com

Facts below were verified directly on the production host on 2026-10-20, not assumed.

## Host

| | |
|---|---|
| Host | `72.61.227.242` (`ssh hostinger`), Ubuntu 24.04.3, Python 3.12.3 |
| App root | `/var/www/lefoyer` — **not a git repository.** Deploys are file copies, not `git pull`. |
| Frontend | `/var/www/lefoyer/frontend/dist` served by nginx |
| Backend | `/var/www/lefoyer/backend`, gunicorn via unix socket `backend/lefoyer.sock` |
| Services | `lefoyer-backend.service` (running), `lefoyer-celery.service` (running), `redis-server` (running), nginx (running) |
| Not running | **PostgreSQL — nothing listens on :5432.** `celerybeat` is **not** a running service. |
| Node | v20.19.6 / npm 10.8.2 — the frontend *can* be built on the host |
| nginx SPA rewrite | **Already present**: `try_files $uri $uri/ /index.html`. The `HashRouter` → `BrowserRouter` switch needs no nginx change. |

nginx also proxies `/api/` and `/admin/` to the gunicorn socket and aliases `/static/` →
`backend/staticfiles/`, `/media/` → `backend/media/`.

## ⚠️ Four landmines — read before deploying

### 1. Production is running on SQLite, not Postgres

`.env` contains `DATABASE_URL=postgres://…@localhost:5432/lefoyer_db`, but **nothing is listening on
5432**. The live site only reaches SQLite because the *old* settings guard was
`if DATABASE_URL and not DEBUG:` and `.env` has `DEBUG=True`. So the condition is false and it falls
through to SQLite.

The live database is `/var/www/lefoyer/backend/db.sqlite3` (458 KB, 30 tables).

**The new `settings.py` keys the database choice off `DATABASE_URL` alone** (deliberately — to stop a
prod box silently running on SQLite). Deploying it with `.env` unchanged would make Django connect to a
Postgres that does not exist → **total outage**.

**Required `.env` change, to be made in the same deploy:**
```
DEBUG=False
DATABASE_URL=sqlite:////var/www/lefoyer/backend/db.sqlite3
```
Four slashes after `sqlite:` — three for the scheme, one for the absolute path. This keeps the live
data, satisfies the explicit-configuration guard, and closes the `DEBUG=True` hole below.

Migrating to Postgres properly is the better long-term answer, but it is a separate change with its own
risk, and the dataset is small (14 users, 12 products, 1 order).

### 2. `DEBUG=True` in production

Full tracebacks (with settings values) are exposed on any error, and the permissive dev `CORS_ALLOWED_ORIGINS`
list — including `localhost` — is active. Setting `DEBUG=False` as above fixes it. Note `DEBUG=False`
also switches email from console to real SMTP and turns off `CELERY_TASK_ALWAYS_EAGER`, so Celery must
be running (it is).

### 3. `dj-database-url` is NOT installed on the server

The new settings use it to parse `DATABASE_URL`. Install it before restarting:
```bash
/var/www/lefoyer/backend/venv/bin/pip install dj-database-url
```

### 4. Server package versions are AHEAD of `requirements.txt`

| Package | Server | `requirements.txt` pin |
|---|---|---|
| Django | **5.2.8** | `4.2.7` |
| djangorestframework | **3.16.1** | `3.14.0` |
| django-filter | 25.2 | `django-filter` (unpinned) |
| zeep | 4.3.2 | `4.2.1` |
| Pillow | 12.0.0 | `Pillow` (unpinned) |
| phonepe-sdk | **2.1.5** | not on public PyPI |

**Never run `pip install -r requirements.txt` on this host** — it would downgrade Django 5.2.8 → 4.2.7
and probably break the running site. `requirements.txt` is a `pip freeze` of a developer workstation
(it contains langchain, chromadb, Flask, openai and reverse-engineering tooling) and is not a
deployable manifest. Treat it as advisory until someone rewrites it from actual imports.

Application code must therefore be **Django 5.2-compatible**, not 4.2-only.

## PhonePe SDK — the real API (introspected on the host, v2.1.5)

This resolves the V1/V2 mismatch the audit found. `StandardCheckoutClient` exposes:

```
get_instance(client_id: str, client_secret: str, client_version: int,
             env: Env = Env.SANDBOX, should_publish_events: bool = True)
pay(pay_request: StandardCheckoutPayRequest) -> StandardCheckoutPayResponse
get_order_status(merchant_order_id: str, details: bool = False) -> OrderStatusResponse
get_transaction_status(transaction_id: str) -> OrderStatusResponse
validate_callback(username: str, password: str,
                  callback_header_data: str, callback_response_data: str) -> CallbackResponse
refund(refund_request) / get_refund_status(merchant_refund_id)
create_sdk_order(sdk_order_request)
```

So `get_order_status` is the authoritative status call, and `validate_callback` replaces the old
hand-rolled V1 `sha256(payload + salt) + "###" + index` checksum. `validate_callback` needs the
username/password configured in the PhonePe dashboard — these must be set in `.env` as
`PHONEPE_CALLBACK_USERNAME` / `PHONEPE_CALLBACK_PASSWORD` (the new settings read them; they are **not
yet in the server `.env`**).

## Backups

Taken before this deploy, in `/root/lefoyer-backups/`, timestamp `20261020-180909`:

| File | Verified |
|---|---|
| `db.sqlite3.20261020-180909` | 458 KB, `PRAGMA integrity_check` = **ok**, 30 tables, 14 users / 12 products / 1 order / 2 order items |
| `env.20261020-180909` | the pre-deploy `.env` |
| `media.20261020-180909.tgz` | 117 MB |
| `frontend-dist.20261020-180909.tgz` | 89 MB |
| `backend-code.20261020-180909.tgz` | 117 MB (venv/pycache/staticfiles excluded) |

## Live data shape (as of deploy)

14 users (9 email-verified) · 12 products, **6 with `show_at_website=True`** · 1 order, `PENDING`,
never paid · 2 order items · **0 reviews**.

Two consequences:
- **No duplicate emails and no duplicate `(product, user)` reviews**, so the two riskiest migrations —
  `accounts` unique-email and `reviews` unique-together — have nothing to collide with here. Their
  pre-check `RunPython` steps should still be left in place for other environments.
- The production catalogue is **6 visible SKUs, not 10**. Category/concern tiles render only where
  `product_count > 0`, so the grids collapse gracefully rather than showing dead links.

## Deploy sequence

```bash
# 0. on the host — backup first (see above), then:
/var/www/lefoyer/backend/venv/bin/pip install dj-database-url

# 1. edit /var/www/lefoyer/backend/.env
#    DEBUG=False
#    DATABASE_URL=sqlite:////var/www/lefoyer/backend/db.sqlite3
#    PHONEPE_CALLBACK_USERNAME=...   (from the PhonePe dashboard)
#    PHONEPE_CALLBACK_PASSWORD=...

# 2. upload backend code (exclude venv, db.sqlite3, media, staticfiles, .env)
rsync -av --delete \
  --exclude venv --exclude .env --exclude db.sqlite3 \
  --exclude media --exclude staticfiles --exclude __pycache__ \
  backend/ hostinger:/var/www/lefoyer/backend/

# 3. migrations — DRY RUN FIRST against a copy of the live DB, never straight on prod
cd /var/www/lefoyer/backend
cp db.sqlite3 /tmp/migrate-test.sqlite3
DATABASE_URL=sqlite:////tmp/migrate-test.sqlite3 venv/bin/python manage.py migrate --plan
DATABASE_URL=sqlite:////tmp/migrate-test.sqlite3 venv/bin/python manage.py migrate
# only if that is clean:
venv/bin/python manage.py migrate
venv/bin/python manage.py collectstatic --noinput
venv/bin/python manage.py recompute_product_ratings

# 4. frontend — build locally or on the host, then publish
npm ci && npm run build          # in frontend/
rsync -av --delete frontend/dist/ hostinger:/var/www/lefoyer/frontend/dist/

# 5. restart
systemctl restart lefoyer-backend lefoyer-celery
nginx -t && systemctl reload nginx

# 6. smoke test — see below
```

`celerybeat` is not currently a service. The new PENDING-payment sweeper is a beat task, so until a
`lefoyer-celerybeat.service` exists it will not run and stale PENDING orders will not auto-expire.
That is a known gap, not a silent one.

## Post-deploy smoke test

```bash
curl -sI  https://lefoyerglobal.com/                        # 200
curl -sI  https://lefoyerglobal.com/products                # 200 (SPA rewrite, not 404)
curl -s   https://lefoyerglobal.com/api/products/products/ | head -c 300
curl -s   https://lefoyerglobal.com/api/content/policy/
curl -s   https://lefoyerglobal.com/api/products/categories/
curl -sI  https://lefoyerglobal.com/#/products              # legacy hash link still resolves
```
Then in a browser: homepage CTA works · search returns products · a PDP shows no star rating (there are
genuinely 0 reviews) · pincode check responds · add to cart · login round-trips back to checkout.

## Rollback

```bash
systemctl stop lefoyer-backend lefoyer-celery
cd /root/lefoyer-backups
cp db.sqlite3.20261020-180909 /var/www/lefoyer/backend/db.sqlite3
cp env.20261020-180909        /var/www/lefoyer/backend/.env
rm -rf /var/www/lefoyer/backend.broken && mv /var/www/lefoyer/backend /var/www/lefoyer/backend.broken
mkdir -p /var/www/lefoyer/backend && tar xzf backend-code.20261020-180909.tgz -C /var/www/lefoyer
rm -rf /var/www/lefoyer/frontend/dist && tar xzf frontend-dist.20261020-180909.tgz -C /var/www/lefoyer/frontend
systemctl start lefoyer-backend lefoyer-celery && systemctl reload nginx
```
Note the restored `backend-code` tarball does not contain `venv`, so keep the existing one in place.

## Still requires staging with real credentials

Nothing below can be proven from a local machine, and none of it should be reported as done on the
strength of local checks:

1. A successful PhonePe sandbox payment end to end → `COMPLETED`, stock decremented **once**, cart
   cleared, one confirmation email, exactly one `Purchase` pixel event.
2. A declined payment → `FAILED`, cart intact, no stock movement, no email, no pixel event.
3. An abandoned payment → resolved to `CANCELLED`/`EXPIRED` by the sweeper (needs celerybeat, see above).
4. A **replayed** callback → one email, one stock movement.
5. A retry on a `FAILED` order → one order, a second `PaymentAttempt`.
6. `validate_callback` accepting a genuine PhonePe callback with the dashboard username/password.
7. Blue Dart serviceability against the live WSDL — specifically that `serviceable` / `cod_available`
   arrive as real booleans. zeep runs with `strict=False`, so if the WSDL types them as strings the
   string `'false'` is truthy in Python and **every pincode would report serviceable**. A normaliser is
   in place; which case production actually hits is unverified.
8. Real email deliverability through Hostinger SMTP, and that verification links contain no `/#/`.
