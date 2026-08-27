#!/usr/bin/env bash
set -euo pipefail

# Dev/test orchestration: start Postgres + Redis, nuke DB, migrate, seed.
# Usage: ./scripts/dev-up.sh [--fresh]
#   --fresh  Remove existing containers and volumes before starting

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

POSTGRES_CONTAINER="mathitis-postgres"
REDIS_CONTAINER="mathitis-redis"
POSTGRES_PORT=5432
REDIS_PORT=6379

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

info()  { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
fail()  { printf '\033[1;31m✘ %s\033[0m\n' "$*"; exit 1; }

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
for arg in "$@"; do
  case "$arg" in
    --fresh) FRESH=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Teardown (optional)
# ---------------------------------------------------------------------------

if [ "$FRESH" = true ]; then
  info "Removing existing containers and volumes…"
  docker rm -f "$POSTGRES_CONTAINER" "$REDIS_CONTAINER" 2>/dev/null || true
  docker volume rm mathitis_postgres_data 2>/dev/null || true
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

wait_for_postgres

# ---------------------------------------------------------------------------
# Database reset + migrate + seed
# ---------------------------------------------------------------------------

info "Resetting database and applying migrations…"
(cd "$ROOT_DIR/apps/api" && npx prisma migrate reset --force >/dev/null)

info "Seeding database…"
(cd "$ROOT_DIR" && pnpm --filter @mathitis/api db:seed)

ok "Dev environment ready  (PostgreSQL :$POSTGRES_PORT  Redis :$REDIS_PORT)"
