import { Prisma, EntryStatus } from "@prisma/client";
import { Decimal, toDecimal, isEqual } from "./money.js";
import { assertPeriodUnlocked } from "./periodLock.js";
import { getNextSequence } from "./sequence.js";
import { createAuditLog } from "./audit.js";
import { AppError } from "../middleware/errorHandler.js";

export interface JournalLineInput {
  accountId: string;
  contactId?: string | null;
  debit: string | number | Decimal;
  credit: string | number | Decimal;
  memo?: string | null;
}

export interface PostJournalInput {
  companyId: string;
  date: Date;
  narration?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  createdById?: string | null;
  lines: JournalLineInput[];
}

export async function postJournal(
  tx: Prisma.TransactionClient,
  input: PostJournalInput
) {
  // 1. Line Count Validation
  if (!input.lines || input.lines.length < 2) {
    throw new AppError(
      "A journal entry must contain at least 2 lines.",
      422,
      "INVALID_LINE_COUNT"
    );
  }

  // 2. Validate individual line integrity and calculate balanced totals
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  const parsedLines = input.lines.map((line, index) => {
    if (!line.accountId) {
      throw new AppError(`Line ${index + 1} must reference an accountId.`, 422, "MISSING_ACCOUNT");
    }

    const debit = toDecimal(line.debit);
    const credit = toDecimal(line.credit);

    if (debit.isNegative() || credit.isNegative()) {
      throw new AppError(`Line ${index + 1} contains negative amounts which are not permitted.`, 422, "NEGATIVE_AMOUNT");
    }

    if (debit.gt(0) && credit.gt(0)) {
      throw new AppError(
        `Line ${index + 1} cannot specify both Debit and Credit amounts simultaneously.`,
        422,
        "MUTUALLY_EXCLUSIVE_DEBIT_CREDIT"
      );
    }

    if (debit.isZero() && credit.isZero()) {
      throw new AppError(
        `Line ${index + 1} must have either Debit or Credit greater than zero.`,
        422,
        "ZERO_AMOUNT_LINE"
      );
    }

    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);

    return {
      accountId: line.accountId,
      contactId: line.contactId || null,
      debit,
      credit,
      memo: line.memo || null
    };
  });

  // 3. Strict Double-Entry Balance Check
  if (!isEqual(totalDebit, totalCredit)) {
    throw new AppError(
      `Unbalanced journal entry: Total Debit (${totalDebit.toFixed(2)}) does not equal Total Credit (${totalCredit.toFixed(2)}). Difference is ${totalDebit.minus(totalCredit).toFixed(2)}.`,
      422,
      "UNBALANCED_ENTRY",
      { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2) }
    );
  }

  // 4. Accounting Period & Fiscal Year Lock Check
  await assertPeriodUnlocked(tx, input.companyId, input.date);

  // 5. Verify accounts belong to company
  const accountIds = Array.from(new Set(parsedLines.map((l) => l.accountId)));
  const existingAccounts = await tx.account.findMany({
    where: {
      id: { in: accountIds },
      companyId: input.companyId,
      isActive: true
    },
    select: { id: true, name: true, code: true }
  });

  if (existingAccounts.length !== accountIds.length) {
    throw new AppError(
      "One or more referenced accounts do not exist, are inactive, or do not belong to this company.",
      422,
      "INVALID_ACCOUNT_REFERENCE"
    );
  }

  // 6. Concurrency-Safe Sequence Number Generation
  const number = await getNextSequence(tx, input.companyId, "JV", input.date.getFullYear());

  // 7. Insert Immutable Posted Journal Entry
  const entry = await tx.journalEntry.create({
    data: {
      companyId: input.companyId,
      number,
      date: input.date,
      narration: input.narration || null,
      status: EntryStatus.POSTED,
      sourceType: input.sourceType || "MANUAL",
      sourceId: input.sourceId || null,
      createdById: input.createdById || null,
      lines: {
        create: parsedLines.map((l) => ({
          accountId: l.accountId,
          contactId: l.contactId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo
        }))
      }
    },
    include: {
      lines: {
        include: {
          account: {
            select: { id: true, code: true, name: true, type: true }
          }
        }
      }
    }
  });

  // 8. Append-Only Audit Trail
  await createAuditLog(tx, {
    companyId: input.companyId,
    userId: input.createdById,
    model: "JournalEntry",
    objectId: entry.id,
    action: "POST",
    newData: {
      number: entry.number,
      date: entry.date,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      linesCount: parsedLines.length
    }
  });

  return entry;
}

