import { useEffect, useRef } from 'react'
import {
    LiveKitRoom,
    VideoConference,
    useLocalParticipant,
    RoomAudioRenderer,
    useConnectionState,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import '@livekit/components-styles'
import {
    Mic, MicOff, Video, VideoOff, PhoneOff,
    ScreenShare, ScreenShareOff,
} from 'lucide-react'
import { useMeetingRoomStore } from '../../store'

interface VideoGridProps {
    meetingId: string
    onEnd: () => void        // Host: end meeting → report
    onLeave: () => void      // Participant: leave → dashboard
    isHost: boolean
}

// Inner component — must be inside <LiveKitRoom> to use LiveKit hooks
function RoomInner({ onEnd, onLeave, isHost }: Omit<VideoGridProps, 'meetingId'>) {
    const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant()
    const { toggleMic, toggleCamera } = useMeetingRoomStore()
    const connectionState = useConnectionState()

    // Track whether we've ever actually connected — prevents false redirect on mount
    // (ConnectionState starts as Disconnected before the room is established)
    const hasConnected = useRef(false)

    // ── Detect room disconnection (host ended / kicked / network drop) ────────
    useEffect(() => {
        if (connectionState === ConnectionState.Connected) {
            hasConnected.current = true
        }
        // Only redirect if we were previously connected (not on initial mount)
        if (connectionState === ConnectionState.Disconnected && hasConnected.current) {
            onLeave()
        }
    }, [connectionState, onLeave])

    // ── Screen share state ────────────────────────────────────────────────────
    const isSharing = localParticipant?.isScreenShareEnabled ?? false

    const handleMicToggle = async () => {
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
        toggleMic()
    }

    const handleCameraToggle = async () => {
        await localParticipant.setCameraEnabled(!isCameraEnabled)
        toggleCamera()
    }

    const handleScreenShare = async () => {
        await localParticipant.setScreenShareEnabled(!isSharing)
    }

    const handleLeaveOrEnd = isHost ? onEnd : onLeave

    return (
        <>
            <VideoConference />
            <RoomAudioRenderer />

            {/* Controls bar */}
            <div className="controls-bar">
                {/* Recording indicator */}
                <div className="recording-indicator" style={{ marginRight: 'auto' }}>
                    <span className="recording-dot" />
                    REC
                </div>

                <button
                    className={`control-btn ${isMicrophoneEnabled ? 'active' : 'muted'}`}
                    onClick={handleMicToggle}
                    title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                    {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <button
                    className={`control-btn ${isCameraEnabled ? 'active' : 'muted'}`}
                    onClick={handleCameraToggle}
                    title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                    {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>

                <button
                    className={`control-btn ${isSharing ? 'muted' : 'active'}`}
                    onClick={handleScreenShare}
                    title={isSharing ? 'Stop sharing' : 'Share screen'}
                >
                    {isSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
                </button>

                {/* End/Leave button */}
                <button
                    className="control-btn end-call"
                    onClick={handleLeaveOrEnd}
                    title={isHost ? 'End meeting for everyone' : 'Leave meeting'}
                    style={{ width: isHost ? '4.5rem' : '3.5rem', borderRadius: '999px', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600 }}
                >
                    <PhoneOff size={18} />
                    {isHost ? 'End' : 'Leave'}
                </button>
            </div>
        </>
    )
}

export function VideoGrid({ onEnd, onLeave, isHost }: VideoGridProps) {
    const { livekitToken, livekitUrl } = useMeetingRoomStore()

    if (!livekitToken || !livekitUrl) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                    width: 48, height: 48, borderRadius: '14px',
                    background: 'var(--gradient-brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'glow-pulse 2s ease infinite',
                }}>
                    <Video size={22} color="#fff" />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Connecting to room…</p>
            </div>
        )
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-base)' }}>
            <LiveKitRoom
                token={livekitToken}
                serverUrl={livekitUrl}
                connect={true}
                video={true}
                audio={true}
                style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
                <RoomInner onEnd={onEnd} onLeave={onLeave} isHost={isHost} />
            </LiveKitRoom>
        </div>
    )
}
