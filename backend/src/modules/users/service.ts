import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { InviteUserInput, UpdateRoleInput } from "./schema.js";

export class UserService {
  /**
   * Lists all team members associated with the active company.
   */
  static async listMembers(companyId: string) {
    const memberships = await prisma.membership.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    return memberships.map((m) => ({
      userId: m.userId,
      companyId: m.companyId,
      role: m.role,
      user: m.user
    }));
  }

  /**
   * Invites or assigns a new user to the company with a designated role.
   */
  static async inviteMember(
    companyId: string,
    input: InviteUserInput,
    inviterId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email: input.email }
      });

      if (!user) {
        const password = input.initialPassword || "ChangeMe2026!";
        const passwordHash = await bcrypt.hash(password, 12);
        user = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash,
            isActive: true
          }
        });
      }

      // Check if already a member
      const existingMembership = await tx.membership.findUnique({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId
          }
        }
      });

      if (existingMembership) {
        throw new AppError("User is already a member of this company.", 409, "MEMBER_ALREADY_EXISTS");
      }

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          companyId,
          role: input.role
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, isActive: true }
          }
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId: inviterId,
        model: "Membership",
        objectId: `${user.id}_${companyId}`,
        action: "CREATE",
        newData: {
          userId: user.id,
          email: user.email,
          role: input.role
        },
        ipAddress
      });

      return membership;
    });
  }

  /**
   * Updates an existing member's role.
   * Lockout prevention: Cannot remove or demote the last OWNER of a company.
   */
  static async updateMemberRole(
    companyId: string,
    targetUserId: string,
    input: UpdateRoleInput,
    updaterId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: {
          userId_companyId: {
            userId: targetUserId,
            companyId
          }
        }
      });

      if (!membership) {
        throw new AppError("Member not found in this company.", 404, "MEMBER_NOT_FOUND");
      }

      // Lockout prevention check
      if (membership.role === Role.OWNER && input.role !== Role.OWNER) {
        const ownerCount = await tx.membership.count({
          where: {
            companyId,
            role: Role.OWNER
          }
        });

        if (ownerCount <= 1) {
          throw new AppError(
            "Cannot demote the last OWNER of the company. Assign another OWNER first.",
            422,
            "LAST_OWNER_PROTECTION"
          );
        }
      }

      const updated = await tx.membership.update({
        where: {
          userId_companyId: {
            userId: targetUserId,
            companyId
          }
        },
        data: {
          role: input.role
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, isActive: true }
          }
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId: updaterId,
        model: "Membership",
        objectId: `${targetUserId}_${companyId}`,
        action: "UPDATE",
        oldData: { role: membership.role },
        newData: { role: input.role },
        ipAddress
      });

      return updated;
    });
  }

  /**
   * Deactivates or removes a member from the company.
   */
  static async removeMember(
    companyId: string,
    targetUserId: string,
    removerId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: {
          userId_companyId: {
            userId: targetUserId,
            companyId
          }
        }
      });

      if (!membership) {
        throw new AppError("Member not found in this company.", 404, "MEMBER_NOT_FOUND");
      }

      if (membership.role === Role.OWNER) {
        const ownerCount = await tx.membership.count({
          where: {
            companyId,
            role: Role.OWNER
          }
        });

        if (ownerCount <= 1) {
          throw new AppError(
            "Cannot remove the last OWNER of the company.",
            422,
            "LAST_OWNER_PROTECTION"
          );
        }
      }

      await tx.membership.delete({
        where: {
          userId_companyId: {
            userId: targetUserId,
            companyId
          }
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId: removerId,
        model: "Membership",
        objectId: `${targetUserId}_${companyId}`,
        action: "DELETE",
        oldData: { userId: targetUserId, role: membership.role },
        ipAddress
      });

      return { success: true, message: "Member removed from company." };
    });
  }
}
