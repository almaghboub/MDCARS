import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safely parse any value as a number — never returns NaN, defaults to 0 */
export function safeNum(val: unknown, fallback = 0): number {
  const n = typeof val === "number" ? val : parseFloat(String(val ?? ""));
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

/** Format a number to fixed decimal places, safely — never shows NaN */
export function fmt(val: unknown, decimals = 2): string {
  return safeNum(val).toFixed(decimals);
}
