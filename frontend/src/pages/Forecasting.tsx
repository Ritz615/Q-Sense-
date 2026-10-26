import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts'
import { forecastingApi, departmentsApi } from '../services/api'
import { PageLoader, Alert, SectionHeader, StatusBadge } from '../components/ui'
import { TrendingUp, Cpu, RefreshCw } from 'lucide-react'

const MODEL_TYPES = [
  { value: 'baseline', label: 'Historical Baseline', description: 'Time-of-day average — no training needed' },
  { value: 'ma', label: 'Moving Average', description: 'Exponential smoothing' },
  { value: 'rf', label: 'Random Forest', description: 'Ensemble tree-based regressor' },
  { value: 'lstm', label: 'LSTM (Deep Learning)', description: 'Long Short-Term Memory network (requires PyTorch)' },
]

export default function Forecasting() {
  const [departments, setDepartments] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  const [predictions, setPredictions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [predLoading, setPredLoading] = useState(false)
  const [trainLoading, setTrainLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedDept, setSelectedDept] = useState<number>(1)
  const [selectedModel, setSelectedModel] = useState('rf')
  const [horizon, setHorizon] = useState(60)

  const load = async () => {
    try {
      const [dRes, mRes] = await Promise.all([departmentsApi.list(), forecastingApi.listModels()])
      setDepartments(dRes.data)
      setModels(mRes.data)
      if (dRes.data.length > 0) setSelectedDept(dRes.data[0].id)
    } catch { setError('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleTrain = async () => {
    setTrainLoading(true)
    setError('')
    try {
      const res = await forecastingApi.train({ department_id: selectedDept, model_type: selectedModel })
      setSuccessMsg(`Training started for ${selectedModel.toUpperCase()} (ID: ${res.data.model_version_id}). Refresh models after ~10s.`)
      setTimeout(() => forecastingApi.listModels().then(r => setModels(r.data)), 8000)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Training failed')
    } finally {
      setTrainLoading(false)
    }
  }

  const handlePredict = async () => {
    setPredLoading(true)
    setError('')
    try {
      const res = await forecastingApi.predict({ department_id: selectedDept, horizon_minutes: horizon, model_type: selectedModel })
      setPredictions(res.data.predictions)
      setSuccessMsg(`Generated ${res.data.predictions.length} forecast points using ${selectedModel.toUpperCase()}`)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Prediction failed')
    } finally {
      setPredLoading(false)
    }
  }

  if (loading) return <PageLoader />

  const chartData = predictions.map((p: any) => ({
    time: new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    arrivals: parseFloat(p.predicted_arrivals?.toFixed(1) || '0'),
    queue: parseFloat(p.predicted_queue_length?.toFixed(1) || '0'),
    wait: parseFloat(p.predicted_wait_minutes?.toFixed(1) || '0'),
  }))

  const readyModels = models.filter(m => m.status === 'ready' && m.department_id === selectedDept)

  return (
    <div className="space-y-5">
      <SectionHeader title="Forecasting & Model Evaluation" subtitle="Train and evaluate queue demand prediction models" />

      {error && <Alert type="error"><span>{error}</span></Alert>}
      {successMsg && <Alert type="success"><span>{successMsg}</span></Alert>}

      {/* Controls */}
      <div className="card p-5">
        <h3 className="mb-4">Model Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Department</label>
            <select id="forecast-dept-select" className="input" value={selectedDept} onChange={e => setSelectedDept(Number(e.target.value))}>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Model Type</label>
            <select id="model-type-select" className="input" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
              {MODEL_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Forecast Horizon</label>
            <select id="horizon-select" className="input" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <button id="train-model-btn" onClick={handleTrain} disabled={trainLoading} className="btn-secondary flex items-center gap-2 flex-1">
              <Cpu size={14} />{trainLoading ? 'Training…' : 'Train'}
            </button>
            <button id="predict-btn" onClick={handlePredict} disabled={predLoading} className="btn-primary flex items-center gap-2 flex-1">
              <TrendingUp size={14} />{predLoading ? 'Predicting…' : 'Predict'}
            </button>
          </div>
        </div>

        {/* Model description */}
        {MODEL_TYPES.find(m => m.value === selectedModel) && (
          <p className="text-xs text-slate-500 mt-3">
            <strong>{MODEL_TYPES.find(m => m.value === selectedModel)?.label}:</strong>{' '}
            {MODEL_TYPES.find(m => m.value === selectedModel)?.description}
          </p>
        )}
      </div>

      {/* Forecast chart */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3>Forecast: Next {horizon} Minutes</h3>
            <span className="badge-blue">Predicted · {selectedModel.toUpperCase()}</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="arrivals" stroke="#0d9488" strokeWidth={2} dot={false} name="Predicted Arrivals" />
                <Line type="monotone" dataKey="queue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Predicted Queue" />
                <Line type="monotone" dataKey="wait" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Wait (min)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Trained models table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3>Trained Models</h3>
          <button id="refresh-models-btn" onClick={() => forecastingApi.listModels().then(r => setModels(r.data))} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1">
            <RefreshCw size={12} />Refresh
          </button>
        </div>
        <div className="card-body p-0">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header">Model</th>
                <th className="table-header">Type</th>
                <th className="table-header">Status</th>
                <th className="table-header">MAE</th>
                <th className="table-header">RMSE</th>
                <th className="table-header">sMAPE %</th>
                <th className="table-header">Trained At</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-8">No models yet. Train one using the form above.</td></tr>
              ) : models.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50/50">
                  <td className="table-cell font-medium">{m.name}</td>
                  <td className="table-cell"><span className="badge-blue font-mono">{m.model_type}</span></td>
                  <td className="table-cell"><StatusBadge status={m.status} /></td>
                  <td className="table-cell">{m.metrics?.mae?.toFixed(2) ?? '—'}</td>
                  <td className="table-cell">{m.metrics?.rmse?.toFixed(2) ?? '—'}</td>
                  <td className="table-cell">{m.metrics?.smape?.toFixed(1) ?? '—'}</td>
                  <td className="table-cell text-xs text-slate-400">
                    {m.trained_at ? new Date(m.trained_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Alert type="info">
        <div>
          <strong>Note:</strong> Models are trained on synthetic simulation data only. Chronological train/val/test splits (70%/15%/15%) are used.
          Waiting time estimates use the M/M/c queueing approximation. Accuracy on real operational data will differ.
        </div>
      </Alert>
    </div>
  )
}
