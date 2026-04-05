#!/data/data/com.termux/files/usr/bin/bash
# WA Control — Termux startup script
#
# Usage:
#   bash termux-start.sh          → production mode (single server on port 8080)
#   bash termux-start.sh --dev    → dev mode (hot-reload, API on :8080, UI on :5173)

set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[wa-control]${NC} $*"; }
warn()  { echo -e "${YELLOW}[wa-control]${NC} $*"; }
error() { echo -e "${RED}[wa-control]${NC} $*"; exit 1; }

DEV_MODE=false
for arg in "$@"; do
  [ "$arg" = "--dev" ] && DEV_MODE=true
done

# ── Node.js check ────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || error "Node.js not found. Run: pkg install nodejs-lts"
NODE_VER=$(node -e "process.stdout.write(process.version)")
info "Node.js $NODE_VER"

# ── pnpm check ───────────────────────────────────────────────────────────────
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found — installing via npm..."
  npm install -g pnpm
fi
info "pnpm $(pnpm --version)"

# ── DATABASE_URL ─────────────────────────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://$(whoami)@localhost:5432/wacontrol"
  warn "DATABASE_URL not set — defaulting to: $DATABASE_URL"
  warn "If this fails, set DATABASE_URL before running this script."
fi

# ── Ensure PostgreSQL is running ─────────────────────────────────────────────
if command -v pg_ctl >/dev/null 2>&1; then
  PGDATA="${PGDATA:-$PREFIX/var/lib/postgresql}"
  pg_ctl -D "$PGDATA" -l "$PGDATA/pg.log" start 2>/dev/null || true
fi

# ── Install dependencies ─────────────────────────────────────────────────────
info "Installing dependencies..."
# Do not use --frozen-lockfile: on ARM/ARM64 (Termux) optional native binaries
# differ from those in the x64-generated lock file.
pnpm install

# ── Sync DB schema ───────────────────────────────────────────────────────────
info "Syncing database schema..."
pnpm --filter @workspace/db run push 2>/dev/null || warn "DB schema push failed — check DATABASE_URL and PostgreSQL"

# ── Seed default auto-reply rules (safe — only inserts if table is empty) ────
info "Seeding default auto-reply rules..."
node -e "
import('@workspace/db').then(async ({ db, schema }) => {
  const { waAutoReplies } = schema;
  const existing = await db.select().from(waAutoReplies).limit(1);
  if (existing.length === 0) {
    await db.insert(waAutoReplies).values([
      { trigger: 'hello', response: 'Hi there! I am a bot. How can I help you?', matchType: 'contains', caseSensitive: false, enabled: true },
      { trigger: 'help', response: 'Commands: !help, !info, !ping. Send any message and I will do my best to assist!', matchType: 'contains', caseSensitive: false, enabled: true },
      { trigger: '!ping', response: 'Pong! Bot is alive and running.', matchType: 'exact', caseSensitive: false, enabled: true },
    ]);
    console.log('Seeded 3 default auto-reply rules');
  }
}).catch(() => {});
" 2>/dev/null || true

# ── Launch ───────────────────────────────────────────────────────────────────
if $DEV_MODE; then
  info "Starting in DEV mode (hot-reload)"
  info "  API server → http://localhost:8080"
  info "  Dashboard  → http://localhost:5173  (proxies /api to :8080)"
  echo ""
  exec PARING_NUMBER=27730337759 pnpm run dev
else
  # Production mode: build everything, serve from one Express process
  info "Building dashboard (static files)..."
  BASE_PATH=/ PORT=5173 NODE_ENV=production pnpm --filter @workspace/dashboard build
  info "Dashboard built → artifacts/dashboard/dist/public"

  info "Building API server..."
  pnpm --filter @workspace/api-server build
  info "API server built → artifacts/api-server/dist"

  PORT="${PORT:-8080}"
  info "Starting WA Control on http://localhost:$PORT"
  echo ""
  echo "    http://localhost:$PORT"
  echo "    http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '<your-ip>'):$PORT"
  echo ""
  exec node --enable-source-maps artifacts/api-server/dist/index.mjs
fi
