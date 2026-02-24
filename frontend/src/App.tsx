import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navbar } from './components/common/Navbar'
import { ToastContainer } from './components/common/Toast'
import { LoginPage, RegisterPage } from './pages/auth/AuthPages'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { MeetingRoomPage } from './pages/meeting/MeetingRoomPage'
import { ReportPage } from './pages/report/ReportPage'
import { CalendarPage } from './pages/calendar/CalendarPage'
import { useAuthStore } from './store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore()
    if (!isAuthenticated) return <Navigate to="/login" replace />
    return <>{children}</>
}

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Navbar />
            {children}
        </>
    )
}

// Full-screen layout (no navbar) for meeting room
function FullscreenLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

export default function App() {
    return (
        <BrowserRouter>
            <ToastContainer />
            <Routes>
                {/* Auth routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Layout><DashboardPage /></Layout>
                    </ProtectedRoute>
                } />

                <Route path="/meetings/:meetingId" element={
                    <ProtectedRoute>
                        <FullscreenLayout><MeetingRoomPage /></FullscreenLayout>
                    </ProtectedRoute>
                } />

                <Route path="/meetings/:meetingId/report" element={
                    <ProtectedRoute>
                        <Layout><ReportPage /></Layout>
                    </ProtectedRoute>
                } />

                <Route path="/calendar" element={
                    <ProtectedRoute>
                        <Layout><CalendarPage /></Layout>
                    </ProtectedRoute>
                } />

                <Route path="/calendar/success" element={
                    <ProtectedRoute>
                        <Layout>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                                <div style={{ fontSize: '4rem' }}>🎉</div>
                                <h2>Google Calendar Connected!</h2>
                                <p>Your calendar is now linked. AI-confirmed actions will be auto-scheduled.</p>
                                <a className="btn btn-primary" href="/dashboard">Back to Dashboard</a>
                            </div>
                        </Layout>
                    </ProtectedRoute>
                } />

                {/* Root redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
