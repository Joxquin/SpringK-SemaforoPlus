import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  GitFork,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

function getLampFill(state, target) {
  if (state === target) {
    if (target === 'GREEN') return '#10b981'
    if (target === 'YELLOW') return '#f59e0b'
    if (target === 'RED') return '#ef4444'
  }
  if (state === 'STANDBY' && target === 'YELLOW') {
    return '#f59e0b80'
  }
  return '#3f3f4640'
}

export function InterseccionPage() {
  const [intersections, setIntersections] = useState([])
  const [node, setNode] = useState(null)
  const [cycles, setCycles] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [mode, setMode] = useState('ADAPTATIVO')
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState('INT-01')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [intRes, nodeRes, cycRes, measRes, modeRes] = await Promise.allSettled([
        api.getIntersections(),
        api.getRealtimeNode(),
        api.getCycles(15),
        api.getMeasurements(12),
        api.getMode(),
      ])

      if (intRes.status === 'fulfilled' && Array.isArray(intRes.value)) {
        setIntersections(intRes.value)
        if (intRes.value.length > 0 && !selectedId) {
          setSelectedId(intRes.value[0].id)
        }
      }
      if (nodeRes.status === 'fulfilled') setNode(nodeRes.value)
      if (cycRes.status === 'fulfilled' && Array.isArray(cycRes.value)) setCycles(cycRes.value)
      if (measRes.status === 'fulfilled' && Array.isArray(measRes.value)) setMeasurements(measRes.value)
      if (modeRes.status === 'fulfilled' && modeRes.value?.mode) setMode(modeRes.value.mode)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 3000)
    return () => clearInterval(timer)
  }, [])

  const handleToggleMode = async () => {
    const next = mode === 'ADAPTATIVO' ? 'FIJO' : 'ADAPTATIVO'
    try {
      const res = await api.setMode(next)
      setMode(res.mode)
      loadData()
    } catch {}
  }

  const filteredIntersections = intersections.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.zone.toLowerCase().includes(search.toLowerCase())
    const matchesMode = modeFilter === 'ALL' || mode === modeFilter
    return matchesSearch && matchesMode
  })

  const selected =
    intersections.find((i) => i.id === selectedId) || intersections[0] || null

  const sem1 = node?.trafficLights?.[0] || {
    id: 'SEM-01',
    name: 'Semáforo Norte',
    avenue: 'Av. Ejército',
    currentState: 'STANDBY',
    remainingSeconds: 0,
    greenAllocatedSeconds: 25,
    online: false,
  }
  const sem2 = node?.trafficLights?.[1] || {
    id: 'SEM-02',
    name: 'Semáforo Este',
    avenue: 'Calle Los Arces',
    currentState: 'STANDBY',
    remainingSeconds: 0,
    greenAllocatedSeconds: 20,
    online: false,
  }
  const cam1 = node?.cameras?.[0] || { id: 'CAM-01', online: false, classification: {} }
  const cam2 = node?.cameras?.[1] || { id: 'CAM-02', online: false, classification: {} }

  const cam1Total = cam1.online
    ? (cam1.classification?.autos || 0) +
      (cam1.classification?.combis || 0) +
      (cam1.classification?.motos || 0)
    : 0
  const cam2Total = cam2.online
    ? (cam2.classification?.autos || 0) +
      (cam2.classification?.combis || 0) +
      (cam2.classification?.motos || 0)
    : 0

  const limits = node?.safetyLimits || {
    minGreenSeconds: 15,
    maxGreenSeconds: 60,
    yellowSeconds: 3,
    allRedSeconds: 2,
    pedestrianClearanceSeconds: 10,
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-6 sm:p-10 border border-[var(--outline-variant)]/40 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <GitFork className="w-3.5 h-3.5" />
                {intersections.length} Intersección Monitoreada
              </Badge>
              <Badge variant={node?.iotConnected ? 'success' : 'danger'}>
                {node?.iotConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {node?.iotConnected ? 'Hardware En Línea' : 'Hardware Desconectado'}
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Control de Intersección Vial
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Esquema geométrico en vivo, fases semafóricas, límites de seguridad e historial de ciclos reales registrados en PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="tonal" size="sm" onClick={handleToggleMode}>
              <Zap className="w-4 h-4" />
              Modo: {mode}
            </Button>
            <Button variant="outlined" size="sm" onClick={loadData}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {node?.offlineMessage && (
        <Card className="p-5 bg-[var(--error-container)]/70 border-[var(--error)]/30">
          <div className="flex items-start gap-3 text-[var(--on-error-container)]">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Hardware No Disponible</p>
              <p className="text-xs mt-1">{node.offlineMessage}</p>
            </div>
          </div>
        </Card>
      )}

      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, avenida o zona..."
            className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: 'Todas' },
            { id: 'ADAPTATIVO', label: 'Adaptativo' },
            { id: 'FIJO', label: 'Fijo' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setModeFilter(chip.id)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                modeFilter === chip.id
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm'
                  : 'bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] border-[var(--outline-variant)] hover:bg-[var(--primary-container)]/30'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4">
        {filteredIntersections.map((item) => (
          <Card
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={cn(
              'p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all',
              selected?.id === item.id && 'ring-2 ring-[var(--primary)]'
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="default">{item.id}</Badge>
                <Badge variant="secondary">{item.zone}</Badge>
                <Badge variant={node?.iotConnected ? 'success' : 'danger'}>
                  {node?.iotConnected ? 'CONECTADA' : 'SIN SEÑAL'}
                </Badge>
              </div>
              <h3 className="text-xl font-bold">{item.name}</h3>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Coordenadas: {item.latitude}, {item.longitude} · Fase actual: {node?.currentPhase || 'STANDBY'}
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Av. Ejército</p>
                <p className="text-lg font-black">{cam1.online ? `${cam1Total} veh` : '--'}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">C. Los Arces</p>
                <p className="text-lg font-black">{cam2.online ? `${cam2Total} veh` : '--'}</p>
              </div>
              <Badge variant="tertiary">{mode}</Badge>
            </div>
          </Card>
        ))}
      </section>

      {selected && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Esquema Vial en Vivo</h2>
                <p className="text-xs text-[var(--on-surface-variant)]">{selected.name}</p>
              </div>
              <Badge variant={node?.activeEmergencyPriority ? 'danger' : 'outline'}>
                {node?.currentPhase || 'STANDBY'}
              </Badge>
            </div>

            <div className="rounded-3xl bg-[var(--surface-container-low)] p-4 border border-[var(--outline-variant)]/40 flex items-center justify-center">
              <svg viewBox="0 0 440 320" className="w-full max-w-lg h-auto">
                <rect x="0" y="0" width="440" height="320" rx="20" fill="transparent" />

                <rect x="175" y="10" width="90" height="300" rx="8" fill="var(--surface-container-highest)" />
                <rect x="20" y="115" width="400" height="90" rx="8" fill="var(--surface-container-highest)" />

                <line x1="220" y1="15" x2="220" y2="110" stroke="var(--outline)" strokeWidth="2" strokeDasharray="8 6" />
                <line x1="220" y1="210" x2="220" y2="305" stroke="var(--outline)" strokeWidth="2" strokeDasharray="8 6" />
                <line x1="25" y1="160" x2="170" y2="160" stroke="var(--outline)" strokeWidth="2" strokeDasharray="8 6" />
                <line x1="270" y1="160" x2="415" y2="160" stroke="var(--outline)" strokeWidth="2" strokeDasharray="8 6" />

                <rect x="140" y="34" width="24" height="62" rx="8" fill="#18181b" />
                <circle cx="152" cy="48" r="6" fill={getLampFill(sem1.currentState, 'RED')} />
                <circle cx="152" cy="65" r="6" fill={getLampFill(sem1.currentState, 'YELLOW')} />
                <circle cx="152" cy="82" r="6" fill={getLampFill(sem1.currentState, 'GREEN')} />

                <text x="220" y="28" textAnchor="middle" fill="var(--on-surface)" fontSize="11" fontWeight="700">
                  Av. Ejército (SEM-01: {sem1.online ? `${sem1.remainingSeconds}s` : 'OFF'})
                </text>
                <text x="220" y="302" textAnchor="middle" fill="var(--on-surface-variant)" fontSize="11" fontWeight="600">
                  CAM-01: {cam1.online ? `${cam1Total} vehículos` : 'Sin señal'}
                </text>

                <rect x="285" y="218" width="62" height="24" rx="8" fill="#18181b" />
                <circle cx="299" cy="230" r="6" fill={getLampFill(sem2.currentState, 'RED')} />
                <circle cx="316" cy="230" r="6" fill={getLampFill(sem2.currentState, 'YELLOW')} />
                <circle cx="333" cy="230" r="6" fill={getLampFill(sem2.currentState, 'GREEN')} />

                <text x="345" y="106" textAnchor="middle" fill="var(--on-surface)" fontSize="11" fontWeight="700">
                  C. Los Arces (SEM-02: {sem2.online ? `${sem2.remainingSeconds}s` : 'OFF'})
                </text>
                <text x="95" y="106" textAnchor="middle" fill="var(--on-surface-variant)" fontSize="11" fontWeight="600">
                  CAM-02: {cam2.online ? `${cam2Total} veh` : 'Sin señal'}
                </text>
              </svg>
            </div>
          </Card>

          <div className="lg:col-span-5 space-y-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Límites de Seguridad</h3>
                  <p className="text-xs text-[var(--on-surface-variant)]">Parámetros del controlador adaptativo</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                  <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Verde Mínimo</p>
                  <p className="text-lg font-black mt-0.5">{limits.minGreenSeconds}s</p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                  <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Verde Máximo</p>
                  <p className="text-lg font-black mt-0.5">{limits.maxGreenSeconds}s</p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                  <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Ámbar / Todo Rojo</p>
                  <p className="text-lg font-black mt-0.5">{limits.yellowSeconds}s / {limits.allRedSeconds}s</p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                  <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Despeje Peatonal</p>
                  <p className="text-lg font-black mt-0.5">{limits.pedestrianClearanceSeconds}s</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Accesos de la Intersección</h3>
                  <p className="text-xs text-[var(--on-surface-variant)]">Asignación por carril</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { sem: sem1, cam: cam1, total: cam1Total },
                  { sem: sem2, cam: cam2, total: cam2Total },
                ].map(({ sem, cam, total }) => (
                  <div
                    key={sem.id}
                    className="rounded-2xl bg-[var(--surface-container-low)] p-4 border border-[var(--outline-variant)]/40 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-bold">{sem.avenue}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {sem.id} ({sem.online ? sem.currentState : 'Sin señal'}) · {cam.id} ({cam.online ? `${total} veh` : 'Sin señal'})
                      </p>
                    </div>
                    <Badge variant={sem.online ? 'success' : 'secondary'}>
                      <Clock className="w-3 h-3" />
                      {sem.online ? `${sem.greenAllocatedSeconds}s verde` : '--'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
              <h3 className="text-lg font-bold">Historial de Ciclos Semafóricos</h3>
            </div>
            <Badge variant="secondary">{cycles.length} registros</Badge>
          </div>

          {cycles.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)] py-6 text-center">
              Aún no hay ciclos registrados en PostgreSQL.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/50 text-[var(--on-surface-variant)]">
                    <th className="py-2 pr-3">Fase</th>
                    <th className="py-2 pr-3">SEM-01 / SEM-02</th>
                    <th className="py-2 pr-3">Vehículos</th>
                    <th className="py-2">Modo</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.slice(0, 8).map((c) => (
                    <tr key={c.id} className="border-b border-[var(--outline-variant)]/20">
                      <td className="py-2.5 pr-3 font-semibold">{c.phase}</td>
                      <td className="py-2.5 pr-3">{c.sem1GreenSeconds}s / {c.sem2GreenSeconds}s</td>
                      <td className="py-2.5 pr-3">{c.cam1Vehicles} + {c.cam2Vehicles}</td>
                      <td className="py-2.5">
                        <Badge variant="outline">{c.mode}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--tertiary)]" />
              <h3 className="text-lg font-bold">Últimas Mediciones YOLOv8</h3>
            </div>
            <Badge variant="secondary">{measurements.length} muestras</Badge>
          </div>

          {measurements.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)] py-6 text-center">
              Esperando detecciones reales desde ESP32-CAM + YOLOv8.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/50 text-[var(--on-surface-variant)]">
                    <th className="py-2 pr-3">Cámara</th>
                    <th className="py-2 pr-3">Total Veh.</th>
                    <th className="py-2 pr-3">Carga</th>
                    <th className="py-2">Latencia</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.slice(0, 8).map((m) => (
                    <tr key={m.id} className="border-b border-[var(--outline-variant)]/20">
                      <td className="py-2.5 pr-3 font-semibold">{m.camId}</td>
                      <td className="py-2.5 pr-3">{m.totalVehicles}</td>
                      <td className="py-2.5 pr-3">{m.weightedLoad.toFixed(1)}</td>
                      <td className="py-2.5">{m.inferenceLatencyMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
