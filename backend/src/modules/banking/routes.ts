import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { BankingController } from "./controller.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

// Bank Accounts
router.get("/accounts", requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR), BankingController.listBankAccounts);
router.post("/accounts", requireRole(Role.OWNER, Role.ACCOUNTANT), BankingController.createBankAccount);

// Bank Statement Import & Reconciliation
router.post("/statements/import", requireRole(Role.OWNER, Role.ACCOUNTANT), BankingController.importStatement);
router.post("/statements/:statementId/auto-match", requireRole(Role.OWNER, Role.ACCOUNTANT), BankingController.autoMatch);
router.post("/match", requireRole(Role.OWNER, Role.ACCOUNTANT), BankingController.manualMatch);
router.post("/unmatch/:lineId", requireRole(Role.OWNER, Role.ACCOUNTANT), BankingController.unmatch);
router.get("/reconciliation/:bankAccountId", requireRole(Role.OWNER, Role.ACCOUNTANT, Role.AUDITOR), BankingController.getReconciliation);

export default router;
