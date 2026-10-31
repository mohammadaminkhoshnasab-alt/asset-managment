#!/usr/bin/env bash

# ==============================================================================
# IT Asset Management - Linux Installation & Setup Script
# اسکریپت نصب و راه‌اندازی خودکار سامانه مدیریت دارایی‌های فناوری اطلاعات در لینوکس
# ==============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}"
echo "=========================================================="
echo "    IT Asset Management - Automated Setup for Linux"
echo "    سامانه مدیریت دارایی‌های فناوری اطلاعات - نصب خودکار"
echo "=========================================================="
echo -e "${NC}"

# 1. Check Root / Sudo
USER_ID=$(id -u)

# 2. Check Prerequisites: Node.js & npm
echo -e "${CYAN}▶ Checking system prerequisites / بررسی پیش‌نیازهای سیستم...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✘ Node.js is not installed! / نودجی‌اس نصب نیست.${NC}"
    echo -e "${YELLOW}Please install Node.js 18+ on your system:${NC}"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    echo "  RHEL/CentOS/Fedora: sudo dnf module install -y nodejs:20"
    echo "  Arch Linux: sudo pacman -S nodejs npm"
    exit 1
fi

NODE_VER=$(node -v)
echo -e "${GREEN}✔ Node.js detected: ${NODE_VER}${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✘ npm is not installed! / ابزار npm یافت نشد.${NC}"
    exit 1
fi

NPM_VER=$(npm -v)
echo -e "${GREEN}✔ npm detected: v${NPM_VER}${NC}"

# 3. Port Selection (Interactive with default)
echo ""
echo -e "${CYAN}▶ Port Configuration / تنظیم پورت اجرایی سامانه:${NC}"
DEFAULT_PORT=3000
read -r -p "Enter port number to run application [Default: ${DEFAULT_PORT}]: " USER_PORT
PORT=${USER_PORT:-$DEFAULT_PORT}

# Validate that port is a valid number
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -le 1024 ] && [ "$USER_ID" -ne 0 ]; then
    if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -le 0 ] || [ "$PORT" -gt 65535 ]; then
        echo -e "${RED}✘ Invalid port number. Falling back to default port 3000.${NC}"
        PORT=3000
    fi
fi

# Check if port is already in use
if command -v ss &> /dev/null && ss -tuln | grep -q ":$PORT "; then
    echo -e "${YELLOW}⚠ Warning: Port $PORT appears to be currently in use. Please ensure it's freed before running.${NC}"
fi

echo -e "${GREEN}✔ Application will be configured to serve on port: ${BOLD}${PORT}${NC}"
echo ""

# 4. Install Dependencies
echo -e "${CYAN}▶ Installing project dependencies / در حال نصب پکیج‌های پروژه...${NC}"
npm install --legacy-peer-deps

echo -e "${GREEN}✔ Dependencies installed successfully.${NC}"
echo ""

# 5. Build Project for Production
echo -e "${CYAN}▶ Building production bundle / در حال کامپایل و بیلد نسخه نهایی...${NC}"
npm run build

echo -e "${GREEN}✔ Production build completed successfully (dist/ ready).${NC}"
echo ""

# 6. Generate Quick Start Script (start.sh)
START_SCRIPT_PATH="start.sh"
cat <<EOF > "$START_SCRIPT_PATH"
#!/usr/bin/env bash
# Quick Start Script for IT Asset Management on Port $PORT
PORT=$PORT
echo "Starting IT Asset Management on port \$PORT..."
echo "Open browser: http://localhost:\$PORT"
npx vite preview --port \$PORT --host 0.0.0.0
EOF

chmod +x "$START_SCRIPT_PATH"

# 7. Generate Dev Start Script (start-dev.sh)
DEV_SCRIPT_PATH="start-dev.sh"
cat <<EOF > "$DEV_SCRIPT_PATH"
#!/usr/bin/env bash
# Development Server for IT Asset Management on Port $PORT
PORT=$PORT
echo "Starting IT Asset Management Development Server on port \$PORT..."
echo "Open browser: http://localhost:\$PORT"
npm run dev -- --port \$PORT --host 0.0.0.0
EOF

chmod +x "$DEV_SCRIPT_PATH"

echo -e "${GREEN}${BOLD}==========================================================${NC}"
echo -e "${GREEN}${BOLD}  Installation Complete! / فرایند نصب با موفقیت انجام شد!  ${NC}"
echo -e "${GREEN}${BOLD}==========================================================${NC}"
echo ""
echo -e "You can start the application using any of the following commands:"
echo -e "می‌توانید برنامه را با یکی از دستورات زیر اجرا کنید:"
echo ""
echo -e "  ${CYAN}1. Run Production Server (پیشنهادی برای اجرا):${NC}"
echo -e "     ${BOLD}./start.sh${NC}   (or: npx vite preview --port $PORT --host 0.0.0.0)"
echo ""
echo -e "  ${CYAN}2. Run Development Server (محیط توسعه):${NC}"
echo -e "     ${BOLD}./start-dev.sh${NC}   (or: npm run dev -- --port $PORT --host 0.0.0.0)"
echo ""
echo -e "${BLUE}Access the web dashboard in your browser at:${NC}"
echo -e "${BOLD}http://localhost:${PORT}${NC}  or  ${BOLD}http://<YOUR_SERVER_IP>:${PORT}${NC}"
echo ""

# Optional immediate launch
read -r -p "Do you want to start the application right now? [Y/n]: " START_NOW
START_NOW=${START_NOW:-Y}

if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Launching application on http://0.0.0.0:${PORT}...${NC}"
    ./start.sh
fi
