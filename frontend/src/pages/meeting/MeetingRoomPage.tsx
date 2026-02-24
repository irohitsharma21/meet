import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Video, Bot, Zap, Clock } from 'lucide-react'
import { VideoGrid } from '../../components/meeting/VideoGrid'
import { TranscriptPanel } from '../../components/meeting/TranscriptPanel'
import { ActionPopupSystem } from '../../components/meeting/ActionPopup'
import { useMeetingRoomStore, useToastStore } from '../../store'
import { meetingApi } from '../../lib/api'
import { useMeetingWebSocket, useAudioCapture } from '../../hooks/useWebSocket'
import type { Meeting } from '../../types'

export function MeetingRoomPage() {
    const { meetingId } = useParams<{ meetingId: string }>()
    const navigate = useNavigate()
    const { addToast } = useToastStore()
    const {
        currentMeeting, setMeeting, clearRoom, livekitToken,
        roomRole, isConnected, isMicMuted,
    } = useMeetingRoomStore()

    const [isJoining, setIsJoining] = useState(true)
    const [isLeaving, setIsLeaving] = useState(false)
    const [callActive, setCallActive] = useState(false)
    const [duration, setDuration] = useState(0)  // seconds elapsed

    const isHost = roomRole === 'host'

    // ── WebSocket transcription (stops the moment callActive → false) ──────────
    const { sendAudio, disconnect: disconnectWS } = useMeetingWebSocket(
        meetingId && livekitToken ? meetingId : null,
        callActive
    )

    const handleAudioChunk = useCallback((data: ArrayBuffer) => {
        sendAudio(data)
    }, [sendAudio])

    useAudioCapture(handleAudioChunk, callActive && !isMicMuted)

    // ── Meeting duration timer ─────────────────────────────────────────────────
    useEffect(() => {
        if (!callActive) return
        const t = setInterval(() => setDuration(d => d + 1), 1000)
        return () => clearInterval(t)
    }, [callActive])

    const formatDuration = (s: number) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = s % 60
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
            : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }

    // ── Join meeting ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!meetingId) return

        const joinMeeting = async () => {
            try {
                setIsJoining(true)
                const joinRes = await meetingApi.join(meetingId)
                const { livekit_token, livekit_url, role } = joinRes.data

                const meetingRes = await meetingApi.get(meetingId)
                const meeting: Meeting = meetingRes.data
                setMeeting(meeting, livekit_token, livekit_url, role)

                if (role === 'host' && meeting.status === 'scheduled') {
                    await meetingApi.start(meetingId)
                }
                setCallActive(true)
            } catch (err: any) {
                const detail = err.response?.data?.detail
                addToast({
                    type: 'error',
                    title: err.response?.status === 503 ? 'Video not configured' : 'Failed to join meeting',
                    message: typeof detail === 'string' ? detail : 'Please try again',
                })
                navigate('/dashboard')
            } finally {
                setIsJoining(false)
            }
        }

        joinMeeting()

        return () => {
            setCallActive(false)
            clearRoom()
        }
    }, [meetingId])

    // ── Shared stop logic ──────────────────────────────────────────────────────
    const stopCall = useCallback(() => {
        setCallActive(false)
        disconnectWS()
    }, [disconnectWS])

    // ── HOST: End meeting → generate report ────────────────────────────────────
    const handleEndMeeting = async () => {
        if (!meetingId || isLeaving) return
        try {
            setIsLeaving(true)
            stopCall()                          // stop transcription IMMEDIATELY
            await meetingApi.end(meetingId)
            addToast({ type: 'success', title: 'Meeting ended', message: 'Generating AI report…' })
            clearRoom()
            navigate(`/meetings/${meetingId}/report`)
        } catch (err) {
            addToast({ type: 'error', title: 'Failed to end meeting' })
            setIsLeaving(false)
            setCallActive(true)                 // re-enable only if API call failed
        }
    }

    // ── PARTICIPANT / SELF: Leave → dashboard ──────────────────────────────────
    const handleLeaveMeeting = useCallback(() => {
        if (isLeaving) return
        setIsLeaving(true)
        stopCall()                              // stop transcription IMMEDIATELY
        clearRoom()
        addToast({ type: 'info', title: 'You left the meeting' })
        navigate('/dashboard')
    }, [isLeaving, stopCall, clearRoom, navigate, addToast])

    // ── Joining loader ─────────────────────────────────────────────────────────
    if (isJoining) {
        return (
            <div style={{
                height: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexDirection: 'column', gap: '1.5rem',
                background: 'var(--color-bg-base)',
            }}>
                <div style={{
                    width: 72, height: 72, borderRadius: '20px',
                    background: 'var(--gradient-brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 12px 40px var(--color-primary-glow)',
                    animation: 'glow-pulse 2s ease infinite',
                }}>
                    <Video size={32} color="#fff" />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.375rem' }}>
                        Joining meeting…
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Setting up audio, video & AI transcription
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: 'var(--color-primary)',
                            animation: `glow-pulse 1.2s ease infinite`,
                            animationDelay: `${i * 0.2}s`,
                        }} />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-base)' }}>

            {/* ── Top header bar ──────────────────────────────────────────── */}
            <div style={{
                height: 52,
                background: 'var(--color-bg-surface)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center',
                padding: '0 1rem', gap: '0.75rem', flexShrink: 0,
            }}>
                {/* Logo + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: '8px',
                        background: 'var(--gradient-brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Video size={13} color="#fff" />
                    </div>
                    <span style={{
                        fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
                    }}>
                        {currentMeeting?.title || 'Meeting'}
                    </span>
                </div>

                {/* Right side status row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginLeft: 'auto', flexShrink: 0 }}>

                    {/* Duration */}
                    {callActive && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.75rem', color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                        }}>
                            <Clock size={11} />
                            {formatDuration(duration)}
                        </div>
                    )}

                    {/* Live transcript pill */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.72rem', fontWeight: 600,
                        color: isConnected ? 'var(--color-success)' : 'var(--text-muted)',
                        background: isConnected ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                        padding: '0.2rem 0.55rem', borderRadius: '999px',
                        border: `1px solid ${isConnected ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}`,
                        transition: 'all 0.3s ease',
                    }}>
                        <Zap size={11} />
                        {isConnected ? 'Live' : 'Connecting…'}
                    </div>

                    {/* AI active pill */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.72rem', fontWeight: 600,
                        color: 'var(--color-purple)',
                        background: 'rgba(139,92,246,0.1)',
                        padding: '0.2rem 0.55rem', borderRadius: '999px',
                        border: '1px solid rgba(139,92,246,0.2)',
                    }}>
                        <Bot size={11} />
                        AI
                    </div>

                    {/* Role badge */}
                    {roomRole && (
                        <span className={`badge ${isHost ? 'badge-blue' : 'badge-gray'}`}
                            style={{ textTransform: 'capitalize', fontSize: '0.65rem' }}>
                            {roomRole}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Main area: video + transcript ───────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Video */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                    <VideoGrid
                        meetingId={meetingId!}
                        onEnd={handleEndMeeting}
                        onLeave={handleLeaveMeeting}
                        isHost={isHost}
                    />
                </div>

                {/* Transcript panel */}
                <TranscriptPanel meetingId={meetingId} />
            </div>

            {/* AI action popups */}
            {meetingId && <ActionPopupSystem meetingId={meetingId} />}
        </div>
    )
}
