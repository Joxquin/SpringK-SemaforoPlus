import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bike,
  Bus,
  Car,
  Clock,
  Database,
  Gauge,
  RefreshCw,
  Siren,
  Users,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function AnalisisPage() {
  const [camFilter, setCamFilter] = useState('ALL')
  const [limit, setLimit] = useState(100)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await api.getAnalytics(camFilter, limit)
      setAnalytics(data)
    } catch {
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 5000)
    return () => clearInterval(timer)
  }, [camFilter, limit])

  const samples = analytics?.samplesCount || 0
  const hasData = samples > 0
  const timeline = analytics?.timeline || []
  const maxVehiclesInTimeline = Math.max(1, ...timeline.map((t) => t.totalVehicles || 0))
  const totalVehicles = analytics?.totalVehicles || 0

  const composition = [
    {
      label: 'Autos',
      value: analytics?.totalAutos || 0,
      icon: Car,
      color: 'bg-[var(--primary)]',
    },
    {
      label: 'Combis / Buses',
      value: analytics?.totalCombis || 0,
      icon: Bus,
      color: 'bg-[var(--secondary)]',
    },
    {
      label: 'Emergencias',
      value: analytics?.totalEmergencias || 0,
      icon: Siren,
      color: 'bg-[var(--error)]',
    },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-6 sm:p-10 border border-[var(--outline-variant)]/40 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <Database className="w-3.5 h-3.5" />
                PostgreSQL · semaforoplus_v2
              </Badge>
              <Badge variant={hasData ? 'success' : 'secondary'}>
                <BarChart3 className="w-3.5 h-3.5" />
                {samples} muestras YOLOv8
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Análisis Estadístico de Tráfico
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Métricas acumuladas directamente desde las detecciones de Machine Learning y ciclos semafóricos persistidos en PostgreSQL.
            </p>
          </div>

          <Button variant="outlined" size="sm" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {[
            { id: 'ALL', label: 'Ambas Cámaras' },
            { id: 'CAM-01', label: 'CAM-01 (Av. Ejército)' },
            { id: 'CAM-02', label: 'CAM-02 (C. Los Arces)' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setCamFilter(chip.id)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                camFilter === chip.id
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm'
                  : 'bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] border-[var(--outline-variant)] hover:bg-[var(--primary-container)]/30'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {[50, 100, 250].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setLimit(val)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                limit === val
                  ? 'bg-[var(--secondary-container)] text-[var(--on-secondary-container)] border-[var(--secondary)]'
                  : 'bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] border-[var(--outline-variant)]'
              )}
            >
              Últimas {val}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Vehículos Detectados</p>
            <p className="text-2xl font-black mt-0.5">{hasData ? totalVehicles : '--'}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--secondary-container)] text-[var(--on-secondary-container)] flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Latencia Promedio ML</p>
            <p className="text-2xl font-black mt-0.5">
              {hasData ? `${analytics.avgInferenceLatencyMs} ms` : '--'}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] flex items-center justify-center shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Confianza Promedio</p>
            <p className="text-2xl font-black mt-0.5">
              {hasData ? `${analytics.avgConfidence}%` : '--'}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface-container-high)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Verde Prom. SEM-01 / 02</p>
            <p className="text-lg font-black mt-0.5">
              {(analytics?.cyclesRecorded || 0) > 0
                ? `${analytics.avgGreenSem1Seconds}s / ${analytics.avgGreenSem2Seconds}s`
                : '--'}
            </p>
          </div>
        </Card>
      </section>

      {!hasData ? (
        <Card className="p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--primary)]">
            <Database className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold">Sin datos recolectados aún</h3>
          <p className="text-sm text-[var(--on-surface-variant)] max-w-md mx-auto">
            La tabla <code className="font-mono">traffic_measurements</code> en PostgreSQL aún no tiene registros para este filtro. Cuando el microservicio YOLOv8 procese frames de las ESP32-CAM, las gráficas y estadísticas aparecerán aquí automáticamente.
          </p>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Flujo Vehicular Recolectado</h3>
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    Últimas {timeline.length} detecciones reales en PostgreSQL
                  </p>
                </div>
                <Badge variant="outline">Carga prom: {analytics.avgWeightedLoad}</Badge>
              </div>

              <div className="h-52 flex items-end gap-1.5 pt-4 overflow-x-auto">
                {timeline.slice(-40).map((point, idx) => {
                  const pct = Math.max(8, Math.round((point.totalVehicles / maxVehiclesInTimeline) * 100))
                  return (
                    <div
                      key={idx}
                      title={`${point.camId}: ${point.totalVehicles} veh (${point.inferenceLatencyMs}ms) - ${new Date(point.timestamp).toLocaleTimeString()}`}
                      className="flex-1 min-w-[8px] flex flex-col items-center justify-end h-full group"
                    >
                      <div
                        className={cn(
                          'w-full rounded-t-lg transition-all duration-300',
                          point.camId === 'CAM-01'
                            ? 'bg-[var(--primary)] group-hover:opacity-80'
                            : 'bg-[var(--tertiary)] group-hover:opacity-80'
                        )}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--on-surface-variant)] pt-2 border-t border-[var(--outline-variant)]/40">
                <span>Inicio de ventana</span>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" /> CAM-01
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--tertiary)]" /> CAM-02
                  </span>
                </div>
                <span>Más reciente</span>
              </div>
            </Card>

            <Card className="lg:col-span-5 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold">Composición Clasificada (YOLOv8)</h3>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  Distribución por tipo de actor vial detectado
                </p>
              </div>

              <div className="space-y-3.5">
                {composition.map((item) => {
                  const Icon = item.icon
                  const denom = Math.max(1, totalVehicles + (analytics?.totalPeatones || 0))
                  const pct = Math.round((item.value / denom) * 100)
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <Icon className="w-4 h-4 text-[var(--on-surface-variant)]" />
                          {item.label}
                        </span>
                        <span>
                          {item.value} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[var(--surface-container-high)] overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', item.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(analytics?.byCamera || []).map((cam) => (
              <Card key={cam.camId} className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{cam.camId}</h3>
                  <Badge variant="secondary">{cam.samples} muestras</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-[var(--surface-container-low)] p-3">
                    <p className="text-[11px] text-[var(--on-surface-variant)]">Vehículos</p>
                    <p className="text-lg font-black mt-0.5">{cam.totalVehicles}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container-low)] p-3">
                    <p className="text-[11px] text-[var(--on-surface-variant)]">Carga Prom.</p>
                    <p className="text-lg font-black mt-0.5">{cam.avgWeightedLoad}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container-low)] p-3">
                    <p className="text-[11px] text-[var(--on-surface-variant)]">Latencia</p>
                    <p className="text-lg font-black mt-0.5">{cam.avgLatencyMs} ms</p>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
