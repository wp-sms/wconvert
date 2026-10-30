#!/usr/bin/env bash
#
# reset.sh — puts demo.wconvert.io back to clean. Run hourly from cron.
#
#   reset.sh               restore the clean snapshot, then re-seed
#   reset.sh --snapshot    take the clean snapshot
#
# Take the snapshot once, after the first `wp eval-file seed.php` on a fresh
# install, and again after every plugin upload. A restore then:
#
#   1. imports the database snapshot. The users tables are left out of the
#      snapshot, so the import never touches them and nobody is logged out
#      mid-session;
#   2. puts wp-content/uploads back as it was, dropping anything a visitor's
#      design added;
#   3. re-runs seed.php, so the counters and Leads end today.
#
# Run it as the web server's user, e.g. in that user's crontab:
#
#   0 * * * * WP_PATH=/var/www/demo /var/www/demo-tools/reset.sh >> /var/log/demo-reset.log 2>&1
#
# Exits non-zero on any failure, so a monitor watching the log or the exit
# status sees a reset that did not happen.

set -euo pipefail

WP_PATH="${WP_PATH:-/var/www/demo}"
WP="${WP:-wp}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-$(dirname "$WP_PATH")/demo-snapshot}"
SEED="${SEED:-$(cd "$(dirname "$0")" && pwd)/seed.php}"

site() { "$WP" --path="$WP_PATH" "$@"; }

mkdir -p "$SNAPSHOT_DIR"
exec 9>"$SNAPSHOT_DIR/.lock"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) another reset is still running; skipped"
  exit 0
fi

uploads="$WP_PATH/wp-content/uploads"
prefix="$(site db prefix)"

if [[ "${1:-}" == "--snapshot" ]]; then
  site db export "$SNAPSHOT_DIR/database.sql" --exclude_tables="${prefix}users,${prefix}usermeta"
  rm -rf "$SNAPSHOT_DIR/uploads"
  cp -a "$uploads" "$SNAPSHOT_DIR/uploads"
  echo "$(date -u +%FT%TZ) snapshot taken"
  exit 0
fi

if [[ ! -f "$SNAPSHOT_DIR/database.sql" ]]; then
  echo "No snapshot at $SNAPSHOT_DIR. Seed a fresh install, then run: $0 --snapshot" >&2
  exit 2
fi

site db import "$SNAPSHOT_DIR/database.sql"
# Copied beside the live folder, then swapped in, so no request sees half of it.
rm -rf "$uploads.next" "$uploads.prev"
cp -a "$SNAPSHOT_DIR/uploads" "$uploads.next"
mv "$uploads" "$uploads.prev"
mv "$uploads.next" "$uploads"
rm -rf "$uploads.prev"
site cache flush
site eval-file "$SEED"

echo "$(date -u +%FT%TZ) reset done"
