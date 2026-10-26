import { useState, useEffect } from 'react'
import { staffApi, departmentsApi } from '../services/api'
import { PageLoader, SectionHeader, Alert, StatusBadge } from '../components/ui'
import { Plus, UserCheck, UserX } from 'lucide-react'

export default function Staff() {
  const [staff, setStaff] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employee_id: '', full_name: '', department_id: '', shift_start: '09:00', shift_end: '17:00' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [sRes, dRes] = await Promise.all([staffApi.list(), departmentsApi.list()])
      setStaff(sRes.data)
      setDepartments(dRes.data)
    } catch { setError('Failed to load staff data') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleAvailability = async (s: any) => {
    try {
      await staffApi.update(s.id, { is_available: !s.is_available })
      setSuccessMsg(`${s.full_name} marked as ${!s.is_available ? 'available' : 'unavailable'}`)
      load()
    } catch { setError('Failed to update availability') }
  }

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await staffApi.create({ ...form, department_id: form.department_id ? Number(form.department_id) : undefined })
      setShowForm(false)
      setSuccessMsg('Staff member added')
      load()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed to add staff') }
    finally { setSaving(false) }
  }

  const deptName = (id: number) => departments.find((d: any) => d.id === id)?.name || `Dept ${id}`

  if (loading) return <PageLoader />

  const available = staff.filter((s: any) => s.is_available).length

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Staff & Availability"
        subtitle={`${available} of ${staff.length} staff members marked available`}
        action={
          <button id="add-staff-btn" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /><span>Add Staff</span>
          </button>
        }
      />

      {successMsg && <Alert type="success"><span>{successMsg}</span></Alert>}
      {error && <Alert type="error"><span>{error}</span></Alert>}

      {showForm && (
        <div className="card p-5">
          <h3 className="mb-4">Add Staff Member</h3>
          <form id="staff-create-form" onSubmit={createStaff} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Employee ID *</label>
              <input id="staff-empid-input" className="input" required value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} placeholder="EMP0001" />
            </div>
            <div>
              <label className="label">Full Name *</label>
              <input id="staff-name-input" className="input" required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Firstname Lastname" />
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})}>
                <option value="">Select department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Shift Start</label>
              <input className="input" type="time" value={form.shift_start} onChange={e => setForm({...form, shift_start: e.target.value})} />
            </div>
            <div>
              <label className="label">Shift End</label>
              <input className="input" type="time" value={form.shift_end} onChange={e => setForm({...form, shift_end: e.target.value})} />
            </div>
            <div className="flex gap-2 items-end">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add'}</button>
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
                <th className="table-header">Employee ID</th>
                <th className="table-header">Name</th>
                <th className="table-header">Department</th>
                <th className="table-header">Shift</th>
                <th className="table-header">Availability</th>
                <th className="table-header">Toggle</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center text-slate-400 py-10">No staff found</td></tr>
              ) : staff.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="table-cell font-mono text-slate-500 text-xs">{s.employee_id}</td>
                  <td className="table-cell font-medium">{s.full_name}</td>
                  <td className="table-cell text-sm text-slate-500">{s.department_id ? deptName(s.department_id) : '—'}</td>
                  <td className="table-cell text-xs text-slate-500">{s.shift_start} – {s.shift_end}</td>
                  <td className="table-cell"><StatusBadge status={s.is_available ? 'open' : 'closed'} /></td>
                  <td className="table-cell">
                    <button
                      id={`toggle-staff-${s.id}`}
                      onClick={() => toggleAvailability(s)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${s.is_available ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                    >
                      {s.is_available ? <><UserX size={13} />Mark Unavailable</> : <><UserCheck size={13} />Mark Available</>}
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
