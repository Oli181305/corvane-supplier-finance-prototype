import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, LinkText, Money, PageHeader, SectionTitle, Status, Table, Tile } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { maturityRows, obligationsByEntity, totalObligationsUSD } from '../../store/selectors';
import { addDays, daysBetween, fmtDate, fmtDateShort, moneyM, pctInt } from '../../logic/format';
import { fromUSD, toUSD } from '../../logic/fx';
import { canApprove } from '../../logic/routing';
import type { Currency } from '../../types';

export default function Overview() {
  const data = useStore((s) => s.data);
  const entityFilter = useStore((s) => s.entityFilter);
  const rc = useStore((s) => s.reportingCurrency);
  const user = useCurrentUser();
  const navigate = useNavigate();

  const entity = entityFilter === 'all' ? undefined : data.entities.find((e) => e.id === entityFilter);
  const ccy: Currency = entity && rc === 'local' ? entity.currency : 'USD';
  const conv = (usd: number) => (ccy === 'USD' ? usd : fromUSD(usd, ccy));

  const used = entity ? totalObligationsUSD(data, entity.id) : data.programUsedUSD;
  const limit = entity ? toUSD(entity.subLimit, entity.currency) : data.config.programLimitUSD;

  const rows = maturityRows(data, entityFilter, addDays(data.today, -1));
  const next30 = rows.filter((r) => r.date <= addDays(data.today, 30));
  const due30 = next30.reduce((s, r) => s + r.totalUSD, 0);

  const awaiting = data.invoices.filter((i) => i.status === 'In approval' && (entityFilter === 'all' || i.entityId === entityFilter));
  const awaitingUSD = awaiting.reduce((s, i) => s + toUSD(i.amount, i.currency), 0);
  const oldest = awaiting.length ? Math.max(...awaiting.map((i) => daysBetween(i.history[0].at.slice(0, 10), data.today))) : 0;

  const chart = rows.map((r) => ({ label: fmtDateShort(r.date), value: +(conv(r.totalUSD) / 1_000_000).toFixed(2), date: r.date }));
  const byEntity = obligationsByEntity(data).filter((r) => entityFilter === 'all' || r.entity.id === entityFilter);
  const maxEntity = Math.max(...byEntity.map((r) => r.usd), 1);

  const queue = awaiting.sort((a, b) => a.history[0].at.localeCompare(b.history[0].at)).slice(0, 5);

  return (
    <div>
      <PageHeader title="Overview" context={<span className="num">{fmtDate(data.today)} · {entity ? entity.name : 'All entities'} · Reporting in {ccy}</span>} />

      <div className="grid grid-cols-4 gap-4">
        <Tile
          label={entity ? 'Entity sub-limit used' : 'Program limit used'}
          value={pctInt(used / limit)}
          sub={<span className="num">{moneyM(conv(used), ccy)} of {moneyM(conv(limit), ccy)}</span>}
          bar={used / limit}
          to="/kaltrex/obligations"
        />
        <Tile label="Due in next 30 days" value={moneyM(conv(due30), ccy)} sub={<span className="num">{next30.length} maturity date{next30.length === 1 ? '' : 's'}</span>} to="/kaltrex/obligations" />
        <Tile label="DPO on program invoices" value={<span>90 days</span>} sub="was 60 before enrollment" to="/kaltrex/reports" />
        <Tile
          label="Awaiting approval"
          value={awaiting.length}
          sub={
            <span className="num">
              {moneyM(conv(awaitingUSD), ccy)} · oldest {oldest} day{oldest === 1 ? '' : 's'} · <span className="text-teal-dark">Open queue ›</span>
            </span>
          }
          to="/kaltrex/approvals"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title={`Obligations by maturity date (${ccy} M)`}>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#E3E6EC" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6479' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#5B6479' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F0F1F4' }} contentStyle={{ border: '1px solid #E3E6EC', borderRadius: 4, fontSize: 13 }} formatter={(v: number) => [`${ccy} ${v.toFixed(1)}M`, 'Due']} labelFormatter={(l) => `Due ${l}`} />
                <Bar dataKey="value" fill="#00C2B8" radius={0} onClick={(d) => d && navigate('/kaltrex/obligations')} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Obligations by currency and entity">
          <table className="w-full text-sm">
            <tbody>
              {byEntity.map((r) => {
                const local = rc === 'local';
                return (
                  <tr key={r.entity.id} className="h-10">
                    <td className="w-12 text-grey">{r.entity.currency}</td>
                    <td className="w-[200px]">{r.entity.name}</td>
                    <td>
                      <div className="h-3 bg-border">
                        <div className="h-3 bg-teal" style={{ width: `${(r.usd / maxEntity) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num w-[120px] text-right">{local ? moneyM(r.local, r.entity.currency) : moneyM(r.usd, 'USD')}</td>
                  </tr>
                );
              })}
              <tr className="h-10 border-t border-border font-semibold">
                <td colSpan={3}>Total</td>
                <td className="num text-right">{moneyM(conv(byEntity.reduce((s, r) => s + r.usd, 0)), ccy)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle right={<LinkText to="/kaltrex/approvals">View all ›</LinkText>}>
          Approval queue · showing {queue.length} of {awaiting.length}
        </SectionTitle>
        <Card pad={false}>
          <Table
            rows={queue}
            rowKey={(i) => i.id}
            onRowClick={(i) => navigate(`/kaltrex/approvals/${i.id}`)}
            empty="No invoices waiting for approval."
            columns={[
              { key: 'n', header: 'Invoice', render: (i) => <span className="font-medium">{i.number}</span> },
              { key: 's', header: 'Supplier', render: (i) => data.suppliers.find((s) => s.id === i.supplierId)?.name },
              { key: 'e', header: 'Entity', render: (i) => data.entities.find((e) => e.id === i.entityId)?.short },
              { key: 'a', header: 'Amount', align: 'right', render: (i) => <Money amount={i.amount} currency={i.currency} /> },
              { key: 'd', header: 'Due', render: (i) => <span className="num">{fmtDate(i.dueDate)}</span> },
              { key: 'st', header: 'Status', render: (i) => <Status status={i.status} reason={i.reason ?? (user && !canApprove(user, i.amount, i.currency) ? 'Above your approval limit' : undefined)} /> },
              { key: 'act', header: 'Action', render: (i) => <span className="font-medium text-teal-dark">{i.reason ? 'View' : user && canApprove(user, i.amount, i.currency) ? 'Approve' : 'Route to approver'}</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
