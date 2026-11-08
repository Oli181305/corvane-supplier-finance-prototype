import { useMemo } from 'react';
import { Card, LinkText, Money, PageHeader, Table } from '../../components/ui';
import { effectiveSupplierId, useCurrentUser, useStore } from '../../store/store';
import { fmtDate } from '../../logic/format';
import type { Invoice } from '../../types';

export type PaymentGroup = { reference: string; sentAt: string; rail: string; invoices: Invoice[]; face: number; discount: number; received: number; currency: string; payoutCurrency: string; status: string };

export function groupPayments(invoices: Invoice[]): PaymentGroup[] {
  const map = new Map<string, PaymentGroup>();
  for (const i of invoices) {
    if (!i.payment) continue;
    let g = map.get(i.payment.reference);
    if (!g) {
      g = { reference: i.payment.reference, sentAt: i.payment.sentAt, rail: i.payment.rail, invoices: [], face: 0, discount: 0, received: 0, currency: i.currency, payoutCurrency: i.payment.currency, status: i.payment.status };
      map.set(i.payment.reference, g);
    }
    g.invoices.push(i);
    g.face += i.amount;
    g.discount += i.quote?.discount ?? 0;
    g.received += i.payment.amount;
  }
  return [...map.values()].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export default function SupplierPayments() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const supplierId = effectiveSupplierId(user, viewAs);
  const groups = useMemo(() => groupPayments(data.invoices.filter((i) => i.supplierId === supplierId)), [data.invoices, supplierId]);

  return (
    <div>
      <PageHeader title="Payments" />
      <Card pad={false}>
        <Table
          rows={groups}
          rowKey={(g) => g.reference}
          empty="No payments yet. Early payments appear here with their advice."
          columns={[
            { key: 'date', header: 'Date', render: (g) => <span className="num">{fmtDate(g.sentAt)}</span>, sortValue: (g) => g.sentAt },
            { key: 'ref', header: 'Reference', render: (g) => <span className="num font-medium">{g.reference}</span> },
            { key: 'rail', header: 'Rail', render: (g) => g.rail },
            { key: 'inv', header: 'Invoices', render: (g) => g.invoices.map((i) => i.number).join(', ') },
            { key: 'face', header: 'Face value', align: 'right', render: (g) => <Money amount={g.face} currency={g.currency} />, sortValue: (g) => g.face },
            { key: 'disc', header: 'Discount', align: 'right', render: (g) => <Money amount={g.discount} currency={g.currency} /> },
            { key: 'recv', header: 'Received', align: 'right', render: (g) => <span className="font-medium"><Money amount={g.received} currency={g.payoutCurrency} /></span> },
            { key: 'adv', header: 'Advice', render: (g) => <LinkText to={`/print/advice/${g.reference}`}>Advice</LinkText> },
          ]}
        />
      </Card>
    </div>
  );
}
