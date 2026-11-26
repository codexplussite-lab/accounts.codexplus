# aaPanel Production Deployment & CI/CD Pipeline Guide

This guide provides step-by-step instructions for deploying the **Enterprise Accounting & Inventory ERP** to an **aaPanel** Linux server using **Node.js Project Manager / PM2**, **Nginx**, and setting up automated CI/CD webhooks.

---

## 1. System Requirements & aaPanel Setup

### aaPanel Software Store Requirements
Ensure the following packages are installed from aaPanel's App Store:
1. **Nginx** (1.22+ or 1.24+)
2. **Node.js Version Manager** (or PM2 Manager)
   - Install **Node.js v20.x LTS**
   - In Node.js Version Manager, install global packages: `pnpm`, `pm2`, `typescript`
3. **PostgreSQL Manager** (or use managed PostgreSQL / Neon DB)
4. **Webhook** (Optional, for auto-deployment on git push)

---

## 2. Directory Structure on aaPanel

Clone or extract the repository under your website root (e.g. `/www/wwwroot/accounts.codexplus`):

```text
/www/wwwroot/accounts.codexplus/
├── backend/            # Express REST API (Port 4000)
├── frontend/           # Next.js Web App (Port 3000)
├── docs/               # Documentation & Reports
├── ecosystem.config.cjs # PM2 ecosystem file
└── .github/workflows/  # CI/CD workflows
```

---

## 3. Environment Variables Configuration

### A. Backend (`backend/.env`)
Create `/www/wwwroot/accounts.codexplus/backend/.env`:
```env
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/neondb?sslmode=require"
JWT_ACCESS_SECRET="GENERATE_A_64_CHAR_RANDOM_HEX_STRING"
JWT_REFRESH_SECRET="GENERATE_A_SECOND_64_CHAR_RANDOM_HEX_STRING"
CORS_ORIGIN="https://accounts.yourdomain.com"
```

### B. Frontend (`frontend/.env.local`)
Create `/www/wwwroot/accounts.codexplus/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL="https://accounts.yourdomain.com/api"
```

---

## 4. Initial Installation & Build

Open terminal in aaPanel and run:

```bash
cd /www/wwwroot/accounts.codexplus

# 1. Install & Build Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# 2. Install & Build Frontend
cd ../frontend
npm install
npm run build
```

---

## 5. Starting Processes with PM2 (aaPanel)

You can manage both services using the provided `ecosystem.config.cjs`:

```bash
cd /www/wwwroot/accounts.codexplus

# Start both services
pm2 start ecosystem.config.cjs

# Save PM2 state to survive server reboots
pm2 save
pm2 startup
```

Alternatively, in aaPanel **Node.js Project Manager**:
1. Add Project 1:
   - Name: `accounting-backend`
   - Path: `/www/wwwroot/accounts.codexplus/backend`
   - Run command: `npm run start` or `node dist/server.js`
   - Port: `4000`
2. Add Project 2:
   - Name: `accounting-frontend`
   - Path: `/www/wwwroot/accounts.codexplus/frontend`
   - Run command: `npm run start`
   - Port: `3000`

---

## 6. aaPanel Nginx Reverse Proxy Configuration

In aaPanel -> **Website** -> Select your domain (e.g. `accounts.yourdomain.com`) -> **Config** / **Reverse Proxy**:

Edit your Nginx configuration to route traffic cleanly:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name accounts.yourdomain.com;

    # SSL Configuration (configure via aaPanel SSL tab / Let's Encrypt)
    # ssl_certificate ...
    # ssl_certificate_key ...

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Backend API Routing
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # Backend Health Check
    location /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend Next.js Web Application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 7. Automated Deployment Pipeline (aaPanel Webhook)

To automatically deploy every time you push code to GitHub:
1. In aaPanel, install the **Webhook** app from App Store.
2. Add a Webhook:
   - Name: `deploy-accounting-erp`
   - Shell Script:
     ```bash
     #!/bin/bash
     echo "Starting Accounting ERP Deployment..."
     cd /www/wwwroot/accounts.codexplus

     # Pull latest tested code
     git pull origin main

     # Update Backend
     cd backend
     npm install --production=false
     npx prisma generate
     npx prisma migrate deploy
     npm run build

     # Update Frontend
     cd ../frontend
     npm install
     npm run build

     # Restart Services via PM2
     cd /www/wwwroot/accounts.codexplus
     pm2 reload ecosystem.config.cjs --update-env

     echo "Deployment completed successfully at $(date)!"
     ```
3. Copy the generated Webhook URL from aaPanel.
4. In GitHub -> Repository -> **Settings** -> **Webhooks** -> **Add webhook**:
   - Payload URL: Paste the aaPanel Webhook URL
   - Content type: `application/json`
   - Which events: `Just the push event`
   - Active: checked
5. Click **Add webhook**. Now every git push automatically pulls, migrates, builds, and reloads PM2 with zero downtime!
