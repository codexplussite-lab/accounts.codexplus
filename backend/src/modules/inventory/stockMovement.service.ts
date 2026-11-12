import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { assertPeriodUnlocked } from "../../lib/periodLock.js";
import { postJournal } from "../../lib/posting.js";

export class StockMovementService {
  /**
   * Opening Stock Entry:
   * Dr Inventory Asset (1200)
   * Cr Capital (3001)
   * + StockMovement(OPENING)
   */
  static async recordOpeningStock(companyId: string, userId: string, input: any) {
    const qty = new Decimal(input.quantity);
    const unitCost = new Decimal(input.unitCost);
    if (qty.lessThanOrEqualTo(0) || unitCost.isNegative()) {
      throw new AppError("Opening quantity must be positive and cost non-negative", 422, "INVALID_INPUT");
    }

    const entryDate = new Date(input.date);
    await assertPeriodUnlocked(prisma, companyId, entryDate);

    const [product, warehouse, accounts] = await Promise.all([
      prisma.product.findFirst({ where: { id: input.productId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: input.warehouseId, companyId } }),
      prisma.account.findMany({
        where: {
          companyId,
          systemKey: { in: ["INVENTORY", "CAPITAL"] }
        }
      })
    ]);

    if (!product) throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    if (!warehouse) throw new AppError("Warehouse not found", 404, "WAREHOUSE_NOT_FOUND");

    const invAcc = accounts.find((a: any) => a.systemKey === "INVENTORY");
    const capAcc = accounts.find((a: any) => a.systemKey === "CAPITAL");

    if (!invAcc || !capAcc) {
      throw new AppError("System accounts for Inventory or Capital missing in Chart of Accounts", 422, "ACCOUNTS_MISSING");
    }

    const totalValuation = qty.times(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Post Balanced Journal Entry (if valuation > 0)
      if (totalValuation.greaterThan(0)) {
        await postJournal(tx, {
          companyId,
          date: entryDate,
          narration: `Opening stock for ${product.name} (${qty.toFixed(3)} ${product.unit} @ ${unitCost.toFixed(2)})`,
          sourceType: "OPENING",
          sourceId: product.id,
          createdById: userId,
          lines: [
            {
              accountId: invAcc.id,
              debit: totalValuation.toFixed(2),
              credit: "0.00",
              memo: `Opening inventory: ${product.name}`
            },
            {
              accountId: capAcc.id,
              debit: "0.00",
              credit: totalValuation.toFixed(2),
              memo: `Capital equity for opening inventory: ${product.name}`
            }
          ]
        });
      }

      // 2. Create StockMovement
      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: qty,
          unitCost,
          type: "OPENING",
          date: entryDate,
          sourceType: "OPENING",
          sourceId: product.id,
          note: `Opening stock entry in ${warehouse.name}`
        }
      });

      // 3. Update Product costPrice if currently 0
      const currentCost = new Decimal(product.costPrice.toString());
      if (currentCost.isZero()) {
        await tx.product.update({
          where: { id: product.id },
          data: { costPrice: unitCost }
        });
      }

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "StockMovement",
        objectId: movement.id,
        action: "CREATE",
        newData: movement
      });

      return movement;
    });

    return result;
  }

  /**
   * Stock Adjustment:
   * Mandatory reason required.
   * If quantity > 0 (Gain):
   *   Dr Inventory Asset
   *   Cr COGS / Inventory Variance (5001)
   * If quantity < 0 (Loss / Shrinkage):
   *   Dr COGS / Inventory Variance (5001)
   *   Cr Inventory Asset
   * StockMovement(ADJUSTMENT)
   */
  static async recordStockAdjustment(companyId: string, userId: string, input: any) {
    const adjQty = new Decimal(input.quantity);
    if (adjQty.isZero()) {
      throw new AppError("Adjustment quantity cannot be zero", 422, "ZERO_QUANTITY");
    }

    if (!input.reason || input.reason.trim().length < 3) {
      throw new AppError("A descriptive reason (min 3 characters) is mandatory for stock adjustment", 422, "REASON_REQUIRED");
    }

    const entryDate = new Date(input.date);
    await assertPeriodUnlocked(prisma, companyId, entryDate);

    const [product, warehouse, company, accounts] = await Promise.all([
      prisma.product.findFirst({ where: { id: input.productId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: input.warehouseId, companyId } }),
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.account.findMany({
        where: {
          companyId,
          systemKey: { in: ["INVENTORY", "COGS"] }
        }
      })
    ]);

    if (!product) throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    if (!warehouse) throw new AppError("Warehouse not found", 404, "WAREHOUSE_NOT_FOUND");

    const invAcc = accounts.find((a: any) => a.systemKey === "INVENTORY");
    const cogsAcc = accounts.find((a: any) => a.systemKey === "COGS");

    if (!invAcc || !cogsAcc) {
      throw new AppError("System accounts for Inventory or COGS missing in Chart of Accounts", 422, "ACCOUNTS_MISSING");
    }

    const unitCost = new Decimal(product.costPrice.toString());
    const adjValue = adjQty.abs().times(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const result = await prisma.$transaction(async (tx: any) => {
      // Check negative stock guard
      if (adjQty.isNegative() && company && !company.allowNegativeStock) {
        const whMovements = await tx.stockMovement.findMany({
          where: { productId: product.id, warehouseId: warehouse.id, companyId }
        });
        const currentWhStock = whMovements.reduce(
          (sum: Decimal, m: any) => sum.plus(new Decimal(m.quantity.toString())),
          new Decimal(0)
        );

        if (currentWhStock.lessThan(adjQty.abs())) {
          throw new AppError(
            `Insufficient stock in ${warehouse.name} for negative adjustment. Available: ${currentWhStock.toFixed(3)}, Adjustment: ${adjQty.toFixed(3)}`,
            422,
            "INSUFFICIENT_STOCK"
          );
        }
      }

      // 1. Post Balanced Journal Entry (if valuation > 0)
      if (adjValue.greaterThan(0)) {
        const journalLines = adjQty.isPositive()
          ? [
              {
                accountId: invAcc.id,
                debit: adjValue.toFixed(2),
                credit: "0.00",
                memo: `Stock adjustment gain: ${product.name} (+${adjQty.toFixed(3)})`
              },
              {
                accountId: cogsAcc.id,
                debit: "0.00",
                credit: adjValue.toFixed(2),
                memo: `Stock variance gain: ${input.reason}`
              }
            ]
          : [
              {
                accountId: cogsAcc.id,
                debit: adjValue.toFixed(2),
                credit: "0.00",
                memo: `Stock variance loss: ${input.reason}`
              },
              {
                accountId: invAcc.id,
                debit: "0.00",
                credit: adjValue.toFixed(2),
                memo: `Stock adjustment deduction: ${product.name} (${adjQty.toFixed(3)})`
              }
            ];

        await postJournal(tx, {
          companyId,
          date: entryDate,
          narration: `Stock Adjustment: ${product.name} (${adjQty.isPositive() ? "+" : ""}${adjQty.toFixed(3)}) - ${input.reason}`,
          sourceType: "ADJUSTMENT",
          sourceId: product.id,
          createdById: userId,
          lines: journalLines
        });
      }

      // 2. Create StockMovement
      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: adjQty,
          unitCost,
          type: "ADJUSTMENT",
          date: entryDate,
          sourceType: "ADJUSTMENT",
          sourceId: product.id,
          note: input.reason
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "StockMovement",
        objectId: movement.id,
        action: "CREATE",
        newData: movement
      });

      return movement;
    });

    return result;
  }

  /**
   * Warehouse Transfer:
   * Transfers stock between two warehouses atomically without changing company-wide stock.
   * Creates:
   *   StockMovement(TRANSFER_OUT, warehouseId: from, quantity: -qty)
   *   StockMovement(TRANSFER_IN, warehouseId: to, quantity: +qty)
   */
  static async recordWarehouseTransfer(companyId: string, userId: string, input: any) {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new AppError("Source and destination warehouses must be different", 422, "IDENTICAL_WAREHOUSES");
    }

    const transferQty = new Decimal(input.quantity);
    if (transferQty.lessThanOrEqualTo(0)) {
      throw new AppError("Transfer quantity must be positive", 422, "INVALID_QUANTITY");
    }

    const entryDate = new Date(input.date);
    await assertPeriodUnlocked(prisma, companyId, entryDate);

    const [product, fromWh, toWh, company] = await Promise.all([
      prisma.product.findFirst({ where: { id: input.productId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: input.fromWarehouseId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: input.toWarehouseId, companyId } }),
      prisma.company.findUnique({ where: { id: companyId } })
    ]);

    if (!product) throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    if (!fromWh) throw new AppError("Source warehouse not found", 404, "SOURCE_WAREHOUSE_NOT_FOUND");
    if (!toWh) throw new AppError("Destination warehouse not found", 404, "DESTINATION_WAREHOUSE_NOT_FOUND");

    const unitCost = new Decimal(product.costPrice.toString());

    const result = await prisma.$transaction(async (tx: any) => {
      // Check available stock in source warehouse if negative stock disabled
      if (company && !company.allowNegativeStock) {
        const sourceMovements = await tx.stockMovement.findMany({
          where: { productId: product.id, warehouseId: fromWh.id, companyId }
        });
        const availableInSource = sourceMovements.reduce(
          (sum: Decimal, m: any) => sum.plus(new Decimal(m.quantity.toString())),
          new Decimal(0)
        );

        if (availableInSource.lessThan(transferQty)) {
          throw new AppError(
            `Insufficient stock in ${fromWh.name} for transfer. Available: ${availableInSource.toFixed(3)}, Transfer: ${transferQty.toFixed(3)}`,
            422,
            "INSUFFICIENT_STOCK"
          );
        }
      }

      // 1. Transfer Out movement (-qty)
      const transferOut = await tx.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          warehouseId: fromWh.id,
          quantity: transferQty.negated(),
          unitCost,
          type: "TRANSFER_OUT",
          date: entryDate,
          sourceType: "TRANSFER",
          sourceId: toWh.id,
          note: `Transfer to ${toWh.name}${input.note ? `: ${input.note}` : ""}`
        }
      });

      // 2. Transfer In movement (+qty)
      const transferIn = await tx.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          warehouseId: toWh.id,
          quantity: transferQty,
          unitCost,
          type: "TRANSFER_IN",
          date: entryDate,
          sourceType: "TRANSFER",
          sourceId: fromWh.id,
          note: `Transfer from ${fromWh.name}${input.note ? `: ${input.note}` : ""}`
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "StockMovement",
        objectId: `${transferOut.id}_${transferIn.id}`,
        action: "CREATE",
        newData: { transferOut, transferIn }
      });

      return { transferOut, transferIn };
    });

    return result;
  }
}
