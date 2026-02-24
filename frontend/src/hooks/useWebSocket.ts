import { useEffect, useRef, useCallback } from 'react'
import { useMeetingRoomStore, useToastStore } from '../store'
import type { WSMessage } from '../types'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export function useMeetingWebSocket(meetingId: string | null, enabled: boolean = true) {
    const wsRef = useRef<WebSocket | null>(null)
    const mounted = useRef(true)
    // Tracks intentional disconnect (user ended/left) so we don't auto-reconnect
    const intentionalClose = useRef(false)
    const { addTranscriptEntry, addPendingAction } = useMeetingRoomStore()

    const disconnect = useCallback(() => {
        intentionalClose.current = true
        if (wsRef.current) {
            wsRef.current.close(1000, 'user_disconnected')
            wsRef.current = null
        }
        useMeetingRoomStore.getState().setConnected(false)
        console.log('[WS] Intentionally disconnected — transcription stopped')
    }, [])

    const connect = useCallback(() => {
        if (!meetingId || !enabled || intentionalClose.current) return

        const token = localStorage.getItem('access_token')
        if (!token) {
            console.error('[WS] No access token found')
            return
        }

        // Don't double-connect
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

        const url = `${WS_BASE}/meetings/${meetingId}/ws`
        console.log(`[WS] Connecting to ${url}...`)
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('[WS] Connection established')
            ws.send(JSON.stringify({ cmd: 'identify', token }))
            ws.send(JSON.stringify({ cmd: 'audio_config', format: 'webm', sample_rate: 16000 }))
            useMeetingRoomStore.getState().setConnected(true)
        }

        ws.onmessage = (event) => {
            if (!mounted.current) return
            try {
                const msg: WSMessage = JSON.parse(event.data)
                console.debug('[WS] Message received:', msg.type)

                switch (msg.type) {
                    case 'transcript':
                        addTranscriptEntry(msg.entry)
                        break
                    case 'action_detected':
                        if (msg.result.trigger) {
                            addPendingAction(msg.result)
                        }
                        break
                    case 'error':
                        console.error('[WS] Server error:', msg.message)
                        useToastStore.getState().addToast({
                            type: 'error',
                            title: 'Transcription Error',
                            message: msg.message,
                        })
                        break
                }
            } catch (e) {
                console.warn('[WS] Failed to parse message', e)
            }
        }

        ws.onerror = (err) => {
            console.error('[WS] Connection error:', err)
        }

        ws.onclose = (event) => {
            console.log(`[WS] Connection closed (code: ${event.code}, reason: ${event.reason})`)
            useMeetingRoomStore.getState().setConnected(false)

            // Do NOT reconnect if: unmounted, intentionally closed, or auth/critical error
            if (!mounted.current || intentionalClose.current) return
            if (event.code === 4001 || event.code === 4004 || event.code === 1000) return

            // Auto-reconnect only on unexpected drops
            console.log('[WS] Unexpected close — reconnecting in 3s...')
            setTimeout(() => {
                if (mounted.current && !intentionalClose.current && enabled) {
                    connect()
                }
            }, 3000)
        }
    }, [meetingId, enabled, addTranscriptEntry, addPendingAction])

    // Connect when enabled, disconnect immediately when disabled
    useEffect(() => {
        if (!enabled) {
            disconnect()
            return
        }
        mounted.current = true
        intentionalClose.current = false
        connect()
    }, [enabled, connect, disconnect])

    useEffect(() => {
        return () => {
            mounted.current = false
            intentionalClose.current = true
            wsRef.current?.close(1000, 'component_unmount')
        }
    }, [])

    const sendAudio = useCallback((audioData: ArrayBuffer) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(audioData)
        }
    }, [])

    return { sendAudio, disconnect }
}

// ── Audio capture hook ───────────────────────────────────────────────
export function useAudioCapture(
    onChunk: (data: ArrayBuffer) => void,
    enabled: boolean
) {
    const mediaRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    const stopCapture = useCallback(() => {
        if (mediaRef.current && mediaRef.current.state !== 'inactive') {
            mediaRef.current.stop()
        }
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        mediaRef.current = null
    }, [])

    useEffect(() => {
        if (!enabled) {
            stopCapture()
            return
        }

        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                    },
                })
                streamRef.current = stream

                const recorder = new MediaRecorder(stream, {
                    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                        ? 'audio/webm;codecs=opus'
                        : 'audio/webm',
                })

                recorder.ondataavailable = async (e) => {
                    if (e.data.size > 0) {
                        const buf = await e.data.arrayBuffer()
                        onChunk(buf)
                    }
                }

                recorder.start(1500)
                mediaRef.current = recorder
            } catch (err) {
                console.error('Audio capture failed:', err)
                useToastStore.getState().addToast({
                    type: 'error',
                    title: 'Microphone Error',
                    message: 'Could not access your microphone. Please check browser permissions.',
                })
            }
        }

        start()
        return () => {
            stopCapture()
        }
    }, [enabled, onChunk, stopCapture])
}
