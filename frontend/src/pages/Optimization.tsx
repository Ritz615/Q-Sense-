import { useState, useEffect } from 'react'
import { optimizationApi, departmentsApi } from '../services/api'
import { PageLoader, Alert, SectionHeader, StatusBadge } from '../components/ui'
import { Cpu, CheckCircle, XCircle, ChevronRight } from 'lucide-react'

export default function Optimization() {
  const [departments, setDepartments] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [config, setConfig] = useState({ department_id: 1, horizon_minutes: 60, weight_wait: 0.5, weight_cost: 0.3, weight_utilization: 0.2 })
  const [reviewNotes, setReviewNotes] = useState('')

  const load = async () => {
    try {
      const [dRes, rRes] = await Promise.all([departmentsApi.list(), optimizationApi.listRecommendations({})])
      setDepartments(dRes.data)
      setRecommendations(rRes.data)
      if (dRes.data.length > 0) setConfig(c => ({ ...c, department_id: dRes.data[0].id }))
    } catch { setError('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const runOptimization = async () => {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await optimizationApi.recommend(config)
      setResult(res.data)
      setSuccess('Recommendation generated')
      load() // refresh list
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Optimization failed')
    } finally {
      setRunning(false)
    }
  }

  const reviewRec = async (id: number, status: 'approved' | 'rejected') => {
    setReviewing(id)
    try {
      await optimizationApi.reviewRecommendation(id, { status, notes: reviewNotes })
      setSuccess(`Recommendation ${status}`)
      setReviewNotes('')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Review failed')
    } finally {
      setReviewing(null)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Dynamic Resource Allocation"
        subtitle="Optimize counter and staff allocation using forecast-informed optimization"
      />

      {error && <Alert type="error"><span>{error}</span></Alert>}
      {success && <Alert type="success"><span>{success}</span></Alert>}

      {/* Config */}
      <div className="card p-5">
        <h3 className="mb-4">Optimization Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="label">Department</label>
            <select id="opt-dept-select" className="input" value={config.department_id} onChange={e => setConfig({...config, department_id: Number(e.target.value)})}>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Horizon</label>
            <select className="input" value={config.horizon_minutes} onChange={e => setConfig({...config, horizon_minutes: Number(e.target.value)})}>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={120}>2 hr</option>
            </select>
          </div>
          <div>
            <label className="label">Wait Weight <span className="text-slate-400 text-xs">({config.weight_wait})</span></label>
            <input className="input" type="range" min={0} max={1} step={0.1} value={config.weight_wait} onChange={e => setConfig({...config, weight_wait: parseFloat(e.target.value)})} />
          </div>
          <div>
            <label className="label">Cost Weight <span className="text-slate-400 text-xs">({config.weight_cost})</span></label>
            <input className="input" type="range" min={0} max={1} step={0.1} value={config.weight_cost} onChange={e => setConfig({...config, weight_cost: parseFloat(e.target.value)})} />
          </div>
          <div className="flex items-end">
            <button id="run-optimize-btn" onClick={runOptimization} disabled={running} className="btn-primary w-full flex items-center justify-center gap-2">
              <Cpu size={14} />{running ? 'Optimizing…' : 'Optimize'}
            </button>
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3>Optimization Result</h3>
            <StatusBadge status={result.solver_status} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Current Counters', value: result.current_counters, color: 'bg-slate-50' },
              { label: 'Recommended', value: result.recommended_counters, color: 'bg-teal-50 text-teal-800' },
              { label: 'Wait Before', value: `${result.expected_wait_before_minutes?.toFixed(1)} min`, color: 'bg-red-50 text-red-700' },
              { label: 'Wait After', value: `${result.expected_wait_after_minutes?.toFixed(1)} min`, color: 'bg-emerald-50 text-emerald-700' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-4 ${item.color}`}>
                <p className="text-xs font-medium opacity-70">{item.label}</p>
                <p className="text-2xl font-semibold mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-700 mb-1">Explanation</p>
            <p className="text-sm text-slate-600">{result.explanation}</p>
          </div>

          <div className="flex gap-2">
            <button id="approve-rec-btn" onClick={() => reviewRec(result.recommendation_id, 'approved')} disabled={reviewing !== null} className="btn-primary flex items-center gap-2">
              <CheckCircle size={14} />Approve
            </button>
            <button id="reject-rec-btn" onClick={() => reviewRec(result.recommendation_id, 'rejected')} disabled={reviewing !== null} className="btn-danger flex items-center gap-2">
              <XCircle size={14} />Reject
            </button>
            <input className="input flex-1" placeholder="Review notes (optional)" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
          </div>
        </div>
      )}

      {/* History */}
      <div className="card">
        <div className="card-header"><h3>Recommendation History</h3></div>
        <div className="card-body p-0">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header">Generated</th>
                <th className="table-header">Dept</th>
                <th className="table-header">Current</th>
                <th className="table-header">Recommended</th>
                <th className="table-header">Wait Change</th>
                <th className="table-header">Solver</th>
                <th className="table-header">Decision</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-8">No recommendations yet</td></tr>
              ) : recommendations.map((r: any) => {
                const waitDelta = r.expected_wait_before && r.expected_wait_after
                  ? ((r.expected_wait_before - r.expected_wait_after) / 60).toFixed(1)
                  : null
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="table-cell text-xs">{new Date(r.generated_at).toLocaleString()}</td>
                    <td className="table-cell text-xs">{departments.find(d => d.id === r.department_id)?.code || r.department_id}</td>
                    <td className="table-cell">{r.current_counters}</td>
                    <td className="table-cell font-medium">{r.recommended_counters}</td>
                    <td className="table-cell">{waitDelta ? <span className={parseFloat(waitDelta) > 0 ? 'text-emerald-600' : 'text-red-600'}>{waitDelta > '0' ? '-' : '+'}{Math.abs(parseFloat(waitDelta))} min</span> : '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.solver_status || 'pending'} /></td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Alert type="info">
        <div><strong>Note:</strong> Optimization uses SciPy-based enumeration with the M/M/c Erlang-C queueing formula. Weights configure the multi-objective trade-off between wait time, staffing cost, and utilization. All recommendations require human approval before any real staffing change.</div>
      </Alert>
    </div>
  )
}
