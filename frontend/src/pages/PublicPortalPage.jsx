import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Clock,
  Gauge,
  Leaf,
  Lock,
  ShieldCheck,
  TrafficCone,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils'

export function PublicPortalPage() {
  const [overview, setOverview] = useState(null)
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString())

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getPublicOverview()
        setOverview(data)
      } catch {}
    }
    load()
    const pollTimer = setInterval(load, 3000)
    const clockTimer = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000)
    return () => {
      clearInterval(pollTimer)
      clearInterval(clockTimer)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex flex-col">
      <header className="sticky top-0 z-40 h-20 bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--outline-variant)]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center shadow-inner">
              <TrafficCone className="w-6 h-6" />
            </div>
            <div>
              <span className="font-serif font-bold text-xl tracking-tight block leading-none">
                Semáforo+
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                Arequipa · Portal Ciudadano
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {clock}
            </Badge>
            <ThemeToggle />
            <Link to="/admin">
              <Button variant="filled" size="sm">
                <Lock className="w-3.5 h-3.5" />
                Administración
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-8 sm:p-12 border border-[var(--outline-variant)]/40 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={overview?.iotConnected ? 'success' : 'danger'}>
              {overview?.iotConnected ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              {overview?.iotConnected ? 'Hardware Conectado' : 'Hardware en Espera'}
            </Badge>
            <Badge variant="tertiary">
              <ShieldCheck className="w-3.5 h-3.5" />
              {overview?.corridorStatus || 'CARGANDO'}
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            {overview?.intersectionName || 'Av. Ejército × Calle Los Arces (Yanahuara)'}
          </h1>

          <div className="space-y-2 max-w-xl">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
              <span>Nivel de Congestión General</span>
              <span>{overview?.iotConnected ? `${overview.overallCongestionPercent}%` : '--'}</span>
            </div>
            <div className="h-3.5 rounded-full bg-[var(--surface-container-highest)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                style={{ width: `${overview?.overallCongestionPercent || 0}%` }}
              />
            </div>
          </div>
        </section>

        {overview?.offlineMessage && (
          <Card className="p-5 bg-[var(--error-container)]/70 border-[var(--error)]/30">
            <div className="flex items-start gap-3 text-[var(--on-error-container)]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Aviso de Dispositivos IoT</p>
                <p className="text-xs mt-1">{overview.offlineMessage}</p>
              </div>
            </div>
          </Card>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Espera Promedio</p>
              <p className="text-2xl font-black mt-0.5">
                {overview?.iotConnected ? `${overview.averageWaitSeconds} s` : '--'}
              </p>
            </div>
          </Card>
          <Card className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--secondary-container)] text-[var(--on-secondary-container)] flex items-center justify-center">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Velocidad Media</p>
              <p className="text-2xl font-black mt-0.5">
                {overview?.iotConnected ? `${overview.averageSpeedKmh} km/h` : '--'}
              </p>
            </div>
          </Card>
          <Card className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] flex items-center justify-center">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Ahorro CO₂ Estimado</p>
              <p className="text-2xl font-black mt-0.5">
                {overview?.iotConnected ? `${overview.co2SavedKg} kg` : '--'}
              </p>
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(overview?.lanes || []).map((lane) => (
            <Card key={lane.id} interactive className="p-6 flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <Badge variant={lane.online ? 'success' : 'danger'}>
                  {lane.id} · {lane.online ? 'En línea' : 'Sin señal'}
                </Badge>
                <h3 className="text-2xl font-bold">{lane.avenue}</h3>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  Vehículos detectados: <strong>{lane.online ? lane.vehicleCount : '--'}</strong>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-3xl font-black">
                    {lane.online ? `${lane.remainingSeconds}s` : '--'}
                  </p>
                  <p className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">
                    {lane.lightState}
                  </p>
                </div>
                <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-[var(--surface-container-high)]">
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full',
                      lane.lightState === 'RED' ? 'bg-red-500' : 'bg-red-500/20'
                    )}
                  />
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full',
                      lane.lightState === 'YELLOW'
                        ? 'bg-amber-400'
                        : lane.lightState === 'STANDBY'
                        ? 'bg-amber-400/50 animate-pulse'
                        : 'bg-amber-400/20'
                    )}
                  />
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full',
                      lane.lightState === 'GREEN' ? 'bg-emerald-500' : 'bg-emerald-500/20'
                    )}
                  />
                </div>
              </div>
            </Card>
          ))}
        </section>
      </main>
    </div>
  )
}
