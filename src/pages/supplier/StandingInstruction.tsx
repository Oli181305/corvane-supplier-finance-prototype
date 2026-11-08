import { useState } from 'react';
import { Button, Card, Input, Notice, PageHeader, Radio, TwoFactor } from '../../components/ui';
import { effectiveSupplierId, useCurrentUser, useStore } from '../../store/store';
import { useReadOnly } from '../../store/selectors';
import type { StandingInstruction } from '../../types';
import { toast } from '../../store/toast';
import { moneyFull } from '../../logic/format';

export default function StandingInstructionPage() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const readOnly = useReadOnly();
  const supplierId = effectiveSupplierId(user, viewAs);
  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const save = useStore((s) => s.setStandingInstruction);
  const [si, setSi] = useState<StandingInstruction>(supplier?.standingInstruction ?? { on: false, mode: 'All' });
  const [values, setValues] = useState({ AboveAmount: si.mode === 'AboveAmount' ? String(si.value ?? '') : '50000', MinDays: si.mode === 'MinDays' ? String(si.value ?? '') : '30', WeeklyAmount: si.mode === 'WeeklyAmount' ? String(si.value ?? '') : '250000' });
  const [twofa, setTwofa] = useState(false);
  if (!supplier) return null;

  const canEdit = !readOnly && user?.roleKey === 'supplierFinance';
  const choice = si.on ? si.mode : 'Off';
  const set = (mode: StandingInstruction['mode'] | 'Off') => setSi(mode === 'Off' ? { on: false, mode: 'All' } : { on: true, mode });
  const ccy = supplier.currency;

  const describe = (s: StandingInstruction) =>
    !s.on ? 'Off' : s.mode === 'All' ? 'Every approved invoice' : s.mode === 'AboveAmount' ? `Only invoices above ${moneyFull(s.value ?? 0, ccy)}` : s.mode === 'MinDays' ? `Only invoices with at least ${s.value} days left to the due date` : `Up to ${moneyFull(s.value ?? 0, ccy)} each week, oldest first`;

  const valueFor = (s: StandingInstruction): number | undefined => (s.mode === 'All' || !s.on ? undefined : Number(values[s.mode as keyof typeof values].replace(/[^\d.]/g, '')) || 0);

  return (
    <div>
      <PageHeader title="Standing instruction" />
      <Card>
        <div className="mb-4 text-sm text-grey">
          Current rule: <span className="text-ink">{describe(supplier.standingInstruction)}</span>
        </div>
        <div className="divide-y divide-border">
          <Radio checked={choice === 'Off'} onChange={() => set('Off')} label="Off" disabled={!canEdit} />
          <Radio checked={choice === 'All'} onChange={() => set('All')} label="Every approved invoice" disabled={!canEdit} />
          <Radio checked={choice === 'AboveAmount'} onChange={() => set('AboveAmount')} label="Only invoices above an amount" disabled={!canEdit}>
            <span className="text-grey">{ccy}</span>
            <Input value={values.AboveAmount} disabled={!canEdit || choice !== 'AboveAmount'} onChange={(e) => setValues({ ...values, AboveAmount: e.target.value })} className="w-[140px]" />
          </Radio>
          <Radio checked={choice === 'MinDays'} onChange={() => set('MinDays')} label="Only invoices with at least" disabled={!canEdit}>
            <Input value={values.MinDays} disabled={!canEdit || choice !== 'MinDays'} onChange={(e) => setValues({ ...values, MinDays: e.target.value })} className="w-[80px]" />
            <span className="text-grey">days left to the due date</span>
          </Radio>
          <Radio checked={choice === 'WeeklyAmount'} onChange={() => set('WeeklyAmount')} label="Up to an amount each week" disabled={!canEdit}>
            <span className="text-grey">{ccy}</span>
            <Input value={values.WeeklyAmount} disabled={!canEdit || choice !== 'WeeklyAmount'} onChange={(e) => setValues({ ...values, WeeklyAmount: e.target.value })} className="w-[140px]" />
            <span className="text-grey">oldest first</span>
          </Radio>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span />
          <Button variant="primary" disabled={!canEdit} title={!canEdit ? (readOnly ? 'Read only while viewing as a supplier' : 'Only the supplier finance manager can set a standing instruction') : undefined} onClick={() => setTwofa(true)}>
            Save
          </Button>
        </div>
      </Card>
      {twofa ? (
        <TwoFactor
          purpose={`Save standing instruction: ${describe({ ...si, value: valueFor(si) })}.`}
          onCancel={() => setTwofa(false)}
          onConfirm={() => {
            const before = data.invoices.filter((i) => i.supplierId === supplierId && i.status === 'Offered').length;
            const next = { ...si, value: valueFor(si) };
            save(supplier.id, next);
            const after = useStore.getState().data.invoices.filter((i) => i.supplierId === supplierId && i.status === 'Offered').length;
            const paid = before - after;
            setTwofa(false);
            toast('Standing instruction saved', `${describe(next)}.${paid > 0 ? ` ${paid} offered invoice${paid === 1 ? '' : 's'} accepted at once.` : ''}`, paid > 0 ? { to: '/supplier/payments', label: 'Open payments' } : undefined);
          }}
        />
      ) : null}
    </div>
  );
}
