import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
})

// ── Request interceptor: attach JWT ───────────────────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// ── Response interceptor: auto-refresh on 401 ─────────────────────────
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null) => {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
    failedQueue = []
}

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config
        if (err.response?.status === 401 && !original._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject })
                })
                    .then((token) => {
                        original.headers.Authorization = `Bearer ${token}`
                        return api(original)
                    })
                    .catch(Promise.reject.bind(Promise))
            }

            original._retry = true
            isRefreshing = true

            try {
                const refresh = localStorage.getItem('refresh_token')
                if (!refresh) throw new Error('No refresh token')

                // POST with JSON body { refresh_token: "..." }
                const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
                    refresh_token: refresh,
                })
                localStorage.setItem('access_token', data.access_token)
                localStorage.setItem('refresh_token', data.refresh_token)
                api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
                processQueue(null, data.access_token)
                return api(original)
            } catch (refreshErr) {
                processQueue(refreshErr, null)
                localStorage.clear()
                window.location.href = '/login'
                return Promise.reject(refreshErr)
            } finally {
                isRefreshing = false
            }
        }
        return Promise.reject(err)
    }
)

export default api

// ── Auth endpoints ────────────────────────────────────────────────────
export const authApi = {
    login: (username: string, password: string) => {
        const form = new URLSearchParams({ username, password })
        return api.post('/auth/login', form, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
    },
    register: (data: {
        username: string
        email: string
        password: string
        display_name?: string
        role?: string
    }) => api.post('/auth/register', data),

    me: () => api.get('/auth/me'),

    // JSON body as per updated backend
    refresh: (token: string) =>
        api.post('/auth/refresh', { refresh_token: token }),

    updateProfile: (data: { display_name?: string; email?: string }) =>
        api.put('/auth/me', data),

    listUsers: () => api.get('/auth/users'),
}

// ── Meeting endpoints ─────────────────────────────────────────────────
export const meetingApi = {
    create: (data: { title: string; description?: string; participants?: string[] }) =>
        api.post('/meetings/', data),
    list: (params?: Record<string, unknown>) => api.get('/meetings/', { params }),
    get: (id: string) => api.get(`/meetings/${id}`),
    join: (id: string) => api.post(`/meetings/${id}/join`),
    start: (id: string) => api.post(`/meetings/${id}/start`),
    end: (id: string) => api.post(`/meetings/${id}/end`),
    generateReport: (id: string, report_types: string[]) =>
        api.post(`/meetings/${id}/generate-report`, { report_types }),
    confirmAction: (meetingId: string, actionId: string) =>
        api.post(`/meetings/${meetingId}/actions/${actionId}/confirm`),
    rejectAction: (meetingId: string, actionId: string) =>
        api.post(`/meetings/${meetingId}/actions/${actionId}/reject`),
    delete: (id: string) => api.delete(`/meetings/${id}`),
}

// ── Transcript endpoints ──────────────────────────────────────────────
export const transcriptApi = {
    get: (id: string) => api.get(`/transcripts/${id}`),
    export: (id: string, fmt: 'txt' | 'json') =>
        api.get(`/transcripts/${id}/export`, {
            params: { fmt },
            responseType: fmt === 'txt' ? 'text' : 'json',
        }),
}

// ── Conversation endpoints ─────────────────────────────────────────────
export const conversationApi = {
    /** List conversations belonging to the current user */
    list: (params?: { skip?: number; limit?: number }) =>
        api.get('/conversations/', { params }),
    /** Get full conversation (including transcript) for a meeting */
    get: (meetingId: string) => api.get(`/conversations/${meetingId}`),
}

// ── Calendar endpoints ────────────────────────────────────────────────
export const calendarApi = {
    connect: () => api.get('/calendar/connect'),
    status: () => api.get('/calendar/status'),
    createEvent: (data: {
        title: string
        description?: string
        start_datetime: string
        end_datetime?: string
        attendees?: string[]
        timezone?: string
    }) => api.post('/calendar/events', data),
    confirmAction: (data: {
        meeting_id: string
        action_id: string
        start_datetime: string
        end_datetime?: string
        attendees?: string[]
        timezone?: string
    }) => api.post('/calendar/confirm-action', data),
}
