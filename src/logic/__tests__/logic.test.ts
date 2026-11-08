import { describe, expect, it } from 'vitest';
import { quoteFor, discountFor } from '../pricing';
import { runAcceptanceCriteria, unusualInvoiceRule } from '../rules';
import { canApprove, eligibleApprovers } from '../routing';
import { railFor, arrivalFor, paymentReference } from '../rails';
import { daysBetween } from '../format';
import { SEED_CONFIG, SEED_ENTITIES, SEED_INVOICES, SEED_SUPPLIERS, TODAY, USERS } from '../../data/seed';

const mercer = SEED_SUPPLIERS.find((s) => s.id === 'mercer')!;
const approvers = USERS.filter((u) => u.portal === 'kaltrex');

describe('pricing', () => {
  it('OH-48211: USD 200,000 at 5.00% for 60 days gives discount 1,667 and net 198,333', () => {
    expect(daysBetween(TODAY, '2027-01-15')).toBe(60);
    const q = quoteFor(200000, 'USD', '2027-01-15', TODAY, SEED_CONFIG.spread);
    expect(q.rate).toBeCloseTo(0.05, 10);
    expect(q.days).toBe(60);
    expect(q.discount).toBe(1667);
    expect(q.netAmount).toBe(198333);
  });
  it('OH-48190 and OH-48225 match the deck', () => {
    const a = quoteFor(48200, 'USD', '2026-12-30', TODAY, SEED_CONFIG.spread);
    expect(a.days).toBe(44);
    expect(a.discount).toBe(295);
    expect(a.netAmount).toBe(47905);
    const b = quoteFor(167900, 'USD', '2027-01-28', TODAY, SEED_CONFIG.spread);
    expect(b.days).toBe(73);
    expect(b.discount).toBe(1702);
    expect(b.netAmount).toBe(166198);
  });
  it('spread changes the quote', () => {
    const q = quoteFor(200000, 'USD', '2027-01-15', TODAY, 0.0206);
    expect(q.discount).toBe(discountFor(200000, 0.06, 60));
  });
});

describe('unusual-invoice rules', () => {
  const ctx = { config: SEED_CONFIG, supplier: mercer, approvers, today: TODAY };
  it('OH-48211 and OH-48240 are not held', () => {
    expect(unusualInvoiceRule({ amount: 200000, currency: 'USD', supplierId: 'mercer' }, ctx)).toBeNull();
    expect(unusualInvoiceRule({ amount: 410000, currency: 'USD', supplierId: 'mercer' }, ctx)).toBeNull();
  });
  it('holds an invoice above 3× the average', () => {
    expect(unusualInvoiceRule({ amount: 460000, currency: 'USD', supplierId: 'mercer' }, ctx)).toMatch(/12-month average/);
  });
  it('holds a round figure at or above the threshold', () => {
    expect(unusualInvoiceRule({ amount: 250000, currency: 'USD', supplierId: 'mercer' }, ctx)).toMatch(/Round figure/);
    expect(unusualInvoiceRule({ amount: 100000, currency: 'USD', supplierId: 'mercer' }, ctx)).toBeNull();
  });
  it('holds an amount just below an approval limit', () => {
    expect(unusualInvoiceRule({ amount: 248000, currency: 'USD', supplierId: 'mercer' }, ctx)).toMatch(/approval limit/);
  });
  it('holds when the bank account changed recently', () => {
    const s = { ...mercer, bankAccount: { ...mercer.bankAccount, changedOn: '2026-11-07' } };
    expect(unusualInvoiceRule({ amount: 20000, currency: 'USD', supplierId: 'mercer' }, { ...ctx, supplier: s })).toMatch(/bank account changed/);
  });
  it('rule values come from the config', () => {
    const cfg = { ...SEED_CONFIG, unusualSizeMultiple: 1.2 };
    expect(unusualInvoiceRule({ amount: 200000, currency: 'USD', supplierId: 'mercer' }, { ...ctx, config: cfg })).toMatch(/1.2×/);
  });
});

describe('acceptance criteria', () => {
  const base = { config: SEED_CONFIG, suppliers: SEED_SUPPLIERS, entities: SEED_ENTITIES, invoices: SEED_INVOICES, today: TODAY };
  it('accepts a normal Mercer invoice', () => {
    const o = runAcceptanceCriteria(
      { number: 'OH-99999', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 30000, invoiceDate: '2026-11-15', dueDate: '2027-01-10', match: 'Matched' },
      base,
    );
    expect(o.status).toBe('In approval');
    expect(o.results.every((r) => r.result === 'Passed')).toBe(true);
  });
  it('rejects beyond the maximum days', () => {
    const o = runAcceptanceCriteria(
      { number: 'OH-99998', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 30000, invoiceDate: '2026-11-15', dueDate: '2027-09-10', match: 'Matched' },
      base,
    );
    expect(o.status).toBe('Rejected');
    expect(o.reason).toBe('Due date beyond 180 days');
  });
  it('rejects below the minimum', () => {
    const o = runAcceptanceCriteria(
      { number: 'OH-99997', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 3000, invoiceDate: '2026-11-15', dueDate: '2027-01-10', match: 'Matched' },
      base,
    );
    expect(o.status).toBe('Rejected');
    expect(o.reason).toBe('Below program minimum');
  });
  it('holds a duplicate of OH-48211', () => {
    const inv = SEED_INVOICES.find((i) => i.number === 'OH-48211')!;
    const o = runAcceptanceCriteria(
      { number: inv.number, supplierId: inv.supplierId, entityId: inv.entityId, currency: inv.currency, amount: inv.amount, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate, match: 'Matched' },
      base,
    );
    expect(o.status).toBe('Held');
    expect(o.reason).toBe('Duplicate of OH-48211 (same supplier, number, amount and date)');
  });
  it('keeps a variance in approval with the credit note reason', () => {
    const o = runAcceptanceCriteria(
      { number: 'OH-99996', supplierId: 'mercer', entityId: 'us', currency: 'USD', amount: 30000, invoiceDate: '2026-11-15', dueDate: '2027-01-10', match: 'Quantity variance' },
      base,
    );
    expect(o.status).toBe('In approval');
    expect(o.reason).toBe('Quantity variance. Awaiting credit note.');
  });
  it('rejects a supplier that is not enrolled', () => {
    const o = runAcceptanceCriteria(
      { number: 'BR-1', supplierId: 'brennan', entityId: 'us', currency: 'USD', amount: 30000, invoiceDate: '2026-11-15', dueDate: '2027-01-10', match: 'Matched' },
      base,
    );
    expect(o.status).toBe('Rejected');
  });
});

describe('approval routing', () => {
  const mark = USERS.find((u) => u.id === 'mark')!;
  const dana = USERS.find((u) => u.id === 'dana')!;
  it('Mark Feld can approve OH-48211 and not OH-48240', () => {
    expect(canApprove(mark, 200000, 'USD')).toBe(true);
    expect(canApprove(mark, 410000, 'USD')).toBe(false);
    expect(canApprove(dana, 410000, 'USD')).toBe(true);
  });
  it('OH-48240 routes to Dana Ruiz first', () => {
    const e = eligibleApprovers(USERS, 410000, 'USD', 'mark');
    expect(e[0].id).toBe('dana');
    expect(e.map((u) => u.id)).toEqual(['dana', 'rachel']);
  });
});

describe('rails', () => {
  it('picks rails by currency and amount', () => {
    expect(railFor('USD', 412436)).toBe('ACH');
    expect(railFor('USD', 1000000)).toBe('Fedwire');
    expect(railFor('EUR', 100)).toBe('SEPA');
    expect(railFor('MXN', 100)).toBe('SWIFT');
    expect(arrivalFor('ACH', TODAY)).toBe('2026-11-17');
    expect(paymentReference('ACH', TODAY, 1)).toBe('CVB-ACH-2026111601');
  });
});
