import { Router } from "express";
import { Role } from "@prisma/client";
import { journalController } from "./controller.js";
import {
  createJournalDraftSchema,
  postJournalDirectSchema,
  reverseJournalSchema
} from "./schema.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";

export const journalRouter = Router();

// Require JWT authentication and verified company scoping for all routes
journalRouter.use(authenticate, companyScope);

// Read routes: OWNER, ACCOUNTANT, AUDITOR
journalRouter.get(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR),
  (req, res, next) => journalController.list(req, res, next)
);

journalRouter.get(
  "/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR),
  (req, res, next) => journalController.getOne(req, res, next)
);

// Write routes: OWNER, ACCOUNTANT (AUDITOR forbidden from mutate)
journalRouter.post(
  "/draft",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createJournalDraftSchema),
  (req, res, next) => journalController.createDraft(req, res, next)
);

journalRouter.patch(
  "/draft/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createJournalDraftSchema),
  (req, res, next) => journalController.updateDraft(req, res, next)
);

journalRouter.delete(
  "/draft/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  (req, res, next) => journalController.deleteDraft(req, res, next)
);

journalRouter.post(
  "/:id/post",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  (req, res, next) => journalController.postDraft(req, res, next)
);

journalRouter.post(
  "/",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(postJournalDirectSchema),
  (req, res, next) => journalController.createAndPostDirect(req, res, next)
);

journalRouter.post(
  "/:id/reverse",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(reverseJournalSchema),
  (req, res, next) => journalController.reverse(req, res, next)
);

