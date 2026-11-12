import { Request, Response, NextFunction } from "express";
import { companyService } from "./service.js";

export class CompanyController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const companies = await companyService.listUserCompanies(userId);
      res.status(200).json({ data: companies });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const company = await companyService.createCompany(userId, req.body, ipAddress);
      res.status(201).json({ data: company });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const company = await companyService.getCompany(req.params.id, userId);
      res.status(200).json({ data: company });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const updated = await companyService.updateCompany(req.params.id, userId, req.body, ipAddress);
      res.status(200).json({ data: updated });
    } catch (error) {
      next(error);
    }
  }
}

export const companyController = new CompanyController();

