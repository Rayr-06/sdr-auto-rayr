#!/usr/bin/env bash
# SDR Autopilot — Automated setup script (macOS / Linux)
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}🚀 SDR Autopilot — Setup${RESET}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ─── Check runtime ────────────────────────────────────────
if command -v bun &> /dev/null; then
  RUNTIME="bun"
  echo -e "${GREEN}✓${RESET} Using Bun ($(bun --version))"
elif command -v node &> /dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.version.replace('v',''))")
  MAJOR=$(echo $NODE_VER | cut -d. -f1)
  if [ "$MAJOR" -lt 18 ]; then
    echo -e "${RED}✗ Node.js 18+ required (found v${NODE_VER}). Please upgrade.${RESET}"
    exit 1
  fi
  RUNTIME="npm"
  echo -e "${GREEN}✓${RESET} Using Node.js v${NODE_VER} + npm"
else
  echo -e "${RED}✗ Neither Bun nor Node.js found. Please install one:${RESET}"
  echo "  Bun  → https://bun.sh"
  echo "  Node → https://nodejs.org"
  exit 1
fi

# ─── Create .env ──────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo -e "${YELLOW}─── Anthropic API Key ───────────────────────────────────${RESET}"
  echo "Get your key at https://console.anthropic.com"
  echo -e "${YELLOW}Without a key, the app uses realistic demo data (still fully functional).${RESET}"
  echo ""
  read -p "Enter your Anthropic API key (press Enter to skip): " API_KEY
  if [ -n "$API_KEY" ]; then
    sed -i.bak "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${API_KEY}|" .env && rm -f .env.bak
    echo -e "${GREEN}✓${RESET} API key saved to .env"
  else
    echo -e "${YELLOW}⚠${RESET}  Skipped — demo mode will be used"
  fi
else
  echo -e "${GREEN}✓${RESET} .env already exists"
fi

# ─── Create db directory ──────────────────────────────────
mkdir -p db

# ─── Install dependencies ─────────────────────────────────
echo ""
echo -e "${CYAN}Installing dependencies...${RESET}"
if [ "$RUNTIME" = "bun" ]; then
  bun install --frozen-lockfile 2>/dev/null || bun install
else
  npm install
fi
echo -e "${GREEN}✓${RESET} Dependencies installed"

# ─── Database setup ───────────────────────────────────────
echo ""
echo -e "${CYAN}Setting up database...${RESET}"
if [ "$RUNTIME" = "bun" ]; then
  bun run db:generate 2>/dev/null || true
  bun run db:push
else
  npm run db:generate 2>/dev/null || true
  npm run db:push
fi
echo -e "${GREEN}✓${RESET} Database ready (./db/sdr.db)"

# ─── Done ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}✅ Setup complete!${RESET}"
echo ""
echo -e "Start the app:  ${BOLD}${RUNTIME} run dev${RESET}"
echo -e "Then open:      ${BOLD}http://localhost:3000${RESET}"
echo ""
echo -e "Click ${BOLD}\"Run Full Pipeline\"${RESET} to see the AI in action."
echo ""
