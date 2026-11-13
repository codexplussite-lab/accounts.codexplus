import { Request, Response, NextFunction } from "express";
import { BankingService } from "./service.js";
import {
  CreateBankAccountSchema,
  ImportStatementSchema,
  ManualMatchSchema
} from "./schema.js";

export class BankingController {
  static async createBankAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateBankAccountSchema.parse(req.body);
      const result = await BankingService.createBankAccount(
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

  static async listBankAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await BankingService.listBankAccounts(req.companyId!);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async importStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = ImportStatementSchema.parse(req.body);
      const result = await BankingService.importStatement(
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

  static async autoMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await BankingService.autoMatch(
        req.companyId!,
        req.params.statementId,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async manualMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = ManualMatchSchema.parse(req.body);
      const result = await BankingService.manualMatch(
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

  static async unmatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await BankingService.unmatch(
        req.companyId!,
        req.params.lineId,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getReconciliation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bankAccountId } = req.params;
      const statementId = req.query.statementId as string | undefined;
      const result = await BankingService.getReconciliationReport(
        req.companyId!,
        bankAccountId,
        statementId
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}
