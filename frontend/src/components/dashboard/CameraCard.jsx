import { useState } from 'react'
import { CameraOff, Car, Bus, Bike, Users, Siren, Video } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function CameraCard({ cam }) {
  const [imgError, setImgError] = useState(false)
  const online = Boolean(cam?.online)
  const cls = cam?.classification || {
    autos: 0,
    combis: 0,
    motos: 0,
    peatones: 0,
    unidadesEmergencia: 0,
  }

  return (
    <Card interactive className="flex flex-col">
      <div className="relative aspect-[16/10] bg-[var(--surface-container-high)] overflow-hidden">
        {online && !imgError ? (
          <img
            src={`/api/v1/realtime/cam/${cam.id}/stream`}
            alt={cam.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-2 text-[var(--on-surface-variant)]">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container-lowest)] flex items-center justify-center shadow-sm">
              <CameraOff className="w-7 h-7 text-[var(--error)]" />
            </div>
            <p className="text-sm font-bold text-[var(--on-surface)]">
              {online ? 'Esperando fotograma...' : 'Cámara Física Desconectada'}
            </p>
            <p className="text-xs max-w-xs">
              {cam.id} ({cam.ipAddress}) sin señal UDP/HTTP en tiempo real.
            </p>
          </div>
        )}

        <div className="absolute top-3 left-3">
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

      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">{cam.name}</h3>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {cam.avenue} · {cam.status}
            </p>
          </div>
          {online && (
            <Badge variant="tertiary">
              Conf: {Math.round((cam.confidenceAvg || 0) * 100)}%
            </Badge>
          )}
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
            <p className="text-sm font-extrabold mt-1">{online ? cls.unidadesEmergencia : '--'}</p>
            <p className="text-[10px] text-[var(--on-error-container)]">Emerg.</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
