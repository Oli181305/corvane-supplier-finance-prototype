import type { Currency, Entity, Invoice, Supplier } from '../types';
import type { DemoData, ViewAs } from './store';
import { effectivePortal, useCurrentUser, useStore } from './store';
import { toUSD, fromUSD } from '../logic/fx';

export const OBLIGATION_STATUSES: Invoice['status'][] = ['Approved', 'Offered', 'Paid early'];

export function isObligation(inv: Invoice): boolean {
  return OBLIGATION_STATUSES.includes(inv.status) || (inv.status === 'Disputed' && !!inv.approvedAt);
}

export type MaturityRow = {
  date: string;
  totalUSD: number;
  lumpUSD: number;
  invoices: Invoice[];
  entityIds: string[];
};

/** Obligations grouped by due date: base book lumps plus named invoices that are approved and not yet settled. */
export function maturityRows(d: DemoData, entityFilter = 'all', fromDate?: string): MaturityRow[] {
  const map = new Map<string, MaturityRow>();
  const get = (date: string) => {
    let r = map.get(date);
    if (!r) {
      r = { date, totalUSD: 0, lumpUSD: 0, invoices: [], entityIds: [] };
      map.set(date, r);
    }
    return r;
  };
  for (const o of d.obligations) {
    if (entityFilter !== 'all' && o.entityId !== entityFilter) continue;
    if (fromDate && o.dueDate < fromDate) continue;
    // Named invoices that were approved during the demo are also in `obligations`; skip lumps that
    // correspond to a named invoice so they are not counted twice.
    const named = d.invoices.find((i) => isObligation(i) && i.dueDate === o.dueDate && i.entityId === o.entityId && Math.abs(toUSD(i.amount, i.currency) - o.amountUSD) < 0.5 && i.approvedAt && i.approvedAt.slice(0, 10) >= '2026-11-16');
    const r = get(o.dueDate);
    if (!named) r.lumpUSD += o.amountUSD;
    r.totalUSD += o.amountUSD;
    if (!r.entityIds.includes(o.entityId)) r.entityIds.push(o.entityId);
  }
  for (const i of d.invoices) {
    if (!isObligation(i)) continue;
    if (entityFilter !== 'all' && i.entityId !== entityFilter) continue;
    if (fromDate && i.dueDate < fromDate) continue;
    const r = get(i.dueDate);
    r.invoices.push(i);
    const fresh = i.approvedAt && i.approvedAt.slice(0, 10) >= '2026-11-16';
    if (!fresh) r.totalUSD += toUSD(i.amount, i.currency);
    if (!r.entityIds.includes(i.entityId)) r.entityIds.push(i.entityId);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function obligationsByEntity(d: DemoData): { entity: Entity; usd: number; local: number }[] {
  return d.entities.map((e) => {
    const usd = d.obligations.filter((o) => o.entityId === e.id).reduce((s, o) => s + o.amountUSD, 0);
    return { entity: e, usd, local: fromUSD(usd, e.currency) };
  });
}

export function totalObligationsUSD(d: DemoData, entityFilter = 'all'): number {
  return d.obligations.filter((o) => entityFilter === 'all' || o.entityId === entityFilter).reduce((s, o) => s + o.amountUSD, 0);
}

export function supplierOf(d: DemoData, inv: Invoice): Supplier | undefined {
  return d.suppliers.find((s) => s.id === inv.supplierId);
}

export function entityOf(d: DemoData, inv: Invoice): Entity | undefined {
  return d.entities.find((e) => e.id === inv.entityId);
}

export function lastUpdate(inv: Invoice): string {
  return inv.history[inv.history.length - 1]?.at ?? '';
}

export function usePortalBase(): '/kaltrex' | '/supplier' | '/bank' {
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const p = effectivePortal(user, viewAs);
  return p === 'supplier' ? '/supplier' : p === 'bank' ? '/bank' : '/kaltrex';
}

export function useReadOnly(): boolean {
  return useStore((s) => !!s.viewAs);
}

export function displayAmount(amount: number, currency: Currency, reporting: 'USD' | 'local'): { amount: number; currency: Currency } {
  if (reporting === 'USD') return { amount: toUSD(amount, currency), currency: 'USD' };
  return { amount, currency };
}

export type { ViewAs };
