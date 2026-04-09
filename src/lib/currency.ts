export const CURRENCY_SYMBOL = '₦';

const SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', EUR: '€', GBP: '£', CNY: '¥',
  ZAR: 'R', GHS: '₵', KES: 'KSh', XOF: 'CFA',
};

export function getCurrencySymbol(code: string): string {
  return SYMBOLS[code] || code;
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const symbol = currencyCode ? getCurrencySymbol(currencyCode) : CURRENCY_SYMBOL;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
