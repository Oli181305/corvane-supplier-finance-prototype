import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, Input, LinkText, Money, PageHeader, Select, SidePanel, Skeleton, Status, Table } from '../../components/ui';
import { effectiveSupplierId, useCurrentUser, useStore } from '../../store/store';
import { lastUpdate, useReadOnly } from '../../store/selectors';
import { addDays, fmtDate, fmtTime } from '../../logic/format';
import type { InvoiceStatus, MatchResult } from '../../types';
import { toast } from '../../store/toast';

const STATUSES: InvoiceStatus[] = ['Received', 'Validated', 'Held', 'In approval', 'Offered', 'Paid early', 'Disputed', 'Settled', 'Rejected'];

export default function AllInvoices() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const readOnly = useReadOnly();
  const supplierId = effectiveSupplierId(user, viewAs);
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<Set<InvoiceStatus>>(new Set());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [upload, setUpload] = useState(false);

  const rows = useMemo(
    () =>
      data.invoices
        .filter((i) => i.supplierId === supplierId)
        .filter((i) => statuses.size === 0 || statuses.has(i.status))
        .filter((i) => !from || i.dueDate >= from)
        .filter((i) => !to || i.dueDate <= to)
        .filter((i) => !search || i.number.toLowerCase().includes(search.toLowerCase()) || i.poNumber.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => lastUpdate(b).localeCompare(lastUpdate(a))),
    [data.invoices, supplierId, statuses, from, to, search],
  );

  const canUpload = !readOnly && (user?.roleKey === 'supplierFinance' || user?.roleKey === 'arClerk');

  return (
    <div>
      <PageHeader
        title="All invoices"
        context={`${rows.length} invoices`}
        actions={<Button variant="primary" disabled={!canUpload} title={!canUpload ? 'Read only' : undefined} onClick={() => setUpload(true)}>Upload invoice</Button>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="label mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => {
              const on = statuses.has(s);
              return (
                <button key={s} type="button" onClick={() => setStatuses((set) => { const n = new Set(set); n.has(s) ? n.delete(s) : n.add(s); return n; })} className={`h-9 rounded border px-2.5 text-sm ${on ? 'border-teal-dark bg-teal-tint font-medium' : 'border-border bg-white hover:bg-hover'}`}>
                  {s}
                </button>
              );
            })}
            {statuses.size ? <Button variant="quiet" className="ml-2" onClick={() => setStatuses(new Set())}>Clear</Button> : null}
          </div>
        </div>
        <Field label="Due from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" /></Field>
        <Field label="Due to"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" /></Field>
        <Field label="Search"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice or PO number" className="w-[220px]" /></Field>
      </div>
      <Card pad={false}>
        <Table
          rows={rows}
          rowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/supplier/invoices/${i.id}`)}
          empty="No invoices match the filters."
          columns={[
            { key: 'n', header: 'Invoice', render: (i) => <span className="font-medium">{i.number}</span>, sortValue: (i) => i.number },
            { key: 'po', header: 'PO', render: (i) => i.poNumber, sortValue: (i) => i.poNumber },
            { key: 'e', header: 'Kaltrex entity', render: (i) => data.entities.find((e) => e.id === i.entityId)?.short },
            { key: 'd', header: 'Due', render: (i) => <span className="num">{fmtDate(i.dueDate)}</span>, sortValue: (i) => i.dueDate },
            { key: 'a', header: 'Amount', align: 'right', render: (i) => <Money amount={i.amount} currency={i.currency} />, sortValue: (i) => i.amount },
            { key: 'st', header: 'Status', render: (i) => <Status status={i.status} reason={i.reason} />, sortValue: (i) => i.status },
            { key: 'u', header: 'Last update', render: (i) => <span className="num">{fmtTime(lastUpdate(i))}</span>, sortValue: (i) => lastUpdate(i) },
          ]}
        />
      </Card>
      {upload && supplierId ? <UploadPanel supplierId={supplierId} onClose={() => setUpload(false)} /> : null}
    </div>
  );
}

function UploadPanel({ supplierId, onClose }: { supplierId: string; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const submit = useStore((s) => s.submitUploadedInvoice);
  const validate = useStore((s) => s.validateInvoice);
  const finish = useStore((s) => s.finishCapture);
  const supplier = data.suppliers.find((s) => s.id === supplierId)!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'drop' | 'ocr' | 'form' | 'running' | 'done'>('drop');
  const [fileName, setFileName] = useState('');
  const [invId, setInvId] = useState<string | null>(null);
  const nextNumber = useMemo(() => {
    const nums = data.invoices.filter((i) => i.supplierId === supplierId).map((i) => Number(i.number.split('-')[1])).filter((n) => !isNaN(n));
    const prefix = data.invoices.find((i) => i.supplierId === supplierId)?.number.split('-')[0] ?? 'INV';
    return `${prefix}-${(Math.max(0, ...nums) + 1).toString()}`;
  }, [data.invoices, supplierId]);
  const [form, setForm] = useState({ number: '', po: '', gr: '', amount: '36400', invoiceDate: data.today, dueDate: addDays(data.today, 60), entityId: supplier.kaltrexEntityId, match: 'Matched' as MatchResult });

  const startOcr = (name: string) => {
    setFileName(name);
    setStage('ocr');
    setTimeout(() => {
      setForm((f) => ({ ...f, number: nextNumber, po: `PO-${77150 + Math.floor(Math.random() * 40)}`, gr: `GR-${55070 + Math.floor(Math.random() * 40)}` }));
      setStage('form');
    }, 700);
  };

  const inv = invId ? data.invoices.find((i) => i.id === invId) : undefined;

  useEffect(() => {
    if (stage !== 'running' || !invId) return;
    const t1 = setTimeout(() => validate(invId), 600);
    const t2 = setTimeout(() => {
      finish(invId);
      setStage('done');
    }, 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [stage, invId, validate, finish]);

  return (
    <SidePanel
      title="Upload invoice"
      onClose={onClose}
      width={640}
      footer={
        stage === 'form' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!form.number || !form.amount}
              onClick={() => {
                const id = submit({
                  number: form.number.trim(),
                  supplierId,
                  entityId: form.entityId,
                  currency: supplier.currency,
                  amount: Number(form.amount.replace(/[^\d.]/g, '')) || 0,
                  invoiceDate: form.invoiceDate,
                  dueDate: form.dueDate,
                  match: form.match,
                  poNumber: form.po.trim(),
                  grNumber: form.gr.trim(),
                });
                setInvId(id);
                setStage('running');
              }}
            >
              Submit
            </Button>
          </>
        ) : (
          <>
            <span />
            <Button variant="secondary" onClick={onClose}>{stage === 'done' ? 'Close' : 'Cancel'}</Button>
          </>
        )
      }
    >
      {stage === 'drop' ? (
        <div
          className="flex h-48 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-border bg-tint text-grey hover:border-teal-dark"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            startOcr(e.dataTransfer.files?.[0]?.name ?? 'invoice.pdf');
          }}
        >
          <div className="text-base">Drop a PDF here or click to choose a file</div>
          <div className="mt-1 text-xs">Any file works in the prototype</div>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => startOcr(e.target.files?.[0]?.name ?? 'invoice.pdf')} />
          <Button variant="link" className="mt-4" onClick={(e) => { e.stopPropagation(); startOcr('Mercer-invoice.pdf'); }}>Use a sample PDF</Button>
        </div>
      ) : null}

      {stage === 'ocr' ? (
        <div>
          <div className="mb-2 text-sm text-grey">Reading {fileName} with OCR</div>
          <Skeleton rows={5} />
        </div>
      ) : null}

      {stage === 'form' ? (
        <div>
          <div className="mb-4 text-sm text-grey">Read by OCR from {fileName}</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Invoice number"><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
            <Field label="Kaltrex entity">
              <Select value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })}>
                {data.entities.map((en) => (
                  <option key={en.id} value={en.id}>{en.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Purchase order"><Input value={form.po} onChange={(e) => setForm({ ...form, po: e.target.value })} /></Field>
            <Field label="Goods receipt"><Input value={form.gr} onChange={(e) => setForm({ ...form, gr: e.target.value })} /></Field>
            <Field label={`Amount (${supplier.currency})`}><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Three-way match (from ERP)">
              <Select value={form.match} onChange={(e) => setForm({ ...form, match: e.target.value as MatchResult })}>
                {(['Matched', 'Quantity variance', 'Price variance', 'No goods receipt'] as MatchResult[]).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Invoice date"><Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></Field>
            <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
        </div>
      ) : null}

      {(stage === 'running' || stage === 'done') && inv ? (
        <div>
          <div className="mb-4 text-base">
            {inv.number} · <Money amount={inv.amount} currency={inv.currency} /> · Due {fmtDate(inv.dueDate)}
          </div>
          <ol className="space-y-3">
            <li className="flex items-center gap-3"><Status status="Received" /> <span className="text-sm text-grey">PDF upload. Fields read by OCR</span></li>
            <li className="flex items-center gap-3">{inv.status === 'Received' ? <Skeleton rows={1} /> : <Status status={inv.status === 'Rejected' && inv.history.length <= 2 ? 'Rejected' : 'Validated'} />} <span className="text-sm text-grey">Acceptance criteria: enrolled supplier, entity, currency, due date range, minimum amount, duplicate check, three-way match</span></li>
            <li className="flex items-center gap-3">{stage === 'running' ? <Skeleton rows={1} /> : <Status status={inv.status} reason={inv.reason} />} <span className="text-sm text-grey">{inv.status === 'Held' ? 'Held for bank operations review' : inv.status === 'In approval' ? 'Sent to the Kaltrex approval queue' : inv.status === 'Rejected' ? 'Rejected. Reason shown to the supplier and Kaltrex AP' : 'Unusual-invoice rules'}</span></li>
          </ol>
          {stage === 'done' ? (
            <div className="mt-5">
              <LinkText to={`/supplier/invoices/${inv.id}`}>Open invoice {inv.number}</LinkText>
            </div>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}

export function announce(text: string) {
  toast(text);
}
