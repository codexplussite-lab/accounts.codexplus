import { Router } from "express";
import { Role } from "@prisma/client";
import { TaxController } from "./controller.js";
import { validateBody } from "../../middleware/validate.js";
import { createTaxRateSchema, updateTaxRateSchema } from "./schema.js";
import { requireRole } from "../../middleware/requireRole.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";

const router = Router();

router.use(authenticate, companyScope);

router.get("/", TaxController.list);
router.get("/:id", TaxController.getById);

router.post(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createTaxRateSchema),
  TaxController.create
);

router.put(
  "/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateTaxRateSchema),
  TaxController.update
);

router.patch(
  "/:id/toggle",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  TaxController.toggle
);

export default router;
