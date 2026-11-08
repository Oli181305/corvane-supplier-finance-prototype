import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Field, LinkText, Money, PageHeader, Select, Status, Table } from '../../components/ui';
import { useStore } from '../../store/store';
import { fmtTime } from '../../logic/format';
import { groupPayments } from '../supplier/Payments';

export default function BankPayments() {
  const data = useStore((s) => s.data);
  const navigate = useNavigate();
  const [rail, setRail] = useState('all');
  const [ccy, setCcy] = useState('all');
  const groups = useMemo(() => groupPayments(data.invoices).filter((g) => (rail === 'all' || g.rail === rail) && (ccy === 'all' || g.payoutCurrency === ccy)), [data.invoices, rail, ccy]);

  return (
    <div>
      <PageHeader title="Payments" />
      <div className="mb-4 flex gap-3">
        <Field label="Rail">
          <Select value={rail} onChange={(e) => setRail(e.target.value)} className="w-[160px]">
            <option value="all">All rails</option>
            {['ACH', 'Fedwire', 'SEPA', 'SWIFT'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Currency">
          <Select value={ccy} onChange={(e) => setCcy(e.target.value)} className="w-[160px]">
            <option value="all">All currencies</option>
            {data.config.currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Card pad={false}>
        <Table
          rows={groups}
          rowKey={(g) => g.reference}
          onRowClick={(g) => navigate(`/bank/invoices/${g.invoices[0].id}`)}
          empty="No payments match the filters."
          columns={[
            { key: 'ref', header: 'Reference', render: (g) => <span className="num font-medium">{g.reference}</span>, sortValue: (g) => g.reference },
            { key: 'sup', header: 'Supplier', render: (g) => data.suppliers.find((s) => s.id === g.invoices[0].supplierId)?.name, sortValue: (g) => g.invoices[0].supplierId },
            { key: 'inv', header: 'Invoices', render: (g) => g.invoices.map((i) => i.number).join(', ') },
            { key: 'rail', header: 'Rail', render: (g) => g.rail, sortValue: (g) => g.rail },
            { key: 'ccy', header: 'Currency', render: (g) => g.payoutCurrency },
            { key: 'amt', header: 'Amount', align: 'right', render: (g) => <Money amount={g.received} currency={g.payoutCurrency} />, sortValue: (g) => g.received },
            { key: 'disc', header: 'Discount', align: 'right', render: (g) => <Money amount={g.discount} currency={g.currency} /> },
            { key: 'sent', header: 'Sent', render: (g) => <span className="num">{fmtTime(g.sentAt)}</span>, sortValue: (g) => g.sentAt },
            { key: 'st', header: 'Status', render: (g) => <Status status={g.status} /> },
            { key: 'adv', header: 'Advice', render: (g) => <span onClick={(e) => e.stopPropagation()}><LinkText to={`/print/advice/${g.reference}`}>Advice</LinkText></span> },
          ]}
        />
      </Card>
    </div>
  );
}
