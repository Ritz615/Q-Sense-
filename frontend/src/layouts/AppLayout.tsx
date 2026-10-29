/**
 * Main application layout with Stitch Infrastructure Cockpit sidebar and top bar.
 * All 15 required pages are reachable with high-fidelity civic tech aesthetics.
 */
import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { dashboardApi } from '../services/api';
import {
  LayoutDashboard, Monitor, Building2, ToggleLeft, Users2,
  Upload, TrendingUp, Cpu, FlaskConical, Lightbulb,
  BarChart3, FileText, Shield, Settings, LogOut,
  Menu, X, Timer, Activity, Bell,
} from 'lucide-react';

const navItems = [
  { label: 'Executive Pulse', icon: LayoutDashboard, path: '/' },
  { label: 'Operator Workstation', icon: Monitor, path: '/queue' },
  { label: 'Resource Sandbox', icon: Cpu, path: '/optimization' },
  { label: 'DL Benchmark Suite', icon: TrendingUp, path: '/forecasting' },
  { label: 'What-If Simulation', icon: FlaskConical, path: '/simulation' },
  { label: 'Explainability & XAI', icon: Lightbulb, path: '/explainability' },
  { label: 'Departments', icon: Building2, path: '/departments' },
  { label: 'Counters', icon: ToggleLeft, path: '/counters' },
  { label: 'Staff Fleet', icon: Users2, path: '/staff' },
  { label: 'Data Ingestion', icon: Upload, path: '/import' },
  { label: 'Telemetry & Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Audits & Reports', icon: FileText, path: '/reports' },
  { label: 'Security & Users', icon: Shield, path: '/users' },
  { label: 'SLA & Policy Rules', icon: Settings, path: '/settings' },
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadNotifications = async () => {
    try {
      const res = await dashboardApi.getEvents({ hours: 12 });
      setNotifications(res.data.slice(0, 8));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toTimeString().split(' ')[0] + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeItems = navItems.filter(item => {
    if (!isAdmin && ['import', 'optimization', 'simulation', 'users', 'settings'].some(r => item.path.includes(r))) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col justify-between bg-surface-container-low border-r border-outline-variant/20 transition-all duration-300
        ${sidebarOpen ? 'w-72 shadow-2xl' : 'w-0 md:w-72'}
        overflow-hidden
      `}>
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="h-16 px-space-md flex items-center justify-between border-b border-outline-variant/15 bg-surface-container-low shrink-0">
            <div className="flex items-center gap-space-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(157,178,191,0.8)]"></div>
              <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">Infrastructure Cockpit</span>
            </div>
            <button
              aria-label="Toggle navigation"
              className="text-on-surface-variant hover:text-on-surface p-space-xs rounded transition-colors md:hidden"
              onClick={() => setSidebarOpen(false)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {/* Kernel Status Badge Card */}
          <div className="px-space-md py-space-sm">
            <div className="p-space-sm bg-surface-container rounded-xl flex flex-col gap-space-xs border border-outline-variant/10 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="font-label-code-sm text-label-code-sm text-on-surface-variant uppercase">Kernel Status</span>
                <span className="flex items-center gap-1.5 font-label-code-sm text-label-code-sm text-secondary font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  Optimal
                </span>
              </div>
              <div className="font-label-code-sm text-label-code-sm text-on-surface truncate">
                Heuristic Dispatch Active
              </div>
              <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden mt-space-xs">
                <div className="bg-primary h-full w-[94%] shadow-[0_0_6px_rgba(157,178,191,0.7)]"></div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-space-sm py-space-xs flex flex-col gap-1 overflow-y-auto">
            {activeItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-space-md px-space-md py-2 rounded-lg transition-all text-sm font-medium ${
                    active
                      ? 'bg-primary-container text-on-primary-container font-semibold shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer District Fleet Sync */}
        <div className="p-space-md bg-surface-container-lowest border-t border-outline-variant/15 flex flex-col gap-space-xs">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-caps text-label-caps uppercase">District Fleet Sync</span>
            <span className="font-label-code-sm text-label-code-sm text-primary font-semibold">98.4% QoS</span>
          </div>
          <div className="flex items-center justify-between font-label-code-sm text-label-code-sm text-on-surface-variant">
            <span>Sync Latency</span>
            <span className="text-secondary font-label-numeric-md text-label-numeric-md">14ms</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-outline-variant/10 mt-1">
            <div className="flex items-center gap-2 truncate">
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                {user?.username?.charAt(0).toUpperCase() || 'A'}
              </div>
              <span className="text-xs text-on-surface truncate">{user?.full_name || user?.username}</span>
            </div>
            <button
              id="logout-btn"
              onClick={logout}
              title="Sign Out"
              className="text-on-surface-variant hover:text-error transition-colors p-1"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-col flex-1 md:pl-72 min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/15 z-40 px-4 md:px-margin-desktop flex items-center justify-between shrink-0">
          <div className="flex items-center gap-space-lg">
            <button
              id="sidebar-toggle-btn"
              className="md:hidden p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg bg-surface-container"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              type="button"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-space-md">
              <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container border border-primary/40 flex items-center justify-center font-bold text-sm shrink-0 shadow-[0_0_12px_rgba(157,178,191,0.3)]">
                Q
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md tracking-tight text-on-surface font-semibold leading-none">
                  Q-Sense AI
                </span>
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant mt-0.5">
                  Queue Optimization Platform
                </span>
              </div>
            </div>
            <div className="hidden xl:flex items-center gap-space-xs px-space-sm py-1 bg-surface-container rounded-full border border-outline-variant/15">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">District Civil Center</span>
              <span className="font-label-code-sm text-label-code-sm text-outline-variant">•</span>
              <span className="font-label-code-sm text-label-code-sm text-secondary">Live Feeds Active (99.8% SLA)</span>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            {/* UTC Clock */}
            <div className="hidden md:flex items-center gap-space-sm px-space-sm py-1 bg-surface-container-low rounded-lg border border-outline-variant/15">
              <Timer size={16} className="text-primary" />
              <span className="font-label-numeric-md text-label-numeric-md text-on-surface">
                {currentTime || '14:32:08 UTC'}
              </span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant px-1 rounded bg-surface-container-high">
                22ms
              </span>
            </div>

            {/* Quick Mode Toggle */}
            <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/15">
              <button
                onClick={() => navigate('/')}
                className={`px-space-sm py-1 font-body-sm text-body-sm rounded transition-colors ${
                  location.pathname === '/'
                    ? 'bg-surface-container-high text-primary font-medium'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                Admin Mode
              </button>
              <button
                onClick={() => navigate('/queue')}
                className={`px-space-sm py-1 font-body-sm text-body-sm rounded transition-colors ${
                  location.pathname.startsWith('/queue')
                    ? 'bg-surface-container-high text-primary font-medium'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                Counter Operator
              </button>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                aria-label="Notifications"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) loadNotifications();
                }}
                className="relative p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-lg bg-surface-container-low border border-outline-variant/15"
                type="button"
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-tertiary"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-2">
                  <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                    <span className="font-label-caps text-label-caps uppercase font-bold text-on-surface">Live Event Stream</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-outline hover:text-on-surface text-xs"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-xs text-on-surface-variant py-4 text-center">No recent alerts in buffer</div>
                    ) : (
                      notifications.map((n, idx) => (
                        <div key={idx} className="p-2 rounded bg-surface-container text-xs flex flex-col gap-0.5 border border-outline-variant/10">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-primary capitalize">{n.event_type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-outline">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <span className="text-on-surface-variant text-[11px]">
                            {n.source} • Dept #{n.department_id || 1}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-space-sm pl-space-xs">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary text-surface font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                {user?.username?.slice(0, 2).toUpperCase() || 'OP'}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="font-body-sm text-body-sm font-semibold text-on-surface leading-tight">
                  {user?.full_name || (isAdmin ? 'Capt. D. Vance' : 'Marcus Vance')}
                </span>
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  {isAdmin ? 'Civic Director' : 'Counter Operator'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Outlet */}
        <main className="flex-1 overflow-y-auto px-4 md:px-margin-desktop py-space-md">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
