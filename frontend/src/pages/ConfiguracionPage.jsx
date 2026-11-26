import { useEffect, useState } from 'react'
import {
  Cpu,
  Database,
  Palette,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Siren,
  WifiOff,
  Zap,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function ConfiguracionPage() {
  const [node, setNode] = useState(null)
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('ADAPTATIVO')
  const [pollInterval, setPollInterval] = useState(() => {
    return Number(localStorage.getItem('sp_poll_interval') || 3)
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [nodeRes, meRes, modeRes] = await Promise.allSettled([
        api.getRealtimeNode(),
        api.me(),
        api.getMode(),
      ])
      if (nodeRes.status === 'fulfilled') setNode(nodeRes.value)
      if (meRes.status === 'fulfilled') setUser(meRes.value)
      if (modeRes.status === 'fulfilled' && modeRes.value?.mode) setMode(modeRes.value.mode)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleModeChange = async (nextMode) => {
    try {
      const res = await api.setMode(nextMode)
      setMode(res.mode)
      setStatusMessage(`Modo actualizado a ${res.mode}`)
    } catch {}
  }

  const handleResetEmergency = async () => {
    try {
      await api.resetEmergency()
      setStatusMessage('Prioridad de emergencia restablecida')
      loadData()
    } catch {}
  }

  const handlePollChange = (sec) => {
    setPollInterval(sec)
    localStorage.setItem('sp_poll_interval', String(sec))
    setStatusMessage(`Intervalo de refresco guardado en ${sec}s`)
  }

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
                <Settings className="w-3.5 h-3.5" />
                Ajustes del Sistema
              </Badge>
              {user && <Badge variant="tertiary">{user.username} · {user.role}</Badge>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Configuración y Arquitectura
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Preferencias de interfaz Material 3, modo de operación del controlador Spring Boot y diagnóstico de microservicios.
            </p>
          </div>

          <Button variant="outlined" size="sm" onClick={loadData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar Estado
          </Button>
        </div>
      </section>

      {statusMessage && (
        <Card className="p-4 bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] text-xs font-bold">
          {statusMessage}
        </Card>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Apariencia y Polling</h3>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Tema claro, oscuro o automático del navegador
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-container-low)] p-4">
            <span className="text-sm font-semibold">Tema de Interfaz</span>
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-container-low)] p-4">
            <span className="text-sm font-semibold">Frecuencia de Refresco</span>
            <div className="flex gap-1.5">
              {[3, 5, 10].map((sec) => (
                <Button
                  key={sec}
                  size="sm"
                  variant={pollInterval === sec ? 'filled' : 'outlined'}
                  onClick={() => handlePollChange(sec)}
                >
                  {sec}s
                </Button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--secondary-container)] text-[var(--on-secondary-container)] flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Controlador Semafórico</h3>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Motor adaptativo en traffic-core-service
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-container-low)] p-4">
            <span className="text-sm font-semibold">Modo de Operación</span>
            <div className="flex gap-2">
              {['ADAPTATIVO', 'FIJO'].map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={mode === m ? 'filled' : 'outlined'}
                  onClick={() => handleModeChange(m)}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-container-low)] p-4">
            <span className="text-sm font-semibold">Estado de Emergencia</span>
            <Button variant="tonal" size="sm" onClick={handleResetEmergency}>
              <Siren className="w-4 h-4" />
              Restablecer Normalidad
            </Button>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Hardware Registrado</h3>
              <p className="text-xs text-[var(--on-surface-variant)]">
                ESP32 Central y cámaras ESP32-CAM
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5 flex items-center justify-between">
              <div>
                <p className="font-bold">ESP32 Central (SEM-01 / SEM-02)</p>
                <p className="text-[var(--on-surface-variant)]">IP: {node?.esp32Ip || '192.168.1.50'}</p>
              </div>
              <Badge variant={node?.esp32CentralStatus === 'CONECTADO' ? 'success' : 'danger'}>
                {node?.esp32CentralStatus || 'DESCONECTADO'}
              </Badge>
            </div>

            {(node?.cameras || []).map((cam) => (
              <div
                key={cam.id}
                className="rounded-2xl bg-[var(--surface-container-low)] p-3.5 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold">{cam.name} ({cam.id})</p>
                  <p className="text-[var(--on-surface-variant)]">IP: {cam.ipAddress} · UDP :5005</p>
                </div>
                <Badge variant={cam.online ? 'success' : 'danger'}>
                  {cam.online ? 'ACTIVA' : 'SIN SEÑAL'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--surface-container-high)] text-[var(--primary)] flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Arquitectura de Microservicios</h3>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Spring Boot 3.4.2 MVC + PostgreSQL + YOLOv8
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-3 flex justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[var(--primary)]" /> iot-gateway-service
              </span>
              <span>Spring Boot MVC · :8081 / UDP :5005</span>
            </div>
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-3 flex justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--tertiary)]" /> traffic-core-service
              </span>
              <span>Spring Boot MVC · :8082</span>
            </div>
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-3 flex justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[var(--secondary)]" /> PostgreSQL
              </span>
              <span>Base de datos: semaforoplus_v2</span>
            </div>
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-3 flex justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 text-[var(--on-surface-variant)]" /> Límites Seguridad
              </span>
              <span>
                {limits.minGreenSeconds}s–{limits.maxGreenSeconds}s verde · {limits.yellowSeconds}s ámbar
              </span>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
