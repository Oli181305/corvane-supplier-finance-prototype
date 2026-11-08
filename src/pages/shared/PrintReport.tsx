import { useNavigate, useParams } from 'react-router-dom';
import { Wordmark } from '../../components/Shell';
import { Button } from '../../components/ui';
import { useStore } from '../../store/store';
import { fmtDate, fmtInt, fmtTimeFull, moneyFull, pct } from '../../logic/format';
import { toUSD } from '../../logic/fx';

export default function PrintReport() {
  const { name } = useParams();
  const data = useStore((s) => s.data);
  const navigate = useNavigate();

  const titles: Record<string, string> = {
    rollforward: 'ASU 2022-04 supplier finance obligations rollforward',
    suppliers: 'Supplier list',
    audit: 'Audit extract for Kaltrex actions',
  };
  const title = titles[name ?? ''] ?? 'Report';

  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="no-print flex items-center justify-between border-b border-border px-8 py-3">
        <Button variant="link" onClick={() => navigate(-1)}>Back</Button>
        <Button variant="primary" onClick={() => window.print()}>Print</Button>
      </div>
      <div className="mx-auto max-w-[960px] px-8 py-10">
        <div className="flex items-start justify-between">
          <div>
            <Wordmark light={false} />
            <div className="mt-1 text-sm text-grey">Corporate Internet Banking · Supplier Finance · Kaltrex Industries</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{title}</div>
            <div className="num text-sm text-grey">Prepared {fmtDate(data.today)}</div>
          </div>
        </div>
        <div className="mt-8">
          {name === 'rollforward' ? <Rollforward /> : name === 'suppliers' ? <SupplierList /> : <AuditExtract />}
        </div>
      </div>
    </div>
  );
}

function Rollforward() {
  const data = useStore((s) => s.data);
  const closing = data.programUsedUSD;
  // Quarterly figures (USD millions). The current quarter closes at the live program used figure.
  const q = [
    { q: 'Q4 2025', open: 22.4, confirmed: 41.8, paid: 38.9 },
    { q: 'Q1 2026', open: 25.3, confirmed: 44.1, paid: 42.0 },
    { q: 'Q2 2026', open: 27.4, confirmed: 46.9, paid: 45.1 },
    { q: 'Q3 2026', open: 29.2, confirmed: 48.6, paid: 47.3 },
  ];
  const rows = q.map((r) => ({ ...r, close: +(r.open + r.confirmed - r.paid).toFixed(1) }));
  const q4open = rows[rows.length - 1].close;
  const q4confirmed = 24.9;
  const q4close = closing / 1_000_000;
  const q4paid = +(q4open + q4confirmed - q4close).toFixed(1);
  rows.push({ q: 'Q4 2026 to date', open: q4open, confirmed: q4confirmed, paid: q4paid, close: +q4close.toFixed(1) });
  return (
    <div>
      <p className="mb-4 text-base">
        Disclosure under ASU 2022-04 (Supplier Finance Program Obligations). Amounts in USD millions. Obligations confirmed under the Corvane Bank supplier finance program are presented in accounts payable.
      </p>
      <table className="num w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-2 font-medium">Quarter</th>
            <th className="py-2 text-right font-medium">Opening balance</th>
            <th className="py-2 text-right font-medium">Invoices confirmed</th>
            <th className="py-2 text-right font-medium">Amounts paid</th>
            <th className="py-2 text-right font-medium">Closing balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.q} className="border-b border-border">
              <td className="py-2">{r.q}</td>
              <td className="py-2 text-right">{r.open.toFixed(1)}</td>
              <td className="py-2 text-right">{r.confirmed.toFixed(1)}</td>
              <td className="py-2 text-right">{r.paid.toFixed(1)}</td>
              <td className="py-2 text-right font-semibold">{r.close.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mb-2 mt-8 text-md font-semibold">Key program terms</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {[
            ['Finance provider', 'Corvane Bank (fictitious US bank)'],
            ['Program limit', `USD ${fmtInt(data.config.programLimitUSD)}`],
            ['Payment terms to suppliers', 'Unchanged. 60 to 90 days from invoice'],
            ['Kaltrex payment to the bank', 'Full invoice amount on the original due date'],
            ['Supplier early payment', 'At the supplier option. Discount at market rate plus a spread set by the Kaltrex credit rating'],
            ['Current spread', pct(data.config.spread)],
            ['Guarantees or assets pledged', 'None'],
            ['Entities in the program', data.entities.map((e) => e.name).join(', ')],
          ].map(([k, v]) => (
            <tr key={k} className="border-b border-border">
              <td className="w-[280px] py-2 text-grey">{k}</td>
              <td className="num py-2">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierList() {
  const data = useStore((s) => s.data);
  return (
    <table className="num w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-ink text-left">
          <th className="py-2 font-medium">Supplier</th>
          <th className="py-2 font-medium">City</th>
          <th className="py-2 font-medium">Kaltrex entity</th>
          <th className="py-2 font-medium">Status</th>
          <th className="py-2 font-medium">Rating</th>
          <th className="py-2 text-right font-medium">Sub-limit</th>
          <th className="py-2 text-right font-medium">Used</th>
          <th className="py-2 text-right font-medium">Invoices 12m</th>
        </tr>
      </thead>
      <tbody>
        {data.suppliers.map((s) => (
          <tr key={s.id} className="border-b border-border">
            <td className="py-2">{s.name}</td>
            <td className="py-2">{s.city}</td>
            <td className="py-2">{data.entities.find((e) => e.id === s.kaltrexEntityId)?.name}</td>
            <td className="py-2">{s.onboardingStatus}</td>
            <td className="py-2">{s.rating ?? (s.recommendedRating ? `${s.recommendedRating} (recommended)` : '')}</td>
            <td className="py-2 text-right">{s.approvedSubLimit ? moneyFull(s.approvedSubLimit, s.currency) : ''}</td>
            <td className="py-2 text-right">{s.approvedSubLimit ? moneyFull(s.subLimitUsed, s.currency) : ''}</td>
            <td className="py-2 text-right">{s.onboardingStatus === 'Enrolled' ? s.invoices12m : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AuditExtract() {
  const data = useStore((s) => s.data);
  const names = new Set(data.users.filter((u) => u.portal === 'kaltrex').map((u) => u.name));
  const rows = data.audit.filter((a) => names.has(a.user)).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-ink text-left">
          <th className="py-2 font-medium">Time</th>
          <th className="py-2 font-medium">User</th>
          <th className="py-2 font-medium">Role</th>
          <th className="py-2 font-medium">Action</th>
          <th className="py-2 font-medium">Object</th>
          <th className="py-2 font-medium">Detail</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id} className="border-b border-border align-top">
            <td className="num whitespace-nowrap py-2 pr-3">{fmtTimeFull(a.at)}</td>
            <td className="py-2 pr-3">{a.user}</td>
            <td className="py-2 pr-3">{a.role}</td>
            <td className="py-2 pr-3">{a.action}</td>
            <td className="py-2 pr-3">{a.object}</td>
            <td className="num py-2 text-grey">{a.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function usdOf(amount: number, currency: Parameters<typeof toUSD>[1]) {
  return toUSD(amount, currency);
}
