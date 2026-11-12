import { Request, Response, NextFunction } from "express";
import { PaymentService } from "./service.js";

export class PaymentController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PaymentService.listPayments(req.companyId!, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentService.getPaymentById(req.companyId!, req.params.id);
      res.json({ data: payment });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentService.createPayment(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: payment });
    } catch (err) {
      next(err);
    }
  }
}
