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

export const app = express();

// Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Company-Id"]
  })
);

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

// Health Check Endpoint (Section 8 Acceptance Criteria)
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptime: process.uptime()
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
