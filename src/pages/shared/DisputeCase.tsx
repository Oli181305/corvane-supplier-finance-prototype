import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Input, KV, Modal, Notice, PageHeader, Status, Textarea, notPrototype } from '../../components/ui';
import { effectivePortal, useCurrentUser, useStore } from '../../store/store';
import { usePortalBase, useReadOnly } from '../../store/selectors';
import { fmtDate, fmtTime, moneyFull } from '../../logic/format';
import { LIABILITY } from './RaiseDisputeModal';
import { toast } from '../../store/toast';
import type { Dispute } from '../../types';

export default function DisputeCase() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const portal = effectivePortal(user, viewAs);
  const base = usePortalBase();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const addMessage = useStore((s) => s.addDisputeMessage);
  const resolve = useStore((s) => s.resolveDispute);
  const [text, setText] = useState('');
  const [file, setFile] = useState('');
  const [confirm, setConfirm] = useState<Dispute['resolution'] | null>(null);

  const d = data.disputes.find((x) => x.id === id);
  const inv = d ? data.invoices.find((i) => i.id === d.invoiceId) : undefined;
  if (!d || !inv) {
    return (
      <div>
        <PageHeader title="Dispute not found" />
        <Button variant="link" onClick={() => navigate(`${base}/disputes`)}>Back to disputes</Button>
      </div>
    );
  }
  const sup = data.suppliers.find((s) => s.id === inv.supplierId);
  const ent = data.entities.find((e) => e.id === inv.entityId);
  const canAct = !readOnly && d.status === 'Open' && (portal === 'kaltrex' || (portal === 'supplier' && user?.roleKey === 'supplierFinance'));

  const resolutionText: Record<NonNullable<Dispute['resolution']>, string> = {
    'Credit note': `A credit note is created against the next ${sup?.name} invoice.${inv.status === 'Disputed' ? ' The invoice returns to Offered.' : ''}`,
    'Corrected invoice': `The corrected invoice re-enters capture and runs the acceptance criteria again.${inv.status === 'Disputed' ? ' This invoice is closed.' : ''}`,
    'Amount confirmed': inv.status === 'Disputed' ? 'The amount stands. The invoice returns to Offered.' : 'The amount stands. No change to the payment.',
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Disputes', to: `${base}/disputes` }, { label: d.id }]}
        title={
          <span className="flex items-center gap-4">
            <span>Dispute {d.id} · {inv.number}</span>
            <Status status={d.status} reason={d.resolution} />
          </span>
        }
        context={<span className="num">{moneyFull(inv.amount, inv.currency)} · {sup?.name} and {ent?.name} · Raised by {d.raisedBy} ({d.raisedByParty}) on {fmtDate(d.raisedAt)} · Invoice status: {inv.status}</span>}
        actions={<Button variant="secondary" onClick={() => navigate(`${base}/invoices/${inv.id}`)}>Open invoice</Button>}
      />

      {d.paidEarly ? <Notice kind="warning" className="mb-4">{LIABILITY}</Notice> : null}

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card title="Messages" pad={false}>
            <ul>
              {d.messages.map((m, i) => (
                <li key={i} className="border-b border-border px-4 py-3 last:border-0">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">
                      {m.by} <span className="font-normal text-grey">· {m.party}</span>
                    </span>
                    <span className="num text-xs text-grey">{fmtTime(m.at)}</span>
                  </div>
                  <p className="mt-1 text-base">{m.text}</p>
                  {m.attachments?.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
                      {m.attachments.map((a) => (
                        <Button key={a} variant="link" onClick={notPrototype}>{a}</Button>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {d.status === 'Open' && !readOnly && portal !== 'bank' ? (
              <div className="border-t border-border p-4">
                <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message to the other party" />
                <div className="mt-2 flex items-center justify-between gap-4">
                  <Input value={file} onChange={(e) => setFile(e.target.value)} placeholder="Attachment file name (optional)" className="max-w-[320px]" />
                  <Button
                    variant="secondary"
                    disabled={text.trim().length === 0}
                    onClick={() => {
                      addMessage(d.id, text.trim(), file ? [file] : undefined);
                      setText('');
                      setFile('');
                    }}
                  >
                    Send message
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Case">
            <KV
              rows={[
                ['Reason', d.reason],
                ['Raised by', `${d.raisedBy} (${d.raisedByParty})`],
                ['Raised', fmtTime(d.raisedAt)],
                ['Paid early', d.paidEarly ? 'Yes. Kaltrex remains liable' : 'No. Removed from offered list'],
                ['Status', d.status],
                ...(d.resolution ? [['Resolution', d.resolution] as [string, string], ['Resolved', fmtTime(d.resolvedAt)] as [string, string]] : []),
              ]}
            />
          </Card>
          <Card title="Attachments">
            {d.documents.length ? (
              <ul className="space-y-1 text-sm">
                {d.documents.map((doc) => (
                  <li key={doc}>
                    <Button variant="link" onClick={notPrototype}>{doc}</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-grey">No attachments.</p>
            )}
          </Card>
          <Card title="Resolution">
            {d.status === 'Resolved' ? (
              <p className="text-base">Closed with: {d.resolution}.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {(['Credit note', 'Corrected invoice', 'Amount confirmed'] as NonNullable<Dispute['resolution']>[]).map((r) => (
                    <Button key={r} variant="secondary" className="w-full justify-start" disabled={!canAct} title={!canAct ? (readOnly ? 'Read only while viewing as another user' : portal === 'bank' ? 'Bank staff do not resolve disputes' : 'Only the supplier finance manager can resolve a dispute') : undefined} onClick={() => setConfirm(r)}>
                      {r}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </Card>
          <Card title="History" pad={false}>
            <ul className="text-sm">
              {d.history.map((h, i) => (
                <li key={i} className="flex gap-3 border-b border-border px-4 py-2 last:border-0">
                  <span className="num w-[110px] shrink-0 text-grey">{fmtTime(h.at)}</span>
                  <span>
                    {h.by} · {h.action}
                    {h.detail ? <span className="text-grey"> · {h.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {confirm ? (
        <Modal
          title={`Resolve with ${confirm.toLowerCase()}`}
          onClose={() => setConfirm(null)}
          width={520}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  resolve(d.id, confirm);
                  toast(`Dispute ${d.id} resolved`, `${confirm}. ${resolutionText[confirm]}`);
                  setConfirm(null);
                }}
              >
                Confirm resolution
              </Button>
            </>
          }
        >
          <p>{resolutionText[confirm]}</p>
        </Modal>
      ) : null}
    </div>
  );
}
