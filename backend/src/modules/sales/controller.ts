import { Request, Response, NextFunction } from "express";
import { SalesService } from "./service.js";

export class SalesController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SalesService.listInvoices(req.companyId!, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SalesService.getInvoiceById(req.companyId!, req.params.id);
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SalesService.createInvoice(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SalesService.updateInvoice(req.companyId!, req.user!.id, req.params.id, req.body);
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SalesService.deleteInvoice(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async post(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SalesService.postInvoice(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async void(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await SalesService.voidInvoice(req.companyId!, req.user!.id, req.params.id, req.body?.reason);
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async createCreditNote(req: Request, res: Response, next: NextFunction) {
    try {
      const creditNote = await SalesService.createCreditNote(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: creditNote });
    } catch (err) {
      next(err);
    }
  }

  static async downloadPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await SalesService.generateInvoicePDF(req.companyId!, req.params.id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Invoice-${req.params.id}.pdf"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}
