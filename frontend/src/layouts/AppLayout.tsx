/**
 * Main application layout with sidebar navigation.
 * All 15 required pages are reachable from here.
 */
import { useState, ReactNode } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Monitor, Building2, ToggleLeft, Users2,
  Upload, TrendingUp, Cpu, FlaskConical, Lightbulb,
  BarChart3, FileText, Shield, Settings, LogOut,
  Menu, X, ChevronRight,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Live Queue', icon: Monitor, path: '/queue' },
  { label: 'Departments', icon: Building2, path: '/departments' },
  { label: 'Counters', icon: ToggleLeft, path: '/counters' },
  { label: 'Staff', icon: Users2, path: '/staff' },
  { label: 'Data Import', icon: Upload, path: '/import' },
  { label: 'Forecasting', icon: TrendingUp, path: '/forecasting' },
  { label: 'Optimization', icon: Cpu, path: '/optimization' },
  { label: 'What-If Sim.', icon: FlaskConical, path: '/simulation' },
  { label: 'Explainability', icon: Lightbulb, path: '/explainability' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Reports', icon: FileText, path: '/reports' },
  { label: 'Users', icon: Shield, path: '/users' },
  { label: 'Settings & Audit', icon: Settings, path: '/settings' },
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeItems = navItems.filter(item => {
    // Non-admin users only see queue and their assigned routes
    if (!isAdmin && ['import', 'optimization', 'simulation', 'users', 'settings'].some(r => item.path.includes(r))) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 flex flex-col bg-navy-900 text-white transition-all duration-200
        ${sidebarOpen ? 'w-56' : 'w-0 md:w-56'}
        overflow-hidden
      `}
        style={{ backgroundColor: '#0f172a' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 min-h-[64px]">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">Q</div>
          <div className="overflow-hidden">
            <p className="font-semibold text-white text-sm whitespace-nowrap">Q-Sense</p>
            <p className="text-xs text-slate-400 whitespace-nowrap">Queue Management</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto scrollbar-hide">
          <p className="section-label">Navigation</p>
          {activeItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={active ? 'nav-link-active mb-0.5 flex' : 'nav-link mb-0.5'}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="text-sm whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            id="logout-btn"
            onClick={logout}
            className="mt-1 flex items-center gap-2 w-full px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 md:ml-56 min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 h-16 flex-shrink-0">
          <button
            id="sidebar-toggle-btn"
            className="md:hidden p-1.5 text-slate-600 hover:text-slate-900"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1">
            <Breadcrumb pathname={location.pathname} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <span className="badge-gray text-xs">Demo Mode</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs: Record<string, string> = {
    '/': 'Dashboard',
    '/queue': 'Live Queue',
    '/departments': 'Departments',
    '/counters': 'Counters',
    '/staff': 'Staff',
    '/import': 'Data Import',
    '/forecasting': 'Forecasting',
    '/optimization': 'Optimization',
    '/simulation': 'What-If Simulation',
    '/explainability': 'Explainability',
    '/analytics': 'Analytics',
    '/reports': 'Reports',
    '/users': 'Users',
    '/settings': 'Settings & Audit',
  };
  const name = crumbs[pathname] || 'Q-Sense';
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-slate-400">Q-Sense</span>
      <ChevronRight size={14} className="text-slate-300" />
      <span className="font-medium text-slate-800">{name}</span>
    </div>
  );
}
