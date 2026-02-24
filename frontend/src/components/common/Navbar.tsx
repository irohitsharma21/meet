import { Link, useNavigate } from 'react-router-dom'
import { Video, LayoutDashboard, LogOut, Calendar } from 'lucide-react'
import { useAuthStore } from '../../store'

export function Navbar() {
    const { user, clearAuth, isAuthenticated } = useAuthStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        clearAuth()
        navigate('/login')
    }

    return (
        <nav className="navbar">
            <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                {/* Brand */}
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '10px',
                        background: 'var(--gradient-brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <Video size={18} color="#fff" />
                    </div>
                    <span className="navbar-brand">MeetAI</span>
                </Link>

                {/* Nav links */}
                {isAuthenticated && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Link to="/dashboard" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <LayoutDashboard size={15} /> Dashboard
                        </Link>
                        <Link to="/calendar" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={15} /> Calendar
                        </Link>
                    </div>
                )}

                {/* User section */}
                {isAuthenticated ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: 'var(--gradient-brand)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                            }}>
                                {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
                            </div>
                            <div style={{ lineHeight: 1.2 }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {user?.display_name || user?.username}
                                </div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                    {user?.role}
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: 'var(--color-danger)' }}>
                            <LogOut size={14} />
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link to="/login" className="btn btn-secondary btn-sm">Login</Link>
                        <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
                    </div>
                )}
            </div>
        </nav>
    )
}
