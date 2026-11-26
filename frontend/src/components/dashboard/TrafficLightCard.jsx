import { Clock, Footprints, Wifi, WifiOff } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export function TrafficLightCard({ light }) {
  const online = Boolean(light?.online)
  const state = online ? light.currentState : 'STANDBY'
  const ped = online ? light.pedestrianState : 'STANDBY'

  return (
    <Card interactive className="p-6 flex flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
            {light.id} · {light.avenue}
          </span>
          <h3 className="text-xl font-bold mt-1">{light.name}</h3>
        </div>
        <Badge variant={online ? 'success' : 'danger'}>
          {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {online ? 'ESP32 En línea' : 'Sin señal ESP32'}
        </Badge>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col gap-2.5 p-3.5 rounded-3xl bg-[var(--surface-container-high)] border border-[var(--outline-variant)]/50">
          <span
            className={cn(
              'w-8 h-8 rounded-full transition-all duration-300',
              state === 'RED'
                ? 'bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.75)]'
                : 'bg-red-500/15'
            )}
          />
          <span
            className={cn(
              'w-8 h-8 rounded-full transition-all duration-300',
              state === 'YELLOW'
                ? 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.75)]'
                : state === 'STANDBY'
                ? 'bg-amber-400/50 animate-pulse'
                : 'bg-amber-400/15'
            )}
          />
          <span
            className={cn(
              'w-8 h-8 rounded-full transition-all duration-300',
              state === 'GREEN'
                ? 'bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.75)]'
                : 'bg-emerald-500/15'
            )}
          />
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
              Estado Actual
            </p>
            <p className="text-3xl font-black tracking-tight mt-0.5">
              {online ? `${light.remainingSeconds}s` : '--'}
              <span className="text-sm font-semibold text-[var(--on-surface-variant)] ml-2">
                {state}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-3 border border-[var(--outline-variant)]/40">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--on-surface-variant)]">
                <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                Verde asignado
              </div>
              <p className="text-sm font-bold mt-1">
                {online ? `${light.greenAllocatedSeconds}s` : '--'}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-3 border border-[var(--outline-variant)]/40">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--on-surface-variant)]">
                <Footprints className="w-3.5 h-3.5 text-[var(--tertiary)]" />
                Peatonal
              </div>
              <p className="text-sm font-bold mt-1">
                {ped === 'WALK' ? 'CRUZAR' : ped === 'DONT_WALK' ? 'ESPERAR' : 'STANDBY'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--outline-variant)]/40 flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
        <span>Modo: {light.mode || 'STANDBY'}</span>
        <span>
          {light.lastUpdated
            ? `Act: ${new Date(light.lastUpdated).toLocaleTimeString()}`
            : 'Esperando telemetría'}
        </span>
      </div>
    </Card>
  )
}
