import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { RecurringController } from "./controller.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

router.get("/", requireRole(Role.OWNER, Role.ACCOUNTANT), RecurringController.listTemplates);
router.post("/", requireRole(Role.OWNER, Role.ACCOUNTANT), RecurringController.createTemplate);
router.patch("/:id", requireRole(Role.OWNER, Role.ACCOUNTANT), RecurringController.updateStatus);
router.post("/generate", requireRole(Role.OWNER, Role.ACCOUNTANT), RecurringController.processDue);
router.post("/:id/generate", requireRole(Role.OWNER, Role.ACCOUNTANT), RecurringController.generateNow);
router.post("/process-due", requireRole(Role.OWNER, Role.ACCOUNTANT), RecurringController.processDue);

export default router;
