import { useState, useEffect } from 'react'
import { usersApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { PageLoader, SectionHeader, Alert, StatusBadge } from '../components/ui'
import { Plus, Trash2, Shield } from 'lucide-react'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'operator' })
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    try {
      const res = await usersApi.list()
      setUsers(res.data)
    } catch (e: any) { setError('Failed to load users') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await usersApi.create(form)
      setShowForm(false)
      setForm({ username: '', email: '', password: '', full_name: '', role: 'operator' })
      setSuccess('User created successfully')
      load()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed to create user') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await usersApi.delete(id)
      setSuccess('User deleted')
      load()
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed to delete user') }
    finally { setDeletingId(null) }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <SectionHeader
        title="User Management"
        subtitle="Manage system accounts and role assignments"
        action={
          <button id="add-user-btn" onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /><span>Add User</span>
          </button>
        }
      />

      {error && <Alert type="error"><span>{error}</span></Alert>}
      {success && <Alert type="success"><span>{success}</span></Alert>}

      {showForm && (
        <div className="card p-5">
          <h3 className="mb-4">Create New User</h3>
          <form id="user-create-form" onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Username *</label>
              <input id="user-username-input" className="input" required value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="username" autoComplete="off" />
            </div>
            <div>
              <label className="label">Full Name *</label>
              <input id="user-fullname-input" className="input" required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="user@example.com" />
            </div>
            <div>
              <label className="label">Password *</label>
              <input id="user-password-input" className="input" type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label className="label">Role *</label>
              <select id="user-role-select" className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button id="user-save-btn" type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create User'}</button>
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
                <th className="table-header">Username</th>
                <th className="table-header">Full Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center text-slate-400 py-10">No users</td></tr>
              ) : users.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-semibold">
                        {u.full_name?.charAt(0) || 'U'}
                      </div>
                      <span className="font-mono text-sm">{u.username}</span>
                      {u.id === currentUser?.id && <span className="badge-blue text-xs">You</span>}
                    </div>
                  </td>
                  <td className="table-cell">{u.full_name}</td>
                  <td className="table-cell text-sm text-slate-500">{u.email || '—'}</td>
                  <td className="table-cell">
                    <span className={`flex items-center gap-1 text-xs font-medium ${u.role === 'admin' ? 'text-purple-700' : 'text-slate-600'}`}>
                      {u.role === 'admin' && <Shield size={12} />}
                      {u.role}
                    </span>
                  </td>
                  <td className="table-cell"><StatusBadge status={u.is_active ? 'open' : 'closed'} /></td>
                  <td className="table-cell">
                    {u.id !== currentUser?.id && (
                      <button
                        id={`delete-user-${u.id}`}
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={15} />
                      </button>
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
