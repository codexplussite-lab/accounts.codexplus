import { Prisma } from "@prisma/client";

export async function getNextSequence(
  tx: Prisma.TransactionClient,
  companyId: string,
  type: string,
  year?: number
): Promise<string> {
  const currentYear = year || new Date().getFullYear();

  // Try to lock and update the sequence atomically
  // We use raw query or Prisma upsert with increment inside the transaction
  const updated = await tx.documentSequence.upsert({
    where: {
      companyId_type_year: {
        companyId,
        type,
        year: currentYear
      }
    },
    update: {
      last: {
        increment: 1
      }
    },
    create: {
      companyId,
      type,
      year: currentYear,
      last: 1
    }
  });

  const paddedNum = String(updated.last).padStart(4, "0");
  return `${type}-${currentYear}-${paddedNum}`;
}

