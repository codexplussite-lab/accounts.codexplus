import { Prisma, AccountType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { createAuditLog } from "../../lib/audit.js";
import { AppError } from "../../middleware/errorHandler.js";
import { CreateAccountInput, UpdateAccountInput } from "./schema.js";

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
  systemKey: string | null;
  isActive: boolean;
  parentId: string | null;
  children: AccountTreeNode[];
}

export class AccountService {
  async listAccounts(
    companyId: string,
    filters?: { type?: AccountType; search?: string; isActive?: boolean }
  ) {
    const where: Prisma.AccountWhereInput = {
      companyId,
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters?.search
        ? {
            OR: [
              { code: { contains: filters.search, mode: "insensitive" } },
              { name: { contains: filters.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return prisma.account.findMany({
      where,
      orderBy: [{ code: "asc" }]
    });
  }

  async getAccountTree(companyId: string): Promise<AccountTreeNode[]> {
    const allAccounts = await prisma.account.findMany({
      where: { companyId },
      orderBy: [{ code: "asc" }]
    });

    const accountMap = new Map<string, AccountTreeNode>();
    allAccounts.forEach((acc) => {
      accountMap.set(acc.id, {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isSystem: acc.isSystem,
        systemKey: acc.systemKey,
        isActive: acc.isActive,
        parentId: acc.parentId,
        children: []
      });
    });

    const rootNodes: AccountTreeNode[] = [];

    accountMap.forEach((node) => {
      if (node.parentId && accountMap.has(node.parentId)) {
        accountMap.get(node.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  async getAccountById(companyId: string, id: string) {
    const account = await prisma.account.findFirst({
      where: { id, companyId }
    });

    if (!account) {
      throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
    }

    return account;
  }

  async createAccount(companyId: string, userId: string, data: CreateAccountInput, ipAddress?: string) {
    const code = data.code.trim();

    // Check code uniqueness within company
    const existingCode = await prisma.account.findUnique({
      where: {
        companyId_code: {
          companyId,
          code
        }
      }
    });

    if (existingCode) {
      throw new AppError(`Account code '${code}' is already in use in this company.`, 409, "CODE_ALREADY_EXISTS");
    }

    // Validate parent if provided
    if (data.parentId) {
      const parent = await prisma.account.findFirst({
        where: { id: data.parentId, companyId }
      });
      if (!parent) {
        throw new AppError("Referenced parent account does not exist in this company.", 404, "PARENT_NOT_FOUND");
      }
      if (parent.type !== data.type) {
        throw new AppError(
          `Sub-account type (${data.type}) must match parent account type (${parent.type}).`,
          422,
          "TYPE_MISMATCH"
        );
      }
    }

    const created = await prisma.account.create({
      data: {
        companyId,
        code,
        name: data.name.trim(),
        type: data.type,
        parentId: data.parentId || null,
        isSystem: false,
        isActive: true
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Account",
      objectId: created.id,
      action: "CREATE",
      newData: created,
      ipAddress
    });

    return created;
  }

  async updateAccount(
    companyId: string,
    userId: string,
    id: string,
    data: UpdateAccountInput,
    ipAddress?: string
  ) {
    const existing = await this.getAccountById(companyId, id);

    // Validate parent if updating parentId
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) {
        throw new AppError("An account cannot be its own parent.", 422, "CIRCULAR_DEPENDENCY");
      }
      const parent = await prisma.account.findFirst({
        where: { id: data.parentId, companyId }
      });
      if (!parent) {
        throw new AppError("Referenced parent account not found.", 404, "PARENT_NOT_FOUND");
      }
      if (parent.type !== existing.type) {
        throw new AppError("Sub-account type must match parent account type.", 422, "TYPE_MISMATCH");
      }
    }

    const updated = await prisma.account.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        parentId: data.parentId !== undefined ? data.parentId : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Account",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated,
      ipAddress
    });

    return updated;
  }

  async deleteAccount(companyId: string, userId: string, id: string, ipAddress?: string) {
    const existing = await this.getAccountById(companyId, id);

    // Non-Negotiable: System accounts cannot be deleted
    if (existing.isSystem) {
      throw new AppError(
        `System account '${existing.code} - ${existing.name}' is protected and cannot be deleted.`,
        403,
        "SYSTEM_ACCOUNT_PROTECTED"
      );
    }

    // Check for child accounts
    const childrenCount = await prisma.account.count({
      where: { companyId, parentId: id }
    });
    if (childrenCount > 0) {
      throw new AppError(
        "Cannot delete an account that has active sub-accounts. Please reassign or delete sub-accounts first.",
        422,
        "ACCOUNT_HAS_CHILDREN"
      );
    }

    // Check for existing transaction journal lines
    const lineCount = await prisma.journalLine.count({
      where: { accountId: id }
    });
    if (lineCount > 0) {
      throw new AppError(
        "Cannot delete an account that has recorded journal transactions. Deactivate the account instead.",
        422,
        "ACCOUNT_IN_USE"
      );
    }

    await prisma.account.delete({
      where: { id }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Account",
      objectId: id,
      action: "DELETE",
      oldData: existing,
      ipAddress
    });

    return { success: true, message: `Account '${existing.code}' deleted successfully.` };
  }
}

export const accountService = new AccountService();

