import { Request, Response, NextFunction } from "express";
import { UserService } from "./service.js";
import { InviteUserSchema, UpdateRoleSchema } from "./schema.js";

export class UserController {
  static async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UserService.listMembers(req.companyId!);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = InviteUserSchema.parse(req.body);
      const result = await UserService.inviteMember(
        req.companyId!,
        input,
        req.user?.id,
        req.ip
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = UpdateRoleSchema.parse(req.body);
      const result = await UserService.updateMemberRole(
        req.companyId!,
        req.params.userId,
        input,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UserService.removeMember(
        req.companyId!,
        req.params.userId,
        req.user?.id,
        req.ip
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}
