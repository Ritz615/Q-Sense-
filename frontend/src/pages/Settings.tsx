import { useState, useEffect } from 'react'
import { auditApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { PageLoader, SectionHeader, Alert } from '../components/ui'
import { Shield, RefreshCw } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  const load = async (offset = 0) => {
    try {
      const res = await auditApi.list({ limit: PAGE_SIZE, offset })
      setAuditLogs(res.data)
    } catch { setError('Failed to load audit logs') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(page * PAGE_SIZE) }, [page])

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <SectionHeader title="System Settings & Audit" subtitle="Audit trail, system configuration, and account information" />

      {error && <Alert type="error"><span>{error}</span></Alert>}

      {/* System info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="mb-3">System Information</h3>
          <div className="space-y-2.5">
            {[
              ['Application', 'Q-Sense v1.0.0'],
              ['Mode', 'Research Prototype / Simulation'],
              ['Backend', 'FastAPI + SQLAlchemy + SQLite'],
              ['ML Models', 'Baseline, MA, Random Forest, LSTM'],
              ['Optimization', 'M/M/c Erlang-C + SciPy'],
              ['Simulation', 'Discrete-Event (NumPy)'],
              ['Database', 'SQLite (dev) / PostgreSQL (prod)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3">Current User</h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-lg font-semibold">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user?.full_name}</p>
              <p className="text-sm text-slate-500">@{user?.username}</p>
              <span className={`text-xs font-medium ${user?.role === 'admin' ? 'text-purple-700' : 'text-slate-600'}`}>
                <Shield size={11} className="inline mr-1" />{user?.role}
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              ['User ID', `#${user?.id}`],
              ['Role', user?.role || '—'],
              ['Access Level', user?.role === 'admin' ? 'Full system access' : 'Read + basic operations'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ethical AI disclaimer */}
      <div className="card p-5 border-l-4 border-l-amber-400">
        <h3 className="mb-2 text-amber-800">Research Ethics & Limitations</h3>
        <div className="text-sm text-slate-600 space-y-1.5">
          <p>• <strong>All data is synthetic:</strong> Q-Sense uses simulated queue data, not real government operational data.</p>
          <p>• <strong>Human-in-the-loop:</strong> All optimization recommendations require explicit human approval before any staffing changes.</p>
          <p>• <strong>Simulation only:</strong> Live queue data is from a discrete-event simulator, not real sensors or CCTV.</p>
          <p>• <strong>Model limitations:</strong> ML models are trained on synthetic data. Real-world performance may differ significantly.</p>
          <p>• <strong>Research prototype:</strong> This system is for research demonstration only and is not production-ready for deployment.</p>
          <p>• <strong>Privacy:</strong> No real citizen or employee data is collected or processed.</p>
        </div>
      </div>

      {/* Audit log */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3>Audit Trail</h3>
          <button id="audit-refresh-btn" onClick={() => load(page * PAGE_SIZE)} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"><RefreshCw size={12} />Refresh</button>
        </div>
        <div className="card-body p-0 max-h-80 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="table-header">Timestamp</th>
                <th className="table-header">User</th>
                <th className="table-header">Action</th>
                <th className="table-header">Resource</th>
                <th className="table-header">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr><td colSpan={5} className="table-cell text-center text-slate-400 py-8">No audit logs yet</td></tr>
              ) : auditLogs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="table-cell text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="table-cell text-xs">{log.user_id || '—'}</td>
                  <td className="table-cell"><span className="badge-blue text-xs">{log.action}</span></td>
                  <td className="table-cell text-xs text-slate-500">{log.resource_type}{log.resource_id ? ` #${log.resource_id}` : ''}</td>
                  <td className="table-cell text-xs font-mono text-slate-400">{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-body flex items-center gap-2 border-t border-slate-100">
          <button id="audit-prev-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1 px-3 text-xs">Previous</button>
          <span className="text-sm text-slate-500">Page {page + 1}</span>
          <button id="audit-next-btn" onClick={() => setPage(p => p + 1)} disabled={auditLogs.length < PAGE_SIZE} className="btn-secondary py-1 px-3 text-xs">Next</button>
        </div>
      </div>
    </div>
  )
}
