import { Router } from "express";
import { Role } from "@prisma/client";
import { PaymentController } from "./controller.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { createPaymentSchema, paymentQuerySchema } from "./schema.js";
import { requireRole } from "../../middleware/requireRole.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";

const router = Router();

router.use(authenticate, companyScope);

router.get("/", validateQuery(paymentQuerySchema), PaymentController.list);
router.get("/:id", PaymentController.getById);

router.post(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.CASHIER),
  validateBody(createPaymentSchema),
  PaymentController.create
);

export default router;
