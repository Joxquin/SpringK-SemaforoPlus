import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  FileText,
  Settings,
  Sparkles,
} from 'lucide-react'
import { ThemeProvider } from '@/context/ThemeContext'
import { api } from '@/services/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { SectionShell } from '@/components/layout/SectionShell'
import { PublicPortalPage } from '@/pages/PublicPortalPage'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { InterseccionPage } from '@/pages/InterseccionPage'
import { CamarasPage } from '@/pages/CamarasPage'

function ProtectedAdmin({ user, checking, onLogout }) {
  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center text-sm text-[var(--on-surface-variant)]">
        Verificando sesión...
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <AdminLayout user={user} onLogout={onLogout} />
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res))
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicPortalPage />} />
          <Route path="/login" element={<LoginPage onLoginSuccess={setUser} />} />
          <Route
            path="/admin"
            element={
              <ProtectedAdmin
                user={user}
                checking={checking}
                onLogout={() => setUser(null)}
              />
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="interseccion" element={<InterseccionPage />} />
            <Route path="camaras" element={<CamarasPage />} />
            <Route
              path="analisis"
              element={
                <SectionShell
                  title="Análisis de Tráfico"
                  subtitle="Histórico de flujos, latencias y comparativa de tiempos de espera."
                  icon={BarChart3}
                />
              }
            />
            <Route
              path="predicciones"
              element={
                <SectionShell
                  title="Predicciones"
                  subtitle="Proyección de congestión a 15, 30 y 60 minutos basada en mediciones reales."
                  icon={Sparkles}
                />
              }
            />
            <Route
              path="incidencias"
              element={
                <SectionShell
                  title="Gestión de Incidencias"
                  subtitle="Registro y seguimiento de alertas viales y emergencias."
                  icon={AlertTriangle}
                />
              }
            />
            <Route
              path="reportes"
              element={
                <SectionShell
                  title="Reportes"
                  subtitle="Generación de informes comparativos entre modo fijo y adaptativo."
                  icon={FileText}
                />
              }
            />
            <Route
              path="configuracion"
              element={
                <SectionShell
                  title="Configuración"
                  subtitle="Parámetros del nodo ESP32, cámaras, MQTT y preferencias del sistema."
                  icon={Settings}
                />
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
