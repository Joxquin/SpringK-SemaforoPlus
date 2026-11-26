import { useEffect, useState } from 'react'
import {
  Activity,
  Bike,
  Bus,
  Camera,
  CameraOff,
  Car,
  Maximize2,
  RefreshCw,
  Search,
  Siren,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

function CameraStream({ cam, className }) {
  const [imgError, setImgError] = useState(false)
  const online = Boolean(cam?.online)

  useEffect(() => {
    if (online) {
      setImgError(false)
    }
  }, [online])

  if (!online || imgError) {
    return (
      <div
        className={cn(
          'w-full h-full flex flex-col items-center justify-center p-6 text-center gap-2.5 text-[var(--on-surface-variant)] bg-[var(--surface-container-high)]',
          className
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container-lowest)] flex items-center justify-center shadow-sm">
          <CameraOff className="w-7 h-7 text-[var(--error)]" />
        </div>
        <p className="text-sm font-bold text-[var(--on-surface)]">
          {online ? 'Esperando fotograma UDP...' : 'Cámara Física Desconectada'}
        </p>
        <p className="text-xs max-w-xs">
          {cam.id} ({cam.ipAddress}) sin señal UDP en puerto 5005.
        </p>
      </div>
    )
  }

  return (
    <img
      src={`/api/v1/realtime/cam/${cam.id}/stream`}
      alt={cam.name}
      onError={() => setImgError(true)}
      className={cn('w-full h-full object-cover', className)}
    />
  )
}

export function CamarasPage() {
  const [node, setNode] = useState(null)
  const [measurements, setMeasurements] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [zoomedCamId, setZoomedCamId] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [nodeRes, measRes] = await Promise.allSettled([
        api.getRealtimeNode(),
        api.getMeasurements(12),
      ])
      if (nodeRes.status === 'fulfilled') setNode(nodeRes.value)
      if (measRes.status === 'fulfilled' && Array.isArray(measRes.value)) {
        setMeasurements(measRes.value)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 2000)
    return () => clearInterval(timer)
  }, [])

  const cameras = node?.cameras || []
  const lights = node?.trafficLights || []

  const onlineCount = cameras.filter((c) => c.online).length
  const offlineCount = cameras.length - onlineCount

  const filteredCameras = cameras.filter((cam) => {
    const matchesSearch =
      cam.name.toLowerCase().includes(search.toLowerCase()) ||
      cam.id.toLowerCase().includes(search.toLowerCase()) ||
      cam.avenue.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ONLINE' && cam.online) ||
      (statusFilter === 'OFFLINE' && !cam.online)
    return matchesSearch && matchesStatus
  })

  const zoomedCam = zoomedCamId ? cameras.find((c) => c.id === zoomedCamId) : null
  const zoomedLight = zoomedCam
    ? lights[zoomedCam.id === 'CAM-01' ? 0 : 1] || null
    : null

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-6 sm:p-10 border border-[var(--outline-variant)]/40 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <Camera className="w-3.5 h-3.5" />
                {cameras.length} Cámaras ESP32-CAM
              </Badge>
              <Badge variant={onlineCount > 0 ? 'success' : 'danger'}>
                {onlineCount > 0 ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {onlineCount} En línea · {offlineCount} Sin señal
              </Badge>
              <Badge variant="tertiary">UDP :5005 · YOLOv8</Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Visión Artificial y Cámaras UDP
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Transmisión en vivo por protocolo UDP y métricas estrictas extraídas en tiempo real por el microservicio YOLOv8.
            </p>
          </div>

          <Button variant="outlined" size="sm" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </section>

      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cámara o avenida..."
            className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: `Todas (${cameras.length})` },
            { id: 'ONLINE', label: `En línea (${onlineCount})` },
            { id: 'OFFLINE', label: `Sin señal (${offlineCount})` },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                statusFilter === chip.id
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm'
                  : 'bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] border-[var(--outline-variant)] hover:bg-[var(--primary-container)]/30'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCameras.map((cam) => {
          const online = Boolean(cam.online)
          const cls = cam.classification || {
            autos: 0,
            combis: 0,
            motos: 0,
            peatones: 0,
            unidadesEmergencia: 0,
          }
          const totalVeh = cls.autos + cls.combis + cls.motos
          const weighted = (cls.autos * 1.0 + cls.combis * 2.2 + cls.motos * 0.5).toFixed(1)

          return (
            <Card key={cam.id} interactive className="flex flex-col">
              <div className="relative aspect-[16/10] bg-[var(--surface-container-high)] overflow-hidden">
                <CameraStream cam={cam} />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <Badge variant={online ? 'success' : 'danger'} className="backdrop-blur-md">
                    <Video className="w-3 h-3" />
                    {online ? `${cam.fps || 0} FPS · ${cam.inferenceLatencyMs || 0}ms` : 'Sin señal'}
                  </Badge>
                </div>
                <div className="absolute top-3 right-3">
                  <Badge variant="default" className="backdrop-blur-md">
                    {cam.id}
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold">{cam.name}</h3>
                    <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                      {cam.avenue} · IP {cam.ipAddress} · {cam.status}
                    </p>
                  </div>
                  <Button variant="tonal" size="sm" onClick={() => setZoomedCamId(cam.id)}>
                    <Maximize2 className="w-3.5 h-3.5" />
                    Ampliar
                  </Button>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="rounded-2xl bg-[var(--surface-container-low)] p-2.5">
                    <Car className="w-4 h-4 mx-auto text-[var(--primary)]" />
                    <p className="text-sm font-extrabold mt-1">{online ? cls.autos : '--'}</p>
                    <p className="text-[10px] text-[var(--on-surface-variant)]">Autos</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container-low)] p-2.5">
                    <Bus className="w-4 h-4 mx-auto text-[var(--secondary)]" />
                    <p className="text-sm font-extrabold mt-1">{online ? cls.combis : '--'}</p>
                    <p className="text-[10px] text-[var(--on-surface-variant)]">Combis</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container-low)] p-2.5">
                    <Bike className="w-4 h-4 mx-auto text-[var(--tertiary)]" />
                    <p className="text-sm font-extrabold mt-1">{online ? cls.motos : '--'}</p>
                    <p className="text-[10px] text-[var(--on-surface-variant)]">Motos</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-container-low)] p-2.5">
                    <Users className="w-4 h-4 mx-auto text-[var(--on-surface-variant)]" />
                    <p className="text-sm font-extrabold mt-1">{online ? cls.peatones : '--'}</p>
                    <p className="text-[10px] text-[var(--on-surface-variant)]">Peatones</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--error-container)]/50 p-2.5">
                    <Siren className="w-4 h-4 mx-auto text-[var(--error)]" />
                    <p className="text-sm font-extrabold mt-1">
                      {online ? cls.unidadesEmergencia : '--'}
                    </p>
                    <p className="text-[10px] text-[var(--on-error-container)]">Emerg.</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--outline-variant)]/40 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--on-surface-variant)]">
                  <span>
                    Total ML: <strong>{online ? `${totalVeh} veh` : '--'}</strong> · Carga:{' '}
                    <strong>{online ? weighted : '--'}</strong>
                  </span>
                  <span>
                    Confianza: <strong>{online ? `${Math.round((cam.confidenceAvg || 0) * 100)}%` : '--'}</strong>
                  </span>
                </div>
              </div>
            </Card>
          )
        })}
      </section>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="text-lg font-bold">Últimas Inferencias YOLOv8 (PostgreSQL)</h3>
          </div>
          <Badge variant="secondary">{measurements.length} registros</Badge>
        </div>

        {measurements.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)] py-6 text-center">
            Sin detecciones registradas. Conecta una ESP32-CAM y el servicio YOLOv8 para ver mediciones reales.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]/50 text-[var(--on-surface-variant)]">
                  <th className="py-2 pr-3">Cámara</th>
                  <th className="py-2 pr-3">Autos</th>
                  <th className="py-2 pr-3">Combis</th>
                  <th className="py-2 pr-3">Motos</th>
                  <th className="py-2 pr-3">Peatones</th>
                  <th className="py-2 pr-3">Emerg.</th>
                  <th className="py-2 pr-3">Latencia</th>
                  <th className="py-2">Hora</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--outline-variant)]/20">
                    <td className="py-2.5 pr-3 font-semibold">{m.camId}</td>
                    <td className="py-2.5 pr-3">{m.autos}</td>
                    <td className="py-2.5 pr-3">{m.combis}</td>
                    <td className="py-2.5 pr-3">{m.motos}</td>
                    <td className="py-2.5 pr-3">{m.peatones}</td>
                    <td className="py-2.5 pr-3">{m.unidadesEmergencia}</td>
                    <td className="py-2.5 pr-3">{m.inferenceLatencyMs} ms</td>
                    <td className="py-2.5">{new Date(m.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {zoomedCam && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{zoomedCam.id}</Badge>
                  <Badge variant={zoomedCam.online ? 'success' : 'danger'}>
                    {zoomedCam.online ? 'UDP En línea' : 'Sin señal UDP'}
                  </Badge>
                </div>
                <h2 className="text-2xl font-bold mt-2">{zoomedCam.name}</h2>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {zoomedCam.avenue} · IP {zoomedCam.ipAddress}
                </p>
              </div>
              <Button variant="tonal" size="icon" onClick={() => setZoomedCamId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="aspect-[16/9] rounded-3xl overflow-hidden bg-[var(--surface-container-high)] border border-[var(--outline-variant)]/40">
              <CameraStream cam={zoomedCam} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">FPS / Latencia</p>
                <p className="text-lg font-black mt-0.5">
                  {zoomedCam.online
                    ? `${zoomedCam.fps || 0} FPS · ${zoomedCam.inferenceLatencyMs || 0}ms`
                    : '--'}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Confianza ML</p>
                <p className="text-lg font-black mt-0.5">
                  {zoomedCam.online ? `${Math.round((zoomedCam.confidenceAvg || 0) * 100)}%` : '--'}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Semáforo Asignado</p>
                <p className="text-lg font-black mt-0.5">
                  {zoomedLight
                    ? `${zoomedLight.id} · ${zoomedLight.online ? zoomedLight.currentState : 'OFF'}`
                    : '--'}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
                <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Última Captura</p>
                <p className="text-sm font-bold mt-1">
                  {zoomedCam.online && zoomedCam.lastFrameAt
                    ? new Date(zoomedCam.lastFrameAt).toLocaleTimeString()
                    : 'Sin señal'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
