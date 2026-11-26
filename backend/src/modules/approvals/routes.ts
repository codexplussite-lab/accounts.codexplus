import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ApprovalService } from "./service.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

const RejectSchema = z.object({
  reason: z.string().min(3, "Rejection reason must be provided")
});

router.post("/invoices/:id/submit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ApprovalService.submitInvoice(
      req.companyId!,
      req.params.id,
      req.user?.id,
      req.ip
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/invoices/:id/approve",
  requireRole(Role.OWNER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ApprovalService.approveInvoice(
        req.companyId!,
        req.params.id,
        req.user!.id,
        req.ip
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/invoices/:id/reject",
  requireRole(Role.OWNER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = RejectSchema.parse(req.body);
      const data = await ApprovalService.rejectInvoice(
        req.companyId!,
        req.params.id,
        input.reason,
        req.user!.id,
        req.ip
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

