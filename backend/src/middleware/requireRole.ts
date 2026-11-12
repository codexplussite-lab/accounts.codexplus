import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AppError } from "./errorHandler.js";

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.role) {
      throw new AppError("Role context missing. Company scope must be established.", 403, "ROLE_MISSING");
    }

    if (!allowedRoles.includes(req.role)) {
      throw new AppError(
        `Insufficient permissions. Your role '${req.role}' is not authorized for this action.`,
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    next();
  };
}

