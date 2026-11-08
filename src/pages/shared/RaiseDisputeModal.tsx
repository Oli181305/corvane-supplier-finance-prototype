import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Input, Modal, Notice, Select, Textarea } from '../../components/ui';
import { useStore } from '../../store/store';
import { usePortalBase } from '../../store/selectors';
import { moneyFull } from '../../logic/format';
import type { DisputeReason } from '../../types';
import { toast } from '../../store/toast';

const LIABILITY = 'The bank has already paid this invoice early. Kaltrex still pays Corvane Bank in full on the due date and remains liable for the invoice. Kaltrex recovers the amount from the supplier, usually as a credit note on the next invoice.';

export default function RaiseDisputeModal({ invoiceId, onClose, allowPick }: { invoiceId?: string; onClose: () => void; allowPick?: { supplierId?: string } }) {
  const data = useStore((s) => s.data);
  const raise = useStore((s) => s.raiseDispute);
  const base = usePortalBase();
  const navigate = useNavigate();
  const candidates = data.invoices.filter((i) => ['In approval', 'Offered', 'Paid early'].includes(i.status) && (!allowPick?.supplierId || i.supplierId === allowPick.supplierId) && !data.disputes.find((d) => d.invoiceId === i.id && d.status === 'Open'));
  const [picked, setPicked] = useState(invoiceId ?? candidates[0]?.id ?? '');
  const [reason, setReason] = useState<DisputeReason>('Short delivery');
  const [text, setText] = useState('');
  const [file, setFile] = useState('');
  const inv = data.invoices.find((i) => i.id === picked);
  const paid = inv?.status === 'Paid early';

  return (
    <Modal
      title={`Raise dispute${inv ? ` on ${inv.number}` : ''}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!inv || text.trim().length < 5}
            onClick={() => {
              if (!inv) return;
              const id = raise(inv.id, reason, text.trim(), file ? [file] : []);
              toast(`Dispute ${id} raised on ${inv.number}`, paid ? 'The invoice was already paid early. Kaltrex remains liable on the due date.' : 'The invoice is removed from the offered list until the dispute is resolved.', { to: `${base}/disputes/${id}`, label: 'Open dispute case' }, 'info');
              onClose();
              navigate(`${base}/disputes/${id}`);
            }}
          >
            Raise dispute
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!invoiceId ? (
          <Field label="Invoice">
            <Select value={picked} onChange={(e) => setPicked(e.target.value)}>
              {candidates.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number} · {data.suppliers.find((s) => s.id === i.supplierId)?.name} · {moneyFull(i.amount, i.currency)} · {i.status}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value as DisputeReason)}>
            {(['Short delivery', 'Defective parts', 'Price difference', 'Other'] as DisputeReason[]).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What is wrong with the invoice" />
        </Field>
        <Field label="Attachment (file name)" hint="Mock attachment. Any name is accepted.">
          <Input value={file} onChange={(e) => setFile(e.target.value)} placeholder="Delivery note.pdf" />
        </Field>
        {paid ? <Notice kind="warning">{LIABILITY}</Notice> : <Notice kind="info">The invoice is not paid early yet. It is removed from the supplier offered list until the dispute is resolved.</Notice>}
      </div>
    </Modal>
  );
}

export { LIABILITY };
