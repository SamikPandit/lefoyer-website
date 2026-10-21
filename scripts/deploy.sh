#!/usr/bin/env bash
#
# Deploy lefoyerglobal.com from this working copy.
#
# Reads docs/DEPLOYMENT.md for the reasoning behind each step. This script is deliberately
# fail-fast and idempotent: every destructive step is preceded by a backup, and the migration
# is rehearsed against a copy of the live database before it touches the real one.
#
#   ./scripts/deploy.sh            # full deploy
#   ./scripts/deploy.sh --dry-run  # rehearse: back up + migrate a COPY + build, change nothing live
#
set -euo pipefail

SSH_HOST="${SSH_HOST:-hostinger}"
APP_ROOT="/var/www/lefoyer"
BACKUP_DIR="/root/lefoyer-backups"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m    ! %s\033[0m\n' "$*"; }
die()  { printf '\033[31m    ✗ %s\033[0m\n' "$*" >&2; exit 1; }

rsh() { ssh -o BatchMode=yes -o ConnectTimeout=20 "$SSH_HOST" "$@"; }

# ---------------------------------------------------------------------------
say "0 · Preflight"
# ---------------------------------------------------------------------------
rsh true || die "cannot reach $SSH_HOST over ssh"
[[ -d "$REPO_ROOT/frontend" && -d "$REPO_ROOT/backend" ]] || die "run this from the repo"

rsh "test -f $APP_ROOT/backend/.env" || die "$APP_ROOT/backend/.env missing on the host"

# The new settings.py selects the database from DATABASE_URL alone. Production's .env points at a
# Postgres that is NOT running (nothing listens on :5432) — see docs/DEPLOYMENT.md landmine #1.
# Deploying without fixing this takes the site down, so refuse rather than discover it at restart.
DBURL="$(rsh "sed -n 's/^DATABASE_URL=//p' $APP_ROOT/backend/.env" || true)"
case "$DBURL" in
  sqlite:*) say "    DATABASE_URL is sqlite — good" ;;
  postgres*|postgresql*)
    if rsh "ss -ltn 2>/dev/null | grep -q ':5432'"; then
      warn "DATABASE_URL is Postgres and :5432 IS listening — continuing"
    else
      die "DATABASE_URL points at Postgres but nothing listens on :5432.
     The live data is in $APP_ROOT/backend/db.sqlite3.
     Set in $APP_ROOT/backend/.env:
       DEBUG=False
       DATABASE_URL=sqlite:////var/www/lefoyer/backend/db.sqlite3
     then re-run. (See docs/DEPLOYMENT.md §landmines.)"
    fi ;;
  "") die "DATABASE_URL is unset; the new settings require it explicitly when DEBUG=False" ;;
  *)  warn "unrecognised DATABASE_URL scheme — continuing" ;;
esac

rsh "$APP_ROOT/backend/venv/bin/python -c 'import dj_database_url'" \
  || die "dj-database-url is not installed on the host: $APP_ROOT/backend/venv/bin/pip install dj-database-url"

if rsh "grep -qE '^DEBUG=(True|true|1|yes)' $APP_ROOT/backend/.env"; then
  warn "DEBUG is still True in production .env — tracebacks and the dev CORS list will be live."
  warn "Set DEBUG=False before or immediately after this deploy."
fi

# ---------------------------------------------------------------------------
say "1 · Backup (database, env, media, current code and dist)"
# ---------------------------------------------------------------------------
rsh "set -e
  mkdir -p $BACKUP_DIR
  cd $APP_ROOT
  cp backend/db.sqlite3 $BACKUP_DIR/db.sqlite3.$TS 2>/dev/null || echo '    (no sqlite file to back up)'
  cp backend/.env       $BACKUP_DIR/env.$TS
  tar czf $BACKUP_DIR/frontend-dist.$TS.tgz -C frontend dist 2>/dev/null || true
  tar czf $BACKUP_DIR/backend-code.$TS.tgz --exclude=venv --exclude=__pycache__ \
          --exclude=staticfiles --exclude=media -C $APP_ROOT backend 2>/dev/null || true
  ls -la $BACKUP_DIR | tail -5"
say "    backups tagged $TS"

# ---------------------------------------------------------------------------
say "2 · Rehearse the migration against a COPY of the live database"
# ---------------------------------------------------------------------------
# Upload the code to a staging dir first so the rehearsal runs the NEW migrations.
# --chown and --no-o --no-g matter: rsync -a preserves NUMERIC uid/gid, and the developer's
# local uid 1000 maps to `ubuntu` on this host. Without them the whole backend tree flips from
# www-data to ubuntu and gunicorn can no longer create its unix socket — which takes the site
# down at restart. '*.sock' is excluded because the live socket lives inside backend/ and
# --delete would otherwise remove it out from under the running process. 'celerybeat-schedule*'
# is excluded for the same reason: celery beat's default --schedule path is relative to its
# WorkingDirectory (this tree), so --delete used to wipe the scheduler's shelve db mid-run.
# deploy/systemd/lefoyer-celery-beat.service moves it to /var/lib/celery; the exclude keeps
# older installs from being broken by a deploy.
rsync -az --delete --no-o --no-g --chown=www-data:www-data \
  --exclude venv --exclude .env --exclude db.sqlite3 --exclude media \
  --exclude staticfiles --exclude __pycache__ --exclude '*.pyc' --exclude '*.sock' \
  --exclude 'celerybeat-schedule*' --exclude 'celerybeat.pid' \
  -e "ssh -o BatchMode=yes" \
  "$REPO_ROOT/backend/" "$SSH_HOST:$APP_ROOT/backend.incoming/"

rsh "set -e
  cd $APP_ROOT
  rm -f /tmp/migrate-rehearsal.sqlite3
  cp backend/db.sqlite3 /tmp/migrate-rehearsal.sqlite3
  cd backend.incoming
  ln -sfn $APP_ROOT/backend/venv venv 2>/dev/null || true
  export DEBUG=False
  export DATABASE_URL='sqlite:////tmp/migrate-rehearsal.sqlite3'
  export \$(grep -E '^(SECRET_KEY|ALLOWED_HOSTS|SITE_URL|API_URL)=' $APP_ROOT/backend/.env | xargs -d '\n' -I{} echo {}) 2>/dev/null || true
  $APP_ROOT/backend/venv/bin/python manage.py migrate --noinput
  $APP_ROOT/backend/venv/bin/python manage.py makemigrations --check --dry-run
  echo '    rehearsal OK'"
say "    migration rehearsal passed on a copy of live data"

if [[ $DRY_RUN -eq 1 ]]; then
  say "DRY RUN · stopping before anything live is changed"
  say "    backups: $BACKUP_DIR/*.$TS*   rehearsed DB: /tmp/migrate-rehearsal.sqlite3"
  exit 0
fi

# ---------------------------------------------------------------------------
say "3 · Build the frontend"
# ---------------------------------------------------------------------------
pushd "$REPO_ROOT/frontend" >/dev/null
# `npm ci` UNCONDITIONALLY. The old `[[ -d node_modules ]] ||` guard installed only when
# node_modules was absent, so a host that already had one from a previous deploy would skip
# the install — and the build now has a `prebuild` step (scripts/optimize-images.mjs) plus a
# new `sharp` devDependency that such a host does not have. The deploy would fail at the
# prebuild hook, after the backup and the migration rehearsal. npm ci is idempotent and reads
# the lockfile, which changed in this release.
npm ci
VITE_API_URL="${VITE_API_URL:-https://www.lefoyerglobal.com/api/}" \
VITE_SITE_URL="${VITE_SITE_URL:-https://www.lefoyerglobal.com}" \
  npm run build
popd >/dev/null
[[ -f "$REPO_ROOT/frontend/dist/index.html" ]] || die "frontend build produced no dist/index.html"

# ---------------------------------------------------------------------------
say "4 · Publish backend"
# ---------------------------------------------------------------------------
rsh "set -e
  cd $APP_ROOT
  rm -rf backend.prev && cp -al backend backend.prev 2>/dev/null || cp -a backend backend.prev
  rsync -a --delete \
    --exclude venv --exclude .env --exclude db.sqlite3 --exclude media --exclude staticfiles \
    --exclude '*.sock' --exclude 'celerybeat-schedule*' --exclude 'celerybeat.pid' \
    backend.incoming/ backend/
  rm -rf backend.incoming
  # Belt and braces: the service runs as www-data and must own everything it writes.
  chown -R www-data:www-data backend"

# ---------------------------------------------------------------------------
say "5 · Migrate for real, collect static, recompute rating cache"
# ---------------------------------------------------------------------------
rsh "set -e
  cd $APP_ROOT/backend
  venv/bin/python manage.py migrate --noinput
  venv/bin/python manage.py collectstatic --noinput >/dev/null
  venv/bin/python manage.py recompute_product_ratings || echo '    (rating recompute skipped)'
  # Responsive derivatives for UPLOADED media. The frontend's Vite pipeline can only pre-encode
  # masters committed to the repo, which covers two of six live products; the other four are
  # uploads in MEDIA_ROOT and were 2.27 MB of the listing's weight on their own. Incremental, so
  # a deploy with no new uploads re-encodes nothing. Never fatal: without it the API returns
  # image_main_derived=null and the client falls back to the original upload.
  venv/bin/python manage.py optimize_media --quiet || echo '    (media optimisation skipped)'
  venv/bin/python manage.py check --deploy 2>&1 | tail -20 || true"

# ---------------------------------------------------------------------------
say "6 · Publish frontend"
# ---------------------------------------------------------------------------
rsync -az --delete --no-o --no-g --chown=www-data:www-data -e "ssh -o BatchMode=yes" \
  "$REPO_ROOT/frontend/dist/" "$SSH_HOST:$APP_ROOT/frontend/dist/"
rsh "chown -R www-data:www-data $APP_ROOT/frontend/dist"

# ---------------------------------------------------------------------------
say "7 · Restart"
# ---------------------------------------------------------------------------
rsh "set -e
  rm -f $APP_ROOT/backend/lefoyer.sock
  systemctl restart lefoyer-backend
  systemctl restart lefoyer-celery || echo '    (celery restart skipped)'
  # beat is restarted explicitly and its status is ASSERTED, not ignored. It was found dead in
  # production having exhausted its restart budget on 2026-10-17, which silently stopped every
  # periodic task — including sweep-pending-orders, the job that frees stock and coupon holds
  # from abandoned prepaid orders. A scheduler that is down looks exactly like a site that is up.
  systemctl restart lefoyer-celery-beat || echo '    (beat restart skipped)'
  nginx -t && systemctl reload nginx
  sleep 5
  systemctl is-active lefoyer-backend"

say "    unit status"
for unit in lefoyer-backend lefoyer-celery lefoyer-celery-beat; do
  st="$(rsh "systemctl is-active $unit" 2>/dev/null || true)"
  if [[ "$st" == "active" ]]; then printf '    ok   %-28s %s\n' "$unit" "$st"
  else
    printf '\033[33m    !    %-28s %s\033[0m\n' "$unit" "${st:-unknown}"
    if [[ "$unit" == "lefoyer-celery-beat" ]]; then
      warn "beat is not running: periodic tasks (incl. the PENDING-order sweeper) will NOT fire."
      warn "install deploy/systemd/lefoyer-celery-beat.service — see the header of that file."
    fi
  fi
done

# ---------------------------------------------------------------------------
say "8 · Smoke test"
# ---------------------------------------------------------------------------
FAILED=0
smoke() { # url expected-code label
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$1" || echo 000)
  if [[ "$code" == "$2" ]]; then printf '    ok   %-58s %s\n' "$3" "$code"
  else printf '    FAIL %-58s %s (expected %s)\n' "$3" "$code" "$2"; FAILED=1; fi
}
smoke https://www.lefoyerglobal.com/                       200 "homepage"
smoke https://www.lefoyerglobal.com/products               200 "SPA deep link /products"
smoke https://www.lefoyerglobal.com/robots.txt             200 "robots.txt"
smoke https://www.lefoyerglobal.com/sitemap.xml            200 "sitemap.xml"
smoke https://www.lefoyerglobal.com/api/products/products/ 200 "catalogue API"
smoke https://www.lefoyerglobal.com/api/content/policy/    200 "policy API"
smoke https://www.lefoyerglobal.com/api/products/categories/ 200 "categories API"

if [[ $FAILED -eq 1 ]]; then
  warn "SMOKE TEST FAILED — roll back with:"
  cat <<ROLLBACK
    ssh $SSH_HOST '
      systemctl stop lefoyer-backend lefoyer-celery
      cp $BACKUP_DIR/db.sqlite3.$TS $APP_ROOT/backend/db.sqlite3
      cp $BACKUP_DIR/env.$TS        $APP_ROOT/backend/.env
      rm -rf $APP_ROOT/backend && mv $APP_ROOT/backend.prev $APP_ROOT/backend
      rm -rf $APP_ROOT/frontend/dist && tar xzf $BACKUP_DIR/frontend-dist.$TS.tgz -C $APP_ROOT/frontend
      systemctl start lefoyer-backend lefoyer-celery && systemctl reload nginx'
ROLLBACK
  exit 1
fi

say "Deployed. Backups tagged $TS in $BACKUP_DIR; previous code at $APP_ROOT/backend.prev"
cat <<'NEXT'

    Still unverified — these need a real browser and real gateway credentials:
      · a PhonePe sandbox payment end to end (success, decline, abandon, replayed callback, retry)
      · real email deliverability, and that verification links contain no /#/
      · that celery beat stayed up after this deploy (step 7 prints its status; if it is not
        'active' the PENDING-order sweeper is not running)
    See docs/DEPLOYMENT.md.
NEXT
