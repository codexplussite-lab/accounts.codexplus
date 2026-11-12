import { z } from "zod";

export const stockStatusEnum = z.enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]);

export const createProductSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(2, "Product name must be at least 2 characters"),
  categoryId: z.string().optional().nullable(),
  unit: z.string().default("pcs"),
  costPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Cost price must be a valid monetary string").default("0.00"),
  salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Sale price must be a valid monetary string").default("0.00"),
  reorderLevel: z.string().regex(/^\d+(\.\d{1,3})?$/, "Reorder level must be a valid quantity").default("0.000"),
  trackStock: z.boolean().default(true),
  barcode: z.string().optional().nullable(),
  isActive: z.boolean().default(true)
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  status: stockStatusEnum.optional(),
  isActive: z.string().transform((v) => v === "true").optional(),
  page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default("1"),
  limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default("20")
});

export const createCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters")
});

export const updateCategorySchema = createCategorySchema;

export const createWarehouseSchema = z.object({
  name: z.string().min(2, "Warehouse name must be at least 2 characters"),
  isDefault: z.boolean().default(false)
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const openingStockSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, "Quantity must be a positive number"),
  unitCost: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit cost must be a positive amount"),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).default(() => new Date().toISOString())
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  quantity: z.string().regex(/^-?\d+(\.\d{1,3})?$/, "Adjustment quantity must be a signed number (e.g. +5 or -2)"),
  reason: z.string().min(3, "Mandatory audit reason required for stock adjustment"),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).default(() => new Date().toISOString())
});

export const warehouseTransferSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  fromWarehouseId: z.string().min(1, "Source warehouse is required"),
  toWarehouseId: z.string().min(1, "Destination warehouse is required"),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, "Transfer quantity must be a positive number"),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).default(() => new Date().toISOString()),
  note: z.string().optional().nullable()
}).refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
  message: "Source and destination warehouses must be different"
});
