import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { AuditController } from "./controller.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

// Restrict audit log access strictly to OWNER and AUDITOR
router.get("/", requireRole(Role.OWNER, Role.AUDITOR), AuditController.listLogs);
router.get("/:id", requireRole(Role.OWNER, Role.AUDITOR), AuditController.getLogById);

// Immutability tripwires (reject any modification attempt with 403)
router.put("/:id", AuditController.updateLog);
router.patch("/:id", AuditController.updateLog);
router.delete("/:id", AuditController.deleteLog);

export default router;
