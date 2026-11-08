import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Money, PageHeader, Status, Table } from '../../components/ui';
import { effectivePortal, effectiveSupplierId, useCurrentUser, useStore } from '../../store/store';
import { usePortalBase, useReadOnly } from '../../store/selectors';
import { fmtTime } from '../../logic/format';
import RaiseDisputeModal from './RaiseDisputeModal';

export default function DisputesList() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const portal = effectivePortal(user, viewAs);
  const supplierId = effectiveSupplierId(user, viewAs);
  const base = usePortalBase();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const [raise, setRaise] = useState(false);

  const rows = data.disputes
    .map((d) => ({ d, inv: data.invoices.find((i) => i.id === d.invoiceId)! }))
    .filter((r) => r.inv && (portal !== 'supplier' || r.inv.supplierId === supplierId))
    .sort((a, b) => (a.d.status === b.d.status ? b.d.raisedAt.localeCompare(a.d.raisedAt) : a.d.status === 'Open' ? -1 : 1));

  const canRaise = !readOnly && (portal === 'kaltrex' || (portal === 'supplier' && user?.roleKey === 'supplierFinance'));

  return (
    <div>
      <PageHeader
        title="Disputes"
        actions={portal !== 'bank' ? <Button variant="primary" disabled={!canRaise} title={!canRaise ? (readOnly ? 'Read only while viewing as another user' : 'Only the supplier finance manager can raise a dispute') : undefined} onClick={() => setRaise(true)}>Raise dispute</Button> : null}
      />
      <Card pad={false}>
        <Table
          rows={rows}
          rowKey={(r) => r.d.id}
          onRowClick={(r) => navigate(`${base}/disputes/${r.d.id}`)}
          empty="No disputes. Disputes raised by Kaltrex or a supplier appear here."
          columns={[
            { key: 'id', header: 'Case', width: '90px', render: (r) => <span className="font-medium">{r.d.id}</span>, sortValue: (r) => r.d.id },
            { key: 'inv', header: 'Invoice', render: (r) => r.inv.number, sortValue: (r) => r.inv.number },
            ...(portal !== 'supplier' ? [{ key: 'sup', header: 'Supplier', render: (r: (typeof rows)[number]) => data.suppliers.find((s) => s.id === r.inv.supplierId)?.name ?? '', sortValue: (r: (typeof rows)[number]) => data.suppliers.find((s) => s.id === r.inv.supplierId)?.name ?? '' }] : []),
            { key: 'amount', header: 'Amount', align: 'right', render: (r) => <Money amount={r.inv.amount} currency={r.inv.currency} />, sortValue: (r) => r.inv.amount },
            { key: 'reason', header: 'Reason', render: (r) => r.d.reason },
            { key: 'by', header: 'Raised by', render: (r) => `${r.d.raisedBy} (${r.d.raisedByParty})` },
            { key: 'at', header: 'Raised', render: (r) => <span className="num">{fmtTime(r.d.raisedAt)}</span>, sortValue: (r) => r.d.raisedAt },
            { key: 'paid', header: 'Paid early', render: (r) => (r.d.paidEarly ? 'Yes. Kaltrex liable' : 'No') },
            { key: 'status', header: 'Status', render: (r) => <Status status={r.d.status} reason={r.d.resolution} /> },
          ]}
        />
      </Card>
      {raise ? <RaiseDisputeModal onClose={() => setRaise(false)} allowPick={{ supplierId: portal === 'supplier' ? supplierId : undefined }} /> : null}
    </div>
  );
}
