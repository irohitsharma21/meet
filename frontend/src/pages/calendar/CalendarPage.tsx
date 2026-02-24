import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
    Calendar, CheckCircle2, ExternalLink, RefreshCw,
    Plus, Clock, Users, ArrowRight, AlertCircle, Zap,
} from 'lucide-react'
import { calendarApi } from '../../lib/api'
import { useToastStore } from '../../store'

function SetupStep({ n, title, desc, children }: { n: string; title: string; desc: string; children?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--gradient-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8125rem', fontWeight: 700, color: '#fff',
            }}>{n}</div>
            <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{title}</div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
                {children}
            </div>
        </div>
    )
}

export function CalendarPage() {
    const { addToast } = useToastStore()
    const location = useLocation()
    const [isConnected, setIsConnected] = useState<boolean | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)
    const [showEventForm, setShowEventForm] = useState(false)
    const [eventForm, setEventForm] = useState({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        duration: '60',
        attendees: '',
    })
    const [isCreating, setIsCreating] = useState(false)

    const checkStatus = async () => {
        try {
            setIsLoading(true)
            const res = await calendarApi.status()
            setIsConnected(res.data.connected)
        } catch {
            setIsConnected(false)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        checkStatus()
        // Auto-show success toast if redirected from OAuth callback
        if (location.search.includes('connected=true') || location.pathname.includes('success')) {
            addToast({ type: 'success', title: '🎉 Google Calendar Connected!', message: 'AI-confirmed actions will now auto-schedule.' })
        }
    }, [])

    const [configError, setConfigError] = useState(false)

    const handleConnect = async () => {
        try {
            setIsConnecting(true)
            setConfigError(false)
            const res = await calendarApi.connect()
            // Open OAuth in same tab so callback can redirect back
            window.location.href = res.data.auth_url
        } catch (err: any) {
            setIsConnecting(false)
            const status = err.response?.status
            const detail = err.response?.data?.detail || ''
            if (status === 503 || detail.toLowerCase().includes('not configured')) {
                // Backend has no Google credentials set — show setup guide
                setConfigError(true)
            } else {
                addToast({ type: 'error', title: 'Connection Failed', message: detail || 'Failed to get authorization URL' })
            }
        }
    }

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setIsCreating(true)
            const start = new Date(`${eventForm.date}T${eventForm.time}:00`)
            const end = new Date(start.getTime() + parseInt(eventForm.duration) * 60000)
            const attendees = eventForm.attendees.split(',').map(a => a.trim()).filter(Boolean)

            const res = await calendarApi.createEvent({
                title: eventForm.title,
                description: eventForm.description,
                start_datetime: start.toISOString(),
                end_datetime: end.toISOString(),
                attendees: attendees.length > 0 ? attendees : undefined,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })

            addToast({
                type: 'success', title: 'Event Created!',
                message: `"${eventForm.title}" added to your calendar`,
            })
            setShowEventForm(false)
            setEventForm({ title: '', description: '', date: new Date().toISOString().split('T')[0], time: '10:00', duration: '60', attendees: '' })

            // Open the calendar event link
            if (res.data.html_link) {
                window.open(res.data.html_link, '_blank')
            }
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Failed to create event'
            addToast({ type: 'error', title: 'Event Creation Failed', message: detail })
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 720 }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                        <Calendar size={28} color="var(--color-primary)" /> Google Calendar
                    </h1>
                    <p>Connect your calendar to auto-schedule AI-detected action items from meetings.</p>
                </div>

                {/* Connection Status Card */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: isConnected === false ? '1.5rem' : 0 }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: '14px',
                            background: isConnected ? 'rgba(16,185,129,0.12)' : 'var(--color-bg-elevated)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${isConnected ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'}`,
                            flexShrink: 0,
                        }}>
                            {isLoading ? (
                                <RefreshCw size={22} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : isConnected ? (
                                <CheckCircle2 size={26} color="var(--color-success)" />
                            ) : (
                                <Calendar size={24} color="var(--text-muted)" />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>
                                {isLoading ? 'Checking connection…'
                                    : isConnected ? '✅ Google Calendar Connected'
                                        : '⚠️ Not Connected'}
                            </div>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                {isConnected
                                    ? 'AI-confirmed actions from meetings will be automatically added to your calendar.'
                                    : 'Link your Google account to enable automatic event scheduling.'}
                            </p>
                        </div>
                        {isConnected && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                <button className="btn btn-secondary btn-sm" onClick={checkStatus}>
                                    <RefreshCw size={13} /> Refresh
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowEventForm(v => !v)}>
                                    <Plus size={13} /> New Event
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Config Error Banner ── */}
                    {configError && (
                        <div style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.35)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem 1.125rem',
                            marginBottom: '1rem',
                        }}>
                            <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <AlertCircle size={15} /> Google Calendar not configured on the server
                            </div>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
                                Your backend <code style={{ background: 'var(--color-bg-base)', padding: '1px 5px', borderRadius: 4 }}>backend/.env</code> is missing Google OAuth credentials.
                                Follow these steps:
                            </p>
                            <ol style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', lineHeight: 2 }}>
                                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>console.cloud.google.com → APIs & Services → Credentials</a></li>
                                <li>Click <strong style={{ color: 'var(--text-primary)' }}>Create Credentials → OAuth 2.0 Client ID</strong></li>
                                <li>Application type: <strong style={{ color: 'var(--text-primary)' }}>Web application</strong></li>
                                <li>Add Authorized redirect URI: <code style={{ background: 'var(--color-bg-base)', padding: '1px 5px', borderRadius: 3, color: 'var(--color-primary)' }}>http://localhost:8000/calendar/oauth2callback</code></li>
                                <li>Enable <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Google Calendar API</a></li>
                                <li>Copy Client ID &amp; Secret into <code style={{ background: 'var(--color-bg-base)', padding: '1px 5px', borderRadius: 3 }}>backend/.env</code>:</li>
                            </ol>
                            <code style={{
                                display: 'block',
                                background: 'var(--color-bg-base)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                padding: '0.625rem 0.875rem',
                                fontSize: '0.8125rem',
                                color: 'var(--color-success)',
                                whiteSpace: 'pre',
                                marginTop: '0.5rem',
                            }}>{`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here`}</code>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.625rem' }}>
                                After updating <code>.env</code>, restart uvicorn, then click Connect again.
                            </p>
                        </div>
                    )}

                    {/* Connect Button */}
                    {!isConnected && !isLoading && (
                        <button
                            className="btn btn-primary"
                            onClick={handleConnect}
                            disabled={isConnecting}
                            style={{ width: '100%', height: 48, fontSize: '0.9375rem' }}
                        >
                            {isConnecting ? (
                                <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Redirecting to Google…</>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 2 }}>
                                        <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Connect with Google
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    )}

                    {/* Inline Event Creation Form */}
                    {isConnected && showEventForm && (
                        <form onSubmit={handleCreateEvent} style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem', fontSize: '0.9375rem', fontWeight: 600 }}>
                                <Plus size={15} style={{ marginRight: 6 }} />Create Event
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                <div className="form-group">
                                    <label className="label">Title *</label>
                                    <input className="input" required placeholder="e.g., Follow-up call with team"
                                        value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Description</label>
                                    <input className="input" placeholder="Optional notes"
                                        value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label className="label">Date</label>
                                        <input className="input" type="date" required
                                            value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Time</label>
                                        <input className="input" type="time" required
                                            value={eventForm.time} onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Duration (min)</label>
                                        <select className="input" value={eventForm.duration} onChange={e => setEventForm(f => ({ ...f, duration: e.target.value }))}>
                                            {['15', '30', '45', '60', '90', '120'].map(d => <option key={d} value={d}>{d} min</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="label">Attendees (emails, comma-separated)</label>
                                    <input className="input" placeholder="alice@gmail.com, bob@gmail.com"
                                        value={eventForm.attendees} onChange={e => setEventForm(f => ({ ...f, attendees: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEventForm(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isCreating}>
                                        {isCreating ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</> : <><Calendar size={14} /> Create Event</>}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* Setup Guide — only show when not connected */}
                {!isConnected && !isLoading && (
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                            <AlertCircle size={16} color="var(--color-warning)" />
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Setup Required</h3>
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                            You need Google OAuth credentials in your backend <code style={{ background: 'var(--color-bg-elevated)', padding: '1px 5px', borderRadius: 4 }}>backend/.env</code> file before connecting.
                        </p>

                        <SetupStep n="1" title="Open Google Cloud Console"
                            desc="Go to console.cloud.google.com → APIs & Services → Credentials">
                            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
                                <ExternalLink size={12} /> Open Console
                            </a>
                        </SetupStep>

                        <SetupStep n="2" title='Create OAuth 2.0 Client ID'
                            desc='Click "Create Credentials" → "OAuth 2.0 Client ID" → Application type: "Web application"' />

                        <SetupStep n="3" title="Add Redirect URI"
                            desc='Under "Authorized redirect URIs", add exactly:'>
                            <code style={{
                                display: 'block', marginTop: '0.375rem',
                                background: 'var(--color-bg-elevated)', padding: '0.5rem 0.75rem',
                                borderRadius: 6, fontSize: '0.8125rem', color: 'var(--color-primary)',
                                border: '1px solid var(--color-border)', wordBreak: 'break-all',
                            }}>http://localhost:8000/calendar/oauth2callback</code>
                        </SetupStep>

                        <SetupStep n="4" title="Enable the Calendar API"
                            desc="In APIs & Services → Library, search for and enable: Google Calendar API">
                            <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
                                <ExternalLink size={12} /> Enable Calendar API
                            </a>
                        </SetupStep>

                        <SetupStep n="5" title="Update backend/.env"
                            desc="Copy your Client ID and Client Secret into the .env file:">
                            <code style={{
                                display: 'block', marginTop: '0.375rem',
                                background: 'var(--color-bg-elevated)', padding: '0.625rem 0.875rem',
                                borderRadius: 6, fontSize: '0.8125rem', color: 'var(--color-success)',
                                border: '1px solid var(--color-border)', whiteSpace: 'pre',
                            }}>{`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=GOCSPX-your-secret`}</code>
                        </SetupStep>

                        <SetupStep n="6" title="Restart the backend server"
                            desc='Run: uvicorn main:app --reload --port 8000 — then click "Connect with Google" above.' />
                    </div>
                )}

                {/* How it works */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Zap size={16} color="var(--color-accent)" />
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>How AI Calendar Sync Works</h3>
                    </div>
                    {[
                        { icon: <Users size={15} />, title: 'During the meeting', text: 'AI listens for commitments like "let\'s meet Thursday" or "I\'ll send the report by Friday"' },
                        { icon: <AlertCircle size={15} />, title: 'Real-time popup', text: 'A popup appears asking you to confirm or dismiss the detected action item' },
                        { icon: <Calendar size={15} />, title: 'Auto-scheduled', text: 'Confirmed actions are instantly added to your Google Calendar with reminders' },
                        { icon: <Clock size={15} />, title: 'After the meeting', text: 'Visit the Report page to manually schedule any action items via the Actions tab' },
                    ].map(({ icon, title, text }) => (
                        <div key={title} style={{ display: 'flex', gap: '0.875rem', marginBottom: '0.875rem', alignItems: 'flex-start' }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                                background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--color-accent)',
                            }}>{icon}</div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.15rem' }}>{title}</div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                select.input { appearance: auto; }
            `}</style>
        </div>
    )
}
