import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { DashboardController } from "./controller.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

// GET /api/dashboard/overview
router.get("/overview", DashboardController.getOverview);

export default router;

