import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "./errorHandler.js";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authentication required. Missing or invalid Bearer token.", 401, "UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.userId };
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Access token expired. Please refresh your session.", 401, "TOKEN_EXPIRED");
    }
    throw new AppError("Invalid access token.", 401, "INVALID_TOKEN");
  }
}

