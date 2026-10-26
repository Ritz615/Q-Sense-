import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { analyticsApi, departmentsApi } from '../services/api'
import { PageLoader, Alert, SectionHeader } from '../components/ui'
import { BarChart3 } from 'lucide-react'

export default function Analytics() {
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<number>(1)
  const [dayRange, setDayRange] = useState(7)
  const [hourRange, setHourRange] = useState(24)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hourlyPattern, setHourlyPattern] = useState<any[]>([])
  const [performance, setPerformance] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])

  const load = async (deptId = selectedDept) => {
    try {
      const [hRes, pRes, tRes] = await Promise.all([
        analyticsApi.hourlyPattern(deptId, dayRange),
        analyticsApi.performance(deptId, dayRange),
        analyticsApi.timeline(deptId, hourRange),
      ])
      setHourlyPattern(hRes.data)
      setPerformance(pRes.data)
      setTimeline(tRes.data)
    } catch { setError('Failed to load analytics') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    departmentsApi.list().then(r => {
      setDepartments(r.data)
      if (r.data.length > 0) { setSelectedDept(r.data[0].id); load(r.data[0].id) }
    }).catch(() => load())
  }, [])

  const handleApply = () => load()

  if (loading) return <PageLoader />

  const hourlyChart = hourlyPattern
    .filter(h => h.hour >= 7 && h.hour <= 18)
    .map(h => ({
      hour: `${h.hour}:00`,
      arrivals: parseFloat(h.avg_arrivals?.toFixed(1) || '0'),
      waiting: parseFloat(h.avg_waiting?.toFixed(1) || '0'),
      completions: parseFloat(h.avg_completions?.toFixed(1) || '0'),
    }))

  const timelineChart = timeline.map(t => ({
    time: new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    waiting: t.people_waiting,
    arrivals: t.arrivals,
    wait_min: parseFloat(t.wait_minutes?.toFixed(1) || '0'),
  }))

  return (
    <div className="space-y-5">
      <SectionHeader title="Historical Analytics" subtitle="Deep-dive into queue performance metrics and trends" />

      {error && <Alert type="error"><span>{error}</span></Alert>}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">Department</label>
          <select id="analytics-dept-select" className="input w-52" value={selectedDept} onChange={e => setSelectedDept(Number(e.target.value))}>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">History Period</label>
          <select className="input" value={dayRange} onChange={e => setDayRange(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div>
          <label className="label">Timeline Range</label>
          <select className="input" value={hourRange} onChange={e => setHourRange(Number(e.target.value))}>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={168}>Last 7 days</option>
          </select>
        </div>
        <button id="analytics-apply-btn" onClick={handleApply} className="btn-primary">Apply</button>
      </div>

      {/* Summary metrics */}
      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Avg Wait', value: `${performance.avg_wait_minutes?.toFixed(1)} min` },
            { label: 'Avg Queue', value: performance.avg_queue_length?.toFixed(1) },
            { label: 'Total Arrivals', value: performance.total_arrivals?.toLocaleString() },
            { label: 'Avg Counters', value: performance.avg_active_counters?.toFixed(1) },
          ].map(item => (
            <div key={item.label} className="card p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{item.label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{item.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">Last {dayRange} days (simulated)</p>
            </div>
          ))}
        </div>
      )}

      {/* Hourly pattern chart */}
      <div className="card">
        <div className="card-header">
          <h3>Hourly Arrival Pattern — {dayRange}-Day Average</h3>
        </div>
        <div className="card-body">
          {hourlyChart.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="arrivals" fill="#0d9488" name="Avg Arrivals" radius={[2,2,0,0]} />
                <Bar dataKey="waiting" fill="#3b82f6" name="Avg Waiting" radius={[2,2,0,0]} />
                <Bar dataKey="completions" fill="#94a3b8" name="Avg Completions" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-header">
          <h3>Queue Length Timeline — Last {hourRange}h</h3>
        </div>
        <div className="card-body">
          {timelineChart.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
              <BarChart3 size={28} />
              <p className="text-sm">No timeline data available for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timelineChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={Math.ceil(timelineChart.length / 12)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="waiting" stroke="#0d9488" strokeWidth={2} dot={false} name="Queue Length" />
                <Line type="monotone" dataKey="arrivals" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Arrivals" />
                <Line type="monotone" dataKey="wait_min" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Wait (min)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <Alert type="info">
        <span>All analytics are computed from synthetic simulation data. Peak hours (9–11am, 2–4pm) are modelled based on common government office patterns.</span>
      </Alert>
    </div>
  )
}
