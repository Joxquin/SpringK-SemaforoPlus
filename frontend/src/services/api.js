const API_BASE = '/api/v1'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return null
}

export const api = {
  getPublicOverview: () => request('/public/overview'),
  getPublicHourlyTrend: () => request('/public/hourly-trend'),

  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  getRealtimeNode: () => request('/realtime/node'),
  triggerEmergency: (camId = 'CAM-01') =>
    request(`/realtime/emergency-trigger?camId=${encodeURIComponent(camId)}`, { method: 'POST' }),
  resetEmergency: () => request('/realtime/emergency-reset', { method: 'POST' }),

  getMode: () => request('/mode'),
  setMode: (mode) =>
    request('/mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  getIntersections: () => request('/intersections'),
  getIncidents: () => request('/incidents'),
  createIncident: (payload) =>
    request('/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMeasurements: (limit = 20) => request(`/traffic/measurements?limit=${limit}`),
  getCycles: (limit = 20) => request(`/traffic/cycles?limit=${limit}`),
  getAnalytics: (camId = 'ALL', limit = 100) =>
    request(`/traffic/analytics?camId=${encodeURIComponent(camId)}&limit=${limit}`),
}
