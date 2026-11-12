import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";

export class TaxService {
  static async listTaxRates(companyId: string) {
    const taxes = await prisma.taxRate.findMany({
      where: { companyId },
      orderBy: { percentage: "asc" }
    });

    return {
      data: taxes.map((t: any) => ({
        ...t,
        percentage: new Decimal(t.percentage.toString()).toFixed(2)
      }))
    };
  }

  static async getTaxRateById(companyId: string, id: string) {
    const tax = await prisma.taxRate.findFirst({
      where: { id, companyId }
    });

    if (!tax) {
      throw new AppError("Tax rate not found", 404, "NOT_FOUND");
    }

    return {
      ...tax,
      percentage: new Decimal(tax.percentage.toString()).toFixed(2)
    };
  }

  static async createTaxRate(companyId: string, userId: string, input: any) {
    const percentage = new Decimal(input.percentage);
    if (percentage.isNegative() || percentage.greaterThan(100)) {
      throw new AppError("Percentage must be between 0 and 100", 422, "INVALID_TAX_PERCENTAGE");
    }

    const tax = await prisma.taxRate.create({
      data: {
        companyId,
        name: input.name,
        percentage,
        isActive: input.isActive ?? true
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "TaxRate",
      objectId: tax.id,
      action: "CREATE",
      newData: tax
    });

    return {
      ...tax,
      percentage: new Decimal(tax.percentage.toString()).toFixed(2)
    };
  }

  static async updateTaxRate(companyId: string, userId: string, id: string, input: any) {
    const existing = await prisma.taxRate.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Tax rate not found", 404, "NOT_FOUND");
    }

    const dataToUpdate: any = {};
    if (input.name !== undefined) dataToUpdate.name = input.name;
    if (input.percentage !== undefined) {
      const percentage = new Decimal(input.percentage);
      if (percentage.isNegative() || percentage.greaterThan(100)) {
        throw new AppError("Percentage must be between 0 and 100", 422, "INVALID_TAX_PERCENTAGE");
      }
      dataToUpdate.percentage = percentage;
    }
    if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

    const updated = await prisma.taxRate.update({
      where: { id },
      data: dataToUpdate
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "TaxRate",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    return {
      ...updated,
      percentage: new Decimal(updated.percentage.toString()).toFixed(2)
    };
  }

  static async toggleActive(companyId: string, userId: string, id: string) {
    const existing = await prisma.taxRate.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Tax rate not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.taxRate.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "TaxRate",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    return {
      ...updated,
      percentage: new Decimal(updated.percentage.toString()).toFixed(2)
    };
  }
}
