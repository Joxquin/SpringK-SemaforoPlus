import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  Clock,
  Database,
  Download,
  FileText,
  Printer,
  RefreshCw,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function ReportesPage() {
  const [limit, setLimit] = useState(100)
  const [analytics, setAnalytics] = useState(null)
  const [cycles, setCycles] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [anaRes, cycRes, incRes] = await Promise.allSettled([
        api.getAnalytics('ALL', limit),
        api.getCycles(limit),
        api.getIncidents(),
      ])
      if (anaRes.status === 'fulfilled') setAnalytics(anaRes.value)
      if (cycRes.status === 'fulfilled' && Array.isArray(cycRes.value)) setCycles(cycRes.value)
      if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) setIncidents(incRes.value)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [limit])

  const exportCsv = () => {
    const headers = [
      'id',
      'intersectionId',
      'phase',
      'sem1State',
      'sem2State',
      'sem1GreenSeconds',
      'sem2GreenSeconds',
      'cam1Vehicles',
      'cam2Vehicles',
      'mode',
      'timestamp',
    ]
    const rows = cycles.map((c) =>
      [
        c.id,
        c.intersectionId,
        c.phase,
        c.sem1State,
        c.sem2State,
        c.sem1GreenSeconds,
        c.sem2GreenSeconds,
        c.cam1Vehicles,
        c.cam2Vehicles,
        c.mode,
        c.timestamp,
      ].join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `semaforoplus-reporte-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const samples = analytics?.samplesCount || 0
  const hasData = samples > 0 || cycles.length > 0

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-6 sm:p-10 border border-[var(--outline-variant)]/40 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <FileText className="w-3.5 h-3.5" />
                Informe Técnico Comparativo
              </Badge>
              <Badge variant="secondary">
                <Database className="w-3.5 h-3.5" />
                PostgreSQL · {cycles.length} ciclos
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Reportes de Evaluación
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Consolidado real de pruebas comparativas entre temporización fija y adaptativa, listo para imprimir en PDF o exportar a CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="tonal" size="sm" onClick={exportCsv} disabled={cycles.length === 0}>
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
            <Button variant="filled" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </Button>
            <Button variant="outlined" size="sm" onClick={loadData}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      <section className="flex items-center gap-2 print:hidden">
        {[50, 100, 250].map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => setLimit(val)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer',
              limit === val
                ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm'
                : 'bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] border-[var(--outline-variant)]'
            )}
          >
            Últimos {val} registros
          </button>
        ))}
      </section>

      <Card className="p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--outline-variant)]/50">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">
              Proyecto Semáforo+ · Arequipa
            </p>
            <h2 className="text-2xl font-bold mt-1">
              Reporte de Desempeño: Av. Ejército × Calle Los Arces
            </h2>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">
              Generado el {new Date().toLocaleString()} desde PostgreSQL (semaforoplus_v2)
            </p>
          </div>
          <Badge variant="tertiary">INT-01 · Yanahuara</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
              <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
              Muestras ML / Vehículos
            </div>
            <p className="text-xl font-black mt-1">
              {samples > 0 ? `${samples} / ${analytics?.totalVehicles || 0}` : '--'}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
              <Clock className="w-4 h-4 text-[var(--secondary)]" />
              Verde Prom. SEM-01 / 02
            </div>
            <p className="text-xl font-black mt-1">
              {cycles.length > 0
                ? `${analytics?.avgGreenSem1Seconds || 0}s / ${analytics?.avgGreenSem2Seconds || 0}s`
                : '--'}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
              <Activity className="w-4 h-4 text-[var(--tertiary)]" />
              Ciclos Adapt. / Fijos
            </div>
            <p className="text-xl font-black mt-1">
              {cycles.length > 0
                ? `${analytics?.adaptiveCycles || 0} / ${analytics?.fixedCycles || 0}`
                : '--'}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-container-low)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
              <FileText className="w-4 h-4 text-[var(--error)]" />
              Incidencias Registradas
            </div>
            <p className="text-xl font-black mt-1">{incidents.length}</p>
          </div>
        </div>

        {!hasData ? (
          <div className="rounded-2xl bg-[var(--surface-container-low)] p-8 text-center text-sm text-[var(--on-surface-variant)]">
            Aún no hay ciclos ni detecciones guardadas en PostgreSQL para generar tablas comparativas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]/50 text-[var(--on-surface-variant)]">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Fase</th>
                  <th className="py-2 pr-3">Verde SEM-01</th>
                  <th className="py-2 pr-3">Verde SEM-02</th>
                  <th className="py-2 pr-3">Veh. CAM-01</th>
                  <th className="py-2 pr-3">Veh. CAM-02</th>
                  <th className="py-2 pr-3">Modo</th>
                  <th className="py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {cycles.slice(0, 20).map((c) => (
                  <tr key={c.id} className="border-b border-[var(--outline-variant)]/20">
                    <td className="py-2 pr-3 font-mono">{c.id}</td>
                    <td className="py-2 pr-3 font-semibold">{c.phase}</td>
                    <td className="py-2 pr-3">{c.sem1GreenSeconds}s</td>
                    <td className="py-2 pr-3">{c.sem2GreenSeconds}s</td>
                    <td className="py-2 pr-3">{c.cam1Vehicles}</td>
                    <td className="py-2 pr-3">{c.cam2Vehicles}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{c.mode}</Badge>
                    </td>
                    <td className="py-2">{new Date(c.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
