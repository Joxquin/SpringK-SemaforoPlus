import { BatteryCharging, Sun, ZapOff } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function SolarPanelCard({ solar }) {
  const online = Boolean(solar?.online)

  return (
    <Card className="p-6 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] flex items-center justify-center">
            {online ? <Sun className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-lg font-bold">Respaldo Solar Híbrido</h3>
            <p className="text-xs text-[var(--on-surface-variant)]">{solar?.statusLabel || 'Sin telemetría'}</p>
          </div>
        </div>
        <Badge variant={online ? 'tertiary' : 'secondary'}>
          {online ? solar.powerSource : 'OFFLINE'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
          <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Batería</p>
          <p className="text-xl font-black mt-1">
            {online ? `${solar.batteryPercent}%` : '--'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
          <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Voltaje</p>
          <p className="text-xl font-black mt-1">
            {online ? `${solar.batteryVoltage} V` : '--'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
          <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Panel Solar</p>
          <p className="text-xl font-black mt-1">
            {online ? `${solar.solarPowerWatts} W` : '--'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-container-low)] p-3.5">
          <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">Autonomía</p>
          <p className="text-xl font-black mt-1 flex items-center gap-1">
            <BatteryCharging className="w-4 h-4 text-[var(--tertiary)]" />
            {online ? `${solar.autonomyHours} h` : '--'}
          </p>
        </div>
      </div>
    </Card>
  )
}
