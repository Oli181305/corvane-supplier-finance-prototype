import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Notice, PageHeader, Skeleton, Status, Table, Tabs } from '../../components/ui';
import { effectiveSupplierId, useCurrentUser, useStore } from '../../store/store';
import { useReadOnly } from '../../store/selectors';
import { fmtDate } from '../../logic/format';
import { toast } from '../../store/toast';

const STEPS = ['Company details', 'Owners and signers', 'Bank account', 'Documents'];

export default function Onboarding() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const readOnly = useReadOnly();
  const supplierId = effectiveSupplierId(user, viewAs);
  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const submit = useStore((s) => s.submitRegistration);
  const advance = useStore((s) => s.advanceCheck);
  const [tab, setTab] = useState<'registration' | 'checks'>(supplier?.onboardingStatus === 'Nominated' || supplier?.onboardingStatus === 'Registering' ? 'registration' : 'checks');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    ein: supplier?.ein ?? '',
    address: supplier?.address ?? '',
    state: supplier?.stateOfIncorporation ?? '',
    owner: supplier?.owners?.[0]?.name ?? '',
    ownerPct: String(supplier?.owners?.[0]?.pct ?? 100),
    signer: supplier?.signers?.[0]?.name ?? '',
    signerTitle: supplier?.signers?.[0]?.title ?? '',
    bank: supplier?.bankAccount.bank ?? '',
    account: supplier?.bankAccount.last4 ? `0001000${supplier.bankAccount.last4}` : '',
    routing: '043000096',
  });
  const [ocr, setOcr] = useState<'idle' | 'reading' | 'done'>(supplier?.documents?.length ? 'done' : 'idle');

  // Run the checks one by one while the checks tab is open.
  const running = supplier?.onboardingStatus === 'Checks running';
  useEffect(() => {
    if (!running || tab !== 'checks' || !supplier) return;
    const t = setInterval(() => {
      const more = advance(supplier.id);
      if (!more) clearInterval(t);
    }, 900);
    return () => clearInterval(t);
  }, [running, tab, supplier?.id, advance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supplier) return null;
  if (supplier.onboardingStatus === 'Enrolled') {
    return (
      <div>
        <PageHeader title="Onboarding" />
        <Notice kind="success">{supplier.name} is enrolled. Approved invoices are offered for early payment.</Notice>
      </div>
    );
  }
  const canEdit = !readOnly;

  const stepBar = (
    <div className="mb-5 flex gap-6 text-sm">
      {STEPS.map((s, i) => (
        <button key={s} type="button" onClick={() => setStep(i)} className={`num ${i === step ? 'font-semibold text-ink' : i < step ? 'text-ink' : 'text-grey'}`}>
          {i + 1}. {s}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Onboarding"
        context={
          <span className="flex items-center gap-3">
            <span>Nominated by Kaltrex on {fmtDate(supplier.nominatedOn)} · Supplier to Kaltrex since {supplier.supplierSince}</span>
            <Status status={supplier.onboardingStatus} />
          </span>
        }
      />
      <Tabs tabs={[{ id: 'registration', label: 'Registration' }, { id: 'checks', label: 'Checks', count: supplier.checks.length }]} active={tab} onChange={setTab} />

      {tab === 'registration' ? (
        <Card>
          {stepBar}
          {step === 0 ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Legal name"><Input value={form.name} disabled={!canEdit} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="EIN"><Input value={form.ein} disabled={!canEdit} onChange={(e) => setForm({ ...form, ein: e.target.value })} /></Field>
              <Field label="Address" className="col-span-2"><Input value={form.address} disabled={!canEdit} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              <Field label="State of incorporation"><Input value={form.state} disabled={!canEdit} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Beneficial owner above 25%"><Input value={form.owner} disabled={!canEdit} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
              <Field label="Ownership %"><Input value={form.ownerPct} disabled={!canEdit} onChange={(e) => setForm({ ...form, ownerPct: e.target.value })} /></Field>
              <Field label="Authorized signer"><Input value={form.signer} disabled={!canEdit} onChange={(e) => setForm({ ...form, signer: e.target.value })} /></Field>
              <Field label="Title"><Input value={form.signerTitle} disabled={!canEdit} onChange={(e) => setForm({ ...form, signerTitle: e.target.value })} /></Field>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank name"><Input value={form.bank} disabled={!canEdit} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></Field>
              <Field label="Routing number"><Input value={form.routing} disabled={!canEdit} onChange={(e) => setForm({ ...form, routing: e.target.value })} /></Field>
              <Field label="Account number"><Input value={form.account} disabled={!canEdit} onChange={(e) => setForm({ ...form, account: e.target.value })} /></Field>
            </div>
          ) : null}
          {step === 3 ? (
            <div>
              <div className="flex h-32 cursor-pointer items-center justify-center rounded border border-dashed border-border bg-tint text-grey hover:border-teal-dark" onClick={() => { if (!canEdit) return; setOcr('reading'); setTimeout(() => setOcr('done'), 700); }}>
                {ocr === 'reading' ? 'Reading documents with OCR' : 'Click to upload incorporation papers and signer IDs (any file in the prototype)'}
              </div>
              {ocr === 'reading' ? <div className="mt-4"><Skeleton rows={3} /></div> : null}
              {ocr === 'done' ? (
                <div className="mt-4">
                  <div className="label mb-2">Read by OCR</div>
                  <Table
                    rows={[
                      { f: 'Legal name', v: form.name, s: 'Certificate of organization' },
                      { f: 'State of incorporation', v: form.state, s: 'Certificate of organization' },
                      { f: 'Signer name', v: form.signer, s: 'Signer ID' },
                      { f: 'ID expiry', v: '14 Mar 2031', s: 'Signer ID' },
                    ]}
                    rowKey={(r) => r.f}
                    dense
                    columns={[{ key: 'f', header: 'Field', render: (r) => r.f }, { key: 'v', header: 'Value', render: (r) => r.v }, { key: 's', header: 'Source', render: (r) => <span className="text-grey">{r.s}</span> }]}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
            {step < 3 ? (
              <Button variant="primary" onClick={() => setStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button
                variant="primary"
                disabled={!canEdit || ocr !== 'done'}
                title={ocr !== 'done' ? 'Upload the documents first' : undefined}
                onClick={() => {
                  submit(supplier.id, {
                    name: form.name,
                    ein: form.ein,
                    address: form.address,
                    stateOfIncorporation: form.state,
                    owners: [{ name: form.owner, pct: Number(form.ownerPct) || 100 }],
                    signers: [{ name: form.signer, title: form.signerTitle }],
                    bankAccount: { bank: form.bank, last4: form.account.slice(-4), verified: false },
                    documents: [
                      { name: 'Certificate of organization.pdf', uploadedOn: data.today, readBy: 'OCR' },
                      { name: `Signer ID ${form.signer}.pdf`, uploadedOn: data.today, readBy: 'OCR' },
                    ],
                  });
                  toast('Registration submitted', 'The automatic checks are running.', undefined, 'info');
                  setTab('checks');
                }}
              >
                Submit
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card title="Automatic checks" pad={false}>
          <Table
            rows={supplier.checks}
            rowKey={(c) => c.name}
            empty="The checks start when the registration is submitted."
            columns={[
              { key: 'n', header: 'Check', render: (c) => c.name },
              { key: 's', header: 'Source', render: (c) => <span className="text-grey">{c.source}</span> },
              { key: 'r', header: 'Result', render: (c) => (c.result === 'Running' ? <div className="w-24"><Skeleton rows={1} /></div> : <Status status={c.result} reason={c.result !== 'Pending' ? c.detail : undefined} />) },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
