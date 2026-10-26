import { useState, useEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Users, MonitorCheck, Clock, TrendingUp, Activity,
  CheckCircle2, AlertTriangle, RefreshCw, Zap
} from 'lucide-react'
import { dashboardApi, analyticsApi, departmentsApi } from '../services/api'
import { MetricCard, PageLoader, ErrorState, Alert, StatusBadge } from '../components/ui'

interface DashboardMetrics {
  total_queue: number
  active_counters: number
  available_counters: number
  avg_waiting_time_minutes: number
  arrival_rate_per_hour: number
  service_rate_per_hour: number
  forecast_next_hour: number
  counter_utilization: number
  available_staff: number
  congestion_alerts: string[]
  last_updated: string
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [hourlyPattern, setHourlyPattern] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadData = async () => {
    try {
      setError('')
      const [metricsRes, deptsRes] = await Promise.all([
        dashboardApi.getMetrics(),
        departmentsApi.list(),
      ])
      setMetrics(metricsRes.data)
      const depts = deptsRes.data
      setDepartments(depts)
      if (depts.length > 0) {
        const deptId = depts[0].id
        setSelectedDept(deptId)
        const [tlRes, hpRes] = await Promise.all([
          analyticsApi.timeline(deptId, 6),
          analyticsApi.hourlyPattern(deptId, 7),
        ])
        setTimeline(tlRes.data.slice(-30))
        setHourlyPattern(hpRes.data)
      }
      setLastRefresh(new Date())
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // auto-refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  const m = metrics!

  const timelineData = timeline.map((t: any) => ({
    time: new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    waiting: t.people_waiting,
    arrivals: t.arrivals,
    completions: t.completions,
    wait_min: parseFloat(t.wait_minutes?.toFixed(1) || '0'),
  }))

  const hourlyData = hourlyPattern.map((h: any) => ({
    hour: `${h.hour}:00`,
    arrivals: parseFloat(h.avg_arrivals?.toFixed(1) || '0'),
    waiting: parseFloat(h.avg_waiting?.toFixed(1) || '0'),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Operations Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live queue monitoring · <span className="text-amber-600 font-medium">Simulation Mode</span>
          </p>
        </div>
        <button id="dashboard-refresh-btn" onClick={loadData} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Congestion Alerts */}
      {m.congestion_alerts?.length > 0 && (
        <div className="space-y-2">
          {m.congestion_alerts.map((alert, i) => (
            <Alert key={i} type="warning">
              <span>{alert}</span>
            </Alert>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <MetricCard
          label="People Waiting"
          value={m.total_queue}
          sublabel="Estimated (simulated)"
          color="blue"
          icon={Users}
        />
        <MetricCard
          label="Active Counters"
          value={m.active_counters}
          sublabel={`of ${m.available_counters} available`}
          color="green"
          icon={MonitorCheck}
        />
        <MetricCard
          label="Avg Wait Time"
          value={m.avg_waiting_time_minutes.toFixed(1)}
          unit="min"
          sublabel="Estimated · last 30 min"
          color={m.avg_waiting_time_minutes > 15 ? 'red' : 'green'}
          icon={Clock}
        />
        <MetricCard
          label="Forecast (1h)"
          value={m.forecast_next_hour}
          unit="arrivals"
          sublabel="Extrapolated estimate"
          color="amber"
          icon={TrendingUp}
        />
        <MetricCard
          label="Arrival Rate"
          value={m.arrival_rate_per_hour.toFixed(0)}
          unit="/hr"
          sublabel="Last 60 min (simulated)"
          color="slate"
          icon={Activity}
        />
        <MetricCard
          label="Service Rate"
          value={m.service_rate_per_hour.toFixed(0)}
          unit="/hr"
          sublabel="Completions last 60 min"
          color="slate"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Counter Util."
          value={`${m.counter_utilization.toFixed(1)}%`}
          sublabel="Active / available"
          color={m.counter_utilization > 90 ? 'red' : 'green'}
          icon={Zap}
        />
        <MetricCard
          label="Available Staff"
          value={m.available_staff}
          sublabel="Marked available"
          color="green"
          icon={Users}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Queue Length Timeline */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3>Queue Length Over Time</h3>
            <span className="badge-blue">Observed (simulated)</span>
          </div>
          <div className="card-body">
            {timelineData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                No recent observations. Start the live simulation.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="waiting" stroke="#0d9488" fill="url(#queueGrad)" name="Waiting" strokeWidth={2} />
                  <Area type="monotone" dataKey="arrivals" stroke="#3b82f6" fill="transparent" name="Arrivals" strokeWidth={1.5} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Hourly Arrival Pattern */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3>Hourly Arrival Pattern (7-day avg)</h3>
            <span className="badge-gray">Historical</span>
          </div>
          <div className="card-body">
            {hourlyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No historical data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData.filter(h => parseInt(h.hour) >= 7 && parseInt(h.hour) <= 18)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="arrivals" fill="#0d9488" name="Avg Arrivals" radius={[2,2,0,0]} />
                  <Bar dataKey="waiting" fill="#94a3b8" name="Avg Waiting" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Waiting Time Chart */}
        <div className="card">
          <div className="card-header">
            <h3>Estimated Waiting Time (min)</h3>
          </div>
          <div className="card-body">
            {timelineData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} unit=" min" />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => [`${v} min`, 'Wait']} />
                  <Line type="monotone" dataKey="wait_min" stroke="#f59e0b" strokeWidth={2} dot={false} name="Wait (min)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Department summary */}
        <div className="card">
          <div className="card-header">
            <h3>Departments Overview</h3>
          </div>
          <div className="card-body p-0">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-header">Department</th>
                  <th className="table-header">Code</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Max Counters</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="table-cell font-medium text-slate-800">{d.name}</td>
                    <td className="table-cell"><span className="badge-blue">{d.code}</span></td>
                    <td className="table-cell"><StatusBadge status={d.is_active ? 'open' : 'closed'} /></td>
                    <td className="table-cell">{d.max_counters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-400 text-center">
        Last refreshed: {lastRefresh.toLocaleTimeString()} · All metrics are from synthetic simulation data · Not real government operational figures
      </p>
    </div>
  )
}
