import { useState, useEffect } from 'react'
import { reportsApi, departmentsApi } from '../services/api'
import { SectionHeader, Alert, PageLoader } from '../components/ui'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'

export default function Reports() {
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<number>(1)
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    departmentsApi.list()
      .then(r => { setDepartments(r.data); if (r.data.length > 0) setSelectedDept(r.data[0].id) })
      .catch(() => setError('Failed to load departments'))
      .finally(() => setLoading(false))
  }, [])

  const downloadFile = async (type: 'csv' | 'pdf') => {
    setDownloading(type)
    setError('')
    setSuccess('')
    try {
      const res = type === 'csv'
        ? await reportsApi.exportCsv(selectedDept, hours)
        : await reportsApi.exportPdf(selectedDept, hours)

      const mime = type === 'csv' ? 'text/csv' : 'application/pdf'
      const ext = type
      const blob = new Blob([res.data], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qsense_report_dept${selectedDept}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      setSuccess(`${type.toUpperCase()} report downloaded successfully`)
    } catch (e: any) {
      setError(e?.response?.data?.detail || `Failed to download ${type.toUpperCase()}`)
    } finally {
      setDownloading(null)
    }
  }

  if (loading) return <PageLoader />

  const deptName = (id: number) => departments.find(d => d.id === id)?.name || `Department ${id}`

  return (
    <div className="space-y-5">
      <SectionHeader title="Export & Reports" subtitle="Download queue performance reports as CSV or PDF" />

      {error && <Alert type="error"><span>{error}</span></Alert>}
      {success && <Alert type="success"><span>{success}</span></Alert>}

      {/* Export card */}
      <div className="card p-5">
        <h3 className="mb-4">Configure Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Department</label>
            <select id="reports-dept-select" className="input" value={selectedDept} onChange={e => setSelectedDept(Number(e.target.value))}>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Time Range</label>
            <select id="reports-range-select" className="input" value={hours} onChange={e => setHours(Number(e.target.value))}>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 2 days</option>
              <option value={168}>Last 7 days</option>
              <option value={720}>Last 30 days</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-3 flex-wrap">
          <button
            id="export-csv-btn"
            onClick={() => downloadFile('csv')}
            disabled={!!downloading}
            className="btn-primary flex items-center gap-2"
          >
            <FileSpreadsheet size={15} />
            {downloading === 'csv' ? 'Generating CSV…' : 'Export CSV'}
          </button>
          <button
            id="export-pdf-btn"
            onClick={() => downloadFile('pdf')}
            disabled={!!downloading}
            className="btn-secondary flex items-center gap-2"
          >
            <FileText size={15} />
            {downloading === 'pdf' ? 'Generating PDF…' : 'Export PDF Report'}
          </button>
        </div>
      </div>

      {/* Report contents info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet size={18} className="text-teal-600" />
            <h3>CSV Export</h3>
          </div>
          <p className="text-sm text-slate-500 mb-3">Raw observation data in tabular format, suitable for further analysis in Excel, Python, or R.</p>
          <div className="space-y-1">
            {['timestamp', 'department_id', 'people_waiting', 'active_counters', 'arrivals_in_interval', 'completed_services', 'avg_service_time_s', 'observed_waiting_time_s', 'source'].map(col => (
              <div key={col} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                <code className="text-xs font-mono text-slate-600">{col}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-slate-500" />
            <h3>PDF Report</h3>
          </div>
          <p className="text-sm text-slate-500 mb-3">Formatted document with summary statistics and tabular observation data.</p>
          <div className="space-y-2">
            {[
              'Report header with department and period info',
              'Generation timestamp',
              'Total observation count',
              'Tabular data (up to 60 rows)',
              'Synthetic data disclaimer footer',
            ].map(item => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                <Download size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Alert type="warning">
        <div><strong>Disclaimer:</strong> All exported data is synthetic simulation data generated by the Q-Sense demonstration system. It does not represent real government operational data and should not be used for official purposes.</div>
      </Alert>
    </div>
  )
}
