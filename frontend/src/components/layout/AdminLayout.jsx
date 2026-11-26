import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  FileText,
  GitFork,
  Globe,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  TrafficCone,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/interseccion', label: 'Intersección', icon: GitFork },
  { to: '/admin/camaras', label: 'Cámaras', icon: Camera },
  { to: '/admin/analisis', label: 'Análisis', icon: BarChart3 },
  { to: '/admin/predicciones', label: 'Predicciones', icon: Sparkles },
  { to: '/admin/incidencias', label: 'Incidencias', icon: AlertTriangle },
  { to: '/admin/reportes', label: 'Reportes', icon: FileText },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export function AdminLayout({ user, onLogout }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {}
    if (onLogout) onLogout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex flex-col selection:bg-[var(--primary-container)] selection:text-[var(--on-primary-container)]">
      <header className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--outline-variant)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link to="/admin" className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center shadow-inner">
              <TrafficCone className="w-6 h-6" />
            </div>
            <div>
              <span className="font-serif font-bold text-xl tracking-tight block leading-none">
                Semáforo+
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                Centro de Control
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              Portal Público
            </Link>
            <ThemeToggle />
            {user && (
              <div className="hidden md:flex items-center gap-2 rounded-full bg-[var(--surface-container-high)] px-3.5 py-1.5 text-xs font-semibold text-[var(--on-surface-variant)]">
                <Activity className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>{user.username}</span>
              </div>
            )}
            <Button variant="tonal" size="sm" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 overflow-x-auto">
          <nav className="flex items-center gap-1.5 min-w-max">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200',
                      isActive
                        ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] shadow-sm'
                        : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    )
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
