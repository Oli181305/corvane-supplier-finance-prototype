import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type {
  Alert,
  AlertType,
  AuditEntry,
  Currency,
  Dispute,
  DisputeReason,
  Entity,
  Invoice,
  Notification,
  ObligationLump,
  PaymentCase,
  PendingConfigChange,
  PendingLimitChange,
  ProgramConfig,
  SettlementRun,
  StandingInstruction,
  Supplier,
  User,
} from '../types';
import {
  ERP_SUPPLIERS,
  SEED_ALERTS,
  SEED_AUDIT,
  SEED_CONFIG,
  SEED_DISPUTES,
  SEED_ENTITIES,
  SEED_INVOICES,
  SEED_NOTIFICATIONS,
  SEED_OBLIGATIONS,
  SEED_PROGRAM_USED_USD,
  SEED_SUPPLIERS,
  TODAY,
  USERS,
} from '../data/seed';
import { quoteFor } from '../logic/pricing';
import { runAcceptanceCriteria, unusualInvoiceRule, type CandidateInvoice } from '../logic/rules';
import { arrivalFor, paymentReference, railFor } from '../logic/rails';
import { FX_TO_USD, toUSD, crossRate } from '../logic/fx';
import { addDays, daysBetween, fmtDate, fmtInt, moneyFull, pct } from '../logic/format';

export type ViewAs = { portal: 'kaltrex' } | { portal: 'supplier'; supplierId: string };

export type DemoData = {
  today: string;
  config: ProgramConfig;
  users: User[];
  entities: Entity[];
  suppliers: Supplier[];
  invoices: Invoice[];
  disputes: Dispute[];
  alerts: Alert[];
  audit: AuditEntry[];
  notifications: Notification[];
  obligations: ObligationLump[];
  programUsedUSD: number;
  settlements: SettlementRun[];
  paymentCases: PaymentCase[];
  pendingConfig: PendingConfigChange | null;
  pendingLimits: PendingLimitChange | null;
  failNextDebit: boolean;
  counters: Record<string, number>;
  weeklyAccepted: Record<string, number>;
  fxNudge: number;
};

export type PayResult = {
  reference: string;
  rail: string;
  arrivesOn: string;
  totalFace: number;
  totalDiscount: number;
  totalNet: number;
  currency: Currency;
  payoutCurrency: Currency;
  payoutAmount: number;
  invoiceIds: string[];
  skipped: { id: string; reason: string }[];
};

type Store = {
  data: DemoData;
  currentUserId: string | null;
  pendingUserId: string | null;
  viewAs: ViewAs | null;
  entityFilter: string;
  reportingCurrency: 'USD' | 'local';

  // session
  beginLogin: (userId: string) => void;
  completeLogin: () => void;
  signOut: () => void;
  switchUser: (userId: string) => void;
  setViewAs: (v: ViewAs | null) => void;
  setEntityFilter: (id: string) => void;
  setReportingCurrency: (c: 'USD' | 'local') => void;
  markNotificationsRead: (portalKey: string) => void;

  // demo controls
  resetDemo: () => void;
  advanceToDueDate: () => { date: string; result: 'Success' | 'Failed'; total: number } | null;
  simulateFailedDebit: () => void;
  simulateDuplicate: () => string;
  simulateRatingChange: () => void;
  nudgeFx: () => void;

  // Kaltrex
  approveInvoice: (id: string, amount: number) => void;
  rejectInvoice: (id: string, reason: string) => void;
  routeInvoice: (id: string, toUserId: string) => void;
  nominateSuppliers: (erpIds: string[]) => void;
  proposeLimits: (limits: Record<string, number>) => void;
  confirmLimits: () => void;

  // Supplier
  requestEarlyPayment: (ids: string[], payoutCurrency?: Currency) => PayResult;
  setStandingInstruction: (supplierId: string, si: StandingInstruction) => void;
  requestBankAccountChange: (supplierId: string, bank: string, last4: string) => void;
  submitUploadedInvoice: (c: CandidateInvoice & { poNumber: string; grNumber: string }) => string;
  validateInvoice: (id: string) => void;
  finishCapture: (id: string) => void;
  submitRegistration: (supplierId: string, patch: Partial<Supplier>) => void;
  advanceCheck: (supplierId: string) => boolean;

  // Disputes (shared)
  raiseDispute: (invoiceId: string, reason: DisputeReason, text: string, documents: string[]) => string;
  addDisputeMessage: (disputeId: string, text: string, attachments?: string[]) => void;
  resolveDispute: (disputeId: string, resolution: Dispute['resolution']) => void;

  // Bank
  releaseHeld: (id: string, reason: string) => void;
  rejectHeld: (id: string, reason: string) => void;
  creditDecision: (supplierId: string, rating: 'A' | 'B' | 'C', subLimit: number, reason: string, approve: boolean) => void;
  simulateSignature: (supplierId: string) => void;
  proposeConfig: (config: ProgramConfig) => void;
  confirmConfig: () => void;
  closeAlert: (id: string, note: string) => void;
  addAlertNote: (id: string, text: string) => void;
  closePaymentCase: (id: string, note: string) => void;
};

function seedData(): DemoData {
  return structuredClone({
    today: TODAY,
    config: SEED_CONFIG,
    users: USERS,
    entities: SEED_ENTITIES,
    suppliers: SEED_SUPPLIERS,
    invoices: SEED_INVOICES,
    disputes: SEED_DISPUTES,
    alerts: SEED_ALERTS,
    audit: SEED_AUDIT,
    notifications: SEED_NOTIFICATIONS,
    obligations: SEED_OBLIGATIONS,
    programUsedUSD: SEED_PROGRAM_USED_USD,
    settlements: [],
    paymentCases: [],
    pendingConfig: null,
    pendingLimits: null,
    failNextDebit: false,
    counters: { dispute: 1044, alert: 202, dup: 0, upload: 0, settlement: 0, case: 0, nominate: 0 },
    weeklyAccepted: {},
    fxNudge: 0,
  });
}

/** Demo clock: the fixed demo date plus the real wall-clock time. */
export function nowTs(today: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${today}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

let seq = 0;
function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq}`;
}

function actor(d: DemoData, userId: string | null): { user: string; role: string } {
  const u = d.users.find((x) => x.id === userId);
  return u ? { user: u.name, role: u.role } : { user: 'System', role: 'System' };
}

function pushAudit(d: DemoData, who: { user: string; role: string }, action: string, object: string, detail: string) {
  d.audit.push({ id: nextId('a'), at: nowTs(d.today), ...who, action, object, detail });
}

function notify(d: DemoData, portal: string, text: string, link: string) {
  d.notifications.unshift({ id: nextId('n'), portal, at: nowTs(d.today), text, link, read: false });
}

function raiseAlert(d: DemoData, type: AlertType, subject: string, detail: string, owner: Alert['owner'], caseId?: string) {
  d.counters.alert += 1;
  const a: Alert = { id: `AL-${d.counters.alert}`, type, subject, detail, raisedAt: nowTs(d.today), owner, status: 'Open', notes: [], caseId };
  d.alerts.unshift(a);
  notify(d, 'bank', `Early warning. ${type}: ${subject}.`, `/bank/alerts/${a.id}`);
  return a;
}

function siAccepts(si: StandingInstruction, inv: Invoice, today: string, weeklyUsed: number): boolean {
  if (!si.on) return false;
  switch (si.mode) {
    case 'All':
      return true;
    case 'AboveAmount':
      return inv.amount > (si.value ?? 0);
    case 'MinDays':
      return daysBetween(today, inv.dueDate) >= (si.value ?? 0);
    case 'WeeklyAmount':
      return weeklyUsed + inv.amount <= (si.value ?? 0);
  }
}

/** Pays the given Offered invoices early. Mutates d. */
function payInvoices(d: DemoData, ids: string[], by: { user: string; role: string }, automatic: boolean, payoutCurrency?: Currency): PayResult {
  const today = d.today;
  const now = nowTs(today);
  const skipped: PayResult['skipped'] = [];
  const invs: Invoice[] = [];
  for (const id of ids) {
    const inv = d.invoices.find((i) => i.id === id);
    if (!inv) continue;
    const openDispute = d.disputes.find((x) => x.invoiceId === inv.id && x.status === 'Open');
    if (inv.status !== 'Offered') skipped.push({ id, reason: `Status is ${inv.status}. Only offered invoices can be paid early.` });
    else if (openDispute) skipped.push({ id, reason: 'Open dispute' });
    else invs.push(inv);
  }
  if (invs.length) {
    const addUSD = invs.reduce((s, i) => s + toUSD(i.amount, i.currency), 0);
    if (d.programUsedUSD - addUSD < 0 || d.programUsedUSD > d.config.programLimitUSD) {
      for (const i of invs) skipped.push({ id: i.id, reason: 'Kaltrex program limit check failed' });
      invs.length = 0;
    }
  }
  const currency = invs[0]?.currency ?? 'USD';
  const payout = payoutCurrency ?? currency;
  const totalFace = invs.reduce((s, i) => s + i.amount, 0);
  const rail = railFor(currency, totalFace);
  const arrivesOn = arrivalFor(rail, today);
  const todaysRefs = new Set(d.invoices.filter((i) => i.payment && i.payment.sentAt.slice(0, 10) === today).map((i) => i.payment!.reference));
  const reference = paymentReference(rail, today, todaysRefs.size + 1);
  const fx = currency === payout ? 1 : crossRate(currency, payout) * (1 + d.fxNudge);

  let totalDiscount = 0;
  let totalNet = 0;
  for (const inv of invs) {
    const q = quoteFor(inv.amount, inv.currency, inv.dueDate, today, d.config.spread);
    totalDiscount += q.discount;
    totalNet += q.netAmount;
    const payoutAmount = Math.round(q.netAmount * fx);
    inv.quote = { ...q, fxRate: currency === payout ? undefined : fx, payoutCurrency: payout, payoutAmount };
    inv.payment = { rail, reference, sentAt: now, arrivesOn, amount: payoutAmount, currency: payout, status: 'Sent' };
    inv.status = 'Paid early';
    inv.reason = undefined;
    inv.history.push({ at: now, by: by.user, action: automatic ? 'Accepted automatically by standing instruction' : 'Early payment accepted' });
    inv.history.push({ at: now, by: 'Payment hub', action: `Paid early. ${rail}. ${reference}`, detail: `${moneyFull(payoutAmount, payout)}. Arrives ${fmtDate(arrivesOn)}` });
    pushAudit(d, by, automatic ? 'Early payment accepted by standing instruction' : 'Early payment accepted', inv.number, `${moneyFull(inv.amount, inv.currency)} face. Net ${moneyFull(q.netAmount, inv.currency)}. ${rail}. ${reference}`);
    const wk = d.weeklyAccepted[inv.supplierId] ?? 0;
    d.weeklyAccepted[inv.supplierId] = wk + inv.amount;
  }
  if (invs.length) {
    const supplier = d.suppliers.find((s) => s.id === invs[0].supplierId);
    const list = invs.map((i) => i.number).join(', ');
    pushAudit(d, { user: 'Payment hub', role: 'System' }, 'Payment sent', reference, `${moneyFull(Math.round(totalNet * fx), payout)} by ${rail} to ${supplier?.name ?? ''}. ${list}. Arrives ${fmtDate(arrivesOn)}`);
    notify(d, `supplier:${invs[0].supplierId}`, `Payment sent. ${moneyFull(Math.round(totalNet * fx), payout)} by ${rail}. Arrives ${fmtDate(arrivesOn)}. ${reference}.`, `/supplier/payments`);
    notify(d, 'kaltrex', `${supplier?.name ?? 'Supplier'} accepted early payment on ${list}. Kaltrex pays the full amount on the due date.`, `/kaltrex/invoices/${invs[0].id}`);
    notify(d, 'bank', `Early payment ${reference} sent to ${supplier?.name ?? 'supplier'}. ${moneyFull(Math.round(totalNet * fx), payout)} by ${rail}.`, `/bank/payments`);
  }
  return {
    reference,
    rail,
    arrivesOn,
    totalFace,
    totalDiscount,
    totalNet,
    currency,
    payoutCurrency: payout,
    payoutAmount: Math.round(totalNet * fx),
    invoiceIds: invs.map((i) => i.id),
    skipped,
  };
}

function checkSupplierLimitAlert(d: DemoData, supplier: Supplier) {
  if (!supplier.approvedSubLimit) return;
  const share = supplier.subLimitUsed / supplier.approvedSubLimit;
  const open = d.alerts.find((a) => a.type === 'Limit nearly used' && a.subject === supplier.name && a.status === 'Open');
  if (share >= d.config.nearLimitAlertPct && !open) {
    raiseAlert(d, 'Limit nearly used', supplier.name, `Sub-limit ${Math.round(share * 100)}% used (${moneyFull(supplier.subLimitUsed, supplier.currency)} of ${moneyFull(supplier.approvedSubLimit, supplier.currency)}). Threshold is ${Math.round(d.config.nearLimitAlertPct * 100)}%.`, 'Credit');
  }
  const programShare = d.programUsedUSD / d.config.programLimitUSD;
  const openP = d.alerts.find((a) => a.type === 'Limit nearly used' && a.subject.startsWith('Kaltrex program') && a.status === 'Open');
  if (programShare >= d.config.nearLimitAlertPct && !openP) {
    raiseAlert(d, 'Limit nearly used', 'Kaltrex program limit', `Program limit ${Math.round(programShare * 100)}% used (USD ${fmtInt(d.programUsedUSD)} of USD ${fmtInt(d.config.programLimitUSD)}).`, 'Credit');
  }
}

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* storage blocked: the app keeps working in memory */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Clone the data, mutate it, write it back. */
      const mutate = <T,>(fn: (d: DemoData, s: Store) => T): T => {
        const s = get();
        const d = structuredClone(s.data);
        const out = fn(d, s);
        set({ data: d });
        return out;
      };
      const me = (d: DemoData, s: Store) => actor(d, s.currentUserId);

      return {
        data: seedData(),
        currentUserId: null,
        pendingUserId: null,
        viewAs: null,
        entityFilter: 'all',
        reportingCurrency: 'USD',

        beginLogin: (userId) => set({ pendingUserId: userId }),
        completeLogin: () => {
          const { pendingUserId } = get();
          if (!pendingUserId) return;
          set({ currentUserId: pendingUserId, pendingUserId: null, viewAs: null, entityFilter: 'all', reportingCurrency: 'USD' });
          mutate((d) => pushAudit(d, actor(d, pendingUserId), 'Signed in', 'Session', '2FA confirmed'));
        },
        signOut: () => {
          const { currentUserId } = get();
          mutate((d) => pushAudit(d, actor(d, currentUserId), 'Signed out', 'Session', ''));
          set({ currentUserId: null, pendingUserId: null, viewAs: null });
        },
        switchUser: (userId) => {
          set({ currentUserId: userId, pendingUserId: null, viewAs: null, entityFilter: 'all', reportingCurrency: 'USD' });
          mutate((d) => pushAudit(d, actor(d, userId), 'Signed in', 'Session', 'Demo switch user'));
        },
        setViewAs: (v) => {
          set({ viewAs: v, entityFilter: 'all' });
          mutate((d, s) => {
            const who = me(d, s);
            if (v) {
              const label = v.portal === 'kaltrex' ? 'Kaltrex workspace' : `${d.suppliers.find((x) => x.id === v.supplierId)?.name ?? 'supplier'} portal`;
              pushAudit(d, who, 'View as', label, 'Read only');
            } else pushAudit(d, who, 'View as ended', 'Bank staff screen', '');
          });
        },
        setEntityFilter: (id) => set({ entityFilter: id }),
        setReportingCurrency: (c) => set({ reportingCurrency: c }),
        markNotificationsRead: (portalKey) =>
          mutate((d) => {
            for (const n of d.notifications) if (n.portal === portalKey) n.read = true;
          }),

        resetDemo: () => {
          const { currentUserId } = get();
          const d = seedData();
          pushAudit(d, actor(d, currentUserId), 'Reset demo data', 'Demo', 'Seed data restored');
          set({ data: d, viewAs: null, entityFilter: 'all', reportingCurrency: 'USD' });
        },

        simulateFailedDebit: () =>
          mutate((d, s) => {
            d.failNextDebit = true;
            pushAudit(d, me(d, s), 'Demo control', 'Settlement', 'Next due-date debit will fail');
          }),

        advanceToDueDate: () =>
          mutate((d, s) => {
            const ran = new Set(d.settlements.map((r) => r.date));
            const paid = d.invoices.filter((i) => i.status === 'Paid early' && i.dueDate >= d.today && !ran.has(i.dueDate));
            if (!paid.length) return null;
            const date = paid.map((i) => i.dueDate).sort()[0];
            const previous = d.today;
            d.today = date;
            d.weeklyAccepted = {};
            pushAudit(d, me(d, s), 'Demo control', 'Demo clock', `Advanced from ${fmtDate(previous)} to ${fmtDate(date)}`);

            // Earlier maturities from the base book settle as the clock passes them.
            const passed = d.obligations.filter((o) => o.dueDate < date);
            if (passed.length) {
              const sum = passed.reduce((x, o) => x + o.amountUSD, 0);
              d.programUsedUSD -= sum;
              d.obligations = d.obligations.filter((o) => o.dueDate >= date);
              pushAudit(d, { user: 'Settlement', role: 'System' }, 'Settled earlier maturities', 'Program', `USD ${fmtInt(sum)} across ${new Set(passed.map((o) => o.dueDate)).size} due dates before ${fmtDate(date)}`);
            }

            const due = d.invoices.filter((i) => i.dueDate === date && (i.status === 'Paid early' || i.status === 'Offered' || i.status === 'Approved'));
            const total = due.reduce((x, i) => x + toUSD(i.amount, i.currency), 0);
            d.counters.settlement += 1;
            const run: SettlementRun = {
              id: `SET-${date.replace(/-/g, '')}-${d.counters.settlement}`,
              date,
              total,
              invoiceIds: due.map((i) => i.id),
              result: d.failNextDebit ? 'Failed' : 'Success',
              ranAt: nowTs(date),
              reconciled: [],
              advices: [],
            };
            const now = nowTs(date);
            if (d.failNextDebit) {
              d.failNextDebit = false;
              d.counters.case += 1;
              const pc: PaymentCase = {
                id: `PNR-${d.counters.case}`,
                settlementId: run.id,
                date,
                amount: total,
                graceDays: d.config.graceDays,
                lateInterest: d.config.lateInterest,
                status: 'Open',
                steps: [
                  { day: 0, step: 'Debit of the Kaltrex settlement account failed. Retry at 14:00 ET', owner: 'Operations', status: 'Done' },
                  { day: 0, step: 'Notify Kaltrex treasury (Dana Ruiz)', owner: 'Operations', status: 'Due' },
                  { day: 1, step: 'Relationship manager calls Kaltrex CFO', owner: 'Relationship manager', status: 'Pending' },
                  { day: 3, step: 'Grace period ends. Late interest starts', owner: 'Operations', status: 'Pending' },
                  { day: 3, step: 'Escalate to credit. Review program limit', owner: 'Credit', status: 'Pending' },
                ],
                notes: [],
              };
              d.paymentCases.unshift(pc);
              run.caseId = pc.id;
              const alert = raiseAlert(d, 'Payment not received', 'Kaltrex Industries Inc.', `Due-date debit of USD ${fmtInt(total)} on ${fmtDate(date)} failed. Grace period ${d.config.graceDays} days. Case ${pc.id}.`, 'Operations', pc.id);
              pc.notes.push({ at: now, by: 'System', text: `Alert ${alert.id} raised. Escalation path: operations, relationship manager, credit.` });
              for (const inv of due) inv.history.push({ at: now, by: 'Settlement', action: 'Due-date debit failed', detail: `Case ${pc.id}` });
              pushAudit(d, { user: 'Settlement', role: 'System' }, 'Due-date debit failed', run.id, `USD ${fmtInt(total)} for ${due.length} invoices due ${fmtDate(date)}. Case ${pc.id} opened`);
              notify(d, 'kaltrex', `Due-date debit of USD ${fmtInt(total)} on ${fmtDate(date)} was not received. Corvane Bank operations opened case ${pc.id}.`, '/kaltrex/obligations');
            } else {
              for (const inv of due) {
                inv.status = 'Settled';
                inv.settledOn = date;
                inv.history.push({ at: now, by: 'Settlement', action: `Settled. Kaltrex debited ${moneyFull(inv.amount, inv.currency)}`, detail: inv.payment ? `Reconciled to ${inv.payment.reference}` : 'Paid to supplier at maturity' });
                run.reconciled.push({ invoiceId: inv.id, reference: inv.payment?.reference ?? 'Maturity payment', matched: true });
                d.programUsedUSD -= toUSD(inv.amount, inv.currency);
                const sup = d.suppliers.find((x) => x.id === inv.supplierId);
                if (sup) {
                  sup.subLimitUsed = Math.max(0, sup.subLimitUsed - inv.amount);
                  run.advices.push(`Settlement advice to ${sup.name} for ${inv.number}`);
                  notify(d, `supplier:${sup.id}`, `${inv.number} settled on ${fmtDate(date)}. Kaltrex paid Corvane Bank in full.`, `/supplier/invoices/${inv.id}`);
                }
              }
              run.advices.push(`Debit advice to Kaltrex for USD ${fmtInt(total)}`);
              pushAudit(d, { user: 'Settlement', role: 'System' }, 'Due-date debit settled', run.id, `USD ${fmtInt(total)} for ${due.length} invoices due ${fmtDate(date)}. Reconciled. Interest and fees posted. Advices sent`);
              notify(d, 'kaltrex', `Due-date debit of USD ${fmtInt(total)} settled on ${fmtDate(date)}. ${due.length} invoices closed. Debit advice available.`, '/kaltrex/obligations');
              notify(d, 'bank', `Settlement ${run.id} completed. USD ${fmtInt(total)} debited and reconciled.`, '/bank/settlement');
            }
            d.settlements.unshift(run);
            return { date, result: run.result, total };
          }),

        simulateDuplicate: () =>
          mutate((d, s) => {
            const src = d.invoices.find((i) => i.number === 'OH-48211' && !i.id.includes('dup'))!;
            d.counters.dup += 1;
            const id = `${src.id}-dup${d.counters.dup}`;
            const now = nowTs(d.today);
            const outcome = runAcceptanceCriteria(
              { number: src.number, supplierId: src.supplierId, entityId: src.entityId, currency: src.currency, amount: src.amount, invoiceDate: src.invoiceDate, dueDate: src.dueDate, match: src.match },
              { config: d.config, suppliers: d.suppliers, entities: d.entities, invoices: d.invoices, today: d.today },
            );
            const reason = outcome.reason ?? `Duplicate of ${src.number} (same supplier, number, amount and date)`;
            const inv: Invoice = {
              ...structuredClone(src),
              id,
              source: 'PDF upload',
              status: 'Held',
              reason,
              heldRule: reason,
              heldSince: now,
              approvedBy: undefined,
              approvedAt: undefined,
              routedTo: undefined,
              quote: undefined,
              payment: undefined,
              settledOn: undefined,
              history: [
                { at: now, by: 'PDF upload', action: 'Received', detail: 'Uploaded by Lisa Grant (Mercer Precision Parts)' },
                { at: now, by: 'Rules engine', action: 'Duplicate found', detail: reason },
                { at: now, by: 'Rules engine', action: 'Held for review', detail: 'Waiting for bank operations' },
              ],
            };
            d.invoices.unshift(inv);
            pushAudit(d, me(d, s), 'Demo control', 'Capture', `Duplicate of ${src.number} pushed through capture`);
            pushAudit(d, { user: 'Rules engine', role: 'System' }, 'Held invoice for review', src.number, reason);
            notify(d, 'bank', `${src.number} (second copy) held for review. ${reason}.`, '/bank/review');
            return id;
          }),

        simulateRatingChange: () =>
          mutate((d, s) => {
            raiseAlert(d, 'Rating change', 'Kaltrex Industries Inc.', 'Kaltrex long-term rating moved from A- to BBB+ (outlook stable). Pricing spread and program limit are for credit to review. No limit changes by itself.', 'Credit');
            pushAudit(d, me(d, s), 'Demo control', 'Early warnings', 'Simulated Kaltrex rating change. Alert raised for credit');
          }),

        nudgeFx: () =>
          mutate((d) => {
            d.fxNudge = (Math.random() - 0.5) * 0.0008;
          }),

        approveInvoice: (id, amount) =>
          mutate((d, s) => {
            const inv = d.invoices.find((i) => i.id === id);
            if (!inv || inv.status !== 'In approval') return;
            const who = me(d, s);
            const now = nowTs(d.today);
            const sup = d.suppliers.find((x) => x.id === inv.supplierId);
            if (amount !== inv.amount) {
              inv.history.push({ at: now, by: who.user, action: `Amount adjusted to ${moneyFull(amount, inv.currency)}`, detail: `Invoice ${moneyFull(inv.amount, inv.currency)} less credit note` });
              inv.creditNote = inv.amount - amount;
              inv.amount = amount;
            }
            const q = quoteFor(inv.amount, inv.currency, inv.dueDate, d.today, d.config.spread);
            inv.status = 'Offered';
            inv.approvedBy = who.user;
            inv.approvedAt = now;
            inv.routedTo = undefined;
            inv.reason = undefined;
            inv.history.push({ at: now, by: who.user, action: `Approved. ${moneyFull(inv.amount, inv.currency)}. 2FA confirmed` });
            inv.history.push({ at: now, by: 'System', action: `Offered. Rate ${pct(q.rate)}. Net ${inv.currency} ${fmtInt(q.netAmount)}` });
            d.programUsedUSD += toUSD(inv.amount, inv.currency);
            d.obligations.push({ entityId: inv.entityId, dueDate: inv.dueDate, amountUSD: toUSD(inv.amount, inv.currency) });
            if (sup) sup.subLimitUsed += inv.amount;
            const entity = d.entities.find((e) => e.id === inv.entityId);
            pushAudit(d, who, 'Approved invoice', inv.number, `${moneyFull(inv.amount, inv.currency)}. Due ${fmtDate(inv.dueDate)}. 2FA confirmed. ${entity?.name ?? ''} committed to pay on the due date. Offered to ${sup?.name ?? ''}`);
            notify(d, `supplier:${inv.supplierId}`, `${inv.number} approved by Kaltrex and offered to you. ${moneyFull(inv.amount, inv.currency)}. Net ${moneyFull(q.netAmount, inv.currency)} today.`, '/supplier/offered');
            notify(d, 'bank', `${inv.number} approved by ${who.user} and offered to ${sup?.name ?? 'supplier'}.`, `/bank/invoices/${inv.id}`);
            if (sup) {
              checkSupplierLimitAlert(d, sup);
              if (siAccepts(sup.standingInstruction, inv, d.today, d.weeklyAccepted[sup.id] ?? 0)) {
                payInvoices(d, [inv.id], { user: 'Standing instruction', role: 'System' }, true, sup.payoutCurrency);
              }
            }
          }),

        rejectInvoice: (id, reason) =>
          mutate((d, s) => {
            const inv = d.invoices.find((i) => i.id === id);
            if (!inv) return;
            const who = me(d, s);
            inv.status = 'Rejected';
            inv.reason = reason;
            inv.history.push({ at: nowTs(d.today), by: who.user, action: 'Rejected', detail: reason });
            pushAudit(d, who, 'Rejected invoice', inv.number, reason);
            notify(d, `supplier:${inv.supplierId}`, `${inv.number} rejected by Kaltrex. ${reason}`, `/supplier/invoices/${inv.id}`);
          }),

        routeInvoice: (id, toUserId) =>
          mutate((d, s) => {
            const inv = d.invoices.find((i) => i.id === id);
            const to = d.users.find((u) => u.id === toUserId);
            if (!inv || !to) return;
            const who = me(d, s);
            inv.routedTo = to.id;
            inv.history.push({ at: nowTs(d.today), by: who.user, action: `Routed to ${to.name}`, detail: `Above ${who.user} approval limit` });
            pushAudit(d, who, 'Routed invoice', inv.number, `To ${to.name} (${to.role}, limit USD ${fmtInt(to.approvalLimit ?? 0)}). ${moneyFull(inv.amount, inv.currency)} is above the ${who.user} limit`);
            notify(d, 'kaltrex', `${inv.number} (${moneyFull(inv.amount, inv.currency)}) routed to ${to.name} for approval.`, `/kaltrex/approvals/${inv.id}`);
          }),

        nominateSuppliers: (erpIds) =>
          mutate((d, s) => {
            const who = me(d, s);
            for (const eid of erpIds) {
              const e = ERP_SUPPLIERS.find((x) => x.id === eid);
              if (!e || d.suppliers.find((x) => x.name === e.name)) continue;
              d.counters.nominate += 1;
              const sup: Supplier = {
                id: `nom-${d.counters.nominate}`,
                name: e.name,
                city: e.city,
                country: e.country,
                currency: e.currency,
                payoutCurrency: e.currency,
                kaltrexEntityId: e.entityId,
                onboardingStatus: 'Nominated',
                stageOwner: 'Ellen Ward',
                openedOn: d.today,
                nominatedOn: d.today,
                supplierSince: e.since,
                subLimitUsed: 0,
                bankAccount: { bank: '', last4: '', verified: false },
                checks: [],
                standingInstruction: { on: false, mode: 'All' },
                avgInvoice12m: Math.round(e.spend12m / 60),
                invoices12m: 60,
                volume12m: e.spend12m,
                history: [{ at: nowTs(d.today), by: who.user, action: 'Nominated by Kaltrex', detail: 'From Kaltrex supplier list in its ERP' }],
              };
              d.suppliers.push(sup);
              pushAudit(d, who, 'Nominated supplier', e.name, 'From Kaltrex supplier list in its ERP. Invitation sent');
              notify(d, 'bank', `Kaltrex nominated ${e.name}. Onboarding case opened.`, `/bank/onboarding/${sup.id}`);
            }
          }),

        proposeLimits: (limits) =>
          mutate((d, s) => {
            const who = me(d, s);
            d.pendingLimits = { by: who.user, at: nowTs(d.today), limits };
            pushAudit(d, who, 'Proposed approval limit change', 'Program settings', Object.entries(limits).map(([uid, v]) => `${d.users.find((u) => u.id === uid)?.name}: USD ${fmtInt(v)}`).join('. '));
          }),
        confirmLimits: () =>
          mutate((d) => {
            if (!d.pendingLimits) return;
            for (const [uid, v] of Object.entries(d.pendingLimits.limits)) {
              const u = d.users.find((x) => x.id === uid);
              if (u) u.approvalLimit = v;
            }
            pushAudit(d, { user: 'Rachel Kim', role: 'CFO' }, 'Confirmed approval limit change', 'Program settings', `Second user confirmation. Proposed by ${d.pendingLimits.by}`);
            d.pendingLimits = null;
          }),

        requestEarlyPayment: (ids, payoutCurrency) => mutate((d, s) => payInvoices(d, ids, me(d, s), false, payoutCurrency)),

        setStandingInstruction: (supplierId, si) =>
          mutate((d, s) => {
            const sup = d.suppliers.find((x) => x.id === supplierId);
            if (!sup) return;
            const who = me(d, s);
            sup.standingInstruction = si;
            const desc = !si.on
              ? 'Off'
              : si.mode === 'All'
                ? 'Every approved invoice'
                : si.mode === 'AboveAmount'
                  ? `Only invoices above ${moneyFull(si.value ?? 0, sup.currency)}`
                  : si.mode === 'MinDays'
                    ? `Only invoices with at least ${si.value} days left`
                    : `Up to ${moneyFull(si.value ?? 0, sup.currency)} each week, oldest first`;
            sup.history.push({ at: nowTs(d.today), by: who.user, action: 'Standing instruction saved', detail: desc });
            pushAudit(d, who, 'Standing instruction saved', sup.name, `${desc}. 2FA confirmed`);
            if (si.on) {
              const offered = d.invoices.filter((i) => i.supplierId === supplierId && i.status === 'Offered').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
              const toPay = offered.filter((i) => siAccepts(si, i, d.today, d.weeklyAccepted[supplierId] ?? 0)).map((i) => i.id);
              if (toPay.length) payInvoices(d, toPay, { user: 'Standing instruction', role: 'System' }, true, sup.payoutCurrency);
            }
          }),

        requestBankAccountChange: (supplierId, bank, last4) =>
          mutate((d, s) => {
            const sup = d.suppliers.find((x) => x.id === supplierId);
            if (!sup) return;
            const who = me(d, s);
            const old = sup.bankAccount;
            sup.bankAccount = { bank, last4, verified: false, changedOn: d.today };
            sup.history.push({ at: nowTs(d.today), by: who.user, action: 'Bank account changed', detail: `${old.bank} ···${old.last4} to ${bank} ···${last4}. Held for verification` });
            pushAudit(d, who, 'Changed bank account', sup.name, `${bank} ···${last4}. 2FA confirmed. Held for verification. Invoices paid to this account are held for review for ${d.config.bankChangeDays} days`);
            raiseAlert(d, 'Bank account changed', sup.name, `Payout account changed to ${bank} ···${last4} on ${fmtDate(d.today)}. Invoices paid to this account are held for review for ${d.config.bankChangeDays} days.`, 'Operations');
          }),

        submitUploadedInvoice: (c) =>
          mutate((d, s) => {
            d.counters.upload += 1;
            const id = `upl-${d.counters.upload}`;
            const who = me(d, s);
            const now = nowTs(d.today);
            const inv: Invoice = {
              id,
              number: c.number,
              supplierId: c.supplierId,
              entityId: c.entityId,
              currency: c.currency,
              amount: c.amount,
              invoiceDate: c.invoiceDate,
              dueDate: c.dueDate,
              poNumber: c.poNumber,
              grNumber: c.grNumber,
              match: c.match,
              source: 'PDF upload',
              status: 'Received',
              history: [{ at: now, by: 'PDF upload', action: 'Received', detail: `Uploaded by ${who.user}. Fields read by OCR` }],
            };
            d.invoices.unshift(inv);
            pushAudit(d, who, 'Uploaded invoice', inv.number, `${moneyFull(inv.amount, inv.currency)}. PDF upload. Fields read by OCR`);
            return id;
          }),

        validateInvoice: (id) =>
          mutate((d) => {
            const inv = d.invoices.find((i) => i.id === id);
            if (!inv || inv.status !== 'Received') return;
            const outcome = runAcceptanceCriteria(inv, { config: d.config, suppliers: d.suppliers, entities: d.entities, invoices: d.invoices, today: d.today, excludeId: inv.id });
            const now = nowTs(d.today);
            if (outcome.status === 'Rejected') {
              inv.status = 'Rejected';
              inv.reason = outcome.reason;
              inv.history.push({ at: now, by: 'Rules engine', action: 'Rejected', detail: outcome.reason });
              pushAudit(d, { user: 'Rules engine', role: 'System' }, 'Rejected invoice', inv.number, outcome.reason ?? '');
              notify(d, 'kaltrex', `${inv.number} rejected at capture. ${outcome.reason}.`, `/kaltrex/invoices/${inv.id}`);
            } else {
              inv.status = 'Validated';
              inv.history.push({ at: now, by: 'Rules engine', action: 'Validated', detail: outcome.reason });
            }
          }),

        finishCapture: (id) =>
          mutate((d) => {
            const inv = d.invoices.find((i) => i.id === id);
            if (!inv || inv.status !== 'Validated') return;
            const outcome = runAcceptanceCriteria(inv, { config: d.config, suppliers: d.suppliers, entities: d.entities, invoices: d.invoices, today: d.today, excludeId: inv.id });
            const now = nowTs(d.today);
            const sup = d.suppliers.find((x) => x.id === inv.supplierId);
            const approvers = d.users.filter((u) => u.portal === 'kaltrex');
            const rule = outcome.status === 'Held' ? outcome.reason! : unusualInvoiceRule(inv, { config: d.config, supplier: sup, approvers, today: d.today });
            if (rule) {
              inv.status = 'Held';
              inv.reason = rule;
              inv.heldRule = rule;
              inv.heldSince = now;
              inv.history.push({ at: now, by: outcome.status === 'Held' ? 'Rules engine' : 'Unusual-invoice rules', action: 'Held for review', detail: rule });
              pushAudit(d, { user: 'Rules engine', role: 'System' }, 'Held invoice for review', inv.number, rule);
              notify(d, 'bank', `${inv.number} held for review. ${rule}.`, '/bank/review');
            } else {
              inv.status = 'In approval';
              inv.reason = outcome.reason;
              inv.history.push({ at: now, by: 'Rules engine', action: 'Sent to approval', detail: outcome.reason });
              pushAudit(d, { user: 'Rules engine', role: 'System' }, 'Invoice accepted', inv.number, 'All acceptance criteria passed. Sent to Kaltrex approval queue');
              notify(d, 'kaltrex', `${inv.number} from ${sup?.name ?? 'supplier'} is waiting for approval.`, `/kaltrex/approvals/${inv.id}`);
            }
          }),

        submitRegistration: (supplierId, patch) =>
          mutate((d, s) => {
            const sup = d.suppliers.find((x) => x.id === supplierId);
            if (!sup) return;
            Object.assign(sup, patch);
            sup.onboardingStatus = 'Checks running';
            sup.stageOwner = 'Ellen Ward';
            sup.checks = [
              { name: 'Company confirmed in state registry', source: 'e-KYC registry API', result: 'Pending', detail: '' },
              { name: `Beneficial owners identified (${sup.owners?.length ?? 1})`, source: 'e-KYC, FinCEN CDD rule', result: 'Pending', detail: '' },
              { name: 'Sanctions screening', source: 'OFAC API', result: 'Pending', detail: '' },
              { name: 'Not a related party', source: 'KYC ownership data', result: 'Pending', detail: '' },
              { name: 'No competing lien', source: 'UCC search API', result: 'Pending', detail: '' },
              { name: 'Bank account ownership', source: 'Account verification', result: 'Pending', detail: '' },
            ];
            const who = me(d, s);
            sup.history.push({ at: nowTs(d.today), by: who.user, action: 'Registration submitted' });
            sup.history.push({ at: nowTs(d.today), by: 'Checks', action: 'Automatic checks started' });
            pushAudit(d, who, 'Submitted registration', sup.name, 'Four-step registration. Automatic checks started');
          }),

        advanceCheck: (supplierId) =>
          mutate((d) => {
            const sup = d.suppliers.find((x) => x.id === supplierId);
            if (!sup) return false;
            const running = sup.checks.find((c) => c.result === 'Running');
            if (running) {
              running.result = 'Passed';
              running.detail =
                running.source === 'e-KYC registry API'
                  ? 'Active entity. Name and address match the registration.'
                  : running.source.startsWith('e-KYC,')
                    ? 'Owners above 25% identified and verified.'
                    : running.source === 'OFAC API'
                      ? 'No match on SDN or consolidated lists.'
                      : running.source === 'KYC ownership data'
                        ? 'No common ownership or directors with Kaltrex.'
                        : running.source === 'UCC search API'
                          ? 'No UCC-1 filing against receivables.'
                          : 'Account name matches the legal entity.';
            }
            const next = sup.checks.find((c) => c.result === 'Pending');
            if (next) {
              next.result = 'Running';
              next.detail = 'Running';
              return true;
            }
            if (sup.checks.every((c) => c.result === 'Passed') && sup.onboardingStatus === 'Checks running') {
              sup.onboardingStatus = 'Awaiting credit decision';
              sup.stageOwner = 'Priya Shah';
              sup.bankAccount.verified = true;
              sup.recommendedRating = sup.recommendedRating ?? 'B';
              sup.recommendedSubLimit = sup.recommendedSubLimit ?? Math.round((sup.volume12m * 0.2) / 10000) * 10000;
              const now = nowTs(d.today);
              sup.history.push({ at: now, by: 'Checks', action: 'All automatic checks passed' });
              sup.history.push({ at: now, by: 'Rating model', action: `Recommendation. Rating ${sup.recommendedRating}. Sub-limit ${moneyFull(sup.recommendedSubLimit, sup.currency)}` });
              sup.history.push({ at: now, by: 'System', action: 'Assigned to Priya Shah for credit decision' });
              pushAudit(d, { user: 'Checks', role: 'System' }, 'All automatic checks passed', sup.name, 'e-KYC, beneficial owners, OFAC, UCC, bank account verification');
              pushAudit(d, { user: 'Rating model', role: 'System' }, 'Recommendation', sup.name, `Rating ${sup.recommendedRating}. Sub-limit ${moneyFull(sup.recommendedSubLimit, sup.currency)}. Awaiting credit officer decision`);
              notify(d, 'bank', `${sup.name} is waiting for a credit decision.`, `/bank/onboarding/${sup.id}`);
            }
            return false;
          }),

        raiseDispute: (invoiceId, reason, text, documents) =>
          mutate((d, s) => {
            const inv = d.invoices.find((i) => i.id === invoiceId)!;
            const who = me(d, s);
            const user = d.users.find((u) => u.id === s.currentUserId);
            const party: Dispute['raisedByParty'] = user?.portal === 'supplier' ? 'Supplier' : 'Kaltrex';
            d.counters.dispute += 1;
            const id = `D-${d.counters.dispute}`;
            const now = nowTs(d.today);
            const paidEarly = inv.status === 'Paid early' || inv.status === 'Settled';
            const disp: Dispute = {
              id,
              invoiceId,
              raisedBy: who.user,
              raisedByParty: party,
              raisedAt: now,
              reason,
              text,
              documents,
              paidEarly,
              status: 'Open',
              messages: [{ at: now, by: who.user, party, text, attachments: documents }],
              history: [{ at: now, by: who.user, action: 'Dispute raised', detail: paidEarly ? `${reason}. Invoice already paid early.` : reason }],
            };
            d.disputes.unshift(disp);
            if (!paidEarly) {
              inv.status = 'Disputed';
              inv.reason = `${reason}. Dispute open.`;
            } else {
              inv.reason = `${reason}. Dispute open.`;
            }
            inv.history.push({ at: now, by: who.user, action: 'Dispute raised', detail: `${reason}. ${id}` });
            pushAudit(d, who, 'Raised dispute', inv.number, `${reason}. ${id}.${paidEarly ? ' Invoice already paid early' : ' Removed from offered list'}`);
            const sup = d.suppliers.find((x) => x.id === inv.supplierId);
            if (party === 'Kaltrex') notify(d, `supplier:${inv.supplierId}`, `Kaltrex raised dispute ${id} on ${inv.number}. ${reason}.`, `/supplier/disputes/${id}`);
            else notify(d, 'kaltrex', `${sup?.name ?? 'Supplier'} raised dispute ${id} on ${inv.number}. ${reason}.`, `/kaltrex/disputes/${id}`);
            notify(d, 'bank', `Dispute ${id} raised on ${inv.number}.${paidEarly ? ' Invoice already paid early.' : ''}`, `/bank/disputes`);
            return id;
          }),

        addDisputeMessage: (disputeId, text, attachments) =>
          mutate((d, s) => {
            const disp = d.disputes.find((x) => x.id === disputeId);
            if (!disp) return;
            const who = me(d, s);
            const user = d.users.find((u) => u.id === s.currentUserId);
            const party: Dispute['messages'][number]['party'] = user?.portal === 'supplier' ? 'Supplier' : user?.portal === 'bank' ? 'Bank' : 'Kaltrex';
            disp.messages.push({ at: nowTs(d.today), by: who.user, party, text, attachments });
            if (attachments?.length) disp.documents.push(...attachments);
            const inv = d.invoices.find((i) => i.id === disp.invoiceId);
            pushAudit(d, who, 'Dispute message', inv?.number ?? disp.invoiceId, `${disp.id}. ${text.slice(0, 80)}`);
            const target = party === 'Supplier' ? 'kaltrex' : `supplier:${inv?.supplierId}`;
            notify(d, target, `${who.user} replied on dispute ${disp.id} (${inv?.number}).`, `${party === 'Supplier' ? '/kaltrex' : '/supplier'}/disputes/${disp.id}`);
          }),

        resolveDispute: (disputeId, resolution) =>
          mutate((d, s) => {
            const disp = d.disputes.find((x) => x.id === disputeId);
            if (!disp || !resolution) return;
            const who = me(d, s);
            const now = nowTs(d.today);
            const inv = d.invoices.find((i) => i.id === disp.invoiceId)!;
            disp.status = 'Resolved';
            disp.resolution = resolution;
            disp.resolvedAt = now;
            disp.history.push({ at: now, by: who.user, action: `Resolved. ${resolution}` });
            let detail = '';
            if (resolution === 'Credit note') {
              detail = `Credit note created against the next ${d.suppliers.find((x) => x.id === inv.supplierId)?.name ?? 'supplier'} invoice`;
              if (inv.status === 'Disputed') {
                inv.status = 'Offered';
                inv.reason = undefined;
              } else inv.reason = undefined;
            } else if (resolution === 'Corrected invoice') {
              detail = 'Corrected invoice re-enters capture. This invoice is closed';
              if (inv.status === 'Disputed') {
                inv.status = 'Rejected';
                inv.reason = 'Replaced by a corrected invoice';
              } else inv.reason = undefined;
            } else {
              detail = 'Amount confirmed';
              if (inv.status === 'Disputed') {
                inv.status = 'Offered';
                inv.reason = undefined;
                detail += '. Invoice returns to Offered';
              } else inv.reason = undefined;
            }
            disp.messages.push({ at: now, by: who.user, party: who.role.includes('Supplier') || who.role === 'AR clerk' ? 'Supplier' : 'Kaltrex', text: `Resolved. ${resolution}. ${detail}.` });
            inv.history.push({ at: now, by: who.user, action: `Dispute ${disp.id} resolved. ${resolution}`, detail });
            pushAudit(d, who, 'Resolved dispute', inv.number, `${disp.id}. ${resolution}. ${detail}`);
            notify(d, `supplier:${inv.supplierId}`, `Dispute ${disp.id} on ${inv.number} resolved. ${resolution}.`, `/supplier/disputes/${disp.id}`);
            notify(d, 'kaltrex', `Dispute ${disp.id} on ${inv.number} resolved. ${resolution}.`, `/kaltrex/disputes/${disp.id}`);
          }),

        releaseHeld: (id, reason) =>
          mutate((d, s) => {
            const inv = d.invoices.find((i) => i.id === id);
            if (!inv || inv.status !== 'Held') return;
            const who = me(d, s);
            inv.status = 'In approval';
            inv.reason = inv.match === 'Matched' ? undefined : `${inv.match}. Awaiting credit note.`;
            inv.heldRule = undefined;
            inv.history.push({ at: nowTs(d.today), by: who.user, action: 'Released to approval', detail: reason });
            pushAudit(d, who, 'Released held invoice', inv.number, reason);
            notify(d, 'kaltrex', `${inv.number} released by Corvane Bank operations and waiting for approval.`, `/kaltrex/approvals/${inv.id}`);
          }),

        rejectHeld: (id, reason) =>
          mutate((d, s) => {
            const inv = d.invoices.find((i) => i.id === id);
            if (!inv || inv.status !== 'Held') return;
            const who = me(d, s);
            inv.status = 'Rejected';
            inv.reason = reason;
            inv.history.push({ at: nowTs(d.today), by: who.user, action: 'Rejected by bank operations', detail: reason });
            pushAudit(d, who, 'Rejected held invoice', inv.number, reason);
            notify(d, `supplier:${inv.supplierId}`, `${inv.number} rejected by Corvane Bank operations. ${reason}`, `/supplier/invoices/${inv.id}`);
            notify(d, 'kaltrex', `${inv.number} rejected by Corvane Bank operations. ${reason}`, `/kaltrex/invoices/${inv.id}`);
          }),

        creditDecision: (supplierId, rating, subLimit, reason, approve) =>
          mutate((d, s) => {
            const sup = d.suppliers.find((x) => x.id === supplierId);
            if (!sup) return;
            const who = me(d, s);
            const now = nowTs(d.today);
            const override = rating !== sup.recommendedRating || subLimit !== sup.recommendedSubLimit;
            if (approve) {
              sup.rating = rating;
              sup.approvedSubLimit = subLimit;
              sup.onboardingStatus = 'Awaiting signature';
              sup.stageOwner = 'Ellen Ward';
              sup.history.push({ at: now, by: who.user, action: `Approved. Rating ${rating}. Sub-limit ${moneyFull(subLimit, sup.currency)}`, detail: override ? `Override of the rating model recommendation. Reason: ${reason}` : 'As recommended' });
              sup.history.push({ at: now, by: 'System', action: 'Supplier agreement sent for e-signature' });
              pushAudit(d, who, override ? 'Approved supplier (override)' : 'Approved supplier', sup.name, `Rating ${rating}. Sub-limit ${moneyFull(subLimit, sup.currency)}.${override ? ` Override of model recommendation (${sup.recommendedRating}, ${moneyFull(sup.recommendedSubLimit ?? 0, sup.currency)}). Reason: ${reason}` : ' As recommended'}. Agreement sent for e-signature`);
              notify(d, 'kaltrex', `${sup.name} approved by Corvane Bank. Rating ${rating}. Sub-limit ${moneyFull(subLimit, sup.currency)}. Agreement sent for signature.`, '/kaltrex/suppliers');
            } else {
              sup.onboardingStatus = 'Declined';
              sup.history.push({ at: now, by: who.user, action: 'Declined', detail: reason });
              pushAudit(d, who, 'Declined supplier', sup.name, reason);
              notify(d, 'kaltrex', `${sup.name} declined by Corvane Bank. ${reason}`, '/kaltrex/suppliers');
            }
          }),

        simulateSignature: (supplierId) =>
          mutate((d, s) => {
            const sup = d.suppliers.find((x) => x.id === supplierId);
            if (!sup) return;
            sup.onboardingStatus = 'Enrolled';
            sup.stageOwner = undefined;
            sup.history.push({ at: nowTs(d.today), by: sup.signers?.[0]?.name ?? 'Supplier signer', action: 'Supplier agreement signed (e-signature)' });
            sup.history.push({ at: nowTs(d.today), by: 'System', action: 'Enrolled' });
            pushAudit(d, me(d, s), 'Demo control', sup.name, 'Simulated supplier e-signature');
            pushAudit(d, { user: 'System', role: 'System' }, 'Supplier enrolled', sup.name, `Rating ${sup.rating}. Sub-limit ${moneyFull(sup.approvedSubLimit ?? 0, sup.currency)}`);
            notify(d, 'kaltrex', `${sup.name} is enrolled. Approved invoices are offered for early payment from now on.`, '/kaltrex/suppliers');
            notify(d, 'bank', `${sup.name} enrolled.`, `/bank/onboarding/${sup.id}`);
          }),

        proposeConfig: (config) =>
          mutate((d, s) => {
            const who = me(d, s);
            const changes: PendingConfigChange['changes'] = [];
            for (const k of Object.keys(config) as (keyof ProgramConfig)[]) {
              const a = JSON.stringify(d.config[k]);
              const b = JSON.stringify(config[k]);
              if (a !== b) changes.push({ field: k, from: a.replace(/"/g, ''), to: b.replace(/"/g, '') });
            }
            if (!changes.length) return;
            d.pendingConfig = { by: who.user, at: nowTs(d.today), changes, config };
            pushAudit(d, who, 'Proposed configuration change', 'Program configuration', changes.map((c) => `${c.field}: ${c.from} to ${c.to}`).join('. ') + '. Waiting for a second bank user');
          }),
        confirmConfig: () =>
          mutate((d) => {
            if (!d.pendingConfig) return;
            d.config = d.pendingConfig.config;
            pushAudit(d, { user: 'Priya Shah', role: 'Credit officer' }, 'Confirmed configuration change', 'Program configuration', `Second user confirmation. Proposed by ${d.pendingConfig.by}. ${d.pendingConfig.changes.map((c) => `${c.field}: ${c.to}`).join('. ')}`);
            d.pendingConfig = null;
          }),

        closeAlert: (id, note) =>
          mutate((d, s) => {
            const a = d.alerts.find((x) => x.id === id);
            if (!a) return;
            const who = me(d, s);
            a.status = 'Closed';
            if (note) a.notes.push({ at: nowTs(d.today), by: who.user, text: note });
            pushAudit(d, who, 'Closed alert', `${a.id} ${a.type}`, `${a.subject}. ${note}`);
          }),
        addAlertNote: (id, text) =>
          mutate((d, s) => {
            const a = d.alerts.find((x) => x.id === id);
            if (!a) return;
            const who = me(d, s);
            a.notes.push({ at: nowTs(d.today), by: who.user, text });
            pushAudit(d, who, 'Alert note', `${a.id} ${a.type}`, text.slice(0, 120));
          }),
        closePaymentCase: (id, note) =>
          mutate((d, s) => {
            const c = d.paymentCases.find((x) => x.id === id);
            if (!c) return;
            const who = me(d, s);
            c.status = 'Closed';
            c.notes.push({ at: nowTs(d.today), by: who.user, text: note });
            for (const st of c.steps) if (st.status !== 'Done') st.status = 'Done';
            const run = d.settlements.find((r) => r.id === c.settlementId);
            if (run) {
              for (const invId of run.invoiceIds) {
                const inv = d.invoices.find((i) => i.id === invId);
                if (inv && inv.status !== 'Settled') {
                  inv.status = 'Settled';
                  inv.settledOn = d.today;
                  inv.history.push({ at: nowTs(d.today), by: 'Settlement', action: `Settled after retry. Kaltrex debited ${moneyFull(inv.amount, inv.currency)}` });
                  d.programUsedUSD -= toUSD(inv.amount, inv.currency);
                }
              }
              run.result = 'Success';
              run.reconciled = run.invoiceIds.map((invId) => ({ invoiceId: invId, reference: d.invoices.find((i) => i.id === invId)?.payment?.reference ?? 'Maturity payment', matched: true }));
            }
            const alert = d.alerts.find((a) => a.caseId === id);
            if (alert) alert.status = 'Closed';
            pushAudit(d, who, 'Closed payment case', c.id, note);
          }),
      };
    },
    {
      name: 'corvane-supplier-finance-demo',
      version: 3,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        data: s.data,
        currentUserId: s.currentUserId,
        viewAs: s.viewAs,
        entityFilter: s.entityFilter,
        reportingCurrency: s.reportingCurrency,
      }),
      migrate: () => ({}) as unknown as Store,
      merge: (persisted, current) => {
        const p = persisted as Partial<Store> | undefined;
        if (!p || !p.data || !Array.isArray(p.data.invoices)) return current;
        return { ...current, ...p };
      },
    },
  ),
);

// Helpers used by many screens

export function useCurrentUser(): User | undefined {
  return useStore((s) => s.data.users.find((u) => u.id === s.currentUserId));
}

export function useToday(): string {
  return useStore((s) => s.data.today);
}

export function effectivePortal(user: User | undefined, viewAs: ViewAs | null): 'kaltrex' | 'supplier' | 'bank' | null {
  if (!user) return null;
  if (viewAs) return viewAs.portal;
  return user.portal;
}

export function effectiveSupplierId(user: User | undefined, viewAs: ViewAs | null): string | undefined {
  if (viewAs?.portal === 'supplier') return viewAs.supplierId;
  return user?.supplierId;
}

export function portalKey(user: User | undefined, viewAs: ViewAs | null): string {
  const p = effectivePortal(user, viewAs);
  if (p === 'supplier') return `supplier:${effectiveSupplierId(user, viewAs)}`;
  return p ?? 'none';
}

export function liveQuote(inv: Invoice, today: string, spread: number) {
  if (inv.quote && (inv.status === 'Paid early' || inv.status === 'Settled')) return inv.quote;
  return quoteFor(inv.amount, inv.currency, inv.dueDate, today, spread);
}

export function invoiceUSD(inv: Invoice): number {
  return toUSD(inv.amount, inv.currency, FX_TO_USD);
}

export function nextWeekStart(today: string) {
  return addDays(today, 7);
}
