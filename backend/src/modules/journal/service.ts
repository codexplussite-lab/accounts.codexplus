import { Prisma, EntryStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { postJournal } from "../../lib/posting.js";
import { getNextSequence } from "../../lib/sequence.js";
import { createAuditLog } from "../../lib/audit.js";
import { AppError } from "../../middleware/errorHandler.js";
import { CreateJournalDraftInput, PostJournalDirectInput, ReverseJournalInput } from "./schema.js";

export class JournalService {
  async listEntries(
    companyId: string,
    query?: {
      page?: number;
      limit?: number;
      status?: EntryStatus;
      fromDate?: string;
      toDate?: string;
    }
  ) {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = {
      companyId,
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.fromDate || query?.toDate
        ? {
            date: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {})
            }
          }
        : {})
    };

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true, type: true }
              }
            }
          }
        }
      }),
      prisma.journalEntry.count({ where })
    ]);

    return {
      entries,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getEntryById(companyId: string, id: string) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true, systemKey: true }
            }
          }
        }
      }
    });

    if (!entry) {
      throw new AppError("Journal entry not found.", 404, "ENTRY_NOT_FOUND");
    }

    return entry;
  }

  async createDraft(companyId: string, userId: string, data: CreateJournalDraftInput, ipAddress?: string) {
    const date = new Date(data.date);
    const year = date.getFullYear();

    return prisma.$transaction(async (tx) => {
      const number = await getNextSequence(tx, companyId, "JV-DRAFT", year);

      const draft = await tx.journalEntry.create({
        data: {
          companyId,
          number,
          date,
          narration: data.narration || null,
          status: EntryStatus.DRAFT,
          sourceType: "MANUAL",
          createdById: userId,
          lines: {
            create: data.lines.map((l) => ({
              accountId: l.accountId,
              contactId: l.contactId || null,
              debit: l.debit,
              credit: l.credit,
              memo: l.memo || null
            }))
          }
        },
        include: {
          lines: true
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "JournalEntry",
        objectId: draft.id,
        action: "CREATE",
        newData: { number: draft.number, status: draft.status },
        ipAddress
      });

      return draft;
    });
  }

  async updateDraft(companyId: string, userId: string, id: string, data: CreateJournalDraftInput, ipAddress?: string) {
    const existing = await this.getEntryById(companyId, id);

    // Rule 3: Immutable Financial Records
    if (existing.status !== EntryStatus.DRAFT) {
      throw new AppError(
        `Immutable record: Journal entry '${existing.number}' has status '${existing.status}' and cannot be edited. Corrections require reversal entries.`,
        403,
        "IMMUTABLE_RECORD"
      );
    }

    return prisma.$transaction(async (tx) => {
      // Delete old lines
      await tx.journalLine.deleteMany({
        where: { entryId: id }
      });

      // Update entry and recreate lines
      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          date: new Date(data.date),
          narration: data.narration || null,
          lines: {
            create: data.lines.map((l) => ({
              accountId: l.accountId,
              contactId: l.contactId || null,
              debit: l.debit,
              credit: l.credit,
              memo: l.memo || null
            }))
          }
        },
        include: {
          lines: true
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "JournalEntry",
        objectId: id,
        action: "UPDATE",
        oldData: existing,
        newData: updated,
        ipAddress
      });

      return updated;
    });
  }

  async deleteDraft(companyId: string, userId: string, id: string, ipAddress?: string) {
    const existing = await this.getEntryById(companyId, id);

    // Rule 3: Immutable Financial Records
    if (existing.status !== EntryStatus.DRAFT) {
      throw new AppError(
        `Immutable record: Journal entry '${existing.number}' has status '${existing.status}' and cannot be deleted.`,
        403,
        "IMMUTABLE_RECORD"
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.journalLine.deleteMany({ where: { entryId: id } });
      await tx.journalEntry.delete({ where: { id } });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "JournalEntry",
        objectId: id,
        action: "DELETE",
        oldData: existing,
        ipAddress
      });
    });

    return { success: true, message: `Draft journal entry '${existing.number}' deleted successfully.` };
  }

  async postDraft(companyId: string, userId: string, id: string, ipAddress?: string) {
    const existing = await this.getEntryById(companyId, id);

    if (existing.status !== EntryStatus.DRAFT) {
      throw new AppError(
        `Journal entry '${existing.number}' is already in status '${existing.status}' and cannot be posted again.`,
        422,
        "INVALID_ENTRY_STATUS"
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Delete draft lines and draft record
      await tx.journalLine.deleteMany({ where: { entryId: id } });
      await tx.journalEntry.delete({ where: { id } });

      // 2. Post official balanced journal entry
      const posted = await postJournal(tx, {
        companyId,
        date: existing.date,
        narration: existing.narration,
        sourceType: "MANUAL",
        sourceId: null,
        createdById: userId,
        lines: existing.lines.map((l) => ({
          accountId: l.accountId,
          contactId: l.contactId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo
        }))
      });

      return posted;
    });
  }

  async createAndPostDirect(companyId: string, userId: string, data: PostJournalDirectInput, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      return postJournal(tx, {
        companyId,
        date: new Date(data.date),
        narration: data.narration,
        sourceType: "MANUAL",
        sourceId: null,
        createdById: userId,
        lines: data.lines
      });
    });
  }

  async reverseEntry(companyId: string, userId: string, id: string, data: ReverseJournalInput, ipAddress?: string) {
    const existing = await this.getEntryById(companyId, id);

    if (existing.status !== EntryStatus.POSTED) {
      throw new AppError(
        `Only POSTED journal entries can be reversed. Current status is '${existing.status}'.`,
        422,
        "INVALID_ENTRY_STATUS"
      );
    }

    if (existing.reversedById) {
      throw new AppError(
        `Journal entry '${existing.number}' has already been reversed.`,
        422,
        "ALREADY_REVERSED"
      );
    }

    return prisma.$transaction(async (tx) => {
      // Invert lines: every debit becomes credit, every credit becomes debit
      const reversalLines = existing.lines.map((l) => ({
        accountId: l.accountId,
        contactId: l.contactId,
        debit: l.credit,
        credit: l.debit,
        memo: `Reversal of line: ${l.memo || existing.number}`
      }));

      // Post the balanced reversal entry
      const reversalEntry = await postJournal(tx, {
        companyId,
        date: new Date(),
        narration: `Reversal of ${existing.number}: ${data.reason.trim()}`,
        sourceType: "REVERSAL",
        sourceId: existing.id,
        createdById: userId,
        lines: reversalLines
      });

      // Update original entry to REVERSED
      await tx.journalEntry.update({
        where: { id: existing.id },
        data: {
          status: EntryStatus.REVERSED,
          reversedById: reversalEntry.id
        }
      });

      // Audit log reversal
      await createAuditLog(tx, {
        companyId,
        userId,
        model: "JournalEntry",
        objectId: existing.id,
        action: "REVERSE",
        oldData: { status: existing.status },
        newData: { status: EntryStatus.REVERSED, reversalEntryId: reversalEntry.id, reason: data.reason },
        ipAddress
      });

      return reversalEntry;
    });
  }
}

export const journalService = new JournalService();

