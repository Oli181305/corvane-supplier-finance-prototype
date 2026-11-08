import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Field, Input, KV, MatchText, Modal, Money, Notice, PageHeader, Radio, Select, SidePanel, Status, Table, Textarea, TwoFactor } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { useReadOnly } from '../../store/selectors';
import { fmtDate, fmtInt, fmtTime, moneyFull } from '../../logic/format';
import { canApprove, eligibleApprovers } from '../../logic/routing';
import { toUSD } from '../../logic/fx';
import { toast } from '../../store/toast';
import type { Invoice } from '../../types';

export default function ApprovalQueue() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const entityFilter = useStore((s) => s.entityFilter);
  const setEntityFilter = useStore((s) => s.setEntityFilter);
  const approve = useStore((s) => s.approveInvoice);
  const user = useCurrentUser();
  const readOnly = useReadOnly();
  const navigate = useNavigate();

  const [supplierF, setSupplierF] = useState('all');
  const [matchF, setMatchF] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk2fa, setBulk2fa] = useState(false);

  const rows = useMemo(
    () =>
      data.invoices
        .filter((i) => i.status === 'In approval')
        .filter((i) => entityFilter === 'all' || i.entityId === entityFilter)
        .filter((i) => supplierF === 'all' || i.supplierId === supplierF)
        .filter((i) => matchF === 'all' || (matchF === 'matched' ? i.match === 'Matched' : i.match !== 'Matched'))
        .filter((i) => !search || i.number.toLowerCase().includes(search.toLowerCase()) || i.poNumber.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => b.history[0].at.localeCompare(a.history[0].at)),
    [data.invoices, entityFilter, supplierF, matchF, search],
  );

  const actionFor = (i: Invoice): { label: string; reason?: string } => {
    if (readOnly) return { label: 'View' };
    if (i.match !== 'Matched') return { label: 'View', reason: i.reason };
    if (!canApprove(user, i.amount, i.currency)) {
      const routed = i.routedTo ? data.users.find((u) => u.id === i.routedTo) : undefined;
      return { label: routed ? 'View' : 'Route to approver', reason: routed ? `Routed to ${routed.name}` : 'Above your approval limit' };
    }
    if (i.routedTo && i.routedTo !== user?.id) {
      const routed = data.users.find((u) => u.id === i.routedTo);
      return { label: 'Approve', reason: `Routed to ${routed?.name ?? ''}` };
    }
    return { label: 'Approve' };
  };

  const selectable = (i: Invoice) => !readOnly && i.match === 'Matched' && canApprove(user, i.amount, i.currency);
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedUSD = selectedRows.reduce((s, i) => s + toUSD(i.amount, i.currency), 0);

  const open = id ? data.invoices.find((i) => i.id === id) : undefined;

  return (
    <div>
      <PageHeader
        title="Approval queue"
        context={<span className="num">{user?.approvalLimit ? `Your approval limit: USD ${fmtInt(user.approvalLimit)}` : 'View only'}</span>}
      />

      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          <Field label="Entity">
            <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-[200px]">
              <option value="all">All entities</option>
              {data.entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier">
            <Select value={supplierF} onChange={(e) => setSupplierF(e.target.value)} className="w-[220px]">
              <option value="all">All suppliers</option>
              {data.suppliers.filter((s) => s.onboardingStatus === 'Enrolled').map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Match">
            <Select value={matchF} onChange={(e) => setMatchF(e.target.value)} className="w-[160px]">
              <option value="all">All</option>
              <option value="matched">Matched</option>
              <option value="variance">Variance</option>
            </Select>
          </Field>
        </div>
        <Field label="Search">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice or PO number" className="w-[240px]" />
        </Field>
      </div>

      <Card pad={false}>
        <Table
          rows={rows}
          rowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/kaltrex/approvals/${i.id}`)}
          selectable={!readOnly}
          selected={selected}
          isSelectable={selectable}
          onToggle={(k) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
          onToggleAll={(keys) => setSelected(new Set(keys))}
          empty="No invoices waiting for approval. Invoices that pass the acceptance criteria appear here."
          columns={[
            { key: 'n', header: 'Invoice', render: (i) => <span className="font-medium">{i.number}</span>, sortValue: (i) => i.number },
            { key: 's', header: 'Supplier', render: (i) => data.suppliers.find((s) => s.id === i.supplierId)?.name, sortValue: (i) => data.suppliers.find((s) => s.id === i.supplierId)?.name ?? '' },
            { key: 'e', header: 'Entity', render: (i) => data.entities.find((e) => e.id === i.entityId)?.short, sortValue: (i) => i.entityId },
            { key: 'a', header: 'Amount', align: 'right', render: (i) => <Money amount={i.amount} currency={i.currency} />, sortValue: (i) => toUSD(i.amount, i.currency) },
            { key: 'd', header: 'Due', render: (i) => <span className="num">{fmtDate(i.dueDate)}</span>, sortValue: (i) => i.dueDate },
            { key: 'm', header: 'Match', render: (i) => <MatchText match={i.match} /> },
            { key: 'st', header: 'Status', render: (i) => <Status status={i.status} reason={actionFor(i).reason} /> },
            {
              key: 'act',
              header: 'Action',
              render: (i) => (
                <span className="font-medium text-teal-dark">{actionFor(i).label}</span>
              ),
            },
          ]}
        />
        {selected.size > 0 ? (
          <div className="flex items-center justify-between border-t border-border bg-tint px-4 py-3">
            <span className="num text-sm">
              Approve {selected.size} selected: USD {fmtInt(selectedUSD)} equivalent. One 2FA code covers the set.
            </span>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
              <Button variant="primary" onClick={() => setBulk2fa(true)}>Approve selected</Button>
            </div>
          </div>
        ) : null}
      </Card>

      {bulk2fa ? (
        <TwoFactor
          purpose={`Approve ${selected.size} invoices for USD ${fmtInt(selectedUSD)} equivalent.`}
          onCancel={() => setBulk2fa(false)}
          onConfirm={() => {
            const list = [...selectedRows];
            for (const i of list) approve(i.id, i.amount);
            setBulk2fa(false);
            setSelected(new Set());
            toast(`Approved ${list.length} invoices`, `${list.map((i) => i.number).join(', ')}. USD ${fmtInt(selectedUSD)} equivalent. Offered to the suppliers for early payment.`);
          }}
        />
      ) : null}

      {open ? <ApprovalPanel inv={open} onClose={() => navigate('/kaltrex/approvals')} /> : null}
    </div>
  );
}

function ApprovalPanel({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const readOnly = useReadOnly();
  const approve = useStore((s) => s.approveInvoice);
  const reject = useStore((s) => s.rejectInvoice);
  const route = useStore((s) => s.routeInvoice);
  const navigate = useNavigate();
  const sup = data.suppliers.find((s) => s.id === inv.supplierId);
  const ent = data.entities.find((e) => e.id === inv.entityId);
  const [amount, setAmount] = useState((inv.amount - (inv.creditNote ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const [stage, setStage] = useState<'form' | '2fa' | 'reject' | 'route' | 'done'>('form');
  const [rejectReason, setRejectReason] = useState('');
  const [routeTo, setRouteTo] = useState<string>('');

  const li = inv.lineItem;
  const amt = Number(amount.replace(/[^\d.]/g, '')) || 0;
  const variance = inv.match !== 'Matched';
  const inStatus = inv.status === 'In approval';
  const withinLimit = canApprove(user, amt || inv.amount, inv.currency);
  const eligible = eligibleApprovers(data.users, inv.amount, inv.currency, user?.id);
  const routed = inv.routedTo ? data.users.find((u) => u.id === inv.routedTo) : undefined;
  const canAct = !readOnly && inStatus;

  if (!routeTo && eligible[0]) setRouteTo(eligible[0].id);

  const doApprove = () => {
    approve(inv.id, amt);
    const after = useStore.getState().data.invoices.find((i) => i.id === inv.id);
    const autoPaid = after?.status === 'Paid early';
    toast('Approved.', `${inv.number}, ${moneyFull(amt, inv.currency)}, due ${fmtDate(inv.dueDate)}. Offered to ${sup?.name} for early payment.${autoPaid ? ' Paid immediately by standing instruction.' : ''}`, { to: `/kaltrex/invoices/${inv.id}`, label: 'Open invoice' });
    setStage('done');
  };

  return (
    <SidePanel
      title={inStatus ? `Approve invoice ${inv.number}` : `Invoice ${inv.number}`}
      subtitle={<span className="num">{sup?.name} → {ent?.name} · {inv.source}</span>}
      onClose={onClose}
      width={880}
      footer={
        inStatus && !readOnly ? (
          <>
            <Button variant="destructive" onClick={() => setStage('reject')}>Reject</Button>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              {withinLimit ? (
                <Button variant="primary" disabled={variance || amt <= 0 || amt > inv.amount} title={variance ? 'Approval is blocked until the credit note is received' : amt > inv.amount ? 'Amount cannot exceed the invoice' : undefined} onClick={() => setStage('2fa')}>
                  Approve invoice
                </Button>
              ) : (
                <Button variant="primary" disabled={variance} title={variance ? 'Approval is blocked until the credit note is received' : undefined} onClick={() => setStage('route')}>
                  Route to approver
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-grey">{readOnly ? 'Read only while viewing as Kaltrex.' : `Status: ${inv.status}`}</span>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <Card title="Invoice">
          <div className="space-y-1 text-base">
            <div>{sup?.name}</div>
            <div className="num">{li ? `${li.qty.toLocaleString('en-US')} × ${li.description.toLowerCase()}` : 'Machined components'}</div>
            <div className="num">{li ? `${moneyFull(li.unitPrice, inv.currency)} each` : ''}</div>
            <div className="num pt-2 text-md font-semibold">{moneyFull(inv.amount, inv.currency)}</div>
            <div className="num text-sm text-grey">Invoice {fmtDate(inv.invoiceDate)} · Due {fmtDate(inv.dueDate)}</div>
          </div>
        </Card>
        <Card title={`Purchase order ${inv.poNumber}`}>
          <div className="space-y-1 text-base">
            <div className="num">{li ? `${(li.poQty ?? li.qty).toLocaleString('en-US')} × ${li.description.toLowerCase()}` : 'Agrees with the invoice'}</div>
            <div className="num">{li ? `${moneyFull(li.unitPrice, inv.currency)} each` : ''}</div>
            <div className="num pt-2 text-md font-semibold">{li ? moneyFull((li.poQty ?? li.qty) * li.unitPrice, inv.currency) : moneyFull(inv.amount, inv.currency)}</div>
            <div className="text-sm text-grey">Source: Kaltrex ERP</div>
          </div>
        </Card>
        <Card title={`Goods receipt ${inv.grNumber}`}>
          <div className="space-y-1 text-base">
            <div className="num">{li ? `${(li.grQty ?? li.qty).toLocaleString('en-US')} received${li.grDate ? ` ${fmtDate(li.grDate)}` : ''}` : 'Received in full'}</div>
            <div>{li?.grNote ?? 'Inspected. No rejects'}</div>
            <div className="pt-2 text-sm text-grey">Source: Kaltrex ERP</div>
          </div>
        </Card>
      </div>

      <div className="mt-5 space-y-2 text-base">
        <div className="flex items-center gap-2">
          <span className="text-grey">Three-way match:</span> <MatchText match={inv.match} />
        </div>
        <div>
          <span className="text-grey">Credit notes against this invoice:</span> <span className="num">{inv.creditNote ? moneyFull(inv.creditNote, inv.currency) : 'None'}</span>
        </div>
      </div>

      {variance ? <Notice kind="warning" className="mt-4">{inv.reason} Approval is blocked until the variance is resolved.</Notice> : null}
      {!variance && inStatus && !withinLimit ? (
        <Notice kind="warning" className="mt-4">
          Above your approval limit (USD {fmtInt(user?.approvalLimit ?? 0)}). Route this invoice to an approver with enough authority.
          {routed ? ` Already routed to ${routed.name}.` : ''}
        </Notice>
      ) : null}
      {routed && withinLimit ? <Notice kind="info" className="mt-4">Routed to {routed.name} on {fmtTime(inv.history.find((h) => h.action.startsWith('Routed'))?.at)}. You have enough authority to approve it.</Notice> : null}

      {inStatus ? (
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Amount to approve" hint="Defaults to the invoice amount less any credit note.">
            <div className="flex items-center gap-2">
              <span className="text-grey">{inv.currency}</span>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!canAct} />
            </div>
          </Field>
          <Field label="Due date">
            <div className="num flex h-9 items-center">{fmtDate(inv.dueDate)}</div>
          </Field>
        </div>
      ) : (
        <div className="mt-5">
          <KV rows={[['Status', inv.status], ['Approved by', inv.approvedBy ?? ''], ['Approved', fmtTime(inv.approvedAt)]]} />
        </div>
      )}

      {inStatus ? <p className="mt-5 text-base">Approving commits {ent?.name} to pay Corvane Bank this amount on the due date.</p> : null}

      {stage === '2fa' ? <TwoFactor purpose={`Approve ${inv.number} for ${moneyFull(amt, inv.currency)}, due ${fmtDate(inv.dueDate)}.`} onCancel={() => setStage('form')} onConfirm={doApprove} /> : null}

      {stage === 'reject' ? (
        <Modal
          title={`Reject ${inv.number}`}
          onClose={() => setStage('form')}
          width={520}
          footer={
            <>
              <Button variant="secondary" onClick={() => setStage('form')}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={rejectReason.trim().length < 3}
                onClick={() => {
                  reject(inv.id, rejectReason.trim());
                  toast(`Rejected ${inv.number}`, rejectReason.trim(), undefined, 'info');
                  onClose();
                }}
              >
                Reject invoice
              </Button>
            </>
          }
        >
          <Field label="Reason (shown to the supplier)">
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why the invoice is rejected" />
          </Field>
        </Modal>
      ) : null}

      {stage === 'route' ? (
        <Modal
          title={`Route ${inv.number} to an approver`}
          onClose={() => setStage('form')}
          width={520}
          footer={
            <>
              <Button variant="secondary" onClick={() => setStage('form')}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!routeTo}
                onClick={() => {
                  const to = data.users.find((u) => u.id === routeTo);
                  route(inv.id, routeTo);
                  toast(`${inv.number} routed to ${to?.name}`, `${moneyFull(inv.amount, inv.currency)} is above your approval limit. ${to?.name} (${to?.role}) sees it in the approval queue.`, undefined, 'info');
                  onClose();
                }}
              >
                Send to approver
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm text-grey">Kaltrex users with enough authority for {moneyFull(inv.amount, inv.currency)}:</p>
          {eligible.map((u) => (
            <Radio key={u.id} checked={routeTo === u.id} onChange={() => setRouteTo(u.id)} label={<span>{u.name} <span className="text-grey">· {u.role}</span></span>}>
              <span className="num text-sm text-grey">Limit USD {fmtInt(u.approvalLimit ?? 0)}</span>
            </Radio>
          ))}
        </Modal>
      ) : null}

      {stage === 'done' ? (
        <div className="mt-6">
          <Notice kind="success">
            Approved. {inv.number}, {moneyFull(amt, inv.currency)}, due {fmtDate(inv.dueDate)}. Offered to {sup?.name} for early payment. Approval cannot be undone. Raise a dispute if something is wrong.
          </Notice>
          <div className="mt-3 flex gap-4">
            <Button variant="link" onClick={() => navigate(`/kaltrex/invoices/${inv.id}`)}>Open invoice</Button>
            <Button variant="link" onClick={onClose}>Back to queue</Button>
          </div>
        </div>
      ) : null}
    </SidePanel>
  );
}
