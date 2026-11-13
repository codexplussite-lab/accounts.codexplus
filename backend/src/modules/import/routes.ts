import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ImportService } from "./service.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

const CsvPayloadSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
  warehouseId: z.string().optional()
});

router.post(
  "/accounts",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CsvPayloadSchema.parse(req.body);
      const data = await ImportService.importAccounts(
        req.companyId!,
        input.csvContent,
        req.user?.id,
        req.ip
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/contacts",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CsvPayloadSchema.parse(req.body);
      const data = await ImportService.importContacts(
        req.companyId!,
        input.csvContent,
        req.user?.id,
        req.ip
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/products",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CsvPayloadSchema.parse(req.body);
      const data = await ImportService.importProducts(
        req.companyId!,
        input.csvContent,
        input.warehouseId,
        req.user?.id,
        req.ip
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
