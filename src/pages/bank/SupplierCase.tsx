import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Skeleton, Status, Table, Tabs, Textarea, notPrototype } from '../../components/ui';
import { useCurrentUser, useStore } from '../../store/store';
import { fmtDate, fmtTime, moneyFull } from '../../logic/format';
import { toast } from '../../store/toast';

export default function SupplierCase() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const navigate = useNavigate();
  const decide = useStore((s) => s.creditDecision);
  const sign = useStore((s) => s.simulateSignature);
  const advance = useStore((s) => s.advanceCheck);
  const sup = data.suppliers.find((s) => s.id === id);
  const [tab, setTab] = useState<'checks' | 'assessment' | 'documents' | 'history'>(sup?.onboardingStatus === 'Awaiting credit decision' ? 'assessment' : 'checks');
  const [rating, setRating] = useState<'A' | 'B' | 'C'>(sup?.recommendedRating ?? 'B');
  const [subLimit, setSubLimit] = useState(String(sup?.recommendedSubLimit ?? 0));
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [decline, setDecline] = useState(false);

  useEffect(() => {
    if (!sup || sup.onboardingStatus !== 'Checks running') return;
    const t = setInterval(() => {
      if (!advance(sup.id)) clearInterval(t);
    }, 900);
    return () => clearInterval(t);
  }, [sup?.id, sup?.onboardingStatus, advance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sup) {
    return (
      <div>
        <PageHeader title="Supplier not found" />
        <Button variant="link" onClick={() => navigate('/bank/onboarding')}>Back to onboarding queue</Button>
      </div>
    );
  }
  const ent = data.entities.find((e) => e.id === sup.kaltrexEntityId);
  const canDecide = user?.roleKey === 'credit' || user?.roleKey === 'admin';
  const sl = Number(subLimit.replace(/[^\d]/g, '')) || 0;
  const override = rating !== sup.recommendedRating || sl !== sup.recommendedSubLimit;
  const awaiting = sup.onboardingStatus === 'Awaiting credit decision';
  const tooltip = !canDecide ? 'Only a credit officer can approve a supplier and set the sub-limit' : !awaiting ? `Stage is ${sup.onboardingStatus}` : override && reason.trim().length < 5 ? 'A written reason is required when the decision differs from the recommendation' : undefined;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Onboarding queue', to: '/bank/onboarding' }, { label: sup.name }]}
        title={
          <span className="flex items-center gap-4">
            <span>{sup.name}</span>
            <span className="text-sm font-normal text-grey">Stage:</span>
            <Status status={sup.onboardingStatus} />
          </span>
        }
        context={<span className="num">{sup.city} · Nominated by Kaltrex {fmtDate(sup.nominatedOn ?? sup.history[0]?.at)} · Supplier to {ent?.name} since {sup.supplierSince}{sup.stageOwner ? ` · Owner ${sup.stageOwner}` : ''}</span>}
        actions={
          sup.onboardingStatus === 'Awaiting signature' ? (
            <Button variant="secondary" onClick={() => { sign(sup.id); toast(`${sup.name} enrolled`, 'Supplier agreement signed. Approved invoices are offered from now on.'); }}>
              Simulate supplier signature (demo)
            </Button>
          ) : sup.onboardingStatus === 'Nominated' ? (
            <Button variant="secondary" onClick={() => toast('Invitation sent again', `Registration link sent to ${sup.name}.`, undefined, 'info')}>Send invitation again</Button>
          ) : null
        }
      />

      <Tabs
        tabs={[
          { id: 'checks', label: 'Checks', count: sup.checks.length },
          { id: 'assessment', label: 'Relationship assessment' },
          { id: 'documents', label: 'Documents', count: sup.documents?.length ?? 0 },
          { id: 'history', label: 'History', count: sup.history.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'checks' ? (
        <Card pad={false}>
          <Table
            rows={sup.checks}
            rowKey={(c) => c.name}
            empty="No checks yet. They start when the supplier submits its registration."
            columns={[
              { key: 'n', header: 'Checks', render: (c) => c.name, width: '36%' },
              { key: 's', header: 'Source', render: (c) => <span className="text-grey">{c.source}</span>, width: '24%' },
              { key: 'r', header: 'Result', render: (c) => (c.result === 'Running' ? <div className="w-24"><Skeleton rows={1} /></div> : <Status status={c.result} reason={c.result !== 'Pending' && c.result !== 'Passed' ? c.detail : undefined} />) },
              { key: 'd', header: 'Detail', render: (c) => <span className="text-grey">{c.result === 'Passed' ? c.detail : ''}</span> },
            ]}
          />
          {sup.onboardingStatus === 'Checks failed' ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <Button variant="destructive" disabled={!canDecide} title={!canDecide ? 'Only a credit officer can decline' : undefined} onClick={() => setDecline(true)}>Decline</Button>
              <Button variant="secondary" onClick={notPrototype}>Request documents from supplier</Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === 'assessment' ? (
        <div className="space-y-4">
          <Card title="Relationship assessment" right={<span className="text-xs text-grey">24 months of Kaltrex payables data via ERP API</span>} pad={false}>
            {sup.ratingDetail ? (
              <table className="w-full text-sm">
                <tbody>
                  {sup.ratingDetail.map((c) => {
                    const open = expanded.has(c.no);
                    return (
                      <Fragment key={c.no}>
                        <tr className="h-10 cursor-pointer border-b border-border hover:bg-hover" onClick={() => setExpanded((s) => { const n = new Set(s); n.has(c.no) ? n.delete(c.no) : n.add(c.no); return n; })}>
                          <td className="num w-8 px-3 text-grey">{c.no}</td>
                          <td className="w-[220px] px-3 font-medium">{c.name}</td>
                          <td className="w-[120px] px-3"><Status status={c.score} /></td>
                          <td className="num px-3 text-grey">{c.summary}</td>
                          <td className="w-8 px-3 text-grey">{open ? '−' : '+'}</td>
                        </tr>
                        {open ? (
                          <tr className="border-b border-border bg-tint">
                            <td />
                            <td colSpan={4} className="px-3 py-3">
                              <div className="mb-2 text-sm text-grey">{c.question}</div>
                              <table className="w-full text-sm">
                                <tbody>
                                  {c.metrics.map((m) => (
                                    <tr key={m.name} className="h-8">
                                      <td className="w-[280px]">{m.name}</td>
                                      <td className="num w-[260px]">{m.value}</td>
                                      <td className="text-grey">{m.source}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-sm text-grey">The assessment is built when all automatic checks have passed.</p>
            )}
          </Card>

          {sup.recommendedRating ? (
            <Card title="Rating model recommendation">
              <div className="num text-md font-semibold">
                Rating {sup.recommendedRating} · Recommended sub-limit {moneyFull(sup.recommendedSubLimit ?? 0, sup.currency)}
              </div>
              <p className="mt-1 text-sm text-grey">The rating model recommends. The credit officer decides.</p>
            </Card>
          ) : null}

          <Card title="Credit decision">
            {sup.onboardingStatus === 'Awaiting signature' || sup.onboardingStatus === 'Enrolled' ? (
              <Notice kind="success">
                Approved. Rating {sup.rating}. Sub-limit {moneyFull(sup.approvedSubLimit ?? 0, sup.currency)}.{sup.onboardingStatus === 'Awaiting signature' ? ' Supplier agreement sent for e-signature.' : ' Enrolled.'}
              </Notice>
            ) : sup.onboardingStatus === 'Declined' ? (
              <Notice kind="error">Declined. {sup.history[sup.history.length - 1]?.detail}</Notice>
            ) : (
              <>
                <div className="grid grid-cols-[160px_240px_1fr] gap-4">
                  <Field label="Rating">
                    <Select value={rating} disabled={!canDecide || !awaiting} onChange={(e) => setRating(e.target.value as 'A' | 'B' | 'C')}>
                      <option>A</option>
                      <option>B</option>
                      <option>C</option>
                    </Select>
                  </Field>
                  <Field label="Sub-limit">
                    <div className="flex items-center gap-2">
                      <span className="text-grey">{sup.currency}</span>
                      <Input value={subLimit} disabled={!canDecide || !awaiting} onChange={(e) => setSubLimit(e.target.value)} />
                    </div>
                  </Field>
                  <Field label={override ? 'Reason (required: differs from the recommendation)' : 'Reason (required if rating or sub-limit differs from the recommendation)'}>
                    <Textarea rows={2} value={reason} disabled={!canDecide || !awaiting} onChange={(e) => setReason(e.target.value)} placeholder={override ? 'Why the decision differs from the model' : 'Optional'} />
                  </Field>
                </div>
                {override && awaiting ? <Notice kind="warning" className="mt-3">This decision differs from the rating model. It is logged as an override with your reason.</Notice> : null}
                <div className="mt-5 flex items-center justify-between">
                  <Button variant="destructive" disabled={!canDecide || !awaiting} title={!canDecide ? 'Only a credit officer can decline' : undefined} onClick={() => setDecline(true)}>Decline</Button>
                  <Button
                    variant="primary"
                    disabled={!!tooltip}
                    title={tooltip}
                    onClick={() => {
                      decide(sup.id, rating, sl, reason.trim(), true);
                      toast(`${sup.name} approved`, `Rating ${rating}. Sub-limit ${moneyFull(sl, sup.currency)}.${override ? ' Override logged with reason.' : ''} Agreement sent for e-signature.`);
                    }}
                  >
                    Approve and send agreement for e-signature
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <Card pad={false}>
          <Table
            rows={sup.documents ?? []}
            rowKey={(d) => d.name}
            empty="No documents yet. The supplier uploads them in the registration."
            columns={[
              { key: 'n', header: 'Document', render: (d) => <Button variant="link" onClick={notPrototype}>{d.name}</Button> },
              { key: 'u', header: 'Uploaded', render: (d) => <span className="num">{fmtDate(d.uploadedOn)}</span> },
              { key: 'r', header: 'Read by', render: (d) => <span className="text-grey">{d.readBy ?? 'Manual'}</span> },
            ]}
          />
        </Card>
      ) : null}

      {tab === 'history' ? (
        <Card pad={false}>
          <Table
            rows={[...sup.history].reverse()}
            rowKey={(h) => `${h.at}-${h.action}`}
            columns={[
              { key: 'at', header: 'Time', width: '140px', render: (h) => <span className="num">{fmtTime(h.at)}</span> },
              { key: 'by', header: 'By', width: '200px', render: (h) => h.by },
              { key: 'a', header: 'Action', render: (h) => <span>{h.action}{h.detail ? <span className="text-grey"> · {h.detail}</span> : null}</span> },
            ]}
          />
        </Card>
      ) : null}

      {decline ? (
        <Modal
          title={`Decline ${sup.name}`}
          onClose={() => setDecline(false)}
          width={520}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDecline(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={reason.trim().length < 5}
                onClick={() => {
                  decide(sup.id, rating, sl, reason.trim(), false);
                  setDecline(false);
                  toast(`${sup.name} declined`, reason.trim(), undefined, 'info');
                }}
              >
                Decline supplier
              </Button>
            </>
          }
        >
          <Field label="Reason (written to the audit log)">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the supplier is declined" />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
