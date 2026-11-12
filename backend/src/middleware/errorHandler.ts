import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 400, code: string = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle AppError instances
  if (err instanceof AppError) {
    logger.warn({ path: req.path, code: err.code, message: err.message }, "Operational error occurred");
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      }
    });
    return;
  }

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    logger.warn({ path: req.path, issues: err.issues }, "Validation failed");
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input data",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message
        }))
      }
    });
    return;
  }

  // Handle unexpected errors (Internal Server Error)
  logger.error({ err, path: req.path }, "Unhandled application error");

  const isDev = env.NODE_ENV === "development";
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isDev ? err.message : "An unexpected internal server error occurred",
      ...(isDev ? { stack: err.stack } : {})
    }
  });
}
