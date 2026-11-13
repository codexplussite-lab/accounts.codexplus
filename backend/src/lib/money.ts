import Decimal from "decimal.js";

// Set precision for accounting
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

export function add(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

export function sub(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function mul(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function div(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  const divisor = toDecimal(b);
  if (divisor.isZero()) {
    throw new Error("Division by zero in monetary calculation");
  }
  return toDecimal(a).dividedBy(divisor);
}

export function isEqual(a: string | number | Decimal, b: string | number | Decimal): boolean {
  return toDecimal(a).equals(toDecimal(b));
}

export function equalsDecimal(a: string | number | Decimal, b: string | number | Decimal): boolean {
  return isEqual(a, b);
}

export function sumDecimals(values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>((acc, val) => acc.plus(toDecimal(val)), new Decimal(0));
}

export function isZero(a: string | number | Decimal): boolean {
  return toDecimal(a).isZero();
}

export function formatMoney(val: string | number | Decimal): string {
  return toDecimal(val).toFixed(2);
}

export function formatQuantity(val: string | number | Decimal): string {
  return toDecimal(val).toFixed(3);
}

