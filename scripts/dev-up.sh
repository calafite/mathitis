#!/usr/bin/env bash
set -euo pipefail

# Dev/test orchestration: start Postgres + Redis, nuke DB, migrate, seed,
# then launch API + Web dev servers.
#
# Usage: ./scripts/dev-up.sh [--fresh] [--no-seed]
#   --fresh   Remove existing containers and volumes before starting
#   --no-seed Skip DB reset/seed (reuse existing data)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

POSTGRES_CONTAINER="mathitis-postgres"
REDIS_CONTAINER="mathitis-redis"
MINIO_CONTAINER="mathitis-minio"
POSTGRES_PORT=5432
REDIS_PORT=6379
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

info()  { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
fail()  { printf '\033[1;31m✘ %s\033[0m\n' "$*"; exit 1; }

API_PID=""
WEB_PID=""

cleanup() {
  info "Shutting down…"
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
  [ -n "$API_PID" ] && wait "$API_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && wait "$WEB_PID" 2>/dev/null || true
}

kill_port() {
  local port="$1"
  local pids
  pids=$(ss -tlnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      info "Killing process on port $port (PID $pid)"
      kill -9 "$pid" 2>/dev/null || true
    done
    sleep 1
  fi
}
trap cleanup EXIT INT TERM

ensure_container() {
  local name="$1" image="$2"
  shift 2
  if docker inspect "$name" >/dev/null 2>&1; then
    local state
    state=$(docker inspect -f '{{.State.Status}}' "$name")
    if [ "$state" != "running" ]; then
      info "Starting existing container $name…"
      docker start "$name" >/dev/null
    fi
  else
    info "Creating container $name…"
    docker run -d --name "$name" "$@" "$image" >/dev/null
  fi
}

wait_for_postgres() {
  info "Waiting for PostgreSQL to accept connections…"
  for i in $(seq 1 30); do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U mathitis_app -d mathitis >/dev/null 2>&1; then
      ok "PostgreSQL ready"
      return
    fi
    sleep 1
  done
  fail "PostgreSQL did not become ready in 30 s"
}

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------

FRESH=false
NO_SEED=false
for arg in "$@"; do
  case "$arg" in
    --fresh)   FRESH=true ;;
    --no-seed) NO_SEED=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Teardown (optional)
# ---------------------------------------------------------------------------

if [ "$FRESH" = true ]; then
  info "Removing existing containers and volumes…"
  docker rm -f "$POSTGRES_CONTAINER" "$REDIS_CONTAINER" "$MINIO_CONTAINER" 2>/dev/null || true
  docker volume rm mathitis_postgres_data mathitis_minio_data 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Start infrastructure
# ---------------------------------------------------------------------------

ensure_container "$POSTGRES_CONTAINER" postgres:16-alpine \
  -e POSTGRES_USER=mathitis_app \
  -e POSTGRES_PASSWORD=app_password \
  -e POSTGRES_DB=mathitis \
  -p "$POSTGRES_PORT:5432"

ensure_container "$REDIS_CONTAINER" redis:7-alpine \
  -p "$REDIS_PORT:6379"

if docker inspect "$MINIO_CONTAINER" >/dev/null 2>&1; then
  if [ "$(docker inspect -f '{{.State.Status}}' "$MINIO_CONTAINER")" != "running" ]; then
    info "Starting existing container $MINIO_CONTAINER…"
    docker start "$MINIO_CONTAINER" >/dev/null
  fi
else
  info "Creating container $MINIO_CONTAINER…"
  docker run -d --name "$MINIO_CONTAINER" \
    -e MINIO_ROOT_USER=minioadmin \
    -e MINIO_ROOT_PASSWORD=minioadmin \
    -p "$MINIO_API_PORT:9000" \
    -p "$MINIO_CONSOLE_PORT:9001" \
    minio/minio:latest \
    server /data --console-address ":9001" >/dev/null
fi

wait_for_postgres

# ---------------------------------------------------------------------------
# Database reset + migrate + seed
# ---------------------------------------------------------------------------

if [ "$NO_SEED" = false ]; then
  info "Resetting database and applying migrations…"
  (cd "$ROOT_DIR/apps/api" && npx prisma migrate reset --force >/dev/null)

  info "Seeding database…"
  (cd "$ROOT_DIR" && pnpm --filter @mathitis/api db:seed)
else
  info "Skipping database reset (--no-seed)"
fi

# ---------------------------------------------------------------------------
# Start dev servers
# ---------------------------------------------------------------------------

kill_port 4000
kill_port 5173
kill_port 5174
kill_port 9000
kill_port 9001

info "Starting API dev server…"
(cd "$ROOT_DIR" && pnpm --filter @mathitis/api dev) &
API_PID=$!

info "Starting Web dev server…"
(cd "$ROOT_DIR" && pnpm --filter @mathitis/web dev) &
WEB_PID=$!

sleep 3
ok "Dev environment running"
echo "  API    → http://localhost:4000"
echo "  Web    → http://localhost:5173"
echo "  MinIO  → http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "  Press Ctrl+C to stop."

wait
