import { Request, Response, NextFunction } from "express";
import { AuditService } from "./service.js";
import { AuditQuerySchema } from "./schema.js";

export class AuditController {
  static async listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = AuditQuerySchema.parse(req.query);
      const result = await AuditService.listLogs(req.companyId!, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const log = await AuditService.getLogById(req.companyId!, req.params.id);
      res.json({ data: log });
    } catch (error) {
      next(error);
    }
  }

  static async updateLog(_req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      AuditService.updateLog();
    } catch (error) {
      next(error);
    }
  }

  static async deleteLog(_req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      AuditService.deleteLog();
    } catch (error) {
      next(error);
    }
  }
}
