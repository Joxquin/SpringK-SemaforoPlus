import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { api } from '@/services/api'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PublicPortalPage } from '@/pages/PublicPortalPage'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { InterseccionPage } from '@/pages/InterseccionPage'
import { CamarasPage } from '@/pages/CamarasPage'
import { AnalisisPage } from '@/pages/AnalisisPage'
import { PrediccionesPage } from '@/pages/PrediccionesPage'
import { IncidenciasPage } from '@/pages/IncidenciasPage'
import { ReportesPage } from '@/pages/ReportesPage'
import { ConfiguracionPage } from '@/pages/ConfiguracionPage'

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
            <Route path="analisis" element={<AnalisisPage />} />
            <Route path="predicciones" element={<PrediccionesPage />} />
            <Route path="incidencias" element={<IncidenciasPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="configuracion" element={<ConfiguracionPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
