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

const CsvPayloadSchema = z
  .object({
    csvContent: z.string().optional(),
    rows: z.array(z.record(z.any())).optional(),
    warehouseId: z.string().optional()
  })
  .refine((data) => Boolean(data.csvContent || (data.rows && data.rows.length > 0)), {
    message: "Either csvContent string or rows array must be provided"
  });

router.post(
  "/accounts",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CsvPayloadSchema.parse(req.body);
      const payload = input.csvContent || input.rows!;
      const data = await ImportService.importAccounts(
        req.companyId!,
        payload,
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
      const payload = input.csvContent || input.rows!;
      const data = await ImportService.importContacts(
        req.companyId!,
        payload,
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
      const payload = input.csvContent || input.rows!;
      const data = await ImportService.importProducts(
        req.companyId!,
        payload,
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
