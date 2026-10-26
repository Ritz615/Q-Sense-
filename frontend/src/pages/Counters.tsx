import { useState, useEffect } from 'react'
import { countersApi, departmentsApi } from '../services/api'
import { PageLoader, StatusBadge, SectionHeader, Alert } from '../components/ui'
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react'

export default function Counters() {
  const [counters, setCounters] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [deptFilter, setDeptFilter] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ department_id: '', name: '', number: '', opening_time: '09:00', closing_time: '17:00' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        countersApi.list(deptFilter || undefined),
        departmentsApi.list(),
      ])
      setCounters(cRes.data)
      setDepartments(dRes.data)
    } catch (e: any) {
      setError('Failed to load counters')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [deptFilter])

  const toggleStatus = async (counter: any) => {
    const newStatus = counter.status === 'open' ? 'closed' : 'open'
    try {
      await countersApi.update(counter.id, { status: newStatus })
      setSuccessMsg(`Counter ${counter.name} set to ${newStatus}`)
      load()
    } catch { setError('Failed to update counter status') }
  }

  const createCounter = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await countersApi.create({
        department_id: Number(form.department_id),
        name: form.name,
        number: Number(form.number),
        opening_time: form.opening_time,
        closing_time: form.closing_time,
      })
      setShowForm(false)
      setSuccessMsg('Counter created')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create counter')
    } finally {
      setSaving(false)
    }
  }

  const deptName = (id: number) => departments.find((d: any) => d.id === id)?.name || `Dept ${id}`

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Counter Management"
        subtitle="Open, close, and configure service counters"
        action={
          <button id="add-counter-btn" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /><span>Add Counter</span>
          </button>
        }
      />

      {successMsg && <Alert type="success"><span>{successMsg}</span></Alert>}
      {error && <Alert type="error"><span>{error}</span></Alert>}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setDeptFilter(null)} className={deptFilter === null ? 'btn-primary text-xs py-1.5' : 'btn-secondary text-xs py-1.5'}>All</button>
        {departments.map((d: any) => (
          <button key={d.id} onClick={() => setDeptFilter(d.id)} className={deptFilter === d.id ? 'btn-primary text-xs py-1.5' : 'btn-secondary text-xs py-1.5'}>{d.code}</button>
        ))}
      </div>

      {showForm && (
        <div className="card p-5">
          <h3 className="mb-4">New Counter</h3>
          <form id="counter-create-form" onSubmit={createCounter} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Department *</label>
              <select id="counter-dept-select" className="input" required value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})}>
                <option value="">Select department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Counter Name *</label>
              <input id="counter-name-input" className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Counter 5" />
            </div>
            <div>
              <label className="label">Counter Number *</label>
              <input id="counter-number-input" className="input" type="number" required value={form.number} onChange={e => setForm({...form, number: e.target.value})} min={1} />
            </div>
            <div>
              <label className="label">Opening Time</label>
              <input className="input" type="time" value={form.opening_time} onChange={e => setForm({...form, opening_time: e.target.value})} />
            </div>
            <div>
              <label className="label">Closing Time</label>
              <input className="input" type="time" value={form.closing_time} onChange={e => setForm({...form, closing_time: e.target.value})} />
            </div>
            <div className="flex gap-2 items-end">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-body p-0">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Name</th>
                <th className="table-header">Department</th>
                <th className="table-header">Status</th>
                <th className="table-header">Hours</th>
                <th className="table-header">Toggle</th>
              </tr>
            </thead>
            <tbody>
              {counters.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center text-slate-400 py-10">No counters found</td></tr>
              ) : counters.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="table-cell font-mono text-slate-500">{c.number}</td>
                  <td className="table-cell font-medium">{c.name}</td>
                  <td className="table-cell text-sm text-slate-500">{deptName(c.department_id)}</td>
                  <td className="table-cell"><StatusBadge status={c.status} /></td>
                  <td className="table-cell text-xs text-slate-400">{c.opening_time} – {c.closing_time}</td>
                  <td className="table-cell">
                    <button
                      id={`toggle-counter-${c.id}`}
                      onClick={() => toggleStatus(c)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${c.status === 'open' ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                    >
                      {c.status === 'open' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {c.status === 'open' ? 'Close' : 'Open'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
