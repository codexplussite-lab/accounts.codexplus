import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Decimal from "decimal.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency strictly adhering to zero floating-point arithmetic rules
 */
export function formatCurrency(
  amount: string | number | Decimal,
  currency: string = "PKR"
): string {
  try {
    const d = new Decimal(amount || 0);
    const formatted = d.toFixed(2);
    // Add comma separators
    const parts = formatted.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${currency} ${parts.join(".")}`;
  } catch {
    return `${currency} 0.00`;
  }
}

/**
 * Format stock quantity strictly adhering to 3 decimal places
 */
export function formatQuantity(qty: string | number | Decimal): string {
  try {
    const d = new Decimal(qty || 0);
    return d.toFixed(3);
  } catch {
    return "0.000";
  }
}

