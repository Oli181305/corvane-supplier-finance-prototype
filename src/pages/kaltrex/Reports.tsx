import { useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../components/ui';

export default function Reports() {
  const navigate = useNavigate();
  const reports = [
    { id: 'rollforward', title: 'ASU 2022-04 obligations rollforward', text: 'Opening balance, invoices confirmed, amounts paid and closing balance by quarter. Key program terms for the footnote.' },
    { id: 'suppliers', title: 'Supplier list', text: 'All nominated and enrolled suppliers with onboarding status, rating, sub-limit and usage.' },
    { id: 'audit', title: 'Audit extract', text: 'Every action by a Kaltrex user on the program: approvals, routing, disputes, nominations and setting changes.' },
  ];
  return (
    <div>
      <PageHeader title="Reports" />
      <div className="grid grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.id} title={r.title}>
            <div>
              <Button variant="primary" onClick={() => navigate(`/print/report/${r.id}`)}>Open report</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
