import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, LinkText, PageHeader, Tile } from '../../components/ui';
import { useStore } from '../../store/store';
import { maturityRows } from '../../store/selectors';
import { addDays, daysBetween, fmtDate, fmtDateShort, fmtInt, moneyM, pctInt } from '../../logic/format';
import { toUSD } from '../../logic/fx';

/** Baseline weekly early-payment volume for the wider book (USD M), oldest first. */
const BASELINE_WEEKS = [3.1, 2.8, 3.4, 3.0, 3.6, 2.9, 3.3, 3.8, 3.2, 3.5, 3.9, 2.4];

export default function ProgramOverview() {
  const data = useStore((s) => s.data);
  const navigate = useNavigate();
  const month = data.today.slice(0, 7);
  const paidThisMonth = data.invoices.filter((i) => i.payment && i.payment.sentAt.slice(0, 7) === month);
  const paidValue = paidThisMonth.reduce((s, i) => s + toUSD(i.payment!.amount, i.payment!.currency), 0);
  const income = paidThisMonth.reduce((s, i) => s + toUSD(i.quote?.discount ?? 0, i.currency), 0);
  const held = data.invoices.filter((i) => i.status === 'Held').length;
  const onboarding = data.suppliers.filter((s) => s.onboardingStatus !== 'Enrolled' && s.onboardingStatus !== 'Declined').length;
  const failed = data.paymentCases.filter((c) => c.status === 'Open').length;
  const alerts = data.alerts.filter((a) => a.status === 'Open').length;
  const rows = maturityRows(data, 'all', addDays(data.today, -1));
  const maturity = rows.map((r) => ({ label: fmtDateShort(r.date), value: +(r.totalUSD / 1_000_000).toFixed(2) }));

  const weeks = BASELINE_WEEKS.map((base, idx) => {
    const end = addDays(data.today, -(11 - idx) * 7);
    const start = addDays(end, -6);
    const actual = data.invoices.filter((i) => i.payment && i.payment.sentAt.slice(0, 10) >= start && i.payment.sentAt.slice(0, 10) <= end).reduce((s, i) => s + toUSD(i.payment!.amount, i.payment!.currency), 0);
    return { label: fmtDateShort(end), value: +(base + actual / 1_000_000).toFixed(2) };
  });

  const used = data.programUsedUSD / data.config.programLimitUSD;

  return (
    <div>
      <PageHeader title="Program overview" context={<span className="num">{fmtDate(data.today)} · Anchor: Kaltrex Industries · Program limit USD {fmtInt(data.config.programLimitUSD)}</span>} />
      <div className="grid grid-cols-4 gap-4">
        <Tile label="Exposure to Kaltrex" value={pctInt(used)} sub={<span className="num">{moneyM(data.programUsedUSD)} of {moneyM(data.config.programLimitUSD)}</span>} bar={used} to="/bank/settlement" />
        <Tile label="Invoices paid early this month" value={paidThisMonth.length} sub={<span className="num">{moneyM(paidValue)} net paid</span>} to="/bank/payments" />
        <Tile label="Discount income this month" value={moneyM(income, 'USD', 2)} sub={<span className="num">Spread {(data.config.spread * 100).toFixed(2)}% over market rate</span>} to="/bank/payments" />
        <Card title="Open items" pad={false}>
          <ul className="text-base">
            {[
              { label: 'Held invoices', n: held, to: '/bank/review' },
              { label: 'Onboarding cases', n: onboarding, to: '/bank/onboarding' },
              { label: 'Failed debits', n: failed, to: '/bank/settlement' },
              { label: 'Open alerts', n: alerts, to: '/bank/alerts' },
            ].map((r) => (
              <li key={r.label} className="flex items-center justify-between border-b border-border px-4 py-1.5 last:border-0">
                <LinkText to={r.to}>{r.label}</LinkText>
                <span className="num">{r.n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title="Exposure by maturity date (USD M)">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maturity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#E3E6EC" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6479' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#5B6479' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F0F1F4' }} contentStyle={{ border: '1px solid #E3E6EC', borderRadius: 4, fontSize: 13 }} formatter={(v: number) => [`USD ${v.toFixed(1)}M`, 'Due']} labelFormatter={(l) => `Due ${l}`} />
                <Bar dataKey="value" fill="#00C2B8" radius={0} onClick={() => navigate('/bank/settlement')} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Early payments by week (USD M, last 12 weeks)">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#E3E6EC" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6479' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#5B6479' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F0F1F4' }} contentStyle={{ border: '1px solid #E3E6EC', borderRadius: 4, fontSize: 13 }} formatter={(v: number) => [`USD ${v.toFixed(1)}M`, 'Paid early']} labelFormatter={(l) => `Week to ${l}`} />
                <Bar dataKey="value" fill="#00897F" radius={0} onClick={() => navigate('/bank/payments')} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
