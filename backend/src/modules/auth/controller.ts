import { Request, Response, NextFunction } from "express";
import { authService } from "./service.js";
import { env } from "../../config/env.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.register(req.body, ipAddress);

      // Set httpOnly refresh cookie
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_MS
      });

      res.status(201).json({
        data: {
          user: result.user,
          company: result.company,
          accessToken: result.accessToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.login(req.body, ipAddress);

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_MS
      });

      res.status(200).json({
        data: {
          user: result.user,
          companies: result.companies,
          accessToken: result.accessToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      const result = await authService.refresh(refreshToken);

      res.status(200).json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax"
      });

      res.status(200).json({
        data: {
          success: true,
          message: "Logged out successfully"
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await authService.getMe(userId);

      res.status(200).json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

