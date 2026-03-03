export const CURRENCY_SYMBOL = '₦';

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}
