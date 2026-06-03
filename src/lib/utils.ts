import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(value: number | string | undefined | null, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
