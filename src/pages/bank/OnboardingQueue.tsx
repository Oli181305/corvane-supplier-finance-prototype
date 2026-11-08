import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Money, PageHeader, Status, Table, Tabs } from '../../components/ui';
import { useStore } from '../../store/store';
import { fmtDateShort } from '../../logic/format';

export default function OnboardingQueue() {
  const data = useStore((s) => s.data);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'open' | 'enrolled'>('open');
  const open = data.suppliers.filter((s) => s.onboardingStatus !== 'Enrolled' && s.onboardingStatus !== 'Declined');
  const closed = data.suppliers.filter((s) => s.onboardingStatus === 'Enrolled' || s.onboardingStatus === 'Declined');
  const rows = tab === 'open' ? open : closed;
  const order: Record<string, number> = { 'Awaiting credit decision': 0, 'Checks failed': 1, 'Checks running': 2, 'Awaiting signature': 3, Registering: 4, Nominated: 5 };

  return (
    <div>
      <PageHeader title="Onboarding queue" />
      <Tabs tabs={[{ id: 'open', label: 'Open cases', count: open.length }, { id: 'enrolled', label: 'Enrolled and declined', count: closed.length }]} active={tab} onChange={setTab} />
      <Card pad={false}>
        <Table
          rows={[...rows].sort((a, b) => (order[a.onboardingStatus] ?? 9) - (order[b.onboardingStatus] ?? 9))}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/bank/onboarding/${s.id}`)}
          empty={tab === 'open' ? 'No open onboarding cases. Suppliers nominated by Kaltrex appear here.' : 'No enrolled suppliers.'}
          columns={[
            { key: 'n', header: 'Supplier', render: (s) => <span><span className="font-medium">{s.name}</span><span className="block text-xs text-grey">{s.city}</span></span>, sortValue: (s) => s.name },
            { key: 'by', header: 'Nominated by', render: () => 'Kaltrex' },
            { key: 'e', header: 'Entity', render: (s) => data.entities.find((e) => e.id === s.kaltrexEntityId)?.short },
            { key: 'st', header: 'Stage', render: (s) => <Status status={s.onboardingStatus} reason={s.onboardingStatus === 'Checks failed' ? (s.checks.find((c) => c.result === 'Failed')?.source === 'UCC search API' ? 'UCC lien found' : s.checks.find((c) => c.result === 'Failed')?.name) : s.onboardingStatus === 'Awaiting credit decision' ? `Model recommends ${s.recommendedRating}` : undefined} />, sortValue: (s) => s.onboardingStatus },
            { key: 'rating', header: 'Rating', render: (s) => s.rating ?? <span className="text-grey">{s.recommendedRating ? `${s.recommendedRating} (recommended)` : '–'}</span> },
            { key: 'limit', header: 'Sub-limit', align: 'right', render: (s) => (s.approvedSubLimit ? <Money amount={s.approvedSubLimit} currency={s.currency} /> : s.recommendedSubLimit ? <span className="text-grey">{s.currency} {s.recommendedSubLimit.toLocaleString('en-US')} (rec.)</span> : <span className="text-grey">–</span>) },
            { key: 'owner', header: 'Owner', render: (s) => s.stageOwner ?? '–' },
            { key: 'opened', header: 'Opened', render: (s) => <span className="num">{s.openedOn ? fmtDateShort(s.openedOn) : fmtDateShort(s.history[0]?.at)}</span>, sortValue: (s) => s.openedOn ?? '' },
          ]}
        />
      </Card>
    </div>
  );
}
