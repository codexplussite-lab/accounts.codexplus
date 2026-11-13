# PRODUCTION DEPLOYMENT GUIDE: ALL-IN-ONE ACCOUNTING & INVENTORY ERP

This guide provides step-by-step instructions for deploying the enterprise-grade Accounting & Inventory ERP across production infrastructure.

---

## 1. System Architecture Overview

The system is organized as a clean two-folder monorepo:
- **`backend/`**: Node.js + Express + TypeScript + Prisma ORM. Runs on port `4000`.
- **`frontend/`**: Next.js 14 App Router + Tailwind CSS + shadcn/ui. Runs on port `3000`.
- **Primary Database**: Neon Serverless PostgreSQL with pgBouncer connection pooling.
- **Background Worker & Cache**: Redis 7+ for BullMQ job queue (recurring invoices, email notifications, report generation).

---

## 2. Environment Variables Configuration

### 2.1 Backend Environment (`backend/.env`)

| Variable | Description | Example Production Value |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Listening HTTP port | `4000` |
| `DATABASE_URL` | Pooled Neon PostgreSQL connection string (for runtime queries) | `postgresql://user:pass@ep-cool-pooler.neon.tech/accounting_erp?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Direct unpooled Neon connection string (for Prisma migrations) | `postgresql://user:pass@ep-cool.neon.tech/accounting_erp?sslmode=require` |
| `JWT_SECRET` | Secret key for signing 15-minute access tokens (min 32 chars) | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_SECRET` | Secret key for signing 7-day refresh tokens (min 32 chars) | `openssl rand -hex 32` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `CORS_ORIGIN` | Allowed web frontend origin | `https://app.yourdomain.com` |
| `REDIS_URL` | Redis instance connection string | `redis://default:pass@redis-host:6379` |
| `SMTP_HOST` | Outbound email SMTP host | `smtp.sendgrid.net` or `smtp.resend.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | TLS security flag | `false` |
| `SMTP_USER` | SMTP authentication user | `apikey` |
| `SMTP_PASS` | SMTP authentication password / API key | `SG.xxxxxxxx` |
| `SMTP_FROM` | Default invoice sender address | `invoicing@yourdomain.com` |

### 2.2 Frontend Environment (`frontend/.env.local` or Vercel Config)

| Variable | Description | Example Production Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public backend API URL | `https://api.yourdomain.com/api` |
| `NODE_ENV` | Runtime environment | `production` |

---

## 3. Database Setup: Neon PostgreSQL

1. **Create Neon Project**:
   - Create a project on [Neon.tech](https://neon.tech).
   - Create two branches: `main` (Production) and `dev` (Staging).
2. **Retrieve Connection Strings**:
   - In Neon Console, toggle **Connection Pooling** ON to obtain `DATABASE_URL`.
   - Copy the unpooled direct connection URL to `DIRECT_URL`.
3. **Execute Production Schema Migration**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
4. **Apply Immutability Database Rules (Section 1 & Phase 5 Requirement)**:
   Connect to Neon using `psql` or the Neon SQL Editor and execute:
   ```sql
   CREATE OR REPLACE RULE audit_log_no_update AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
   CREATE OR REPLACE RULE audit_log_no_delete AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING;
   ```

---

## 4. Docker Production Deployment

### 4.1 Standalone Docker Container for Backend

Build and run the production image using the multi-stage `backend/Dockerfile`:

```bash
cd backend
docker build -t accounting-erp-backend:latest .
docker run -d \
  --name accounting-backend \
  --restart always \
  -p 4000:4000 \
  --env-file .env \
  accounting-erp-backend:latest
```

The container runs as an unprivileged user (`erpuser`) and features an automated health check at `http://localhost:4000/health`.

### 4.2 Multi-Container Deployment with Docker Compose

For automated on-premise or single-VPS deployment:

```bash
# From workspace root
docker-compose up -d --build
```

This launches:
- `backend`: Express API with health monitoring.
- `redis`: Redis 7 Alpine with persistent disk volume.
- `postgres`: PostgreSQL 16 Alpine fallback instance.
- `mailhog`: Local SMTP capture mailbox on port 8025 (testing).

---

## 5. Cloud Platform Deployments

### 5.1 Backend on Railway / Render / AWS ECS

1. Connect your GitHub repository.
2. Set Root Directory to `backend`.
3. Set Build Command: `npm ci && npx prisma generate && npm run build`.
4. Set Start Command: `npm start` (or `node dist/index.js`).
5. Configure the production environment variables from Section 2.1.
6. Configure health check path: `/health`.

### 5.2 Frontend on Vercel

1. Import the repository into [Vercel](https://vercel.com).
2. Set Root Directory to `frontend`.
3. Select Framework Preset: `Next.js`.
4. Configure Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://api.yourdomain.com/api`
5. Deploy. Vercel will automatically read `frontend/vercel.json` and apply strict HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS).

---

## 6. Pre-Flight Verification & Health Check

Verify API and UI connectivity after deployment:

1. **Backend Health Check**:
   ```bash
   curl -i https://api.yourdomain.com/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-11-13T...",
     "environment": "production",
     "uptime": 124.5
   }
   ```
2. **Register Initial Company & Owner**:
   - Navigate to `https://app.yourdomain.com/register`.
   - Submit user name, company name, email, and password.
   - The transaction atomically provisions:
     1. User record with bcrypt password (cost 12).
     2. Company record with default currency (`PKR`).
     3. `OWNER` membership.
     4. 15 standard Chart of Accounts (Cash, Bank, AR, AP, Inventory, Sales, Capital, etc.).
     5. Default Main Warehouse.
3. **Verify Dashboard**:
   - Log in and verify that the Executive Financial Dashboard loads live ledger balances with zero fake numbers.

---

## 7. Operational Maintenance & Backup Strategy

- **Automated Neon Backups**: Neon maintains continuous WAL-based Point-In-Time-Recovery (PITR) with up to 30 days history.
- **Period Locking**: Finance managers must lock periods after monthly and annual reconciliations via `/settings/fiscal` to prevent retro-active changes.
- **Year-End Closing**: Execute the closing engine at the conclusion of each fiscal year to zero out P&L accounts and roll net profits into Retained Earnings (`3100`).
