import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Download, Users, Mic, ChevronDown } from 'lucide-react'
import { useMeetingRoomStore } from '../../store'
import type { TranscriptEntry } from '../../types'

// Speaker color palette (cycling)
const SPEAKER_COLORS = [
    '#60a5fa', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#facc15', '#38bdf8', '#4ade80'
]
const speakerColorCache: Record<string, string> = {}
let colorIdx = 0

function getSpeakerColor(speaker: string): string {
    if (!speakerColorCache[speaker]) {
        speakerColorCache[speaker] = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length]
        colorIdx++
    }
    return speakerColorCache[speaker]
}

function getSpeakerInitial(speaker: string): string {
    return speaker.charAt(0).toUpperCase()
}

function TranscriptEntryItem({ entry, isLatest }: { entry: TranscriptEntry; isLatest: boolean }) {
    const color = getSpeakerColor(entry.speaker)
    return (
        <div className="transcript-entry" style={{
            display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
            ...(isLatest ? { background: 'rgba(59,130,246,0.04)' } : {}),
        }}>
            {/* Avatar */}
            <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `${color}22`,
                border: `1.5px solid ${color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6875rem', fontWeight: 700, color,
                flexShrink: 0, marginTop: '0.125rem',
            }}>
                {getSpeakerInitial(entry.speaker)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>
                        {entry.speaker}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {entry.time}
                    </span>
                    {isLatest && (
                        <span style={{
                            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em',
                            color: 'var(--color-success)',
                            background: 'rgba(16,185,129,0.1)',
                            padding: '0.05rem 0.35rem', borderRadius: '999px',
                        }}>LIVE</span>
                    )}
                </div>
                <p style={{ fontSize: '0.845rem', color: 'var(--text-primary)', lineHeight: 1.55, wordBreak: 'break-word' }}>
                    {entry.text}
                </p>
            </div>
        </div>
    )
}

interface TranscriptPanelProps {
    meetingId?: string
    entries?: TranscriptEntry[]
    compact?: boolean
}

export function TranscriptPanel({ meetingId, entries: externalEntries, compact }: TranscriptPanelProps) {
    const { transcript: storeTranscript, isConnected } = useMeetingRoomStore()
    const bottomRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const [autoScroll, setAutoScroll] = useState(true)

    const entries = externalEntries || storeTranscript
    const participants = [...new Set(entries.map((e) => e.speaker))]

    // Auto-scroll to bottom on new entry (only if user hasn't scrolled up)
    useEffect(() => {
        if (autoScroll) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [entries.length, autoScroll])

    // Detect manual scroll up → pause auto-scroll
    const handleScroll = () => {
        const el = scrollRef.current
        if (!el) return
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        setAutoScroll(atBottom)
    }

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        setAutoScroll(true)
    }

    const handleExport = () => {
        if (!entries.length) return
        const lines = entries.map((e) => `[${e.time}] ${e.speaker}: ${e.text}`)
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transcript-${meetingId || 'export'}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="sidebar" style={compact ? { width: '100%', borderLeft: 'none', borderTop: '1px solid var(--color-border)' } : {}}>

            {/* ── Panel header ─────────────────────────────────────────────── */}
            <div style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-bg-elevated)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: participants.length > 0 ? '0.625rem' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageSquare size={15} color="var(--color-accent)" />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            Transcript
                        </span>
                        {/* Live/offline badge */}
                        <span style={{
                            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                            color: isConnected ? 'var(--color-success)' : 'var(--text-muted)',
                            background: isConnected ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                            padding: '0.15rem 0.45rem', borderRadius: '999px',
                        }}>
                            {isConnected && <span style={{
                                display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                                background: 'var(--color-success)',
                                animation: 'recording-pulse 1.2s ease-in-out infinite',
                            }} />}
                            {isConnected ? 'LIVE' : 'OFFLINE'}
                        </span>

                        {/* Entry count */}
                        <span style={{
                            fontSize: '0.6875rem', fontWeight: 600,
                            background: 'rgba(59,130,246,0.12)',
                            color: '#93c5fd', padding: '0.1rem 0.45rem', borderRadius: '999px',
                        }}>
                            {entries.length}
                        </span>
                    </div>

                    <button
                        className="btn btn-ghost btn-icon-sm"
                        onClick={handleExport}
                        title="Export transcript"
                        disabled={entries.length === 0}
                    >
                        <Download size={13} />
                    </button>
                </div>

                {/* Speaker pills */}
                {participants.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {participants.map((p) => (
                            <span key={p} style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                fontSize: '0.6rem', fontWeight: 700,
                                background: `${getSpeakerColor(p)}15`,
                                color: getSpeakerColor(p),
                                border: `1px solid ${getSpeakerColor(p)}30`,
                                padding: '0.15rem 0.45rem', borderRadius: '999px',
                            }}>
                                <Mic size={8} /> {p}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Entries ───────────────────────────────────────────────────── */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
            >
                {entries.length === 0 ? (
                    <div className="empty-state">
                        <div style={{
                            width: 48, height: 48, borderRadius: '14px',
                            background: 'rgba(59,130,246,0.08)',
                            border: '1px solid rgba(59,130,246,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <MessageSquare size={22} style={{ opacity: 0.4 }} />
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6, maxWidth: 200 }}>
                            {isConnected
                                ? 'Listening… Start speaking and your words will appear here.'
                                : 'Connecting to transcription…'}
                        </p>
                    </div>
                ) : (
                    entries.map((entry, i) => (
                        <TranscriptEntryItem
                            key={entry.id}
                            entry={entry}
                            isLatest={i === entries.length - 1}
                        />
                    ))
                )}
                <div ref={bottomRef} />
            </div>

            {/* ── Scroll-to-bottom button ───────────────────────────────────── */}
            {!autoScroll && entries.length > 0 && (
                <button
                    onClick={scrollToBottom}
                    style={{
                        position: 'absolute', bottom: '1rem', right: '1rem',
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'var(--color-primary)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px var(--color-primary-glow)',
                        zIndex: 10, transition: 'all 0.2s ease',
                    }}
                    title="Jump to latest"
                >
                    <ChevronDown size={16} color="#fff" />
                </button>
            )}
        </div>
    )
}
