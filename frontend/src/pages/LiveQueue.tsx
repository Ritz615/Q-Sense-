import { useState, useEffect, useRef } from 'react'
import {
  dashboardApi, simulationApi, departmentsApi, cameraApi
} from '../services/api'
import { PageLoader, Alert } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

export default function LiveQueue() {
  const { user } = useAuth()
  const [viewTab, setViewTab] = useState<'workstation' | 'camera'>('workstation')
  const [running, setRunning] = useState(false)
  const [observations, setObservations] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Workstation Live Timer & Active Citizen State
  const [elapsedSeconds, setElapsedSeconds] = useState(268) // 4m 28s
  const [activeToken, setActiveToken] = useState('VR-142')
  const [citizenName, setCitizenName] = useState('Ms. Clara Hughes')
  const [processedCount, setProcessedCount] = useState(34)
  const [check1, setCheck1] = useState(true)
  const [check2, setCheck2] = useState(true)
  const [check3, setCheck3] = useState(false)
  const [check4, setCheck4] = useState(false)
  const [copilotLoaded, setCopilotLoaded] = useState(false)
  const [queueList, setQueueList] = useState([
    { token: '#VR-143', name: 'Ready in Lobby', category: 'Expedited Registry Request', wait: '9m wait', priority: 'normal' },
    { token: '#VR-144', name: 'Assistance Requested', category: 'Elderly Citizen / Pre-filled Form', wait: '8m wait', priority: 'special' },
    { token: '#VR-145', name: 'Online Pre-verified', category: 'Fast-track Authentication', wait: '6m wait', priority: 'verified' },
    { token: '#VR-146', name: 'Standard Processing', category: 'Family Archival Duplicate', wait: '5m wait', priority: 'standard' },
  ])

  // Camera Mode State
  const [cameras, setCameras] = useState<any[]>([])
  const [selectedCam, setSelectedCam] = useState<any | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraSnapshotUrl, setCameraSnapshotUrl] = useState<string>('')
  const [cameraMetrics, setCameraMetrics] = useState<any>(null)
  const [roi, setRoi] = useState<[number, number, number, number]>([0.1, 0.35, 0.9, 0.95])
  const [savingRoi, setSavingRoi] = useState(false)
  const camPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Live Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Keyboard Hotkeys for Operator Desk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        handleCallNext()
      } else if (e.key.toLowerCase() === 'c') {
        handleCompleteService()
      } else if (e.key.toLowerCase() === 'h') {
        setStatusMsg('Token placed on temporary hold / recall queue.')
        setTimeout(() => setStatusMsg(''), 3000)
      } else if (e.key.toLowerCase() === 'x') {
        handleMarkNoShow()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [queueList])

  const handleCallNext = () => {
    if (queueList.length > 0) {
      const next = queueList[0]
      setActiveToken(next.token.replace('#', ''))
      setCitizenName(next.name === 'Ready in Lobby' ? 'Mr. Liam Ross' : next.name)
      setQueueList(prev => prev.slice(1))
      setElapsedSeconds(0)
      setCheck1(true)
      setCheck2(false)
      setCheck3(false)
      setCheck4(false)
      setCopilotLoaded(false)
      setStatusMsg(`Calling ${next.token} to Counter #04... Chime sounded.`)
      setTimeout(() => setStatusMsg(''), 4000)
    } else {
      setStatusMsg('No further citizens waiting in Zone B queue stream.')
      setTimeout(() => setStatusMsg(''), 3000)
    }
  }

  const handleCompleteService = () => {
    setProcessedCount(prev => prev + 1)
    setStatusMsg(`Service completed for ${activeToken}. Record logged to District Audit archive.`)
    setTimeout(() => setStatusMsg(''), 4000)
    handleCallNext()
  }

  const handleMarkNoShow = () => {
    setStatusMsg(`Citizen marked as No-Show for ${activeToken}. Ticket closed.`)
    setTimeout(() => setStatusMsg(''), 3000)
    handleCallNext()
  }

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
    } catch {
      setError('Failed to load queue data')
    }
  }

  const loadDeptsAndCameras = async () => {
    try {
      const [dRes, cRes] = await Promise.all([
        departmentsApi.list(),
        cameraApi.listSources(),
      ])
      setDepartments(dRes.data)
      setCameras(cRes.data)
      if (dRes.data.length > 0 && !selectedDept) {
        setSelectedDept(dRes.data[0].id)
      }
      if (cRes.data.length > 0) {
        setSelectedCam(cRes.data[0])
        if (cRes.data[0].roi_normalized) {
          setRoi(cRes.data[0].roi_normalized)
        }
        setCameraSnapshotUrl(cameraApi.snapshotUrl(cRes.data[0].id))
      }
    } catch { }
  }

  useEffect(() => {
    Promise.all([loadStatus(), loadDeptsAndCameras()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedDept) loadObs()
  }, [selectedDept])

  const stepCamera = async () => {
    if (!selectedCam) return
    try {
      const res = await cameraApi.stepFrame(selectedCam.id)
      setCameraMetrics(res.data)
      setCameraSnapshotUrl(cameraApi.snapshotUrl(selectedCam.id))
      loadObs()
    } catch { }
  }

  useEffect(() => {
    if (cameraActive && viewTab === 'camera') {
      camPollRef.current = setInterval(stepCamera, 3000)
    } else {
      if (camPollRef.current) clearInterval(camPollRef.current)
    }
    return () => { if (camPollRef.current) clearInterval(camPollRef.current) }
  }, [cameraActive, selectedCam, viewTab])

  const handleSaveRoi = async () => {
    if (!selectedCam) return
    setSavingRoi(true)
    try {
      await cameraApi.updateSource(selectedCam.id, { roi_normalized: roi })
      setStatusMsg('ROI polygon updated and recalibrated.')
      setTimeout(() => setStatusMsg(''), 3000)
    } catch {
      setError('Failed to update ROI')
    } finally {
      setSavingRoi(false)
    }
  }

  if (loading) return <PageLoader />

  const timerMins = Math.floor(elapsedSeconds / 60)
  const timerSecs = elapsedSeconds % 60
  const timerFormatted = `${timerMins < 10 ? '0' : ''}${timerMins}:${timerSecs < 10 ? '0' : ''}${timerSecs}`
  const slaPercentage = Math.min(100, Math.round((elapsedSeconds / 360) * 100))

  return (
    <div className="flex flex-col w-full pb-margin-desktop gap-gutter-desktop">
      {/* Top Tabs & Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
        <div className="flex items-center gap-space-sm">
          <button
            onClick={() => setViewTab('workstation')}
            className={`px-space-md py-1.5 rounded-lg font-body-sm text-body-sm font-semibold transition-all flex items-center gap-1.5 ${
              viewTab === 'workstation'
                ? 'bg-primary-container text-on-primary-container shadow-md'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            <span>Operator Workstation</span>
          </button>
          <button
            onClick={() => setViewTab('camera')}
            className={`px-space-md py-1.5 rounded-lg font-body-sm text-body-sm font-semibold transition-all flex items-center gap-1.5 ${
              viewTab === 'camera'
                ? 'bg-primary-container text-on-primary-container shadow-md'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">videocam</span>
            <span>CV Camera Mesh & Calibration</span>
          </button>
        </div>

        {statusMsg && (
          <div className="px-space-md py-1 rounded-lg bg-surface-container-high border border-primary/30 text-primary font-label-code-sm text-label-code-sm flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {error && <Alert type="error"><span>{error}</span></Alert>}

      {viewTab === 'workstation' ? (
        /* ================= OPERATOR WORKSTATION VIEW ================= */
        <div className="flex flex-col gap-gutter-desktop">
          {/* Algorithmic Re-routing Alert Ribbon */}
          <div className="relative overflow-hidden rounded-xl bg-surface-container-high px-space-lg py-space-md shadow-md border border-outline-variant/15">
            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-primary/10 blur-2xl pointer-events-none"></div>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md relative z-10">
              <div className="flex items-center gap-space-md">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0 shadow-sm border border-primary/30">
                  <span className="material-symbols-outlined text-[24px]">alt_route</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold">Dynamic Dispatch Override</span>
                    <span className="text-outline-variant font-label-code-sm text-label-code-sm">•</span>
                    <span className="font-label-code-sm text-label-code-sm text-secondary flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span> Live Bottleneck Mitigation
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface">
                    Counter dynamically re-routed to <span className="font-semibold text-primary">Expedited Birth Certificates</span> 15 mins ago to purge Zone B surge. Auto-reset window: <span className="font-label-numeric-md text-label-numeric-md text-tertiary font-bold">45:00</span>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-space-sm self-end lg:self-center">
                <span className="font-label-code-sm text-label-code-sm px-space-sm py-1 rounded bg-surface-container text-on-surface-variant border border-outline-variant/20">
                  Heuristic Model: v4.8-ZoneFlow
                </span>
                <button
                  onClick={() => setStatusMsg('Threshold sensitivity calibrated to +15% dynamic surge tolerance.')}
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-body-sm text-body-sm hover:bg-surface-bright transition-all flex items-center gap-1 border border-outline-variant/20"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span> Adjust Threshold
                </button>
              </div>
            </div>
          </div>

          {/* Desk Metadata & Telemetry Deck */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-gutter-desktop items-stretch">
            {/* Desk ID / Zone */}
            <div className="lg:col-span-4 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <span className="w-3 h-3 rounded-full bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)]"></span>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Workstation Station Lock</span>
                </div>
                <span className="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded bg-surface-container-high text-primary font-bold border border-primary/20">
                  TERMINAL ID: 04-B
                </span>
              </div>
              <div className="my-space-xs">
                <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">Counter #04</h2>
                <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                  Zone B • Vital Records & Civil Registry
                </p>
              </div>
              <div className="flex items-center gap-space-sm pt-space-xs border-t border-outline-variant/10">
                <span className="font-label-code-sm text-label-code-sm text-outline">Officer in Seat:</span>
                <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                  {user?.full_name || 'Marcus Vance'} (ID: #8821)
                </span>
              </div>
            </div>

            {/* Shift Duty Clock */}
            <div className="lg:col-span-3 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-caps text-label-caps uppercase font-bold">Shift Status</span>
                <span className="font-label-code-sm text-label-code-sm text-secondary font-semibold">ACTIVE DUTY</span>
              </div>
              <div className="my-1">
                <div className="font-label-numeric-lg text-label-numeric-lg text-on-surface font-bold">08:30 – 16:30</div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Remaining in Cycle: 1h 58m</p>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                <div className="bg-secondary h-full w-[76%] rounded-full shadow-[0_0_8px_rgba(78,222,163,0.6)]"></div>
              </div>
            </div>

            {/* Desk Utilization Gauge */}
            <div className="lg:col-span-2 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Desk Utilization</span>
              <div className="flex items-baseline gap-space-xs my-1">
                <span className="font-label-numeric-lg text-label-numeric-lg text-primary font-bold">91%</span>
                <span className="font-label-code-sm text-label-code-sm text-secondary font-semibold">+4% vs avg</span>
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">Peak state active</div>
            </div>

            {/* Citizens Processed Count */}
            <div className="lg:col-span-3 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Throughput Volume</span>
                <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
              </div>
              <div className="flex items-baseline gap-space-sm my-1">
                <span className="font-label-numeric-lg text-label-numeric-lg text-on-surface font-bold">{processedCount}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Citizens Dispatched</span>
              </div>
              <div className="flex items-center gap-space-xs font-label-code-sm text-label-code-sm text-secondary">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> Target quota: 40 (On pace)
              </div>
            </div>
          </div>

          {/* MAIN OPERATOR WORKBENCH (SPLIT VIEW) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-start">
            {/* LEFT / CENTER: ACTIVE CALLING TERMINAL (7 COLS) */}
            <div className="lg:col-span-7 flex flex-col gap-gutter-desktop">
              {/* Big Active Citizen Focus Card */}
              <div className="bg-surface-container rounded-xl p-space-lg shadow-xl relative overflow-hidden flex flex-col gap-space-lg border border-outline-variant/15">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary/40"></div>
                
                {/* Token Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(76,215,246,0.8)]"></span>
                    <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest font-bold">Currently Engaged</span>
                  </div>
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Citizen Wait Prior to Call:</span>
                    <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-numeric-md text-label-numeric-md text-on-surface font-bold border border-outline-variant/20">
                      11m 40s
                    </span>
                  </div>
                </div>

                {/* Big Token Headline */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                  <div className="flex flex-col">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-semibold">Assigned Identity & Token</span>
                    <div className="flex items-baseline gap-space-md mt-1">
                      <span className="font-display-lg text-display-lg text-primary tracking-tighter font-bold shadow-cyan-500/20">
                        {activeToken}
                      </span>
                      <span className="font-headline-xl text-headline-xl text-on-surface font-bold">
                        {citizenName}
                      </span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1.5 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-tertiary">verified</span>
                      Birth Certificate & Family Records — Expedited Dispatch
                    </p>
                  </div>

                  {/* Live Serving Timer */}
                  <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col items-center justify-center shrink-0 min-w-[170px] shadow-inner border border-outline-variant/15">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold">Service Elapsed</span>
                    <div className="font-label-numeric-lg text-label-numeric-lg text-secondary tracking-tight font-bold my-1" id="activeServiceTimer">
                      {timerFormatted}
                    </div>
                    <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">SLA Target: 06:00</span>
                  </div>
                </div>

                {/* SLA Progress Bar with Tick Markers */}
                <div className="flex flex-col gap-space-xs">
                  <div className="flex justify-between font-label-code-sm text-label-code-sm text-on-surface-variant">
                    <span>Pace: {slaPercentage > 85 ? 'Warning Near Limit' : 'Nominal (Healthy Emerald Range)'}</span>
                    <span className="text-secondary font-semibold">{slaPercentage}% Allocated Time Used</span>
                  </div>
                  <div className="w-full bg-surface-container-lowest h-3 rounded-full overflow-hidden relative p-0.5 border border-outline-variant/20">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        slaPercentage > 85 ? 'bg-tertiary' : 'bg-secondary'
                      } shadow-[0_0_12px_rgba(78,222,163,0.5)]`}
                      style={{ width: `${slaPercentage}%` }}
                    ></div>
                    <div className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-tertiary/60"></div>
                  </div>
                  <div className="flex justify-between font-label-caps text-label-caps uppercase text-outline">
                    <span>00:00 Initiated</span>
                    <span>05:00 Soft SLA Warning</span>
                    <span>06:00 Max Target</span>
                  </div>
                </div>

                {/* Visual Citizen Identity Card Preview */}
                <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row items-center gap-space-md border border-outline-variant/15">
                  <div className="w-16 h-16 rounded-lg bg-surface-container-highest shrink-0 shadow-sm flex items-center justify-center text-primary font-bold text-xl border border-primary/20">
                    <span className="material-symbols-outlined text-[32px]">badge</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-body-md text-body-md font-semibold text-on-surface">Digital Record #CIV-2024-991204</span>
                      <span className="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded bg-secondary/15 text-secondary font-medium">Biometric Verified</span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                      Requested: Urgent Passport Submission Supplement (Expedited Birth Certificate)
                    </span>
                    <div className="flex items-center gap-space-sm mt-1 text-on-surface-variant font-label-code-sm text-label-code-sm">
                      <span>National ID: ••••-7821</span>
                      <span>•</span>
                      <span>D.O.B: 14-MAY-1988</span>
                      <span>•</span>
                      <span>State Archive Registry: District 01</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* High-Ergonomic Command Deck (Hotkeys) */}
              <div className="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-md border border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">
                    Rapid Operator Hotkeys & Dispatch Matrix
                  </span>
                  <span className="font-label-code-sm text-label-code-sm text-primary flex items-center gap-1 font-semibold">
                    <span className="material-symbols-outlined text-[16px]">keyboard</span> Hotkeys Active
                  </span>
                </div>

                {/* Giant Call Next Primary CTA */}
                <button
                  onClick={handleCallNext}
                  className="group relative w-full overflow-hidden rounded-xl bg-primary-container px-space-xl py-space-lg text-on-primary-container font-headline-lg text-headline-lg flex items-center justify-center gap-space-md shadow-xl hover:bg-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  type="button"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                  <span className="material-symbols-outlined text-[28px]">notifications_active</span>
                  <span className="tracking-tight font-bold">CALL NEXT TOKEN</span>
                  <span className="font-label-code-sm text-label-code-sm px-space-sm py-1 rounded bg-on-primary-container/20 text-on-primary-container font-mono tracking-normal">
                    Spacebar / ↵ Enter
                  </span>
                </button>

                {/* Secondary Operator Control Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                  {/* Complete & Log */}
                  <button
                    onClick={handleCompleteService}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-secondary group-hover:scale-110 transition-transform">task_alt</span>
                    <span className="font-body-sm text-body-sm font-semibold">Complete & Log</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: C</span>
                  </button>

                  {/* Hold / Re-call */}
                  <button
                    onClick={() => {
                      setStatusMsg(`Token ${activeToken} placed on hold.`)
                      setTimeout(() => setStatusMsg(''), 3000)
                    }}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-tertiary group-hover:scale-110 transition-transform">pause_circle</span>
                    <span className="font-body-sm text-body-sm font-semibold">Hold / Re-call</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: H</span>
                  </button>

                  {/* Transfer Citizen */}
                  <button
                    onClick={() => {
                      setStatusMsg(`Citizen transferred to Desk 06 (Cashier).`)
                      setTimeout(() => setStatusMsg(''), 3000)
                    }}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-primary group-hover:scale-110 transition-transform">move_up</span>
                    <span className="font-body-sm text-body-sm font-semibold">Transfer Citizen</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: T</span>
                  </button>

                  {/* Mark As No-Show */}
                  <button
                    onClick={handleMarkNoShow}
                    className="bg-surface-container-high hover:bg-error-container hover:text-on-error-container text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-error group-hover:scale-110 transition-transform">person_off</span>
                    <span className="font-body-sm text-body-sm font-semibold">Mark No-Show</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: X</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: QUEUE PRESSURE & CITIZEN CHECKLIST (5 COLS) */}
            <div className="lg:col-span-5 flex flex-col gap-gutter-desktop">
              {/* Rapid Citizen Document & Verification Checklist */}
              <div className="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-md border border-outline-variant/15">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
                    <span className="font-headline-md text-headline-md text-on-surface">Rapid Verification Checklist</span>
                  </div>
                  <span className="font-label-code-sm text-label-code-sm text-secondary bg-surface-container-high px-2 py-0.5 rounded font-semibold">
                    {[check1, check2, check3, check4].filter(Boolean).length} of 4 Cleared
                  </span>
                </div>

                <div className="flex flex-col gap-space-xs">
                  {/* Step 1 */}
                  <label className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high cursor-pointer transition-colors border border-outline-variant/10">
                    <input
                      checked={check1}
                      onChange={e => setCheck1(e.target.checked)}
                      className="w-4 h-4 rounded text-primary accent-primary bg-surface-container-highest cursor-pointer"
                      type="checkbox"
                    />
                    <div className="flex flex-col flex-1">
                      <span className={`font-body-sm text-body-sm font-semibold ${check1 ? 'line-through text-outline' : 'text-on-surface'}`}>
                        National Identity Credential
                      </span>
                      <span className="font-label-code-sm text-label-code-sm text-outline">Encrypted chip verified via Optical Scanner</span>
                    </div>
                    {check1 && <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>}
                  </label>

                  {/* Step 2 */}
                  <label className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high cursor-pointer transition-colors border border-outline-variant/10">
                    <input
                      checked={check2}
                      onChange={e => setCheck2(e.target.checked)}
                      className="w-4 h-4 rounded text-primary accent-primary bg-surface-container-highest cursor-pointer"
                      type="checkbox"
                    />
                    <div className="flex flex-col flex-1">
                      <span className={`font-body-sm text-body-sm font-semibold ${check2 ? 'line-through text-outline' : 'text-on-surface'}`}>
                        Biometric Confirmation Match
                      </span>
                      <span className="font-label-code-sm text-label-code-sm text-outline">Thumbprint 99.4% confidence score</span>
                    </div>
                    {check2 && <span className="material-symbols-outlined text-[18px] text-secondary">fingerprint</span>}
                  </label>

                  {/* Step 3 */}
                  <label className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest cursor-pointer transition-colors border border-outline-variant/10">
                    <input
                      checked={check3}
                      onChange={e => setCheck3(e.target.checked)}
                      className="w-4 h-4 rounded text-primary accent-primary bg-surface-container-highest cursor-pointer"
                      type="checkbox"
                    />
                    <div className="flex flex-col flex-1">
                      <span className={`font-body-sm text-body-sm font-semibold ${check3 ? 'line-through text-outline' : 'text-on-surface'}`}>
                        Application Form Completeness
                      </span>
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Signature stamp on digital slate</span>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-tertiary">pending</span>
                  </label>

                  {/* Step 4 */}
                  <label className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest cursor-pointer transition-colors border border-outline-variant/10">
                    <input
                      checked={check4}
                      onChange={e => setCheck4(e.target.checked)}
                      className="w-4 h-4 rounded text-primary accent-primary bg-surface-container-highest cursor-pointer"
                      type="checkbox"
                    />
                    <div className="flex flex-col flex-1">
                      <span className={`font-body-sm text-body-sm font-semibold ${check4 ? 'line-through text-outline' : 'text-on-surface'}`}>
                        Processing Fee Settled ($28.00)
                      </span>
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Contactless NFC POS / Cash Drawer receipt</span>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-outline">payments</span>
                  </label>
                </div>

                {/* Quick Notes & Incident Escalation Strip */}
                <div className="flex items-center gap-space-sm pt-space-xs">
                  <button
                    onClick={() => setStatusMsg('Desk note saved to customer docket.')}
                    className="flex-1 py-1.5 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm flex items-center justify-center gap-1 transition-colors border border-outline-variant/15"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit_note</span> Add Desk Note
                  </button>
                  <button
                    onClick={() => setStatusMsg('Supervisor alerted: Floor incident escalated.')}
                    className="py-1.5 px-space-md rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center justify-center gap-1 hover:brightness-110 transition-all font-semibold"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">emergency_home</span> Escalate
                  </button>
                </div>
              </div>

              {/* Live Upcoming Queue List for Zone B */}
              <div className="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[20px] text-secondary">format_list_numbered</span>
                    <span className="font-headline-md text-headline-md text-on-surface">Zone B Queue Stream</span>
                  </div>
                  <span className="font-label-code-sm text-label-code-sm text-primary font-bold">
                    {queueList.length} NEXT IN LINE
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {queueList.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-space-sm rounded-lg transition-colors border border-outline-variant/10 ${
                        item.priority === 'special'
                          ? 'bg-surface-container-high hover:bg-surface-container-highest border-tertiary/20'
                          : 'bg-surface-container-low hover:bg-surface-container-high'
                      }`}
                    >
                      <div className="flex items-center gap-space-sm">
                        <span className={`font-label-numeric-md text-label-numeric-md font-bold ${
                          item.priority === 'special' ? 'text-tertiary' : 'text-primary'
                        }`}>
                          {item.token}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-body-sm text-body-sm text-on-surface font-medium flex items-center gap-1">
                            {item.name}
                            {item.priority === 'special' && (
                              <span className="material-symbols-outlined text-[14px] text-tertiary">accessible</span>
                            )}
                            {item.priority === 'verified' && (
                              <span className="material-symbols-outlined text-[14px] text-secondary">cloud_done</span>
                            )}
                          </span>
                          <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">{item.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-space-xs text-right">
                        <span className={`font-label-numeric-md text-label-numeric-md ${
                          item.priority === 'special' ? 'text-tertiary' : 'text-on-surface-variant'
                        }`}>
                          {item.wait}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${
                          item.priority === 'special' ? 'bg-tertiary' : 'bg-secondary'
                        }`}></span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-space-xs">
                  <div className="p-space-xs bg-surface-container-low rounded-lg flex items-center justify-between text-on-surface-variant border border-outline-variant/10">
                    <span className="font-label-code-sm text-label-code-sm">Total Zone B Backlog:</span>
                    <span className="font-label-numeric-md text-label-numeric-md text-primary font-bold">12 citizens</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* OPERATOR PRODUCTIVITY, QUEUE HEALTH & AI ASSIST TAPE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-stretch">
            {/* Handle Time Comparison */}
            <div className="lg:col-span-4 bg-surface-container rounded-xl p-space-md shadow-md flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Average Handle Time (AHT)</span>
                <span className="material-symbols-outlined text-[18px] text-secondary">speed</span>
              </div>
              <div className="flex items-end justify-between my-space-sm">
                <div>
                  <span className="font-label-caps text-label-caps uppercase text-outline">Marcus Vance (You)</span>
                  <div className="font-label-numeric-lg text-label-numeric-lg text-secondary font-bold">4m 12s</div>
                </div>
                <div className="text-right">
                  <span className="font-label-caps text-label-caps uppercase text-outline">Department Baseline</span>
                  <div className="font-label-numeric-md text-label-numeric-md text-on-surface-variant">5m 04s</div>
                </div>
              </div>
              <div className="flex items-center gap-space-sm">
                <div className="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full w-[83%] shadow-[0_0_8px_rgba(78,222,163,0.6)]"></div>
                </div>
                <span className="font-label-code-sm text-label-code-sm text-secondary font-semibold shrink-0">17% Faster Than Target</span>
              </div>
            </div>

            {/* Zone Pressure Gauge */}
            <div className="lg:col-span-4 bg-surface-container rounded-xl p-space-md shadow-md flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Zone Congestion Pressure</span>
                <span className="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded bg-tertiary/20 text-tertiary font-bold">MODERATE</span>
              </div>
              <div className="flex items-center justify-between my-space-xs">
                <div className="flex flex-col">
                  <span className="font-label-numeric-lg text-label-numeric-lg text-on-surface font-bold">12 Citizens</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Queued directly behind Window #04</span>
                </div>
                <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5"></path>
                    <path className="text-tertiary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="62, 100" strokeLinecap="round" strokeWidth="3.5"></path>
                  </svg>
                  <span className="absolute font-label-code-sm text-label-code-sm text-on-surface font-bold">62%</span>
                </div>
              </div>
              <p className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                Estimated clearance: <span className="text-primary font-semibold">32 minutes</span> at current terminal tempo.
              </p>
            </div>

            {/* AI Assisted Recommendation Card */}
            <div className="lg:col-span-4 bg-surface-container rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden border border-outline-variant/15">
              <div className="absolute -right-12 -bottom-12 w-32 h-32 rounded-full bg-primary/10 blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[18px]">auto_awesome</span>
                  <span className="font-label-caps text-label-caps uppercase text-primary font-bold">AI Workflow Co-Pilot</span>
                </div>
                <span className="font-label-code-sm text-label-code-sm text-outline">Confidence: 98.2%</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface my-space-xs leading-relaxed">
                Citizen <span className="font-semibold text-primary">{activeToken}</span> has pre-filed digital birth registry payload <span className="font-mono text-tertiary font-bold">#8921-X</span>. Auto-populate fields upon call?
              </p>
              <button
                onClick={() => {
                  setCopilotLoaded(true)
                  setCheck3(true)
                  setStatusMsg('Form #8921-X fields automatically populated on operator terminal.')
                  setTimeout(() => setStatusMsg(''), 3000)
                }}
                className={`w-full py-space-sm px-space-md rounded-lg font-body-sm text-body-sm font-semibold transition-all flex items-center justify-center gap-space-xs shadow-sm ${
                  copilotLoaded
                    ? 'bg-secondary/20 text-secondary border border-secondary/30'
                    : 'bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary border border-outline-variant/20'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                {copilotLoaded ? 'Form #8921-X Loaded' : 'Auto-Preload Form #8921-X'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= CV CAMERA MESH & CALIBRATION VIEW ================= */
        <div className="flex flex-col gap-space-md">
          <div className="bg-surface-container rounded-xl p-space-md border border-outline-variant/15 flex flex-col gap-space-md">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary text-[24px]">videocam</span>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">Computer Vision Occupancy Pipeline</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">YOLO Edge Detection with Normalized ROI Polygon Calibration</p>
                </div>
              </div>
              <div className="flex items-center gap-space-sm">
                <button
                  onClick={() => setCameraActive(!cameraActive)}
                  className={`px-space-md py-1.5 rounded-lg font-body-sm text-body-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all ${
                    cameraActive ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{cameraActive ? 'stop' : 'play_arrow'}</span>
                  <span>{cameraActive ? 'Stop Stream' : 'Start Live Inference'}</span>
                </button>
                <button
                  onClick={stepCamera}
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm border border-outline-variant/20"
                >
                  Step Frame
                </button>
              </div>
            </div>

            {/* Camera View Box */}
            <div className="relative w-full h-96 rounded-xl overflow-hidden bg-surface-container-lowest flex items-center justify-center border border-outline-variant/20 shadow-inner">
              {cameraSnapshotUrl ? (
                <img src={cameraSnapshotUrl} alt="Camera Stream" className="w-full h-full object-contain" />
              ) : (
                <div className="text-on-surface-variant font-label-code-sm">No camera snapshot feed available</div>
              )}
              {cameraMetrics && (
                <div className="absolute top-4 left-4 bg-surface-container-lowest/80 backdrop-blur px-space-sm py-1 rounded text-primary font-label-code-sm border border-primary/20">
                  Detected: {cameraMetrics.people_count} People • Conf: {(cameraMetrics.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {/* ROI Sliders */}
            <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm border border-outline-variant/15">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Region of Interest (ROI) Normalization</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">X Min: {roi[0].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[0]} onChange={e => setRoi([parseFloat(e.target.value), roi[1], roi[2], roi[3]])} className="w-full accent-[#9DB2BF]" />
                </div>
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">Y Min: {roi[1].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[1]} onChange={e => setRoi([roi[0], parseFloat(e.target.value), roi[2], roi[3]])} className="w-full accent-[#9DB2BF]" />
                </div>
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">X Max: {roi[2].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[2]} onChange={e => setRoi([roi[0], roi[1], parseFloat(e.target.value), roi[3]])} className="w-full accent-[#9DB2BF]" />
                </div>
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">Y Max: {roi[3].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[3]} onChange={e => setRoi([roi[0], roi[1], roi[2], parseFloat(e.target.value)])} className="w-full accent-[#9DB2BF]" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveRoi}
                  disabled={savingRoi}
                  className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary-fixed font-semibold hover:bg-primary-fixed-dim transition-colors text-sm"
                >
                  {savingRoi ? 'Saving...' : 'Save & Calibrate ROI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
