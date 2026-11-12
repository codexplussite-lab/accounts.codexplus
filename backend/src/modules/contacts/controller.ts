import { Request, Response, NextFunction } from "express";
import { ContactService } from "./service.js";

export class ContactController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ContactService.listContacts(req.companyId!, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await ContactService.getContactById(req.companyId!, req.params.id);
      res.json({ data: contact });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await ContactService.createContact(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: contact });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await ContactService.updateContact(req.companyId!, req.user!.id, req.params.id, req.body);
      res.json({ data: contact });
    } catch (err) {
      next(err);
    }
  }

  static async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ContactService.getContactLedger(req.companyId!, req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
