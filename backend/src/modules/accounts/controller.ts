import { Request, Response, NextFunction } from "express";
import { accountService } from "./service.js";
import { AccountType } from "@prisma/client";

export class AccountController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { type, search, isActive } = req.query as {
        type?: AccountType;
        search?: string;
        isActive?: string;
      };

      const accounts = await accountService.listAccounts(companyId, {
        type,
        search,
        isActive: isActive !== undefined ? isActive === "true" : undefined
      });

      res.status(200).json({ data: accounts });
    } catch (error) {
      next(error);
    }
  }

  async tree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const tree = await accountService.getAccountTree(companyId);
      res.status(200).json({ data: tree });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const account = await accountService.getAccountById(companyId, req.params.id);
      res.status(200).json({ data: account });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const created = await accountService.createAccount(companyId, userId, req.body, ipAddress);
      res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const updated = await accountService.updateAccount(companyId, userId, req.params.id, req.body, ipAddress);
      res.status(200).json({ data: updated });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await accountService.deleteAccount(companyId, userId, req.params.id, ipAddress);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const accountController = new AccountController();

