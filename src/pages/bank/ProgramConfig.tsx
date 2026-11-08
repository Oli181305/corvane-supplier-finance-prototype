import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Notice, PageHeader, TwoFactor } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import type { Currency, ProgramConfig as Cfg } from '../../types';
import { fmtTime } from '../../logic/format';
import { toast } from '../../store/toast';

type Form = Record<keyof Cfg, string>;

function toForm(c: Cfg): Form {
  return {
    programLimitUSD: String(c.programLimitUSD),
    spread: (c.spread * 100).toFixed(2),
    minInvoiceUSD: String(c.minInvoiceUSD),
    minDaysToDue: String(c.minDaysToDue),
    maxDaysToDue: String(c.maxDaysToDue),
    currencies: c.currencies.join(', '),
    supplierMinMonths: String(c.supplierMinMonths),
    supplierMinVolumeUSD: String(c.supplierMinVolumeUSD),
    maxDilution: (c.maxDilution * 100).toFixed(1),
    unusualSizeMultiple: String(c.unusualSizeMultiple),
    roundFigureThreshold: String(c.roundFigureThreshold),
    roundFigureUnit: String(c.roundFigureUnit),
    nearLimitPct: (c.nearLimitPct * 100).toFixed(1),
    bankChangeDays: String(c.bankChangeDays),
    nearLimitAlertPct: (c.nearLimitAlertPct * 100).toFixed(0),
    graceDays: String(c.graceDays),
    lateInterest: (c.lateInterest * 100).toFixed(2),
  };
}

function fromForm(f: Form, base: Cfg): Cfg {
  const n = (s: string) => Number(String(s).replace(/[^\d.]/g, '')) || 0;
  const ccy = f.currencies.split(',').map((x) => x.trim().toUpperCase()).filter((x): x is Currency => ['USD', 'EUR', 'MXN', 'CNY', 'SGD'].includes(x));
  return {
    ...base,
    programLimitUSD: n(f.programLimitUSD),
    spread: n(f.spread) / 100,
    minInvoiceUSD: n(f.minInvoiceUSD),
    minDaysToDue: n(f.minDaysToDue),
    maxDaysToDue: n(f.maxDaysToDue),
    currencies: ccy.length ? ccy : base.currencies,
    supplierMinMonths: n(f.supplierMinMonths),
    supplierMinVolumeUSD: n(f.supplierMinVolumeUSD),
    maxDilution: n(f.maxDilution) / 100,
    unusualSizeMultiple: n(f.unusualSizeMultiple),
    roundFigureThreshold: n(f.roundFigureThreshold),
    roundFigureUnit: n(f.roundFigureUnit),
    nearLimitPct: n(f.nearLimitPct) / 100,
    bankChangeDays: n(f.bankChangeDays),
    nearLimitAlertPct: n(f.nearLimitAlertPct) / 100,
    graceDays: n(f.graceDays),
    lateInterest: n(f.lateInterest) / 100,
  };
}

export default function ProgramConfig() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const propose = useStore((s) => s.proposeConfig);
  const confirm = useStore((s) => s.confirmConfig);
  const ratingChange = useStore((s) => s.simulateRatingChange);
  const [form, setForm] = useState<Form>(toForm(data.config));
  const [twofa, setTwofa] = useState(false);
  useEffect(() => setForm(toForm(data.config)), [data.config]);

  const canEdit = user?.roleKey === 'admin';
  const next = fromForm(form, data.config);
  const changed = JSON.stringify(next) !== JSON.stringify(data.config);
  const f = (k: keyof Cfg, label: string, hint?: string, unit?: string) => (
    <Field key={k} label={label} hint={hint}>
      <div className="flex items-center gap-2">
        {unit ? <span className="w-10 text-sm text-grey">{unit}</span> : null}
        <Input value={form[k]} disabled={!canEdit} title={!canEdit ? 'Only the program admin can edit the configuration' : undefined} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      </div>
    </Field>
  );

  return (
    <div>
      <PageHeader
        title="Program configuration"
        actions={
          <>
            <Button variant="secondary" onClick={() => { ratingChange(); toast('Rating change alert raised', 'Early warnings shows a Rating change case for credit. No limit changed.', { to: '/bank/alerts', label: 'Open early warnings' }, 'info'); }}>Simulate Kaltrex rating change</Button>
            <Button variant="primary" disabled={!canEdit || !changed} title={!canEdit ? 'Only the program admin can edit the configuration' : !changed ? 'No change to save' : undefined} onClick={() => setTwofa(true)}>Save</Button>
          </>
        }
      />

      {data.pendingConfig ? (
        <Notice kind="warning" className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium">Change waiting for a second bank user to confirm</div>
              <div className="num mt-1 text-sm">Proposed by {data.pendingConfig.by} at {fmtTime(data.pendingConfig.at)}: {data.pendingConfig.changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join(' · ')}</div>
            </div>
            <Button variant="link" onClick={() => { confirm(); toast('Configuration updated', 'Confirmed by a second bank user (demo). Quotes and rules now use the new values.'); }}>Confirm as second user (demo)</Button>
          </div>
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <Card title="Program limit and pricing">
          <div className="grid grid-cols-2 gap-4">
            {f('programLimitUSD', 'Program limit', 'Total exposure to Kaltrex', 'USD')}
            {f('spread', 'Spread over market rate', 'Set by the Kaltrex credit rating. Rate = market rate + spread', '%')}
            {f('currencies', 'Currencies in the program', 'USD, EUR, MXN, CNY, SGD')}
            {f('lateInterest', 'Late interest after grace', 'Over the program rate', '%')}
            {f('graceDays', 'Grace period on a missed debit', undefined, 'days')}
          </div>
        </Card>
        <Card title="Invoice acceptance criteria">
          <div className="grid grid-cols-2 gap-4">
            {f('minInvoiceUSD', 'Minimum invoice amount', 'USD equivalent', 'USD')}
            {f('minDaysToDue', 'Minimum days to due date', undefined, 'days')}
            {f('maxDaysToDue', 'Maximum days to due date', undefined, 'days')}
          </div>
        </Card>
        <Card title="Supplier acceptance criteria">
          <div className="grid grid-cols-2 gap-4">
            {f('supplierMinMonths', 'Minimum months supplying Kaltrex', undefined, 'months')}
            {f('supplierMinVolumeUSD', 'Minimum 12-month volume', undefined, 'USD')}
            {f('maxDilution', 'Maximum dilution', 'Credit notes to invoices', '%')}
            {f('nearLimitAlertPct', 'Limit nearly used alert at', 'Sub-limit or program limit', '%')}
          </div>
        </Card>
        <Card title="Unusual-invoice rules (fixed rules, not AI)">
          <div className="grid grid-cols-2 gap-4">
            {f('unusualSizeMultiple', 'Hold above × supplier 12-month average', undefined, '×')}
            {f('roundFigureThreshold', 'Round figure check from', undefined, 'USD')}
            {f('roundFigureUnit', 'Round figure multiple', undefined, 'USD')}
            {f('nearLimitPct', 'Hold within % below an approval limit', undefined, '%')}
            {f('bankChangeDays', 'Hold after a bank account change for', undefined, 'days')}
          </div>
        </Card>
      </div>

      {twofa ? (
        <TwoFactor
          purpose="Save program configuration."
          onCancel={() => setTwofa(false)}
          onConfirm={() => {
            propose(next);
            setTwofa(false);
            toast('Change waiting for a second bank user to confirm', 'Use the confirm link to complete the change in the demo.', undefined, 'info');
          }}
        />
      ) : null}
    </div>
  );
}
