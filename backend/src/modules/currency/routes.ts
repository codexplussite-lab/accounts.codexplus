import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { CurrencyService } from "./service.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

const SetRateSchema = z.object({
  fromCode: z.string().min(3).max(3),
  toCode: z.string().min(3).max(3),
  rate: z.string().or(z.number())
});

const ConvertSchema = z.object({
  amount: z.string().or(z.number()),
  fromCode: z.string().min(3).max(3),
  toCode: z.string().min(3).max(3)
});

router.get("/rates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await CurrencyService.listRates(req.companyId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/rates",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = SetRateSchema.parse(req.body);
      const data = await CurrencyService.setRate(
        req.companyId!,
        input.fromCode,
        input.toCode,
        input.rate,
        req.user?.id,
        req.ip
      );
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

router.post("/convert", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ConvertSchema.parse(req.body);
    const data = await CurrencyService.convert(
      req.companyId!,
      input.amount,
      input.fromCode,
      input.toCode
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;

