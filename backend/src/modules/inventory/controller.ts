import { Request, Response, NextFunction } from "express";
import { ProductService } from "./product.service.js";
import { CategoryService } from "./category.service.js";
import { WarehouseService } from "./warehouse.service.js";
import { StockMovementService } from "./stockMovement.service.js";
import { InventoryReportsService } from "./reports.service.js";
import { evaluateStockAlerts } from "../../jobs/stockAlerts.js";

export class InventoryController {
  // Products
  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductService.listProducts(req.companyId!, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.getProductById(req.companyId!, req.params.id);
      res.json({ data: product });
    } catch (err) {
      next(err);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.createProduct(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: product });
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.updateProduct(req.companyId!, req.user!.id, req.params.id, req.body);
      res.json({ data: product });
    } catch (err) {
      next(err);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductService.deleteProduct(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  // Categories
  static async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CategoryService.listCategories(req.companyId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CategoryService.createCategory(req.companyId!, req.user!.id, req.body.name);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CategoryService.updateCategory(req.companyId!, req.user!.id, req.params.id, req.body.name);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CategoryService.deleteCategory(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  // Warehouses
  static async listWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WarehouseService.listWarehouses(req.companyId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getWarehouseById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WarehouseService.getWarehouseById(req.companyId!, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WarehouseService.createWarehouse(req.companyId!, req.user!.id, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WarehouseService.updateWarehouse(req.companyId!, req.user!.id, req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await WarehouseService.deleteWarehouse(req.companyId!, req.user!.id, req.params.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  // Stock Movements & Accounting Integration
  static async recordOpeningStock(req: Request, res: Response, next: NextFunction) {
    try {
      const movement = await StockMovementService.recordOpeningStock(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: movement });
    } catch (err) {
      next(err);
    }
  }

  static async recordStockAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const movement = await StockMovementService.recordStockAdjustment(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: movement });
    } catch (err) {
      next(err);
    }
  }

  static async recordWarehouseTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StockMovementService.recordWarehouseTransfer(req.companyId!, req.user!.id, req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  // Reports
  static async getStockSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryReportsService.getStockSummary(req.companyId!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getProductStockLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryReportsService.getProductStockLedger(req.companyId!, req.params.productId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getStockValuation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryReportsService.getStockValuation(req.companyId!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getWarehouseDistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryReportsService.getWarehouseDistribution(req.companyId!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await evaluateStockAlerts(req.companyId!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
