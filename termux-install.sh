#!/data/data/com.termux/files/usr/bin/bash
# WA Control — Termux first-time installation
# Run once before termux-start.sh:  bash termux-install.sh

set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[install]${NC} $*"; }
warn() { echo -e "${YELLOW}[install]${NC} $*"; }
error() { echo -e "${RED}[install]${NC} $*"; exit 1; }

info "Updating package list..."
pkg update -y

info "Installing core packages..."
# nodejs-lts gives Node 20+; python + make are required to compile native npm packages
pkg install -y nodejs-lts postgresql git python make

info "Installing pnpm..."
npm install -g pnpm

# ── PostgreSQL setup ─────────────────────────────────────────────────────────
info "Setting up PostgreSQL..."
PGDATA="$PREFIX/var/lib/postgresql"

if [ ! -d "$PGDATA/base" ]; then
  info "Initialising PostgreSQL cluster..."
  initdb "$PGDATA"
fi

# Start PostgreSQL (safe to run if already running)
pg_ctl -D "$PGDATA" -l "$PGDATA/pg.log" start 2>/dev/null || true
sleep 2

# Create the database
createdb wacontrol 2>/dev/null && info "Created database 'wacontrol'" || warn "Database 'wacontrol' already exists — skipping"

export DATABASE_URL="postgresql://$(whoami)@localhost:5432/wacontrol"
info "DATABASE_URL = $DATABASE_URL"

# ── Persist DATABASE_URL in shell profile ────────────────────────────────────
PROFILE="$HOME/.bashrc"
if ! grep -q "wacontrol" "$PROFILE" 2>/dev/null; then
  echo "" >> "$PROFILE"
  echo "# WA Control" >> "$PROFILE"
  echo "export DATABASE_URL=\"postgresql://$(whoami)@localhost:5432/wacontrol\"" >> "$PROFILE"
  info "DATABASE_URL added to $PROFILE"
fi

# ── Node.js version check ─────────────────────────────────────────────────────
NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 20 ]; then
  warn "Node.js $NODE_MAJOR detected — this project requires Node.js 20 or higher."
  warn "Try:  pkg install nodejs-lts"
else
  info "Node.js $(node --version) — OK"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "To start WA Control run:"
echo ""
echo "    bash termux-start.sh"
echo ""
