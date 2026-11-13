import { Router } from "express";
import { Role } from "@prisma/client";
import { SalesController } from "./controller.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceQuerySchema,
  createCreditNoteSchema
} from "./schema.js";
import { requireRole } from "../../middleware/requireRole.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";

const router = Router();

router.use(authenticate, companyScope);

router.get("/invoices", validateQuery(invoiceQuerySchema), SalesController.list);
router.get("/invoices/:id", SalesController.getById);
router.get("/invoices/:id/pdf", SalesController.downloadPDF);

router.post(
  "/invoices",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.CASHIER),
  validateBody(createInvoiceSchema),
  SalesController.create
);

router.put(
  "/invoices/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateInvoiceSchema),
  SalesController.update
);

router.delete(
  "/invoices/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  SalesController.delete
);

router.post(
  "/invoices/:id/post",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  SalesController.post
);

router.post(
  "/invoices/:id/void",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  SalesController.void
);

router.post(
  "/invoices/:id/email",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  SalesController.emailInvoice
);

router.post(
  "/credit-notes",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createCreditNoteSchema),
  SalesController.createCreditNote
);

export default router;
