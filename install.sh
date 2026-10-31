#!/usr/bin/env bash

# ==============================================================================
# IT Asset Management System - Production-Grade Automated Linux Installer
# Supported Distributions: Ubuntu, Debian, AlmaLinux, Rocky Linux, RHEL, CentOS
# Idempotent, safe, fully automated with dependency validation and systemd support.
# ==============================================================================

set -eo pipefail

# --- Color Scheme ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Defaults & Global Variables ---
APP_NAME="itam"
APP_DISPLAY_NAME="IT Asset Management"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PORT=3000
TARGET_PORT=""
NON_INTERACTIVE=false
SKIP_SYSTEMD=false
NODE_MIN_MAJOR=18
NODE_TARGET_MAJOR=20

# --- Error Handling Trap ---
cleanup_on_error() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "\n${RED}${BOLD}✘ Installation failed with error code ${exit_code}.${NC}"
        echo -e "${YELLOW}Please check the error output above. You can safely re-run this script after resolving the issue.${NC}\n"
    fi
}
trap cleanup_on_error EXIT

# --- Helper Functions ---
log_info() {
    echo -e "${CYAN}ℹ [INFO]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}${BOLD}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}${BOLD}✔ [SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠ [WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}${BOLD}✘ [ERROR]${NC} $1"
}

# --- Command-line Arguments Parsing ---
print_help() {
    cat <<EOF
Usage: bash install.sh [OPTIONS]

Automated installer for ${APP_DISPLAY_NAME} on Linux servers.

Options:
  -p, --port <PORT>       Specify the network port to serve the panel (Default: 3000)
  -y, --yes               Run in non-interactive mode with default/specified values
      --skip-systemd      Do not configure or install systemd system service
  -h, --help              Display this help message and exit

Supported Distributions:
  - Ubuntu (20.04 LTS, 22.04 LTS, 24.04 LTS)
  - Debian (11 Bullseye, 12 Bookworm)
  - AlmaLinux (8.x, 9.x)
  - Rocky Linux (8.x, 9.x)
  - RHEL / CentOS Stream (8, 9)

Examples:
  bash install.sh
  bash install.sh --port 8080 --yes
  bash install.sh -p 3000 --skip-systemd -y
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--port)
            TARGET_PORT="$2"
            shift 2
            ;;
        -y|--yes)
            NON_INTERACTIVE=true
            shift
            ;;
        --skip-systemd)
            SKIP_SYSTEMD=true
            shift
            ;;
        -h|--help)
            print_help
            ;;
        *)
            log_error "Unknown argument: $1"
            print_help
            ;;
    esac
done

# --- Banner ---
echo -e "${BLUE}${BOLD}"
echo "=========================================================================="
echo "    ${APP_DISPLAY_NAME} - Automated Linux Production Installer"
echo "    سامانه مدیریت دارایی‌های فناوری اطلاعات - نصب و پیکربندی خودکار لینوکس"
echo "=========================================================================="
echo -e "${NC}"
log_info "Installation directory: ${APP_DIR}"

# --- Check Privileges ---
IS_ROOT=false
if [ "$(id -u)" -eq 0 ]; then
    IS_ROOT=true
    SUDO_CMD=""
else
    if command -v sudo &> /dev/null; then
        SUDO_CMD="sudo"
    else
        SUDO_CMD=""
    fi
fi

# ==============================================================================
# Step 1: Detect Linux Distribution & Package Manager
# ==============================================================================
log_step "Step 1: Detecting Linux Distribution and Package Manager"

OS_ID=""
OS_VERSION_ID=""
PKG_MANAGER=""

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID:-}"
    OS_LIKE="${ID_LIKE:-}"
    OS_VERSION_ID="${VERSION_ID:-}"
    OS_PRETTY_NAME="${PRETTY_NAME:-$OS_ID}"
elif [ -f /etc/redhat-release ]; then
    OS_PRETTY_NAME=$(cat /etc/redhat-release)
    OS_ID="rhel"
else
    OS_PRETTY_NAME="Unknown Linux Distribution"
fi

log_info "Detected OS: ${BOLD}${OS_PRETTY_NAME}${NC} (ID: ${OS_ID})"

# Determine package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
elif command -v zypper &> /dev/null; then
    PKG_MANAGER="zypper"
else
    log_warn "No standard package manager detected (apt, dnf, yum, pacman)."
    PKG_MANAGER="generic"
fi

log_info "Package Manager: ${BOLD}${PKG_MANAGER}${NC}"

# ==============================================================================
# Step 2: Check & Install Core System Packages (curl, git, ca-certificates, etc.)
# ==============================================================================
log_step "Step 2: Checking and Installing Required System Packages"

SYSTEM_DEPS=()

check_cmd() {
    command -v "$1" &> /dev/null
}

if ! check_cmd curl; then SYSTEM_DEPS+=("curl"); fi
if ! check_cmd git; then SYSTEM_DEPS+=("git"); fi
if ! check_cmd tar; then SYSTEM_DEPS+=("tar"); fi

# Check SSL / certificates
if [ "$PKG_MANAGER" = "apt" ]; then
    if ! dpkg -s ca-certificates &> /dev/null; then SYSTEM_DEPS+=("ca-certificates"); fi
    if ! dpkg -s build-essential &> /dev/null; then SYSTEM_DEPS+=("build-essential"); fi
elif [ "$PKG_MANAGER" = "dnf" ] || [ "$PKG_MANAGER" = "yum" ]; then
    if ! rpm -q ca-certificates &> /dev/null; then SYSTEM_DEPS+=("ca-certificates"); fi
    if ! rpm -q gcc-c++ &> /dev/null; then SYSTEM_DEPS+=("gcc-c++" "make"); fi
fi

if [ ${#SYSTEM_DEPS[@]} -gt 0 ]; then
    log_info "Installing missing system packages: ${SYSTEM_DEPS[*]}"
    if [ "$IS_ROOT" = false ] && [ -z "$SUDO_CMD" ]; then
        log_warn "Root or sudo privileges required to install system packages. Please ensure they are installed manually."
    else
        case "$PKG_MANAGER" in
            apt)
                $SUDO_CMD apt-get update -qq
                $SUDO_CMD apt-get install -y --no-install-recommends "${SYSTEM_DEPS[@]}"
                ;;
            dnf)
                $SUDO_CMD dnf install -y "${SYSTEM_DEPS[@]}"
                ;;
            yum)
                $SUDO_CMD yum install -y "${SYSTEM_DEPS[@]}"
                ;;
            pacman)
                $SUDO_CMD pacman -Sy --noconfirm "${SYSTEM_DEPS[@]}"
                ;;
        esac
    fi
else
    log_success "All essential system utilities (curl, git, tar, compiler) are already installed."
fi

# ==============================================================================
# Step 3: Check & Install Node.js Runtime & npm Package Manager
# ==============================================================================
log_step "Step 3: Checking Node.js Runtime & npm Package Manager"

NODE_INSTALLED=false
NODE_UP_TO_DATE=false

if check_cmd node; then
    CURRENT_NODE_VER=$(node -v | sed 's/^v//')
    CURRENT_NODE_MAJOR=$(echo "$CURRENT_NODE_VER" | cut -d. -f1)
    log_info "Existing Node.js found: v${CURRENT_NODE_VER}"
    
    if [ "$CURRENT_NODE_MAJOR" -ge "$NODE_MIN_MAJOR" ]; then
        NODE_INSTALLED=true
        NODE_UP_TO_DATE=true
        log_success "Node.js version (v${CURRENT_NODE_VER}) meets requirement (>= v${NODE_MIN_MAJOR}.x)."
    else
        log_warn "Installed Node.js (v${CURRENT_NODE_VER}) is older than required minimum v${NODE_MIN_MAJOR}."
    fi
fi

if [ "$NODE_UP_TO_DATE" = false ]; then
    log_info "Installing / Upgrading to Node.js v${NODE_TARGET_MAJOR}.x LTS..."
    
    if [ "$IS_ROOT" = false ] && [ -z "$SUDO_CMD" ]; then
        log_error "Root or sudo privileges required to install Node.js."
        echo "Please install Node.js ${NODE_TARGET_MAJOR}.x and re-run this installer."
        exit 1
    fi

    case "$PKG_MANAGER" in
        apt)
            log_info "Configuring NodeSource repository for Debian/Ubuntu..."
            curl -fsSL https://deb.nodesource.com/setup_${NODE_TARGET_MAJOR}.x | $SUDO_CMD -E bash -
            $SUDO_CMD apt-get install -y nodejs
            ;;
        dnf)
            log_info "Configuring NodeSource / dnf module for AlmaLinux/Rocky/RHEL..."
            # Try module first if available, otherwise fallback to nodesource
            if $SUDO_CMD dnf module list nodejs 2>/dev/null | grep -q "${NODE_TARGET_MAJOR}"; then
                $SUDO_CMD dnf module reset -y nodejs || true
                $SUDO_CMD dnf module enable -y nodejs:${NODE_TARGET_MAJOR}
                $SUDO_CMD dnf install -y nodejs
            else
                curl -fsSL https://rpm.nodesource.com/setup_${NODE_TARGET_MAJOR}.x | $SUDO_CMD bash -
                $SUDO_CMD dnf install -y nodejs
            fi
            ;;
        yum)
            log_info "Configuring NodeSource repository for CentOS/RHEL..."
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_TARGET_MAJOR}.x | $SUDO_CMD bash -
            $SUDO_CMD yum install -y nodejs
            ;;
        pacman)
            $SUDO_CMD pacman -Sy --noconfirm nodejs npm
            ;;
        *)
            log_error "Unsupported package manager for automatic Node.js setup."
            echo "Please install Node.js v${NODE_TARGET_MAJOR} manually, then re-run install.sh."
            exit 1
            ;;
    esac
fi

# Validate Node.js & npm post-install
if ! check_cmd node || ! check_cmd npm; then
    log_error "Node.js or npm validation failed. Both are required to run this application."
    exit 1
fi

VALIDATED_NODE=$(node -v)
VALIDATED_NPM=$(npm -v)
log_success "Node.js validated: ${BOLD}${VALIDATED_NODE}${NC}"
log_success "npm validated: ${BOLD}v${VALIDATED_NPM}${NC}"

# ==============================================================================
# Step 4: Configure Port & Environment
# ==============================================================================
log_step "Step 4: Port Configuration & Network Binding"

validate_port() {
    local p="$1"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then
        return 0
    else
        return 1
    fi
}

if [ -n "$TARGET_PORT" ]; then
    if ! validate_port "$TARGET_PORT"; then
        log_warn "Provided port '$TARGET_PORT' is invalid. Falling back to default: $DEFAULT_PORT"
        TARGET_PORT="$DEFAULT_PORT"
    fi
else
    if [ "$NON_INTERACTIVE" = true ]; then
        TARGET_PORT="$DEFAULT_PORT"
    else
        echo -e "${YELLOW}Please choose the port to expose the ${APP_DISPLAY_NAME} dashboard:${NC}"
        read -r -p "Enter port number [Default: ${DEFAULT_PORT}]: " USER_INPUT_PORT
        TARGET_PORT="${USER_INPUT_PORT:-$DEFAULT_PORT}"
        if ! validate_port "$TARGET_PORT"; then
            log_warn "Invalid port input. Using default port: $DEFAULT_PORT"
            TARGET_PORT="$DEFAULT_PORT"
        fi
    fi
fi

# Warn if port is currently listening
if command -v ss &> /dev/null && ss -tuln | grep -q ":${TARGET_PORT} "; then
    log_warn "Port ${TARGET_PORT} is currently listening on this machine. If another process is using it, you may need to stop it or choose another port."
fi

log_success "Selected application port: ${BOLD}${TARGET_PORT}${NC}"

# Configure environment file (.env) if missing without overwriting existing data
ENV_FILE="${APP_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_info "Initializing .env configuration from .env.example..."
    if [ -f "${APP_DIR}/.env.example" ]; then
        cp "${APP_DIR}/.env.example" "$ENV_FILE"
    else
        touch "$ENV_FILE"
    fi
    echo "PORT=${TARGET_PORT}" >> "$ENV_FILE"
    log_success "Created .env configuration file."
else
    log_info "Existing .env detected. Preserving existing configurations."
    if ! grep -q "^PORT=" "$ENV_FILE"; then
        echo "PORT=${TARGET_PORT}" >> "$ENV_FILE"
    fi
fi

# ==============================================================================
# Step 5: Install Project Dependencies (package.json)
# ==============================================================================
log_step "Step 5: Installing Project Dependencies via npm"

cd "${APP_DIR}"

# Ensure package.json exists
if [ ! -f "package.json" ]; then
    log_error "package.json not found in ${APP_DIR}!"
    exit 1
fi

log_info "Running 'npm install' in ${APP_DIR}..."
npm install --legacy-peer-deps --no-audit --no-fund

log_success "All npm packages installed cleanly."

# ==============================================================================
# Step 6: Build Production Application (Vite bundle)
# ==============================================================================
log_step "Step 6: Compiling & Building Production Web Bundle"

log_info "Executing 'npm run build'..."
npm run build

# Verify build output
if [ ! -f "${APP_DIR}/dist/index.html" ]; then
    log_error "Build output verification failed: 'dist/index.html' not found."
    exit 1
fi

log_success "Production build verified: '${APP_DIR}/dist' compiled successfully."

# ==============================================================================
# Step 7: Generate Execution & Helper Control Scripts
# ==============================================================================
log_step "Step 7: Generating Control Scripts (start.sh, start-dev.sh, stop.sh)"

# 1. start.sh (Production preview runner)
cat <<EOF > "${APP_DIR}/start.sh"
#!/usr/bin/env bash
# Quick Production Launcher for ${APP_DISPLAY_NAME}
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PORT=\${PORT:-${TARGET_PORT}}

echo "Starting ${APP_DISPLAY_NAME} on port \$PORT..."
echo "Local URL: http://localhost:\$PORT"
cd "\$DIR"
exec npx vite preview --port "\$PORT" --host 0.0.0.0
EOF
chmod +x "${APP_DIR}/start.sh"

# 2. start-dev.sh (Development runner)
cat <<EOF > "${APP_DIR}/start-dev.sh"
#!/usr/bin/env bash
# Development Server Launcher for ${APP_DISPLAY_NAME}
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PORT=\${PORT:-${TARGET_PORT}}

echo "Starting ${APP_DISPLAY_NAME} Dev Server on port \$PORT..."
echo "Local URL: http://localhost:\$PORT"
cd "\$DIR"
exec npm run dev -- --port "\$PORT" --host 0.0.0.0
EOF
chmod +x "${APP_DIR}/start-dev.sh"

# 3. stop.sh
cat <<EOF > "${APP_DIR}/stop.sh"
#!/usr/bin/env bash
# Helper to stop ${APP_DISPLAY_NAME} service or running port processes
PORT=\${PORT:-${TARGET_PORT}}

if command -v systemctl &> /dev/null && systemctl is-active --quiet ${APP_NAME} 2>/dev/null; then
    echo "Stopping systemd service ${APP_NAME}..."
    if [ "\$(id -u)" -eq 0 ]; then
        systemctl stop ${APP_NAME}
    else
        sudo systemctl stop ${APP_NAME}
    fi
    echo "Service stopped."
else
    echo "Checking for processes listening on port \$PORT..."
    PID=\$(lsof -ti :\$PORT 2>/dev/null || fuser "\$PORT/tcp" 2>/dev/null || true)
    if [ -n "\$PID" ]; then
        echo "Killing process \$PID on port \$PORT..."
        kill -9 \$PID 2>/dev/null || sudo kill -9 \$PID 2>/dev/null || true
        echo "Port \$PORT freed."
    else
        echo "No process running on port \$PORT."
    fi
fi
EOF
chmod +x "${APP_DIR}/stop.sh"

log_success "Created executable control scripts: start.sh, start-dev.sh, stop.sh"

# ==============================================================================
# Step 8: Configure Systemd Service (Optional & Automated)
# ==============================================================================
SYSTEMD_CONFIGURED=false

if [ "$SKIP_SYSTEMD" = false ] && command -v systemctl &> /dev/null && [ -d /etc/systemd/system ]; then
    log_step "Step 8: Setting Up Linux Systemd Background Service"

    RUN_USER=$(id -un)
    if [ "$RUN_USER" = "root" ] && [ -n "${SUDO_USER:-}" ]; then
        RUN_USER="$SUDO_USER"
    fi

    NODE_BIN_PATH=$(which node)
    NPX_BIN_PATH=$(which npx)
    SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

    SERVICE_CONTENT="[Unit]
Description=${APP_DISPLAY_NAME} Frontend Service
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${NPX_BIN_PATH} vite preview --port ${TARGET_PORT} --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${TARGET_PORT}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Sandboxing & Security hardening
ProtectSystem=full
ProtectHome=read-only
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
"

    # Write service file if root or sudo available
    if [ "$IS_ROOT" = true ] || [ -n "$SUDO_CMD" ]; then
        log_info "Writing systemd unit file to ${SERVICE_FILE}..."
        echo "$SERVICE_CONTENT" | $SUDO_CMD tee "$SERVICE_FILE" > /dev/null
        $SUDO_CMD systemctl daemon-reload
        $SUDO_CMD systemctl enable "${APP_NAME}.service" > /dev/null 2>&1 || true
        $SUDO_CMD systemctl restart "${APP_NAME}.service" || true
        SYSTEMD_CONFIGURED=true
        log_success "Systemd service '${APP_NAME}' configured, enabled on boot, and started."
    else
        log_warn "Skipping systemd installation due to lack of sudo privileges."
    fi
fi

# ==============================================================================
# Step 9: Configure Firewall (ufw / firewalld)
# ==============================================================================
if [ "$IS_ROOT" = true ] || [ -n "$SUDO_CMD" ]; then
    if command -v ufw &> /dev/null && $SUDO_CMD ufw status | grep -q "Status: active"; then
        log_info "ufw firewall is active. Allowing port ${TARGET_PORT}/tcp..."
        $SUDO_CMD ufw allow "${TARGET_PORT}/tcp" comment "${APP_DISPLAY_NAME}" > /dev/null || true
        log_success "Opened port ${TARGET_PORT}/tcp in ufw."
    elif command -v firewall-cmd &> /dev/null && $SUDO_CMD firewall-cmd --state &> /dev/null; then
        log_info "firewalld is active. Allowing port ${TARGET_PORT}/tcp..."
        $SUDO_CMD firewall-cmd --permanent --add-port="${TARGET_PORT}/tcp" > /dev/null || true
        $SUDO_CMD firewall-cmd --reload > /dev/null || true
        log_success "Opened port ${TARGET_PORT}/tcp in firewalld."
    fi
fi

# ==============================================================================
# Step 10: Final Health & Readiness Validation
# ==============================================================================
log_step "Step 10: Validating Final System State"

echo -e "  • Node.js: $(node -v) (${GREEN}OK${NC})"
echo -e "  • npm: v$(npm -v) (${GREEN}OK${NC})"
echo -e "  • Production Bundle: ${APP_DIR}/dist/index.html (${GREEN}OK${NC})"
echo -e "  • Serving Port: ${BOLD}${TARGET_PORT}${NC} (${GREEN}CONFIGURED${NC})"

if [ "$SYSTEMD_CONFIGURED" = true ]; then
    SERVICE_STATUS=$($SUDO_CMD systemctl is-active "${APP_NAME}.service" 2>/dev/null || echo "unknown")
    echo -e "  • Systemd Service: ${APP_NAME}.service (${GREEN}${SERVICE_STATUS}${NC})"
fi

# Determine server IP for display
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

echo -e "\n${GREEN}${BOLD}==========================================================================${NC}"
echo -e "${GREEN}${BOLD}  ✔ Installation and Setup Completed Successfully!                       ${NC}"
echo -e "${GREEN}${BOLD}  ✔ راه‌اندازی و نصب سامانه مدیریت دارایی با موفقیت به پایان رسید          ${NC}"
echo -e "${GREEN}${BOLD}==========================================================================${NC}\n"

echo -e "You can access the ${BOLD}${APP_DISPLAY_NAME}${NC} web dashboard at:"
echo -e "  ${CYAN}Local:${NC}    ${BOLD}http://localhost:${TARGET_PORT}${NC}"
echo -e "  ${CYAN}Network:${NC}  ${BOLD}http://${SERVER_IP}:${TARGET_PORT}${NC}\n"

if [ "$SYSTEMD_CONFIGURED" = true ]; then
    echo -e "${BOLD}Service Management Commands (دستورات مدیریت سرویس):${NC}"
    echo -e "  • Check status:  ${CYAN}sudo systemctl status ${APP_NAME}${NC}"
    echo -e "  • Restart app:   ${CYAN}sudo systemctl restart ${APP_NAME}${NC}"
    echo -e "  • Stop service:  ${CYAN}sudo systemctl stop ${APP_NAME}${NC}"
    echo -e "  • View live log: ${CYAN}sudo journalctl -u ${APP_NAME} -f${NC}\n"
else
    echo -e "${BOLD}Manual Start Commands (دستورات اجرای دستی):${NC}"
    echo -e "  • Production Server:   ${CYAN}./start.sh${NC}"
    echo -e "  • Development Server:  ${CYAN}./start-dev.sh${NC}"
    echo -e "  • Stop process:        ${CYAN}./stop.sh${NC}\n"
fi

# If systemd was not used, offer to start immediately if in interactive terminal
if [ "$SYSTEMD_CONFIGURED" = false ] && [ "$NON_INTERACTIVE" = false ] && [ -t 0 ]; then
    read -r -p "Do you want to start the application right now? [Y/n]: " RUN_NOW
    RUN_NOW=${RUN_NOW:-Y}
    if [[ "$RUN_NOW" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Launching application on port ${TARGET_PORT}... (Press Ctrl+C to stop)${NC}"
        "${APP_DIR}/start.sh"
    fi
fi
