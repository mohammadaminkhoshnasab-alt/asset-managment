# IT Asset Management System — Production Installation & Deployment Guide

This document provides complete, production-grade instructions for installing, configuring, and deploying the **IT Asset Management** panel on a Linux VPS or dedicated server.

---

## 1. System Requirements & Compatibility

### Supported Linux Distributions
- **Ubuntu**: 20.04 LTS, 22.04 LTS, 24.04 LTS
- **Debian**: 11 (Bullseye), 12 (Bookworm)
- **AlmaLinux**: 8.x, 9.x
- **Rocky Linux**: 8.x, 9.x
- **RHEL / CentOS Stream**: 8, 9
- **Fedora / Arch Linux** (Generic package manager support)

### Hardware Requirements
| Resource | Minimum | Recommended |
| :--- | :--- | :--- |
| **CPU** | 1 vCPU / Core | 2 vCPUs |
| **RAM** | 1 GB | 2 GB+ |
| **Disk Space** | 1.5 GB free | 5 GB+ |
| **Network** | Inbound TCP access on configured port (Default: `3000`) |

### Software Prerequisites (Handled automatically by `install.sh`)
- **Node.js**: `v20.x LTS` (or `v18.x+` minimum)
- **npm**: `v9.x+` or `v10.x+`
- **System Utilities**: `curl`, `git`, `tar`, `ca-certificates`, `gcc/make`, `procps`, `lsof`

---

## 2. Automated Step-by-Step Installation (Recommended)

The installation script (`install.sh`) executes **17 clearly numbered steps** with real-time progress percentages, comprehensive error handling, and unified logging to `/var/log/itam-install.log`:

```
[Step 1/17]  [6%]   Detect Linux Distribution & Version
[Step 2/17]  [12%]  Check System CPU Architecture & Memory
[Step 3/17]  [18%]  Check Root & Sudo Permissions
[Step 4/17]  [24%]  Check Internet Connectivity
[Step 5/17]  [30%]  Update System Package Index (apt / dnf / yum)
[Step 6/17]  [36%]  Install Required System Dependencies
[Step 7/17]  [42%]  Install Compatible Node.js & npm (v20 LTS)
[Step 8/17]  [48%]  Install Project Dependencies via npm
[Step 9/17]  [54%]  Configure Environment Variables (.env)
[Step 10/17] [60%]  Configure Server IP Address (Public / Local)
[Step 11/17] [66%]  Configure Application Network Port
[Step 12/17] [72%]  Build Production Web Bundle via Vite (dist/)
[Step 13/17] [78%]  Create Dedicated Linux System User (itam)
[Step 14/17] [84%]  Configure Systemd Background Daemon Service
[Step 15/17] [90%]  Start Application Service (systemctl)
[Step 16/17] [95%]  Verify Application Health & HTTP Connectivity
[Step 17/17] [100%] Display Installation Results & Dashboard URLs
```

### Quick Start (Single Command)

```bash
# 1. Clone the repository
git clone https://github.com/mohammadaminkhoshnasab-alt/asset-managment.git
cd asset-managment

# 2. Run the automated installer
bash install.sh
```

During execution, simply type your preferred port number or press **Enter** to accept default port `3000`:
```text
Enter port number [Default: 3000]: 8080
```

---

## 3. Unattended / Automated CLI Installation

For headless environments, Docker containers, Cloud-Init scripts, or CI/CD pipelines, `install.sh` supports non-interactive execution with arguments:

```bash
# Install with a custom port non-interactively
bash install.sh --port 8080 --yes

# Install without configuring systemd
bash install.sh -p 3000 --skip-systemd -y
```

### Command-Line Arguments Reference

| Flag | Long Option | Description | Default |
| :--- | :--- | :--- | :--- |
| `-p` | `--port <PORT>` | Network port to serve the web application | `3000` |
| `-y` | `--yes` | Run non-interactively without user prompts | `false` |
| | `--skip-systemd` | Skip creating or starting the systemd service | `false` |
| `-h` | `--help` | Display script help and exit | |

---

## 4. Node.js Installation & Root Cause Fix

### Previous Issue
Older scripts failed with:
```text
install.sh: line 262: -E: command not found
curl: Failed writing body
Installation failed with error code 127.
```

### Root Cause & Resolution
When running as root, `$SUDO_CMD` evaluated to an empty string (`""`), turning `$SUDO_CMD -E bash -` into the invalid command `-E bash -`. 

**The Fix Implemented in `install.sh`:**
1. A robust `run_root` function was added that executes commands directly when running as root and prepends `sudo` only when running as an unprivileged user.
2. The NodeSource setup script is downloaded safely to a temporary file (`mktemp`) with curl verification, eliminating broken pipe issues.
3. Node.js version is verified immediately after installation. If already present and `>= v18.x`, existing installations are preserved.

---

## 5. Systemd Background Service Management

When installed, the application runs continuously as the service `itam.service` under the dedicated system user `itam`.

### Service Control Commands

| Task | Command |
| :--- | :--- |
| **Check service status** | `sudo systemctl status itam` |
| **Start service** | `sudo systemctl start itam` |
| **Stop service** | `sudo systemctl stop itam` |
| **Restart service** | `sudo systemctl restart itam` |
| **Enable on boot** | `sudo systemctl enable itam` |
| **Disable on boot** | `sudo systemctl disable itam` |
| **View live logs** | `sudo journalctl -u itam -f` |

### Systemd Unit File Configuration (`/etc/systemd/system/itam.service`)
```ini
[Unit]
Description=IT Asset Management Service
After=network.target

[Service]
Type=simple
User=itam
WorkingDirectory=/path/to/asset-managment
ExecStart=/usr/bin/npx vite preview --port 3000 --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itam

# Security Hardening
LimitNOFILE=65535
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
```

---

## 6. Firewall Configuration

Ensure your server allows inbound traffic on the selected port.

### Using UFW (Ubuntu / Debian)
```bash
sudo ufw allow 3000/tcp comment "IT Asset Management"
sudo ufw reload
```

### Using Firewalld (AlmaLinux / Rocky / RHEL)
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 7. Production Nginx Reverse Proxy with HTTPS (Optional)

In enterprise production deployments, it is best practice to place **Nginx** in front of the application to terminate SSL/TLS (HTTPS) on port 443 and proxy requests to port 3000.

### Step 7.1: Install Nginx
- **Ubuntu / Debian**: `sudo apt install -y nginx certbot python3-certbot-nginx`
- **AlmaLinux / Rocky**: `sudo dnf install -y nginx certbot python3-certbot-nginx`

### Step 7.2: Create Nginx Site Configuration

Create `/etc/nginx/conf.d/itam.conf` (or `/etc/nginx/sites-available/itam.conf`):

```nginx
server {
    listen 80;
    server_name assets.company.com;  # Replace with your domain or server IP

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7.3: Issue Free SSL Certificate (Let's Encrypt)
```bash
sudo certbot --nginx -d assets.company.com
```

---

## 8. Troubleshooting & FAQ

### Issue: Port already in use
**Symptom**: Error stating `listen EADDRINUSE: address already in use :::3000`.
**Solution**:
1. Check what process is listening on the port:
   ```bash
   sudo ss -tulpn | grep :3000
   ```
2. Either stop the competing process or run `install.sh` with a different port:
   ```bash
   bash install.sh -p 8080 -y
   ```

### Issue: Low memory during build on small VPS (512MB - 1GB RAM)
**Symptom**: `npm run build` exits with `JavaScript heap out of memory` or `Killed`.
**Solution**: Create a 2GB swap file:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Issue: Diagnostic Log Inspection
The installer writes full execution logs to `/var/log/itam-install.log` (or `./install.log`). Inspect with:
```bash
cat /var/log/itam-install.log | tail -n 50
```
