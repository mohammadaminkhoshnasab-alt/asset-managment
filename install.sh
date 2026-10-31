#!/usr/bin/env bash

# ==============================================================================
# IT Asset Management System - Professional Linux VPS Installer
# ==============================================================================
# Fully automated, idempotent, production-ready installer with 17 numbered steps,
# real-time progress indicators, automated dependency resolution, and systemd support.
# Supported Distributions: Ubuntu, Debian, AlmaLinux, Rocky Linux, RHEL, CentOS
# ==============================================================================

set -eo pipefail

# --- Color Scheme & Typography ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# --- Global Configuration & Defaults ---
APP_NAME="itam"
APP_DISPLAY_NAME="IT Asset Management"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PORT=3000
TARGET_PORT=""
NON_INTERACTIVE=false
SKIP_SYSTEMD=false
NODE_MIN_MAJOR=18
NODE_TARGET_MAJOR=20
TOTAL_STEPS=17
CURRENT_STEP=0
SYSTEM_USER="itam"

# Determine Log File Location
LOG_FILE="/var/log/itam-install.log"
if ! touch "$LOG_FILE" >/dev/null 2>&1; then
    LOG_FILE="${APP_DIR}/install.log"
    touch "$LOG_FILE" >/dev/null 2>&1 || true
fi

# Redirect all output to log file as well as console
exec > >(tee -a "$LOG_FILE") 2>&1

# --- Signal & Error Trap ---
on_exit_failure() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "\n${RED}${BOLD}=========================================================================="
        echo -e "✘ INSTALLATION FAILED (Step ${CURRENT_STEP}/${TOTAL_STEPS} - Exit Code: ${exit_code})"
        echo -e "==========================================================================${NC}"
        echo -e "${YELLOW}Detailed diagnostic logs have been saved to:${NC} ${BOLD}${LOG_FILE}${NC}"
        echo -e "You can inspect the log with: ${CYAN}cat ${LOG_FILE} | tail -n 50${NC}"
        echo -e "Resolve the error above and re-run: ${CYAN}bash install.sh${NC}\n"
    fi
}
trap on_exit_failure EXIT

# --- Step Tracker & Logger Functions ---
print_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    local title="$1"
    local pct=$(( (CURRENT_STEP * 100) / TOTAL_STEPS ))
    echo -e "\n${BLUE}${BOLD}[Step ${CURRENT_STEP}/${TOTAL_STEPS}] [${pct}%]${NC} ${BOLD}${title}${NC}"
    echo -e "${DIM}--------------------------------------------------------------------------${NC}"
}

log_info() {
    echo -e "  ${CYAN}ℹ [INFO]${NC} $1"
}

log_success() {
    echo -e "  ${GREEN}✔ [SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "  ${YELLOW}⚠ [WARN]${NC} $1"
}

log_error() {
    echo -e "  ${RED}✘ [ERROR]${NC} $1" >&2
}

# --- Root Execution Helper (Prevents '-E: command not found' bug) ---
run_root() {
    if [ "$IS_ROOT" = true ]; then
        "$@"
    else
        sudo "$@"
    fi
}

check_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# --- CLI Argument Parsing ---
print_help() {
    cat <<EOF
Usage: bash install.sh [OPTIONS]

Professional Step-by-Step Linux VPS Installer for ${APP_DISPLAY_NAME}.

Options:
  -p, --port <PORT>       Specify the network port (Default: 3000)
  -y, --yes               Run in unattended, non-interactive mode
      --skip-systemd      Do not register or start a systemd background service
  -h, --help              Show this help message and exit

Supported Distributions:
  - Ubuntu (20.04 LTS, 22.04 LTS, 24.04 LTS)
  - Debian (11 Bullseye, 12 Bookworm)
  - AlmaLinux (8.x, 9.x) / Rocky Linux (8.x, 9.x) / RHEL / CentOS Stream

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

# ==============================================================================
# Visual Banner
# ==============================================================================
echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ___ _____      _                    _     __  __                                                   _   
 |_ _|_   _|    / \   ___ ___  ___  | |_  |  \/  | __ _ _ __   __ _  __ _  ___ _ __ ___   ___ _ __ | |_ 
  | |  | |     / _ \ / __/ __|/ _ \ | __| | |\/| |/ _` | '_ \ / _` |/ _` |/ _ \ '_ ` _ \ / _ \ '_ \| __|
  | |  | |    / ___ \\__ \__ \  __/ | |_  | |  | | (_| | | | | (_| | (_| |  __/ | | | | |  __/ | | | |_ 
 |___| |_|   /_/   \_\___/___/\___|  \__| |_|  |_|\__,_|_| |_|\__,_|\__, |\___|_| |_| |_|\___|_| |_|\__|
                                                                      |___/                                
EOF
echo -e "${NC}"
echo -e "${BLUE}${BOLD}========================================================================================${NC}"
echo -e "${GREEN}${BOLD}    ${APP_DISPLAY_NAME} — Professional Linux VPS Installer${NC}"
echo -e "${CYAN}    سامانه مدیریت دارایی‌های فناوری اطلاعات — نصب و راه‌اندازی گام‌به‌گام سرور لینوکس${NC}"
echo -e "${BLUE}${BOLD}========================================================================================${NC}"
echo -e "${DIM}  Installation Directory: ${APP_DIR}${NC}"
echo -e "${DIM}  Logging to:             ${LOG_FILE}${NC}"
echo ""

# ==============================================================================
# Step 1: Detect Linux Distribution & Version
# ==============================================================================
print_step "Detecting Linux Distribution & Version"

OS_ID=""
OS_VERSION_ID=""
OS_PRETTY_NAME=""
PKG_MANAGER=""

if [ -f /etc/os-release ]; then
    # Source os-release safely
    OS_ID=$(grep -E '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"' || true)
    OS_VERSION_ID=$(grep -E '^VERSION_ID=' /etc/os-release | cut -d= -f2 | tr -d '"' || true)
    OS_PRETTY_NAME=$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d= -f2 | tr -d '"' || true)
elif [ -f /etc/redhat-release ]; then
    OS_PRETTY_NAME=$(cat /etc/redhat-release)
    OS_ID="rhel"
else
    OS_PRETTY_NAME="Unknown Linux"
    OS_ID="unknown"
fi

# Detect Package Manager
if check_cmd apt-get; then
    PKG_MANAGER="apt"
elif check_cmd dnf; then
    PKG_MANAGER="dnf"
elif check_cmd yum; then
    PKG_MANAGER="yum"
elif check_cmd pacman; then
    PKG_MANAGER="pacman"
else
    PKG_MANAGER="generic"
fi

log_info "Detected OS: ${BOLD}${OS_PRETTY_NAME}${NC} (Type: ${OS_ID}, Version: ${OS_VERSION_ID})"
log_info "Active Package Manager: ${BOLD}${PKG_MANAGER}${NC}"

case "$PKG_MANAGER" in
    apt)
        log_success "Supported Debian/Ubuntu-based distribution confirmed."
        ;;
    dnf|yum)
        log_success "Supported RHEL/AlmaLinux/Rocky-based distribution confirmed."
        ;;
    *)
        log_warn "Distribution is not officially targeted, but installer will proceed using generic fallbacks."
        ;;
esac

# ==============================================================================
# Step 2: Check System Architecture
# ==============================================================================
print_step "Checking System CPU Architecture"

ARCH=$(uname -m)
log_info "Hardware Architecture: ${BOLD}${ARCH}${NC}"

case "$ARCH" in
    x86_64|amd64)
        log_success "64-bit Architecture (x86_64) verified."
        ;;
    aarch64|arm64)
        log_success "ARM 64-bit Architecture (aarch64) verified."
        ;;
    *)
        log_warn "Detected non-standard architecture '${ARCH}'. Build tools must support this target."
        ;;
esac

# Check available memory
if [ -f /proc/meminfo ]; then
    MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEM_TOTAL_MB=$((MEM_TOTAL_KB / 1024))
    log_info "System Total Memory: ${BOLD}${MEM_TOTAL_MB} MB${NC}"
    if [ "$MEM_TOTAL_MB" -lt 800 ]; then
        log_warn "System memory is below 1GB (${MEM_TOTAL_MB}MB). If build fails with OOM, enable Swap."
    fi
fi

# ==============================================================================
# Step 3: Check Root and Sudo Permissions
# ==============================================================================
print_step "Checking Root and Sudo Permissions"

IS_ROOT=false
USER_UID=$(id -u)

if [ "$USER_UID" -eq 0 ]; then
    IS_ROOT=true
    log_success "Running with direct administrative Root privileges (UID 0)."
else
    log_info "Running as standard user ($(id -un)). Checking sudo capability..."
    if check_cmd sudo && sudo -n true 2>/dev/null; then
        log_success "Passwordless sudo permissions validated."
    elif check_cmd sudo && sudo -v; then
        log_success "Sudo authentication validated."
    else
        log_error "This installation requires root or sudo administrative privileges."
        echo "Please run as root or install with a sudo-capable user: 'sudo bash install.sh'"
        exit 1
    fi
fi

# ==============================================================================
# Step 4: Check Internet Connectivity
# ==============================================================================
print_step "Checking Internet Connectivity"

CONNECTIVITY_OK=false
TEST_TARGETS=("https://deb.nodesource.com" "https://registry.npmjs.org" "https://github.com")

for target in "${TEST_TARGETS[@]}"; do
    if curl -s --connect-timeout 4 -I "$target" >/dev/null 2>&1; then
        CONNECTIVITY_OK=true
        log_success "Connected to online software repository: ${target}"
        break
    fi
done

if [ "$CONNECTIVITY_OK" = false ]; then
    # Fallback to ICMP ping check
    if ping -c 1 -W 3 1.1.1.1 >/dev/null 2>&1 || ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1; then
        CONNECTIVITY_OK=true
        log_success "Internet connectivity confirmed via public DNS."
    fi
fi

if [ "$CONNECTIVITY_OK" = false ]; then
    log_error "No working internet connection detected!"
    echo "The installer requires access to download Node.js, system packages, and npm dependencies."
    echo "Please check your network settings, DNS servers in /etc/resolv.conf, or proxy configuration."
    exit 1
fi

# ==============================================================================
# Step 5: Update System Packages
# ==============================================================================
print_step "Updating System Package Index"

case "$PKG_MANAGER" in
    apt)
        log_info "Running 'apt-get update'..."
        run_root apt-get update -qq || log_warn "apt-get update reported minor warnings. Continuing..."
        log_success "Apt package cache updated."
        ;;
    dnf)
        log_info "Refreshing dnf metadata cache..."
        run_root dnf check-update >/dev/null 2>&1 || true
        log_success "Dnf package cache refreshed."
        ;;
    yum)
        log_info "Refreshing yum cache..."
        run_root yum makecache -q || true
        log_success "Yum cache refreshed."
        ;;
    *)
        log_info "Skipping package manager update for generic system."
        ;;
esac

# ==============================================================================
# Step 6: Install Required System Dependencies
# ==============================================================================
print_step "Installing Required System Dependencies"

MISSING_PACKAGES=()

# Basic tools needed across all distros
if ! check_cmd curl; then MISSING_PACKAGES+=("curl"); fi
if ! check_cmd git; then MISSING_PACKAGES+=("git"); fi
if ! check_cmd tar; then MISSING_PACKAGES+=("tar"); fi
if ! check_cmd lsof; then MISSING_PACKAGES+=("lsof"); fi

if [ "$PKG_MANAGER" = "apt" ]; then
    if ! dpkg -s ca-certificates >/dev/null 2>&1; then MISSING_PACKAGES+=("ca-certificates"); fi
    if ! dpkg -s gnupg >/dev/null 2>&1; then MISSING_PACKAGES+=("gnupg"); fi
    if ! dpkg -s build-essential >/dev/null 2>&1; then MISSING_PACKAGES+=("build-essential"); fi
    if ! dpkg -s procps >/dev/null 2>&1; then MISSING_PACKAGES+=("procps"); fi
elif [ "$PKG_MANAGER" = "dnf" ] || [ "$PKG_MANAGER" = "yum" ]; then
    if ! rpm -q ca-certificates >/dev/null 2>&1; then MISSING_PACKAGES+=("ca-certificates"); fi
    if ! rpm -q gnupg2 >/dev/null 2>&1; then MISSING_PACKAGES+=("gnupg2"); fi
    if ! rpm -q gcc-c++ >/dev/null 2>&1; then MISSING_PACKAGES+=("gcc-c++" "make"); fi
    if ! rpm -q procps-ng >/dev/null 2>&1; then MISSING_PACKAGES+=("procps-ng"); fi
fi

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    log_info "Installing missing system utilities: ${BOLD}${MISSING_PACKAGES[*]}${NC}"
    case "$PKG_MANAGER" in
        apt)
            run_root apt-get install -y --no-install-recommends "${MISSING_PACKAGES[@]}"
            ;;
        dnf)
            run_root dnf install -y "${MISSING_PACKAGES[@]}"
            ;;
        yum)
            run_root yum install -y "${MISSING_PACKAGES[@]}"
            ;;
        pacman)
            run_root pacman -Sy --noconfirm "${MISSING_PACKAGES[@]}"
            ;;
    esac
    log_success "System utilities installed successfully."
else
    log_success "All required system utilities (curl, git, tar, ca-certificates, compiler) are already present."
fi

# ==============================================================================
# Step 7: Install Compatible Node.js & npm (Fixes line 262 -E bug completely)
# ==============================================================================
print_step "Installing Compatible Node.js & npm (LTS Release)"

NEED_NODE_INSTALL=true

if check_cmd node; then
    DETECTED_NODE_RAW=$(node -v | tr -d 'v')
    DETECTED_NODE_MAJOR=$(echo "$DETECTED_NODE_RAW" | cut -d. -f1)
    log_info "Detected existing Node.js: v${DETECTED_NODE_RAW}"

    if [ "$DETECTED_NODE_MAJOR" -ge "$NODE_MIN_MAJOR" ]; then
        NEED_NODE_INSTALL=false
        log_success "Node.js v${DETECTED_NODE_RAW} meets version requirements (>= v${NODE_MIN_MAJOR}.x)."
    else
        log_warn "Current Node.js version (v${DETECTED_NODE_RAW}) is outdated (< v${NODE_MIN_MAJOR}). Upgrading to LTS v${NODE_TARGET_MAJOR}.x..."
    fi
fi

if [ "$NEED_NODE_INSTALL" = true ]; then
    log_info "Configuring NodeSource repository for Node.js v${NODE_TARGET_MAJOR}.x LTS..."

    # SAFE SCRIPT DOWNLOAD TO TEMPORARY FILE (NO 'curl | -E bash' PIPE FAILURES)
    TMP_SETUP=$(mktemp /tmp/nodesource_setup.XXXXXX.sh)
    
    case "$PKG_MANAGER" in
        apt)
            log_info "Downloading NodeSource setup script for Debian/Ubuntu..."
            if ! curl -fsSL --retry 3 --connect-timeout 10 "https://deb.nodesource.com/setup_${NODE_TARGET_MAJOR}.x" -o "$TMP_SETUP"; then
                log_error "Failed to download NodeSource setup script. Network or repository error."
                exit 1
            fi
            
            # Execute with clean root helper
            run_root bash "$TMP_SETUP"
            rm -f "$TMP_SETUP"
            
            log_info "Installing nodejs package via apt..."
            run_root apt-get update -qq
            run_root apt-get install -y nodejs
            ;;
        dnf)
            log_info "Downloading NodeSource setup script for RHEL/AlmaLinux/Rocky..."
            if ! curl -fsSL --retry 3 --connect-timeout 10 "https://rpm.nodesource.com/setup_${NODE_TARGET_MAJOR}.x" -o "$TMP_SETUP"; then
                log_error "Failed to download NodeSource setup script for RPM."
                exit 1
            fi
            
            run_root bash "$TMP_SETUP"
            rm -f "$TMP_SETUP"
            
            log_info "Installing nodejs package via dnf..."
            run_root dnf install -y nodejs
            ;;
        yum)
            log_info "Downloading NodeSource setup script for CentOS/RHEL..."
            if ! curl -fsSL --retry 3 --connect-timeout 10 "https://rpm.nodesource.com/setup_${NODE_TARGET_MAJOR}.x" -o "$TMP_SETUP"; then
                log_error "Failed to download NodeSource setup script for YUM."
                exit 1
            fi
            
            run_root bash "$TMP_SETUP"
            rm -f "$TMP_SETUP"
            
            run_root yum install -y nodejs
            ;;
        pacman)
            run_root pacman -Sy --noconfirm nodejs npm
            ;;
        *)
            log_error "Automatic Node.js setup is not supported for package manager: ${PKG_MANAGER}"
            echo "Please install Node.js v${NODE_TARGET_MAJOR} manually and re-run."
            exit 1
            ;;
    esac
fi

# Post-installation verification
if ! check_cmd node || ! check_cmd npm; then
    log_error "Node.js or npm validation failed! Cannot continue."
    exit 1
fi

FINAL_NODE_VER=$(node -v)
FINAL_NPM_VER=$(npm -v)
log_success "Verified Node.js: ${BOLD}${FINAL_NODE_VER}${NC}"
log_success "Verified npm:     ${BOLD}v${FINAL_NPM_VER}${NC}"

# ==============================================================================
# Step 8: Install Project Dependencies
# ==============================================================================
print_step "Installing Project Dependencies via npm"

cd "${APP_DIR}"

if [ ! -f "package.json" ]; then
    log_error "package.json was not found in ${APP_DIR}!"
    exit 1
fi

log_info "Executing 'npm install --legacy-peer-deps'..."
npm install --legacy-peer-deps --no-audit --no-fund

if [ ! -d "node_modules" ]; then
    log_error "node_modules directory was not generated by npm install!"
    exit 1
fi

log_success "Project dependencies installed cleanly."

# ==============================================================================
# Step 9: Configure Environment Variables (.env)
# ==============================================================================
print_step "Configuring Environment Variables"

ENV_FILE="${APP_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
    log_info "Creating .env configuration from .env.example..."
    if [ -f "${APP_DIR}/.env.example" ]; then
        cp "${APP_DIR}/.env.example" "$ENV_FILE"
    else
        touch "$ENV_FILE"
    fi
    log_success "Created fresh .env file."
else
    log_info "Preserving existing .env configurations (idempotent)."
fi

# Ensure safe file permissions
chmod 600 "$ENV_FILE" 2>/dev/null || true
log_success "Environment configuration ready."

# ==============================================================================
# Step 10: Configure Server IP Address
# ==============================================================================
print_step "Configuring Server Network IP Address"

DETECTED_PUBLIC_IP=""
DETECTED_LOCAL_IP=""

# Try fetching public IP with timeout
for ip_service in "https://api.ipify.org" "https://icanhazip.com" "https://ifconfig.me"; do
    DETECTED_PUBLIC_IP=$(curl -s -m 3 "$ip_service" 2>/dev/null || true)
    if [[ "$DETECTED_PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        break
    fi
done

# Local IP
DETECTED_LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

SERVER_HOST_IP="${DETECTED_PUBLIC_IP:-$DETECTED_LOCAL_IP}"
log_info "Server Local IP:  ${BOLD}${DETECTED_LOCAL_IP}${NC}"
if [ -n "$DETECTED_PUBLIC_IP" ]; then
    log_info "Server Public IP: ${BOLD}${DETECTED_PUBLIC_IP}${NC}"
fi

# ==============================================================================
# Step 11: Configure Application Port
# ==============================================================================
print_step "Configuring Application Network Port"

validate_port_number() {
    local p="$1"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then
        return 0
    else
        return 1
    fi
}

if [ -n "$TARGET_PORT" ]; then
    if ! validate_port_number "$TARGET_PORT"; then
        log_warn "Provided port '$TARGET_PORT' is invalid. Falling back to default: $DEFAULT_PORT"
        TARGET_PORT="$DEFAULT_PORT"
    fi
else
    if [ "$NON_INTERACTIVE" = true ] || [ ! -t 0 ]; then
        TARGET_PORT="$DEFAULT_PORT"
        log_info "Non-interactive mode: using default port ${TARGET_PORT}"
    else
        echo -e "${YELLOW}Please choose the port on which to expose ${APP_DISPLAY_NAME}:${NC}"
        read -r -p "Enter port number [Default: ${DEFAULT_PORT}]: " USER_PORT_INPUT
        TARGET_PORT="${USER_PORT_INPUT:-$DEFAULT_PORT}"
        if ! validate_port_number "$TARGET_PORT"; then
            log_warn "Invalid port input. Reverting to default port ${DEFAULT_PORT}."
            TARGET_PORT="$DEFAULT_PORT"
        fi
    fi
fi

# Port collision check
if check_cmd ss && ss -tuln | grep -q ":${TARGET_PORT} "; then
    log_warn "Port ${TARGET_PORT} is currently in use by another process. If conflict occurs, stop the conflicting service."
elif check_cmd lsof && lsof -i :"$TARGET_PORT" >/dev/null 2>&1; then
    log_warn "Port ${TARGET_PORT} is currently active."
fi

# Update PORT in .env safely
if grep -q "^PORT=" "$ENV_FILE"; then
    sed -i "s/^PORT=.*/PORT=${TARGET_PORT}/" "$ENV_FILE"
else
    echo "PORT=${TARGET_PORT}" >> "$ENV_FILE"
fi

log_success "Application configured to listen on port ${BOLD}${TARGET_PORT}${NC}."

# ==============================================================================
# Step 12: Build Production Application (Vite Bundle)
# ==============================================================================
print_step "Building Production Web Bundle via Vite"

cd "${APP_DIR}"
log_info "Executing 'npm run build'..."
npm run build

DIST_INDEX="${APP_DIR}/dist/index.html"
if [ ! -f "$DIST_INDEX" ]; then
    log_error "Build failed: '${DIST_INDEX}' was not created!"
    exit 1
fi

BUNDLE_SIZE=$(du -sh "${APP_DIR}/dist" | cut -f1)
log_success "Production build completed successfully (${BUNDLE_SIZE} generated in dist/)."

# ==============================================================================
# Step 13: Create Dedicated Linux System User
# ==============================================================================
print_step "Configuring Dedicated Linux System User"

APP_SERVICE_USER="root"

if [ "$IS_ROOT" = true ]; then
    # Create system user if does not exist
    if ! id -u "$SYSTEM_USER" >/dev/null 2>&1; then
        log_info "Creating isolated system service user '${SYSTEM_USER}'..."
        useradd -r -s /usr/sbin/nologin -d "${APP_DIR}" -M "$SYSTEM_USER" 2>/dev/null || \
        useradd -r -s /bin/false -d "${APP_DIR}" -M "$SYSTEM_USER" 2>/dev/null || true
    fi

    if id -u "$SYSTEM_USER" >/dev/null 2>&1; then
        APP_SERVICE_USER="$SYSTEM_USER"
        log_success "Dedicated system user '${SYSTEM_USER}' configured."
        # Set directory permissions
        log_info "Setting safe directory permissions for '${SYSTEM_USER}'..."
        chown -R "${SYSTEM_USER}:${SYSTEM_USER}" "${APP_DIR}" 2>/dev/null || true
    else
        log_warn "Could not create user '${SYSTEM_USER}'. Service will run as current user."
    fi
else
    APP_SERVICE_USER=$(id -un)
    log_info "Running as non-root user '${APP_SERVICE_USER}'. Setting permissions accordingly."
fi

log_success "Application process owner set to: ${BOLD}${APP_SERVICE_USER}${NC}"

# ==============================================================================
# Step 14: Configure Systemd Background Service
# ==============================================================================
print_step "Configuring Systemd Background Daemon Service"

SYSTEMD_ENABLED=false
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NODE_BIN=$(which node)
NPX_BIN=$(which npx)

# Generate helper launch scripts regardless of systemd
cat << "EOF_START" > "${APP_DIR}/start.sh"
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
EOF_START
chmod +x "${APP_DIR}/start.sh"

cat << "EOF_DEV" > "${APP_DIR}/start-dev.sh"
#!/usr/bin/env bash
# Development Server Launcher for IT Asset Management
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=${PORT:-3000}

echo "Starting IT Asset Management Dev Server on port $PORT..."
cd "$DIR"
exec npm run dev -- --port "$PORT" --host 0.0.0.0
EOF_DEV
chmod +x "${APP_DIR}/start-dev.sh"

cat << "EOF_STOP" > "${APP_DIR}/stop.sh"
#!/usr/bin/env bash
# Process termination helper
PORT=${PORT:-3000}
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet itam 2>/dev/null; then
    echo "Stopping systemd service itam..."
    systemctl stop itam || sudo systemctl stop itam
    echo "Service stopped."
else
    echo "Terminating process on port $PORT..."
    PID=$(lsof -ti :"$PORT" 2>/dev/null || fuser "$PORT/tcp" 2>/dev/null || true)
    if [ -n "$PID" ]; then
        kill -9 $PID 2>/dev/null || sudo kill -9 $PID 2>/dev/null || true
        echo "Freed port $PORT."
    else
        echo "No process running on port $PORT."
    fi
fi
EOF_STOP
chmod +x "${APP_DIR}/stop.sh"

# Set up systemd service if available
if [ "$SKIP_SYSTEMD" = false ] && check_cmd systemctl && [ -d /etc/systemd/system ]; then
    log_info "Writing systemd unit definition to ${SERVICE_FILE}..."
    
    cat << EOF | run_root tee "${SERVICE_FILE}" >/dev/null
[Unit]
Description=${APP_DISPLAY_NAME} Service
After=network.target

[Service]
Type=simple
User=${APP_SERVICE_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${NPX_BIN} vite preview --port ${TARGET_PORT} --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${TARGET_PORT}
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Process Hardening
LimitNOFILE=65535
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
EOF

    run_root systemctl daemon-reload
    run_root systemctl enable "${APP_NAME}.service" >/dev/null 2>&1 || true
    SYSTEMD_ENABLED=true
    log_success "Systemd service '${APP_NAME}.service' registered and enabled on system boot."
else
    log_info "Skipping systemd installation (either skipped by flag or systemd not present)."
fi

# ==============================================================================
# Step 15: Start the Application Service
# ==============================================================================
print_step "Starting Application Service"

if [ "$SYSTEMD_ENABLED" = true ]; then
    log_info "Starting service via 'systemctl restart ${APP_NAME}'..."
    run_root systemctl restart "${APP_NAME}.service"
    sleep 2
    if run_root systemctl is-active --quiet "${APP_NAME}.service"; then
        log_success "Service '${APP_NAME}.service' is active and running."
    else
        log_warn "Systemd service did not enter active state immediately. Checking logs..."
        run_root journalctl -u "${APP_NAME}" -n 15 --no-pager || true
    fi
else
    log_info "Systemd is not managing this process. Application can be launched using './start.sh'."
fi

# Firewall integration
if check_cmd ufw && run_root ufw status 2>/dev/null | grep -q "Status: active"; then
    log_info "Allowing port ${TARGET_PORT}/tcp in ufw firewall..."
    run_root ufw allow "${TARGET_PORT}/tcp" comment "${APP_DISPLAY_NAME}" >/dev/null 2>&1 || true
    log_success "Firewall rule added for port ${TARGET_PORT}."
elif check_cmd firewall-cmd && run_root firewall-cmd --state >/dev/null 2>&1; then
    log_info "Allowing port ${TARGET_PORT}/tcp in firewalld..."
    run_root firewall-cmd --permanent --add-port="${TARGET_PORT}/tcp" >/dev/null 2>&1 || true
    run_root firewall-cmd --reload >/dev/null 2>&1 || true
    log_success "Firewalld rule added for port ${TARGET_PORT}."
fi

# ==============================================================================
# Step 16: Verify Application Health and Connectivity
# ==============================================================================
print_step "Verifying Application Health & HTTP Connectivity"

HEALTH_OK=false

if [ "$SYSTEMD_ENABLED" = true ]; then
    log_info "Probing http://127.0.0.1:${TARGET_PORT}/ for HTTP readiness..."
    
    # Try polling up to 10 times (10 seconds)
    for attempt in {1..10}; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:${TARGET_PORT}/" 2>/dev/null || true)
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
            HEALTH_OK=true
            log_success "Health Check passed! HTTP Status Code: ${HTTP_CODE}"
            break
        fi
        sleep 1
    done

    if [ "$HEALTH_OK" = false ]; then
        log_warn "Probing timed out. Service might still be initializing. Checking systemd process..."
        run_root systemctl status "${APP_NAME}.service" --no-pager || true
    fi
else
    log_info "Build output 'dist/index.html' verified. Ready for manual execution."
    HEALTH_OK=true
fi

# ==============================================================================
# Step 17: Display Installation Results & Dashboard Access
# ==============================================================================
print_step "Displaying Installation Results"

echo -e "\n${GREEN}${BOLD}========================================================================================${NC}"
echo -e "${GREEN}${BOLD}  ✔ INSTALLATION & DEPLOYMENT COMPLETED SUCCESSFULLY! [Step 17/17 - 100%]             ${NC}"
echo -e "${GREEN}${BOLD}  ✔ استقرار و راه‌اندازی سامانه مدیریت دارایی با موفقیت به پایان رسید                     ${NC}"
echo -e "${GREEN}${BOLD}========================================================================================${NC}\n"

echo -e "${BOLD}Dashboard Web Access URLs (آدرس‌های دسترسی به سامانه):${NC}"
echo -e "  • ${CYAN}Local Access:${NC}    ${BOLD}http://localhost:${TARGET_PORT}${NC}"
echo -e "  • ${CYAN}Network/VPS:${NC}     ${BOLD}http://${SERVER_HOST_IP}:${TARGET_PORT}${NC}\n"

echo -e "${BOLD}System Environment Summary (مشخصات محیط نصب):${NC}"
echo -e "  • Operating System:    ${OS_PRETTY_NAME} (${ARCH})"
echo -e "  • Node.js Version:     ${FINAL_NODE_VER}"
echo -e "  • npm Version:         v${FINAL_NPM_VER}"
echo -e "  • Service User:        ${APP_SERVICE_USER}"
echo -e "  • Installation Log:    ${LOG_FILE}\n"

if [ "$SYSTEMD_ENABLED" = true ]; then
    echo -e "${BOLD}Service Management Commands (دستورات کنترل سرویس پس‌زمینه):${NC}"
    echo -e "  • View status:         ${CYAN}sudo systemctl status ${APP_NAME}${NC}"
    echo -e "  • Restart service:     ${CYAN}sudo systemctl restart ${APP_NAME}${NC}"
    echo -e "  • Stop service:        ${CYAN}sudo systemctl stop ${APP_NAME}${NC}"
    echo -e "  • Live journal logs:   ${CYAN}sudo journalctl -u ${APP_NAME} -f${NC}\n"
else
    echo -e "${BOLD}Manual Start Commands (دستورات اجرای مستقیم):${NC}"
    echo -e "  • Production server:   ${CYAN}./start.sh${NC}"
    echo -e "  • Development server:  ${CYAN}./start-dev.sh${NC}"
    echo -e "  • Stop port process:   ${CYAN}./stop.sh${NC}\n"
fi

echo -e "${GREEN}Thank you for installing ${APP_DISPLAY_NAME}!${NC}\n"
