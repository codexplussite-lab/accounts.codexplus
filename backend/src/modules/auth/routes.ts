import { Router } from "express";
import { authController } from "./controller.js";
import { registerSchema, loginSchema } from "./schema.js";
import { validateBody } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), (req, res, next) => authController.register(req, res, next));
authRouter.post("/login", validateBody(loginSchema), (req, res, next) => authController.login(req, res, next));
authRouter.post("/refresh", (req, res, next) => authController.refresh(req, res, next));
authRouter.post("/logout", (req, res, next) => authController.logout(req, res, next));
authRouter.get("/me", authenticate, (req, res, next) => authController.getMe(req, res, next));

