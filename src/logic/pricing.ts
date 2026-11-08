import type { Currency, Quote } from '../types';
import { MARKET_RATES } from './fx';
import { daysBetween } from './format';

export function rateFor(currency: Currency, spread: number): { rate: number; marketRate: number; marketRateName: string } {
  const m = MARKET_RATES[currency];
  return { rate: m.rate + spread, marketRate: m.rate, marketRateName: m.name };
}

/** discount = amount × rate × days ÷ 360, rounded to whole currency units */
export function discountFor(amount: number, rate: number, days: number): number {
  return Math.round((amount * rate * days) / 360);
}

export function quoteFor(
  amount: number,
  currency: Currency,
  dueDate: string,
  today: string,
  spread: number,
  validUntil = `${today}T16:00:00`,
): Quote {
  const days = Math.max(0, daysBetween(today, dueDate));
  const { rate, marketRate, marketRateName } = rateFor(currency, spread);
  const discount = discountFor(amount, rate, days);
  return {
    rate,
    marketRate,
    marketRateName,
    spread,
    days,
    discount,
    netAmount: amount - discount,
    validUntil,
  };
}
