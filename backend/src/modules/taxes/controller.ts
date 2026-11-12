import { Request, Response, NextFunction } from "express";
import { TaxService } from "./service.js";

export class TaxController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TaxService.listTaxRates(req.companyId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const tax = await TaxService.getTaxRateById(req.companyId!, req.params.id);
      res.json({ data: tax });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tax = await TaxService.createTaxRate(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: tax });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const tax = await TaxService.updateTaxRate(req.companyId!, req.user!.id, req.params.id, req.body);
      res.json({ data: tax });
    } catch (err) {
      next(err);
    }
  }

  static async toggle(req: Request, res: Response, next: NextFunction) {
    try {
      const tax = await TaxService.toggleActive(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: tax });
    } catch (err) {
      next(err);
    }
  }
}
