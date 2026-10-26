/**
 * Reusable UI components for Q-Sense.
 */
import { ReactNode } from 'react';
import { Loader2, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

// ─── Loading spinner ─────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-teal-600 ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Spinner size={32} />
      <p className="text-sm text-slate-500">Loading...</p>
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <XCircle size={40} className="text-red-400" />
      <p className="text-sm text-slate-600 text-center max-w-sm">{message}</p>
      {onRetry && (
        <button id="error-retry-btn" onClick={onRetry} className="btn-secondary text-xs">
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Info size={24} className="text-slate-400" />
      </div>
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-500 text-center max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  unit,
  sublabel,
  color = 'blue',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  icon?: any;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-semibold text-slate-900">{value}</span>
            {unit && <span className="text-sm text-slate-500">{unit}</span>}
          </div>
          {sublabel && <p className="text-xs text-slate-400 mt-0.5 truncate">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg ${colorMap[color]} flex items-center justify-center flex-shrink-0 ml-3`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────────
export function Alert({
  type = 'info',
  children,
}: {
  type?: 'info' | 'warning' | 'success' | 'error';
  children: ReactNode;
}) {
  const cls = {
    info: 'alert-info',
    warning: 'alert-warning',
    success: 'alert-success',
    error: 'alert-error',
  }[type];
  const Icon = {
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle,
    error: XCircle,
  }[type];
  return (
    <div className={cls}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'badge-green',
    closed: 'badge-gray',
    busy: 'badge-yellow',
    maintenance: 'badge-red',
    ready: 'badge-green',
    training: 'badge-yellow',
    failed: 'badge-red',
    pending: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
    completed: 'badge-green',
    running: 'badge-blue',
  };
  return (
    <span className={map[status] || 'badge-gray'}>
      {status}
    </span>
  );
}

// ─── Simple data table ────────────────────────────────────────────────────────
export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="table-header">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="table-cell text-center text-slate-400 py-8">
                No data available
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="table-cell">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({
  value,
  onChange,
  options,
  id,
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  id?: string;
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input bg-white pr-8"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
