import { Request, Response, NextFunction } from "express";
import { journalService } from "./service.js";
import { EntryStatus } from "@prisma/client";

export class JournalController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const { page, limit, status, fromDate, toDate } = req.query as {
        page?: string;
        limit?: string;
        status?: EntryStatus;
        fromDate?: string;
        toDate?: string;
      };

      const result = await journalService.listEntries(companyId, {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        status,
        fromDate,
        toDate
      });

      res.status(200).json({
        data: result.entries,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const entry = await journalService.getEntryById(companyId, req.params.id);
      res.status(200).json({ data: entry });
    } catch (error) {
      next(error);
    }
  }

  async createDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const draft = await journalService.createDraft(companyId, userId, req.body, ipAddress);
      res.status(201).json({ data: draft });
    } catch (error) {
      next(error);
    }
  }

  async updateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const updated = await journalService.updateDraft(companyId, userId, req.params.id, req.body, ipAddress);
      res.status(200).json({ data: updated });
    } catch (error) {
      next(error);
    }
  }

  async deleteDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await journalService.deleteDraft(companyId, userId, req.params.id, ipAddress);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async postDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const posted = await journalService.postDraft(companyId, userId, req.params.id, ipAddress);
      res.status(200).json({ data: posted });
    } catch (error) {
      next(error);
    }
  }

  async createAndPostDirect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const posted = await journalService.createAndPostDirect(companyId, userId, req.body, ipAddress);
      res.status(201).json({ data: posted });
    } catch (error) {
      next(error);
    }
  }

  async reverse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.companyId!;
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const reversal = await journalService.reverseEntry(companyId, userId, req.params.id, req.body, ipAddress);
      res.status(200).json({ data: reversal });
    } catch (error) {
      next(error);
    }
  }
}

export const journalController = new JournalController();

