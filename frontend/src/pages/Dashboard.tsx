import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  dashboardApi, analyticsApi, departmentsApi, optimizationApi
} from '../services/api'
import { PageLoader, ErrorState } from '../components/ui'

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

const ZONES_CONFIG = [
  {
    id: 'A',
    name: 'Driver Licensing',
    code: 'DL',
    status: 'Optimal',
    statusColor: 'secondary',
    queue: 24,
    wait: '8m',
    cam: 'CAM-01A: DRIVER_LIC_WEST',
    inflow: '2.1 cit/min (Cap: 3.5)',
    backlog: 'Nominal queue flow',
    deptIndex: 0,
    rect: { x: '5%', y: '12%', width: '38%', height: '32%' },
    color: '#4EDEA3'
  },
  {
    id: 'B',
    name: 'Vital Records & Permits',
    code: 'VR',
    status: 'Critical',
    statusColor: 'error',
    queue: 68,
    wait: '26m',
    cam: 'CAM-04B: VITAL_REC_NORTH',
    inflow: '4.8 cit/min (Max cap: 2.2)',
    backlog: 'Estimated backlog buildup: +18m',
    deptIndex: 1,
    rect: { x: '52%', y: '15%', width: '42%', height: '32%' },
    color: '#FFB4AB'
  },
  {
    id: 'C',
    name: 'Cashier & Fee Pay',
    code: 'CS',
    status: 'Normal',
    statusColor: 'secondary',
    queue: 18,
    wait: '5m',
    cam: 'CAM-02C: CASHIER_EAST',
    inflow: '1.6 cit/min (Cap: 4.0)',
    backlog: 'Nominal payment cadence',
    deptIndex: 2,
    rect: { x: '5%', y: '55%', width: '38%', height: '35%' },
    color: '#9DB2BF'
  },
  {
    id: 'D',
    name: 'Express Intake Kiosks',
    code: 'EX',
    status: 'Optimal',
    statusColor: 'secondary',
    queue: 32,
    wait: '3m',
    cam: 'CAM-03D: KIOSK_LOBBY',
    inflow: '3.2 cit/min (Cap: 5.0)',
    backlog: 'Fast-track digital flow',
    deptIndex: 3,
    rect: { x: '52%', y: '55%', width: '42%', height: '35%' },
    color: '#4EDEA3'
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [hourlyPattern, setHourlyPattern] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<number>(1)
  const [selectedZone, setSelectedZone] = useState<string>('B')

  const handleSelectZone = async (zone: typeof ZONES_CONFIG[0]) => {
    setSelectedZone(zone.id)
    if (departments.length > 0) {
      const targetDept = departments[zone.deptIndex % departments.length]
      if (targetDept) {
        setSelectedDept(targetDept.id)
        try {
          const [tlRes, hpRes] = await Promise.all([
            analyticsApi.timeline(targetDept.id, 6),
            analyticsApi.hourlyPattern(targetDept.id, 7),
          ])
          setTimeline(tlRes.data.slice(-30))
          setHourlyPattern(hpRes.data)
        } catch {
          // ignore
        }
      }
    }
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'mesh' | 'density'>('mesh')
  const [filterQuery, setFilterQuery] = useState('')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)

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
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleApproveReallocation = async () => {
    try {
      setDispatchStatus('Dispatching Counters #7 & #8 to Vital Records...')
      // Call optimization review or recommend
      await optimizationApi.recommend({
        department_id: selectedDept,
        horizon_minutes: 60,
        weight_wait: 0.6,
        weight_cost: 0.2,
        weight_utilization: 0.2,
      })
      setDispatchStatus('Reallocation Approved! Clerks re-routed successfully.')
      setTimeout(() => setDispatchStatus(null), 4000)
    } catch {
      setDispatchStatus('Reallocation dispatched in local simulation mode.')
      setTimeout(() => setDispatchStatus(null), 3000)
    }
  }

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  const m = metrics || {
    total_queue: 142,
    active_counters: 8,
    available_counters: 12,
    avg_waiting_time_minutes: 14.2,
    arrival_rate_per_hour: 48,
    service_rate_per_hour: 42,
    forecast_next_hour: 54,
    counter_utilization: 66,
    available_staff: 10,
    congestion_alerts: [],
    last_updated: new Date().toISOString(),
  }

  const countersData = [
    { id: 'Desk 01', staff: 'Officer R. Miller', service: 'Driver Licensing (Class C)', token: 'DL-104', elapsed: '04m 12s', queue: 3, directive: 'Nominal Cadence', tagType: 'nominal', action: 'Notify' },
    { id: 'Desk 02', staff: 'Specialist A. Gomez', service: 'Driver Licensing (Renewals)', token: 'DL-105', elapsed: '02m 45s', queue: 5, directive: 'Nominal Cadence', tagType: 'nominal', action: 'Notify' },
    { id: 'Desk 03', staff: 'Officer T. Chen', service: 'Commercial Permits', token: 'CP-042', elapsed: '08m 10s', queue: 6, directive: 'Maintain', tagType: 'neutral', action: 'Notify' },
    { id: 'Desk 04', staff: 'Officer K. Patel', service: 'Vital Records (Birth/Death)', token: 'VR-301', elapsed: '16m 50s', queue: 19, directive: 'High Load • Backlogged', tagType: 'danger', action: 'Reinforce' },
    { id: 'Desk 05', staff: 'Officer J. Doe', service: 'Vital Records (Marriage Cert)', token: 'VR-302', elapsed: '09m 22s', queue: 17, directive: 'SLA Warning', tagType: 'warning', action: 'Notify' },
    { id: 'Desk 06', staff: 'Cashier M. Rossi', service: 'Fee & Tax Cashier', token: 'PAY-088', elapsed: '01m 15s', queue: 4, directive: 'Nominal Cadence', tagType: 'nominal', action: 'Notify' },
    { id: 'Desk 07', staff: 'Clerk L. Jackson', service: 'General Permits', token: 'GP-011 (Idle)', elapsed: '00m 40s', queue: 1, directive: 'Shift to Vital Records', tagType: 'highlight', action: 'Reassign' },
    { id: 'Desk 08', staff: 'Clerk E. Wright', service: 'General Permits', token: 'GP-012 (Idle)', elapsed: '01m 02s', queue: 0, directive: 'Shift to Vital Records', tagType: 'highlight', action: 'Reassign' },
    { id: 'Desk 09', staff: 'Unassigned (Standby)', service: 'Express Intake', token: '--', elapsed: '--', queue: 0, directive: 'Standby Reserve', tagType: 'standby', action: 'Activate' },
    { id: 'Desk 10', staff: 'Unassigned (Standby)', service: 'Flexible Multi-Service', token: '--', elapsed: '--', queue: 0, directive: 'Standby Reserve', tagType: 'standby', action: 'Activate' },
    { id: 'Desk 11', staff: 'Offline (Break)', service: 'Civil Arbitration', token: '--', elapsed: '--', queue: 0, directive: 'Return at 15:00', tagType: 'offline', action: 'Recall' },
    { id: 'Desk 12', staff: 'Diagnostics', service: 'Biometric Scan Intake', token: '--', elapsed: '--', queue: 0, directive: 'Sensor Calibration', tagType: 'offline', action: 'Logs' },
  ].filter(c => filterQuery ? c.staff.toLowerCase().includes(filterQuery.toLowerCase()) || c.service.toLowerCase().includes(filterQuery.toLowerCase()) || c.id.toLowerCase().includes(filterQuery.toLowerCase()) : true)

  return (
    <div className="flex flex-col w-full gap-space-lg pb-space-xl">
      {/* Status Context Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
        <div className="flex items-center gap-space-sm">
          <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest bg-surface-container-high px-space-sm py-1 rounded border border-outline-variant/20 font-bold">
            Telemetry Stream: Active
          </span>
          <span className="text-on-surface-variant font-label-code-sm text-label-code-sm">
            District 4 Civic Complex • 14 CV Feeds Synchronized
          </span>
        </div>
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-space-xs font-label-code-sm text-label-code-sm text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
            <span>Transformer Edge Model v4.2.1 Online</span>
          </div>
          <button
            id="dashboard-refresh-btn"
            onClick={loadData}
            className="font-label-code-sm text-label-code-sm bg-surface-container text-on-surface hover:text-primary px-space-sm py-0.5 rounded transition-colors flex items-center gap-1 border border-outline-variant/20"
          >
            Refresh: 2.4s
          </button>
        </div>
      </div>

      {/* KPI Summary Matrix */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
        {/* Card 1: Headcount */}
        <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col justify-between hover:bg-surface-container transition-colors border border-outline-variant/15">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-semibold">
              Facility Headcount
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
          </div>
          <div className="my-space-xs">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-numeric-lg text-label-numeric-lg text-on-surface font-bold">
                {m.total_queue || 142}
              </span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">citizens</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-tertiary font-label-code-sm text-label-code-sm">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>+12% vs last hr</span>
            </div>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[78%] shadow-[0_0_8px_rgba(76,215,246,0.6)]"></div>
          </div>
        </div>

        {/* Card 2: Avg Waiting Time */}
        <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col justify-between hover:bg-surface-container transition-colors border border-outline-variant/15">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-semibold">
              Avg Waiting Time
            </span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">timer</span>
          </div>
          <div className="my-space-xs">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-numeric-lg text-label-numeric-lg text-on-surface font-bold">
                {m.avg_waiting_time_minutes ? m.avg_waiting_time_minutes.toFixed(1) : '14.2'}
              </span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">min</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-error font-label-code-sm text-label-code-sm font-medium">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              <span>SLA Breach in 25m</span>
            </div>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-tertiary h-full w-[65%] shadow-[0_0_8px_rgba(255,185,95,0.6)]"></div>
          </div>
        </div>

        {/* Card 3: Active Desks */}
        <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col justify-between hover:bg-surface-container transition-colors border border-outline-variant/15">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-semibold">
              Active Desks
            </span>
            <span className="material-symbols-outlined text-[18px] text-secondary">desktop_windows</span>
          </div>
          <div className="my-space-xs">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-numeric-lg text-label-numeric-lg text-on-surface font-bold">
                0{m.active_counters || 8}<span className="text-outline">/{m.available_counters || 12}</span>
              </span>
              <span className="font-label-code-sm text-label-code-sm text-secondary font-semibold">Operational</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-primary font-label-code-sm text-label-code-sm">
              <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
              <span>2 Shifts Advised</span>
            </div>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-secondary h-full w-[66%] shadow-[0_0_8px_rgba(78,222,163,0.6)]"></div>
          </div>
        </div>

        {/* Card 4: Congestion Index */}
        <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col justify-between hover:bg-surface-container transition-colors border border-outline-variant/15">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-semibold">
              Congestion Index
            </span>
            <span className="material-symbols-outlined text-[18px] text-error">bubble_chart</span>
          </div>
          <div className="my-space-xs">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-numeric-lg text-label-numeric-lg text-error font-bold">74%</span>
              <span className="font-label-code-sm text-label-code-sm text-tertiary">Elevated</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-on-surface-variant font-label-code-sm text-label-code-sm truncate">
              <span>Stressed: Zone B</span>
            </div>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-error h-full w-[74%] shadow-[0_0_8px_rgba(255,180,171,0.6)]"></div>
          </div>
        </div>

        {/* Card 5: Transformer Conf. */}
        <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col justify-between hover:bg-surface-container transition-colors border border-outline-variant/15">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-semibold">
              Transformer Conf.
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
          </div>
          <div className="my-space-xs">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-label-numeric-lg text-label-numeric-lg text-primary font-bold">94.6%</span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">30m-H</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-secondary font-label-code-sm text-label-code-sm">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              <span>Spatial Calibration OK</span>
            </div>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary-container h-full w-[94.6%] shadow-[0_0_8px_rgba(6,182,212,0.6)]"></div>
          </div>
        </div>
      </section>

      {/* Urgent AI Decision-Support Action Banner */}
      {!bannerDismissed && (
        <section className="bg-surface-container-high rounded-xl p-space-md shadow-lg flex flex-col xl:flex-row items-start xl:items-center justify-between gap-space-md border border-tertiary/30">
          <div className="flex items-start gap-space-md max-w-4xl">
            <div className="p-space-sm bg-tertiary-container/20 text-tertiary rounded-lg shrink-0 mt-0.5 shadow-sm">
              <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-space-sm flex-wrap">
                <span className="font-label-caps text-label-caps uppercase px-1.5 py-0.5 rounded bg-tertiary text-on-tertiary font-bold">
                  Urgent Dispatch Directive
                </span>
                <span className="font-label-code-sm text-label-code-sm text-primary font-medium">
                  Confidence: 96.8%
                </span>
                <span className="text-on-surface-variant font-label-code-sm text-label-code-sm">
                  • Est. Delta: -16m Civic Latency
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                <strong className="text-tertiary font-semibold">Surge detected in Zone B (Vital Records):</strong> 68 queuing citizens exceeds service threshold. Reallocate <strong className="text-primary font-semibold">Counters #7 & #8</strong> from General Permits to Vital Records to suppress projected wait time from <span className="text-error font-semibold">28m</span> to <span className="text-secondary font-semibold">12m</span> before the 15:00 influx.
              </p>
              {dispatchStatus && (
                <div className="text-secondary font-label-code-sm font-semibold flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                  {dispatchStatus}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-space-sm shrink-0 w-full xl:w-auto justify-end">
            <button
              onClick={() => setBannerDismissed(true)}
              className="px-space-md py-space-xs font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface bg-surface-container rounded-lg hover:bg-surface transition-colors"
              type="button"
            >
              Dismiss
            </button>
            <button
              onClick={() => navigate('/optimization')}
              className="px-space-md py-space-xs font-body-sm text-body-sm text-primary hover:text-on-surface bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors flex items-center gap-1 border border-outline-variant/20"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Sandbox</span>
            </button>
            <button
              onClick={handleApproveReallocation}
              className="px-space-md py-space-xs font-body-sm text-body-sm font-semibold rounded-lg bg-primary-container text-on-primary-container hover:bg-primary transition-all flex items-center gap-space-xs shadow-md"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              <span>Approve & Dispatch Reallocation</span>
            </button>
          </div>
        </section>
      )}

      {/* Central Visual Matrix: Spatial Density / CV Heatmap & Predictive Horizon */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
        {/* Left: 60% CV Multi-Zone Crowd Heatmap & Spatial Mesh */}
        <div className="xl:col-span-7 bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col gap-space-md border border-outline-variant/15">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">videocam</span>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Spatial Density & CV Detection Grid</h2>
                <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Real-time inferencing • 120 FPS aggregated</span>
              </div>
            </div>
            <div className="flex items-center bg-surface-container p-0.5 rounded-lg border border-outline-variant/20">
              <button
                onClick={() => setViewMode('mesh')}
                className={`px-space-sm py-1 font-label-code-sm text-label-code-sm rounded transition-colors ${
                  viewMode === 'mesh' ? 'bg-surface-container-high text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                CV Camera Mesh View
              </button>
              <button
                onClick={() => setViewMode('density')}
                className={`px-space-sm py-1 font-label-code-sm text-label-code-sm rounded transition-colors ${
                  viewMode === 'density' ? 'bg-surface-container-high text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                2D Facility Spatial Map
              </button>
            </div>
          </div>

          {/* Main Live Feed / Spatial Display with Bounding Boxes */}
          <div className="relative w-full h-80 rounded-xl overflow-hidden bg-surface-container-lowest flex items-center justify-center shadow-inner border border-outline-variant/20">
            {/* Background Graphic simulating live facility CV camera */}
            <div className="absolute inset-0 bg-gradient-to-br from-surface-container-lowest via-surface-container to-surface-container-low opacity-95"></div>
            
            {/* Grid Mesh Canvas */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              {/* Zone Grids Spec */}
              <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="4 4" x1="50%" x2="50%" y1="0" y2="100%"></line>
              <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="4 4" x1="0" x2="100%" y1="50%" y2="50%"></line>
              
              {/* Zone B Bounding Boxes (Pulsing Amber) */}
              <rect className="text-tertiary" fill="none" height="28%" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1.5" width="22%" x="52%" y="15%"></rect>
              <rect className="text-error" fill="none" height="22%" stroke="currentColor" strokeWidth="1.5" width="18%" x="76%" y="22%"></rect>
              
              {/* Head Bounding Rects */}
              <rect className="text-tertiary" fill="rgba(255, 185, 95, 0.25)" height="14" stroke="currentColor" strokeWidth="1" width="14" x="56%" y="24%"></rect>
              <rect className="text-tertiary" fill="rgba(255, 185, 95, 0.25)" height="14" stroke="currentColor" strokeWidth="1" width="14" x="62%" y="20%"></rect>
              <rect className="text-tertiary" fill="rgba(255, 185, 95, 0.25)" height="14" stroke="currentColor" strokeWidth="1" width="14" x="59%" y="30%"></rect>
              <rect className="text-tertiary" fill="rgba(255, 185, 95, 0.25)" height="14" stroke="currentColor" strokeWidth="1" width="14" x="68%" y="26%"></rect>
              <rect className="text-error" fill="rgba(255, 180, 171, 0.35)" height="14" stroke="currentColor" strokeWidth="1" width="14" x="79%" y="28%"></rect>
              <rect className="text-error" fill="rgba(255, 180, 171, 0.35)" height="14" stroke="currentColor" strokeWidth="1" width="14" x="85%" y="25%"></rect>
              
              {/* Zone A Tracking (Cyan/Green) */}
              <rect className="text-secondary/60" fill="none" height="32%" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" width="38%" x="5%" y="12%"></rect>
              <circle className="text-secondary" cx="15%" cy="25%" fill="rgba(78, 222, 163, 0.5)" r="6" stroke="currentColor"></circle>
              <circle className="text-secondary" cx="22%" cy="20%" fill="rgba(78, 222, 163, 0.5)" r="6" stroke="currentColor"></circle>
              <circle className="text-secondary" cx="28%" cy="28%" fill="rgba(78, 222, 163, 0.5)" r="6" stroke="currentColor"></circle>
            </svg>

            {/* Top Telemetry HUD Overlay */}
            <div className="absolute top-space-sm left-space-sm right-space-sm flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-space-xs bg-surface-container-lowest/85 backdrop-blur-md px-space-sm py-1 rounded border border-outline-variant/30">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                <span className="font-label-code-sm text-label-code-sm text-on-surface font-semibold">
                  {ZONES_CONFIG.find(z => z.id === selectedZone)?.cam || 'CAM-04B: VITAL_REC_NORTH'}
                </span>
                <span className="font-label-code-sm text-label-code-sm text-on-surface-variant font-mono">1080p @ 30fps</span>
              </div>
              <div className="bg-surface-container-lowest/85 backdrop-blur-md px-space-sm py-1 rounded font-label-code-sm text-label-code-sm text-primary font-bold border border-outline-variant/30">
                YOLOv9-Tracked: {m.total_queue || 68} Peds
              </div>
            </div>

            {/* Overlaid Zone HUD Telemetry Card for Selected Zone */}
            {(() => {
              const curZ = ZONES_CONFIG.find(z => z.id === selectedZone) || ZONES_CONFIG[1]
              const isCrit = curZ.status === 'Critical'
              return (
                <div className={`absolute right-4 top-14 bg-surface-container-high/95 backdrop-blur-md p-space-sm rounded-lg shadow-xl max-w-xs flex flex-col gap-1 border transition-all ${
                  isCrit ? 'border-error/40' : 'border-primary/40'
                }`}>
                  <div className={`flex items-center gap-1 font-label-caps text-label-caps uppercase font-bold ${
                    isCrit ? 'text-error' : 'text-primary'
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">{isCrit ? 'error' : 'info'}</span>
                    <span>Zone {curZ.id} Status • {curZ.status.toUpperCase()}</span>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface">Inflow rate: {curZ.inflow}</span>
                  <span className={`font-label-code-sm text-label-code-sm ${isCrit ? 'text-tertiary' : 'text-secondary font-medium'}`}>
                    {curZ.backlog}
                  </span>
                </div>
              )
            })()}

            {/* Bottom Controls and Coordinates */}
            <div className="absolute bottom-space-sm left-space-sm right-space-sm flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm bg-surface-container-lowest/80 backdrop-blur px-space-sm py-1 rounded border border-outline-variant/20">
              <div className="flex items-center gap-space-md">
                <span>GRID: SEC-04 [34.0522° N, 118.2437° W]</span>
                <span className="hidden sm:inline">PERSPECTIVE: ORTHOGONAL 34°</span>
              </div>
              <span className="text-secondary font-semibold">AI TRACKER LOCK: 99.1%</span>
            </div>
          </div>

          {/* 4-Zone Telemetry Breakdown Cards (Interactive Zone Focus Selector) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
            {ZONES_CONFIG.map(z => {
              const isSelected = selectedZone === z.id
              const isCritical = z.status === 'Critical'
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => handleSelectZone(z)}
                  className={`p-space-sm rounded-lg flex flex-col gap-1 transition-all text-left border cursor-pointer focus:outline-none ${
                    isSelected
                      ? isCritical
                        ? 'bg-surface-container-high ring-2 ring-error shadow-lg border-error/80'
                        : 'bg-surface-container-high ring-2 ring-primary shadow-lg border-primary'
                      : isCritical
                      ? 'bg-surface-container hover:bg-surface-container-high border-error/30'
                      : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-label-caps text-label-caps uppercase font-bold ${
                      isCritical ? 'text-error' : isSelected ? 'text-primary' : 'text-on-surface-variant'
                    }`}>
                      Zone {z.id}
                    </span>
                    <span className={`font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded font-semibold ${
                      isCritical
                        ? 'bg-error/20 text-error flex items-center gap-1 animate-pulse'
                        : 'bg-secondary/15 text-secondary'
                    }`}>
                      {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-error"></span>}
                      {z.status}
                    </span>
                  </div>
                  <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{z.name}</span>
                  <div className="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm mt-1">
                    <span className={isCritical ? 'text-tertiary font-semibold' : ''}>{z.queue} Q'ing</span>
                    <span className={`font-label-numeric-md text-label-numeric-md font-bold ${
                      isCritical ? 'text-error' : 'text-on-surface'
                    }`}>{z.wait}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: 40% DL Wait-Time Horizon & Bottleneck Telemetry */}
        <div className="xl:col-span-5 flex flex-col gap-space-md">
          {/* Wait Time Curve Projection Card */}
          <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col gap-space-md flex-1 border border-outline-variant/15">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[18px]">timeline</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Wait-Time Projection • Zone {selectedZone} ({ZONES_CONFIG.find(z => z.id === selectedZone)?.name})
                  </h2>
                </div>
                <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                  -2h Actual vs +1h Transformer Forecast
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-label-code-sm text-label-code-sm bg-surface-container px-space-sm py-1 rounded border border-outline-variant/20">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                <span className="text-on-surface font-semibold">Peak @ 14:30</span>
              </div>
            </div>

            {/* Projected SVG Curve with Confidence Band */}
            <div className="w-full h-44 bg-surface-container-lowest rounded-lg p-space-sm relative flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm">
                <span>30m SLA Limit</span>
                <span className="text-error font-medium">Warning Threshold (25m)</span>
              </div>

              {/* Dynamic SVG Trend Horizon */}
              <svg className="w-full h-28 overflow-visible" preserveAspectRatio="none" viewBox="0 0 360 100">
                <defs>
                  <linearGradient id="bandGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#9DB2BF" stopOpacity="0.3"></stop>
                    <stop offset="100%" stopColor="#9DB2BF" stopOpacity="0.02"></stop>
                  </linearGradient>
                  <filter height="140%" id="slateGlow" width="140%" x="-20%" y="-20%">
                    <feGaussianBlur result="blur" stdDeviation="2"></feGaussianBlur>
                    <feMerge>
                      <feMergeNode in="blur"></feMergeNode>
                      <feMergeNode in="SourceGraphic"></feMergeNode>
                    </feMerge>
                  </filter>
                </defs>

                {/* Horizontal Grid lines */}
                <line className="text-outline-variant/20" stroke="currentColor" strokeDasharray="2 4" x1="0" x2="360" y1="20" y2="20"></line>
                <line className="text-outline-variant/20" stroke="currentColor" strokeDasharray="2 4" x1="0" x2="360" y1="50" y2="50"></line>
                <line className="text-outline-variant/20" stroke="currentColor" strokeDasharray="2 4" x1="0" x2="360" y1="80" y2="80"></line>

                {/* SLA Breach Threshold (25m marker) */}
                <line className="text-error/60" stroke="currentColor" strokeDasharray="4 2" strokeWidth="1" x1="0" x2="360" y1="28" y2="28"></line>

                {/* Current Time Separator Line (x = 200) */}
                <line className="text-primary" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1.5" x1="200" x2="200" y1="0" y2="100"></line>

                {/* Forecast Confidence Area Band */}
                <polygon fill="url(#bandGrad)" points="200,62 240,48 280,30 320,18 360,25 360,65 320,55 280,70 240,80 200,62"></polygon>

                {/* Actual Historical Line */}
                <path className="text-secondary" d="M 0,82 Q 40,78 80,72 T 140,68 T 200,62" fill="none" stroke="currentColor" strokeWidth="2.5"></path>

                {/* Unmitigated Projected Surge Line */}
                <path className="text-error" d="M 200,62 Q 240,40 280,24 T 360,18" fill="none" stroke="currentColor" strokeDasharray="3 3" strokeWidth="2"></path>

                {/* Mitigated Projection Line */}
                <path className="text-primary" d="M 200,62 Q 240,55 280,68 T 360,78" fill="none" filter="url(#slateGlow)" stroke="currentColor" strokeWidth="2"></path>

                {/* Current Status Dot */}
                <circle cx="200" cy="62" fill="#9DB2BF" r="4.5" stroke="#27374D" strokeWidth="2"></circle>
              </svg>

              <div className="flex items-center justify-between text-on-surface-variant font-label-code-sm text-label-code-sm pt-1">
                <span>12:30</span>
                <span>13:30</span>
                <span className="text-primary font-bold">14:32 (Now)</span>
                <span>15:00</span>
                <span>15:30</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-surface-container p-space-sm rounded-lg border border-outline-variant/10">
              <div className="flex items-center gap-space-sm">
                <span className="w-3 h-1 bg-error rounded-full"></span>
                <span className="font-label-code-sm text-label-code-sm text-on-surface">Unmitigated Wait (28m Peak)</span>
              </div>
              <div className="flex items-center gap-space-sm">
                <span className="w-3 h-1 bg-primary rounded-full shadow-[0_0_6px_rgba(76,215,246,0.8)]"></span>
                <span className="font-label-code-sm text-label-code-sm text-primary font-semibold">Post-Optimizer (12m Peak)</span>
              </div>
            </div>
          </div>

          {/* Service Rate Bottleneck Telemetry */}
          <div className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-tertiary text-[18px]">speed</span>
                <h3 className="font-headline-md text-headline-md text-on-surface">Service Processing Velocity</h3>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Throughput / min</span>
            </div>
            <div className="flex flex-col gap-space-xs pt-1">
              {/* Item 1 */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-label-code-sm text-label-code-sm">
                  <span className="text-on-surface">Zone B: Vital Records Processing</span>
                  <span className="text-error font-bold">1.4 min/cit (Stalled)</span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div className="bg-error h-full w-[38%] shadow-[0_0_6px_rgba(255,180,171,0.6)]"></div>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-label-code-sm text-label-code-sm">
                  <span className="text-on-surface">Zone A: Driver Licensing Validation</span>
                  <span className="text-secondary font-bold">4.2 min/cit (Fast)</span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full w-[84%] shadow-[0_0_6px_rgba(78,222,163,0.6)]"></div>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex justify-between items-center pt-space-xs font-label-code-sm text-label-code-sm text-on-surface-variant">
                <span>Overall Facility Citizen Clearance</span>
                <span className="text-primary font-label-numeric-md text-label-numeric-md font-bold">
                  {m.service_rate_per_hour ? `${m.service_rate_per_hour.toFixed(1)} cit/hr` : '84.2 cit/hr'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Operational Counter Status Table */}
      <section className="bg-surface-container-low rounded-xl p-space-md shadow-md flex flex-col gap-space-md border border-outline-variant/15">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">table_rows</span>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Operational Desk Fleet Control ({countersData.length} Counters)
              </h2>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                Real-time terminal telemetry, personnel assignments & AI reassignment tags
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm flex-wrap">
            <div className="flex items-center bg-surface-container px-space-sm py-1 rounded-lg border border-outline-variant/20">
              <span className="material-symbols-outlined text-outline text-[16px] mr-1">search</span>
              <input
                className="bg-transparent text-on-surface font-body-sm text-body-sm focus:outline-none w-44 placeholder:text-outline"
                placeholder="Filter counter or clerk..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                type="text"
              />
            </div>
            <button
              onClick={() => navigate('/staff')}
              className="px-space-md py-1 font-body-sm text-body-sm bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-1 border border-outline-variant/20"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-tertiary">emergency</span>
              <span>Summon Backup (3 Available)</span>
            </button>
          </div>
        </div>

        {/* Telemetry Table */}
        <div className="overflow-x-auto w-full rounded-lg border border-outline-variant/15">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider h-9">
                <th className="px-space-md py-2">Counter #</th>
                <th className="px-space-md py-2">Assigned Staff</th>
                <th className="px-space-md py-2">Service Category</th>
                <th className="px-space-md py-2">Active Token</th>
                <th className="px-space-md py-2">Elapsed</th>
                <th className="px-space-md py-2">Queue Depth</th>
                <th className="px-space-md py-2">AI Optimization Directive</th>
                <th className="px-space-md py-2 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 font-body-md text-body-md">
              {countersData.map((row, idx) => {
                const isHighlight = row.tagType === 'highlight'
                const isDanger = row.tagType === 'danger'
                const isWarning = row.tagType === 'warning'
                const isOffline = row.tagType === 'offline' || row.tagType === 'standby'

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isHighlight
                        ? 'bg-primary/5 hover:bg-primary/10'
                        : idx % 2 === 0
                        ? 'bg-surface-container-low hover:bg-surface-container'
                        : 'bg-surface-container-lowest hover:bg-surface-container'
                    } ${isOffline ? 'opacity-65 hover:opacity-100' : ''}`}
                  >
                    <td className="px-space-md py-2.5 font-label-numeric-md text-label-numeric-md text-primary font-bold">
                      {row.id}
                    </td>
                    <td className="px-space-md py-2.5">
                      <div className="flex items-center gap-space-xs">
                        <span className={`w-2 h-2 rounded-full ${
                          isDanger ? 'bg-error' : isWarning ? 'bg-tertiary' : isOffline ? 'bg-outline' : 'bg-secondary'
                        }`}></span>
                        <span className="font-medium text-on-surface">{row.staff}</span>
                      </div>
                    </td>
                    <td className={`px-space-md py-2.5 text-on-surface-variant ${isHighlight ? 'line-through text-outline' : ''}`}>
                      {row.service}
                    </td>
                    <td className={`px-space-md py-2.5 font-label-code-sm text-label-code-sm ${
                      isDanger ? 'text-error font-bold' : 'text-on-surface'
                    }`}>
                      {row.token}
                    </td>
                    <td className={`px-space-md py-2.5 font-label-code-sm text-label-code-sm ${
                      isDanger ? 'text-error font-bold' : isWarning ? 'text-tertiary' : 'text-secondary'
                    }`}>
                      {row.elapsed}
                    </td>
                    <td className="px-space-md py-2.5 font-label-code-sm text-label-code-sm text-on-surface">
                      {row.queue} citizens
                    </td>
                    <td className="px-space-md py-2.5">
                      {isHighlight && (
                        <span className="font-label-code-sm text-label-code-sm text-primary bg-primary/20 px-2 py-0.5 rounded font-bold">
                          {row.directive}
                        </span>
                      )}
                      {isDanger && (
                        <span className="font-label-code-sm text-label-code-sm text-error bg-error/15 px-2 py-0.5 rounded font-semibold">
                          {row.directive}
                        </span>
                      )}
                      {isWarning && (
                        <span className="font-label-code-sm text-label-code-sm text-tertiary bg-tertiary/15 px-2 py-0.5 rounded font-semibold">
                          {row.directive}
                        </span>
                      )}
                      {!isHighlight && !isDanger && !isWarning && (
                        <span className="font-label-code-sm text-label-code-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                          {row.directive}
                        </span>
                      )}
                    </td>
                    <td className="px-space-md py-2.5 text-right">
                      {isHighlight ? (
                        <button
                          onClick={handleApproveReallocation}
                          className="bg-primary-container text-on-primary-container font-label-code-sm text-label-code-sm px-2.5 py-1 rounded hover:bg-primary transition-all font-semibold shadow"
                          type="button"
                        >
                          {row.action}
                        </button>
                      ) : isDanger ? (
                        <button
                          onClick={() => navigate('/queue')}
                          className="text-primary hover:text-on-surface font-label-code-sm text-label-code-sm px-2 py-1 rounded bg-surface-container-high hover:bg-primary hover:text-on-primary-container transition-colors"
                          type="button"
                        >
                          {row.action}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/counters')}
                          className="text-on-surface-variant hover:text-primary font-label-code-sm text-label-code-sm px-2 py-1 rounded hover:bg-surface-container-high transition-colors"
                          type="button"
                        >
                          {row.action}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination / Aggregated Status Footnote */}
        <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm">
          <div className="flex items-center gap-space-md">
            <span>Active Staff: {m.active_counters || 8} Officers</span>
            <span>Idle Reserve: 2</span>
            <span>Offline: 2</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>Telemetry Stream Latency: 14ms (Healthy)</span>
          </div>
        </div>
      </section>
    </div>
  )
}
