import { useEffect, useState } from 'react';
import { Bar, Button, Card, Modal, Money, PageHeader, Skeleton, Status, Table } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { useReadOnly } from '../../store/selectors';
import { ERP_SUPPLIERS } from '../../data/seed';
import { money, pctInt } from '../../logic/format';
import { toast } from '../../store/toast';

export default function KSuppliers() {
  const data = useStore((s) => s.data);
  const entityFilter = useStore((s) => s.entityFilter);
  const nominate = useStore((s) => s.nominateSuppliers);
  const user = useCurrentUser();
  const readOnly = useReadOnly();
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const canNominate = !readOnly && (user?.roleKey === 'cfo' || user?.roleKey === 'treasurer');
  const rows = data.suppliers.filter((s) => entityFilter === 'all' || s.kaltrexEntityId === entityFilter);
  const candidates = ERP_SUPPLIERS.filter((e) => !data.suppliers.find((s) => s.name === e.name));

  useEffect(() => {
    if (!modal) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [modal]);

  return (
    <div>
      <PageHeader
        title="Suppliers"
        actions={
          <Button variant="primary" disabled={!canNominate} title={!canNominate ? (readOnly ? 'Read only while viewing as Kaltrex' : 'Only the treasurer or CFO can nominate suppliers') : undefined} onClick={() => setModal(true)}>
            Nominate suppliers
          </Button>
        }
      />
      <Card pad={false}>
        <Table
          rows={rows}
          rowKey={(s) => s.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Supplier', render: (s) => <span><span className="font-medium">{s.name}</span><span className="block text-xs text-grey">{s.city}</span></span>, sortValue: (s) => s.name },
            { key: 'entity', header: 'Entity', render: (s) => data.entities.find((e) => e.id === s.kaltrexEntityId)?.short, sortValue: (s) => s.kaltrexEntityId },
            { key: 'status', header: 'Onboarding status', render: (s) => <Status status={s.onboardingStatus} reason={s.onboardingStatus === 'Checks failed' ? s.checks.find((c) => c.result === 'Failed')?.name : undefined} />, sortValue: (s) => s.onboardingStatus },
            { key: 'rating', header: 'Rating', render: (s) => s.rating ?? (s.recommendedRating ? <span className="text-grey">{s.recommendedRating} (recommended)</span> : <span className="text-grey">n/a</span>) },
            { key: 'limit', header: 'Sub-limit', align: 'right', render: (s) => (s.approvedSubLimit ? <Money amount={s.approvedSubLimit} currency={s.currency} /> : s.recommendedSubLimit ? <span className="text-grey">{money(s.recommendedSubLimit, s.currency)} (recommended)</span> : <span className="text-grey">n/a</span>), sortValue: (s) => s.approvedSubLimit ?? 0 },
            {
              key: 'used',
              header: 'Used',
              align: 'right',
              render: (s) =>
                s.approvedSubLimit ? (
                  <div className="flex items-center justify-end gap-3">
                    <Bar value={s.subLimitUsed / s.approvedSubLimit} className="w-20" color={s.subLimitUsed / s.approvedSubLimit >= data.config.nearLimitAlertPct ? '#D97706' : '#00897F'} />
                    <span className="num w-10">{pctInt(s.subLimitUsed / s.approvedSubLimit)}</span>
                  </div>
                ) : null,
              sortValue: (s) => (s.approvedSubLimit ? s.subLimitUsed / s.approvedSubLimit : -1),
            },
            { key: 'inv', header: 'Invoices 12m', align: 'right', render: (s) => (s.onboardingStatus === 'Enrolled' ? s.invoices12m : <span className="text-grey">–</span>), sortValue: (s) => s.invoices12m },
          ]}
        />
      </Card>

      {modal ? (
        <Modal
          title="Nominate suppliers"
          onClose={() => setModal(false)}
          width={720}
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={picked.size === 0}
                onClick={() => {
                  nominate([...picked]);
                  const names = candidates.filter((c) => picked.has(c.id)).map((c) => c.name).join(', ');
                  toast(`Nominated ${picked.size} supplier${picked.size === 1 ? '' : 's'}`, `${names}. They appear as Nominated in the bank onboarding queue. Invitations sent.`);
                  setPicked(new Set());
                  setModal(false);
                }}
              >
                Nominate
              </Button>
            </>
          }
        >
          <p className="mb-3 text-sm text-grey">Source: Kaltrex's supplier list in its ERP</p>
          {loading ? (
            <Skeleton rows={4} />
          ) : (
            <Table
              rows={candidates}
              rowKey={(c) => c.id}
              selectable
              selected={picked}
              onToggle={(k) => setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
              onToggleAll={(keys) => setPicked(new Set(keys))}
              dense
              empty="All suppliers in the ERP list are already nominated."
              columns={[
                { key: 'name', header: 'Supplier', render: (c) => <span><span className="font-medium">{c.name}</span><span className="block text-xs text-grey">{c.city}</span></span> },
                { key: 'entity', header: 'Entity', render: (c) => data.entities.find((e) => e.id === c.entityId)?.short },
                { key: 'since', header: 'Supplier since', align: 'right', render: (c) => c.since },
                { key: 'spend', header: 'Spend 12m', align: 'right', render: (c) => <Money amount={c.spend12m} currency={c.currency} /> },
              ]}
            />
          )}
        </Modal>
      ) : null}
    </div>
  );
}
