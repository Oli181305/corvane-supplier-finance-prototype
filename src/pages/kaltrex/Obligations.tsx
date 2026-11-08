import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Money, PageHeader, Status, Tile, csv, download } from '../../components/ui';
import { useStore } from '../../store/store';
import { maturityRows, totalObligationsUSD } from '../../store/selectors';
import { addDays, daysBetween, fmtDate, fmtInt, money, moneyM } from '../../logic/format';
import { toUSD } from '../../logic/fx';

export default function Obligations() {
  const data = useStore((s) => s.data);
  const entityFilter = useStore((s) => s.entityFilter);
  const navigate = useNavigate();
  const [open, setOpen] = useState<Set<string>>(new Set(['2026-11-30']));
  const rows = maturityRows(data, entityFilter, addDays(data.today, -1));
  const total = totalObligationsUSD(data, entityFilter);
  const entity = entityFilter === 'all' ? undefined : data.entities.find((e) => e.id === entityFilter);
  const next = rows.find((r) => r.date >= data.today);

  const exportCsv = () => {
    const lines: (string | number)[][] = [['Due date', 'Entity', 'Invoice', 'Supplier', 'Currency', 'Amount', 'USD equivalent', 'Status']];
    for (const r of rows) {
      for (const i of r.invoices) lines.push([r.date, data.entities.find((e) => e.id === i.entityId)?.name ?? '', i.number, data.suppliers.find((s) => s.id === i.supplierId)?.name ?? '', i.currency, i.amount, Math.round(toUSD(i.amount, i.currency)), i.status]);
      if (r.lumpUSD > 0) lines.push([r.date, r.entityIds.map((id) => data.entities.find((e) => e.id === id)?.name).join(' / '), 'Earlier ERP batches', '', 'USD', Math.round(r.lumpUSD), Math.round(r.lumpUSD), 'Approved']);
    }
    download(`kaltrex-obligations-${data.today}.csv`, csv(lines));
  };

  return (
    <div>
      <PageHeader
        title="Obligations"
        context={<span className="num">{entity ? entity.name : 'All entities'}</span>}
        actions={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>}
      />
      <div className="mb-4 grid grid-cols-3 gap-4">
        <Tile label="Total obligations" value={moneyM(total, 'USD')} sub={<span className="num">{entity ? `Sub-limit ${money(entity.subLimit, entity.currency)}` : `Program limit USD ${fmtInt(data.config.programLimitUSD)}`}</span>} />
        <Tile label="Next due date" value={next ? fmtDate(next.date) : 'None'} sub={next ? <span className="num">{moneyM(next.totalUSD, 'USD')} · in {daysBetween(data.today, next.date)} days</span> : undefined} />
        <Tile label="Maturity dates" value={rows.length} sub="from today" />
      </div>
      <Card pad={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="label h-9 px-3 text-left font-medium">Due date</th>
              <th className="label h-9 px-3 text-left font-medium">Entities</th>
              <th className="label h-9 px-3 text-right font-medium">Invoices</th>
              <th className="label h-9 px-3 text-right font-medium">Total due (USD)</th>
              <th className="label h-9 px-3 text-right font-medium">Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-grey">No obligations. Approved invoices appear here by due date.</td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const isOpen = open.has(r.date);
              const count = r.invoices.length + (r.lumpUSD > 0 ? 1 : 0);
              return (
                <Fragment key={r.date}>
                  <tr className="h-10 cursor-pointer border-b border-border hover:bg-hover" onClick={() => setOpen((s) => { const n = new Set(s); n.has(r.date) ? n.delete(r.date) : n.add(r.date); return n; })}>
                    <td className="num px-3 font-medium">
                      <span className="mr-2 inline-block w-3 text-grey">{isOpen ? '−' : '+'}</span>
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-3">{r.entityIds.map((id) => data.entities.find((e) => e.id === id)?.short).join(', ')}</td>
                    <td className="num px-3 text-right">{count}</td>
                    <td className="num px-3 text-right font-medium">{money(r.totalUSD, 'USD')}</td>
                    <td className="num px-3 text-right">{daysBetween(data.today, r.date) < 0 ? <span className="text-grey">Settling</span> : daysBetween(data.today, r.date)}</td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-border bg-tint">
                      <td colSpan={5} className="px-3 py-2">
                        <table className="w-full text-sm">
                          <tbody>
                            {r.invoices.map((i) => (
                              <tr key={i.id} className="h-9 cursor-pointer hover:bg-hover" onClick={() => navigate(`/kaltrex/invoices/${i.id}`)}>
                                <td className="w-[140px] pl-8 font-medium text-teal-dark">{i.number}</td>
                                <td className="w-[240px]">{data.suppliers.find((s) => s.id === i.supplierId)?.name}</td>
                                <td className="w-[160px]">{data.entities.find((e) => e.id === i.entityId)?.short}</td>
                                <td><Status status={i.status} /></td>
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
    </div>
  );
}
