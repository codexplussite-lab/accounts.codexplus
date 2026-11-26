import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { authRouter } from "./modules/auth/routes.js";
import { companyRouter } from "./modules/companies/routes.js";
import { accountRouter } from "./modules/accounts/routes.js";
import { journalRouter } from "./modules/journal/routes.js";
import contactRouter from "./modules/contacts/routes.js";
import taxRouter from "./modules/taxes/routes.js";
import salesRouter from "./modules/sales/routes.js";
import purchaseRouter from "./modules/purchases/routes.js";
import paymentRouter from "./modules/payments/routes.js";
import inventoryRouter from "./modules/inventory/routes.js";
import reportsRouter from "./modules/reports/routes.js";
import auditRouter from "./modules/audit/routes.js";
import fiscalRouter from "./modules/fiscal/routes.js";
import bankingRouter from "./modules/banking/routes.js";
import userRouter from "./modules/users/routes.js";
import dashboardRouter from "./modules/dashboard/routes.js";
import recurringRouter from "./modules/recurring/routes.js";
import currencyRouter from "./modules/currency/routes.js";
import importRouter from "./modules/import/routes.js";
import approvalRouter from "./modules/approvals/routes.js";
import rateLimit from "express-rate-limit";
import { prisma } from "./config/prisma.js";

export const app = express();

// Security Middleware
app.use(helmet());

const allowedOrigins = [
  env.CORS_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Company-Id"]
  })
);

// Production Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "test" ? 10000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many requests. Please try again later." } }
});
app.use("/api", apiLimiter);

// Body and Cookie Parsing Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware (non-test environments)
if (env.NODE_ENV !== "test") {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, url: req.url }, "Incoming request");
    next();
  });
}

// Health Check Endpoint (Section 8 Acceptance Criteria with Database Health)
app.get("/health", async (_req: Request, res: Response) => {
  let dbStatus = "connected";
  try {
    if (prisma && typeof (prisma as any).$queryRaw === "function") {
      await Promise.race([
        (prisma as any).$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB probe timeout")), 800))
      ]);
    }
  } catch (err: any) {
    dbStatus = "disconnected";
    logger.warn({ error: err.message }, "Database health check probe: disconnected");
  }

  res.status(200).json({
    status: "ok",
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptime: Math.floor(process.uptime())
  });
});

// Mount Phase 1 Modules
app.use("/api/auth", authRouter);
app.use("/api/companies", companyRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/journal", journalRouter);

// Mount Phase 2 Modules
app.use("/api/contacts", contactRouter);
app.use("/api/taxes", taxRouter);
app.use("/api/sales", salesRouter);
app.use("/api/purchases", purchaseRouter);
app.use("/api/payments", paymentRouter);

// Mount Phase 3 Modules
app.use("/api/inventory", inventoryRouter);

// Mount Phase 4 Modules
app.use("/api/reports", reportsRouter);

// Mount Phase 5 Modules
app.use("/api/audit-logs", auditRouter);
app.use("/api/fiscal", fiscalRouter);
app.use("/api/banking", bankingRouter);
app.use("/api/users", userRouter);

// Mount Phase 6 Modules
app.use("/api/dashboard", dashboardRouter);
app.use("/api/recurring", recurringRouter);
app.use("/api/currency", currencyRouter);
app.use("/api/import", importRouter);
app.use("/api/approvals", approvalRouter);

// API Base Information Endpoint
app.get("/api", (_req: Request, res: Response) => {
  res.status(200).json({
    data: {
      name: "Enterprise Accounting & Inventory ERP API",
      version: "1.0.0",
      status: "operational",
      modules: ["auth", "companies", "accounts", "journal", "contacts", "taxes", "sales", "purchases", "payments", "inventory"]
    }
  });
});

// 404 Catch-All Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.path}`
    }
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);
