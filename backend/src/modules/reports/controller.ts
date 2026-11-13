import { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { GeneralLedgerService } from "./generalLedger.service.js";
import { TrialBalanceService } from "./trialBalance.service.js";
import { ProfitAndLossService } from "./profitAndLoss.service.js";
import { BalanceSheetService } from "./balanceSheet.service.js";
import { AgeingService } from "./ageing.service.js";
import { CashFlowService } from "./cashFlow.service.js";
import { SalesPurchaseReportService } from "./salesPurchaseReport.service.js";
import { TaxReportService } from "./taxReport.service.js";
import { ExportService, ReportExportData } from "./export.service.js";

export class ReportsController {
  static async getGeneralLedger(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { accountId, startDate, endDate } = req.query as any;

    const data = await GeneralLedgerService.getReport(companyId, accountId, startDate, endDate);
    res.json({ data });
  }

  static async getTrialBalance(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { asOfDate } = req.query as any;

    const data = await TrialBalanceService.getReport(companyId, asOfDate);
    res.json({ data });
  }

  static async getProfitAndLoss(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { startDate, endDate } = req.query as any;

    const data = await ProfitAndLossService.getReport(companyId, startDate, endDate);
    res.json({ data });
  }

  static async getBalanceSheet(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { asOfDate } = req.query as any;

    const data = await BalanceSheetService.getReport(companyId, asOfDate);
    res.json({ data });
  }

  static async getARAgeing(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { asOfDate } = req.query as any;

    const data = await AgeingService.getARAgeing(companyId, asOfDate);
    res.json({ data });
  }

  static async getAPAgeing(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { asOfDate } = req.query as any;

    const data = await AgeingService.getAPAgeing(companyId, asOfDate);
    res.json({ data });
  }

  static async getCashFlow(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { startDate, endDate } = req.query as any;

    const data = await CashFlowService.getReport(companyId, startDate, endDate);
    res.json({ data });
  }

  static async getSalesReport(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { startDate, endDate, customerId, productId } = req.query as any;

    const data = await SalesPurchaseReportService.getSalesReport(
      companyId,
      startDate,
      endDate,
      customerId,
      productId
    );
    res.json({ data });
  }

  static async getPurchaseReport(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { startDate, endDate, vendorId, productId } = req.query as any;

    const data = await SalesPurchaseReportService.getPurchaseReport(
      companyId,
      startDate,
      endDate,
      vendorId,
      productId
    );
    res.json({ data });
  }

  static async getTaxReport(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { startDate, endDate } = req.query as any;

    const data = await TaxReportService.getReport(companyId, startDate, endDate);
    res.json({ data });
  }

  static async exportReport(req: Request, res: Response) {
    const companyId = req.companyId!;
    const { reportType, format, startDate, endDate, asOfDate, accountId } = req.query as any;

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });
    const companyName = company?.name || "Enterprise ERP";

    let exportData: ReportExportData;

    switch (reportType) {
      case "trial-balance": {
        const tb = await TrialBalanceService.getReport(companyId, asOfDate);
        exportData = {
          title: "Trial Balance",
          companyName,
          subtitle: `As of ${new Date(tb.asOfDate).toLocaleDateString()}`,
          columns: [
            { header: "Account Code", key: "code", width: 15 },
            { header: "Account Name", key: "name", width: 35 },
            { header: "Type", key: "type", width: 16 },
            { header: "Debit (PKR)", key: "debit", width: 20, align: "right" },
            { header: "Credit (PKR)", key: "credit", width: 20, align: "right" }
          ],
          rows: tb.accounts,
          summaryRows: [
            {
              code: "TOTAL",
              name: tb.isBalanced ? "BALANCED" : "OUT OF BALANCE",
              type: "",
              debit: tb.totalDebit,
              credit: tb.totalCredit
            }
          ]
        };
        break;
      }

      case "profit-and-loss": {
        const pl = await ProfitAndLossService.getReport(companyId, startDate, endDate);
        const rows = [
          ...pl.revenue.accounts.map((a: any) => ({ section: "REVENUE", ...a })),
          ...pl.costOfGoodsSold.accounts.map((a: any) => ({ section: "COGS", ...a })),
          ...pl.operatingExpenses.accounts.map((a: any) => ({ section: "EXPENSES", ...a }))
        ];
        exportData = {
          title: "Profit and Loss Statement",
          companyName,
          subtitle: `Period: ${startDate || "Inception"} to ${endDate || "Present"}`,
          columns: [
            { header: "Section", key: "section", width: 18 },
            { header: "Code", key: "code", width: 12 },
            { header: "Account", key: "name", width: 35 },
            { header: "Amount (PKR)", key: "amount", width: 22, align: "right" }
          ],
          rows,
          summaryRows: [
            { section: "GROSS PROFIT", code: "", name: "Total Revenue - COGS", amount: pl.grossProfit },
            { section: "NET PROFIT", code: "", name: "Gross Profit - Operating Expenses", amount: pl.netProfit }
          ]
        };
        break;
      }

      case "balance-sheet": {
        const bs = await BalanceSheetService.getReport(companyId, asOfDate);
        const rows = [
          ...bs.assets.accounts.map((a: any) => ({ category: "ASSET", ...a })),
          ...bs.liabilities.accounts.map((a: any) => ({ category: "LIABILITY", ...a })),
          ...bs.equity.accounts.map((a: any) => ({ category: "EQUITY", ...a })),
          { category: "EQUITY", code: "3999", name: "Current Period Net Earnings", amount: bs.equity.currentPeriodNetEarnings }
        ];
        exportData = {
          title: "Balance Sheet",
          companyName,
          subtitle: `As of ${new Date(bs.asOfDate).toLocaleDateString()}`,
          columns: [
            { header: "Category", key: "category", width: 16 },
            { header: "Code", key: "code", width: 12 },
            { header: "Account", key: "name", width: 35 },
            { header: "Balance (PKR)", key: "amount", width: 22, align: "right" }
          ],
          rows,
          summaryRows: [
            { category: "TOTAL ASSETS", code: "", name: "", amount: bs.assets.total },
            { category: "TOTAL LIABILITIES & EQUITY", code: "", name: "", amount: bs.totalLiabilitiesAndEquity }
          ]
        };
        break;
      }

      case "ar-ageing": {
        const ar = await AgeingService.getARAgeing(companyId, asOfDate);
        exportData = {
          title: "Accounts Receivable Ageing",
          companyName,
          subtitle: `As of ${new Date(ar.asOfDate).toLocaleDateString()}`,
          columns: [
            { header: "Customer Name", key: "customerName", width: 30 },
            { header: "Total Outstanding", key: "totalOutstanding", width: 18, align: "right" },
            { header: "Current", key: "current", width: 14, align: "right" },
            { header: "0-30 Days", key: "days0_30", width: 14, align: "right" },
            { header: "31-60 Days", key: "days31_60", width: 14, align: "right" },
            { header: "61-90 Days", key: "days61_90", width: 14, align: "right" },
            { header: "90+ Days", key: "days90Plus", width: 14, align: "right" }
          ],
          rows: ar.customers,
          summaryRows: [
            {
              customerName: "GRAND TOTAL",
              totalOutstanding: ar.totals.totalOutstanding,
              current: ar.totals.current,
              days0_30: ar.totals.days0_30,
              days31_60: ar.totals.days31_60,
              days61_90: ar.totals.days61_90,
              days90Plus: ar.totals.days90Plus
            }
          ]
        };
        break;
      }

      default: {
        const tb = await TrialBalanceService.getReport(companyId, asOfDate);
        exportData = {
          title: "Financial Summary",
          companyName,
          columns: [
            { header: "Account", key: "name", width: 35 },
            { header: "Debit", key: "debit", width: 18, align: "right" },
            { header: "Credit", key: "credit", width: 18, align: "right" }
          ],
          rows: tb.accounts
        };
      }
    }

    const timestamp = new Date().toISOString().split("T")[0];

    if (format === "excel") {
      const buffer = await ExportService.generateExcel(exportData);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${reportType}-${timestamp}.xlsx"`);
      res.send(buffer);
    } else {
      const buffer = await ExportService.generatePDF(exportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${reportType}-${timestamp}.pdf"`);
      res.send(buffer);
    }
  }
}
