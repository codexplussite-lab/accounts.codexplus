import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";

export class CategoryService {
  static async listCategories(companyId: string) {
    const categories = await prisma.category.findMany({
      where: { companyId },
      orderBy: { name: "asc" }
    });

    return { data: categories };
  }

  static async getCategoryById(companyId: string, id: string) {
    const category = await prisma.category.findFirst({
      where: { id, companyId }
    });

    if (!category) {
      throw new AppError("Category not found", 404, "NOT_FOUND");
    }

    return { data: category };
  }

  static async createCategory(companyId: string, userId: string, name: string) {
    const category = await prisma.category.create({
      data: {
        companyId,
        name
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Category",
      objectId: category.id,
      action: "CREATE",
      newData: category
    });

    return { data: category };
  }

  static async updateCategory(companyId: string, userId: string, id: string, name: string) {
    const existing = await prisma.category.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Category not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Category",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    return { data: updated };
  }

  static async deleteCategory(companyId: string, userId: string, id: string) {
    const existing = await prisma.category.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Category not found", 404, "NOT_FOUND");
    }

    await prisma.category.delete({ where: { id } });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Category",
      objectId: id,
      action: "DELETE",
      oldData: existing
    });

    return { success: true };
  }
}
