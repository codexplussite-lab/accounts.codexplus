import { Router } from "express";
import { Role } from "@prisma/client";
import { accountController } from "./controller.js";
import { createAccountSchema, updateAccountSchema } from "./schema.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";

export const accountRouter = Router();

// Apply auth + companyScope to all accounts endpoints
accountRouter.use(authenticate, companyScope);

// Read routes: OWNER, ACCOUNTANT, AUDITOR
accountRouter.get(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR),
  (req, res, next) => accountController.list(req, res, next)
);

accountRouter.get(
  "/tree",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR),
  (req, res, next) => accountController.tree(req, res, next)
);

accountRouter.get(
  "/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR),
  (req, res, next) => accountController.getOne(req, res, next)
);

// Write routes: OWNER, ACCOUNTANT (AUDITOR forbidden from mutate)
accountRouter.post(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createAccountSchema),
  (req, res, next) => accountController.create(req, res, next)
);

accountRouter.patch(
  "/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateAccountSchema),
  (req, res, next) => accountController.update(req, res, next)
);

accountRouter.delete(
  "/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  (req, res, next) => accountController.delete(req, res, next)
);

