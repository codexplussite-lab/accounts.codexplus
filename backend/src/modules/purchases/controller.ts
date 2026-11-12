import { Request, Response, NextFunction } from "express";
import { PurchaseService } from "./service.js";

export class PurchaseController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseService.listBills(req.companyId!, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const bill = await PurchaseService.getBillById(req.companyId!, req.params.id);
      res.json({ data: bill });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const bill = await PurchaseService.createBill(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: bill });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const bill = await PurchaseService.updateBill(req.companyId!, req.user!.id, req.params.id, req.body);
      res.json({ data: bill });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PurchaseService.deleteBill(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async post(req: Request, res: Response, next: NextFunction) {
    try {
      const bill = await PurchaseService.postBill(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: bill });
    } catch (err) {
      next(err);
    }
  }

  static async void(req: Request, res: Response, next: NextFunction) {
    try {
      const bill = await PurchaseService.voidBill(req.companyId!, req.user!.id, req.params.id, req.body?.reason);
      res.json({ data: bill });
    } catch (err) {
      next(err);
    }
  }

  static async downloadPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await PurchaseService.generateBillPDF(req.companyId!, req.params.id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Bill-${req.params.id}.pdf"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}
