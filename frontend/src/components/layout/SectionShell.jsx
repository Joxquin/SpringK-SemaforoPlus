import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function SectionShell({ title, subtitle, icon: Icon }) {
  return (
    <div className="space-y-6">
      <Card className="p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <Badge variant="tertiary" className="mb-2">Módulo en Construcción</Badge>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-[var(--on-surface-variant)] mt-1">{subtitle}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
