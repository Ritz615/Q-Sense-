import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/Login'
import Dashboard from './pages/Dashboard'
import LiveQueue from './pages/LiveQueue'
import Departments from './pages/Departments'
import Counters from './pages/Counters'
import Staff from './pages/Staff'
import DataImport from './pages/DataImport'
import Forecasting from './pages/Forecasting'
import Optimization from './pages/Optimization'
import Simulation from './pages/Simulation'
import Explainability from './pages/Explainability'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import UsersPage from './pages/Users'
import Settings from './pages/Settings'
import { PageLoader } from './components/ui'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth()
  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="queue" element={<LiveQueue />} />
        <Route path="departments" element={<Departments />} />
        <Route path="counters" element={<Counters />} />
        <Route path="staff" element={<Staff />} />
        <Route path="import" element={<AdminRoute><DataImport /></AdminRoute>} />
        <Route path="forecasting" element={<Forecasting />} />
        <Route path="optimization" element={<AdminRoute><Optimization /></AdminRoute>} />
        <Route path="simulation" element={<AdminRoute><Simulation /></AdminRoute>} />
        <Route path="explainability" element={<Explainability />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
