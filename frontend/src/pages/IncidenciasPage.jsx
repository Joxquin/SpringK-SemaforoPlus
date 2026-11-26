import { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Siren,
  X,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function IncidenciasPage() {
  const [incidents, setIncidents] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('CONGESTION')
  const [priority, setPriority] = useState('MEDIA')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const data = await api.getIncidents()
      if (Array.isArray(data)) {
        setIncidents(data)
        if (selected) {
          const updated = data.find((i) => i.id === selected.id)
          if (updated) setSelected(updated)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 5000)
    return () => clearInterval(timer)
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await api.createIncident({
        intersectionId: 'INT-01',
        title,
        description,
        type,
        priority,
      })
      setTitle('')
      setDescription('')
      setShowModal(false)
      setSelected(created)
      loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id, nextStatus) => {
    try {
      const updated = await api.updateIncidentStatus(id, nextStatus)
      setSelected(updated)
      loadData()
    } catch {}
  }

  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(search.toLowerCase()) ||
      inc.description.toLowerCase().includes(search.toLowerCase()) ||
      inc.type.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const openCount = incidents.filter((i) => i.status !== 'RESUELTA').length
  const criticalCount = incidents.filter((i) => i.priority === 'CRITICA').length
  const resolvedCount = incidents.filter((i) => i.status === 'RESUELTA').length

  return (
    <div className="space-y-8">
      <section className="rounded-[36px] bg-gradient-to-br from-[var(--secondary-container)] via-[var(--surface-container)] to-[var(--tertiary-container)]/50 p-6 sm:p-10 border border-[var(--outline-variant)]/40 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <AlertTriangle className="w-3.5 h-3.5" />
                {incidents.length} Incidencias en PostgreSQL
              </Badge>
              <Badge variant={openCount > 0 ? 'warning' : 'success'}>
                {openCount} Abiertas
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Gestión de Incidencias
            </h1>
            <p className="text-sm text-[var(--on-surface-variant)] max-w-2xl">
              Registro automático de emergencias detectadas por YOLOv8 y reportes manuales de operadores en PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="filled" size="sm" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />
              Nueva Incidencia
            </Button>
            <Button variant="outlined" size="sm" onClick={loadData}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-[var(--on-surface-variant)]">Total</p>
            <p className="text-2xl font-black">{incidents.length}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-[var(--on-surface-variant)]">Pendientes</p>
            <p className="text-2xl font-black">{openCount}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[var(--error-container)] text-[var(--error)] flex items-center justify-center">
            <Siren className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-[var(--on-surface-variant)]">Críticas</p>
            <p className="text-2xl font-black">{criticalCount}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-[var(--on-surface-variant)]">Resueltas</p>
            <p className="text-2xl font-black">{resolvedCount}</p>
          </div>
        </Card>
      </section>

      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar incidencia..."
            className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['ALL', 'NUEVA', 'ACTIVA', 'REVISADA', 'RESUELTA'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                statusFilter === st
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm'
                  : 'bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] border-[var(--outline-variant)] hover:bg-[var(--primary-container)]/30'
              )}
            >
              {st === 'ALL' ? 'Todas' : st}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6 space-y-4">
          <h3 className="text-lg font-bold">Listado de Incidencias</h3>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--on-surface-variant)]">
              No hay incidencias que coincidan con el filtro actual.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setSelected(inc)}
                  className={cn(
                    'rounded-2xl p-4 bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/40 cursor-pointer transition-all hover:shadow-md',
                    selected?.id === inc.id && 'ring-2 ring-[var(--primary)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={inc.priority === 'CRITICA' ? 'danger' : 'default'}>
                          {inc.priority}
                        </Badge>
                        <Badge variant="secondary">{inc.type}</Badge>
                        <Badge variant={inc.status === 'RESUELTA' ? 'success' : 'warning'}>
                          {inc.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold">{inc.title}</p>
                      <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                        {inc.source} · {new Date(inc.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5 p-6 space-y-5 h-fit">
          <h3 className="text-lg font-bold">Detalle y Seguimiento</h3>
          {!selected ? (
            <p className="text-sm text-[var(--on-surface-variant)] py-8 text-center">
              Selecciona una incidencia de la lista para gestionar su estado.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={selected.priority === 'CRITICA' ? 'danger' : 'default'}>
                  {selected.priority}
                </Badge>
                <Badge variant="secondary">{selected.type}</Badge>
                <Badge variant={selected.status === 'RESUELTA' ? 'success' : 'warning'}>
                  {selected.status}
                </Badge>
              </div>
              <div>
                <h4 className="text-xl font-bold">{selected.title}</h4>
                <p className="text-sm text-[var(--on-surface-variant)] mt-2">
                  {selected.description}
                </p>
              </div>
              <div className="text-xs text-[var(--on-surface-variant)] space-y-1 pt-2 border-t border-[var(--outline-variant)]/40">
                <p>Intersección: {selected.intersectionId}</p>
                <p>Origen: {selected.source}</p>
                <p>Fecha: {new Date(selected.createdAt).toLocaleString()}</p>
              </div>

              <div className="pt-2 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  Cambiar estado en PostgreSQL
                </p>
                <div className="flex flex-wrap gap-2">
                  {['NUEVA', 'REVISADA', 'RESUELTA'].map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant={selected.status === st ? 'filled' : 'outlined'}
                      onClick={() => handleStatusChange(selected.id, st)}
                    >
                      {st}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Registrar Incidencia</h2>
              <Button variant="tonal" size="icon" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">
                  Título
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Congestión inusual en Av. Ejército"
                  className="w-full h-11 px-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] text-sm"
                  >
                    <option value="CONGESTION">CONGESTION</option>
                    <option value="EMERGENCIA">EMERGENCIA</option>
                    <option value="HARDWARE">HARDWARE</option>
                    <option value="CLIMA">CLIMA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">
                    Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] text-sm"
                  >
                    <option value="BAJA">BAJA</option>
                    <option value="MEDIA">MEDIA</option>
                    <option value="ALTA">ALTA</option>
                    <option value="CRITICA">CRITICA</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--on-surface-variant)]">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles observados en campo o cámaras..."
                  className="w-full p-3.5 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outlined" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="filled" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar en PostgreSQL'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
