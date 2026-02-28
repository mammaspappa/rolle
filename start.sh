#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Rolle — interactive dev launcher
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

cd "$(dirname "$0")"

# ── Load nvm and switch to project Node version ───────────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if command -v nvm &>/dev/null; then
  nvm use --silent 2>/dev/null || true
fi

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}  Rolle Inventory — dev launcher${RESET}"
echo "  ─────────────────────────────"

# ── 1. Ensure Docker / database is running ───────────────────────────────────

echo ""
echo -e "${CYAN}  Checking database …${RESET}"

if ! docker compose ps --status running 2>/dev/null | grep -q "rolle_postgres"; then
  echo "  Database not running — starting Docker services …"
  sg docker "docker compose up -d"
  echo "  Waiting for PostgreSQL to be ready …"
  until docker compose exec -T postgres pg_isready -U rolle -q 2>/dev/null; do
    sleep 1
  done
fi

echo -e "  ${GREEN}✓ Database ready${RESET}"

# ── 2. Re-seed prompt ────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}  Re-seed the database?${RESET}"
echo "    1) No  — keep existing data and start the app  ${BOLD}(default)${RESET}"
echo "    2) Yes — wipe and re-seed with demo data"
echo "    3) Yes + history — re-seed demo data AND generate sales history"
echo ""
read -rp "  Choice [1/2/3]: " SEED_CHOICE
SEED_CHOICE="${SEED_CHOICE:-1}"

case "$SEED_CHOICE" in
  2)
    echo ""
    echo -e "  ${YELLOW}⚠  This will DELETE all existing data and re-seed.${RESET}"
    read -rp "  Are you sure? [y/N]: " CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
      echo ""
      echo "  Running migrations …"
      npx prisma migrate deploy
      echo "  Seeding …"
      npm run db:seed
      echo -e "  ${GREEN}✓ Seed complete${RESET}"
    else
      echo "  Skipped."
    fi
    ;;
  3)
    echo ""
    echo -e "  ${YELLOW}⚠  This will DELETE all existing data, re-seed, and generate history.${RESET}"
    read -rp "  Are you sure? [y/N]: " CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
      echo ""
      echo "  Running migrations …"
      npx prisma migrate deploy
      echo "  Seeding …"
      npm run db:seed
      echo "  Generating sales history …"
      npm run db:seed:history
      echo -e "  ${GREEN}✓ Seed + history complete${RESET}"
    else
      echo "  Skipped."
    fi
    ;;
  *)
    echo "  Keeping existing data."
    ;;
esac

# ── 3. Start dev server ───────────────────────────────────────────────────────

echo ""
echo -e "  ${GREEN}Starting dev server …${RESET}"
echo "  App → http://localhost:3000"
echo "  Login → admin@rolle.com / admin123"
echo ""
npm run dev
