# aaPanel Production Deployment & CI/CD Pipeline Guide (`accounts.codexplus.site`)

This guide provides exact step-by-step instructions for deploying the **Enterprise Accounting & Inventory ERP** to **aaPanel** using **MySQL (`accounts_codexplus`)**, **PM2**, **Nginx**, and automated GitHub Webhooks.

---

## 1. aaPanel App Store Requirements
Ensure these packages are installed in aaPanel:
1. **Nginx** (1.22+)
2. **MySQL** (8.0+ or 5.7+)
3. **Node.js Version Manager** (Install **Node.js v20.x LTS**)
4. **PM2 Manager**
5. **Webhook** (for automated Git push deployment)

---

## 2. Database Setup (MySQL)
In aaPanel -> **Databases** -> Add Database:
- **Database Name:** `accounts_codexplus`
- **Username:** `accounts_codexplus`
- **Password:** `<your-mysql-password>`
- **Access Permission:** `Localhost (127.0.0.1)`

---

## 3. Clone Repository on aaPanel
Open aaPanel Terminal and clone into `/www/wwwroot/accounts.codexplus.site`:

```bash
cd /www/wwwroot
git clone https://github.com/codexplussite-lab/accounts.codexplus.git accounts.codexplus.site
cd /www/wwwroot/accounts.codexplus.site
```

---

## 4. Environment Variables Configuration

### A. Backend (`backend/.env`)
Create `/www/wwwroot/accounts.codexplus.site/backend/.env`:
```env
NODE_ENV=production
PORT=4000
DATABASE_URL="mysql://accounts_codexplus:YOUR_MYSQL_PASSWORD@127.0.0.1:3306/accounts_codexplus"
JWT_ACCESS_SECRET="GENERATE_A_64_CHAR_RANDOM_HEX_STRING"
JWT_REFRESH_SECRET="GENERATE_A_SECOND_64_CHAR_RANDOM_HEX_STRING"
CORS_ORIGIN="https://accounts.codexplus.site"
```

### B. Frontend (`frontend/.env.local`)
Create `/www/wwwroot/accounts.codexplus.site/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL="https://accounts.codexplus.site/api"
```

---

## 5. Initial Installation, MySQL Schema Push & Build

Run in aaPanel Terminal:

```bash
# 1. Backend Setup & MySQL Schema Push
cd /www/wwwroot/accounts.codexplus.site/backend
npm install
npx prisma generate
npx prisma db push
npm run build

# 2. Frontend Setup & Production Build
cd /www/wwwroot/accounts.codexplus.site/frontend
npm install
npm run build
```

---

## 6. Start Services with PM2

```bash
cd /www/wwwroot/accounts.codexplus.site
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 7. aaPanel Nginx Reverse Proxy (`accounts.codexplus.site`)

In aaPanel -> **Website** -> Add Site (`accounts.codexplus.site`) -> **SSL** (Enable Let's Encrypt) -> **Config**:

Add these `location` blocks inside the `server { ... }` block:

```nginx
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
```

---

## 8. Automated Deployment Pipeline (aaPanel Webhook)

In aaPanel **Webhook** app, create a webhook with this script:

```bash
#!/bin/bash
echo "Starting Accounting ERP Deployment..."
cd /www/wwwroot/accounts.codexplus.site

git pull origin main

# Update Backend & MySQL Schema
cd backend
npm install
npx prisma generate
npx prisma db push
npm run build

# Update Frontend
cd ../frontend
npm install
npm run build

# Zero-downtime reload
cd /www/wwwroot/accounts.codexplus.site
pm2 reload ecosystem.config.cjs --update-env

echo "Deployment completed at $(date)!"
```
