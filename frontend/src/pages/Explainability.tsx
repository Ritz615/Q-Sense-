import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { explainApi, forecastingApi, optimizationApi, departmentsApi } from '../services/api'
import { PageLoader, Alert, SectionHeader } from '../components/ui'
import { Lightbulb, Info } from 'lucide-react'

export default function Explainability() {
  const [departments, setDepartments] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedModel, setSelectedModel] = useState<number | null>(null)
  const [selectedRec, setSelectedRec] = useState<number | null>(null)
  const [selectedDept, setSelectedDept] = useState<number>(1)
  const [importance, setImportance] = useState<any[]>([])
  const [recExplain, setRecExplain] = useState<any>(null)
  const [context, setContext] = useState<any>(null)
  const [impLoading, setImpLoading] = useState(false)
  const [recLoading, setRecLoading] = useState(false)
  const [ctxLoading, setCtxLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      departmentsApi.list(),
      forecastingApi.listModels(),
      optimizationApi.listRecommendations({}),
    ]).then(([dRes, mRes, rRes]) => {
      setDepartments(dRes.data)
      const readyModels = mRes.data.filter((m: any) => m.status === 'ready')
      setModels(readyModels)
      const recList = rRes.data.slice(0, 10)
      setRecommendations(recList)
      
      const firstDeptId = dRes.data.length > 0 ? dRes.data[0].id : 1
      setSelectedDept(firstDeptId)
      explainApi.predictionContext(firstDeptId).then(res => setContext(res.data)).catch(() => {})

      const treeModel = readyModels.find((m: any) => m.model_type === 'rf' || m.model_type === 'gb') || readyModels[0]
      if (treeModel) {
        setSelectedModel(treeModel.id)
        explainApi.featureImportance(treeModel.id).then(res => setImportance(res.data.feature_importance || [])).catch(() => {})
      }

      if (recList.length > 0) {
        setSelectedRec(recList[0].id)
        explainApi.recommendation(recList[0].id).then(res => setRecExplain(res.data)).catch(() => {})
      }
    }).catch(() => setError('Failed to load data'))
    .finally(() => setLoading(false))
  }, [])

  const loadImportance = async (modelId: number) => {
    if (!modelId) {
      setSelectedModel(null)
      setImportance([])
      return
    }
    setImpLoading(true)
    try {
      const res = await explainApi.featureImportance(modelId)
      setImportance(res.data.feature_importance || [])
      setSelectedModel(modelId)
    } catch { setError('Failed to load feature importance') }
    finally { setImpLoading(false) }
  }

  const loadRecExplain = async (recId: number) => {
    if (!recId) {
      setSelectedRec(null)
      setRecExplain(null)
      return
    }
    setRecLoading(true)
    try {
      const res = await explainApi.recommendation(recId)
      setRecExplain(res.data)
      setSelectedRec(recId)
    } catch { setError('Failed to load recommendation explanation') }
    finally { setRecLoading(false) }
  }

  const loadContext = async (deptId?: number) => {
    const targetDept = deptId !== undefined ? deptId : selectedDept
    setCtxLoading(true)
    try {
      const res = await explainApi.predictionContext(targetDept)
      setContext(res.data)
    } catch { setError('Failed to load context') }
    finally { setCtxLoading(false) }
  }

  if (loading) return <PageLoader />

  const importanceChartData = importance
    .filter((f: any) => f.importance !== null)
    .sort((a: any, b: any) => b.importance - a.importance)
    .slice(0, 10)
    .map((f: any) => ({
      feature: f.feature,
      importance: parseFloat((f.importance * 100).toFixed(2)),
    }))

  return (
    <div className="space-y-5">
      <SectionHeader title="Explainability & Decision Transparency" subtitle="Understand model decisions, feature drivers, and recommendation rationale" />

      {error && <Alert type="error"><span>{error}</span></Alert>}

      {/* Queue narrative */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3>Queue Trend Narrative</h3>
          <div className="flex gap-2 items-center">
            <select
              id="context-dept-select"
              className="input w-52"
              value={selectedDept}
              onChange={e => {
                const deptId = Number(e.target.value)
                setSelectedDept(deptId)
                loadContext(deptId)
              }}
            >
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button id="get-context-btn" onClick={() => loadContext(selectedDept)} disabled={ctxLoading} className="btn-secondary text-sm py-2">
              {ctxLoading ? 'Loading…' : 'Get Narrative'}
            </button>
          </div>
        </div>

        {context ? (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">{context.narrative}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-slate-50 p-3 rounded"><span className="text-slate-500">Trend</span><p className="font-semibold capitalize text-slate-800">{context.trend}</p></div>
              <div className="bg-slate-50 p-3 rounded"><span className="text-slate-500">Current Queue</span><p className="font-semibold text-slate-800">{context.current_queue}</p></div>
              <div className="bg-slate-50 p-3 rounded"><span className="text-slate-500">Active Counters</span><p className="font-semibold text-slate-800">{context.current_counters}</p></div>
              <div className="bg-slate-50 p-3 rounded"><span className="text-slate-500">Queue Change</span><p className={`font-semibold ${context.queue_delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{context.queue_delta > 0 ? '+' : ''}{context.queue_delta}</p></div>
            </div>
            <p className="text-xs text-slate-400">{context.note}</p>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Lightbulb size={28} className="mx-auto mb-2" />
            <p className="text-sm">Select a department and click "Get Narrative"</p>
          </div>
        )}
      </div>

      {/* Feature importance */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3>Feature Importance</h3>
          <select id="model-explain-select" className="input w-56" value={selectedModel || ''} onChange={e => loadImportance(Number(e.target.value))}>
            <option value="">Select a trained model</option>
            {models.map((m: any) => <option key={m.id} value={m.id}>{m.name} (v{m.version?.slice(0,8)})</option>)}
          </select>
        </div>

        {impLoading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Loading importance data…</div>
        ) : importanceChartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={importanceChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={160} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Importance']} />
                <Bar dataKey="importance" fill="#0d9488" radius={[0,2,2,0]} name="Importance %" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 mt-2">Higher importance = greater influence on predictions. Derived from tree model Gini impurity reduction.</p>
          </>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">{models.length === 0 ? 'No trained models available. Train a Random Forest or Gradient Boosting model first.' : 'Select a model to view feature importance'}</p>
          </div>
        )}
      </div>

      {/* Recommendation explanation */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3>Recommendation Explanation</h3>
          <select id="rec-explain-select" className="input w-56" value={selectedRec || ''} onChange={e => loadRecExplain(Number(e.target.value))}>
            <option value="">Select a recommendation</option>
            {recommendations.map((r: any) => <option key={r.id} value={r.id}>Rec #{r.id} — Dept {r.department_id}</option>)}
          </select>
        </div>

        {recLoading ? (
          <div className="text-center py-6 text-slate-400 text-sm">Loading…</div>
        ) : recExplain ? (
          <div className="space-y-3">
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
              <p className="text-sm text-teal-800">{recExplain.summary}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded text-sm"><span className="text-slate-500 block">Counter Change</span><span className={`font-semibold ${recExplain.change > 0 ? 'text-teal-600' : recExplain.change < 0 ? 'text-amber-600' : 'text-slate-700'}`}>{recExplain.change > 0 ? '+' : ''}{recExplain.change}</span></div>
              <div className="bg-slate-50 p-3 rounded text-sm"><span className="text-slate-500 block">Wait Reduction</span><span className="font-semibold text-emerald-700">{recExplain.estimated_wait_reduction_minutes ? `${recExplain.estimated_wait_reduction_minutes.toFixed(1)} min` : '—'}</span></div>
              <div className="bg-slate-50 p-3 rounded text-sm"><span className="text-slate-500 block">Solver Status</span><span className="font-semibold">{recExplain.solver_status}</span></div>
            </div>
            {recExplain.key_factors?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Key Factors</p>
                <ul className="space-y-1">
                  {recExplain.key_factors.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="text-teal-500 mt-0.5">•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-400">{recExplain.note}</p>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-sm">Select a recommendation to explain</div>
        )}
      </div>

      <Alert type="info">
        <div><strong>Transparency Note:</strong> All explanations are derived from model weights and optimization outputs on synthetic data. Feature importance uses Gini impurity reduction (tree models). Narrative is rule-based. LIME/SHAP integration planned for v2.</div>
      </Alert>
    </div>
  )
}
