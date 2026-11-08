import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSearch,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquareWarning,
  Receipt,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { effectivePortal, effectiveSupplierId, portalKey, useCurrentUser, useStore } from '../store/store';
import { fmtDate, fmtTime } from '../logic/format';
import { Button, Toasts } from './ui';
import { toast } from '../store/toast';

type NavItem = { to: string; label: string; icon: LucideIcon; count?: number };

function Wordmark({ light = true }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${light ? 'text-white' : 'text-ink'}`}>
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-teal" />
      Corvane Bank
    </span>
  );
}

export { Wordmark };

function Menu({ button, children, align = 'right', width = 320, label }: { button: React.ReactNode; children: (close: () => void) => React.ReactNode; align?: 'left' | 'right'; width?: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} onClick={() => setOpen((o) => !o)} className="flex h-9 items-center gap-1.5 rounded px-2 text-sm text-white hover:bg-[rgba(255,255,255,0.08)]">
        {button}
      </button>
      {open ? (
        <div className={`absolute top-10 z-30 rounded border border-border bg-panel text-ink shadow-modal ${align === 'right' ? 'right-0' : 'left-0'}`} style={{ width }}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export default function Shell() {
  const user = useCurrentUser();
  const viewAs = useStore((s) => s.viewAs);
  const data = useStore((s) => s.data);
  const entityFilter = useStore((s) => s.entityFilter);
  const reportingCurrency = useStore((s) => s.reportingCurrency);
  const setEntityFilter = useStore((s) => s.setEntityFilter);
  const setReportingCurrency = useStore((s) => s.setReportingCurrency);
  const setViewAs = useStore((s) => s.setViewAs);
  const switchUser = useStore((s) => s.switchUser);
  const signOut = useStore((s) => s.signOut);
  const markRead = useStore((s) => s.markNotificationsRead);
  const navigate = useNavigate();
  const location = useLocation();

  const portal = effectivePortal(user, viewAs);
  const supplierId = effectiveSupplierId(user, viewAs);
  const supplier = data.suppliers.find((s) => s.id === supplierId);

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  // Keep the URL inside the active portal.
  useEffect(() => {
    if (!portal) return;
    const seg = location.pathname.split('/')[1];
    if (seg !== portal) {
      const landing = portal === 'kaltrex' ? '/kaltrex/overview' : portal === 'supplier' ? (supplier && supplier.onboardingStatus !== 'Enrolled' ? '/supplier/onboarding' : '/supplier/offered') : '/bank/overview';
      navigate(landing, { replace: true });
    }
  }, [portal, location.pathname, navigate, supplier]);

  if (!user || !portal) return null;

  const readOnly = !!viewAs;
  const pkey = portalKey(user, viewAs);
  const notifications = data.notifications.filter((n) => n.portal === pkey);
  const unread = notifications.filter((n) => !n.read).length;

  const inApproval = data.invoices.filter((i) => i.status === 'In approval' && (entityFilter === 'all' || i.entityId === entityFilter)).length;
  const openDisputes = (party: 'kaltrex' | 'supplier' | 'bank') =>
    data.disputes.filter((x) => x.status === 'Open' && (party === 'bank' || party === 'kaltrex' || data.invoices.find((i) => i.id === x.invoiceId)?.supplierId === supplierId)).length;

  let nav: NavItem[] = [];
  let portalName = '';
  if (portal === 'kaltrex') {
    portalName = 'Kaltrex Workspace';
    nav = [
      { to: '/kaltrex/overview', label: 'Overview', icon: LayoutDashboard },
      { to: '/kaltrex/approvals', label: 'Approval queue', icon: ClipboardCheck, count: inApproval },
      { to: '/kaltrex/obligations', label: 'Obligations', icon: CalendarClock },
      { to: '/kaltrex/suppliers', label: 'Suppliers', icon: Building2 },
      { to: '/kaltrex/disputes', label: 'Disputes', icon: MessageSquareWarning, count: openDisputes('kaltrex') },
      { to: '/kaltrex/reports', label: 'Reports', icon: FileText },
      { to: '/kaltrex/settings', label: 'Program settings', icon: Settings },
    ];
  } else if (portal === 'supplier') {
    portalName = 'Supplier Portal';
    const offered = data.invoices.filter((i) => i.supplierId === supplierId && i.status === 'Offered').length;
    const enrolled = supplier?.onboardingStatus === 'Enrolled';
    nav = [
      { to: '/supplier/offered', label: 'Offered invoices', icon: Inbox, count: offered },
      { to: '/supplier/invoices', label: 'All invoices', icon: Receipt },
      { to: '/supplier/payments', label: 'Payments', icon: Wallet },
      { to: '/supplier/standing', label: 'Standing instruction', icon: ListChecks },
      { to: '/supplier/disputes', label: 'Disputes', icon: MessageSquareWarning, count: openDisputes('supplier') },
      { to: '/supplier/profile', label: 'Company profile', icon: Building2 },
    ];
    if (!enrolled) nav.push({ to: '/supplier/onboarding', label: 'Onboarding', icon: ClipboardList });
  } else {
    portalName = 'Bank Staff Screen';
    const held = data.invoices.filter((i) => i.status === 'Held').length;
    const onboarding = data.suppliers.filter((s) => s.onboardingStatus !== 'Enrolled' && s.onboardingStatus !== 'Declined').length;
    const alerts = data.alerts.filter((a) => a.status === 'Open').length;
    nav = [
      { to: '/bank/overview', label: 'Program overview', icon: LayoutDashboard },
      { to: '/bank/onboarding', label: 'Onboarding queue', icon: ClipboardList, count: onboarding },
      { to: '/bank/review', label: 'Review queue', icon: FileSearch, count: held },
      { to: '/bank/payments', label: 'Payments', icon: CreditCard },
      { to: '/bank/settlement', label: 'Settlement', icon: CalendarClock },
      { to: '/bank/alerts', label: 'Early warnings', icon: AlertTriangle, count: alerts },
      { to: '/bank/disputes', label: 'Disputes', icon: MessageSquareWarning, count: openDisputes('bank') },
      { to: '/bank/audit', label: 'Audit log', icon: BarChart3 },
      { to: '/bank/config', label: 'Program configuration', icon: Settings },
    ];
  }

  const userGroups = [
    { label: 'Kaltrex', users: data.users.filter((u) => u.portal === 'kaltrex') },
    { label: 'Supplier', users: data.users.filter((u) => u.portal === 'supplier') },
    { label: 'Bank', users: data.users.filter((u) => u.portal === 'bank') },
  ];

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-ink px-4 text-white">
        <div className="flex items-center gap-4">
          <Wordmark />
          <span aria-hidden className="h-5 w-px bg-[rgba(255,255,255,0.25)]" />
          <span className="text-sm text-[rgba(255,255,255,0.75)]">Corporate Internet Banking</span>
        </div>
        <div className="text-sm font-medium">{portalName}</div>
        <div className="flex items-center gap-1">
          {portal === 'kaltrex' ? (
            <Menu
              width={260}
              label="Entity switcher"
              button={
                <>
                  <span className="text-[rgba(255,255,255,0.75)]">Entity</span>
                  <span>{entityFilter === 'all' ? 'All entities' : data.entities.find((e) => e.id === entityFilter)?.short}</span>
                  <ChevronDown size={14} />
                </>
              }
            >
              {(close) => (
                <ul className="py-1 text-base">
                  {[{ id: 'all', name: 'All entities' }, ...data.entities].map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => { setEntityFilter(e.id); close(); }} className={`block w-full px-4 py-2 text-left hover:bg-hover ${entityFilter === e.id ? 'font-semibold' : ''}`}>
                        {e.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Menu>
          ) : null}
          {portal !== 'bank' ? (
            <Menu
              width={200}
              label="Reporting currency"
              button={
                <>
                  <span>{reportingCurrency === 'USD' ? 'USD' : 'Local'}</span>
                  <ChevronDown size={14} />
                </>
              }
            >
              {(close) => (
                <ul className="py-1 text-base">
                  <li><button type="button" onClick={() => { setReportingCurrency('USD'); close(); }} className="block w-full px-4 py-2 text-left hover:bg-hover">Report in USD</button></li>
                  <li><button type="button" onClick={() => { setReportingCurrency('local'); close(); }} className="block w-full px-4 py-2 text-left hover:bg-hover">Report in local currency</button></li>
                </ul>
              )}
            </Menu>
          ) : null}
          {portal === 'bank' && user.roleKey === 'admin' ? (
            <Menu
              width={300}
              label="View as"
              button={
                <>
                  <span>View as</span>
                  <ChevronDown size={14} />
                </>
              }
            >
              {(close) => (
                <ul className="py-1 text-base">
                  <li><button type="button" onClick={() => { setViewAs({ portal: 'kaltrex' }); close(); }} className="block w-full px-4 py-2 text-left hover:bg-hover">Kaltrex workspace</button></li>
                  {data.suppliers.filter((s) => s.onboardingStatus === 'Enrolled').map((s) => (
                    <li key={s.id}><button type="button" onClick={() => { setViewAs({ portal: 'supplier', supplierId: s.id }); close(); }} className="block w-full px-4 py-2 text-left hover:bg-hover">{s.name} portal</button></li>
                  ))}
                </ul>
              )}
            </Menu>
          ) : null}
          <Menu
            width={420}
            label="Notifications"
            button={
              <>
                <Bell size={16} />
                <span className="num text-sm">{unread}</span>
              </>
            }
          >
            {(close) => (
              <div>
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <span className="text-md font-semibold">Notifications</span>
                  <button type="button" className="text-xs text-grey hover:text-ink" onClick={() => markRead(pkey)}>Mark all read</button>
                </div>
                <ul className="max-h-[420px] overflow-y-auto">
                  {notifications.length === 0 ? <li className="px-4 py-6 text-sm text-grey">No notifications. Approvals, payments and disputes appear here.</li> : null}
                  {notifications.map((n) => (
                    <li key={n.id} className="border-b border-border last:border-0">
                      <button type="button" onClick={() => { markRead(pkey); close(); navigate(n.link); }} className="block w-full px-4 py-3 text-left hover:bg-hover">
                        <div className="flex items-start gap-2">
                          <span aria-hidden className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-sm ${n.read ? 'bg-border' : 'bg-teal-dark'}`} />
                          <div>
                            <div className="text-sm">{n.text}</div>
                            <div className="num mt-0.5 text-xs text-grey">{fmtTime(n.at)}</div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Menu>
          <Menu
            width={320}
            label="User menu"
            button={
              <>
                <span className="text-left leading-tight">
                  <span className="block">{user.name}</span>
                  <span className="block text-xs text-[rgba(255,255,255,0.65)]">{user.role}</span>
                </span>
                <ChevronDown size={14} />
              </>
            }
          >
            {(close) => (
              <div className="py-1 text-base">
                <button type="button" onClick={() => { close(); toast('Profile', `${user.name}. ${user.role}. ${user.companyId}. Registered phone ends ${user.phoneLast4}.`, undefined, 'info'); }} className="block w-full px-4 py-2 text-left hover:bg-hover">Profile</button>
                <div className="border-t border-border px-4 pb-1 pt-2 text-xs uppercase tracking-[0.04em] text-grey">Switch user (demo)</div>
                {userGroups.map((g) => (
                  <div key={g.label}>
                    <div className="px-4 pt-1 text-xs text-grey">{g.label}</div>
                    {g.users.map((u) => (
                      <button key={u.id} type="button" onClick={() => { close(); switchUser(u.id); navigate(u.landing); }} className={`block w-full px-4 py-1.5 text-left text-sm hover:bg-hover ${u.id === user.id ? 'font-semibold' : ''}`}>
                        {u.name} <span className="text-grey">· {u.role}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="mt-1 border-t border-border">
                  <button type="button" onClick={() => { close(); signOut(); navigate('/login'); }} className="block w-full px-4 py-2 text-left hover:bg-hover">Sign out</button>
                </div>
              </div>
            )}
          </Menu>
        </div>
      </header>

      {readOnly ? (
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-amber bg-amber-tint px-4 text-sm">
          <span>
            Viewing as {portal === 'kaltrex' ? 'Kaltrex Industries Inc.' : supplier?.name}. Read only.
          </span>
          <Button variant="link" onClick={() => { setViewAs(null); navigate('/bank/overview'); }}>Return to bank staff screen</Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Left nav */}
        <nav className="flex w-[220px] shrink-0 flex-col border-r border-border bg-panel">
          <ul className="py-2">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `relative flex h-10 items-center gap-3 pl-5 pr-4 text-base ${isActive ? 'font-semibold text-ink' : 'text-ink hover:bg-hover'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-teal" /> : null}
                      <item.icon size={16} className="shrink-0 text-grey" />
                      <span className="flex-1">{item.label}</span>
                      {item.count ? <span className="num text-sm text-grey">{item.count}</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <DemoControls />
          </div>
        </nav>

        {/* Working area */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-page">
          <div className="mx-auto min-w-[1000px] max-w-[1400px] px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Toasts />
    </div>
  );
}

function DemoControls() {
  const [open, setOpen] = useState(false);
  const data = useStore((s) => s.data);
  const user = useCurrentUser();
  const switchUser = useStore((s) => s.switchUser);
  const resetDemo = useStore((s) => s.resetDemo);
  const advance = useStore((s) => s.advanceToDueDate);
  const failDebit = useStore((s) => s.simulateFailedDebit);
  const dup = useStore((s) => s.simulateDuplicate);
  const navigate = useNavigate();
  const portal = effectivePortal(user, useStore((s) => s.viewAs));

  return (
    <div className="border-t border-border px-5 py-3 text-xs text-grey">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between hover:text-ink">
        <span>Demo controls</span>
        <ChevronDown size={12} className={open ? 'rotate-180' : ''} />
      </button>
      <div className="num mt-1 text-xs text-grey">Demo date {fmtDate(data.today)}</div>
      {open ? (
        <div className="mt-2 space-y-1.5">
          <div>
            <select
              className="w-full rounded border border-border bg-white px-1 py-1 text-xs text-ink"
              value={user?.id ?? ''}
              onChange={(e) => {
                const u = data.users.find((x) => x.id === e.target.value);
                if (u) {
                  switchUser(u.id);
                  navigate(u.landing);
                }
              }}
            >
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="block hover:text-ink hover:underline" onClick={() => { resetDemo(); toast('Demo data reset', 'Seed data restored. The demo date is 16 Nov 2026.', undefined, 'info'); }}>Reset demo data</button>
          <button
            type="button"
            className="block hover:text-ink hover:underline"
            onClick={() => {
              const r = advance();
              if (!r) toast('No due date to advance to', 'There are no early-paid invoices with a future due date.', undefined, 'info');
              else {
                toast(r.result === 'Success' ? `Settled ${fmtDate(r.date)}` : `Debit failed ${fmtDate(r.date)}`, `Demo date moved to ${fmtDate(r.date)}. Due-date debit USD ${Math.round(r.total).toLocaleString('en-US')}.`, portal === 'bank' ? { to: '/bank/settlement', label: 'Open settlement' } : { to: '/kaltrex/obligations', label: 'Open obligations' }, r.result === 'Success' ? 'success' : 'error');
              }
            }}
          >
            Advance to due date
          </button>
          <button type="button" className="block hover:text-ink hover:underline" onClick={() => { failDebit(); toast('Next debit will fail', 'Use Advance to due date to run the settlement.', undefined, 'info'); }}>Simulate failed debit</button>
          <button
            type="button"
            className="block hover:text-ink hover:underline"
            onClick={() => {
              dup();
              toast('Duplicate invoice captured', 'A second copy of OH-48211 was held by the rules engine.', portal === 'bank' ? { to: '/bank/review', label: 'Open review queue' } : undefined, 'info');
            }}
          >
            Simulate duplicate invoice
          </button>
        </div>
      ) : null}
    </div>
  );
}
