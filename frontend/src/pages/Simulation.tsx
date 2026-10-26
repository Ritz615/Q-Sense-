import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { simulationApi, departmentsApi } from '../services/api'
import { PageLoader, Alert, SectionHeader, StatusBadge } from '../components/ui'
import { FlaskConical, Play, RefreshCw } from 'lucide-react'

const STRATEGY_COLORS: Record<string, string> = { fixed: '#94a3b8', rule_based: '#3b82f6', optimization: '#0d9488' }
const STRATEGY_LABELS: Record<string, string> = { fixed: 'Fixed Counters', rule_based: 'Rule-Based', optimization: 'Optimization' }

export default function Simulation() {
  const [runs, setRuns] = useState<any[]>([])
  const [results, setResults] = useState<Record<number, any[]>>({})
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedRun, setSelectedRun] = useState<number | null>(null)
  const [config, setConfig] = useState({
    name: 'What-If Scenario 1',
    department_id: '',
    arrival_rate_per_hour: 30,
    num_counters_fixed: 3,
    avg_service_time_minutes: 8,
    service_time_std_minutes: 2,
    duration_minutes: 480,
    seed: 42,
    num_runs: 3,
    strategies: ['fixed', 'rule_based', 'optimization'],
  })

  const load = async () => {
    try {
      const [rRes, dRes] = await Promise.all([simulationApi.listRuns(), departmentsApi.list()])
      setRuns(rRes.data)
      setDepartments(dRes.data)
    } catch { setError('Failed to load runs') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const runSim = async () => {
    setRunning(true)
    setError('')
    try {
      const res = await simulationApi.createRun({
        ...config,
        department_id: config.department_id ? Number(config.department_id) : null,
      })
      setSuccess(`Simulation run "${config.name}" started (ID: ${res.data.id}). Results available in ~10s.`)
      setTimeout(() => { load(); if (res.data.id) loadResults(res.data.id) }, 8000)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to start simulation')
    } finally {
      setRunning(false)
    }
  }

  const loadResults = async (runId: number) => {
    try {
      const res = await simulationApi.getResults(runId)
      setResults(prev => ({ ...prev, [runId]: res.data }))
      setSelectedRun(runId)
    } catch { }
  }

  if (loading) return <PageLoader />

  const selectedResults = selectedRun ? (results[selectedRun] || []) : []

  const chartData = ['mean_wait_seconds', 'p90_wait_seconds'].map(metric => {
    const point: any = { metric: metric === 'mean_wait_seconds' ? 'Mean Wait (s)' : 'P90 Wait (s)' }
    selectedResults.forEach((r: any) => {
      point[r.strategy] = parseFloat((r[metric] || 0).toFixed(1))
    })
    return point
  })

  const throughputData = selectedResults.map((r: any) => ({
    strategy: STRATEGY_LABELS[r.strategy] || r.strategy,
    throughput: parseFloat(r.throughput_per_hour?.toFixed(1) || '0'),
    utilization: parseFloat((r.counter_utilization * 100)?.toFixed(1) || '0'),
    served: r.customers_served,
  }))

  return (
    <div className="space-y-5">
      <SectionHeader title="What-If Simulation & Scenario Comparison" subtitle="Compare fixed, rule-based, and optimization-based allocation strategies" />

      {error && <Alert type="error"><span>{error}</span></Alert>}
      {success && <Alert type="success"><span>{success}</span></Alert>}

      {/* Config */}
      <div className="card p-5">
        <h3 className="mb-4">Scenario Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Scenario Name</label>
            <input id="sim-name-input" className="input" value={config.name} onChange={e => setConfig({...config, name: e.target.value})} />
          </div>
          <div>
            <label className="label">Arrival Rate (/hr)</label>
            <input id="sim-arrival-input" className="input" type="number" min={1} max={200} value={config.arrival_rate_per_hour} onChange={e => setConfig({...config, arrival_rate_per_hour: Number(e.target.value)})} />
          </div>
          <div>
            <label className="label">Fixed Counters</label>
            <input id="sim-counters-input" className="input" type="number" min={1} max={20} value={config.num_counters_fixed} onChange={e => setConfig({...config, num_counters_fixed: Number(e.target.value)})} />
          </div>
          <div>
            <label className="label">Avg Service Time (min)</label>
            <input className="input" type="number" min={1} max={60} value={config.avg_service_time_minutes} onChange={e => setConfig({...config, avg_service_time_minutes: Number(e.target.value)})} />
          </div>
          <div>
            <label className="label">Simulation Duration (min)</label>
            <select className="input" value={config.duration_minutes} onChange={e => setConfig({...config, duration_minutes: Number(e.target.value)})}>
              <option value={120}>2 hours</option>
              <option value={480}>8 hours</option>
              <option value={960}>16 hours</option>
            </select>
          </div>
          <div>
            <label className="label">Repeated Runs</label>
            <select className="input" value={config.num_runs} onChange={e => setConfig({...config, num_runs: Number(e.target.value)})}>
              <option value={1}>1 run</option>
              <option value={3}>3 runs</option>
              <option value={5}>5 runs</option>
            </select>
          </div>
          <div>
            <label className="label">Random Seed</label>
            <input className="input" type="number" value={config.seed} onChange={e => setConfig({...config, seed: Number(e.target.value)})} />
          </div>
        </div>
        <div className="mt-4">
          <button id="run-sim-btn" onClick={runSim} disabled={running} className="btn-primary flex items-center gap-2">
            <Play size={14} />{running ? 'Starting…' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* Run list */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3>Simulation Runs</h3>
          <button id="refresh-runs-btn" onClick={load} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"><RefreshCw size={12} />Refresh</button>
        </div>
        <div className="card-body p-0">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Status</th>
                <th className="table-header">Created</th>
                <th className="table-header">Results</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr><td colSpan={5} className="table-cell text-center text-slate-400 py-8">No simulation runs yet</td></tr>
              ) : runs.map((r: any) => (
                <tr key={r.id} className={`hover:bg-slate-50/50 ${selectedRun === r.id ? 'bg-teal-50/50' : ''}`}>
                  <td className="table-cell font-medium">{r.name}</td>
                  <td className="table-cell text-xs">{r.duration_minutes} min</td>
                  <td className="table-cell"><StatusBadge status={r.status} /></td>
                  <td className="table-cell text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="table-cell">
                    {r.status === 'completed' && (
                      <button id={`view-results-${r.id}`} onClick={() => loadResults(r.id)} className="btn-secondary py-1 px-2 text-xs">View Results</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results comparison */}
      {selectedResults.length > 0 && (
        <>
          <div className="card">
            <div className="card-header"><h3>Strategy Comparison — Waiting Times</h3></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="s" />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {['fixed', 'rule_based', 'optimization'].map(s => (
                    <Bar key={s} dataKey={s} fill={STRATEGY_COLORS[s]} name={STRATEGY_LABELS[s]} radius={[2,2,0,0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Strategy Comparison — Throughput & Utilization</h3></div>
            <div className="card-body p-0">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-header">Strategy</th>
                    <th className="table-header">Mean Wait (s)</th>
                    <th className="table-header">P90 Wait (s)</th>
                    <th className="table-header">Max Queue</th>
                    <th className="table-header">Served</th>
                    <th className="table-header">Throughput/hr</th>
                    <th className="table-header">Utilization</th>
                    <th className="table-header">Service Level</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResults.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STRATEGY_COLORS[r.strategy] }} />
                          <span className="font-medium">{STRATEGY_LABELS[r.strategy] || r.strategy}</span>
                        </span>
                      </td>
                      <td className="table-cell">{r.mean_wait_seconds?.toFixed(0)}s</td>
                      <td className="table-cell">{r.p90_wait_seconds?.toFixed(0)}s</td>
                      <td className="table-cell">{r.max_queue_length}</td>
                      <td className="table-cell">{r.customers_served}</td>
                      <td className="table-cell">{r.throughput_per_hour?.toFixed(1)}</td>
                      <td className="table-cell">{(r.counter_utilization * 100)?.toFixed(1)}%</td>
                      <td className="table-cell">{r.service_level_attained ? `${(r.service_level_attained * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Alert type="warning">
        <div><strong>Simulation Disclaimer:</strong> Results are from a synthetic discrete-event simulation only. The optimization strategy does not guarantee best outcomes in all scenarios. Real-world performance depends on many factors not captured in this model. Compare all strategies and review trade-offs carefully.</div>
      </Alert>
    </div>
  )
}
