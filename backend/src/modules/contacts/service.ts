import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";

export class ContactService {
  /**
   * Derive live contact balances from posted journal lines.
   * Customer: openingBalance + (AR Debits - AR Credits)
   * Vendor: openingBalance + (AP Credits - AP Debits)
   */
  static async getContactBalance(companyId: string, contactId: string, openingBalance: string | Decimal, type: string) {
    // Find AR and AP system accounts for this company
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        systemKey: { in: ["AR", "AP"] }
      }
    });

    const arAccount = accounts.find((a: any) => a.systemKey === "AR");
    const apAccount = accounts.find((a: any) => a.systemKey === "AP");

    const arId = arAccount?.id;
    const apId = apAccount?.id;

    const accountIds: string[] = [];
    if (arId) accountIds.push(arId);
    if (apId) accountIds.push(apId);

    if (accountIds.length === 0) {
      const ob = new Decimal(openingBalance.toString());
      return {
        receivable: type === "VENDOR" ? "0.00" : ob.toFixed(2),
        payable: type === "CUSTOMER" ? "0.00" : ob.toFixed(2),
        netBalance: ob.toFixed(2)
      };
    }

    // Query posted journal lines for this contact
    const lines = await prisma.journalLine.findMany({
      where: {
        contactId,
        accountId: { in: accountIds },
        entry: {
          companyId,
          status: "POSTED"
        }
      },
      include: {
        account: true
      }
    });

    let arDebitSum = new Decimal(0);
    let arCreditSum = new Decimal(0);
    let apDebitSum = new Decimal(0);
    let apCreditSum = new Decimal(0);

    for (const line of lines) {
      const isAR = line.accountId === arId || line.account?.systemKey === "AR";
      const isAP = line.accountId === apId || line.account?.systemKey === "AP";

      if (isAR) {
        arDebitSum = arDebitSum.plus(new Decimal(line.debit.toString()));
        arCreditSum = arCreditSum.plus(new Decimal(line.credit.toString()));
      }
      if (isAP) {
        apDebitSum = apDebitSum.plus(new Decimal(line.debit.toString()));
        apCreditSum = apCreditSum.plus(new Decimal(line.credit.toString()));
      }
    }

    const opBal = new Decimal(openingBalance.toString());

    // Customer balance: money customer owes us (Dr AR - Cr AR)
    const receivableBalance = (type === "VENDOR")
      ? new Decimal(0)
      : opBal.plus(arDebitSum.minus(arCreditSum));

    // Vendor balance: money we owe vendor (Cr AP - Dr AP)
    const payableBalance = (type === "CUSTOMER")
      ? new Decimal(0)
      : (type === "VENDOR" ? opBal.plus(apCreditSum.minus(apDebitSum)) : apCreditSum.minus(apDebitSum));

    const netBalance = receivableBalance.minus(payableBalance);

    return {
      receivable: receivableBalance.toFixed(2),
      payable: payableBalance.toFixed(2),
      netBalance: netBalance.toFixed(2)
    };
  }

  static async listContacts(companyId: string, query: any) {
    const { search, type, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { ntn: { contains: search } }
      ];
    }

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" }
      })
    ]);

    // Attach derived balances
    const data = await Promise.all(
      contacts.map(async (c: any) => {
        const balances = await ContactService.getContactBalance(companyId, c.id, c.openingBalance, c.type);
        return {
          ...c,
          openingBalance: new Decimal(c.openingBalance.toString()).toFixed(2),
          creditLimit: c.creditLimit ? new Decimal(c.creditLimit.toString()).toFixed(2) : null,
          balances
        };
      })
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getContactById(companyId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, companyId }
    });

    if (!contact) {
      throw new AppError("Contact not found", 404, "NOT_FOUND");
    }

    const balances = await ContactService.getContactBalance(companyId, contact.id, contact.openingBalance, contact.type);

    return {
      ...contact,
      openingBalance: new Decimal(contact.openingBalance.toString()).toFixed(2),
      creditLimit: contact.creditLimit ? new Decimal(contact.creditLimit.toString()).toFixed(2) : null,
      balances
    };
  }

  static async createContact(companyId: string, userId: string, input: any) {
    const contact = await prisma.contact.create({
      data: {
        companyId,
        name: input.name,
        type: input.type,
        phone: input.phone || null,
        email: input.email || null,
        ntn: input.ntn || null,
        address: input.address || null,
        openingBalance: new Decimal(input.openingBalance || "0.00"),
        creditLimit: input.creditLimit ? new Decimal(input.creditLimit) : null,
        isActive: input.isActive ?? true
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Contact",
      objectId: contact.id,
      action: "CREATE",
      newData: contact
    });

    const balances = await ContactService.getContactBalance(companyId, contact.id, contact.openingBalance, contact.type);

    return {
      ...contact,
      openingBalance: new Decimal(contact.openingBalance.toString()).toFixed(2),
      creditLimit: contact.creditLimit ? new Decimal(contact.creditLimit.toString()).toFixed(2) : null,
      balances
    };
  }

  static async updateContact(companyId: string, userId: string, id: string, input: any) {
    const existing = await prisma.contact.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Contact not found", 404, "NOT_FOUND");
    }

    const dataToUpdate: any = {};
    if (input.name !== undefined) dataToUpdate.name = input.name;
    if (input.type !== undefined) dataToUpdate.type = input.type;
    if (input.phone !== undefined) dataToUpdate.phone = input.phone;
    if (input.email !== undefined) dataToUpdate.email = input.email;
    if (input.ntn !== undefined) dataToUpdate.ntn = input.ntn;
    if (input.address !== undefined) dataToUpdate.address = input.address;
    if (input.openingBalance !== undefined) dataToUpdate.openingBalance = new Decimal(input.openingBalance);
    if (input.creditLimit !== undefined) dataToUpdate.creditLimit = input.creditLimit ? new Decimal(input.creditLimit) : null;
    if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

    const updated = await prisma.contact.update({
      where: { id },
      data: dataToUpdate
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Contact",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    const balances = await ContactService.getContactBalance(companyId, updated.id, updated.openingBalance, updated.type);

    return {
      ...updated,
      openingBalance: new Decimal(updated.openingBalance.toString()).toFixed(2),
      creditLimit: updated.creditLimit ? new Decimal(updated.creditLimit.toString()).toFixed(2) : null,
      balances
    };
  }

  /**
   * Return chronological ledger entries for this contact with running balance
   */
  static async getContactLedger(companyId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, companyId }
    });

    if (!contact) {
      throw new AppError("Contact not found", 404, "NOT_FOUND");
    }

    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        systemKey: { in: ["AR", "AP"] }
      }
    });

    const arId = accounts.find((a: any) => a.systemKey === "AR")?.id;
    const apId = accounts.find((a: any) => a.systemKey === "AP")?.id;

    const accountIds: string[] = [];
    if (arId) accountIds.push(arId);
    if (apId) accountIds.push(apId);

    const lines = await prisma.journalLine.findMany({
      where: {
        contactId: id,
        accountId: { in: accountIds },
        entry: {
          companyId,
          status: "POSTED"
        }
      },
      include: {
        entry: true,
        account: true
      },
      orderBy: {
        entry: {
          date: "asc"
        }
      }
    });

    let runningBalance = new Decimal(contact.openingBalance.toString());
    const isCustomer = contact.type === "CUSTOMER" || contact.type === "BOTH";

    const ledgerEntries = [
      {
        id: "opening-balance",
        date: contact.id ? new Date(0).toISOString() : new Date().toISOString(),
        documentNumber: "OPENING",
        sourceType: "OPENING_BALANCE",
        description: "Opening Balance",
        debit: isCustomer && runningBalance.isPositive() ? runningBalance.toFixed(2) : "0.00",
        credit: !isCustomer && runningBalance.isPositive() ? runningBalance.toFixed(2) : "0.00",
        runningBalance: runningBalance.toFixed(2)
      }
    ];

    for (const line of lines) {
      const debit = new Decimal(line.debit.toString());
      const credit = new Decimal(line.credit.toString());
      const isAR = line.accountId === arId || line.account?.systemKey === "AR";

      if (isCustomer && isAR) {
        runningBalance = runningBalance.plus(debit).minus(credit);
      } else {
        // Vendor AP logic
        runningBalance = runningBalance.plus(credit).minus(debit);
      }

      ledgerEntries.push({
        id: line.id,
        date: line.entry.date.toISOString(),
        documentNumber: line.entry.number,
        sourceType: line.entry.sourceType || "JOURNAL",
        description: line.memo || line.entry.narration || "Ledger Entry",
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        runningBalance: runningBalance.toFixed(2)
      });
    }

    return {
      contact: {
        id: contact.id,
        name: contact.name,
        type: contact.type,
        openingBalance: new Decimal(contact.openingBalance.toString()).toFixed(2),
        closingBalance: runningBalance.toFixed(2)
      },
      ledger: ledgerEntries
    };
  }
}
