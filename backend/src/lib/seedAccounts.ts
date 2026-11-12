import { Prisma, AccountType } from "@prisma/client";

export interface DefaultAccountSpec {
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
  systemKey?: string;
}

export const DEFAULT_ACCOUNTS: DefaultAccountSpec[] = [
  // Assets
  { code: "1001", name: "Cash", type: AccountType.ASSET, isSystem: true, systemKey: "CASH" },
  { code: "1002", name: "Bank", type: AccountType.ASSET, isSystem: true, systemKey: "BANK" },
  { code: "1100", name: "Accounts Receivable", type: AccountType.ASSET, isSystem: true, systemKey: "AR" },
  { code: "1200", name: "Inventory", type: AccountType.ASSET, isSystem: true, systemKey: "INVENTORY" },
  { code: "1300", name: "Tax Receivable", type: AccountType.ASSET, isSystem: true, systemKey: "TAX_RECEIVABLE" },

  // Liabilities
  { code: "2001", name: "Accounts Payable", type: AccountType.LIABILITY, isSystem: true, systemKey: "AP" },
  { code: "2100", name: "Sales Tax Payable", type: AccountType.LIABILITY, isSystem: true, systemKey: "SALES_TAX_PAYABLE" },

  // Equity
  { code: "3001", name: "Capital", type: AccountType.EQUITY, isSystem: true, systemKey: "CAPITAL" },
  { code: "3100", name: "Retained Earnings", type: AccountType.EQUITY, isSystem: true, systemKey: "RETAINED_EARNINGS" },

  // Income
  { code: "4001", name: "Sales", type: AccountType.INCOME, isSystem: true, systemKey: "SALES" },

  // Expenses
  { code: "5001", name: "Cost of Goods Sold", type: AccountType.EXPENSE, isSystem: true, systemKey: "COGS" },
  { code: "6001", name: "Rent", type: AccountType.EXPENSE, isSystem: true, systemKey: "RENT" },
  { code: "6002", name: "Salaries", type: AccountType.EXPENSE, isSystem: true, systemKey: "SALARIES" },
  { code: "6003", name: "Utilities", type: AccountType.EXPENSE, isSystem: true, systemKey: "UTILITIES" },
  { code: "6004", name: "Miscellaneous Expense", type: AccountType.EXPENSE, isSystem: true, systemKey: "MISC_EXPENSE" }
];

export async function createDefaultAccountsAndWarehouse(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<void> {
  // 1. Seed Default Accounts
  for (const acc of DEFAULT_ACCOUNTS) {
    await tx.account.create({
      data: {
        companyId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isSystem: acc.isSystem,
        systemKey: acc.systemKey,
        isActive: true
      }
    });
  }

  // 2. Seed Default Warehouse
  await tx.warehouse.create({
    data: {
      companyId,
      name: "Main Warehouse",
      isDefault: true
    }
  });

  // 3. Initialize Document Sequences for INV, BILL, PAY, JV
  const currentYear = new Date().getFullYear();
  const sequenceTypes = ["INV", "BILL", "PAY", "JV"];
  for (const seqType of sequenceTypes) {
    await tx.documentSequence.create({
      data: {
        companyId,
        type: seqType,
        year: currentYear,
        last: 0
      }
    });
  }
}

