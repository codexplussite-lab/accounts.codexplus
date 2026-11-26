import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./service.js";

export class DashboardController {
  static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DashboardService.getOverview(req.companyId!);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }
}

