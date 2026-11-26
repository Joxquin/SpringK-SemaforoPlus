import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

function computeLanePrediction(camStats, liveCam, horizonMinutes) {
  const samples = camStats?.samples || 0
  if (samples === 0 && !liveCam?.online) {
    return null
  }
  const avgLoad = camStats?.avgWeightedLoad || 0
  const liveVehicles = liveCam?.online
    ? (liveCam.classification?.autos || 0) +
      (liveCam.classification?.combis || 0) +
      (liveCam.classification?.motos || 0)
    : 0
  const baseLoad = liveCam?.online ? Math.max(avgLoad, liveVehicles * 1.1) : avgLoad
  const horizonFactor = horizonMinutes === 15 ? 1.05 : horizonMinutes === 30 ? 1.15 : 1.25
  const projectedLoad = Math.round(baseLoad * horizonFactor * 10) / 10
  const congestionPct = Math.min(100, Math.round(projectedLoad * 7.5))
  const clearanceSeconds = Math.round(projectedLoad * 2.5)
  const recommendedGreen = Math.max(15, Math.min(60, Math.round(15 + projectedLoad * 2.5)))
  const risk = congestionPct >= 70 ? 'ALTO' : congestionPct >= 40 ? 'MODERADO' : 'BAJO'

  return {
    projectedLoad,
    congestionPct,
    clearanceSeconds,
    recommendedGreen,
    risk,
    samples,
  }
}

export function PrediccionesPage() {
  const [horizon, setHorizon] = useState(15)
  const [analytics, setAnalytics] = useState(null)
  const [node, setNode] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [anaRes, nodeRes] = await Promise.allSettled([
        api.getAnalytics('ALL', 100),
        api.getRealtimeNode(),
      ])
      if (anaRes.status === 'fulfilled') setAnalytics(anaRes.value)
      if (nodeRes.status === 'fulfilled') setNode(nodeRes.value)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 5000)
    return () => clearInterval(timer)
  }, [])

  const samples = analytics?.samplesCount || 0
  const byCamera = analytics?.byCamera || []
  const cameras = node?.cameras || []

  const cam1Pred = computeLanePrediction(
    byCamera.find((c) => c.camId === 'CAM-01'),
    cameras.find((c) => c.id === 'CAM-01'),
    horizon
  )
  const cam2Pred = computeLanePrediction(
    byCamera.find((c) => c.camId === 'CAM-02'),
    cameras.find((c) => c.id === 'CAM-02'),
    horizon
  )

  const hasData = Boolean(cam1Pred || cam2Pred)
  const validPreds = [cam1Pred, cam2Pred].filter(Boolean)
  const avgCongestion =
    validPreds.length > 0
      ? Math.round(validPreds.reduce((a, p) => a + p.congestionPct, 0) / validPreds.length)
      : 0
  const avgClearance =
    validPreds.length > 0
      ? Math.round(validPreds.reduce((a, p) => a + p.clearanceSeconds, 0) / validPreds.length)
      : 0
  const baseConfidence = horizon === 15 ? 95 : horizon === 30 ? 88 : 78
  const sampleFactor = Math.min(1, samples / 20)
  const confidence = hasData ? Math.round(baseConfidence * (0.5 + 0.5 * sampleFactor)) : 0

  const lanes = [
    {
      camId: 'CAM-01',
      semId: 'SEM-01',
      avenue: 'Av. Ejército (Norte–Sur)',
      pred: cam1Pred,
    },
    {
      camId: 'CAM-02',
      semId: 'SEM-02',
      avenue: 'Calle Los Arces (Este–Oeste)',
      pred: cam2Pred,
    },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-6 sm:p-10 border border-[var(--outline-variant)]/40 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <Sparkles className="w-3.5 h-3.5" />
                Horizonte +{horizon} min
              </Badge>
              <Badge variant={hasData ? 'success' : 'secondary'}>
                <Database className="w-3.5 h-3.5" />
                {samples} muestras reales
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Predicciones de Congestión
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Proyección de carga vehicular y tiempos óptimos de luz verde calculados a partir del histórico real en PostgreSQL y telemetría YOLOv8.
            </p>
          </div>

          <Button variant="outlined" size="sm" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>
        </div>
      </section>

      <section className="flex items-center gap-2">
        {[15, 30, 60].map((min) => (
          <button
            key={min}
            type="button"
            onClick={() => setHorizon(min)}
            className={cn(
              'px-5 py-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer',
              horizon === min
                ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm'
                : 'bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] border-[var(--outline-variant)] hover:bg-[var(--primary-container)]/30'
            )}
          >
            Horizonte +{min} min
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
              Congestión Proyectada (+{horizon}m)
            </p>
            <p className="text-2xl font-black mt-0.5">{hasData ? `${avgCongestion}%` : '--'}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--secondary-container)] text-[var(--on-secondary-container)] flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
              Tiempo de Despeje Estimado
            </p>
            <p className="text-2xl font-black mt-0.5">{hasData ? `${avgClearance} s` : '--'}</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] flex items-center justify-center shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
              Confianza del Modelo
            </p>
            <p className="text-2xl font-black mt-0.5">{hasData ? `${confidence}%` : '--'}</p>
          </div>
        </Card>
      </section>

      {!hasData ? (
        <Card className="p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--surface-container-high)] flex items-center justify-center text-[var(--primary)]">
            <Activity className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold">Sin histórico suficiente para proyectar</h3>
          <p className="text-sm text-[var(--on-surface-variant)] max-w-md mx-auto">
            No existen mediciones previas en PostgreSQL ni cámaras activas en este momento. Las predicciones se habilitarán automáticamente al recibir datos reales de YOLOv8.
          </p>
        </Card>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {lanes.map((lane) => (
            <Card key={lane.camId} className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="default" className="mb-1.5">
                    {lane.camId} · {lane.semId}
                  </Badge>
                  <h3 className="text-xl font-bold">{lane.avenue}</h3>
                </div>
                {lane.pred ? (
                  <Badge
                    variant={
                      lane.pred.risk === 'ALTO'
                        ? 'danger'
                        : lane.pred.risk === 'MODERADO'
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {lane.pred.risk === 'ALTO' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Riesgo {lane.pred.risk}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Sin datos</Badge>
                )}
              </div>

              {lane.pred ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Congestión proyectada</span>
                      <span>{lane.pred.congestionPct}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-[var(--surface-container-high)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                        style={{ width: `${lane.pred.congestionPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-[var(--surface-container-low)] p-3">
                      <p className="text-[11px] text-[var(--on-surface-variant)]">Carga Proy.</p>
                      <p className="text-lg font-black mt-0.5">{lane.pred.projectedLoad}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface-container-low)] p-3">
                      <p className="text-[11px] text-[var(--on-surface-variant)]">Despeje</p>
                      <p className="text-lg font-black mt-0.5">{lane.pred.clearanceSeconds}s</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--tertiary-container)]/60 p-3">
                      <p className="text-[11px] text-[var(--on-tertiary-container)]">Verde Sugerido</p>
                      <p className="text-lg font-black mt-0.5">{lane.pred.recommendedGreen}s</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--on-surface-variant)] py-4">
                  Sin mediciones registradas para {lane.camId}.
                </p>
              )}
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
