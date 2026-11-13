import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { toDecimal, sumDecimals, equalsDecimal } from "../../lib/money.js";
import { createAuditLog } from "../../lib/audit.js";
import {
  CreateBankAccountInput,
  ImportStatementInput,
  ManualMatchInput
} from "./schema.js";

export interface ParsedCsvLine {
  date: Date;
  description: string;
  reference?: string;
  amount: Decimal; // positive for deposit, negative for withdrawal
}

export class BankingService {
  /**
   * Creates a new bank account linked to an asset account in the General Ledger.
   */
  static async createBankAccount(
    companyId: string,
    input: CreateBankAccountInput,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // Validate that account exists and is an ASSET
      const account = await tx.account.findFirst({
        where: { id: input.accountId, companyId }
      });

      if (!account) {
        throw new AppError("Chart of accounts entry not found.", 404, "ACCOUNT_NOT_FOUND");
      }

      if (account.type !== "ASSET") {
        throw new AppError(
          "Bank account must link to an ASSET account.",
          422,
          "INVALID_ACCOUNT_TYPE"
        );
      }

      const bankAccount = await tx.bankAccount.create({
        data: {
          companyId,
          name: input.name,
          accountId: input.accountId,
          accountNo: input.accountNo || null
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "BankAccount",
        objectId: bankAccount.id,
        action: "CREATE",
        newData: bankAccount,
        ipAddress
      });

      return bankAccount;
    });
  }

  /**
   * Lists bank accounts with their calculated General Ledger book balance.
   */
  static async listBankAccounts(companyId: string) {
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { companyId }
    });

    const accountIds = bankAccounts.map((b) => b.accountId);

    // Fetch posted journal lines for linked accounts to compute GL balances
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: { in: accountIds },
        entry: {
          companyId,
          status: "POSTED"
        }
      },
      select: {
        accountId: true,
        debit: true,
        credit: true
      }
    });

    const balanceMap = new Map<string, Decimal>();
    for (const line of lines) {
      const current = balanceMap.get(line.accountId) || new Decimal(0);
      const debit = toDecimal(line.debit);
      const credit = toDecimal(line.credit);
      // Asset normal balance = debits - credits
      balanceMap.set(line.accountId, current.plus(debit).minus(credit));
    }

    return bankAccounts.map((b) => ({
      ...b,
      bookBalance: (balanceMap.get(b.accountId) || new Decimal(0)).toFixed(2)
    }));
  }

  /**
   * Robust CSV parser for bank statements.
   * Supports headers like:
   * Date, Description, Reference, Debit, Credit
   * Date, Description, Amount
   */
  static parseStatementCsv(csvContent: string): ParsedCsvLine[] {
    const rawLines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length < 2) {
      throw new AppError("CSV file must contain a header and at least one transaction row.", 400, "INVALID_CSV");
    }

    // Split CSV line respecting quotes
    const parseCsvRow = (row: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvRow(rawLines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

    const dateIdx = headers.findIndex((h) => h.includes("date"));
    const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("narration") || h.includes("particular"));
    const refIdx = headers.findIndex((h) => h.includes("ref") || h.includes("cheque") || h.includes("check"));
    const debitIdx = headers.findIndex((h) => h.includes("debit") || h.includes("withdrawal") || h.includes("out"));
    const creditIdx = headers.findIndex((h) => h.includes("credit") || h.includes("deposit") || h.includes("in"));
    const amountIdx = headers.findIndex((h) => h.includes("amount"));

    if (dateIdx === -1) {
      throw new AppError("CSV header must contain a 'Date' column.", 400, "MISSING_CSV_DATE");
    }

    const parsed: ParsedCsvLine[] = [];

    for (let i = 1; i < rawLines.length; i++) {
      const row = parseCsvRow(rawLines[i]);
      if (row.length <= dateIdx || !row[dateIdx]) continue;

      const rawDate = row[dateIdx];
      const date = new Date(rawDate);
      if (isNaN(date.getTime())) {
        continue; // skip invalid date rows
      }

      const description = descIdx !== -1 && row[descIdx] ? row[descIdx] : "Bank Transaction";
      const reference = refIdx !== -1 && row[refIdx] ? row[refIdx] : undefined;

      let lineAmount = new Decimal(0);

      if (debitIdx !== -1 && creditIdx !== -1) {
        const rawDebit = row[debitIdx]?.replace(/[^0-9.-]/g, "") || "0";
        const rawCredit = row[creditIdx]?.replace(/[^0-9.-]/g, "") || "0";
        const debit = new Decimal(rawDebit || 0);
        const credit = new Decimal(rawCredit || 0);

        if (credit.greaterThan(0)) {
          lineAmount = credit; // Deposit / incoming money is positive
        } else if (debit.greaterThan(0)) {
          lineAmount = debit.negated(); // Withdrawal / outgoing money is negative
        }
      } else if (amountIdx !== -1) {
        const rawAmt = row[amountIdx]?.replace(/[^0-9.-]/g, "") || "0";
        lineAmount = new Decimal(rawAmt || 0);
      }

      if (!lineAmount.isZero()) {
        parsed.push({
          date,
          description,
          reference,
          amount: lineAmount
        });
      }
    }

    if (parsed.length === 0) {
      throw new AppError("No valid transactions found in the CSV statement.", 400, "EMPTY_STATEMENT");
    }

    return parsed;
  }

  /**
   * Imports a bank statement.
   * STRICT INTEGRITY RULE: NEVER creates duplicate journal entries!
   * Only stores external bank statement lines for matching.
   */
  static async importStatement(
    companyId: string,
    input: ImportStatementInput,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: input.bankAccountId, companyId }
      });

      if (!bankAccount) {
        throw new AppError("Bank account not found.", 404, "BANK_ACCOUNT_NOT_FOUND");
      }

      const parsedLines = this.parseStatementCsv(input.csvContent);

      const dates = parsedLines.map((l) => l.date.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      const openingBal = input.openingBalance ? new Decimal(input.openingBalance) : new Decimal(0);
      const totalMovement = sumDecimals(parsedLines.map((l) => l.amount));
      const closingBal = input.closingBalance
        ? new Decimal(input.closingBalance)
        : openingBal.plus(totalMovement);

      const statement = await tx.bankStatement.create({
        data: {
          companyId,
          bankAccountId: input.bankAccountId,
          fileName: input.fileName,
          startDate: minDate,
          endDate: maxDate,
          openingBalance: openingBal,
          closingBalance: closingBal,
          lines: {
            create: parsedLines.map((l) => ({
              companyId,
              date: l.date,
              description: l.description,
              reference: l.reference || null,
              amount: l.amount,
              isReconciled: false
            }))
          }
        },
        include: { lines: true }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "BankStatement",
        objectId: statement.id,
        action: "CREATE",
        newData: {
          fileName: statement.fileName,
          lineCount: statement.lines.length,
          openingBalance: openingBal.toFixed(2),
          closingBalance: closingBal.toFixed(2)
        },
        ipAddress
      });

      return statement;
    });
  }

  /**
   * Automated matching engine:
   * Matches statement transactions to General Ledger journal lines where:
   * - Amount matches exactly.
   * - Date is within +/- 3 days.
   * - Direction matches (Deposit -> Bank Debit; Withdrawal -> Bank Credit).
   */
  static async autoMatch(
    companyId: string,
    statementId: string,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const statement = await tx.bankStatement.findFirst({
        where: { id: statementId, companyId },
        include: {
          bankAccount: true,
          lines: true
        }
      });

      if (!statement) {
        throw new AppError("Bank statement not found.", 404, "STATEMENT_NOT_FOUND");
      }

      const accountId = statement.bankAccount.accountId;

      // Fetch all posted journal lines for this bank account that are not yet matched
      const alreadyMatchedLineIds = new Set(
        statement.lines
          .filter((l) => l.isReconciled && l.matchedLineId)
          .map((l) => l.matchedLineId!)
      );

      const glLines = await tx.journalLine.findMany({
        where: {
          accountId,
          entry: {
            companyId,
            status: "POSTED"
          }
        },
        include: {
          entry: {
            select: { date: true, number: true, narration: true }
          }
        }
      });

      const candidateGlLines = glLines.filter((l) => !alreadyMatchedLineIds.has(l.id));

      let matchedCount = 0;
      const matchedGlIds = new Set<string>();

      for (const stmtLine of statement.lines) {
        if (stmtLine.isReconciled) continue;

        const stmtAmount = toDecimal(stmtLine.amount);
        const isDeposit = stmtAmount.greaterThan(0);
        const targetAmount = stmtAmount.abs();
        const stmtTime = new Date(stmtLine.date).getTime();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

        // Find candidate GL lines matching direction, amount, and date window (+/- 3 days)
        const match = candidateGlLines.find((gl) => {
          if (matchedGlIds.has(gl.id)) return false;

          const glAmount = isDeposit ? toDecimal(gl.debit) : toDecimal(gl.credit);
          if (!equalsDecimal(glAmount, targetAmount)) return false;

          const glTime = new Date(gl.entry.date).getTime();
          const diffDays = Math.abs(glTime - stmtTime);
          return diffDays <= threeDaysMs;
        });

        if (match) {
          matchedGlIds.add(match.id);
          await tx.bankStatementLine.update({
            where: { id: stmtLine.id },
            data: {
              matchedLineId: match.id,
              isReconciled: true
            }
          });
          matchedCount++;
        }
      }

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "BankStatement",
        objectId: statement.id,
        action: "UPDATE",
        newData: { autoMatchedCount: matchedCount },
        ipAddress
      });

      return {
        matchedCount,
        totalLines: statement.lines.length
      };
    });
  }

  /**
   * Manual match between a statement transaction and a GL journal line.
   */
  static async manualMatch(
    companyId: string,
    input: ManualMatchInput,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const stmtLine = await tx.bankStatementLine.findFirst({
        where: { id: input.statementLineId, companyId },
        include: { statement: true }
      });

      if (!stmtLine) {
        throw new AppError("Statement transaction not found.", 404, "STATEMENT_LINE_NOT_FOUND");
      }

      const glLine = await tx.journalLine.findFirst({
        where: {
          id: input.journalLineId,
          entry: { companyId, status: "POSTED" }
        }
      });

      if (!glLine) {
        throw new AppError("Journal line not found or not posted.", 404, "JOURNAL_LINE_NOT_FOUND");
      }

      const updated = await tx.bankStatementLine.update({
        where: { id: input.statementLineId },
        data: {
          matchedLineId: input.journalLineId,
          isReconciled: true
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "BankStatementLine",
        objectId: input.statementLineId,
        action: "UPDATE",
        newData: {
          matchedLineId: input.journalLineId,
          isReconciled: true
        },
        ipAddress
      });

      return updated;
    });
  }

  /**
   * Unmatches a previously reconciled statement line.
   */
  static async unmatch(
    companyId: string,
    statementLineId: string,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const stmtLine = await tx.bankStatementLine.findFirst({
        where: { id: statementLineId, companyId }
      });

      if (!stmtLine) {
        throw new AppError("Statement line not found.", 404, "STATEMENT_LINE_NOT_FOUND");
      }

      const updated = await tx.bankStatementLine.update({
        where: { id: statementLineId },
        data: {
          matchedLineId: null,
          isReconciled: false
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "BankStatementLine",
        objectId: statementLineId,
        action: "UPDATE",
        newData: { isReconciled: false, matchedLineId: null },
        ipAddress
      });

      return updated;
    });
  }

  /**
   * Computes comprehensive bank reconciliation summary and difference.
   */
  static async getReconciliationReport(
    companyId: string,
    bankAccountId: string,
    statementId?: string
  ) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId }
    });

    if (!bankAccount) {
      throw new AppError("Bank account not found.", 404, "BANK_ACCOUNT_NOT_FOUND");
    }

    // Get latest statement or specified statement
    const statement = await prisma.bankStatement.findFirst({
      where: {
        companyId,
        bankAccountId,
        ...(statementId ? { id: statementId } : {})
      },
      orderBy: { uploadedAt: "desc" },
      include: { lines: true }
    });

    // GL Book balance for this account
    const glLines = await prisma.journalLine.findMany({
      where: {
        accountId: bankAccount.accountId,
        entry: { companyId, status: "POSTED" }
      },
      include: {
        entry: {
          select: { id: true, number: true, date: true, narration: true }
        }
      }
    });

    let bookBalance = new Decimal(0);
    for (const l of glLines) {
      bookBalance = bookBalance.plus(toDecimal(l.debit)).minus(toDecimal(l.credit));
    }

    if (!statement) {
      return {
        bankAccount,
        statement: null,
        statementBalance: "0.00",
        bookBalance: bookBalance.toFixed(2),
        reconciledBalance: "0.00",
        difference: bookBalance.abs().toFixed(2),
        status: "NO_STATEMENT",
        statementLines: [],
        unmatchedGlLines: glLines.map((l) => ({
          id: l.id,
          date: l.entry.date,
          number: l.entry.number,
          narration: l.entry.narration,
          debit: toDecimal(l.debit).toFixed(2),
          credit: toDecimal(l.credit).toFixed(2)
        }))
      };
    }

    const matchedLineIds = new Set(
      statement.lines
        .filter((l) => l.isReconciled && l.matchedLineId)
        .map((l) => l.matchedLineId!)
    );

    const statementBalance = toDecimal(statement.closingBalance);

    // Calculate uncleared book items
    const unclearedGlLines = glLines.filter((l) => !matchedLineIds.has(l.id));
    let unclearedDeposits = new Decimal(0);
    let unclearedWithdrawals = new Decimal(0);

    for (const l of unclearedGlLines) {
      unclearedDeposits = unclearedDeposits.plus(toDecimal(l.debit));
      unclearedWithdrawals = unclearedWithdrawals.plus(toDecimal(l.credit));
    }

    // Adjusted Book Balance = Book Balance + Uncleared Statement items (or Book + Uncleared Deposits - Uncleared Withdrawals)
    // Formula: Bank Statement Balance - Uncleared Withdrawals + Uncleared Deposits = Book Balance
    // Reconciliation Difference = Statement Balance - Book Balance - (Uncleared Statement Lines not in GL)
    const unmatchedStmtLines = statement.lines.filter((l) => !l.isReconciled);
    const unmatchedStmtTotal = sumDecimals(unmatchedStmtLines.map((l) => l.amount));

    // Difference between statement balance and adjusted book balance
    const difference = statementBalance.minus(bookBalance).minus(unmatchedStmtTotal);

    const isReconciled = difference.isZero() && unmatchedStmtLines.length === 0;

    return {
      bankAccount,
      statement: {
        id: statement.id,
        fileName: statement.fileName,
        uploadedAt: statement.uploadedAt,
        startDate: statement.startDate,
        endDate: statement.endDate,
        openingBalance: toDecimal(statement.openingBalance).toFixed(2),
        closingBalance: statementBalance.toFixed(2)
      },
      statementBalance: statementBalance.toFixed(2),
      bookBalance: bookBalance.toFixed(2),
      unclearedDeposits: unclearedDeposits.toFixed(2),
      unclearedWithdrawals: unclearedWithdrawals.toFixed(2),
      unmatchedStatementTotal: unmatchedStmtTotal.toFixed(2),
      difference: difference.abs().toFixed(2),
      status: isReconciled ? "RECONCILED" : "UNRECONCILED",
      statementLines: statement.lines.map((l) => ({
        id: l.id,
        date: l.date,
        description: l.description,
        reference: l.reference,
        amount: toDecimal(l.amount).toFixed(2),
        isReconciled: l.isReconciled,
        matchedLineId: l.matchedLineId
      })),
      unmatchedGlLines: unclearedGlLines.map((l) => ({
        id: l.id,
        date: l.entry.date,
        number: l.entry.number,
        narration: l.entry.narration,
        debit: toDecimal(l.debit).toFixed(2),
        credit: toDecimal(l.credit).toFixed(2)
      }))
    };
  }
}
