import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.js";

export async function assertPeriodUnlocked(
  tx: Prisma.TransactionClient,
  companyId: string,
  entryDate: Date
): Promise<void> {
  // 1. Check Company Level Period Lock (lockedUntil)
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { lockedUntil: true }
  });

  if (company?.lockedUntil) {
    const lockDate = new Date(company.lockedUntil);
    // If entry date is on or before the locked date, reject
    if (entryDate.getTime() <= lockDate.getTime()) {
      throw new AppError(
        `Transaction date (${entryDate.toISOString().split("T")[0]}) falls within locked period (locked until: ${
          lockDate.toISOString().split("T")[0]
        }). Entries are prohibited.`,
        422,
        "PERIOD_LOCKED"
      );
    }
  }

  // 2. Check Fiscal Year Lock (FiscalYear.isClosed)
  const closedFiscalYear = await tx.fiscalYear.findFirst({
    where: {
      companyId,
      isClosed: true,
      startDate: { lte: entryDate },
      endDate: { gte: entryDate }
    }
  });

  if (closedFiscalYear) {
    throw new AppError(
      `Transaction date (${entryDate.toISOString().split("T")[0]}) falls within closed fiscal year '${
        closedFiscalYear.name
      }'. Entries are prohibited.`,
      422,
      "FISCAL_YEAR_CLOSED"
    );
  }
}

