import { Request, Response, NextFunction } from "express";
import { FiscalService } from "./service.js";
import {
  SetPeriodLockSchema,
  CreateFiscalYearSchema,
  ReopenFiscalYearSchema
} from "./schema.js";

export class FiscalController {
  static async setPeriodLock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = SetPeriodLockSchema.parse(req.body);
      const result = await FiscalService.setPeriodLock(
        req.companyId!,
        input,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getPeriodLock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await FiscalService.getPeriodLock(req.companyId!);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async createFiscalYear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateFiscalYearSchema.parse(req.body);
      const result = await FiscalService.createFiscalYear(
        req.companyId!,
        input,
        req.user?.id,
        req.ip
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listFiscalYears(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await FiscalService.listFiscalYears(req.companyId!);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async closeFiscalYear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await FiscalService.closeFiscalYear(
        req.companyId!,
        req.params.id,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async reopenFiscalYear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = ReopenFiscalYearSchema.parse(req.body);
      const result = await FiscalService.reopenFiscalYear(
        req.companyId!,
        req.params.id,
        input,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}
