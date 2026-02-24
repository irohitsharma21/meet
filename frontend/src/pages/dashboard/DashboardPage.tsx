import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Plus, Search, Video, Users, Clock, FileText,
    BarChart2, Trash2, Calendar
} from 'lucide-react'
import { useDashboardStore, useAuthStore, useToastStore } from '../../store'
import { meetingApi } from '../../lib/api'
import type { MeetingListItem } from '../../types'
import { formatDistanceToNow } from 'date-fns'

function MeetingStatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        scheduled: 'badge-blue',
        active: 'badge-green',
        ended: 'badge-gray',
        processed: 'badge-purple',
    }
    return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>
}

function MeetingCard({ meeting, onDelete }: { meeting: MeetingListItem; onDelete: (id: string) => void }) {
    const navigate = useNavigate()
    const duration = meeting.duration_seconds
        ? `${Math.round(meeting.duration_seconds / 60)}m`
        : null

    return (
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => {
            // Active → join. Ended/Processed → report
            if (meeting.status === 'active') navigate(`/meetings/${meeting.meeting_id}`)
            else navigate(`/meetings/${meeting.meeting_id}/report`)
        }}>
            {/* Status strip */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: meeting.status === 'active' ? 'var(--color-success)'
                    : meeting.status === 'processed' ? 'var(--gradient-brand)'
                        : 'var(--color-border)',
            }} />

            <div style={{ paddingTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {/* Title row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                        <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            {meeting.title}
                        </h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            by {meeting.created_by} · {formatDistanceToNow(new Date(meeting.timestamp), { addSuffix: true })}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                        <MeetingStatusBadge status={meeting.status} />
                    </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        <Users size={13} color="var(--color-accent)" />
                        {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
                    </div>
                    {duration && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            <Clock size={13} color="var(--color-accent)" />
                            {duration}
                        </div>
                    )}
                    {meeting.has_report && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-purple)' }}>
                            <BarChart2 size={13} />
                            AI Report
                        </div>
                    )}
                </div>

                {/* Participants */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {meeting.participants.slice(0, 5).map((p) => (
                        <span key={p} style={{
                            fontSize: '0.6875rem',
                            background: 'var(--color-bg-elevated)',
                            color: 'var(--text-secondary)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            border: '1px solid var(--color-border)',
                        }}>{p}</span>
                    ))}
                    {meeting.participants.length > 5 && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            +{meeting.participants.length - 5} more
                        </span>
                    )}
                </div>

                {/* Footer actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem', borderTop: '1px solid var(--color-border)' }}
                    onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                        {meeting.status === 'active' && (
                            <Link to={`/meetings/${meeting.meeting_id}`} className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                <Video size={12} /> Join
                            </Link>
                        )}
                        {/* Allow generating report for active meetings (in case participants left without ending) */}
                        {meeting.status === 'active' && (
                            <Link to={`/meetings/${meeting.meeting_id}/report`} className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                <FileText size={12} /> Report
                            </Link>
                        )}
                        {(meeting.status === 'ended' || meeting.status === 'processed') && (
                            <Link to={`/meetings/${meeting.meeting_id}/report`} className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                <FileText size={12} /> {meeting.has_report ? 'View Report' : 'View Transcript'}
                            </Link>
                        )}
                    </div>
                    <button className="btn btn-ghost btn-icon-sm" title="Delete"
                        onClick={(e) => { e.stopPropagation(); onDelete(meeting.meeting_id) }}
                        style={{ color: 'var(--color-danger)', opacity: 0.7 }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}

function CreateMeetingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [participants, setParticipants] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { addToast } = useToastStore()
    const navigate = useNavigate()

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return
        try {
            setIsLoading(true)
            const res = await meetingApi.create({
                title,
                description,
                participants: participants.split(',').map((p) => p.trim()).filter(Boolean),
            })
            const { meeting_id } = res.data
            addToast({ type: 'success', title: 'Meeting created', message: 'Joining now…' })
            onCreated()
            onClose()
            navigate(`/meetings/${meeting_id}`)
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed to create meeting', message: err.response?.data?.detail })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="overlay" onClick={onClose}>
            <div className="card" style={{ width: '100%', maxWidth: 480, zIndex: 101 }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.125rem' }}>Create New Meeting</h3>
                        <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>Start a new AI-powered meeting session</p>
                    </div>
                </div>

                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="label">Meeting Title *</label>
                        <input className="input" placeholder="e.g., Q4 Strategy Review" value={title}
                            onChange={(e) => setTitle(e.target.value)} required autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="label">Description</label>
                        <input className="input" placeholder="Brief agenda or topic" value={description}
                            onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="label">Invite Participants (usernames, comma-separated)</label>
                        <input className="input" placeholder="alice, bob, charlie" value={participants}
                            onChange={(e) => setParticipants(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isLoading}>
                            <Video size={15} /> {isLoading ? 'Creating…' : 'Start Meeting'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export function DashboardPage() {
    const { user } = useAuthStore()
    const { meetings, isLoading, searchQuery, setMeetings, setLoading, setSearchQuery } = useDashboardStore()
    const { addToast } = useToastStore()
    const [showCreate, setShowCreate] = useState(false)

    const loadMeetings = async (q?: string) => {
        try {
            setLoading(true)
            const params: Record<string, unknown> = { limit: 50 }
            if (q) params.q = q
            const res = await meetingApi.list(params)
            setMeetings(res.data.meetings)
        } catch {
            addToast({ type: 'error', title: 'Failed to load meetings' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadMeetings() }, [])

    const handleSearch = (q: string) => {
        setSearchQuery(q)
        loadMeetings(q)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this meeting?')) return
        try {
            await meetingApi.delete(id)
            setMeetings(meetings.filter((m) => m.meeting_id !== id))
            addToast({ type: 'success', title: 'Meeting deleted' })
        } catch {
            addToast({ type: 'error', title: 'Failed to delete meeting' })
        }
    }

    const activeMeetings = meetings.filter((m) => m.status === 'active')
    const pastMeetings = meetings.filter((m) => m.status !== 'active')

    return (
        <div className="page">
            <div className="container">
                {/* Page header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ marginBottom: '0.375rem' }}>
                            Welcome back, {user?.display_name || user?.username} 👋
                        </h1>
                        <p>Your AI-powered meeting hub</p>
                    </div>
                    {(user?.role === 'host' || user?.role === 'admin') && (
                        <button className="btn btn-primary btn-lg" onClick={() => setShowCreate(true)}>
                            <Plus size={18} /> New Meeting
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {[
                        { label: 'Total Meetings', value: meetings.length, icon: <Video size={20} />, color: 'var(--color-primary)' },
                        { label: 'Active Now', value: activeMeetings.length, icon: <Zap size={20} />, color: 'var(--color-success)' },
                        { label: 'AI Reports', value: meetings.filter((m) => m.has_report).length, icon: <BarChart2 size={20} />, color: 'var(--color-purple)' },
                        { label: 'Participants', value: [...new Set(meetings.flatMap((m) => m.participants))].length, icon: <Users size={20} />, color: 'var(--color-accent)' },
                    ].map((stat) => (
                        <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
                            <div style={{ color: stat.color, marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>{stat.icon}</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
                    <Search size={16} color="var(--text-muted)" />
                    <input
                        placeholder="Search meetings by title, keyword, or participant…"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>

                {/* Active meetings */}
                {activeMeetings.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="status-dot active" /> Active Meetings
                        </h2>
                        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                            {activeMeetings.map((m) => <MeetingCard key={m.meeting_id} meeting={m} onDelete={handleDelete} />)}
                        </div>
                    </div>
                )}

                {/* Past meetings */}
                <div>
                    <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                        Meeting History
                    </h2>
                    {isLoading ? (
                        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="card">
                                    <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: '0.75rem' }} />
                                    <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: '1rem' }} />
                                    <div className="skeleton" style={{ height: 36 }} />
                                </div>
                            ))}
                        </div>
                    ) : pastMeetings.length === 0 ? (
                        <div className="empty-state">
                            <Calendar size={48} style={{ opacity: 0.3 }} />
                            <h3 style={{ color: 'var(--text-secondary)' }}>No meetings yet</h3>
                            <p>Create your first AI-powered meeting to get started</p>
                            {(user?.role === 'host' || user?.role === 'admin') && (
                                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                                    <Plus size={16} /> Create Meeting
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                            {pastMeetings.map((m) => <MeetingCard key={m.meeting_id} meeting={m} onDelete={handleDelete} />)}
                        </div>
                    )}
                </div>
            </div>

            {showCreate && (
                <CreateMeetingModal onClose={() => setShowCreate(false)} onCreated={() => loadMeetings()} />
            )}
        </div>
    )
}

function Zap({ size, color }: { size: number; color?: string }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
}
