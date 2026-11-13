import { Router } from "express";
import { Role } from "@prisma/client";
import { InventoryController } from "./controller.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  createWarehouseSchema,
  updateWarehouseSchema,
  openingStockSchema,
  stockAdjustmentSchema,
  warehouseTransferSchema
} from "./schema.js";
import { requireRole } from "../../middleware/requireRole.js";
import { authenticate } from "../../middleware/authenticate.js";
import { companyScope } from "../../middleware/companyScope.js";

const router = Router();

router.use(authenticate, companyScope);

// Products
router.get("/products", validateQuery(productQuerySchema), InventoryController.listProducts);
router.get("/products/barcode/:barcode", InventoryController.getProductByBarcode);
router.get("/products/:id", InventoryController.getProductById);
router.post(
  "/products",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createProductSchema),
  InventoryController.createProduct
);
router.put(
  "/products/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateProductSchema),
  InventoryController.updateProduct
);
router.delete(
  "/products/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  InventoryController.deleteProduct
);

// Categories
router.get("/categories", InventoryController.listCategories);
router.post(
  "/categories",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createCategorySchema),
  InventoryController.createCategory
);
router.put(
  "/categories/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateCategorySchema),
  InventoryController.updateCategory
);
router.delete(
  "/categories/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  InventoryController.deleteCategory
);

// Warehouses
router.get("/warehouses", InventoryController.listWarehouses);
router.get("/warehouses/:id", InventoryController.getWarehouseById);
router.post(
  "/warehouses",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(createWarehouseSchema),
  InventoryController.createWarehouse
);
router.put(
  "/warehouses/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(updateWarehouseSchema),
  InventoryController.updateWarehouse
);
router.delete(
  "/warehouses/:id",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  InventoryController.deleteWarehouse
);

// Stock Movements
router.post(
  "/opening-stock",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(openingStockSchema),
  InventoryController.recordOpeningStock
);
router.post(
  "/adjustment",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(stockAdjustmentSchema),
  InventoryController.recordStockAdjustment
);
router.post(
  "/transfer",
  requireRole(Role.OWNER, Role.ACCOUNTANT),
  validateBody(warehouseTransferSchema),
  InventoryController.recordWarehouseTransfer
);

// Reports
router.get("/reports/summary", InventoryController.getStockSummary);
router.get("/reports/ledger/:productId", InventoryController.getProductStockLedger);
router.get("/reports/valuation", InventoryController.getStockValuation);
router.get("/reports/warehouse-stock", InventoryController.getWarehouseDistribution);
router.get("/reports/alerts", InventoryController.getAlerts);

export default router;
