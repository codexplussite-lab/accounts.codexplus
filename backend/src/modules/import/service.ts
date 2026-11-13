import { Decimal } from "decimal.js";
import { AccountType, ContactType, MovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { toDecimal } from "../../lib/money.js";
import { createAuditLog } from "../../lib/audit.js";
import { postJournal } from "../../lib/posting.js";

export class ImportService {
  /**
   * Helper to parse CSV rows into array of string arrays.
   */
  static parseCsv(csvContent: string): string[][] {
    const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      throw new AppError("CSV file must contain a header and at least one data row.", 400, "INVALID_CSV");
    }

    return lines.map((line) => {
      const row: string[] = [];
      let inQuotes = false;
      let cur = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          row.push(cur.trim());
          cur = "";
        } else {
          cur += char;
        }
      }
      row.push(cur.trim());
      return row;
    });
  }

  /**
   * Helper to normalize input whether sent as raw CSV text or array of parsed objects.
   */
  static parseInput(input: string | Record<string, any>[]): string[][] {
    if (Array.isArray(input)) {
      if (input.length === 0) {
        throw new AppError("CSV payload contains no data rows.", 400, "EMPTY_DATA");
      }
      const headers = Object.keys(input[0]);
      const dataRows = input.map((obj) => headers.map((h) => String(obj[h] ?? "").trim()));
      return [headers, ...dataRows];
    }
    return this.parseCsv(input);
  }

  /**
   * Helper to safely sanitize numeric currency values without crashing the transaction.
   */
  static cleanToDecimal(val: any, fallback = new Decimal(0)): Decimal {
    if (val === null || val === undefined || val === "") return fallback;
    if (val instanceof Decimal) return val;
    try {
      const sanitized = String(val).replace(/[^0-9.-]+/g, "").trim();
      if (!sanitized) return fallback;
      return new Decimal(sanitized);
    } catch {
      return fallback;
    }
  }

  /**
   * Bulk imports Chart of Accounts.
   */
  static async importAccounts(
    companyId: string,
    csvContent: string | Record<string, any>[],
    userId?: string,
    ipAddress?: string
  ) {
    const rows = this.parseInput(csvContent);
    const headers = rows[0].map((h) => h.toLowerCase());

    const codeIdx = headers.findIndex((h) => h.includes("code"));
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const typeIdx = headers.findIndex((h) => h.includes("type"));

    if (codeIdx === -1 || nameIdx === -1 || typeIdx === -1) {
      throw new AppError("CSV must contain 'Code', 'Name', and 'Type' columns.", 400, "MISSING_CSV_COLUMNS");
    }

    return prisma.$transaction(async (tx) => {
      let importedCount = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const code = row[codeIdx];
        const name = row[nameIdx];
        const rawType = row[typeIdx].toUpperCase();

        if (!code || !name) continue;

        if (!Object.values(AccountType).includes(rawType as AccountType)) {
          continue; // skip invalid types
        }

        const existing = await tx.account.findFirst({
          where: { companyId, code }
        });

        if (!existing) {
          await tx.account.create({
            data: {
              companyId,
              code,
              name,
              type: rawType as AccountType,
              isSystem: false
            }
          });
          importedCount++;
        }
      }

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Account",
        objectId: "BULK_IMPORT",
        action: "CREATE",
        newData: { importedCount },
        ipAddress
      });

      return { importedCount };
    });
  }

  /**
   * Bulk imports Contacts (Customers & Vendors).
   */
  static async importContacts(
    companyId: string,
    csvContent: string | Record<string, any>[],
    userId?: string,
    ipAddress?: string
  ) {
    const rows = this.parseInput(csvContent);
    const headers = rows[0].map((h) => h.toLowerCase());

    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const typeIdx = headers.findIndex((h) => h.includes("type"));
    const emailIdx = headers.findIndex((h) => h.includes("email"));
    const phoneIdx = headers.findIndex((h) => h.includes("phone"));
    const ntnIdx = headers.findIndex((h) => h.includes("ntn"));
    const addressIdx = headers.findIndex((h) => h.includes("address"));

    if (nameIdx === -1 || typeIdx === -1) {
      throw new AppError("CSV must contain 'Name' and 'Type' columns.", 400, "MISSING_CSV_COLUMNS");
    }

    return prisma.$transaction(async (tx) => {
      let importedCount = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[nameIdx];
        const rawType = row[typeIdx].toUpperCase();

        if (!name) continue;

        const contactType = ["CUSTOMER", "VENDOR", "BOTH"].includes(rawType) ? (rawType as ContactType) : ContactType.CUSTOMER;
        const email = emailIdx !== -1 ? row[emailIdx] : null;
        const phone = phoneIdx !== -1 ? row[phoneIdx] : null;
        const ntn = ntnIdx !== -1 ? row[ntnIdx] : null;
        const address = addressIdx !== -1 ? row[addressIdx] : null;

        await tx.contact.create({
          data: {
            companyId,
            name,
            type: contactType,
            email: email || null,
            phone: phone || null,
            ntn: ntn || null,
            address: address || null,
            openingBalance: new Decimal(0),
            isActive: true
          }
        });
        importedCount++;
      }

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Contact",
        objectId: "BULK_IMPORT",
        action: "CREATE",
        newData: { importedCount },
        ipAddress
      });

      return { importedCount };
    });
  }

  /**
   * Bulk imports Products and optionally creates Opening Stock with balanced accounting journals.
   */
  static async importProducts(
    companyId: string,
    csvContent: string | Record<string, any>[],
    warehouseId?: string,
    userId?: string,
    ipAddress?: string
  ) {
    const rows = this.parseInput(csvContent);
    const headers = rows[0].map((h) => h.toLowerCase());

    const skuIdx = headers.findIndex((h) => h.includes("sku"));
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const costIdx = headers.findIndex((h) => h.includes("cost"));
    const saleIdx = headers.findIndex((h) => h.includes("sale") || h.includes("price"));
    const barcodeIdx = headers.findIndex((h) => h.includes("barcode"));
    const openingStockIdx = headers.findIndex((h) => h.includes("opening") || h.includes("stock") || h.includes("qty"));

    if (skuIdx === -1 || nameIdx === -1) {
      throw new AppError("CSV must contain 'SKU' and 'Name' columns.", 400, "MISSING_CSV_COLUMNS");
    }

    return prisma.$transaction(async (tx) => {
      // Find default warehouse if not specified
      let whId = warehouseId;
      if (!whId) {
        const wh = await tx.warehouse.findFirst({ where: { companyId } });
        whId = wh?.id;
      }

      const inventoryAccount = await tx.account.findFirst({
        where: { companyId, OR: [{ systemKey: "INVENTORY" }, { code: "1200" }] }
      });
      const capitalAccount = await tx.account.findFirst({
        where: { companyId, OR: [{ systemKey: "CAPITAL" }, { code: "3001" }] }
      });

      let importedCount = 0;
      let totalOpeningStockValue = new Decimal(0);

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const sku = row[skuIdx];
        const name = row[nameIdx];

        if (!sku || !name) continue;

        const costPrice = costIdx !== -1 ? this.cleanToDecimal(row[costIdx]) : new Decimal(0);
        const salePrice = saleIdx !== -1 ? this.cleanToDecimal(row[saleIdx]) : new Decimal(0);
        const barcode = barcodeIdx !== -1 && row[barcodeIdx] ? String(row[barcodeIdx]).trim() : null;
        const openingQty = openingStockIdx !== -1 ? this.cleanToDecimal(row[openingStockIdx]) : new Decimal(0);

        const existing = await tx.product.findFirst({
          where: { companyId, sku }
        });

        if (!existing) {
          const product = await tx.product.create({
            data: {
              companyId,
              sku,
              name,
              costPrice,
              salePrice,
              barcode,
              trackStock: true,
              reorderLevel: new Decimal(10),
              isActive: true
            }
          });

          // Process opening stock if quantity is positive
          if (openingQty.greaterThan(0) && whId) {
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: product.id,
                warehouseId: whId,
                quantity: openingQty,
                unitCost: costPrice,
                type: MovementType.OPENING,
                date: new Date(),
                note: "Bulk opening stock import"
              }
            });

            const stockVal = openingQty.times(costPrice);
            totalOpeningStockValue = totalOpeningStockValue.plus(stockVal);
          }

          importedCount++;
        }
      }

      // If opening stock value was recorded and accounts exist, generate Dr Inventory / Cr Capital journal entry
      if (totalOpeningStockValue.greaterThan(0) && inventoryAccount && capitalAccount) {
        await postJournal(tx, {
          companyId,
          date: new Date(),
          narration: "Bulk Product Opening Stock Valuation",
          sourceType: "OPENING_STOCK",
          createdById: userId,
          lines: [
            { accountId: inventoryAccount.id, debit: totalOpeningStockValue, credit: new Decimal(0), memo: "Opening stock asset" },
            { accountId: capitalAccount.id, debit: new Decimal(0), credit: totalOpeningStockValue, memo: "Initial owner equity allocation" }
          ]
        });
      }

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Product",
        objectId: "BULK_IMPORT",
        action: "CREATE",
        newData: { importedCount, totalOpeningStockValue: totalOpeningStockValue.toFixed(2) },
        ipAddress
      });

      return {
        importedCount,
        totalOpeningStockValue: totalOpeningStockValue.toFixed(2)
      };
    });
  }
}
