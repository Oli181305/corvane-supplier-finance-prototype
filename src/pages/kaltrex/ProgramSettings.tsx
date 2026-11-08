import { useState } from 'react';
import { Button, Card, Input, Money, Notice, PageHeader, Table, TwoFactor } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { useReadOnly } from '../../store/selectors';
import { fmtInt, fmtTime } from '../../logic/format';
import { toast } from '../../store/toast';

export default function ProgramSettings() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const readOnly = useReadOnly();
  const propose = useStore((s) => s.proposeLimits);
  const confirm = useStore((s) => s.confirmLimits);
  const approvers = data.users.filter((u) => u.portal === 'kaltrex');
  const [limits, setLimits] = useState<Record<string, string>>(Object.fromEntries(approvers.map((u) => [u.id, String(u.approvalLimit ?? 0)])));
  const [twofa, setTwofa] = useState(false);

  const canEdit = !readOnly && (user?.roleKey === 'cfo' || user?.roleKey === 'treasurer');
  const changed = approvers.some((u) => Number(limits[u.id].replace(/[^\d]/g, '')) !== (u.approvalLimit ?? 0));

  return (
    <div>
      <PageHeader title="Program settings" />

      <div className="space-y-4">
        <Card
          title="Approval limits per role"
          right={
            <Button variant="primary" size="sm" disabled={!canEdit || !changed} title={!canEdit ? (readOnly ? 'Read only while viewing as Kaltrex' : 'Only the treasurer or CFO can change limits') : !changed ? 'No change to save' : undefined} onClick={() => setTwofa(true)}>
              Save
            </Button>
          }
          pad={false}
        >
          {data.pendingLimits ? (
            <div className="border-b border-border px-4 py-3">
              <Notice kind="warning">
                <div className="flex items-center justify-between gap-4">
                  <span>
                    Change waiting for a second Kaltrex user to confirm. Proposed by {data.pendingLimits.by} at {fmtTime(data.pendingLimits.at)}.
                  </span>
                  <Button variant="link" onClick={() => { confirm(); toast('Approval limits updated', 'Confirmed by a second Kaltrex user (demo).'); }}>Confirm as second user (demo)</Button>
                </div>
              </Notice>
            </div>
          ) : null}
          <Table
            rows={approvers}
            rowKey={(u) => u.id}
            columns={[
              { key: 'name', header: 'User', render: (u) => <span className="font-medium">{u.name}</span> },
              { key: 'role', header: 'Role', render: (u) => u.role },
              { key: 'current', header: 'Current limit', align: 'right', render: (u) => <Money amount={u.approvalLimit ?? 0} currency="USD" /> },
              {
                key: 'new',
                header: 'New limit (USD)',
                align: 'right',
                render: (u) => <Input value={limits[u.id]} disabled={!canEdit} onChange={(e) => setLimits((l) => ({ ...l, [u.id]: e.target.value }))} className="ml-auto w-[160px] text-right" />,
              },
            ]}
          />
        </Card>

        <Card title="Users and roles" pad={false}>
          <Table
            rows={approvers}
            rowKey={(u) => u.id}
            columns={[
              { key: 'name', header: 'User', render: (u) => <span className="font-medium">{u.name}</span> },
              { key: 'id', header: 'User ID', render: (u) => <span className="num">{u.userId}</span> },
              { key: 'role', header: 'Role', render: (u) => u.role },
              { key: 'rights', header: 'Rights', render: (u) => (u.roleKey === 'ap' ? 'Approve invoices within limit. Raise disputes. Upload invoices' : 'Approve invoices within limit. Nominate suppliers. Raise disputes. Change settings') },
              { key: '2fa', header: '2FA', render: (u) => <span className="num">Phone ···{u.phoneLast4}</span> },
            ]}
          />
        </Card>

        <Card title="Entities (read only)" pad={false}>
          <Table
            rows={data.entities}
            rowKey={(e) => e.id}
            columns={[
              { key: 'name', header: 'Entity', render: (e) => <span className="font-medium">{e.name}</span> },
              { key: 'country', header: 'Country', render: (e) => e.country },
              { key: 'ccy', header: 'Currency', render: (e) => e.currency },
              { key: 'limit', header: 'Sub-limit', align: 'right', render: (e) => <Money amount={e.subLimit} currency={e.currency} /> },
            ]}
          />
        </Card>
      </div>

      {twofa ? (
        <TwoFactor
          purpose="Save approval limits."
          onCancel={() => setTwofa(false)}
          onConfirm={() => {
            propose(Object.fromEntries(approvers.map((u) => [u.id, Number(limits[u.id].replace(/[^\d]/g, '')) || 0])));
            setTwofa(false);
            toast('Change saved for confirmation', 'A second Kaltrex user has to confirm the new limits.', undefined, 'info');
          }}
        />
      ) : null}
    </div>
  );
}
