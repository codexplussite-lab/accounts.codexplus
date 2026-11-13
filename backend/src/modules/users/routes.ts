import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";
import { requireRole } from "../../middleware/requireRole.js";
import { UserController } from "./controller.js";

const router = Router();

router.use(authenticate);
router.use(companyScope);

// Only OWNER and AUDITOR can inspect members
router.get("/", requireRole(Role.OWNER, Role.AUDITOR), UserController.listMembers);

// Only OWNER can modify company memberships
router.post("/invite", requireRole(Role.OWNER), UserController.inviteMember);
router.put("/:userId/role", requireRole(Role.OWNER), UserController.updateRole);
router.delete("/:userId", requireRole(Role.OWNER), UserController.removeMember);

export default router;
