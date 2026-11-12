import { Router } from "express";
import { Role } from "@prisma/client";
import { ContactController } from "./controller.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { createContactSchema, updateContactSchema, contactQuerySchema } from "./schema.js";
import { requireRole } from "../../middleware/requireRole.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";

const router = Router();

router.use(authenticate, companyScope);

router.get("/", validateQuery(contactQuerySchema), ContactController.list);
router.get("/:id", ContactController.getById);
router.get("/:id/ledger", ContactController.getLedger);

router.post(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createContactSchema),
  ContactController.create
);

router.put(
  "/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateContactSchema),
  ContactController.update
);

export default router;
