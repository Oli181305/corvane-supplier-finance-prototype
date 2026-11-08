import type { Currency } from '../types';

/** USD per one unit of currency. */
export const FX_TO_USD: Record<Currency, number> = {
  USD: 1,
  EUR: 1.0912,
  MXN: 0.0515,
  CNY: 0.1385,
  SGD: 0.7452,
};

export function toUSD(amount: number, currency: Currency, table: Record<Currency, number> = FX_TO_USD): number {
  return amount * table[currency];
}

export function fromUSD(amountUSD: number, currency: Currency, table: Record<Currency, number> = FX_TO_USD): number {
  return amountUSD / table[currency];
}

/** Cross rate: one unit of `from` in units of `to`. */
export function crossRate(from: Currency, to: Currency, table: Record<Currency, number> = FX_TO_USD): number {
  return table[from] / table[to];
}

export function convert(amount: number, from: Currency, to: Currency, table: Record<Currency, number> = FX_TO_USD): number {
  if (from === to) return amount;
  return amount * crossRate(from, to, table);
}

export const MARKET_RATES: Record<Currency, { name: string; rate: number }> = {
  USD: { name: 'SOFR', rate: 0.0394 },
  EUR: { name: '€STR', rate: 0.0193 },
  MXN: { name: 'TIIE', rate: 0.073 },
  CNY: { name: 'CNH HIBOR', rate: 0.018 },
  SGD: { name: 'SORA', rate: 0.016 },
};
