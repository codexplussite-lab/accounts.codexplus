import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { toDecimal } from "../../lib/money.js";
import { createAuditLog } from "../../lib/audit.js";

export class CurrencyService {
  /**
   * Sets or creates an exchange rate with 6 decimal places of precision.
   */
  static async setRate(
    companyId: string,
    fromCode: string,
    toCode: string,
    rate: string | number | Decimal,
    userId?: string,
    ipAddress?: string
  ) {
    const rateDecimal = toDecimal(rate);
    if (rateDecimal.lessThanOrEqualTo(0)) {
      throw new AppError("Exchange rate must be strictly positive.", 400, "INVALID_EXCHANGE_RATE");
    }

    const upperFrom = fromCode.trim().toUpperCase();
    const upperTo = toCode.trim().toUpperCase();

    const created = await prisma.currencyRate.create({
      data: {
        companyId,
        fromCode: upperFrom,
        toCode: upperTo,
        rate: rateDecimal,
        date: new Date()
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "CurrencyRate",
      objectId: created.id,
      action: "CREATE",
      newData: { fromCode: upperFrom, toCode: upperTo, rate: rateDecimal.toFixed(6) },
      ipAddress
    });

    return created;
  }

  /**
   * Lists exchange rates configured for company.
   */
  static async listRates(companyId: string) {
    return prisma.currencyRate.findMany({
      where: { companyId },
      orderBy: { date: "desc" }
    });
  }

  /**
   * Converts monetary amounts using database-driven exchange rates with Decimal precision.
   */
  static async convert(
    companyId: string,
    amount: string | number | Decimal,
    fromCode: string,
    toCode: string
  ): Promise<{ originalAmount: string; convertedAmount: string; exchangeRate: string }> {
    const decAmount = toDecimal(amount);
    const upperFrom = fromCode.trim().toUpperCase();
    const upperTo = toCode.trim().toUpperCase();

    if (upperFrom === upperTo) {
      return {
        originalAmount: decAmount.toFixed(2),
        convertedAmount: decAmount.toFixed(2),
        exchangeRate: "1.000000"
      };
    }

    // Direct lookup: from -> to
    const directRate = await prisma.currencyRate.findFirst({
      where: { companyId, fromCode: upperFrom, toCode: upperTo },
      orderBy: { date: "desc" }
    });

    if (directRate) {
      const rate = toDecimal(directRate.rate);
      const converted = decAmount.times(rate);
      return {
        originalAmount: decAmount.toFixed(2),
        convertedAmount: converted.toFixed(2),
        exchangeRate: rate.toFixed(6)
      };
    }

    // Inverse lookup: to -> from
    const inverseRate = await prisma.currencyRate.findFirst({
      where: { companyId, fromCode: upperTo, toCode: upperFrom },
      orderBy: { date: "desc" }
    });

    if (inverseRate) {
      const rate = toDecimal(inverseRate.rate);
      const converted = decAmount.dividedBy(rate);
      return {
        originalAmount: decAmount.toFixed(2),
        convertedAmount: converted.toFixed(2),
        exchangeRate: new Decimal(1).dividedBy(rate).toFixed(6)
      };
    }

    throw new AppError(
      `No exchange rate found between ${upperFrom} and ${upperTo}.`,
      404,
      "EXCHANGE_RATE_NOT_FOUND"
    );
  }
}
