import { useState, useRef } from 'react'
import { dataApi } from '../services/api'
import { SectionHeader, Alert } from '../components/ui'
import { Upload, FileText, Download, CheckCircle2, XCircle } from 'lucide-react'

export default function DataImport() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setPreview(null)
      setError('')
      setSuccess('')
    }
  }

  const handleDryRun = async () => {
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const res = await dataApi.importCsv(file, true)
      setPreview(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Validation failed')
    } finally {
      setImporting(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const res = await dataApi.importCsv(file, false)
      const d = res.data
      setSuccess(`Imported ${d.imported_rows} rows. Rejected: ${d.rejected_rows}.`)
      setPreview(null)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const downloadSample = async () => {
    try {
      const res = await dataApi.sampleCsv()
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'qsense_import_template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch { setError('Failed to download sample') }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Data Import & Preprocessing"
        subtitle="Upload CSV files with historical queue observation data"
      />

      <Alert type="info">
        <div>
          <strong>Supported columns:</strong> timestamp, department_id, arrivals, people_waiting, active_counters, completed_services, average_service_time_seconds, observed_waiting_time_seconds.
          Required: <code>timestamp</code>, <code>department_id</code>. Use dry-run to validate before importing.
        </div>
      </Alert>

      {success && <Alert type="success"><span>{success}</span></Alert>}
      {error && <Alert type="error"><span>{error}</span></Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upload card */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="mb-4">Upload CSV File</h3>

          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-600">Click to select CSV file</p>
            <p className="text-xs text-slate-400 mt-1">Max {50}MB · .csv files only</p>
            {file && (
              <div className="mt-3 flex items-center justify-center gap-2 text-teal-600">
                <FileText size={16} />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          <input
            id="csv-file-input"
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex gap-2 mt-4">
            <button
              id="dry-run-btn"
              onClick={handleDryRun}
              disabled={!file || importing}
              className="btn-secondary flex items-center gap-2"
            >
              <CheckCircle2 size={14} />
              {importing ? 'Validating…' : 'Dry Run (Validate)'}
            </button>
            <button
              id="import-btn"
              onClick={handleImport}
              disabled={!file || importing}
              className="btn-primary flex items-center gap-2"
            >
              <Upload size={14} />
              {importing ? 'Importing…' : 'Import Data'}
            </button>
          </div>
        </div>

        {/* Sample download */}
        <div className="card p-5 flex flex-col gap-4">
          <h3>Sample Template</h3>
          <p className="text-sm text-slate-500">Download a sample CSV to see the required format and column names.</p>
          <button id="download-sample-btn" onClick={downloadSample} className="btn-secondary flex items-center gap-2">
            <Download size={14} /><span>Download Template</span>
          </button>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Column Reference</h4>
            {[
              ['timestamp', 'ISO 8601', 'Required'],
              ['department_id', 'Integer', 'Required'],
              ['arrivals', 'Integer', 'Optional'],
              ['people_waiting', 'Integer', 'Optional'],
              ['active_counters', 'Integer', 'Optional'],
              ['completed_services', 'Integer', 'Optional'],
              ['average_service_time_seconds', 'Float', 'Optional'],
              ['observed_waiting_time_seconds', 'Float', 'Optional'],
            ].map(([col, type, req]) => (
              <div key={col} className="flex items-center gap-2 py-1 border-b border-slate-50 last:border-0">
                <code className="text-xs font-mono text-teal-700 flex-1">{col}</code>
                <span className="text-xs text-slate-400">{type}</span>
                <span className={`text-xs ${req === 'Required' ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{req}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview results */}
      {preview && (
        <div className="card p-5 space-y-4">
          <h3>Validation Results (Dry Run)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded p-3 text-center">
              <p className="text-2xl font-semibold text-slate-800">{preview.total_rows}</p>
              <p className="text-xs text-slate-500">Total Rows</p>
            </div>
            <div className="bg-emerald-50 rounded p-3 text-center">
              <p className="text-2xl font-semibold text-emerald-700">{preview.imported_rows}</p>
              <p className="text-xs text-emerald-600">Valid Rows</p>
            </div>
            <div className="bg-red-50 rounded p-3 text-center">
              <p className="text-2xl font-semibold text-red-700">{preview.rejected_rows}</p>
              <p className="text-xs text-red-500">Rejected Rows</p>
            </div>
          </div>
          {preview.errors?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-700 mb-2"><XCircle size={14} className="inline mr-1" />Errors</p>
              <div className="bg-red-50 rounded p-3 space-y-1 max-h-40 overflow-y-auto">
                {preview.errors.map((err: string, i: number) => (
                  <p key={i} className="text-xs text-red-700 font-mono">{err}</p>
                ))}
              </div>
            </div>
          )}
          {preview.warnings?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-amber-700 mb-1">Warnings</p>
              {preview.warnings.map((w: string, i: number) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
            </div>
          )}
          {preview.imported_rows > 0 && (
            <button id="confirm-import-btn" onClick={handleImport} className="btn-primary">
              Confirm Import ({preview.imported_rows} rows)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
