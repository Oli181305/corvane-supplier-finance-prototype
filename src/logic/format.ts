import type { Currency } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function daysBetween(fromISO: string, toISO_: string): number {
  const a = parseDate(fromISO).getTime();
  const b = parseDate(toISO_).getTime();
  return Math.round((b - a) / 86400000);
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = parseDate(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDateShort(iso?: string): string {
  if (!iso) return '';
  const d = parseDate(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Timestamp like "16 Nov 09:40". Input "2026-11-16T09:40:00". */
export function fmtTime(ts?: string): string {
  if (!ts) return '';
  const date = fmtDateShort(ts.slice(0, 10));
  const time = ts.length > 10 ? ts.slice(11, 16) : '';
  return time ? `${date} ${time}` : date;
}

export function fmtTimeFull(ts?: string): string {
  if (!ts) return '';
  const date = fmtDate(ts.slice(0, 10));
  const time = ts.length > 10 ? ts.slice(11, 19) : '';
  return time ? `${date} ${time}` : date;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Table money: "USD 198,333" */
export function money(amount: number, currency: Currency | string): string {
  return `${currency} ${fmtInt(amount)}`;
}

/** Detail money: "USD 198,333.00" */
export function moneyFull(amount: number, currency: Currency | string): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact money: "USD 31.0M" */
export function moneyM(amount: number, currency: Currency | string = 'USD', digits = 1): string {
  if (Math.abs(amount) >= 100_000) return `${currency} ${(amount / 1_000_000).toFixed(digits)}M`;
  return `${currency} ${fmtInt(amount)}`;
}

export function pct(n: number, digits = 2): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function pctInt(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function businessDaysAfter(iso: string, n: number): string {
  const d = parseDate(iso);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return toISO(d);
}

export function weekdayName(iso: string): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseDate(iso).getUTCDay()];
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
