import { useMemo, useState } from 'react';
import { Button, Card, Field, Input, PageHeader, Select, Table, csv, download } from '../../components/ui';
import { useStore } from '../../store/store';
import { fmtTimeFull } from '../../logic/format';

export default function AuditLog() {
  const data = useStore((s) => s.data);
  const [userF, setUserF] = useState('all');
  const [actionF, setActionF] = useState('all');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');

  const users = useMemo(() => [...new Set(data.audit.map((a) => a.user))].sort(), [data.audit]);
  const actions = useMemo(() => [...new Set(data.audit.map((a) => a.action))].sort(), [data.audit]);
  const rows = useMemo(
    () =>
      [...data.audit]
        .filter((a) => userF === 'all' || a.user === userF)
        .filter((a) => actionF === 'all' || a.action === actionF)
        .filter((a) => !date || a.at.slice(0, 10) === date)
        .filter((a) => !search || `${a.object} ${a.detail}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [data.audit, userF, actionF, date, search],
  );

  return (
    <div>
      <PageHeader
        title="Audit log"
        actions={<Button variant="secondary" onClick={() => download(`corvane-audit-${data.today}.csv`, csv([['Time', 'User', 'Role', 'Action', 'Object', 'Detail'], ...rows.map((a) => [a.at, a.user, a.role, a.action, a.object, a.detail])]))}>Export</Button>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="User">
          <Select value={userF} onChange={(e) => setUserF(e.target.value)} className="w-[200px]">
            <option value="all">All users</option>
            {users.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </Field>
        <Field label="Action">
          <Select value={actionF} onChange={(e) => setActionF(e.target.value)} className="w-[260px]">
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" /></Field>
        <Field label="Search"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Object or detail" className="w-[220px]" /></Field>
        {userF !== 'all' || actionF !== 'all' || date || search ? <Button variant="quiet" className="mb-2" onClick={() => { setUserF('all'); setActionF('all'); setDate(''); setSearch(''); }}>Clear filters</Button> : null}
      </div>
      <Card pad={false}>
        <Table
          rows={rows}
          rowKey={(a) => a.id}
          empty="No entries match the filters."
          columns={[
            { key: 'at', header: 'Time', width: '170px', render: (a) => <span className="num whitespace-nowrap">{fmtTimeFull(a.at)}</span>, sortValue: (a) => a.at },
            { key: 'user', header: 'User', width: '150px', render: (a) => <span className="font-medium">{a.user}</span>, sortValue: (a) => a.user },
            { key: 'role', header: 'Role', width: '130px', render: (a) => a.role, sortValue: (a) => a.role },
            { key: 'action', header: 'Action', width: '220px', render: (a) => a.action, sortValue: (a) => a.action },
            { key: 'object', header: 'Object', width: '180px', render: (a) => <span className="num">{a.object}</span>, sortValue: (a) => a.object },
            { key: 'detail', header: 'Detail', render: (a) => <span className="num whitespace-normal text-grey">{a.detail}</span>, className: 'py-2 leading-5' },
          ]}
        />
      </Card>
    </div>
  );
}
