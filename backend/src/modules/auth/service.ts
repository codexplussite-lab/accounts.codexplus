import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { createDefaultAccountsAndWarehouse } from "../../lib/seedAccounts.js";
import { createAuditLog } from "../../lib/audit.js";
import { AppError } from "../../middleware/errorHandler.js";
import { RegisterInput, LoginInput } from "./schema.js";

const BCRYPT_SALT_ROUNDS = 12;

export class AuthService {
  async register(data: RegisterInput, ipAddress?: string) {
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      throw new AppError("An account with this email already exists.", 409, "USER_ALREADY_EXISTS");
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    // Atomic execution of User, Company, Membership, Accounts & Warehouse creation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: data.name.trim(),
          isActive: true
        }
      });

      // 2. Create Company
      const company = await tx.company.create({
        data: {
          name: data.companyName.trim(),
          currency: data.currency || "PKR",
          ntn: data.ntn?.trim() || null,
          address: data.address?.trim() || null
        }
      });

      // 3. Create OWNER Membership
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: Role.OWNER
        }
      });

      // 4. Seed Default Chart of Accounts & Default Warehouse
      await createDefaultAccountsAndWarehouse(tx, company.id);

      // 5. Audit Log Registration
      await createAuditLog(tx, {
        companyId: company.id,
        userId: user.id,
        model: "User",
        objectId: user.id,
        action: "REGISTER",
        newData: { email: user.email, name: user.name, role: Role.OWNER },
        ipAddress
      });

      return { user, company, membership };
    });

    const accessToken = generateAccessToken(result.user.id);
    const refreshToken = generateRefreshToken(result.user.id);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name
      },
      company: {
        id: result.company.id,
        name: result.company.name,
        currency: result.company.currency,
        role: result.membership.role
      },
      accessToken,
      refreshToken
    };
  }

  async login(data: LoginInput, ipAddress?: string) {
    const normalizedEmail = data.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                currency: true,
                lockedUntil: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Audit log login on primary company if exists
    if (user.memberships.length > 0) {
      const primaryCompany = user.memberships[0].companyId;
      await createAuditLog(prisma, {
        companyId: primaryCompany,
        userId: user.id,
        model: "User",
        objectId: user.id,
        action: "LOGIN",
        newData: { timestamp: new Date().toISOString() },
        ipAddress
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      companies: user.memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        currency: m.company.currency,
        role: m.role
      })),
      accessToken,
      refreshToken
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new AppError("Refresh token required.", 401, "MISSING_REFRESH_TOKEN");
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError("Invalid or expired refresh token. Please sign in again.", 401, "INVALID_REFRESH_TOKEN");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true }
    });

    if (!user || !user.isActive) {
      throw new AppError("User account is inactive or not found.", 401, "USER_INACTIVE");
    }

    const newAccessToken = generateAccessToken(user.id);
    return { accessToken: newAccessToken };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            company: {
              select: {
                id: true,
                name: true,
                currency: true,
                lockedUntil: true,
                ntn: true,
                address: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      companies: user.memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        currency: m.company.currency,
        role: m.role,
        ntn: m.company.ntn,
        address: m.company.address
      }))
    };
  }
}

export const authService = new AuthService();

