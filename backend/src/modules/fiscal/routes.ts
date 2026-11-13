import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { FiscalController } from "./controller.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

// Period lock
router.get("/period-lock", requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR), FiscalController.getPeriodLock);
router.put("/period-lock", requireRole(Role.OWNER, Role.ACCOUNTANT), FiscalController.setPeriodLock);

// Fiscal years
router.get("/years", requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR), FiscalController.listFiscalYears);
router.post("/years", requireRole(Role.OWNER, Role.ACCOUNTANT), FiscalController.createFiscalYear);

// Year-End Closing
router.post("/years/:id/close", requireRole(Role.OWNER, Role.ACCOUNTANT), FiscalController.closeFiscalYear);

// Reopen Fiscal Year (OWNER strictly required)
router.post("/years/:id/reopen", requireRole(Role.OWNER), FiscalController.reopenFiscalYear);

export default router;
