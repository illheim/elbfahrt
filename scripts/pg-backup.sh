#!/usr/bin/env bash
#
# pg-backup.sh — nightly backup of the elbfahrt Postgres database.
#
# Dumps the DB straight out of the running container, gzips it to a timestamped
# file, and prunes local copies older than KEEP_DAYS. Off-box copy is optional
# (see the block at the bottom) and OFF by default.
#
# Restore a dump:
#   gunzip -c elbfahrt-YYYYMMDD-HHMMSS.sql.gz \
#     | docker exec -i elbfahrt-postgres psql -U elbfahrt -d elbfahrt
#
set -euo pipefail

# ── config ──────────────────────────────────────────────────────────────────
PROJECT_DIR="/root/elb-fahrt.de"
BACKUP_DIR="/root/backups"
CONTAINER="elbfahrt-postgres"
DB_NAME="elbfahrt"
DB_USER="elbfahrt"
KEEP_DAYS=14
# ── end config ──────────────────────────────────────────────────────────────

timestamp="$(date +%Y%m%d-%H%M%S)"
outfile="${BACKUP_DIR}/elbfahrt-${timestamp}.sql.gz"
mkdir -p "$BACKUP_DIR"

# Read the DB password from the same .env the stack uses.
DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "${PROJECT_DIR}/.env" | cut -d= -f2-)"

# Dump from inside the running container; gzip on the host.
# --clean --if-exists makes the dump safe to restore over an existing DB.
docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip > "$outfile"

echo "$(date '+%F %T')  backup written: $outfile ($(du -h "$outfile" | cut -f1))"

# Prune local backups older than KEEP_DAYS.
find "$BACKUP_DIR" -name 'elbfahrt-*.sql.gz' -mtime "+${KEEP_DAYS}" -delete

# ── optional off-box copy ────────────────────────────────────────────────────
# Fill STORAGEBOX_* with YOUR OWN Hetzner Storage Box and set up an SSH KEY for
# it first (do NOT use a password in this file). Then uncomment the block.
#
# STORAGEBOX_USER="uXXXXXX"
# STORAGEBOX_HOST="uXXXXXX.your-storagebox.de"
# STORAGEBOX_PATH="elbfahrt-backups"
# scp -o StrictHostKeyChecking=accept-new "$outfile" \
#   "${STORAGEBOX_USER}@${STORAGEBOX_HOST}:${STORAGEBOX_PATH}/" \
#   && echo "$(date '+%F %T')  copied off-box"
