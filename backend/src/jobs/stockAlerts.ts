import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../config/prisma.js";
import { Decimal } from "decimal.js";
import { ProductService } from "../modules/inventory/product.service.js";

export interface StockAlertResult {
  companyId: string;
  lowStockItems: Array<{ sku: string; name: string; currentStock: string; reorderLevel: string }>;
  outOfStockItems: Array<{ sku: string; name: string; currentStock: string }>;
}

/**
 * Core evaluation logic for stock alerts
 */
export async function evaluateStockAlerts(companyId: string): Promise<StockAlertResult> {
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, isActive: true, trackStock: true }
    }),
    prisma.stockMovement.findMany({
      where: { companyId }
    })
  ]);

  const stockMap = new Map<string, Decimal>();
  for (const m of movements) {
    const prev = stockMap.get(m.productId) || new Decimal(0);
    stockMap.set(m.productId, prev.plus(new Decimal(m.quantity.toString())));
  }

  const lowStockItems: StockAlertResult["lowStockItems"] = [];
  const outOfStockItems: StockAlertResult["outOfStockItems"] = [];

  for (const p of products) {
    const stock = stockMap.get(p.id) || new Decimal(0);
    const reorder = new Decimal(p.reorderLevel.toString());
    const status = ProductService.getStockStatus(stock, reorder, p.trackStock);

    if (status === "OUT_OF_STOCK") {
      outOfStockItems.push({
        sku: p.sku,
        name: p.name,
        currentStock: stock.toFixed(3)
      });
    } else if (status === "LOW_STOCK") {
      lowStockItems.push({
        sku: p.sku,
        name: p.name,
        currentStock: stock.toFixed(3),
        reorderLevel: reorder.toFixed(3)
      });
    }
  }

  logger.info(
    { companyId, lowStockCount: lowStockItems.length, outOfStockCount: outOfStockItems.length },
    "Stock alerts evaluated"
  );

  return { companyId, lowStockItems, outOfStockItems };
}

// Background Queue setup
let alertQueue: Queue | null = null;
let alertWorker: Worker | null = null;

if (env.REDIS_URL && env.NODE_ENV !== "test") {
  try {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

    alertQueue = new Queue("stock-alerts", { connection });

    alertWorker = new Worker(
      "stock-alerts",
      async (job: Job) => {
        const { companyId } = job.data;
        return evaluateStockAlerts(companyId);
      },
      { connection }
    );

    alertWorker.on("completed", (job) => {
      logger.info({ jobId: job.id }, "Stock alerts job completed successfully");
    });

    alertWorker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, "Stock alerts job failed");
    });
  } catch (err: any) {
    logger.warn({ error: err.message }, "Redis connection failed. Running in-memory alert fallback.");
  }
}

export { alertQueue, alertWorker };
