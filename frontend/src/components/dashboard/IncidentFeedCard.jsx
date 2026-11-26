import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function IncidentFeedCard({ incidents }) {
  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Eventos e Incidencias</h3>
          <p className="text-xs text-[var(--on-surface-variant)]">
            Registro en tiempo real desde PostgreSQL
          </p>
        </div>
        <Badge variant="secondary">{incidents.length} registros</Badge>
      </div>

      {incidents.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-container-low)] p-6 text-center text-sm text-[var(--on-surface-variant)] flex flex-col items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <span>No hay incidencias registradas actualmente.</span>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {incidents.slice(0, 6).map((inc) => (
            <div
              key={inc.id}
              className="rounded-2xl bg-[var(--surface-container-low)] p-3.5 border border-[var(--outline-variant)]/40 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[var(--primary)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold leading-snug">{inc.title}</p>
                  <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">{inc.description}</p>
                </div>
              </div>
              <Badge variant={inc.priority === 'CRITICA' ? 'danger' : 'default'}>
                {inc.priority}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
