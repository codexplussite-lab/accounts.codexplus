import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";

export const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

// Health Check Endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

// API Base route placeholder
app.get("/api", (_req: Request, res: Response) => {
  res.status(200).json({
    data: {
      name: "Enterprise Accounting & Inventory ERP API",
      version: "1.0.0",
      status: "running"
    }
  });
});

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found"
    }
  });
});

// Global Error Handler conforming to API conventions
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const isDev = env.NODE_ENV === "development";
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: err.message || "An unexpected error occurred",
      ...(isDev ? { stack: err.stack } : {})
    }
  });
});

