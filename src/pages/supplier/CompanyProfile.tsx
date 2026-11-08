import { useState } from 'react';
import { Button, Card, Field, Input, KV, Modal, Notice, PageHeader, Status, Table, TwoFactor } from '../../components/ui';
import { effectiveSupplierId, useCurrentUser, useStore } from '../../store/store';
import { useReadOnly } from '../../store/selectors';
import { fmtDate } from '../../logic/format';
import { toast } from '../../store/toast';

export default function CompanyProfile() {
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const readOnly = useReadOnly();
  const supplierId = effectiveSupplierId(user, viewAs);
  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const change = useStore((s) => s.requestBankAccountChange);
  const [stage, setStage] = useState<'none' | 'form' | '2fa' | 'done'>('none');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  if (!supplier) return null;
  const canChange = !readOnly && user?.roleKey === 'supplierFinance';
  const entity = data.entities.find((e) => e.id === supplier.kaltrexEntityId);

  return (
    <div>
      <PageHeader title="Company profile" context={`${supplier.name} · Supplier to ${entity?.name} since ${supplier.supplierSince ?? ''}`} />
      <div className="grid grid-cols-2 gap-4">
        <Card title="Company details">
          <KV
            rows={[
              ['Legal name', supplier.name],
              ['EIN', supplier.ein ?? '—'],
              ['Address', supplier.address ?? supplier.city],
              ['State of incorporation', supplier.stateOfIncorporation ?? '—'],
              ['Kaltrex entity', entity?.name ?? ''],
              ['Program status', <Status key="s" status={supplier.onboardingStatus} />],
              ['Rating', supplier.rating ?? 'Not yet rated'],
              ['Invoice currency', supplier.currency],
            ]}
          />
        </Card>
        <Card title="Bank account" right={<Button variant="secondary" size="sm" disabled={!canChange} title={!canChange ? (readOnly ? 'Read only while viewing as a supplier' : 'Only the supplier finance manager can change the bank account') : undefined} onClick={() => setStage('form')}>Change bank account</Button>}>
          <KV
            rows={[
              ['Bank', supplier.bankAccount.bank || '—'],
              ['Account', supplier.bankAccount.last4 ? `···${supplier.bankAccount.last4}` : '—'],
              ['Status', <Status key="v" status={supplier.bankAccount.verified ? 'Verified' : 'Held for verification'} />],
              ...(supplier.bankAccount.changedOn ? [['Changed', fmtDate(supplier.bankAccount.changedOn)] as [string, string]] : []),
            ]}
          />
          {!supplier.bankAccount.verified ? (
            <Notice kind="warning" className="mt-4">
              New account held for verification. Invoices paid to this account are held for review for {data.config.bankChangeDays} days.
            </Notice>
          ) : null}
        </Card>
        <Card title="Authorized signers" pad={false}>
          <Table rows={supplier.signers ?? []} rowKey={(s) => s.name} empty="No signers on file." columns={[{ key: 'n', header: 'Name', render: (s) => s.name }, { key: 't', header: 'Title', render: (s) => s.title }]} />
        </Card>
        <Card title="Users" pad={false}>
          <Table rows={supplier.users ?? []} rowKey={(u) => u.name} empty="No users." columns={[{ key: 'n', header: 'Name', render: (u) => u.name }, { key: 'r', header: 'Role', render: (u) => u.role }, { key: 'f', header: '2FA', render: () => <span className="num">Phone ···4471</span> }]} />
        </Card>
      </div>

      {stage === 'form' ? (
        <Modal
          title="Change bank account"
          onClose={() => setStage('none')}
          width={520}
          footer={
            <>
              <Button variant="secondary" onClick={() => setStage('none')}>Cancel</Button>
              <Button variant="primary" disabled={!bank.trim() || account.replace(/\D/g, '').length < 4} onClick={() => setStage('2fa')}>Continue</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Bank name"><Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Huntington National Bank" /></Field>
            <Field label="Account number" hint="Demo. Any digits are accepted."><Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="000123456789" /></Field>
            <Notice kind="info">The change needs 2FA. The new account is held for verification and invoices paid to it are held for review for {data.config.bankChangeDays} days. Corvane Bank operations receives an alert.</Notice>
          </div>
        </Modal>
      ) : null}
      {stage === '2fa' ? (
        <TwoFactor
          purpose={`Change payout account to ${bank} ···${account.replace(/\D/g, '').slice(-4)}.`}
          onCancel={() => setStage('form')}
          onConfirm={() => {
            change(supplier.id, bank.trim(), account.replace(/\D/g, '').slice(-4));
            setStage('none');
            toast('New account held for verification', `Invoices paid to this account are held for review for ${data.config.bankChangeDays} days.`, undefined, 'info');
          }}
        />
      ) : null}
    </div>
  );
}
