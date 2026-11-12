import { Router } from "express";
import { Role } from "@prisma/client";
import { PurchaseController } from "./controller.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { createBillSchema, updateBillSchema, billQuerySchema } from "./schema.js";
import { requireRole } from "../../middleware/requireRole.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";

const router = Router();

router.use(authenticate, companyScope);

router.get("/bills", validateQuery(billQuerySchema), PurchaseController.list);
router.get("/bills/:id", PurchaseController.getById);
router.get("/bills/:id/pdf", PurchaseController.downloadPDF);

router.post(
  "/bills",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.CASHIER),
  validateBody(createBillSchema),
  PurchaseController.create
);

router.put(
  "/bills/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateBillSchema),
  PurchaseController.update
);

router.delete(
  "/bills/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  PurchaseController.delete
);

router.post(
  "/bills/:id/post",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  PurchaseController.post
);

router.post(
  "/bills/:id/void",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  PurchaseController.void
);

export default router;
