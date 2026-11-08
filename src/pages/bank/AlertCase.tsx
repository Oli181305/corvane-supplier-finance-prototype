import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, KV, Notice, PageHeader, Status, Textarea } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { fmtTime } from '../../logic/format';
import { toast } from '../../store/toast';

export default function AlertCase() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const navigate = useNavigate();
  const close = useStore((s) => s.closeAlert);
  const addNote = useStore((s) => s.addAlertNote);
  const [note, setNote] = useState('');
  const a = data.alerts.find((x) => x.id === id);
  if (!a) {
    return (
      <div>
        <PageHeader title="Alert not found" />
        <Button variant="link" onClick={() => navigate('/bank/alerts')}>Back to early warnings</Button>
      </div>
    );
  }
  const canAct = (a.owner === 'Credit' && (user?.roleKey === 'credit' || user?.roleKey === 'admin')) || (a.owner === 'Operations' && (user?.roleKey === 'operations' || user?.roleKey === 'admin'));
  const supplier = data.suppliers.find((s) => s.name === a.subject);
  const pc = a.caseId ? data.paymentCases.find((c) => c.id === a.caseId) : undefined;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Early warnings', to: '/bank/alerts' }, { label: a.id }]}
        title={<span className="flex items-center gap-4"><span>{a.type} · {a.subject}</span><Status status={a.status} /></span>}
        context={<span className="num">Raised {fmtTime(a.raisedAt)} · Owner: {a.owner}</span>}
        actions={supplier ? <Button variant="secondary" onClick={() => navigate(`/bank/onboarding/${supplier.id}`)}>Open supplier</Button> : pc ? <Button variant="secondary" onClick={() => navigate('/bank/settlement')}>Open settlement case {pc.id}</Button> : null}
      />
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4">
          <Card title="Detail">
            <p className="text-base">{a.detail}</p>
            {supplier?.approvedSubLimit ? (
              <div className="mt-4">
                <KV rows={[['Rating', supplier.rating ?? ''], ['Sub-limit', `${supplier.currency} ${supplier.approvedSubLimit.toLocaleString('en-US')}`], ['Used', `${supplier.currency} ${supplier.subLimitUsed.toLocaleString('en-US')} (${Math.round((supplier.subLimitUsed / supplier.approvedSubLimit) * 100)}%)`], ['Bank account', `${supplier.bankAccount.bank} ···${supplier.bankAccount.last4}`]]} />
              </div>
            ) : null}
          </Card>
          <Card title="Notes" pad={false}>
            <ul className="text-sm">
              {a.notes.length === 0 ? <li className="px-4 py-4 text-grey">No notes yet.</li> : null}
              {a.notes.map((n, i) => (
                <li key={i} className="border-b border-border px-4 py-3 last:border-0">
                  <div className="flex justify-between"><span className="font-medium">{n.by}</span><span className="num text-xs text-grey">{fmtTime(n.at)}</span></div>
                  <p className="mt-1">{n.text}</p>
                </li>
              ))}
            </ul>
            {a.status === 'Open' ? (
              <div className="border-t border-border p-4">
                <Textarea rows={2} value={note} disabled={!canAct} onChange={(e) => setNote(e.target.value)} placeholder={canAct ? 'Add a note to the case' : `Only ${a.owner.toLowerCase()} can work this case`} />
                <div className="mt-2 flex justify-between">
                  <Button variant="secondary" disabled={!canAct || note.trim().length < 2} onClick={() => { addNote(a.id, note.trim()); setNote(''); }}>Add note</Button>
                  <Button variant="primary" disabled={!canAct} title={!canAct ? `Only ${a.owner.toLowerCase()} can close this alert` : undefined} onClick={() => { close(a.id, note.trim()); setNote(''); toast(`Alert ${a.id} closed`, 'No limit was changed by the alert.'); }}>Close alert</Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
        <Card title="Case">
          <KV rows={[['Alert', a.id], ['Type', a.type], ['Subject', a.subject], ['Owner', a.owner], ['Status', a.status], ...(a.caseId ? [['Linked case', a.caseId] as [string, string]] : [])]} />
        </Card>
      </div>
    </div>
  );
}
