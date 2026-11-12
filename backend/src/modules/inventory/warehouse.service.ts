import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";

export class WarehouseService {
  static async listWarehouses(companyId: string) {
    const warehouses = await prisma.warehouse.findMany({
      where: { companyId },
      orderBy: { isDefault: "desc" }
    });

    return { data: warehouses };
  }

  static async getWarehouseById(companyId: string, id: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, companyId }
    });

    if (!warehouse) {
      throw new AppError("Warehouse not found", 404, "NOT_FOUND");
    }

    // Warehouse stock summary
    const movements = await prisma.stockMovement.findMany({
      where: { warehouseId: id, companyId }
    });

    const productStockMap = new Map<string, Decimal>();
    for (const m of movements) {
      const prev = productStockMap.get(m.productId) || new Decimal(0);
      productStockMap.set(m.productId, prev.plus(new Decimal(m.quantity.toString())));
    }

    const productIds = Array.from(productStockMap.keys());
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId }
    });

    const stockItems = products.map((p: any) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      quantity: (productStockMap.get(p.id) || new Decimal(0)).toFixed(3)
    }));

    return {
      data: {
        ...warehouse,
        stockItems
      }
    };
  }

  static async createWarehouse(companyId: string, userId: string, input: any) {
    const isDefault = input.isDefault ?? false;

    const warehouse = await prisma.$transaction(async (tx: any) => {
      if (isDefault) {
        await tx.warehouse.updateMany({
          where: { companyId },
          data: { isDefault: false }
        });
      }

      return tx.warehouse.create({
        data: {
          companyId,
          name: input.name,
          isDefault
        }
      });
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Warehouse",
      objectId: warehouse.id,
      action: "CREATE",
      newData: warehouse
    });

    return { data: warehouse };
  }

  static async updateWarehouse(companyId: string, userId: string, id: string, input: any) {
    const existing = await prisma.warehouse.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Warehouse not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      if (input.isDefault) {
        await tx.warehouse.updateMany({
          where: { companyId, id: { not: id } },
          data: { isDefault: false }
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: {
          name: input.name !== undefined ? input.name : existing.name,
          isDefault: input.isDefault !== undefined ? input.isDefault : existing.isDefault
        }
      });
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Warehouse",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    return { data: updated };
  }

  static async deleteWarehouse(companyId: string, userId: string, id: string) {
    const existing = await prisma.warehouse.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Warehouse not found", 404, "NOT_FOUND");
    }

    if (existing.isDefault) {
      throw new AppError("Cannot delete the default warehouse. Designate another warehouse as default first.", 422, "CANNOT_DELETE_DEFAULT_WAREHOUSE");
    }

    const movementsCount = await prisma.stockMovement.count({
      where: { warehouseId: id, companyId }
    });

    if (movementsCount > 0) {
      throw new AppError("Cannot delete warehouse with existing stock history.", 422, "WAREHOUSE_HAS_STOCK_HISTORY");
    }

    await prisma.warehouse.delete({ where: { id } });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Warehouse",
      objectId: id,
      action: "DELETE",
      oldData: existing
    });

    return { success: true };
  }
}
