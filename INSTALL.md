# IT Asset Management System — Production Installation & Deployment Guide

This document provides complete, production-grade instructions for installing, configuring, and deploying the **IT Asset Management** panel on a Linux server.

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
- **System Utilities**: `curl`, `git`, `tar`, `ca-certificates`, `gcc/make`

---

## 2. Automated Installation (Recommended)

The repository includes a self-contained, idempotent installation script (`install.sh`) that:
1. Detects your Linux distribution and package manager (`apt`, `dnf`, `yum`, `pacman`).
2. Checks whether required tools are already installed to avoid duplicate package downloads.
3. Configures and installs Node.js 20 LTS if missing or outdated.
4. Interactively prompts for your chosen port (or accepts command-line flags).
5. Installs project npm packages safely (`npm install --legacy-peer-deps`).
6. Compiles the production bundle via Vite (`dist/`).
7. Sets up and enables a Linux `systemd` daemon service for background execution and automatic reboot recovery.
8. Automatically opens the designated port in `ufw` or `firewalld` if active.

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

## 4. Manual Step-by-Step Installation

If you prefer to install dependencies manually without using `install.sh`:

### Step 4.1: Install Node.js 20 LTS

#### On Ubuntu / Debian:
```bash
sudo apt update && sudo apt install -y curl ca-certificates git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### On AlmaLinux / Rocky Linux / RHEL:
```bash
sudo dnf install -y curl ca-certificates git gcc-c++ make
# Enable Node.js 20 module or NodeSource:
sudo dnf module reset -y nodejs || true
sudo dnf module enable -y nodejs:20 || (curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -)
sudo dnf install -y nodejs
```

Verify the installation:
```bash
node -v   # Expected: v20.x.x
npm -v    # Expected: 10.x.x
```

### Step 4.2: Clone & Install Dependencies
```bash
git clone https://github.com/mohammadaminkhoshnasab-alt/asset-managment.git
cd asset-managment

# Install application dependencies
npm install --legacy-peer-deps
```

### Step 4.3: Build Production Bundle
```bash
npm run build
# Verified output should exist at ./dist/index.html
```

### Step 4.4: Launch the Server
To run directly in terminal on port `3000`:
```bash
npx vite preview --port 3000 --host 0.0.0.0
```

---

## 5. Systemd Background Service Management

When installed with `systemd` enabled, the application runs continuously as the service `itam.service`.

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
Description=IT Asset Management Frontend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/asset-managment
ExecStart=/usr/bin/npx vite preview --port 3000 --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itam

# Hardening
ProtectSystem=full
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

After modifying the service file:
```bash
sudo systemctl daemon-reload
sudo systemctl restart itam
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

Certbot will automatically configure HTTPS redirects and automated certificate renewals.

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

### Issue: Permission denied running `install.sh`
**Solution**: Grant executable permissions to the script:
```bash
chmod +x install.sh
./install.sh
```

### Issue: SELinux blocking network connection on AlmaLinux / Rocky Linux
**Symptom**: Cannot connect via Nginx reverse proxy.
**Solution**: Allow Nginx to connect to network upstream ports:
```bash
sudo setsebool -P httpd_can_network_connect 1
```

---

## 9. Verification Checklist

To confirm your installation is production-ready:

- [ ] `node -v` outputs `v20.x` or higher.
- [ ] `npm -v` outputs `v9.x` or higher.
- [ ] `dist/index.html` exists and was compiled by `npm run build`.
- [ ] `./start.sh` or `systemctl status itam` indicates active listening on the configured port.
- [ ] Accessing `http://<SERVER_IP>:<PORT>` loads the IT Asset Management dashboard in the browser.
- [ ] Light / Dark mode toggle operates smoothly.
- [ ] Excel import preview functions correctly.
