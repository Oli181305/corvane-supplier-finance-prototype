import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { money, moneyFull } from '../logic/format';
import { useToast } from '../store/toast';

/* ---------- Status shape indicator (Carbon pattern). No pills anywhere. ---------- */

const STATUS_COLORS: Record<string, string> = {
  Received: '#5B6479',
  Validated: '#3B82F6',
  Held: '#D97706',
  'In approval': '#7C4DFF',
  Approved: '#6D28D9',
  Offered: '#00897F',
  'Paid early': '#16A34A',
  Disputed: '#DC2626',
  Settled: '#0B0F1A',
  Rejected: '#DC2626',
  // checks and cases
  Passed: '#16A34A',
  Failed: '#DC2626',
  Review: '#D97706',
  Running: '#3B82F6',
  Pending: '#5B6479',
  Variance: '#D97706',
  Matched: '#16A34A',
  // onboarding
  Nominated: '#5B6479',
  Registering: '#3B82F6',
  'Checks running': '#3B82F6',
  'Checks failed': '#DC2626',
  'Awaiting credit decision': '#D97706',
  'Awaiting signature': '#7C4DFF',
  Enrolled: '#16A34A',
  Declined: '#DC2626',
  // generic
  Open: '#D97706',
  Closed: '#0B0F1A',
  Resolved: '#16A34A',
  Sent: '#16A34A',
  Returned: '#DC2626',
  Success: '#16A34A',
  Done: '#16A34A',
  Due: '#D97706',
  Strong: '#16A34A',
  Adequate: '#D97706',
  Weak: '#DC2626',
  On: '#16A34A',
  Off: '#5B6479',
  Verified: '#16A34A',
  'Held for verification': '#D97706',
};

export function Status({ status, reason, className = '' }: { status: string; reason?: string; className?: string }) {
  const color = STATUS_COLORS[status] ?? '#5B6479';
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
        <span className="text-ink">{status}</span>
      </div>
      {reason ? <div className="max-w-[340px] whitespace-normal pl-4 text-xs leading-4 text-grey">{reason}</div> : null}
    </div>
  );
}

/* ---------- Buttons ---------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'destructive' | 'link' | 'quiet';
  size?: 'md' | 'sm';
};

export function Button({ variant = 'secondary', size = 'md', className = '', disabled, title, children, ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded font-medium whitespace-nowrap select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed';
  const sizes = size === 'sm' ? 'h-7 px-2.5 text-sm' : 'h-9 px-4 text-base';
  const variants: Record<string, string> = {
    primary: 'bg-teal-dark text-white hover:bg-[#007a71] disabled:bg-[#9CC9C5]',
    secondary: 'bg-white text-ink border border-border hover:bg-hover disabled:text-grey disabled:bg-tint',
    destructive: 'bg-white text-red border border-red hover:bg-red-tint disabled:opacity-50',
    link: 'h-auto px-0 text-teal-dark hover:underline font-medium disabled:text-grey disabled:no-underline',
    quiet: 'h-auto px-0 text-xs text-grey hover:text-ink hover:underline font-normal',
  };
  return (
    <button type="button" className={`${base} ${variant === 'link' || variant === 'quiet' ? '' : sizes} ${variants[variant]} ${className}`} disabled={disabled} title={title} {...rest}>
      {children}
    </button>
  );
}

export function LinkText({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={`font-medium text-teal-dark hover:underline ${className}`}>
      {children}
    </Link>
  );
}

/* ---------- Layout primitives ---------- */

export function Card({ title, right, children, className = '', pad = true }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded border border-border bg-panel ${className}`}>
      {title || right ? (
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          {typeof title === 'string' ? <h2 className="text-md font-semibold">{title}</h2> : title}
          {right}
        </header>
      ) : null}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function Tile({ label, value, sub, bar, onClick, to, className = '' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; bar?: number; onClick?: () => void; to?: string; className?: string }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="num mt-2 text-xl font-semibold leading-8">{value}</div>
      {sub ? <div className="mt-1 text-sm text-grey">{sub}</div> : null}
      {bar !== undefined ? (
        <div className="mt-3 h-1.5 w-full bg-border">
          <div className="h-1.5 bg-teal-dark" style={{ width: `${Math.min(100, Math.max(0, bar * 100))}%` }} />
        </div>
      ) : null}
    </>
  );
  const cls = `block rounded border border-border bg-panel p-4 text-left ${onClick || to ? 'hover:border-teal-dark cursor-pointer' : ''} ${className}`;
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full`}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function PageHeader({ title, context, actions, crumbs }: { title: React.ReactNode; context?: React.ReactNode; actions?: React.ReactNode; crumbs?: { label: string; to?: string }[] }) {
  return (
    <div className="mb-6">
      {crumbs ? (
        <div className="mb-2 text-sm text-grey">
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 ? <span className="mx-1.5">/</span> : null}
              {c.to ? <Link to={c.to} className="hover:underline">{c.label}</Link> : <span className="text-ink">{c.label}</span>}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {context ? <div className="mt-1 text-sm text-grey">{context}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-md font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function Notice({ kind = 'info', children, className = '' }: { kind?: 'info' | 'warning' | 'error' | 'success'; children: React.ReactNode; className?: string }) {
  const colors = { info: 'border-blue', warning: 'border-amber bg-amber-tint', error: 'border-red bg-red-tint', success: 'border-green' }[kind];
  return <div className={`rounded border border-l-4 border-border bg-panel px-4 py-3 text-base ${colors} ${className}`}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-grey">{children}</div>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-border" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

/* ---------- Money ---------- */

export function Money({ amount, currency, full = false, className = '' }: { amount: number; currency: string; full?: boolean; className?: string }) {
  return <span className={`num ${className}`}>{full ? moneyFull(amount, currency) : money(amount, currency)}</span>;
}

/* ---------- Key-value list ---------- */

export function KV({ rows, className = '' }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={`grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-base ${className}`}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt className="text-grey">{k}</dt>
          <dd className="num">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/* ---------- Forms ---------- */

export function Field({ label, children, hint, className = '' }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="label mb-1.5">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-xs text-grey">{hint}</div> : null}
    </label>
  );
}

const inputCls = 'h-9 w-full rounded border border-border bg-white px-3 text-base text-ink focus:border-teal-dark focus:outline-none disabled:bg-tint disabled:text-grey num';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`${inputCls} ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <select {...rest} className={`${inputCls} pr-8 ${className}`}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea {...rest} className={`w-full rounded border border-border bg-white px-3 py-2 text-base text-ink focus:border-teal-dark focus:outline-none ${className}`} />;
}

export function Radio({ checked, onChange, label, children, disabled }: { checked: boolean; onChange: () => void; label: React.ReactNode; children?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 py-2 ${disabled ? 'text-grey' : ''}`}>
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="min-w-[280px]">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Tabs ---------- */

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; count?: number }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-4 flex gap-6 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 pb-2.5 pt-1 text-base ${active === t.id ? 'border-teal font-semibold text-ink' : 'border-transparent text-grey hover:text-ink'}`}
        >
          {t.label}
          {t.count !== undefined ? <span className="num ml-2 text-grey">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---------- Table ---------- */

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = 'Nothing to show.',
  selectable,
  selected,
  onToggle,
  onToggleAll,
  isSelectable,
  dense = false,
  footer,
  initialSort,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (key: string) => void;
  onToggleAll?: (keys: string[]) => void;
  isSelectable?: (row: T) => boolean;
  dense?: boolean;
  footer?: React.ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = sv(a);
      const y = sv(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const selectableKeys = rows.filter((r) => !isSelectable || isSelectable(r)).map(rowKey);
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selected?.has(k));
  const rowH = dense ? 'h-9' : 'h-10';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {selectable ? (
              <th className="w-10 px-3 text-left">
                <input type="checkbox" checked={allSelected} onChange={() => onToggleAll?.(allSelected ? [] : selectableKeys)} aria-label="Select all" />
              </th>
            ) : null}
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={`label h-9 whitespace-nowrap px-3 font-medium ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'} ${c.sortValue ? 'cursor-pointer select-none hover:text-ink' : ''}`}
                  onClick={() => c.sortValue && setSort(active && sort?.dir === 'asc' ? { key: c.key, dir: 'desc' } : { key: c.key, dir: 'asc' })}
                >
                  {c.header}
                  {active ? <span className="ml-1 normal-case">{sort?.dir === 'asc' ? '↑' : '↓'}</span> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                <Empty>{empty}</Empty>
              </td>
            </tr>
          ) : (
            sorted.map((r) => {
              const k = rowKey(r);
              const canSelect = !isSelectable || isSelectable(r);
              return (
                <tr key={k} className={`border-b border-border ${onRowClick ? 'cursor-pointer hover:bg-hover' : ''} ${selected?.has(k) ? 'bg-teal-tint' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                  {selectable ? (
                    <td className={`${rowH} px-3`} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected?.has(k) ?? false} disabled={!canSelect} onChange={() => onToggle?.(k)} aria-label={`Select ${k}`} />
                    </td>
                  ) : null}
                  {columns.map((c) => (
                    <td key={c.key} className={`${rowH} px-3 align-middle whitespace-nowrap ${c.align === 'right' ? 'num text-right' : c.align === 'center' ? 'text-center' : 'text-left'} ${c.className ?? ''}`}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}

/* ---------- Modal and side panel ---------- */

export function Modal({ title, onClose, children, footer, width = 640 }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[rgba(11,15,26,0.35)] px-4 py-12" onMouseDown={onClose}>
      <div role="dialog" aria-modal className="w-full rounded border border-border bg-panel shadow-modal" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-md font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-grey hover:text-ink">
            <X size={16} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer ? <footer className="flex items-center justify-between gap-6 border-t border-border px-5 py-3">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function SidePanel({ title, subtitle, onClose, children, footer, width = 720 }: { title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(11,15,26,0.25)]" onMouseDown={onClose}>
      <div role="dialog" aria-modal className="flex h-full w-full flex-col border-l border-border bg-panel shadow-modal" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-sm text-grey">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="mt-1 text-grey hover:text-ink">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <footer className="flex items-center justify-between gap-6 border-t border-border px-6 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}

/* ---------- 2FA prompt ---------- */

export function TwoFactor({ onConfirm, onCancel, phoneLast4 = '4471', purpose }: { onConfirm: () => void; onCancel: () => void; phoneLast4?: string; purpose?: string }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const complete = digits.every((d) => /^\d$/.test(d));

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    if (!clean) {
      setDigits((d) => d.map((x, j) => (j === i ? '' : x)));
      return;
    }
    const next = [...digits];
    const chars = clean.split('');
    for (let k = 0; k < chars.length && i + k < 6; k++) next[i + k] = chars[k];
    setDigits(next);
    const focusIdx = Math.min(5, i + chars.length);
    refs.current[focusIdx]?.focus();
  };

  return (
    <Modal title="Two-factor authentication (2FA)" onClose={onCancel} width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!complete} onClick={onConfirm}>Confirm</Button>
        </>
      }
    >
      {purpose ? <p className="mb-3 text-sm text-grey">{purpose}</p> : null}
      <p className="mb-4">Enter the code sent to your registered phone ending {phoneLast4}.</p>
      <div className="flex gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            value={d}
            inputMode="numeric"
            maxLength={6}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
              if (e.key === 'Enter' && complete) onConfirm();
            }}
            className="num h-12 w-11 rounded border border-border text-center text-lg focus:border-teal-dark focus:outline-none"
          />
        ))}
      </div>
      <p className="mt-4 text-xs text-grey">Demo: any six digits are accepted.</p>
    </Modal>
  );
}

/* ---------- Toasts ---------- */

export function Toasts() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[440px] flex-col gap-3">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto rounded border border-l-4 border-border bg-panel px-4 py-3 shadow-modal ${t.kind === 'error' ? 'border-l-red' : t.kind === 'info' ? 'border-l-blue' : 'border-l-green'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{t.title}</div>
              {t.detail ? <div className="num mt-1 text-sm text-grey">{t.detail}</div> : null}
              {t.link ? (
                <Link to={t.link.to} onClick={() => dismiss(t.id)} className="mt-2 inline-block text-sm font-medium text-teal-dark hover:underline">
                  {t.link.label}
                </Link>
              ) : null}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-grey hover:text-ink">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Simple notice for things outside the prototype ---------- */

export function notPrototype() {
  useToast.getState().show({ title: 'Not part of the prototype', detail: 'This control exists in the full product. The demo does not include it.', kind: 'info' });
}

/* ---------- Progress bar ---------- */

export function Bar({ value, color = '#00897F', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full bg-border ${className}`}>
      <div className="h-1.5" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} />
    </div>
  );
}

/* ---------- Match text ---------- */

export function MatchText({ match }: { match: string }) {
  if (match === 'Matched') {
    return (
      <span>
        <span className="text-green">✓</span> Matched
      </span>
    );
  }
  return <span className="text-amber">{match}</span>;
}

export function download(filename: string, content: string, type = 'text/csv') {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    useToast.getState().show({ title: 'Download blocked', detail: 'The browser did not allow the download.', kind: 'error' });
  }
}

export function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
