import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wordmark } from '../components/Shell';
import { Button, Field, Input, TwoFactor } from '../components/ui';
import { useCurrentUser, useStore } from '../store/store';

export default function Login() {
  const users = useStore((s) => s.data.users);
  const beginLogin = useStore((s) => s.beginLogin);
  const completeLogin = useStore((s) => s.completeLogin);
  const pendingUserId = useStore((s) => s.pendingUserId);
  const current = useCurrentUser();
  const navigate = useNavigate();

  const [selected, setSelected] = useState(users.find((u) => u.id === 'mark')!);
  const [companyId, setCompanyId] = useState(selected.companyId);
  const [userId, setUserId] = useState(selected.userId);
  const [password, setPassword] = useState('demo-password');
  const [stage, setStage] = useState<'form' | '2fa'>('form');

  useEffect(() => {
    if (current && stage === 'form' && !pendingUserId) navigate(current.landing, { replace: true });
  }, [current, navigate, stage, pendingUserId]);

  const choose = (id: string) => {
    const u = users.find((x) => x.id === id)!;
    setSelected(u);
    setCompanyId(u.companyId);
    setUserId(u.userId);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const match = users.find((u) => u.userId.toLowerCase() === userId.trim().toLowerCase() && u.companyId.toLowerCase() === companyId.trim().toLowerCase()) ?? selected;
    setSelected(match);
    beginLogin(match.id);
    setStage('2fa');
  };

  const groups: { label: string; ids: string[] }[] = [
    { label: 'Kaltrex', ids: ['rachel', 'dana', 'mark'] },
    { label: 'Supplier', ids: ['tom', 'lisa', 'nora'] },
    { label: 'Bank', ids: ['priya', 'ellen', 'james', 'sam'] },
  ];

  return (
    <div className="flex min-h-screen items-start justify-center bg-page px-4 pt-20">
      <div className="w-full max-w-[560px] rounded border border-border bg-panel p-8">
        <Wordmark light={false} />
        <h1 className="mt-6 text-lg font-semibold">Sign in to Corporate Internet Banking</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Company ID">
            <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="User ID">
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex justify-end pt-2">
            <Button variant="primary" type="submit">Continue</Button>
          </div>
        </form>

        <div className="mt-8 border-t border-border pt-5">
          <div className="label mb-3">Demo: choose a user</div>
          <div className="space-y-2 text-sm">
            {groups.map((g) => (
              <div key={g.label} className="grid grid-cols-[72px_1fr] gap-2">
                <div className="pt-0.5 text-grey">{g.label}</div>
                <div className="flex flex-wrap gap-x-1 gap-y-1">
                  {g.ids.map((id, i) => {
                    const u = users.find((x) => x.id === id)!;
                    const extra = u.supplierId === 'mercer' ? 'Mercer, ' : u.supplierId === 'ridgeway' ? 'Ridgeway, ' : '';
                    return (
                      <span key={id}>
                        <button type="button" onClick={() => choose(id)} className={`text-left hover:underline ${selected.id === id ? 'font-semibold text-teal-dark' : 'text-ink'}`}>
                          {u.name} ({extra}{u.role.toLowerCase()})
                        </button>
                        {i < g.ids.length - 1 ? <span className="mx-1 text-grey">·</span> : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stage === '2fa' ? (
        <TwoFactor
          phoneLast4={selected.phoneLast4}
          purpose="Enter the 6-digit code sent to your registered phone."
          onCancel={() => setStage('form')}
          onConfirm={() => {
            completeLogin();
            navigate(selected.landing, { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}
