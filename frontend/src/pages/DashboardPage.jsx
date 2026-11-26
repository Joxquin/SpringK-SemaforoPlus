import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Car,
  Cpu,
  Gauge,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Zap,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TrafficLightCard } from '@/components/dashboard/TrafficLightCard'
import { CameraCard } from '@/components/dashboard/CameraCard'
import { SolarPanelCard } from '@/components/dashboard/SolarPanelCard'
import { IncidentFeedCard } from '@/components/dashboard/IncidentFeedCard'

export function DashboardPage() {
  const [node, setNode] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [mode, setMode] = useState('ADAPTATIVO')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    try {
      const [nodeRes, incRes, anaRes, modeRes] = await Promise.allSettled([
        api.getRealtimeNode(),
        api.getIncidents(),
        api.getAnalytics(),
        api.getMode(),
      ])

      if (nodeRes.status === 'fulfilled') {
        setNode(nodeRes.value)
        setError(null)
      } else {
        setError('No se pudo conectar con iot-gateway-service')
      }

      if (incRes.status === 'fulfilled' && Array.isArray(incRes.value)) {
        setIncidents(incRes.value)
      }
      if (anaRes.status === 'fulfilled') {
        setAnalytics(anaRes.value)
      }
      if (modeRes.status === 'fulfilled' && modeRes.value?.mode) {
        setMode(modeRes.value.mode)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 3000)
    return () => clearInterval(timer)
  }, [])

  const handleToggleMode = async () => {
    const next = mode === 'ADAPTATIVO' ? 'FIJO' : 'ADAPTATIVO'
    try {
      const res = await api.setMode(next)
      setMode(res.mode)
      fetchData()
    } catch {}
  }

  const handleEmergencyToggle = async () => {
    try {
      if (node?.activeEmergencyPriority) {
        await api.resetEmergency()
      } else {
        await api.triggerEmergency('CAM-01')
      }
      fetchData()
    } catch {}
  }

  const lights = node?.trafficLights || []
  const cameras = node?.cameras || []

  const totalVehicles = cameras.reduce((acc, c) => {
    if (!c.online || !c.classification) return acc
    return acc + c.classification.autos + c.classification.combis + c.classification.motos
  }, 0)

  const activeCams = cameras.filter((c) => c.online)
  const avgLatency =
    activeCams.length > 0
      ? Math.round(
          activeCams.reduce((acc, c) => acc + (c.inferenceLatencyMs || 0), 0) / activeCams.length
        )
      : 0

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-6 sm:p-10 border border-[var(--outline-variant)]/40 shadow-sm">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={node?.iotConnected ? 'success' : 'danger'}>
                <Cpu className="w-3.5 h-3.5" />
                ESP32 Central: {node?.esp32CentralStatus || 'DESCONECTADO'}
              </Badge>
              <Badge variant={node?.activeEmergencyPriority ? 'danger' : 'tertiary'}>
                {node?.activeEmergencyPriority ? (
                  <Siren className="w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                {node?.activeEmergencyPriority ? 'Emergencia Activa' : `Modo ${mode}`}
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {node?.name || 'Av. Ejército × Calle Los Arces (Yanahuara)'}
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Supervisión en tiempo real del nodo ESP32 central, dos semáforos inteligentes y dos
              cámaras ESP32-CAM procesadas con visión artificial YOLOv8.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="tonal" size="sm" onClick={handleToggleMode}>
              <Zap className="w-4 h-4" />
              Cambiar a {mode === 'ADAPTATIVO' ? 'Fijo' : 'Adaptativo'}
            </Button>
            <Button
              variant={node?.activeEmergencyPriority ? 'outlined' : 'danger'}
              size="sm"
              onClick={handleEmergencyToggle}
            >
              <Siren className="w-4 h-4" />
              {node?.activeEmergencyPriority ? 'Desactivar Emergencia' : 'Prioridad Emergencia'}
            </Button>
            <Button variant="outlined" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {(error || node?.offlineMessage) && (
        <Card className="p-5 bg-[var(--error-container)]/70 border-[var(--error)]/30">
          <div className="flex items-start gap-3 text-[var(--on-error-container)]">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-sans font-bold text-sm">
                Estado de Conectividad de Hardware
              </h3>
              <p className="text-xs mt-1 opacity-90">
                {error || node?.offlineMessage}
              </p>
            </div>
          </div>
        </Card>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
              Vehículos en Tiempo Real
            </p>
            <p className="text-2xl font-black tracking-tight mt-0.5">
              {activeCams.length > 0 ? totalVehicles : '--'}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--secondary-container)] text-[var(--on-secondary-container)] flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
              Latencia YOLOv8
            </p>
            <p className="text-2xl font-black tracking-tight mt-0.5">
              {activeCams.length > 0 ? `${avgLatency} ms` : '--'}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] flex items-center justify-center shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
              Ciclos Registrados
            </p>
            <p className="text-2xl font-black tracking-tight mt-0.5">
              {analytics?.cyclesRecorded ?? '--'}
            </p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface-container-high)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
              Fase Actual
            </p>
            <p className="text-base font-extrabold tracking-tight mt-0.5 truncate max-w-[160px]">
              {node?.currentPhase || 'STANDBY'}
            </p>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Semáforos Físicos (ESP32)</h2>
          <Badge variant="outline">Límites: 15s min · 60s max · 3s ámbar · 2s todo-rojo</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {lights.map((light) => (
            <TrafficLightCard key={light.id} light={light} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Cámaras ESP32-CAM + YOLOv8</h2>
          <Badge variant="outline">UDP Port 5005 · Tiempo Real</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cameras.map((cam) => (
            <CameraCard key={cam.id} cam={cam} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SolarPanelCard solar={node?.solarBackup} />
        <IncidentFeedCard incidents={incidents} />
      </section>
    </div>
  )
}
