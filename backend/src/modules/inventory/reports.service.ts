import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ProductService } from "./product.service.js";

export class InventoryReportsService {
  /**
   * Complete Stock Summary across all products
   */
  static async getStockSummary(companyId: string) {
    const [products, allMovements, categories, warehouses] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, isActive: true },
        orderBy: { name: "asc" }
      }),
      prisma.stockMovement.findMany({
        where: { companyId }
      }),
      prisma.category.findMany({ where: { companyId } }),
      prisma.warehouse.findMany({ where: { companyId } })
    ]);

    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));
    const whMap = new Map(warehouses.map((w: any) => [w.id, w.name]));

    const stockMap = new Map<string, Decimal>();
    for (const m of allMovements) {
      const prev = stockMap.get(m.productId) || new Decimal(0);
      stockMap.set(m.productId, prev.plus(new Decimal(m.quantity.toString())));
    }

    let totalValuation = new Decimal(0);
    let totalItemsInStock = new Decimal(0);
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const items = products.map((p: any) => {
      const qty = stockMap.get(p.id) || new Decimal(0);
      const cost = new Decimal(p.costPrice.toString());
      const reorder = new Decimal(p.reorderLevel.toString());
      const status = ProductService.getStockStatus(qty, reorder, p.trackStock);

      const val = qty.greaterThan(0) ? qty.times(cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : new Decimal(0);
      totalValuation = totalValuation.plus(val);

      if (qty.greaterThan(0)) totalItemsInStock = totalItemsInStock.plus(qty);
      if (status === "LOW_STOCK") lowStockCount++;
      if (status === "OUT_OF_STOCK") outOfStockCount++;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.categoryId ? catMap.get(p.categoryId) || "Uncategorized" : "Uncategorized",
        unit: p.unit,
        costPrice: cost.toFixed(2),
        salePrice: new Decimal(p.salePrice.toString()).toFixed(2),
        reorderLevel: reorder.toFixed(3),
        currentStock: qty.toFixed(3),
        totalValuation: val.toFixed(2),
        status
      };
    });

    return {
      overview: {
        totalProducts: products.length,
        totalItemsQuantity: totalItemsInStock.toFixed(3),
        totalValuation: totalValuation.toFixed(2),
        lowStockCount,
        outOfStockCount
      },
      items
    };
  }

  /**
   * Product Stock Ledger with running balance
   */
  static async getProductStockLedger(companyId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId }
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const [movements, warehouses] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { productId, companyId },
        orderBy: { date: "asc" }
      }),
      prisma.warehouse.findMany({ where: { companyId } })
    ]);

    const whMap = new Map(warehouses.map((w: any) => [w.id, w.name]));

    let runningQty = new Decimal(0);
    const cost = new Decimal(product.costPrice.toString());

    const ledgerEntries = movements.map((m: any) => {
      const qty = new Decimal(m.quantity.toString());
      runningQty = runningQty.plus(qty);

      const inQty = qty.isPositive() ? qty.toFixed(3) : "0.000";
      const outQty = qty.isNegative() ? qty.abs().toFixed(3) : "0.000";
      const unitCost = new Decimal(m.unitCost.toString());
      const value = qty.abs().times(unitCost).toFixed(2);

      return {
        id: m.id,
        date: m.date.toISOString(),
        warehouseName: whMap.get(m.warehouseId) || "Warehouse",
        type: m.type,
        sourceType: m.sourceType || "MANUAL",
        sourceId: m.sourceId,
        inQuantity: inQty,
        outQuantity: outQty,
        unitCost: unitCost.toFixed(2),
        value,
        runningQuantity: runningQty.toFixed(3),
        runningValuation: (runningQty.greaterThan(0) ? runningQty.times(cost) : new Decimal(0)).toFixed(2),
        note: m.note || null
      };
    });

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        currentCost: cost.toFixed(2),
        currentStock: runningQty.toFixed(3),
        currentValuation: (runningQty.greaterThan(0) ? runningQty.times(cost) : new Decimal(0)).toFixed(2)
      },
      ledger: ledgerEntries
    };
  }

  /**
   * Total Inventory Valuation reconciled against General Ledger
   */
  static async getStockValuation(companyId: string) {
    const summary = await InventoryReportsService.getStockSummary(companyId);

    // Fetch Inventory Asset GL account balance
    const invAccount = await prisma.account.findFirst({
      where: { companyId, systemKey: "INVENTORY" }
    });

    let glInventoryBalance = new Decimal(0);
    if (invAccount) {
      const lines = await prisma.journalLine.findMany({
        where: {
          accountId: invAccount.id,
          entry: { companyId, status: "POSTED" }
        }
      });

      for (const line of lines) {
        const dr = new Decimal(line.debit.toString());
        const cr = new Decimal(line.credit.toString());
        glInventoryBalance = glInventoryBalance.plus(dr).minus(cr);
      }
    }

    const calculatedValuation = new Decimal(summary.overview.totalValuation);
    const variance = calculatedValuation.minus(glInventoryBalance);

    return {
      valuationSummary: {
        totalInventoryValuation: calculatedValuation.toFixed(2),
        glInventoryAccountBalance: glInventoryBalance.toFixed(2),
        variance: variance.toFixed(2),
        isReconciled: variance.abs().lessThan(0.05) // balanced within rounding tolerance
      },
      products: summary.items
    };
  }

  /**
   * Stock distribution across all warehouses
   */
  static async getWarehouseDistribution(companyId: string) {
    const [warehouses, products, allMovements] = await Promise.all([
      prisma.warehouse.findMany({ where: { companyId } }),
      prisma.product.findMany({ where: { companyId, isActive: true } }),
      prisma.stockMovement.findMany({ where: { companyId } })
    ]);

    // Group by warehouse & product
    const distributionMap = new Map<string, Map<string, Decimal>>();
    warehouses.forEach((w: any) => distributionMap.set(w.id, new Map()));

    for (const m of allMovements) {
      const whMap = distributionMap.get(m.warehouseId);
      if (whMap) {
        const prev = whMap.get(m.productId) || new Decimal(0);
        whMap.set(m.productId, prev.plus(new Decimal(m.quantity.toString())));
      }
    }

    const result = warehouses.map((w: any) => {
      const whProductMap = distributionMap.get(w.id)!;
      let whValuation = new Decimal(0);
      let whTotalQty = new Decimal(0);

      const items = products
        .map((p: any) => {
          const qty = whProductMap.get(p.id) || new Decimal(0);
          const cost = new Decimal(p.costPrice.toString());
          const val = qty.greaterThan(0) ? qty.times(cost) : new Decimal(0);

          whValuation = whValuation.plus(val);
          whTotalQty = whTotalQty.plus(qty);

          return {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            quantity: qty.toFixed(3),
            unit: p.unit,
            valuation: val.toFixed(2)
          };
        })
        .filter((it: any) => parseFloat(it.quantity) !== 0);

      return {
        warehouseId: w.id,
        warehouseName: w.name,
        isDefault: w.isDefault,
        totalItemsCount: items.length,
        totalQuantity: whTotalQty.toFixed(3),
        totalValuation: whValuation.toFixed(2),
        items
      };
    });

    return { warehouses: result };
  }
}
