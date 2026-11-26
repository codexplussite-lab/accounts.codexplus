import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";

export class ProductService {
  /**
   * Helper to derive stock status based on current stock and reorder level
   */
  static getStockStatus(currentStock: Decimal, reorderLevel: Decimal, trackStock: boolean): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
    if (!trackStock) return "IN_STOCK";
    if (currentStock.lessThanOrEqualTo(0)) return "OUT_OF_STOCK";
    if (currentStock.lessThanOrEqualTo(reorderLevel)) return "LOW_STOCK";
    return "IN_STOCK";
  }

  static async listProducts(companyId: string, query: any) {
    const { search, categoryId, status, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } }
      ];
    }

    const [totalCount, products, allMovements, categories] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" }
      }),
      prisma.stockMovement.findMany({
        where: { companyId }
      }),
      prisma.category.findMany({
        where: { companyId }
      })
    ]);

    const categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));

    // Group movements by product without N+1 queries
    const stockMap = new Map<string, Decimal>();
    for (const m of allMovements) {
      const prev = stockMap.get(m.productId) || new Decimal(0);
      stockMap.set(m.productId, prev.plus(new Decimal(m.quantity.toString())));
    }

    let data = products.map((p: any) => {
      const stock = stockMap.get(p.id) || new Decimal(0);
      const reorder = new Decimal(p.reorderLevel.toString());
      const cost = new Decimal(p.costPrice.toString());
      const stockStatus = ProductService.getStockStatus(stock, reorder, p.trackStock);
      const totalValuation = stock.greaterThan(0) ? stock.times(cost).toDecimalPlaces(2) : new Decimal(0);

      return {
        ...p,
        categoryName: p.categoryId ? categoryMap.get(p.categoryId) || null : null,
        costPrice: cost.toFixed(2),
        salePrice: new Decimal(p.salePrice.toString()).toFixed(2),
        reorderLevel: reorder.toFixed(3),
        currentStock: stock.toFixed(3),
        stockStatus,
        totalValuation: totalValuation.toFixed(2)
      };
    });

    if (status && status !== "ALL") {
      data = data.filter((item: any) => item.stockStatus === status);
    }

    return {
      data,
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  static async getProductById(companyId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, companyId }
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const [movements, warehouses, category] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { productId: id, companyId }
      }),
      prisma.warehouse.findMany({
        where: { companyId }
      }),
      product.categoryId
        ? prisma.category.findFirst({ where: { id: product.categoryId, companyId } })
        : Promise.resolve(null)
    ]);

    // Calculate total stock
    let currentStock = new Decimal(0);
    const warehouseStockMap = new Map<string, Decimal>();

    for (const m of movements) {
      const qty = new Decimal(m.quantity.toString());
      currentStock = currentStock.plus(qty);

      const whPrev = warehouseStockMap.get(m.warehouseId) || new Decimal(0);
      warehouseStockMap.set(m.warehouseId, whPrev.plus(qty));
    }

    const reorder = new Decimal(product.reorderLevel.toString());
    const cost = new Decimal(product.costPrice.toString());
    const stockStatus = ProductService.getStockStatus(currentStock, reorder, product.trackStock);

    const warehouseBreakdown = warehouses.map((w: any) => ({
      warehouseId: w.id,
      warehouseName: w.name,
      isDefault: w.isDefault,
      quantity: (warehouseStockMap.get(w.id) || new Decimal(0)).toFixed(3)
    }));

    return {
      ...product,
      categoryName: category?.name || null,
      costPrice: cost.toFixed(2),
      salePrice: new Decimal(product.salePrice.toString()).toFixed(2),
      reorderLevel: reorder.toFixed(3),
      currentStock: currentStock.toFixed(3),
      stockStatus,
      totalValuation: (currentStock.greaterThan(0) ? currentStock.times(cost) : new Decimal(0)).toFixed(2),
      warehouseBreakdown
    };
  }

  static async createProduct(companyId: string, userId: string, input: any) {
    // Verify SKU uniqueness
    const existingSku = await prisma.product.findFirst({
      where: { companyId, sku: input.sku }
    });

    if (existingSku) {
      throw new AppError(`A product with SKU '${input.sku}' already exists`, 409, "SKU_ALREADY_EXISTS");
    }

    const product = await prisma.product.create({
      data: {
        companyId,
        sku: input.sku,
        name: input.name,
        categoryId: input.categoryId || null,
        unit: input.unit || "pcs",
        costPrice: new Decimal(input.costPrice || "0.00"),
        salePrice: new Decimal(input.salePrice || "0.00"),
        reorderLevel: new Decimal(input.reorderLevel || "0.000"),
        trackStock: input.trackStock ?? true,
        barcode: input.barcode || null,
        isActive: input.isActive ?? true
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Product",
      objectId: product.id,
      action: "CREATE",
      newData: product
    });

    return ProductService.getProductById(companyId, product.id);
  }

  static async updateProduct(companyId: string, userId: string, id: string, input: any) {
    const existing = await prisma.product.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    if (input.sku && input.sku !== existing.sku) {
      const duplicateSku = await prisma.product.findFirst({
        where: { companyId, sku: input.sku, id: { not: id } }
      });
      if (duplicateSku) {
        throw new AppError(`A product with SKU '${input.sku}' already exists`, 409, "SKU_ALREADY_EXISTS");
      }
    }

    const dataToUpdate: any = {};
    if (input.sku !== undefined) dataToUpdate.sku = input.sku;
    if (input.name !== undefined) dataToUpdate.name = input.name;
    if (input.categoryId !== undefined) dataToUpdate.categoryId = input.categoryId;
    if (input.unit !== undefined) dataToUpdate.unit = input.unit;
    if (input.salePrice !== undefined) dataToUpdate.salePrice = new Decimal(input.salePrice);
    if (input.reorderLevel !== undefined) dataToUpdate.reorderLevel = new Decimal(input.reorderLevel);
    if (input.trackStock !== undefined) dataToUpdate.trackStock = input.trackStock;
    if (input.barcode !== undefined) dataToUpdate.barcode = input.barcode;
    if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

    const updated = await prisma.product.update({
      where: { id },
      data: dataToUpdate
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Product",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    return ProductService.getProductById(companyId, id);
  }

  static async deleteProduct(companyId: string, userId: string, id: string) {
    const existing = await prisma.product.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    // Check movements count
    const movementCount = await prisma.stockMovement.count({
      where: { productId: id, companyId }
    });

    if (movementCount > 0) {
      throw new AppError("Cannot delete product with recorded stock movements. Set product to inactive instead.", 422, "TRANSACTION_HISTORY_EXISTS");
    }

    await prisma.product.delete({ where: { id } });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Product",
      objectId: id,
      action: "DELETE",
      oldData: existing
    });

    return { success: true };
  }

  static async getProductByBarcode(companyId: string, barcode: string) {
    const product = await prisma.product.findFirst({
      where: { companyId, barcode, isActive: true }
    });

    if (!product) {
      throw new AppError(`No active product found with barcode '${barcode}'.`, 404, "BARCODE_NOT_FOUND");
    }

    return ProductService.getProductById(companyId, product.id);
  }
}
