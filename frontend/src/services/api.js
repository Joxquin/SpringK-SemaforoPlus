const API_BASE = '/api/v1'
const TOKEN_KEY = 'sp_jwt_token'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const token = getToken()
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
    ...options,
  })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
  }
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

  login: async (username, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (data?.token) {
      localStorage.setItem(TOKEN_KEY, data.token)
    }
    return data
  },
  me: () => request('/auth/me'),
  logout: async () => {
    localStorage.removeItem(TOKEN_KEY)
    return request('/auth/logout', { method: 'POST' })
  },

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
  updateIncidentStatus: (id, status) =>
    request(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getMeasurements: (limit = 20) => request(`/traffic/measurements?limit=${limit}`),
  getCycles: (limit = 20) => request(`/traffic/cycles?limit=${limit}`),
  getAnalytics: (camId = 'ALL', limit = 100) =>
    request(`/traffic/analytics?camId=${encodeURIComponent(camId)}&limit=${limit}`),
}
