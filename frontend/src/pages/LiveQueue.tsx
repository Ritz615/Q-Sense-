import { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Play, Square, RotateCcw, RefreshCw, Activity } from 'lucide-react'
import { dashboardApi, simulationApi, departmentsApi } from '../services/api'
import { PageLoader, ErrorState, Alert, StatusBadge } from '../components/ui'

export default function LiveQueue() {
  const [running, setRunning] = useState(false)
  const [observations, setObservations] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadStatus = async () => {
    try {
      const res = await simulationApi.liveStatus()
      setRunning(res.data.running)
    } catch { }
  }

  const loadObs = async () => {
    try {
      const [obsRes, evtRes] = await Promise.all([
        dashboardApi.getObservations({ department_id: selectedDept || undefined, hours: 2, limit: 60 }),
        dashboardApi.getEvents({ department_id: selectedDept || undefined, hours: 1 }),
      ])
      setObservations(obsRes.data.reverse())
      setEvents(evtRes.data.slice(0, 20))
    } catch (e: any) {
      setError('Failed to load queue data')
    }
  }

  const loadDepts = async () => {
    try {
      const res = await departmentsApi.list()
      setDepartments(res.data)
      if (res.data.length > 0 && !selectedDept) {
        setSelectedDept(res.data[0].id)
      }
    } catch { }
  }

  useEffect(() => {
    Promise.all([loadStatus(), loadDepts()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedDept) loadObs()
  }, [selectedDept])

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(loadObs, 10000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [running, selectedDept])

  const startSim = async () => {
    try {
      await simulationApi.startLive()
      setRunning(true)
      setStatusMsg('Live simulation started. Generating observations every 15 seconds.')
    } catch (e: any) {
      setStatusMsg(e?.response?.data?.detail || 'Failed to start simulation')
    }
  }

  const stopSim = async () => {
    try {
      await simulationApi.stopLive()
      setRunning(false)
      setStatusMsg('Simulation stopped.')
    } catch { }
  }

  if (loading) return <PageLoader />

  const chartData = observations.map((o: any) => ({
    time: new Date(o.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    waiting: o.people_waiting,
    arrivals: o.arrivals_in_interval,
    counters: o.active_counters,
    wait_min: ((o.observed_waiting_time_seconds || 0) / 60).toFixed(1),
  }))

  const latest = observations[observations.length - 1]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Live Queue Monitoring</h1>
          <p className="text-sm text-slate-500 mt-0.5">Simulation-driven queue observation</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-sm text-slate-600">{running ? 'Running' : 'Stopped'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="card card-body flex flex-wrap items-center gap-3">
        <button id="sim-start-btn" onClick={startSim} disabled={running} className="btn-primary flex items-center gap-2">
          <Play size={14} /><span>Start Simulation</span>
        </button>
        <button id="sim-stop-btn" onClick={stopSim} disabled={!running} className="btn-secondary flex items-center gap-2">
          <Square size={14} /><span>Stop</span>
        </button>
        <button id="sim-refresh-btn" onClick={loadObs} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /><span>Refresh Data</span>
        </button>

        <div className="ml-auto">
          <select
            id="dept-select"
            className="input w-52"
            value={selectedDept || ''}
            onChange={e => setSelectedDept(Number(e.target.value))}
          >
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {statusMsg && <Alert type="info"><span>{statusMsg}</span></Alert>}
      {error && <Alert type="error"><span>{error}</span></Alert>}

      {/* Current state */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'People Waiting', value: latest.people_waiting, color: 'bg-blue-50 text-blue-700' },
            { label: 'Active Counters', value: latest.active_counters, color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Arrivals (15 min)', value: latest.arrivals_in_interval, color: 'bg-amber-50 text-amber-700' },
            { label: 'Est. Wait', value: `${((latest.observed_waiting_time_seconds || 0) / 60).toFixed(1)} min`, color: 'bg-slate-50 text-slate-700' },
          ].map(item => (
            <div key={item.label} className={`card p-4 ${item.color}`}>
              <p className="text-xs font-medium opacity-70">{item.label}</p>
              <p className="text-2xl font-semibold mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Queue chart */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3>Queue Length Timeline</h3>
          <span className="text-xs text-slate-400">{observations.length} observations · source: simulation</span>
        </div>
        <div className="card-body">
          {chartData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Activity size={32} />
              <p className="text-sm">No data yet — start the simulation</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="waitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="waiting" stroke="#0d9488" fill="url(#waitGrad)" strokeWidth={2} name="Waiting" />
                <Area type="monotone" dataKey="arrivals" stroke="#3b82f6" fill="transparent" strokeWidth={1.5} strokeDasharray="4 2" name="Arrivals" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Event log */}
      <div className="card">
        <div className="card-header"><h3>Recent Events</h3></div>
        <div className="card-body p-0 max-h-64 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No events yet</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="table-header">Time</th>
                  <th className="table-header">Event</th>
                  <th className="table-header">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: any) => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="table-cell text-xs text-slate-400">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="table-cell"><span className="badge-blue">{e.event_type}</span></td>
                    <td className="table-cell text-xs text-slate-500">
                      {e.payload ? JSON.stringify(e.payload) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
