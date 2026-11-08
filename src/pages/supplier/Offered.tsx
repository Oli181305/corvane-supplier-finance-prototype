import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, KV, LinkText, Money, Notice, PageHeader, Select, SidePanel, Skeleton, Status, Table, Tile } from '../../components/ui';
import { effectiveSupplierId, liveQuote, useCurrentUser, useStore, type PayResult } from '../../store/store';
import { useReadOnly } from '../../store/selectors';
import { daysBetween, fmtDate, fmtInt, money, moneyFull, pct } from '../../logic/format';
import { arrivalFor, railDescription, railFor } from '../../logic/rails';
import { crossRate } from '../../logic/fx';
import { rateFor } from '../../logic/pricing';
import type { Currency, Invoice } from '../../types';
import { toast } from '../../store/toast';

export default function Offered() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const readOnly = useReadOnly();
  const supplierId = effectiveSupplierId(user, viewAs);
  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const navigate = useNavigate();

  const offered = useMemo(() => data.invoices.filter((i) => i.supplierId === supplierId && i.status === 'Offered').sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [data.invoices, supplierId]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(offered.map((i) => i.id)));
  const [confirming, setConfirming] = useState<string[] | null>(null);

  useEffect(() => {
    // Keep the selection in step with the offered list (new offers are selected by default).
    setSelected((s) => new Set(offered.map((i) => i.id).filter((id) => s.has(id) || !s.size || true)));
  }, [offered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supplier) return null;
  const ccy = supplier.currency;
  const r = rateFor(ccy, data.config.spread);
  const quotes = new Map(offered.map((i) => [i.id, liveQuote(i, data.today, data.config.spread)]));
  const selectedRows = offered.filter((i) => selected.has(i.id));
  const selectedNet = selectedRows.reduce((s, i) => s + (quotes.get(i.id)?.netAmount ?? 0), 0);
  const availableNet = offered.reduce((s, i) => s + (quotes.get(i.id)?.netAmount ?? 0), 0);
  const canAccept = !readOnly && user?.roleKey === 'supplierFinance';
  const why = readOnly ? 'Read only while viewing as a supplier' : 'Only the supplier finance manager can accept early payment';
  const si = supplier.standingInstruction;

  return (
    <div>
      <PageHeader title="Offered invoices" actions={<span className="num text-sm text-grey">Quotes valid today until 16:00 ET</span>} />

      <div className="grid grid-cols-3 gap-4">
        <Tile label="Available today" value={money(availableNet, ccy)} sub={<span className="num">{offered.length} invoice{offered.length === 1 ? '' : 's'}, net</span>} />
        <Tile label="Your rate today" value={`${pct(r.rate)} a year`} sub={<span className="num">{r.marketRateName} {pct(r.marketRate)} + {pct(data.config.spread)} spread</span>} />
        <Tile label="Standing instruction" value={si.on ? 'On' : 'Off'} sub={<span className="text-teal-dark">{si.on ? 'Change ›' : 'Turn on ›'}</span>} to="/supplier/standing" />
      </div>

      <Card className="mt-4" pad={false}>
        <Table
          rows={offered}
          rowKey={(i) => i.id}
          selectable={canAccept}
          selected={selected}
          onToggle={(k) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
          onToggleAll={(keys) => setSelected(new Set(keys))}
          onRowClick={(i) => navigate(`/supplier/invoices/${i.id}`)}
          empty="No offered invoices. Invoices approved by Kaltrex appear here with a quote."
          columns={[
            { key: 'n', header: 'Invoice', render: (i) => <span className="font-medium">{i.number}</span>, sortValue: (i) => i.number },
            { key: 'e', header: 'Kaltrex entity', render: (i) => data.entities.find((e) => e.id === i.entityId)?.name, sortValue: (i) => i.entityId },
            { key: 'd', header: 'Due', render: (i) => <span className="num">{fmtDate(i.dueDate)}</span>, sortValue: (i) => i.dueDate },
            { key: 'days', header: 'Days', align: 'right', render: (i) => daysBetween(data.today, i.dueDate), sortValue: (i) => i.dueDate },
            { key: 'a', header: 'Amount', align: 'right', render: (i) => <Money amount={i.amount} currency={i.currency} />, sortValue: (i) => i.amount },
            { key: 'disc', header: 'Discount', align: 'right', render: (i) => <Money amount={quotes.get(i.id)!.discount} currency={i.currency} /> },
            { key: 'net', header: 'You receive', align: 'right', render: (i) => <span className="font-medium"><Money amount={quotes.get(i.id)!.netAmount} currency={i.currency} /></span> },
            { key: 'st', header: 'Status', render: (i) => <Status status={i.status} /> },
            {
              key: 'act',
              header: 'Action',
              render: (i) => (
                <Button variant="link" disabled={!canAccept} title={!canAccept ? why : undefined} onClick={(e) => { e.stopPropagation(); setConfirming([i.id]); }}>
                  Request payment
                </Button>
              ),
            },
          ]}
        />
        {offered.length > 0 ? (
          <div className="sticky bottom-0 flex items-center justify-end gap-6 border-t border-border bg-panel px-4 py-3">
            <span className="num text-base">
              Request early payment on {selectedRows.length} selected: <span className="font-semibold">{money(selectedNet, ccy)}</span>
            </span>
            <Button variant="primary" disabled={!canAccept || selectedRows.length === 0} title={!canAccept ? why : undefined} onClick={() => setConfirming(selectedRows.map((i) => i.id))}>
              Request payment
            </Button>
          </div>
        ) : null}
      </Card>

      {confirming ? <ConfirmPanel ids={confirming} onClose={() => setConfirming(null)} /> : null}
    </div>
  );
}

function ConfirmPanel({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const request = useStore((s) => s.requestEarlyPayment);
  const nudge = useStore((s) => s.nudgeFx);
  const navigate = useNavigate();
  const [supplierId] = useState(() => data.invoices.find((i) => ids.includes(i.id))?.supplierId);
  const invs = data.invoices.filter((i) => ids.includes(i.id) && i.status === 'Offered');
  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const [payout, setPayout] = useState<Currency>(supplier?.payoutCurrency ?? invs[0]?.currency ?? 'USD');
  const [fxLoading, setFxLoading] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [fxTime, setFxTime] = useState('09:41:12');

  const ccy = invs[0]?.currency ?? 'USD';
  const quotes = invs.map((i) => liveQuote(i, data.today, data.config.spread));
  const face = invs.reduce((s, i) => s + i.amount, 0);
  const disc = quotes.reduce((s, q) => s + q.discount, 0);
  const net = quotes.reduce((s, q) => s + q.netAmount, 0);
  const rail = railFor(ccy, face);
  const arrives = arrivalFor(rail, data.today);
  const fx = ccy === payout ? 1 : crossRate(ccy, payout) * (1 + data.fxNudge);

  useEffect(() => {
    if (payout === ccy) return;
    setFxLoading(true);
    const t = setTimeout(() => setFxLoading(false), 500);
    return () => clearTimeout(t);
  }, [payout, ccy, data.fxNudge]);

  const refresh = () => {
    nudge();
    const d = new Date();
    setFxTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`);
  };

  if (result) {
    return (
      <SidePanel title="Payment sent" onClose={onClose} width={640} footer={<><span /><Button variant="primary" onClick={onClose}>Done</Button></>}>
        <Notice kind="success">
          Payment sent. {moneyFull(result.payoutAmount, result.payoutCurrency)} by {result.rail}. Arrives {fmtDate(result.arrivesOn)}. Reference {result.reference}.
        </Notice>
        <div className="mt-5">
          <KV
            rows={[
              ['Invoices', result.invoiceIds.map((id) => data.invoices.find((i) => i.id === id)?.number).join(', ')],
              ['Face value', moneyFull(result.totalFace, result.currency)],
              ['Discount', moneyFull(result.totalDiscount, result.currency)],
              ['Net amount', moneyFull(result.totalNet, result.currency)],
              ...(result.payoutCurrency !== result.currency ? [['Paid out', moneyFull(result.payoutAmount, result.payoutCurrency)] as [string, string]] : []),
              ['Account', `${supplier?.bankAccount.bank} ···${supplier?.bankAccount.last4}`],
              ['Status', 'Paid early'],
            ]}
          />
        </div>
        {result.skipped.length ? (
          <Notice kind="warning" className="mt-4">
            Not paid: {result.skipped.map((s) => `${data.invoices.find((i) => i.id === s.id)?.number} (${s.reason})`).join('. ')}
          </Notice>
        ) : null}
        <div className="mt-5 flex gap-5">
          <LinkText to={`/print/advice/${result.reference}`}>Download advice</LinkText>
          <LinkText to="/supplier/payments">Open payments</LinkText>
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel
      title={`Request early payment on ${invs.length} invoice${invs.length === 1 ? '' : 's'}`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={invs.length === 0 || fxLoading}
            onClick={() => {
              const r = request(invs.map((i) => i.id), payout);
              setResult(r);
              if (r.invoiceIds.length) toast('Payment sent', `${moneyFull(r.payoutAmount, r.payoutCurrency)} by ${r.rail}. Arrives ${fmtDate(r.arrivesOn)}. Reference ${r.reference}.`, { to: `/print/advice/${r.reference}`, label: 'Download advice' });
              else toast('No payment made', r.skipped.map((s) => s.reason).join('. '), undefined, 'error');
            }}
          >
            Confirm request
          </Button>
        </>
      }
    >
      <Table
        rows={invs}
        rowKey={(i) => i.id}
        dense
        columns={[
          { key: 'n', header: 'Invoice', render: (i: Invoice) => i.number },
          { key: 'd', header: 'Due', render: (i: Invoice) => <span className="num">{fmtDate(i.dueDate)}</span> },
          { key: 'days', header: 'Days', align: 'right', render: (i: Invoice) => daysBetween(data.today, i.dueDate) },
          { key: 'a', header: 'Face value', align: 'right', render: (i: Invoice) => <Money amount={i.amount} currency={i.currency} /> },
          { key: 'disc', header: 'Discount', align: 'right', render: (i: Invoice) => <Money amount={liveQuote(i, data.today, data.config.spread).discount} currency={i.currency} /> },
          { key: 'net', header: 'You receive', align: 'right', render: (i: Invoice) => <Money amount={liveQuote(i, data.today, data.config.spread).netAmount} currency={i.currency} /> },
        ]}
        footer={
          <tr className="border-t border-border font-semibold">
            <td className="h-10 px-3" colSpan={3}>Total</td>
            <td className="num h-10 px-3 text-right">{money(face, ccy)}</td>
            <td className="num h-10 px-3 text-right">{money(disc, ccy)}</td>
            <td className="num h-10 px-3 text-right">{money(net, ccy)}</td>
          </tr>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <div className="label mb-1.5">Payout bank account</div>
          <div className="num">{supplier?.bankAccount.bank} ···{supplier?.bankAccount.last4}</div>
          {!supplier?.bankAccount.verified ? <div className="mt-1 text-xs text-amber">Held for verification. Payment to this account is held for review.</div> : null}
        </div>
        <div>
          <div className="label mb-1.5">Rail and timing</div>
          <div className="num">{railDescription(rail)} Arrives {fmtDate(arrives)}.</div>
        </div>
      </div>

      <div className="mt-6">
        <Field label="Payout currency" hint="The quote is in the invoice currency. A different payout currency uses the live market FX rate, fixed at acceptance.">
          <Select value={payout} onChange={(e) => setPayout(e.target.value as Currency)} className="w-[160px]">
            {data.config.currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {payout !== ccy ? (
          <Card className="mt-3" title="Live market FX rate (via FX rate API)" right={<Button variant="quiet" onClick={refresh}>Refresh</Button>}>
            {fxLoading ? (
              <Skeleton rows={2} />
            ) : (
              <KV
                rows={[
                  ['Rate', `1 ${ccy} = ${fx.toFixed(4)} ${payout}`],
                  ['Rate refreshed', `${fxTime} ET`],
                  ['You receive', moneyFull(Math.round(net * fx), payout)],
                ]}
              />
            )}
          </Card>
        ) : null}
      </div>
    </SidePanel>
  );
}
