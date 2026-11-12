import { Router } from "express";
import { companyController } from "./controller.js";
import { createCompanySchema, updateCompanySchema } from "./schema.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";
import { Role } from "@prisma/client";

export const companyRouter = Router();

// User-scoped company routes (list / create)
companyRouter.get("/", authenticate, (req, res, next) => companyController.list(req, res, next));
companyRouter.post("/", authenticate, validateBody(createCompanySchema), (req, res, next) => companyController.create(req, res, next));
companyRouter.get("/:id", authenticate, (req, res, next) => companyController.getOne(req, res, next));

// Company-scoped update route
companyRouter.patch(
  "/:id",
  authenticate,
  companyScope,
  requireRole(Role.OWNER),
  validateBody(updateCompanySchema),
  (req, res, next) => companyController.update(req, res, next)
);

