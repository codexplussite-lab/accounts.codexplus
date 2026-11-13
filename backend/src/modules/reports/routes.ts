import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { ReportsController } from "./controller.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

// 1. General Ledger
router.get("/general-ledger", ReportsController.getGeneralLedger);

// 2. Trial Balance
router.get("/trial-balance", ReportsController.getTrialBalance);

// 3. Profit and Loss
router.get("/profit-and-loss", ReportsController.getProfitAndLoss);

// 4. Balance Sheet
router.get("/balance-sheet", ReportsController.getBalanceSheet);

// 5. AR Ageing
router.get("/ar-ageing", ReportsController.getARAgeing);

// 6. AP Ageing
router.get("/ap-ageing", ReportsController.getAPAgeing);

// 7. Cash Flow
router.get("/cash-flow", ReportsController.getCashFlow);

// 8. Sales Report
router.get("/sales", ReportsController.getSalesReport);

// 9. Purchase Report
router.get("/purchases", ReportsController.getPurchaseReport);

// 10. Tax Report
router.get("/tax", ReportsController.getTaxReport);

// 11. PDF & Excel Exports
router.get("/export", ReportsController.exportReport);

export default router;
