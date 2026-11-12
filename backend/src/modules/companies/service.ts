import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { createDefaultAccountsAndWarehouse } from "../../lib/seedAccounts.js";
import { createAuditLog } from "../../lib/audit.js";
import { AppError } from "../../middleware/errorHandler.js";
import { CreateCompanyInput, UpdateCompanyInput } from "./schema.js";

export class CompanyService {
  async listUserCompanies(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            currency: true,
            ntn: true,
            address: true,
            lockedUntil: true,
            createdAt: true
          }
        }
      }
    });

    return memberships.map((m) => ({
      ...m.company,
      role: m.role
    }));
  }

  async createCompany(userId: string, data: CreateCompanyInput, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({
        data: {
          name: data.name.trim(),
          currency: data.currency || "PKR",
          ntn: data.ntn?.trim() || null,
          address: data.address?.trim() || null
        }
      });

      // 2. Create OWNER Membership
      const membership = await tx.membership.create({
        data: {
          userId,
          companyId: company.id,
          role: Role.OWNER
        }
      });

      // 3. Seed Default Chart of Accounts & Default Warehouse
      await createDefaultAccountsAndWarehouse(tx, company.id);

      // 4. Audit Log
      await createAuditLog(tx, {
        companyId: company.id,
        userId,
        model: "Company",
        objectId: company.id,
        action: "CREATE",
        newData: { name: company.name, currency: company.currency },
        ipAddress
      });

      return {
        ...company,
        role: membership.role
      };
    });
  }

  async getCompany(companyId: string, userId: string) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId
        }
      },
      include: {
        company: true
      }
    });

    if (!membership) {
      throw new AppError("Access denied: You are not a member of this company.", 403, "FORBIDDEN");
    }

    return {
      ...membership.company,
      role: membership.role
    };
  }

  async updateCompany(companyId: string, userId: string, data: UpdateCompanyInput, ipAddress?: string) {
    const oldCompany = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!oldCompany) {
      throw new AppError("Company not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name?.trim(),
        ntn: data.ntn?.trim(),
        address: data.address?.trim(),
        currency: data.currency,
        lockedUntil: data.lockedUntil ? new Date(data.lockedUntil) : data.lockedUntil === null ? null : undefined,
        allowNegativeStock: data.allowNegativeStock
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Company",
      objectId: companyId,
      action: "UPDATE",
      oldData: oldCompany,
      newData: updated,
      ipAddress
    });

    return updated;
  }
}

export const companyService = new CompanyService();

