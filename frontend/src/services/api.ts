/**
 * API client — all requests go through this module.
 * Base URL reads from Vite env or defaults to localhost:8000.
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qsense_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('qsense_token');
      localStorage.removeItem('qsense_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// ─── Dashboard ────────────────────────────────────────────────────────────

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard'),
  getObservations: (params?: { department_id?: number; hours?: number; limit?: number }) =>
    api.get('/queue/observations', { params }),
  getEvents: (params?: { department_id?: number; hours?: number }) =>
    api.get('/queue/events', { params }),
  createEvent: (data: { department_id?: number; counter_id?: number; event_type: string; payload?: any; source?: string }) =>
    api.post('/queue/events', data),
  listTickets: (params?: { department_id?: number; counter_id?: number; status?: string; limit?: number }) =>
    api.get('/queue/tickets', { params }),
  createTicket: (data: { department_id: number; service_type_id?: number; service_name?: string; citizen_name?: string; priority?: string; notes?: string; source?: string }) =>
    api.post('/queue/tickets', data),
  callNextTicket: (data: { counter_id: number; department_id?: number }) =>
    api.post('/queue/tickets/call-next', data),
  updateTicket: (ticketId: number, data: any) =>
    api.patch(`/queue/tickets/${ticketId}`, data),
  getPublicBoard: () =>
    api.get('/queue/public-board'),
};

// ─── Departments ──────────────────────────────────────────────────────────

export const departmentsApi = {
  list: () => api.get('/departments'),
  get: (id: number) => api.get(`/departments/${id}`),
  create: (data: any) => api.post('/departments', data),
  update: (id: number, data: any) => api.patch(`/departments/${id}`, data),
};

// ─── Counters ─────────────────────────────────────────────────────────────

export const countersApi = {
  list: (department_id?: number) =>
    api.get('/counters', { params: department_id ? { department_id } : {} }),
  get: (id: number) => api.get(`/counters/${id}`),
  create: (data: any) => api.post('/counters', data),
  update: (id: number, data: any) => api.patch(`/counters/${id}`, data),
};

// ─── Staff ────────────────────────────────────────────────────────────────

export const staffApi = {
  list: (params?: { department_id?: number; available_only?: boolean }) =>
    api.get('/staff', { params }),
  get: (id: number) => api.get(`/staff/${id}`),
  create: (data: any) => api.post('/staff', data),
  update: (id: number, data: any) => api.patch(`/staff/${id}`, data),
};

// ─── Users ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// ─── Forecasting ──────────────────────────────────────────────────────────

export const forecastingApi = {
  train: (data: { department_id: number; model_type: string }) =>
    api.post('/forecasting/train', data),
  listModels: (department_id?: number) =>
    api.get('/forecasting/models', { params: department_id ? { department_id } : {} }),
  predict: (data: { department_id: number; horizon_minutes: number; model_type: string }) =>
    api.post('/forecasting/predict', data),
  history: (department_id: number) =>
    api.get(`/forecasting/history/${department_id}`),
};

// ─── Optimization ─────────────────────────────────────────────────────────

export const optimizationApi = {
  recommend: (data: {
    department_id: number;
    horizon_minutes: number;
    weight_wait?: number;
    weight_cost?: number;
    weight_utilization?: number;
  }) => api.post('/optimization/recommend', data),
  listRecommendations: (params?: { department_id?: number; status?: string }) =>
    api.get('/optimization/recommendations', { params }),
  reviewRecommendation: (id: number, data: { status: 'approved' | 'rejected'; notes?: string; source?: string }) =>
    api.patch(`/optimization/recommendations/${id}/review`, data),
};

// ─── Simulation ───────────────────────────────────────────────────────────

export const simulationApi = {
  createRun: (data: any) => api.post('/simulation/runs', data),
  listRuns: () => api.get('/simulation/runs'),
  getResults: (runId: number) => api.get(`/simulation/runs/${runId}/results`),
  startLive: () => api.post('/simulation/live/start'),
  stopLive: () => api.post('/simulation/live/stop'),
  liveStatus: () => api.get('/simulation/live/status'),
};

// ─── Analytics ────────────────────────────────────────────────────────────

export const analyticsApi = {
  hourlyPattern: (department_id: number, days?: number) =>
    api.get(`/analytics/hourly-pattern/${department_id}`, { params: days ? { days } : {} }),
  performance: (department_id: number, days?: number) =>
    api.get(`/analytics/performance/${department_id}`, { params: days ? { days } : {} }),
  timeline: (department_id: number, hours?: number) =>
    api.get(`/analytics/timeline/${department_id}`, { params: hours ? { hours } : {} }),
};

// ─── Reports ──────────────────────────────────────────────────────────────

export const reportsApi = {
  exportCsv: (department_id: number, hours?: number) =>
    api.get(`/reports/export/csv/${department_id}`, {
      params: hours ? { hours } : {},
      responseType: 'blob',
    }),
  exportPdf: (department_id: number, hours?: number) =>
    api.get(`/reports/export/pdf/${department_id}`, {
      params: hours ? { hours } : {},
      responseType: 'blob',
    }),
};

// ─── Data Import ──────────────────────────────────────────────────────────

export const dataApi = {
  importCsv: (file: File, dry_run?: boolean) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/data/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: dry_run ? { dry_run: true } : {},
    });
  },
  sampleCsv: () => api.get('/data/sample-csv', { responseType: 'blob' }),
};

// ─── Explainability ───────────────────────────────────────────────────────

export const explainApi = {
  featureImportance: (modelId: number) => api.get(`/explain/feature-importance/${modelId}`),
  recommendation: (recId: number) => api.get(`/explain/recommendation/${recId}`),
  predictionContext: (deptId: number) => api.get(`/explain/prediction-context/${deptId}`),
};

// ─── Camera ───────────────────────────────────────────────────────────────

export const cameraApi = {
  status: () => api.get('/camera/status'),
  listSources: (department_id?: number) =>
    api.get('/camera/sources', { params: department_id ? { department_id } : {} }),
  getSource: (id: number) => api.get(`/camera/sources/${id}`),
  createSource: (data: any) => api.post('/camera/sources', data),
  updateSource: (id: number, data: any) => api.patch(`/camera/sources/${id}`, data),
  stepFrame: (id: number) => api.post(`/camera/sources/${id}/step`),
  snapshotUrl: (id: number) => {
    const token = localStorage.getItem('qsense_token');
    return `${BASE_URL}/camera/sources/${id}/snapshot?t=${Date.now()}${token ? `&token=${token}` : ''}`;
  },
};

// ─── Audit ────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    api.get('/audit', { params }),
};
