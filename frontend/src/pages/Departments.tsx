import { useState, useEffect } from 'react'
import { departmentsApi } from '../services/api'
import { PageLoader, ErrorState, StatusBadge, SectionHeader, Alert } from '../components/ui'
import { Plus, Building2, Edit2, Save, X } from 'lucide-react'

export default function Departments() {
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '', max_counters: 10 })
  const [successMsg, setSuccessMsg] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editData, setEditData] = useState<any>({})

  const load = async () => {
    try {
      const res = await departmentsApi.list()
      setDepartments(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await departmentsApi.create(form)
      setShowForm(false)
      setForm({ name: '', code: '', description: '', max_counters: 10 })
      setSuccessMsg('Department created successfully')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create department')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: number) => {
    setSaving(true)
    try {
      await departmentsApi.update(id, editData)
      setEditId(null)
      setSuccessMsg('Department updated successfully')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update department')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Department Management"
        subtitle="Manage government office departments and their configurations"
        action={
          <button id="add-dept-btn" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /><span>Add Department</span>
          </button>
        }
      />

      {successMsg && <Alert type="success"><span>{successMsg}</span></Alert>}
      {error && <Alert type="error"><span>{error}</span></Alert>}

      {showForm && (
        <div className="card p-5">
          <h3 className="mb-4">New Department</h3>
          <form id="dept-create-form" onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Department Name *</label>
              <input id="dept-name-input" className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Certificate Services" />
            </div>
            <div>
              <label className="label">Code *</label>
              <input id="dept-code-input" className="input" required value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="e.g. CDS" maxLength={8} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description" />
            </div>
            <div>
              <label className="label">Max Counters</label>
              <input className="input" type="number" min={1} max={50} value={form.max_counters} onChange={e => setForm({...form, max_counters: Number(e.target.value)})} />
            </div>
            <div className="flex gap-2 items-end">
              <button id="dept-save-btn" type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create'}</button>
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
                <th className="table-header">Name</th>
                <th className="table-header">Code</th>
                <th className="table-header">Description</th>
                <th className="table-header">Max Counters</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center text-slate-400 py-10">No departments yet</td></tr>
              ) : departments.map((d: any) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" />
                      {editId === d.id ? (
                        <input className="input py-1 text-sm" value={editData.name || d.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                      ) : <span className="font-medium">{d.name}</span>}
                    </div>
                  </td>
                  <td className="table-cell"><span className="badge-blue">{d.code}</span></td>
                  <td className="table-cell text-slate-500 text-xs max-w-xs truncate">{d.description || '—'}</td>
                  <td className="table-cell">
                    {editId === d.id ? (
                      <input className="input w-20 py-1 text-sm" type="number" value={editData.max_counters ?? d.max_counters} onChange={e => setEditData({...editData, max_counters: Number(e.target.value)})} />
                    ) : d.max_counters}
                  </td>
                  <td className="table-cell"><StatusBadge status={d.is_active ? 'active' : 'inactive'} label={d.is_active ? 'Active' : 'Inactive'} /></td>
                  <td className="table-cell">
                    {editId === d.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(d.id)} className="btn-primary py-1 px-2 text-xs flex items-center gap-1" disabled={saving}><Save size={12} />Save</button>
                        <button onClick={() => setEditId(null)} className="btn-secondary py-1 px-2 text-xs"><X size={12} /></button>
                      </div>
                    ) : (
                      <button id={`edit-dept-${d.id}`} onClick={() => { setEditId(d.id); setEditData({}) }} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"><Edit2 size={12} />Edit</button>
                    )}
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
