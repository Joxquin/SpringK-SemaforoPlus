import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, TrafficCone } from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await api.login(username, password)
      if (onLoginSuccess) onLoginSuccess(user)
      navigate('/admin')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary-container)] text-[var(--primary)] flex items-center justify-center shadow-inner">
            <TrafficCone className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Semáforo+ Admin</h1>
            <p className="text-sm text-[var(--on-surface-variant)] mt-1">
              Acceso al Centro de Control Vehicular
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-[var(--error-container)] text-[var(--on-error-container)] p-3.5 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] focus:outline-none focus:border-[var(--primary)] text-sm"
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] focus:outline-none focus:border-[var(--primary)] text-sm"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" variant="filled" className="w-full" disabled={loading}>
            <Lock className="w-4 h-4" />
            {loading ? 'Ingresando...' : 'Ingresar al Panel'}
          </Button>
        </form>

        <div className="text-center pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Portal Ciudadano
          </Link>
        </div>
      </Card>
    </div>
  )
}
