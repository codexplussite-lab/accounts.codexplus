import { Request, Response, NextFunction } from "express";
import { RecurringService } from "./service.js";
import { CreateRecurringInvoiceSchema } from "./schema.js";

export class RecurringController {
  static async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateRecurringInvoiceSchema.parse(req.body);
      const result = await RecurringService.createTemplate(
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

  static async listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RecurringService.listTemplates(req.companyId!);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async generateNow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RecurringService.generateInvoiceFromTemplate(
        req.companyId!,
        req.params.id,
        req.user!.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async processDue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RecurringService.processDue(
        req.companyId!,
        req.user!.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isActive, status } = req.body;
      const active = isActive !== undefined ? Boolean(isActive) : status === "ACTIVE";
      const result = await RecurringService.updateStatus(
        req.companyId!,
        req.params.id,
        active,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}
