#!/usr/bin/env bash
set -euo pipefail

# Production orchestration: start all services, run deploy migrations.
# Usage: ./scripts/prod-up.sh
# Requires: .env.production (or exported env vars) with all secrets.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.production.yml"

info()  { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
fail()  { printf '\033[1;31m✘ %s\033[0m\n' "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not installed"
fi

if ! docker compose version >/dev/null 2>&1; then
  fail "docker compose (v2) is not available"
fi

if [ ! -f "$ROOT_DIR/.env.production" ]; then
  echo "No .env.production found. Copy .env.production.example and fill in secrets:"
  echo "  cp .env.production.example .env.production"
  exit 1
fi

# ---------------------------------------------------------------------------
# Start services
# ---------------------------------------------------------------------------

info "Building and starting production containers…"
(cd "$ROOT_DIR" && docker compose -f "$COMPOSE_FILE" up -d --build)

# ---------------------------------------------------------------------------
# Wait for healthy services
# ---------------------------------------------------------------------------

info "Waiting for services to become healthy…"
for svc in postgres redis minio; do
  printf "  Waiting for %-10s" "$svc"
  for i in $(seq 1 60); do
    status=$(docker compose -f "$COMPOSE_FILE" ps --format json "$svc" 2>/dev/null \
      | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$status" = "healthy" ]; then
      printf ' \033[1;32m✔\033[0m\n'
      break
    fi
    if [ "$i" -eq 60 ]; then
      printf ' \033[1;31m✘\033[0m\n'
      fail "$svc did not become healthy in 60 s"
    fi
    sleep 1
  done
done

# ---------------------------------------------------------------------------
# Deploy migrations (inside the API container)
# ---------------------------------------------------------------------------

info "Running production migrations…"
(cd "$ROOT_DIR" && docker compose -f "$COMPOSE_FILE" exec -T api npx prisma migrate deploy)

ok "Production environment running"
echo ""
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
