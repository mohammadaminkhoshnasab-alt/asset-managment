#!/usr/bin/env bash
# Quick Production Launcher for IT Asset Management
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=${PORT:-3000}

CYAN='\033[0;36m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
cat << "EOF_BANNER"
  ___ _____      _                    _     __  __                                                   _   
 |_ _|_   _|    / \   ___ ___  ___  | |_  |  \/  | __ _ _ __   __ _  __ _  ___ _ __ ___   ___ _ __ | |_ 
  | |  | |     / _ \ / __/ __|/ _ \ | __| | |\/| |/ _` | '_ \ / _` |/ _` |/ _ \ '_ ` _ \ / _ \ '_ \| __|
  | |  | |    / ___ \\__ \__ \  __/ | |_  | |  | | (_| | | | | (_| | (_| |  __/ | | | | |  __/ | | | |_ 
 |___| |_|   /_/   \_\___/___/\___|  \__| |_|  |_|\__,_|_| |_|\__,_|\__, |\___|_| |_| |_|\___|_| |_|\__|
                                                                      |___/                                
EOF_BANNER
echo -e "${NC}"
echo -e "${GREEN}${BOLD}▶ Starting IT Asset Management on port ${PORT}...${NC}"
echo -e "${CYAN}Local URL:${NC} http://localhost:${PORT}"
echo ""

cd "$DIR"
exec npx vite preview --port "$PORT" --host 0.0.0.0
