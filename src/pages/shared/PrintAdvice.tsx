import { useNavigate, useParams } from 'react-router-dom';
import { Wordmark } from '../../components/Shell';
import { Button } from '../../components/ui';
import { useStore } from '../../store/store';
import { fmtDate, fmtTime, moneyFull, pct } from '../../logic/format';

export default function PrintAdvice() {
  const { ref } = useParams();
  const data = useStore((s) => s.data);
  const navigate = useNavigate();
  const invs = data.invoices.filter((i) => i.payment?.reference === ref);
  const first = invs[0];
  const sup = first ? data.suppliers.find((s) => s.id === first.supplierId) : undefined;

  if (!first || !first.payment) {
    return (
      <div className="p-10">
        <p>Advice not found.</p>
        <Button variant="link" onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }
  const p = first.payment;
  const face = invs.reduce((s, i) => s + i.amount, 0);
  const disc = invs.reduce((s, i) => s + (i.quote?.discount ?? 0), 0);
  const net = invs.reduce((s, i) => s + (i.quote?.netAmount ?? i.amount), 0);
  const paid = invs.reduce((s, i) => s + (i.payment?.amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="no-print flex items-center justify-between border-b border-border px-8 py-3">
        <Button variant="link" onClick={() => navigate(-1)}>Back</Button>
        <Button variant="primary" onClick={() => window.print()}>Print</Button>
      </div>
      <div className="mx-auto max-w-[800px] px-8 py-10">
        <div className="flex items-start justify-between">
          <div>
            <Wordmark light={false} />
            <div className="mt-1 text-sm text-grey">Corporate Internet Banking · Supplier Finance</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-lg font-semibold">Early payment advice</div>
            <div className="num text-grey">{p.reference}</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-base">
          <div>
            <div className="label mb-1">Beneficiary</div>
            <div className="font-medium">{sup?.name}</div>
            <div className="text-grey">{sup?.city}</div>
            <div className="num mt-1">{sup?.bankAccount.bank} ···{sup?.bankAccount.last4}</div>
          </div>
          <div>
            <div className="label mb-1">Payment</div>
            <div className="num">Sent {fmtTime(p.sentAt)}</div>
            <div className="num">Rail {p.rail}. Arrives {fmtDate(p.arrivesOn)}</div>
            <div className="num">Anchor buyer Kaltrex Industries. Program spread {pct(data.config.spread)}</div>
          </div>
        </div>

        <table className="num mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-2 font-medium">Invoice</th>
              <th className="py-2 font-medium">Kaltrex entity</th>
              <th className="py-2 font-medium">Due</th>
              <th className="py-2 text-right font-medium">Days</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Face value</th>
              <th className="py-2 text-right font-medium">Discount</th>
              <th className="py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {invs.map((i) => (
              <tr key={i.id} className="border-b border-border">
                <td className="py-2">{i.number}</td>
                <td className="py-2">{data.entities.find((e) => e.id === i.entityId)?.name}</td>
                <td className="py-2">{fmtDate(i.dueDate)}</td>
                <td className="py-2 text-right">{i.quote?.days}</td>
                <td className="py-2 text-right">{i.quote ? pct(i.quote.rate) : ''}</td>
                <td className="py-2 text-right">{moneyFull(i.amount, i.currency)}</td>
                <td className="py-2 text-right">{moneyFull(i.quote?.discount ?? 0, i.currency)}</td>
                <td className="py-2 text-right">{moneyFull(i.quote?.netAmount ?? i.amount, i.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink font-semibold">
              <td className="py-2" colSpan={5}>Total</td>
              <td className="py-2 text-right">{moneyFull(face, first.currency)}</td>
              <td className="py-2 text-right">{moneyFull(disc, first.currency)}</td>
              <td className="py-2 text-right">{moneyFull(net, first.currency)}</td>
            </tr>
            {p.currency !== first.currency ? (
              <tr>
                <td className="py-2 text-grey" colSpan={7}>
                  Converted at 1 {first.currency} = {first.quote?.fxRate?.toFixed(4)} {p.currency} (live market FX rate at acceptance)
                </td>
                <td className="py-2 text-right">{moneyFull(paid, p.currency)}</td>
              </tr>
            ) : null}
          </tfoot>
        </table>

      </div>
    </div>
  );
}
