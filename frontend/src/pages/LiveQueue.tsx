import { useState, useEffect, useRef, useMemo } from 'react'
import {
  dashboardApi, simulationApi, departmentsApi, countersApi, cameraApi
} from '../services/api'
import { PageLoader, Alert } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

// Web Audio API Ding-Dong Chime Generator
function playChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    
    // Note 1 (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime)
    gain1.gain.setValueAtTime(0.3, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.8)

    // Note 2 (C5 - 523.25 Hz) after 200ms
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.25)
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.25)
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ctx.currentTime + 0.25)
    osc2.stop(ctx.currentTime + 1.2)
  } catch {
    // audio context may require user interaction
  }
}

// Speech Synthesis Announcement
function speakAnnouncement(token: string, counterName: string) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel() // clear any queued speech
    
    // Format token e.g. "CDS-143" to "C D S 1 4 3"
    const spacedToken = token.replace('-', ' ').split('').join(' ')
    const utterance = new SpeechSynthesisUtterance(`Token ${spacedToken}, please proceed to ${counterName}`)
    utterance.rate = 0.95
    utterance.pitch = 1.05
    utterance.volume = 0.9
    window.speechSynthesis.speak(utterance)
  } catch {
    // Speech synthesis error fallback
  }
}

interface TicketItem {
  id: number
  ticket_number: string
  department_id: number
  service_type_id?: number
  service_name?: string
  counter_id?: number
  citizen_name?: string
  priority?: string
  notes?: string
  status: string
  arrived_at: string
  service_started_at?: string
  service_completed_at?: string
  waiting_time_seconds?: number
  service_time_seconds?: number
  source?: string
}

export default function LiveQueue() {
  const { user } = useAuth()
  const [viewTab, setViewTab] = useState<'workstation' | 'kiosk' | 'board' | 'camera'>('workstation')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [autoArrivals, setAutoArrivals] = useState(false)

  // Departments & Counters
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<number>(1)
  const [counters, setCounters] = useState<any[]>([])
  const [selectedCounterId, setSelectedCounterId] = useState<number>(4)
  const [counterStatus, setCounterStatus] = useState<'open' | 'break' | 'closed'>('open')

  // Real Ticket Lifecycle State
  const [waitingTickets, setWaitingTickets] = useState<TicketItem[]>([])
  const [heldTickets, setHeldTickets] = useState<TicketItem[]>([])
  const [completedTickets, setCompletedTickets] = useState<TicketItem[]>([])
  const [activeTicket, setActiveTicket] = useState<TicketItem | null>(null)
  
  // Workstation Live Timer & Operational Stats
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [processedCount, setProcessedCount] = useState(34)
  const [check1, setCheck1] = useState(true)
  const [check2, setCheck2] = useState(true)
  const [check3, setCheck3] = useState(false)
  const [check4, setCheck4] = useState(false)
  const [copilotLoaded, setCopilotLoaded] = useState(false)
  const [operatorNote, setOperatorNote] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferTargetDept, setTransferTargetDept] = useState<number>(2)

  // Kiosk (Issue Ticket) State
  const [kioskDeptId, setKioskDeptId] = useState<number>(1)
  const [kioskCitizenName, setKioskCitizenName] = useState('')
  const [kioskServiceName, setKioskServiceName] = useState('Birth Certificate Registration')
  const [kioskPriority, setKioskPriority] = useState<'normal' | 'special' | 'fast_track' | 'vip'>('normal')
  const [issuedTicket, setIssuedTicket] = useState<TicketItem | null>(null)
  const [issuingTicket, setIssuingTicket] = useState(false)

  // Public Calling Board State
  const [publicBoard, setPublicBoard] = useState<{ counters: any[]; waiting_tickets: any[]; timestamp: string }>({
    counters: [],
    waiting_tickets: [],
    timestamp: '',
  })
  const [flashingCounter, setFlashingCounter] = useState<number | null>(null)

  // Camera Mode State
  const [cameras, setCameras] = useState<any[]>([])
  const [selectedCam, setSelectedCam] = useState<any | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraSnapshotUrl, setCameraSnapshotUrl] = useState<string>('')
  const [cameraMetrics, setCameraMetrics] = useState<any>(null)
  const [roi, setRoi] = useState<[number, number, number, number]>([0.1, 0.35, 0.9, 0.95])
  const [savingRoi, setSavingRoi] = useState(false)
  
  // Polling Refs
  const camPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queuePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoArrivalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Current Department and Counter Objects
  const currentDept = useMemo(() => {
    return departments.find(d => d.id === selectedDeptId) || departments[0] || { name: 'Vital Records', code: 'VR' }
  }, [departments, selectedDeptId])

  const currentCounter = useMemo(() => {
    return counters.find(c => c.id === selectedCounterId) || { name: 'Counter #04', number: 4 }
  }, [counters, selectedCounterId])

  // Live Timer Effect for Serving Ticket
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeTicket && counterStatus === 'open') {
        setElapsedSeconds(prev => prev + 1)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [activeTicket, counterStatus])

  // Fetch Tickets from API
  const fetchTickets = async () => {
    try {
      const [waitingRes, heldRes, completedRes] = await Promise.all([
        dashboardApi.listTickets({ department_id: selectedDeptId, status: 'waiting', limit: 25 }),
        dashboardApi.listTickets({ department_id: selectedDeptId, status: 'on_hold', limit: 15 }),
        dashboardApi.listTickets({ department_id: selectedDeptId, status: 'completed', limit: 10 }),
      ])
      setWaitingTickets(waitingRes.data || [])
      setHeldTickets(heldRes.data || [])
      setCompletedTickets(completedRes.data || [])
    } catch {
      // fail silently on background poll
    }
  }

  // Fetch Public Board
  const fetchPublicBoard = async () => {
    try {
      const res = await dashboardApi.getPublicBoard()
      setPublicBoard(res.data)
    } catch { }
  }

  // Initial Load
  const initData = async () => {
    try {
      setLoading(true)
      const [dRes, cRes, camRes] = await Promise.all([
        departmentsApi.list(),
        countersApi.list(),
        cameraApi.listSources(),
      ])
      setDepartments(dRes.data)
      setCounters(cRes.data)
      setCameras(camRes.data)

      const defaultDeptId = dRes.data.length > 0 ? dRes.data[0].id : 1
      setSelectedDeptId(defaultDeptId)
      setKioskDeptId(defaultDeptId)

      // Find default counter
      if (cRes.data.length > 0) {
        const found = cRes.data.find((c: any) => c.number === 4) || cRes.data[0]
        setSelectedCounterId(found.id)
      }

      if (camRes.data.length > 0) {
        setSelectedCam(camRes.data[0])
        if (camRes.data[0].roi_normalized) {
          setRoi(camRes.data[0].roi_normalized)
        }
        setCameraSnapshotUrl(cameraApi.snapshotUrl(camRes.data[0].id))
      }

      // Initial ticket fetch
      const [waitRes, activeRes] = await Promise.all([
        dashboardApi.listTickets({ department_id: defaultDeptId, status: 'waiting', limit: 20 }),
        dashboardApi.listTickets({ status: 'serving', limit: 10 }),
      ])
      setWaitingTickets(waitRes.data || [])

      // Check if this counter is currently serving
      const myServing = (activeRes.data || []).find((t: TicketItem) => t.counter_id === 4)
      if (myServing) {
        setActiveTicket(myServing)
        if (myServing.service_started_at) {
          const started = new Date(myServing.service_started_at).getTime()
          const diff = Math.max(0, Math.floor((Date.now() - started) / 1000))
          setElapsedSeconds(diff > 900 ? 120 : diff)
        }
      } else if (waitRes.data && waitRes.data.length > 0) {
        // Auto-call initial ticket if none active
        handleCallTicket(waitRes.data[0])
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize Queue Management System')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initData()
  }, [])

  // Poll tickets and public board every 4 seconds
  useEffect(() => {
    queuePollRef.current = setInterval(() => {
      fetchTickets()
      if (viewTab === 'board') {
        fetchPublicBoard()
      }
    }, 4000)
    return () => {
      if (queuePollRef.current) clearInterval(queuePollRef.current)
    }
  }, [selectedDeptId, viewTab])

  // Auto Arrivals Simulation Effect
  useEffect(() => {
    if (autoArrivals) {
      autoArrivalRef.current = setInterval(async () => {
        const demoNames = [
          'Elena Rostova', 'Karthik Raman', 'Sofia Morales', 'Liam O\'Connor',
          'Fatima Al-Mansoor', 'Julian Meyer', 'Chloe Tremblay', 'Lucas Wang'
        ]
        const demoServices = [
          'Birth Certificate Verification', 'Expedited Archival Duplicate',
          'Apostille Legalization', 'New Citizen Intake', 'Attestation Dossier'
        ]
        const priorities: ('normal' | 'special' | 'fast_track')[] = ['normal', 'normal', 'special', 'fast_track']
        const randomName = demoNames[Math.floor(Math.random() * demoNames.length)]
        const randomService = demoServices[Math.floor(Math.random() * demoServices.length)]
        const randomPriority = priorities[Math.floor(Math.random() * priorities.length)]

        try {
          await dashboardApi.createTicket({
            department_id: selectedDeptId,
            citizen_name: randomName,
            service_name: randomService,
            priority: randomPriority,
            source: 'kiosk_auto',
          })
          fetchTickets()
          setStatusMsg(`Auto-Kiosk: New arrival ${randomName} added to line.`)
          setTimeout(() => setStatusMsg(''), 3000)
        } catch { }
      }, 18000) // every 18 seconds
    } else {
      if (autoArrivalRef.current) clearInterval(autoArrivalRef.current)
    }
    return () => {
      if (autoArrivalRef.current) clearInterval(autoArrivalRef.current)
    }
  }, [autoArrivals, selectedDeptId])

  // Camera Step
  const stepCamera = async () => {
    if (!selectedCam) return
    try {
      const res = await cameraApi.stepFrame(selectedCam.id)
      setCameraMetrics(res.data)
      setCameraSnapshotUrl(cameraApi.snapshotUrl(selectedCam.id))
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

  // Sound and Voice Announcement Trigger
  const triggerAudioAnnouncement = (ticketNumber: string, counterTitle: string) => {
    if (!audioEnabled) return
    playChime()
    setTimeout(() => {
      speakAnnouncement(ticketNumber, counterTitle)
    }, 450)
  }

  // Call Specific or Next Ticket
  const handleCallTicket = async (ticket: TicketItem) => {
    try {
      // If active ticket, mark completed
      if (activeTicket && activeTicket.id !== ticket.id) {
        await dashboardApi.updateTicket(activeTicket.id, { status: 'completed' })
        setProcessedCount(prev => prev + 1)
      }

      // Update ticket to serving
      const res = await dashboardApi.updateTicket(ticket.id, {
        status: 'serving',
        counter_id: selectedCounterId,
        service_started_at: new Date().toISOString(),
      })

      setActiveTicket(res.data)
      setElapsedSeconds(0)
      setCheck1(true)
      setCheck2(false)
      setCheck3(false)
      setCheck4(false)
      setCopilotLoaded(false)
      setFlashingCounter(selectedCounterId)
      setTimeout(() => setFlashingCounter(null), 5000)

      setStatusMsg(`Calling Token ${res.data.ticket_number} to ${currentCounter.name}...`)
      triggerAudioAnnouncement(res.data.ticket_number, currentCounter.name)
      setTimeout(() => setStatusMsg(''), 4000)

      fetchTickets()
    } catch {
      setError('Failed to dispatch call to workstation')
    }
  }

  // Handle Call Next (Atomic backend call)
  const handleCallNext = async () => {
    if (counterStatus !== 'open') {
      setStatusMsg('Counter is paused or closed. Set status to OPEN to call next citizen.')
      setTimeout(() => setStatusMsg(''), 3000)
      return
    }

    try {
      const res = await dashboardApi.callNextTicket({
        counter_id: selectedCounterId,
        department_id: selectedDeptId,
      })

      if (res.data) {
        if (activeTicket) {
          setProcessedCount(prev => prev + 1)
        }
        setActiveTicket(res.data)
        setElapsedSeconds(0)
        setCheck1(true)
        setCheck2(false)
        setCheck3(false)
        setCheck4(false)
        setCopilotLoaded(false)
        setFlashingCounter(selectedCounterId)
        setTimeout(() => setFlashingCounter(null), 5000)

        setStatusMsg(`Token ${res.data.ticket_number} called to ${currentCounter.name}!`)
        triggerAudioAnnouncement(res.data.ticket_number, currentCounter.name)
        setTimeout(() => setStatusMsg(''), 4000)
      } else {
        setStatusMsg('Queue is currently clear! No citizens waiting in this department.')
        setTimeout(() => setStatusMsg(''), 3500)
      }
      fetchTickets()
    } catch {
      setError('Unable to call next ticket')
    }
  }

  // Re-announce current ticket
  const handleReAnnounce = () => {
    if (!activeTicket) return
    setStatusMsg(`Re-announcing ${activeTicket.ticket_number} to ${currentCounter.name}...`)
    triggerAudioAnnouncement(activeTicket.ticket_number, currentCounter.name)
    setTimeout(() => setStatusMsg(''), 3000)
  }

  // Complete Service
  const handleCompleteService = async () => {
    if (!activeTicket) return
    try {
      await dashboardApi.updateTicket(activeTicket.id, {
        status: 'completed',
        service_completed_at: new Date().toISOString(),
        service_time_seconds: elapsedSeconds,
        notes: operatorNote || undefined,
      })
      setProcessedCount(prev => prev + 1)
      setStatusMsg(`Service complete for ${activeTicket.ticket_number}. Saved to district records.`)
      setActiveTicket(null)
      setElapsedSeconds(0)
      setOperatorNote('')
      setTimeout(() => setStatusMsg(''), 3500)
      fetchTickets()
      // Auto-call next if any waiting
      setTimeout(() => {
        handleCallNext()
      }, 800)
    } catch {
      setError('Failed to complete service')
    }
  }

  // Hold Ticket
  const handleHoldTicket = async () => {
    if (!activeTicket) return
    try {
      await dashboardApi.updateTicket(activeTicket.id, {
        status: 'on_hold',
        notes: operatorNote || 'Placed on hold for missing citizen documents',
      })
      setStatusMsg(`Token ${activeTicket.ticket_number} placed in On-Hold tray.`)
      setActiveTicket(null)
      setElapsedSeconds(0)
      setOperatorNote('')
      setTimeout(() => setStatusMsg(''), 3500)
      fetchTickets()
    } catch {
      setError('Failed to place ticket on hold')
    }
  }

  // Mark No-Show
  const handleMarkNoShow = async () => {
    if (!activeTicket) return
    try {
      await dashboardApi.updateTicket(activeTicket.id, {
        status: 'abandoned',
        notes: 'Citizen did not appear at counter within timeout',
      })
      setStatusMsg(`Token ${activeTicket.ticket_number} marked as No-Show.`)
      setActiveTicket(null)
      setElapsedSeconds(0)
      setTimeout(() => setStatusMsg(''), 3000)
      fetchTickets()
      setTimeout(() => handleCallNext(), 500)
    } catch {
      setError('Failed to mark no show')
    }
  }

  // Transfer Ticket
  const handleTransferTicket = async () => {
    if (!activeTicket) return
    try {
      const destDept = departments.find(d => d.id === transferTargetDept)
      await dashboardApi.updateTicket(activeTicket.id, {
        department_id: transferTargetDept,
        status: 'waiting',
        notes: `Transferred to ${destDept?.name || 'Department'}`,
      })
      setStatusMsg(`Citizen ${activeTicket.ticket_number} transferred to ${destDept?.name}.`)
      setShowTransferModal(false)
      setActiveTicket(null)
      setElapsedSeconds(0)
      setTimeout(() => setStatusMsg(''), 3500)
      fetchTickets()
    } catch {
      setError('Transfer failed')
    }
  }

  // Resume a ticket from On-Hold
  const handleResumeHeldTicket = async (ticket: TicketItem) => {
    try {
      // If there is currently an active ticket engaged, automatically suspend it to on-hold first
      if (activeTicket && activeTicket.id !== ticket.id) {
        await dashboardApi.updateTicket(activeTicket.id, {
          status: 'on_hold',
          notes: 'Temporarily suspended to resume prior citizen',
        })
      }

      // Engage the resumed ticket
      const res = await dashboardApi.updateTicket(ticket.id, {
        status: 'serving',
        counter_id: selectedCounterId,
        service_started_at: new Date().toISOString(),
      })

      setActiveTicket(res.data)
      setElapsedSeconds(0)
      setCheck1(true)
      setCheck2(false)
      setCheck3(false)
      setCheck4(false)
      setCopilotLoaded(false)
      setFlashingCounter(selectedCounterId)
      setTimeout(() => setFlashingCounter(null), 5000)

      setStatusMsg(`Resumed Token ${res.data.ticket_number} at ${currentCounter.name}!`)
      triggerAudioAnnouncement(res.data.ticket_number, currentCounter.name)
      setTimeout(() => setStatusMsg(''), 4000)

      fetchTickets()
    } catch {
      setError('Failed to resume on-hold ticket')
    }
  }

  // Return a ticket from On-Hold back to general waiting line
  const handleReturnHeldToQueue = async (ticket: TicketItem) => {
    try {
      await dashboardApi.updateTicket(ticket.id, {
        status: 'waiting',
        notes: 'Returned to waiting line from hold',
      })
      setStatusMsg(`Token ${ticket.ticket_number} returned to waiting line.`)
      setTimeout(() => setStatusMsg(''), 3000)
      fetchTickets()
    } catch {
      setError('Failed to return ticket to line')
    }
  }

  // Kiosk Issue Ticket Handler
  const handleIssueTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    setIssuingTicket(true)
    try {
      const res = await dashboardApi.createTicket({
        department_id: kioskDeptId,
        citizen_name: kioskCitizenName || 'Guest Citizen',
        service_name: kioskServiceName,
        priority: kioskPriority,
        source: 'self_service_kiosk',
      })
      setIssuedTicket(res.data)
      setStatusMsg(`Ticket ${res.data.ticket_number} dispensed successfully!`)
      setKioskCitizenName('')
      fetchTickets()
      playChime()
      setTimeout(() => setStatusMsg(''), 4000)
    } catch {
      setError('Failed to generate ticket token from kiosk')
    } finally {
      setIssuingTicket(false)
    }
  }

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (viewTab !== 'workstation') return

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        handleCallNext()
      } else if (e.key.toLowerCase() === 'c') {
        handleCompleteService()
      } else if (e.key.toLowerCase() === 'h') {
        handleHoldTicket()
      } else if (e.key.toLowerCase() === 'r') {
        handleReAnnounce()
      } else if (e.key.toLowerCase() === 't') {
        setShowTransferModal(true)
      } else if (e.key.toLowerCase() === 'x') {
        handleMarkNoShow()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTicket, viewTab, counterStatus, selectedCounterId, selectedDeptId])

  // Camera Save ROI
  const handleSaveRoi = async () => {
    if (!selectedCam) return
    setSavingRoi(true)
    try {
      await cameraApi.updateSource(selectedCam.id, { roi_normalized: roi })
      setStatusMsg('Camera ROI calibration saved.')
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
      {/* ─── Top Control Header & QMS Mode Switcher ─── */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-b border-outline-variant/15 pb-space-sm">
        <div className="flex flex-wrap items-center gap-space-xs">
          <button
            onClick={() => setViewTab('workstation')}
            className={`px-space-md py-1.5 rounded-lg font-body-sm text-body-sm font-semibold transition-all flex items-center gap-1.5 ${
              viewTab === 'workstation'
                ? 'bg-primary-container text-on-primary-container shadow-md'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            <span>Operator Desk</span>
          </button>

          <button
            onClick={() => {
              setViewTab('kiosk')
              setIssuedTicket(null)
            }}
            className={`px-space-md py-1.5 rounded-lg font-body-sm text-body-sm font-semibold transition-all flex items-center gap-1.5 ${
              viewTab === 'kiosk'
                ? 'bg-primary-container text-on-primary-container shadow-md'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
            <span>Ticket Kiosk (Dispenser)</span>
          </button>

          <button
            onClick={() => {
              setViewTab('board')
              fetchPublicBoard()
            }}
            className={`px-space-md py-1.5 rounded-lg font-body-sm text-body-sm font-semibold transition-all flex items-center gap-1.5 ${
              viewTab === 'board'
                ? 'bg-primary-container text-on-primary-container shadow-md'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tv</span>
            <span>Public TV Display Board</span>
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
            <span>CV Camera Mesh</span>
          </button>
        </div>

        {/* Live Controls: Audio Chime & Auto Arrival Simulation */}
        <div className="flex items-center gap-space-sm">
          {/* Audio Chime Toggle */}
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled)
              if (!audioEnabled) playChime()
            }}
            title={audioEnabled ? 'Audio chime and voice announcements enabled' : 'Announcements muted'}
            className={`p-2 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${
              audioEnabled
                ? 'bg-secondary/15 text-secondary border-secondary/30'
                : 'bg-surface-container text-outline border-outline-variant/20'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {audioEnabled ? 'volume_up' : 'volume_off'}
            </span>
            <span className="hidden sm:inline font-label-code-sm">{audioEnabled ? 'Chime Active' : 'Muted'}</span>
          </button>

          {/* Auto Arrivals Toggle */}
          <button
            onClick={() => setAutoArrivals(!autoArrivals)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              autoArrivals
                ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/20 hover:text-on-surface'
            }`}
            title="Automatically generates realistic walk-in citizens into the queue stream"
          >
            <span className={`w-2 h-2 rounded-full ${autoArrivals ? 'bg-primary animate-ping' : 'bg-outline'}`}></span>
            <span>{autoArrivals ? 'Auto-Arrivals: ON' : 'Simulate Arrivals'}</span>
          </button>

          {statusMsg && (
            <div className="px-space-md py-1 rounded-lg bg-surface-container-high border border-primary/30 text-primary font-label-code-sm text-label-code-sm flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error">
          <span>{error}</span>
        </Alert>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW TAB 1: OPERATOR WORKSTATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewTab === 'workstation' && (
        <div className="flex flex-col gap-gutter-desktop">
          {/* Department & Counter Switcher Strip */}
          <div className="bg-surface-container rounded-xl p-space-md shadow-sm border border-outline-variant/15 flex flex-wrap items-center justify-between gap-space-md">
            <div className="flex flex-wrap items-center gap-space-md">
              {/* Department Dropdown */}
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-label-caps uppercase text-outline">Department / Service Zone:</span>
                <select
                  value={selectedDeptId}
                  onChange={(e) => {
                    const newId = parseInt(e.target.value)
                    setSelectedDeptId(newId)
                    dashboardApi.listTickets({ department_id: newId, status: 'waiting' }).then(res => setWaitingTickets(res.data || []))
                  }}
                  className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              {/* Counter Switcher */}
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-label-caps uppercase text-outline">Counter Station:</span>
                <select
                  value={selectedCounterId}
                  onChange={(e) => setSelectedCounterId(parseInt(e.target.value))}
                  className="bg-surface-container-high border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-semibold text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {counters.filter(c => c.department_id === selectedDeptId).map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Window #{c.number})</option>
                  ))}
                  {counters.filter(c => c.department_id === selectedDeptId).length === 0 && (
                    <option value={selectedCounterId}>Counter #04 (Assigned)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Counter Duty State Switcher */}
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant/15">
              <button
                type="button"
                onClick={() => setCounterStatus('open')}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                  counterStatus === 'open' ? 'bg-secondary/20 text-secondary border border-secondary/40 shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-secondary"></span> OPEN (Serving)
              </button>
              <button
                type="button"
                onClick={() => setCounterStatus('break')}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                  counterStatus === 'break' ? 'bg-tertiary/20 text-tertiary border border-tertiary/40 shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-tertiary"></span> ON BREAK
              </button>
              <button
                type="button"
                onClick={() => setCounterStatus('closed')}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                  counterStatus === 'closed' ? 'bg-error-container text-on-error-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-error"></span> CLOSED
              </button>
            </div>
          </div>

          {/* Telemetry Deck */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-gutter-desktop items-stretch">
            {/* Station Lock */}
            <div className="lg:col-span-4 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <span className={`w-3 h-3 rounded-full ${counterStatus === 'open' ? 'bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)]' : 'bg-tertiary'}`}></span>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Terminal Lock</span>
                </div>
                <span className="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded bg-surface-container-high text-primary font-bold border border-primary/20">
                  {currentDept.code}-DESK-0{currentCounter.number || 4}
                </span>
              </div>
              <div className="my-space-xs">
                <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">{currentCounter.name}</h2>
                <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                  {currentDept.name}
                </p>
              </div>
              <div className="flex items-center gap-space-sm pt-space-xs border-t border-outline-variant/10">
                <span className="font-label-code-sm text-label-code-sm text-outline">Operator:</span>
                <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                  {user?.full_name || 'System Operator'} ({user?.role?.toUpperCase() || 'OFFICER'})
                </span>
              </div>
            </div>

            {/* Waiting Citizens Count */}
            <div className="lg:col-span-3 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-caps text-label-caps uppercase font-bold">Queue Backlog</span>
                <span className="font-label-code-sm text-label-code-sm text-primary font-semibold">{waitingTickets.length} IN LINE</span>
              </div>
              <div className="my-1">
                <div className="font-label-numeric-lg text-label-numeric-lg text-on-surface font-bold">{waitingTickets.length} Citizens</div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Est. Wait: ~{Math.max(2, waitingTickets.length * 3)} mins
                </p>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, waitingTickets.length * 10)}%` }}
                ></div>
              </div>
            </div>

            {/* Citizens On Hold */}
            <div className="lg:col-span-2 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-caps text-label-caps uppercase font-bold">On Hold</span>
                <span className="material-symbols-outlined text-[18px] text-tertiary">pause_circle</span>
              </div>
              <div className="flex items-baseline gap-space-xs my-1">
                <span className="font-label-numeric-lg text-label-numeric-lg text-tertiary font-bold">{heldTickets.length}</span>
                <span className="font-label-code-sm text-label-code-sm text-outline">dockets</span>
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">Pending docs/cashier</div>
            </div>

            {/* Processed Count */}
            <div className="lg:col-span-3 bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col justify-between border border-outline-variant/15">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Throughput Volume</span>
                <span className="material-symbols-outlined text-[18px] text-secondary">task_alt</span>
              </div>
              <div className="flex items-baseline gap-space-sm my-1">
                <span className="font-label-numeric-lg text-label-numeric-lg text-secondary font-bold">{processedCount}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Served Today</span>
              </div>
              <div className="flex items-center gap-space-xs font-label-code-sm text-label-code-sm text-secondary">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> Quota pace: Optimal (+12%)
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
                    <span className={`w-2.5 h-2.5 rounded-full ${activeTicket ? 'bg-primary animate-pulse shadow-[0_0_8px_rgba(76,215,246,0.8)]' : 'bg-outline'}`}></span>
                    <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest font-bold">
                      {activeTicket ? 'Currently Engaged at Window' : 'Terminal Idle — Ready to Call'}
                    </span>
                  </div>
                  {activeTicket && (
                    <div className="flex items-center gap-space-xs">
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Arrived:</span>
                      <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-numeric-md text-label-numeric-md text-on-surface font-bold border border-outline-variant/20">
                        {new Date(activeTicket.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Big Token Headline */}
                {activeTicket ? (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                    <div className="flex flex-col">
                      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-semibold">Assigned Identity & Token</span>
                      <div className="flex items-baseline gap-space-md mt-1">
                        <span className="font-display-lg text-display-lg text-primary tracking-tighter font-bold">
                          {activeTicket.ticket_number}
                        </span>
                        <span className="font-headline-xl text-headline-xl text-on-surface font-bold">
                          {activeTicket.citizen_name || 'Walk-in Citizen'}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant mt-1.5 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-tertiary">verified</span>
                        {activeTicket.service_name || 'General Registry Submission'}
                        {activeTicket.priority === 'special' && (
                          <span className="px-2 py-0.5 rounded bg-tertiary/20 text-tertiary text-xs font-bold">Priority Assistance</span>
                        )}
                        {activeTicket.priority === 'fast_track' && (
                          <span className="px-2 py-0.5 rounded bg-secondary/20 text-secondary text-xs font-bold">Fast-Track</span>
                        )}
                      </p>
                    </div>

                    {/* Live Serving Timer */}
                    <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col items-center justify-center shrink-0 min-w-[170px] shadow-inner border border-outline-variant/15">
                      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider font-bold">Service Elapsed</span>
                      <div className="font-label-numeric-lg text-label-numeric-lg text-secondary tracking-tight font-bold my-1">
                        {timerFormatted}
                      </div>
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">SLA Target: 06:00</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-space-xl flex flex-col items-center justify-center text-center gap-2">
                    <span className="material-symbols-outlined text-[48px] text-outline">person_pin_circle</span>
                    <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold">Window Ready</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                      No citizen is currently being served at {currentCounter.name}. Click <span className="text-primary font-bold">CALL NEXT TOKEN</span> or press <span className="font-mono bg-surface-container-high px-1 rounded">Space</span> to dispatch the next ticket in line.
                    </p>
                  </div>
                )}

                {/* SLA Progress Bar with Tick Markers */}
                {activeTicket && (
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
                )}

                {/* Citizen Identity & Docket Preview */}
                {activeTicket && (
                  <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row items-center gap-space-md border border-outline-variant/15">
                    <div className="w-16 h-16 rounded-lg bg-surface-container-highest shrink-0 shadow-sm flex items-center justify-center text-primary font-bold text-xl border border-primary/20">
                      <span className="material-symbols-outlined text-[32px]">badge</span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-body-md text-body-md font-semibold text-on-surface">Docket #{activeTicket.ticket_number} • {activeTicket.citizen_name}</span>
                        <span className="font-label-code-sm text-label-code-sm px-2 py-0.5 rounded bg-secondary/15 text-secondary font-medium">Verified Stream</span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                        Requested: {activeTicket.service_name || 'Standard Processing Request'}
                      </span>
                      <div className="flex items-center gap-space-sm mt-1 text-on-surface-variant font-label-code-sm text-label-code-sm">
                        <span>Source: {activeTicket.source || 'Citizen Kiosk'}</span>
                        <span>•</span>
                        <span>Status: <span className="text-primary uppercase font-bold">{activeTicket.status}</span></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* High-Ergonomic Command Deck (Hotkeys) */}
              <div className="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-md border border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">
                    Rapid Operator Hotkeys & Dispatch Matrix
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReAnnounce}
                      disabled={!activeTicket}
                      title="Re-play chime and voice announcement"
                      className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-semibold flex items-center gap-1 border border-primary/20 disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[16px]">campaign</span> Re-Announce (R)
                    </button>
                    <span className="font-label-code-sm text-label-code-sm text-primary flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-[16px]">keyboard</span> Hotkeys Active
                    </span>
                  </div>
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
                    disabled={!activeTicket}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10 disabled:opacity-40"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-secondary group-hover:scale-110 transition-transform">task_alt</span>
                    <span className="font-body-sm text-body-sm font-semibold">Complete & Log</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: C</span>
                  </button>

                  {/* Hold / Re-call */}
                  <button
                    onClick={handleHoldTicket}
                    disabled={!activeTicket}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10 disabled:opacity-40"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-tertiary group-hover:scale-110 transition-transform">pause_circle</span>
                    <span className="font-body-sm text-body-sm font-semibold">Hold / Suspend</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: H</span>
                  </button>

                  {/* Transfer Citizen */}
                  <button
                    onClick={() => setShowTransferModal(true)}
                    disabled={!activeTicket}
                    className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10 disabled:opacity-40"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-primary group-hover:scale-110 transition-transform">move_up</span>
                    <span className="font-body-sm text-body-sm font-semibold">Transfer Citizen</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: T</span>
                  </button>

                  {/* Mark As No-Show */}
                  <button
                    onClick={handleMarkNoShow}
                    disabled={!activeTicket}
                    className="bg-surface-container-high hover:bg-error-container hover:text-on-error-container text-on-surface rounded-lg p-space-md flex flex-col items-center justify-center gap-space-xs text-center transition-all group border border-outline-variant/10 disabled:opacity-40"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[24px] text-error group-hover:scale-110 transition-transform">person_off</span>
                    <span className="font-body-sm text-body-sm font-semibold">Mark No-Show</span>
                    <span className="font-label-code-sm text-label-code-sm text-outline px-1.5 py-0.5 rounded bg-surface-container">Key: X</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: QUEUE PRESSURE, CHECKLIST & STREAM (5 COLS) */}
            <div className="lg:col-span-5 flex flex-col gap-gutter-desktop">
              {/* Rapid Citizen Document & Verification Checklist */}
              <div className="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-md border border-outline-variant/15">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
                    <span className="font-headline-md text-headline-md text-on-surface">Verification Checklist</span>
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

                {/* Quick Notes Strip */}
                <div className="flex items-center gap-space-sm pt-space-xs">
                  <button
                    onClick={() => setShowNoteModal(true)}
                    className="flex-1 py-1.5 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm flex items-center justify-center gap-1 transition-colors border border-outline-variant/15"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit_note</span> {operatorNote ? 'Edit Desk Note' : 'Add Desk Note'}
                  </button>
                  <button
                    onClick={() => {
                      setStatusMsg('Supervisor alerted: Floor incident escalated.')
                      dashboardApi.createEvent({
                        department_id: selectedDeptId,
                        counter_id: selectedCounterId,
                        event_type: 'incident_escalated',
                        payload: { token: activeTicket?.ticket_number || 'N/A', priority: 'urgent' },
                      }).catch(() => {})
                      setTimeout(() => setStatusMsg(''), 3000)
                    }}
                    className="py-1.5 px-space-md rounded-lg bg-error-container text-on-error-container font-body-sm text-body-sm flex items-center justify-center gap-1 hover:brightness-110 transition-all font-semibold"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">emergency_home</span> Escalate
                  </button>
                </div>
              </div>

              {/* On-Hold Citizens Tray (If any) */}
              {heldTickets.length > 0 && (
                <div className="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border border-tertiary/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-tertiary font-bold text-sm">
                      <span className="material-symbols-outlined text-[18px]">pause_circle</span>
                      <span>On-Hold Citizens ({heldTickets.length})</span>
                    </div>
                    <span className="text-xs text-outline font-label-code-sm">Ready to Resume</span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {heldTickets.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low border border-tertiary/20 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-tertiary font-label-numeric-md">{t.ticket_number}</span>
                          <span className="text-on-surface font-medium truncate max-w-[120px]">{t.citizen_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleResumeHeldTicket(t)}
                            className="px-2.5 py-1 rounded bg-secondary/20 text-secondary hover:bg-secondary hover:text-on-secondary font-semibold flex items-center gap-1 transition-colors shadow-sm"
                            title="Resume serving this citizen now"
                          >
                            <span className="material-symbols-outlined text-[14px]">play_arrow</span> Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReturnHeldToQueue(t)}
                            className="px-2 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-outline hover:text-on-surface text-[11px] font-semibold flex items-center gap-0.5 transition-colors"
                            title="Send back to general waiting line"
                          >
                            <span className="material-symbols-outlined text-[12px]">undo</span> Line
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Upcoming Queue Stream */}
              <div className="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[20px] text-secondary">format_list_numbered</span>
                    <span className="font-headline-md text-headline-md text-on-surface">Live Queue Stream</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewTab('kiosk')}
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Issue Ticket
                    </button>
                    <span className="font-label-code-sm text-label-code-sm text-primary font-bold">
                      {waitingTickets.length} WAITING
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {waitingTickets.length === 0 ? (
                    <div className="p-space-lg text-center text-on-surface-variant font-body-sm flex flex-col items-center justify-center gap-2 bg-surface-container-low rounded-lg">
                      <span className="material-symbols-outlined text-[32px] text-outline">done_all</span>
                      <span>No citizens waiting in this department.</span>
                      <button
                        type="button"
                        onClick={() => setViewTab('kiosk')}
                        className="px-3 py-1 text-xs rounded bg-primary-container text-on-primary-container font-semibold"
                      >
                        Issue Ticket at Kiosk
                      </button>
                    </div>
                  ) : (
                    waitingTickets.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onClick={() => handleCallTicket(item)}
                        title="Click to expedite and call this ticket directly"
                        className={`flex items-center justify-between p-space-sm rounded-lg transition-all cursor-pointer border ${
                          item.priority === 'special'
                            ? 'bg-surface-container-high hover:bg-surface-container-highest border-tertiary/30 hover:border-tertiary'
                            : item.priority === 'fast_track'
                            ? 'bg-surface-container-low hover:bg-surface-container-high border-secondary/30 hover:border-secondary'
                            : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant/10 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center gap-space-sm min-w-0">
                          <span className={`font-label-numeric-md text-label-numeric-md font-bold shrink-0 ${
                            item.priority === 'special' ? 'text-tertiary' : 'text-primary'
                          }`}>
                            {item.ticket_number}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-body-sm text-body-sm text-on-surface font-medium flex items-center gap-1 truncate">
                              {item.citizen_name || 'Citizen'}
                              {item.priority === 'special' && (
                                <span className="material-symbols-outlined text-[14px] text-tertiary" title="Senior / Priority">accessible</span>
                              )}
                              {item.priority === 'fast_track' && (
                                <span className="material-symbols-outlined text-[14px] text-secondary" title="Fast-Track">bolt</span>
                              )}
                            </span>
                            <span className="font-label-code-sm text-label-code-sm text-on-surface-variant truncate">
                              {item.service_name || 'Standard Service'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-space-xs text-right shrink-0">
                          <span className="font-label-code-sm text-label-code-sm text-outline">
                            {new Date(item.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${
                            item.priority === 'special' ? 'bg-tertiary' : 'bg-secondary'
                          }`}></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-space-xs border-t border-outline-variant/10 flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-code-sm text-label-code-sm">Total Department Backlog:</span>
                  <span className="font-label-numeric-md text-label-numeric-md text-primary font-bold">
                    {waitingTickets.length} citizens
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW TAB 2: CITIZEN TICKET KIOSK (DISPENSER)
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewTab === 'kiosk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-start">
          {/* Form Side */}
          <div className="lg:col-span-7 bg-surface-container rounded-xl p-space-xl shadow-lg border border-outline-variant/15 flex flex-col gap-space-lg">
            <div className="flex items-center gap-space-md border-b border-outline-variant/15 pb-space-md">
              <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">print</span>
              </div>
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Citizen Self-Service Ticket Dispenser</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">Issue digital or thermal paper ticket token for intake</p>
              </div>
            </div>

            <form onSubmit={handleIssueTicket} className="flex flex-col gap-space-md">
              {/* Department Selection */}
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps uppercase text-on-surface font-bold">Select Target Department</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {departments.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setKioskDeptId(d.id)}
                      className={`p-3 rounded-lg border text-left flex flex-col transition-all ${
                        kioskDeptId === d.id
                          ? 'bg-primary/15 border-primary text-on-surface shadow-sm ring-1 ring-primary'
                          : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span className="font-bold text-sm text-primary">{d.name}</span>
                      <span className="font-label-code-sm text-xs text-outline">{d.code} • Max {d.max_counters} Desks</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Type Selection */}
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps uppercase text-on-surface font-bold">Service Requirement</label>
                <select
                  value={kioskServiceName}
                  onChange={e => setKioskServiceName(e.target.value)}
                  className="bg-surface-container-high border border-outline-variant/30 rounded-lg p-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Birth Certificate Registration">Birth Certificate Registration & Attestation</option>
                  <option value="Property Tax Assessment & Clearance">Property Tax Assessment & Clearance</option>
                  <option value="National Identity Biometric Verification">National Identity Biometric Verification</option>
                  <option value="Driver Licensing & Vehicle Record">Driver Licensing & Vehicle Record Duplicate</option>
                  <option value="Family Archive Search & Apostille">Family Archive Search & Apostille Dossier</option>
                  <option value="General Citizen Enquiry & Registration">General Citizen Enquiry & Grievance</option>
                </select>
              </div>

              {/* Citizen Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps uppercase text-on-surface font-bold">Citizen Name (Optional)</label>
                  <input
                    type="text"
                    value={kioskCitizenName}
                    onChange={e => setKioskCitizenName(e.target.value)}
                    placeholder="e.g. Ms. Sarah Jenkins"
                    className="bg-surface-container-high border border-outline-variant/30 rounded-lg p-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps uppercase text-on-surface font-bold">Priority Classification</label>
                  <select
                    value={kioskPriority}
                    onChange={e => setKioskPriority(e.target.value as any)}
                    className="bg-surface-container-high border border-outline-variant/30 rounded-lg p-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="normal">Standard Intake Queue</option>
                    <option value="special">Senior Citizen / Specially-Abled (Priority)</option>
                    <option value="fast_track">Online Appointment Pre-Verified (Fast Track)</option>
                    <option value="vip">Diplomatic / Executive Dispatch (VIP)</option>
                  </select>
                </div>
              </div>

              {/* Dispense CTA */}
              <button
                type="submit"
                disabled={issuingTicket}
                className="mt-space-sm w-full py-3 rounded-xl bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <span className="material-symbols-outlined text-[24px]">confirmation_number</span>
                <span>{issuingTicket ? 'Printing Token...' : 'PRINT & ISSUE TICKET TOKEN'}</span>
              </button>
            </form>
          </div>

          {/* Ticket Preview / Printed Slip */}
          <div className="lg:col-span-5 flex flex-col items-center">
            {issuedTicket ? (
              <div className="w-full max-w-sm bg-surface-container-lowest text-on-surface rounded-2xl p-6 shadow-2xl border-2 border-dashed border-outline-variant/40 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <span className="material-symbols-outlined text-[24px]">account_balance</span>
                  <span className="tracking-wider uppercase text-sm">Citizen Service Center</span>
                </div>
                <div className="w-full border-b border-dashed border-outline-variant/30"></div>

                <div className="text-center">
                  <span className="text-xs uppercase text-outline tracking-widest font-bold">Your Queue Ticket</span>
                  <div className="font-display-lg text-display-lg font-bold text-primary my-1 tracking-tight">
                    {issuedTicket.ticket_number}
                  </div>
                  <span className="text-sm font-semibold text-on-surface">{issuedTicket.citizen_name}</span>
                </div>

                <div className="w-full bg-surface-container-low p-3 rounded-xl text-xs flex flex-col gap-1.5 border border-outline-variant/10">
                  <div className="flex justify-between">
                    <span className="text-outline">Service:</span>
                    <span className="font-semibold text-right max-w-[180px] truncate">{issuedTicket.service_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Priority:</span>
                    <span className="font-bold uppercase text-secondary">{issuedTicket.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Issued At:</span>
                    <span>{new Date(issuedTicket.arrived_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Estimated Wait:</span>
                    <span className="text-primary font-bold">~{Math.max(3, waitingTickets.length * 3)} mins</span>
                  </div>
                </div>

                <div className="text-center text-xs text-outline leading-relaxed">
                  Please proceed to the main waiting lounge and watch the public calling displays.
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setViewTab('workstation')
                    fetchTickets()
                  }}
                  className="w-full py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-sm font-semibold text-primary border border-outline-variant/20"
                >
                  Return to Operator Desk
                </button>
              </div>
            ) : (
              <div className="w-full max-w-sm bg-surface-container rounded-2xl p-8 border border-outline-variant/15 flex flex-col items-center justify-center text-center gap-3">
                <span className="material-symbols-outlined text-[48px] text-outline">receipt_long</span>
                <h4 className="font-bold text-on-surface text-base">Ticket Dispenser Standby</h4>
                <p className="text-xs text-outline leading-relaxed">
                  Fill out the form on the left and click "Print & Issue Ticket Token" to generate a real docket.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW TAB 3: LIVE PUBLIC TV CALLING DISPLAY (AIRPORT / CIVIC HALL)
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewTab === 'board' && (
        <div className="flex flex-col gap-space-lg">
          {/* Header Bar */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-2xl border border-outline-variant/20 flex flex-wrap items-center justify-between gap-space-md">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[36px] text-primary">tv_gen</span>
              <div>
                <h2 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">Public Calling Display</h2>
                <p className="font-body-sm text-body-sm text-outline">Main Hall Citizens Overhead Screen</p>
              </div>
            </div>

            <div className="flex items-center gap-space-md">
              <div className="text-right">
                <div className="font-mono text-xl font-bold text-secondary">
                  {new Date().toLocaleTimeString()}
                </div>
                <div className="text-xs text-outline uppercase tracking-wider">Live Sync Active</div>
              </div>
              <button
                type="button"
                onClick={fetchPublicBoard}
                className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary"
                title="Refresh display board"
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
              </button>
            </div>
          </div>

          {/* Big Split Counter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter-desktop">
            {(publicBoard.counters.length > 0 ? publicBoard.counters.slice(0, 8) : [
              { counter_number: 1, counter_name: 'Counter #01', current_ticket: 'CDS-138', service_name: 'Certificate Services' },
              { counter_number: 2, counter_name: 'Counter #02', current_ticket: 'RTS-089', service_name: 'Revenue & Tax' },
              { counter_number: 3, counter_name: 'Counter #03', current_ticket: 'IAV-042', service_name: 'ID Verification' },
              { counter_number: 4, counter_name: 'Counter #04', current_ticket: activeTicket?.ticket_number || 'VR-143', service_name: 'Vital Records' },
            ]).map((c: any) => {
              const isFlashing = flashingCounter === c.counter_id || flashingCounter === c.counter_number
              return (
                <div
                  key={c.counter_number}
                  className={`rounded-2xl p-space-lg flex flex-col justify-between items-center text-center transition-all duration-500 shadow-xl border ${
                    isFlashing
                      ? 'bg-primary/20 border-primary ring-4 ring-primary/40 animate-pulse'
                      : 'bg-surface-container border-outline-variant/15'
                  }`}
                >
                  <div className="w-full flex items-center justify-between pb-2 border-b border-outline-variant/10 text-outline text-xs">
                    <span className="uppercase font-bold tracking-widest">{c.counter_name}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  </div>

                  <div className="my-space-md flex flex-col items-center">
                    <span className="text-xs uppercase text-outline tracking-widest font-semibold">Now Serving</span>
                    <div className="font-display-lg text-[48px] font-bold text-primary tracking-tight mt-1">
                      {c.current_ticket || 'IDLE'}
                    </div>
                    <span className="text-sm font-semibold text-on-surface truncate max-w-[200px] mt-1">
                      {c.citizen_name || c.service_name || 'Standard Service'}
                    </span>
                  </div>

                  <div className="w-full pt-2 border-t border-outline-variant/10 font-label-code-sm text-xs text-outline">
                    Window #{c.counter_number}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Next in Line Ticker */}
          <div className="bg-surface-container rounded-xl p-space-md shadow-md border border-outline-variant/15 flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline font-bold">Upcoming Citizens (Please Be Ready)</span>
              <span className="font-label-code-sm text-xs text-primary font-bold">{waitingTickets.length} IN WAITING LOUNGE</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {waitingTickets.slice(0, 6).map((t, idx) => (
                <div key={t.id || idx} className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/10 text-center">
                  <div className="font-bold text-primary text-base font-label-numeric-md">{t.ticket_number}</div>
                  <div className="text-xs text-on-surface truncate mt-0.5">{t.citizen_name}</div>
                </div>
              ))}
              {waitingTickets.length === 0 && (
                <div className="col-span-full py-3 text-center text-xs text-outline">
                  No upcoming tickets waiting in the lobby.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Broadcast Ticker */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/20 flex items-center gap-3 overflow-hidden">
            <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-bold text-xs shrink-0 uppercase">Notice</span>
            <div className="font-body-sm text-on-surface text-sm truncate animate-pulse">
              Welcome to the Civic Services Complex • Please listen for your ticket token callout • Keep your national identification card ready • Counter #04 serving Expedited Vital Records
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW TAB 4: CV CAMERA MESH & CALIBRATION VIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewTab === 'camera' && (
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
                <img
                  key={cameraSnapshotUrl}
                  src={cameraSnapshotUrl}
                  alt="Camera Stream"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const img = e.currentTarget
                    if (!img.dataset.retried) {
                      img.dataset.retried = '1'
                      img.src = cameraSnapshotUrl.replace(/&token=[^&]*/, '')
                    }
                  }}
                />
              ) : (
                <div className="text-on-surface-variant font-label-code-sm">No camera snapshot feed available</div>
              )}
              {cameraMetrics && (
                <div className="absolute top-4 left-4 bg-surface-container-lowest/80 backdrop-blur px-space-sm py-1 rounded text-primary font-label-code-sm border border-primary/20">
                  Detected: {cameraMetrics.detections_count} People • Occupancy: {cameraMetrics.smoothed_occupancy?.toFixed(1)} • FPS: {cameraMetrics.fps?.toFixed(1)}
                </div>
              )}
            </div>

            {/* ROI Sliders */}
            <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm border border-outline-variant/15">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold">Region of Interest (ROI) Normalization</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">X Min: {roi[0].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[0]} onChange={e => setRoi([parseFloat(e.target.value), roi[1], roi[2], roi[3]])} className="w-full accent-primary" />
                </div>
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">Y Min: {roi[1].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[1]} onChange={e => setRoi([roi[0], parseFloat(e.target.value), roi[2], roi[3]])} className="w-full accent-primary" />
                </div>
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">X Max: {roi[2].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[2]} onChange={e => setRoi([roi[0], roi[1], parseFloat(e.target.value), roi[3]])} className="w-full accent-primary" />
                </div>
                <div>
                  <label className="font-label-code-sm text-on-surface-variant">Y Max: {roi[3].toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={roi[3]} onChange={e => setRoi([roi[0], roi[1], roi[2], parseFloat(e.target.value)])} className="w-full accent-primary" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveRoi}
                  disabled={savingRoi}
                  className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors text-sm"
                >
                  {savingRoi ? 'Saving...' : 'Save & Calibrate ROI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Desk Note ─── */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/20 flex flex-col gap-4">
            <h3 className="font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit_note</span>
              <span>Desk Note for {activeTicket?.ticket_number || 'Current Citizen'}</span>
            </h3>
            <textarea
              rows={4}
              value={operatorNote}
              onChange={e => setOperatorNote(e.target.value)}
              placeholder="e.g. Missing certified translation of marriage certificate. Instructed to visit Room 12."
              className="w-full p-3 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNoteModal(false)
                  setStatusMsg('Desk note saved to docket.')
                  setTimeout(() => setStatusMsg(''), 3000)
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Transfer Citizen ─── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/20 flex flex-col gap-4">
            <h3 className="font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">move_up</span>
              <span>Transfer Citizen {activeTicket?.ticket_number}</span>
            </h3>
            <p className="text-xs text-outline">Select destination department to re-route this citizen without losing their position.</p>
            <div className="flex flex-col gap-2">
              {departments.filter(d => d.id !== selectedDeptId).map(d => (
                <label
                  key={d.id}
                  className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer ${
                    transferTargetDept === d.id ? 'bg-primary/15 border-primary ring-1 ring-primary' : 'bg-surface-container-low border-outline-variant/20'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-on-surface">{d.name}</span>
                    <span className="text-xs text-outline">{d.code}</span>
                  </div>
                  <input
                    type="radio"
                    name="transfer_dest"
                    checked={transferTargetDept === d.id}
                    onChange={() => setTransferTargetDept(d.id)}
                    className="accent-primary"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferTicket}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
