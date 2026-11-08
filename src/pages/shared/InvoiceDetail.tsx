import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, KV, Money, PageHeader, Status, Table, Tabs, notPrototype } from '../../components/ui';
import { effectivePortal, liveQuote, useCurrentUser, useStore } from '../../store/store';
import { entityOf, supplierOf, usePortalBase, useReadOnly } from '../../store/selectors';
import { fmtDate, fmtTime, moneyFull, pct } from '../../logic/format';
import { runAcceptanceCriteria, unusualInvoiceRule } from '../../logic/rules';
import { toUSD } from '../../logic/fx';
import RaiseDisputeModal from './RaiseDisputeModal';

export default function InvoiceDetail() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const base = usePortalBase();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'summary' | 'checks' | 'history' | 'documents'>('summary');
  const [dispute, setDispute] = useState(false);

  const inv = data.invoices.find((i) => i.id === id);
  const portal = effectivePortal(user, viewAs);

  const checks = useMemo(() => {
    if (!inv) return null;
    const outcome = runAcceptanceCriteria(inv, { config: data.config, suppliers: data.suppliers, entities: data.entities, invoices: data.invoices, today: inv.history[0]?.at.slice(0, 10) ?? data.today, excludeId: inv.id });
    const sup = supplierOf(data, inv);
    const rule = inv.heldRule ?? unusualInvoiceRule(inv, { config: data.config, supplier: sup, approvers: data.users.filter((u) => u.portal === 'kaltrex'), today: data.today });
    return { outcome, rule };
  }, [inv, data]);

  if (!inv) {
    return (
      <div>
        <PageHeader title="Invoice not found" />
        <Button variant="link" onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  const sup = supplierOf(data, inv);
  const ent = entityOf(data, inv);
  const q = liveQuote(inv, data.today, data.config.spread);
  const showQuote = inv.status === 'Offered' || inv.status === 'Paid early' || inv.status === 'Settled';
  const dispute_ = data.disputes.find((x) => x.invoiceId === inv.id && x.status === 'Open');
  const isSupplierView = portal === 'supplier';
  const canDispute = !readOnly && !dispute_ && ['In approval', 'Offered', 'Paid early'].includes(inv.status) && (portal === 'kaltrex' || (portal === 'supplier' && user?.roleKey === 'supplierFinance'));
  const canApprove = !readOnly && portal === 'kaltrex' && inv.status === 'In approval';

  const crumbRoot = portal === 'supplier' ? { label: 'All invoices', to: '/supplier/invoices' } : portal === 'bank' ? { label: 'Invoices', to: '/bank/payments' } : { label: 'Approval queue', to: '/kaltrex/approvals' };

  const history = isSupplierView ? inv.history.filter((h) => !h.action.startsWith('Routed')) : inv.history;

  const docs = [
    { name: `${inv.number}.pdf`, type: 'Invoice', source: inv.source },
    { name: `${inv.poNumber}.pdf`, type: 'Purchase order', source: 'Kaltrex ERP' },
    { name: `${inv.grNumber}.pdf`, type: 'Goods receipt', source: 'Kaltrex ERP' },
    ...(inv.payment ? [{ name: `Advice ${inv.payment.reference}.pdf`, type: 'Payment advice', source: 'Corvane Bank' }] : []),
  ];

  return (
    <div>
      <PageHeader
        crumbs={[crumbRoot, { label: inv.number }]}
        title={
          <span className="flex items-center gap-4">
            <span>
              {inv.number} · {sup?.name} → {ent?.name}
            </span>
            <Status status={inv.status} />
          </span>
        }
        context={
          <span className="num">
            {moneyFull(inv.amount, inv.currency)} · Due {fmtDate(inv.dueDate)} · {inv.poNumber} · {inv.grNumber} · Source: {inv.source}
            {inv.reason ? <span className="text-amber"> · {inv.reason}</span> : null}
          </span>
        }
        actions={
          <>
            {canDispute ? <Button variant="secondary" onClick={() => setDispute(true)}>Raise dispute</Button> : null}
            {dispute_ ? <Button variant="link" onClick={() => navigate(`${base}/disputes/${dispute_.id}`)}>Open dispute {dispute_.id}</Button> : null}
            {canApprove ? <Button variant="primary" onClick={() => navigate(`/kaltrex/approvals/${inv.id}`)}>Open in approval queue</Button> : null}
            {portal === 'supplier' && inv.status === 'Offered' && !readOnly ? <Button variant="primary" onClick={() => navigate('/supplier/offered')}>Request payment</Button> : null}
            {portal === 'bank' && inv.status === 'Held' ? <Button variant="primary" onClick={() => navigate(`/bank/review/${inv.id}`)}>Open in review queue</Button> : null}
          </>
        }
      />

      <Tabs
        tabs={[
          { id: 'summary', label: 'Summary' },
          { id: 'checks', label: 'Checks' },
          { id: 'history', label: 'History', count: history.length },
          { id: 'documents', label: 'Documents', count: docs.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'summary' ? (
        <div className="grid grid-cols-3 gap-4">
          <Card title="Invoice">
            <KV
              rows={[
                ['Supplier', sup?.name ?? ''],
                ['Kaltrex entity', ent?.name ?? ''],
                ['Amount', moneyFull(inv.amount, inv.currency)],
                ...(inv.currency !== 'USD' ? [['USD equivalent', moneyFull(toUSD(inv.amount, inv.currency), 'USD')] as [string, string]] : []),
                ['Invoice date', fmtDate(inv.invoiceDate)],
                ['Due date', fmtDate(inv.dueDate)],
                ['Purchase order', inv.poNumber],
                ['Goods receipt', inv.grNumber],
                ['Three-way match', inv.match],
                ...(inv.creditNote ? [['Credit note applied', moneyFull(inv.creditNote, inv.currency)] as [string, string]] : []),
                ...(inv.approvedBy && !isSupplierView ? [['Approved by', `${inv.approvedBy} · ${fmtTime(inv.approvedAt)}`] as [string, string]] : inv.approvedAt ? [['Approved', fmtTime(inv.approvedAt)] as [string, string]] : []),
              ]}
            />
          </Card>
          <Card title={inv.status === 'Paid early' || inv.status === 'Settled' ? 'Early payment' : 'Quote'}>
            {showQuote ? (
              <KV
                rows={[
                  ['Rate', `${pct(q.rate)} a year`],
                  ['Market rate', `${q.marketRateName} ${pct(q.marketRate)} + ${pct(q.spread)} spread`],
                  ['Days to due date', `${q.days}`],
                  ['Discount', moneyFull(q.discount, inv.currency)],
                  ['Net amount', moneyFull(q.netAmount, inv.currency)],
                  ...(q.fxRate && q.payoutCurrency ? [['FX rate', `1 ${inv.currency} = ${q.fxRate.toFixed(4)} ${q.payoutCurrency}`] as [string, string], ['Paid out', moneyFull(q.payoutAmount ?? 0, q.payoutCurrency)] as [string, string]] : []),
                  ...(inv.payment
                    ? [
                        ['Rail', inv.payment.rail] as [string, string],
                        ['Reference', inv.payment.reference] as [string, string],
                        ['Sent', fmtTime(inv.payment.sentAt)] as [string, string],
                        ['Arrives', fmtDate(inv.payment.arrivesOn)] as [string, string],
                      ]
                    : [['Quote valid until', '16:00 ET today'] as [string, string]]),
                  ...(inv.settledOn ? [['Settled', fmtDate(inv.settledOn)] as [string, string]] : []),
                ]}
              />
            ) : (
              <p className="text-sm text-grey">
                {inv.status === 'In approval' ? 'A quote appears once Kaltrex approves the invoice.' : inv.status === 'Held' ? 'Held for bank operations review. No quote until it is released and approved.' : inv.status === 'Disputed' ? 'Removed from the offered list while the dispute is open.' : inv.status === 'Rejected' ? `Rejected. ${inv.reason ?? ''}` : 'No quote yet.'}
              </p>
            )}
          </Card>
          <Card title="Line item">
            {inv.lineItem ? (
              <KV
                rows={[
                  ['Description', inv.lineItem.description],
                  ['Invoiced', `${inv.lineItem.qty.toLocaleString('en-US')} × ${moneyFull(inv.lineItem.unitPrice, inv.currency)}`],
                  ['Ordered (PO)', `${(inv.lineItem.poQty ?? inv.lineItem.qty).toLocaleString('en-US')}`],
                  ['Received (GR)', `${(inv.lineItem.grQty ?? inv.lineItem.qty).toLocaleString('en-US')}${inv.lineItem.grDate ? ` on ${fmtDate(inv.lineItem.grDate)}` : ''}`],
                  ['Inspection', inv.lineItem.grNote ?? ''],
                ]}
              />
            ) : (
              <KV
                rows={[
                  ['Description', 'Machined components (summary line)'],
                  ['Ordered (PO)', 'Agrees with invoice'],
                  ['Received (GR)', inv.match === 'Matched' ? 'Agrees with invoice' : inv.match],
                ]}
              />
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'checks' && checks ? (
        <Card pad={false}>
          <Table
            rows={[
              ...checks.outcome.results.map((r) => ({ name: r.name, result: r.result === 'Variance' ? r.detail : r.result, detail: r.result === 'Passed' && r.name.startsWith('Due date') ? r.detail : r.result === 'Passed' ? '' : r.detail })),
              { name: 'Unusual-invoice rules', result: checks.rule ? 'Held' : 'None applied', detail: checks.rule ?? `Checked against ${data.config.unusualSizeMultiple}× average, round figures from USD ${data.config.roundFigureThreshold.toLocaleString('en-US')}, ${Math.round(data.config.nearLimitPct * 100)}% below an approval limit, bank change within ${data.config.bankChangeDays} days` },
            ]}
            rowKey={(r) => r.name}
            columns={[
              { key: 'name', header: 'Acceptance criteria', render: (r) => r.name, width: '40%' },
              { key: 'result', header: 'Result', render: (r) => (r.result === 'Passed' || r.result === 'Failed' || r.result === 'Held' ? <Status status={r.result} /> : <span className={r.result === 'None applied' ? 'text-grey' : 'text-amber'}>{r.result}</span>) },
              { key: 'detail', header: 'Detail', render: (r) => <span className="text-grey">{r.detail}</span> },
            ]}
          />
        </Card>
      ) : null}

      {tab === 'history' ? (
        <Card title="History (trade tracking)" pad={false}>
          <Table
            rows={history}
            rowKey={(h) => `${h.at}-${h.action}`}
            columns={[
              { key: 'at', header: 'Time', width: '140px', render: (h) => <span className="num">{fmtTime(h.at)}</span> },
              { key: 'by', header: 'By', width: '200px', render: (h) => h.by },
              { key: 'action', header: 'Action', render: (h) => <span>{h.action}{h.detail ? <span className="text-grey"> · {h.detail}</span> : null}</span> },
            ]}
          />
        </Card>
      ) : null}

      {tab === 'documents' ? (
        <Card pad={false}>
          <Table
            rows={docs}
            rowKey={(d) => d.name}
            columns={[
              { key: 'name', header: 'Document', render: (d) => <Button variant="link" onClick={notPrototype}>{d.name}</Button> },
              { key: 'type', header: 'Type', render: (d) => d.type },
              { key: 'source', header: 'Source', render: (d) => <span className="text-grey">{d.source}</span> },
            ]}
          />
        </Card>
      ) : null}

      {dispute ? <RaiseDisputeModal invoiceId={inv.id} onClose={() => setDispute(false)} /> : null}
    </div>
  );
}

export function MoneyCell({ inv }: { inv: { amount: number; currency: string } }) {
  return <Money amount={inv.amount} currency={inv.currency} />;
}
