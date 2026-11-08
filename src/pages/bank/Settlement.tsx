import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, KV, Money, Notice, PageHeader, Status, Table, Textarea } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { maturityRows } from '../../store/selectors';
import { daysBetween, fmtDate, fmtInt, fmtTime, money, pct } from '../../logic/format';
import { toUSD } from '../../logic/fx';
import { toast } from '../../store/toast';

export default function Settlement() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const advance = useStore((s) => s.advanceToDueDate);
  const failNext = useStore((s) => s.simulateFailedDebit);
  const closeCase = useStore((s) => s.closePaymentCase);
  const navigate = useNavigate();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const rows = maturityRows(data, 'all', data.today);
  const canOps = user?.roleKey === 'operations' || user?.roleKey === 'admin';

  return (
    <div>
      <PageHeader
        title="Settlement"
        context={<span className="num">Demo date {fmtDate(data.today)}{data.failNextDebit ? ' · Next debit will fail (demo)' : ''}</span>}
        actions={
          <>
            <Button variant="secondary" onClick={() => { failNext(); toast('Next debit will fail', 'Advance to the due date to run the settlement.', undefined, 'info'); }}>Simulate failed debit</Button>
            <Button
              variant="primary"
              onClick={() => {
                const r = advance();
                if (!r) toast('No due date to advance to', 'There are no early-paid invoices with a future due date.', undefined, 'info');
                else toast(r.result === 'Success' ? `Settled ${fmtDate(r.date)}` : `Debit failed ${fmtDate(r.date)}`, `USD ${fmtInt(r.total)} ${r.result === 'Success' ? 'debited, reconciled and advised.' : 'not received. Case opened for operations.'}`, undefined, r.result === 'Success' ? 'success' : 'error');
              }}
            >
              Advance to due date
            </Button>
          </>
        }
      />

      {data.paymentCases.filter((c) => c.status === 'Open').map((c) => {
        const daysSince = daysBetween(c.date, data.today);
        const left = Math.max(0, c.graceDays - daysSince);
        return (
          <Card key={c.id} className="mb-4 border-red" title={<h2 className="text-md font-semibold text-red">Payment not received · Case {c.id}</h2>} right={<Status status={c.status} />}>
            <div className="grid grid-cols-[1fr_1fr] gap-6">
              <KV
                rows={[
                  ['Due date', fmtDate(c.date)],
                  ['Amount not received', money(c.amount, 'USD')],
                  ['Grace period', `${c.graceDays} days · ${left} day${left === 1 ? '' : 's'} left`],
                  ['Late interest after grace', `${pct(c.lateInterest)} a year over the program rate`],
                  ['Owner', 'Operations (James Okafor)'],
                ]}
              />
              <div>
                <div className="label mb-2">Escalation path</div>
                <table className="w-full text-sm">
                  <tbody>
                    {c.steps.map((s, i) => (
                      <tr key={i} className="h-8 border-b border-border last:border-0">
                        <td className="num w-14 text-grey">Day {s.day}</td>
                        <td>{s.step}</td>
                        <td className="w-[150px] text-grey">{s.owner}</td>
                        <td className="w-[90px]"><Status status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {c.notes.length ? (
              <ul className="mt-4 space-y-1 text-sm text-grey">
                {c.notes.map((n, i) => (
                  <li key={i}><span className="num">{fmtTime(n.at)}</span> · {n.by} · {n.text}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex items-end justify-between gap-4">
              <Field label="Close note" className="flex-1">
                <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Debit received on retry" />
              </Field>
              <Button variant="primary" disabled={!canOps || note.trim().length < 3} title={!canOps ? 'Only operations can close the case' : undefined} onClick={() => { closeCase(c.id, note.trim()); setNote(''); toast(`Case ${c.id} closed`, 'Invoices settled. Alert closed.'); }}>
                Close case (debit received)
              </Button>
            </div>
          </Card>
        );
      })}

      <Card title="Upcoming due-date debits" pad={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="label h-9 px-3 text-left font-medium">Due date</th>
              <th className="label h-9 px-3 text-left font-medium">Entities</th>
              <th className="label h-9 px-3 text-right font-medium">Invoices</th>
              <th className="label h-9 px-3 text-right font-medium">Paid early</th>
              <th className="label h-9 px-3 text-right font-medium">Debit Kaltrex (USD)</th>
              <th className="label h-9 px-3 text-right font-medium">Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-grey">No upcoming debits.</td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const isOpen = open.has(r.date);
              const paidEarly = r.invoices.filter((i) => i.status === 'Paid early').length;
              return (
                <Fragment key={r.date}>
                  <tr className="h-10 cursor-pointer border-b border-border hover:bg-hover" onClick={() => setOpen((s) => { const n = new Set(s); n.has(r.date) ? n.delete(r.date) : n.add(r.date); return n; })}>
                    <td className="num px-3 font-medium"><span className="mr-2 inline-block w-3 text-grey">{isOpen ? '−' : '+'}</span>{fmtDate(r.date)}</td>
                    <td className="px-3">{r.entityIds.map((id) => data.entities.find((e) => e.id === id)?.short).join(', ')}</td>
                    <td className="num px-3 text-right">{r.invoices.length + (r.lumpUSD > 0 ? 1 : 0)}</td>
                    <td className="num px-3 text-right">{paidEarly}</td>
                    <td className="num px-3 text-right font-medium">{money(r.totalUSD, 'USD')}</td>
                    <td className="num px-3 text-right">{daysBetween(data.today, r.date) <= 0 ? <span className="text-grey">{daysBetween(data.today, r.date) === 0 ? 'Today' : 'Settling'}</span> : daysBetween(data.today, r.date)}</td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-border bg-tint">
                      <td colSpan={6} className="px-3 py-2">
                        <table className="w-full text-sm">
                          <tbody>
                            {r.invoices.map((i) => (
                              <tr key={i.id} className="h-9 cursor-pointer hover:bg-hover" onClick={() => navigate(`/bank/invoices/${i.id}`)}>
                                <td className="w-[140px] pl-8 font-medium text-teal-dark">{i.number}</td>
                                <td className="w-[240px]">{data.suppliers.find((s) => s.id === i.supplierId)?.name}</td>
                                <td><Status status={i.status} /></td>
                                <td className="num w-[200px] text-grey">{i.payment?.reference ?? ''}</td>
                                <td className="num w-[160px] text-right"><Money amount={i.amount} currency={i.currency} /></td>
                                <td className="num w-[140px] text-right text-grey">{i.currency !== 'USD' ? money(toUSD(i.amount, i.currency), 'USD') : ''}</td>
                              </tr>
                            ))}
                            {r.lumpUSD > 0 ? (
                              <tr className="h-9 text-grey">
                                <td className="pl-8" colSpan={4}>Approved invoices from earlier ERP batches (not itemized in the prototype)</td>
                                <td className="num text-right">{money(r.lumpUSD, 'USD')}</td>
                                <td />
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-md font-semibold">Settlement runs</h2>
        {data.settlements.length === 0 ? <Notice kind="info">No settlement run yet. Use "Advance to due date" to move the demo clock to the next due date and run the debit.</Notice> : null}
        <div className="space-y-4">
          {data.settlements.map((run) => (
            <Card key={run.id} title={<span className="flex items-center gap-4"><span className="text-md font-semibold">{run.id} · Due {fmtDate(run.date)}</span><Status status={run.result === 'Success' ? 'Success' : 'Failed'} /></span>} right={<span className="num text-sm text-grey">Ran {fmtTime(run.ranAt)}</span>}>
              <KV
                rows={[
                  ['Debit Kaltrex', money(run.total, 'USD')],
                  ['Invoices', `${run.invoiceIds.length}`],
                  ['Result', run.result === 'Success' ? 'Debited. Reconciled by invoice reference. Interest and fees posted. Exposure reduced.' : `Debit failed. Case ${run.caseId} opened for operations.`],
                ]}
              />
              {run.result === 'Success' ? (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Card title="Reconciliation" pad={false}>
                    <Table
                      rows={run.reconciled}
                      rowKey={(r) => r.invoiceId}
                      dense
                      columns={[
                        { key: 'i', header: 'Invoice', render: (r) => data.invoices.find((x) => x.id === r.invoiceId)?.number },
                        { key: 'ref', header: 'Matched to', render: (r) => <span className="num">{r.reference}</span> },
                        { key: 'ok', header: 'Result', render: (r) => <Status status={r.matched ? 'Passed' : 'Failed'} /> },
                      ]}
                    />
                  </Card>
                  <Card title="Advices sent" pad={false}>
                    <ul className="text-sm">
                      {run.advices.map((a) => (
                        <li key={a} className="border-b border-border px-4 py-2 last:border-0">{a}</li>
                      ))}
                    </ul>
                  </Card>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
