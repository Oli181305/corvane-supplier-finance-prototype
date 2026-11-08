import { useNavigate } from 'react-router-dom';
import { Card, Notice, PageHeader, Status, Table } from '../../components/ui';
import { useStore } from '../../store/store';
import { fmtTime } from '../../logic/format';

export default function EarlyWarnings() {
  const data = useStore((s) => s.data);
  const navigate = useNavigate();
  const rows = [...data.alerts].sort((a, b) => (a.status === b.status ? b.raisedAt.localeCompare(a.raisedAt) : a.status === 'Open' ? -1 : 1));
  return (
    <div>
      <PageHeader title="Early warnings" />
      <Notice kind="info" className="mb-4">Alerts open a case. They do not change any limit.</Notice>
      <Card pad={false}>
        <Table
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(`/bank/alerts/${a.id}`)}
          empty="No alerts. Monitoring rules raise alerts here."
          columns={[
            { key: 'id', header: 'Alert', width: '90px', render: (a) => <span className="font-medium">{a.id}</span>, sortValue: (a) => a.id },
            { key: 'type', header: 'Type', render: (a) => a.type, sortValue: (a) => a.type },
            { key: 'subj', header: 'Subject', render: (a) => a.subject, sortValue: (a) => a.subject },
            { key: 'detail', header: 'Detail', className: 'whitespace-normal py-2 leading-4 text-xs', render: (a) => <span className="text-grey">{a.detail.length > 140 ? `${a.detail.slice(0, 140)}…` : a.detail}</span> },
            { key: 'at', header: 'Raised', render: (a) => <span className="num">{fmtTime(a.raisedAt)}</span>, sortValue: (a) => a.raisedAt },
            { key: 'owner', header: 'Owner', render: (a) => a.owner, sortValue: (a) => a.owner },
            { key: 'st', header: 'Status', render: (a) => <Status status={a.status} />, sortValue: (a) => a.status },
          ]}
        />
      </Card>
    </div>
  );
}
