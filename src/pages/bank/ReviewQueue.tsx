import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Field, KV, MatchText, Money, Notice, PageHeader, SidePanel, Status, Table, Textarea } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { daysBetween, fmtDate, fmtTime, moneyFull } from '../../logic/format';
import { toast } from '../../store/toast';
import type { Invoice } from '../../types';

export default function ReviewQueue() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const navigate = useNavigate();
  const held = data.invoices.filter((i) => i.status === 'Held').sort((a, b) => (b.heldSince ?? '').localeCompare(a.heldSince ?? ''));
  const open = id ? data.invoices.find((i) => i.id === id) : undefined;

  return (
    <div>
      <PageHeader title="Review queue" />
      <Card pad={false}>
        <Table
          rows={held}
          rowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/bank/review/${i.id}`)}
          empty="No held invoices. Invoices held by the unusual-invoice rules appear here."
          columns={[
            { key: 'n', header: 'Invoice', render: (i) => <span className="font-medium">{i.number}</span>, sortValue: (i) => i.number },
            { key: 's', header: 'Supplier', render: (i) => data.suppliers.find((s) => s.id === i.supplierId)?.name, sortValue: (i) => i.supplierId },
            { key: 'e', header: 'Entity', render: (i) => data.entities.find((e) => e.id === i.entityId)?.short },
            { key: 'a', header: 'Amount', align: 'right', render: (i) => <Money amount={i.amount} currency={i.currency} />, sortValue: (i) => i.amount },
            { key: 'rule', header: 'Rule that held it', render: (i) => <Status status="Held" reason={i.heldRule ?? i.reason} /> },
            { key: 'since', header: 'Held since', render: (i) => <span className="num">{fmtTime(i.heldSince)}</span>, sortValue: (i) => i.heldSince ?? '' },
            { key: 'src', header: 'Source', render: (i) => <span className="text-grey">{i.source}</span> },
          ]}
        />
      </Card>
      {open ? <ReviewPanel inv={open} onClose={() => navigate('/bank/review')} /> : null}
    </div>
  );
}

function ReviewPanel({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const release = useStore((s) => s.releaseHeld);
  const reject = useStore((s) => s.rejectHeld);
  const [reason, setReason] = useState('');
  const sup = data.suppliers.find((s) => s.id === inv.supplierId);
  const ent = data.entities.find((e) => e.id === inv.entityId);
  const recent = data.invoices.filter((i) => i.supplierId === inv.supplierId && i.id !== inv.id && i.status !== 'Held').sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).slice(0, 6);
  const canAct = user?.roleKey === 'operations' || user?.roleKey === 'admin';
  const isHeld = inv.status === 'Held';
  const dupOf = inv.heldRule?.match(/Duplicate of ([A-Z]+-\d+)/)?.[1];
  const original = dupOf ? data.invoices.find((i) => i.number === dupOf && i.id !== inv.id && !i.id.includes('dup')) : undefined;
  const tip = !canAct ? 'Only bank operations can release or reject a held invoice' : reason.trim().length < 5 ? 'Enter a reason first' : undefined;

  return (
    <SidePanel
      title={`Review ${inv.number}`}
      subtitle={<span className="num">{sup?.name} → {ent?.name} · {moneyFull(inv.amount, inv.currency)} · Due {fmtDate(inv.dueDate)} · {inv.source}</span>}
      onClose={onClose}
      width={880}
      footer={
        isHeld ? (
          <>
            <Button variant="primary" disabled={!!tip} title={tip} onClick={() => { release(inv.id, reason.trim()); toast(`${inv.number} released to approval`, reason.trim()); onClose(); }}>
              Release to approval
            </Button>
            <Button variant="destructive" disabled={!!tip} title={tip} onClick={() => { reject(inv.id, reason.trim()); toast(`${inv.number} rejected`, `${reason.trim()}. Written to the audit log.`, undefined, 'info'); onClose(); }}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm text-grey">Status: {inv.status}</span>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </>
        )
      }
    >
      <Notice kind="warning">
        <div className="font-medium">Rule that held it</div>
        <div className="mt-0.5">{inv.heldRule ?? inv.reason}</div>
      </Notice>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Card title="Invoice">
          <KV
            rows={[
              ['Number', inv.number],
              ['Amount', moneyFull(inv.amount, inv.currency)],
              ['Invoice date', fmtDate(inv.invoiceDate)],
              ['Due date', `${fmtDate(inv.dueDate)} (${daysBetween(data.today, inv.dueDate)} days)`],
              ['Purchase order', inv.poNumber],
              ['Goods receipt', inv.grNumber],
              ['Source', inv.source],
              ['Held since', fmtTime(inv.heldSince)],
            ]}
          />
        </Card>
        <Card title="Match record">
          <KV
            rows={[
              ['Three-way match', <MatchText key="m" match={inv.match} />],
              ['Line', inv.lineItem ? `${inv.lineItem.qty.toLocaleString('en-US')} × ${inv.lineItem.description}` : 'Summary line'],
              ['Ordered', inv.lineItem ? String(inv.lineItem.poQty ?? inv.lineItem.qty) : 'Agrees'],
              ['Received', inv.lineItem ? `${inv.lineItem.grQty ?? inv.lineItem.qty}${inv.lineItem.grDate ? ` on ${fmtDate(inv.lineItem.grDate)}` : ''}` : 'Agrees'],
              ['Supplier 12-month average', moneyFull(sup?.avgInvoice12m ?? 0, inv.currency)],
              ['Supplier bank account', `${sup?.bankAccount.bank} ···${sup?.bankAccount.last4}${sup?.bankAccount.changedOn ? ` (changed ${fmtDate(sup.bankAccount.changedOn)})` : ''}`],
            ]}
          />
        </Card>
      </div>

      {original ? (
        <Card className="mt-4" title={`Original invoice ${original.number}`}>
          <KV
            rows={[
              ['Status', <Status key="s" status={original.status} />],
              ['Amount', moneyFull(original.amount, original.currency)],
              ['Invoice date', fmtDate(original.invoiceDate)],
              ['Source', original.source],
              ['Received', fmtTime(original.history[0]?.at)],
              ...(original.approvedBy ? [['Approved by', `${original.approvedBy} · ${fmtTime(original.approvedAt)}`] as [string, string]] : []),
            ]}
          />
        </Card>
      ) : null}

      <Card className="mt-4" title={`Recent invoices from ${sup?.name}`} pad={false}>
        <Table
          rows={recent}
          rowKey={(i) => i.id}
          dense
          columns={[
            { key: 'n', header: 'Invoice', render: (i) => i.number },
            { key: 'd', header: 'Invoice date', render: (i) => <span className="num">{fmtDate(i.invoiceDate)}</span> },
            { key: 'a', header: 'Amount', align: 'right', render: (i) => <Money amount={i.amount} currency={i.currency} /> },
            { key: 'm', header: 'Match', render: (i) => <MatchText match={i.match} /> },
            { key: 's', header: 'Status', render: (i) => <Status status={i.status} /> },
          ]}
        />
      </Card>

      {isHeld ? (
        <div className="mt-5">
          <Field label="Reason (required for release and for reject, written to the audit log)">
            <Textarea rows={2} value={reason} disabled={!canAct} onChange={(e) => setReason(e.target.value)} placeholder={dupOf ? `Second copy of ${dupOf}. Original already in the program.` : 'Why the invoice is released or rejected'} />
          </Field>
          {dupOf ? <Button variant="quiet" className="mt-1" onClick={() => setReason(`Duplicate. ${dupOf} is already in the program and was approved. Second copy rejected.`)}>Use a standard duplicate reason</Button> : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
