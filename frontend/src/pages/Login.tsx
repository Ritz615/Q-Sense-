import { useState, FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/ui'
import { Eye, EyeOff, Lock } from 'lucide-react'

export default function LoginPage() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-900 text-white mb-4" style={{backgroundColor:'#0f172a'}}>
            <span className="text-2xl font-bold text-teal-400">Q</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Q-Sense</h1>
          <p className="text-sm text-slate-500 mt-1">Intelligent Queue Management System</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} className="text-slate-400" />
            <h2 className="text-base font-medium text-slate-700">Administrator Sign In</h2>
          </div>

          <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="username-input">Username</label>
              <input
                id="username-input"
                type="text"
                className="input"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="password-input">Password</label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  id="toggle-password-btn"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div id="login-error" className="alert-error text-sm">
                <span>{error}</span>
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading && <Spinner size={16} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">Demo credentials</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs bg-slate-50 px-3 py-1.5 rounded">
                <span className="text-slate-500">Admin:</span>
                <span className="font-mono text-slate-700">admin / QSense@Admin2024</span>
              </div>
              <div className="flex justify-between text-xs bg-slate-50 px-3 py-1.5 rounded">
                <span className="text-slate-500">Operator:</span>
                <span className="font-mono text-slate-700">operator / Operator@2024</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Q-Sense v1.0 · Research Prototype · All data is synthetic
        </p>
      </div>
    </div>
  )
}
