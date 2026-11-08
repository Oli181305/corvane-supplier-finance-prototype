import type { CriteriaResult, Currency, Entity, Invoice, MatchResult, ProgramConfig, Supplier, User } from '../types';
import { toUSD } from './fx';
import { daysBetween } from './format';

export type CandidateInvoice = {
  number: string;
  supplierId: string;
  entityId: string;
  currency: Currency;
  amount: number;
  invoiceDate: string;
  dueDate: string;
  match: MatchResult;
};

export type AcceptanceOutcome = {
  results: CriteriaResult[];
  status: 'In approval' | 'Rejected' | 'Held';
  reason?: string;
  duplicateOf?: string;
};

export function fingerprint(inv: { supplierId: string; number: string; amount: number; invoiceDate: string }): string {
  return `${inv.supplierId}|${inv.number.trim().toUpperCase()}|${inv.amount}|${inv.invoiceDate}`;
}

/** Section 7.3. Every value comes from ProgramConfig. */
export function runAcceptanceCriteria(
  inv: CandidateInvoice,
  ctx: { config: ProgramConfig; suppliers: Supplier[]; entities: Entity[]; invoices: Invoice[]; today: string; excludeId?: string },
): AcceptanceOutcome {
  const { config, suppliers, entities, invoices, today } = ctx;
  const results: CriteriaResult[] = [];
  const supplier = suppliers.find((s) => s.id === inv.supplierId);
  const entity = entities.find((e) => e.id === inv.entityId);

  const enrolled = !!supplier && supplier.onboardingStatus === 'Enrolled';
  results.push({
    name: 'Supplier enrolled',
    result: enrolled ? 'Passed' : 'Failed',
    detail: enrolled ? 'Enrolled' : 'Supplier is not enrolled',
  });

  results.push({
    name: 'Kaltrex entity in program',
    result: entity ? 'Passed' : 'Failed',
    detail: entity ? entity.name : 'Entity not in program',
  });

  const ccyOk = config.currencies.includes(inv.currency);
  results.push({
    name: 'Currency accepted',
    result: ccyOk ? 'Passed' : 'Failed',
    detail: ccyOk ? inv.currency : `${inv.currency} is not in the program`,
  });

  const days = daysBetween(today, inv.dueDate);
  let dueOk = true;
  let dueDetail = `Passed (${days} days)`;
  if (days < 0) {
    dueOk = false;
    dueDetail = 'Past due';
  } else if (days < config.minDaysToDue) {
    dueOk = false;
    dueDetail = `Due in ${days} days. Minimum is ${config.minDaysToDue}`;
  } else if (days > config.maxDaysToDue) {
    dueOk = false;
    dueDetail = `Due date beyond ${config.maxDaysToDue} days`;
  }
  results.push({
    name: `Due date within range (${config.minDaysToDue} to ${config.maxDaysToDue} days)`,
    result: dueOk ? 'Passed' : 'Failed',
    detail: dueDetail,
  });

  const usd = toUSD(inv.amount, inv.currency);
  const minOk = usd >= config.minInvoiceUSD;
  results.push({
    name: 'Amount at or above minimum',
    result: minOk ? 'Passed' : 'Failed',
    detail: minOk ? `USD ${Math.round(usd).toLocaleString('en-US')} equivalent` : 'Below program minimum',
  });

  const fp = fingerprint(inv);
  const dup = invoices.find((x) => x.id !== ctx.excludeId && fingerprint(x) === fp);
  results.push({
    name: 'Not a duplicate',
    result: dup ? 'Failed' : 'Passed',
    detail: dup ? `Duplicate of ${dup.number} (same supplier, number, amount and date)` : 'No match on supplier, number, amount and date',
  });

  const matched = inv.match === 'Matched';
  results.push({ name: 'Three-way match', result: matched ? 'Passed' : 'Variance', detail: inv.match });

  const hardFail = results.find((r) => r.result === 'Failed' && r.name !== 'Not a duplicate');
  if (hardFail) return { results, status: 'Rejected', reason: hardFail.detail };
  if (dup) {
    return {
      results,
      status: 'Held',
      reason: `Duplicate of ${dup.number} (same supplier, number, amount and date)`,
      duplicateOf: dup.id,
    };
  }
  if (!matched) return { results, status: 'In approval', reason: `${inv.match}. Awaiting credit note.` };
  return { results, status: 'In approval' };
}

/** Section 7.4. Fixed rules, not AI. Returns the rule that held the invoice, or null. */
export function unusualInvoiceRule(
  inv: { amount: number; currency: Currency; supplierId: string },
  ctx: { config: ProgramConfig; supplier: Supplier | undefined; approvers: User[]; today: string },
): string | null {
  const { config, supplier, approvers, today } = ctx;
  const usd = toUSD(inv.amount, inv.currency);

  if (supplier && supplier.avgInvoice12m > 0 && inv.amount > config.unusualSizeMultiple * supplier.avgInvoice12m) {
    return `Amount is more than ${config.unusualSizeMultiple}× the supplier 12-month average invoice`;
  }
  const unit = config.roundFigureUnit;
  if (usd >= config.roundFigureThreshold && Math.abs(usd / unit - Math.round(usd / unit)) < 1e-9) {
    return `Round figure. Exact multiple of USD ${unit.toLocaleString('en-US')} at or above USD ${config.roundFigureThreshold.toLocaleString('en-US')}`;
  }
  for (const a of approvers) {
    if (!a.approvalLimit) continue;
    if (usd <= a.approvalLimit && usd >= a.approvalLimit * (1 - config.nearLimitPct)) {
      return `Amount is within ${Math.round(config.nearLimitPct * 100)}% below an approval limit (${a.name}, USD ${a.approvalLimit.toLocaleString('en-US')})`;
    }
  }
  if (supplier?.bankAccount.changedOn) {
    const d = daysBetween(supplier.bankAccount.changedOn, today);
    if (d >= 0 && d <= config.bankChangeDays) {
      return `Supplier bank account changed ${d} days ago (within ${config.bankChangeDays} days)`;
    }
  }
  return null;
}
