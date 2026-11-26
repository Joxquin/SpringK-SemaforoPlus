import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
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
import { Badge } from '@/components/ui/Badge'
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
  const [notifOpen, setNotifOpen] = useState(false)
  const [incidents, setIncidents] = useState([])
  const [offlineMsg, setOfflineMsg] = useState(null)

  useEffect(() => {
    const loadAlerts = async () => {
      const [incRes, nodeRes] = await Promise.allSettled([
        api.getIncidents(),
        api.getRealtimeNode(),
      ])
      if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) {
        setIncidents(incRes.value)
      }
      if (nodeRes.status === 'fulfilled') {
        setOfflineMsg(nodeRes.value?.offlineMessage || null)
      }
    }
    loadAlerts()
    const timer = setInterval(loadAlerts, 5000)
    return () => clearInterval(timer)
  }, [])

  const openIncidents = incidents.filter((i) => i.status !== 'RESUELTA')
  const badgeCount = openIncidents.length + (offlineMsg ? 1 : 0)

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

          <div className="flex items-center gap-2 sm:gap-3 relative">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              Portal Público
            </Link>

            <div className="relative">
              <Button
                variant="tonal"
                size="icon"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notificaciones"
              >
                <Bell className="w-4 h-4" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--error)] text-[var(--on-error)] text-[10px] font-bold flex items-center justify-center border-2 border-[var(--surface)]">
                    {badgeCount}
                  </span>
                )}
              </Button>

              {notifOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-[28px] bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]/60 shadow-2xl p-4 space-y-3 z-50">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm font-bold">Notificaciones</span>
                    <Badge variant={badgeCount > 0 ? 'danger' : 'secondary'}>
                      {badgeCount} activas
                    </Badge>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {offlineMsg && (
                      <div className="rounded-2xl bg-[var(--error-container)]/70 text-[var(--on-error-container)] p-3 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Hardware Desconectado</p>
                          <p className="mt-0.5 opacity-90">{offlineMsg}</p>
                        </div>
                      </div>
                    )}

                    {openIncidents.length === 0 && !offlineMsg ? (
                      <div className="rounded-2xl bg-[var(--surface-container-low)] p-5 text-center text-xs text-[var(--on-surface-variant)] flex flex-col items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span>No hay incidencias pendientes.</span>
                      </div>
                    ) : (
                      openIncidents.slice(0, 5).map((inc) => (
                        <div
                          key={inc.id}
                          className="rounded-2xl bg-[var(--surface-container-low)] p-3 border border-[var(--outline-variant)]/40 flex items-start justify-between gap-2"
                        >
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold leading-snug">{inc.title}</p>
                              <p className="text-[11px] text-[var(--on-surface-variant)] mt-0.5">
                                {inc.type} · {new Date(inc.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={inc.priority === 'CRITICA' ? 'danger' : 'default'}>
                            {inc.priority}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>

                  <Link
                    to="/admin/incidencias"
                    onClick={() => setNotifOpen(false)}
                    className="block w-full text-center rounded-full py-2.5 text-xs font-semibold bg-[var(--primary-container)] text-[var(--on-primary-container)] hover:opacity-90 transition-opacity"
                  >
                    Ver todas en Incidencias
                  </Link>
                </div>
              )}
            </div>

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
