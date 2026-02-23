import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Video, Eye, EyeOff, Lock, User, Mail } from 'lucide-react'
import { authApi } from '../../lib/api'
import { useAuthStore, useToastStore } from '../../store'

export function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const { setAuth } = useAuthStore()
    const { addToast } = useToastStore()
    const navigate = useNavigate()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setIsLoading(true)
            const res = await authApi.login(username, password)
            const { access_token, refresh_token } = res.data

            // Store token FIRST so the interceptor can attach it to /auth/me
            localStorage.setItem('access_token', access_token)
            localStorage.setItem('refresh_token', refresh_token)

            // Now fetch user profile (interceptor will attach token)
            const meRes = await authApi.me()
            setAuth(meRes.data, access_token, refresh_token)
            addToast({ type: 'success', title: `Welcome back, ${meRes.data.display_name || username}!` })
            navigate('/dashboard')
        } catch (err: any) {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            const detail = err.response?.data?.detail
            const message = Array.isArray(detail)
                ? detail.map((d: any) => d.msg).join(', ')
                : (detail || 'Invalid credentials')
            addToast({
                type: 'error',
                title: 'Login failed',
                message,
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div style={{ width: '100%', maxWidth: 440, padding: '1.5rem' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '18px',
                        background: 'var(--gradient-brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem',
                        boxShadow: '0 8px 32px var(--color-primary-glow)',
                    }}>
                        <Video size={30} color="#fff" />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '0.375rem' }}>Welcome back</h1>
                    <p>Sign in to your MeetAI account</p>
                </div>

                <div className="card">
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="label">Username</label>
                            <div style={{ position: 'relative' }}>
                                <User size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    id="login-username"
                                    className="input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder="your_username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    id="login-password"
                                    className="input"
                                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon-sm"
                                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', marginTop: '0.5rem' }}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>

                    <div className="divider" style={{ marginTop: '1.25rem' }} />
                    <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Don't have an account?{' '}
                        <Link to="/register" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export function RegisterPage() {
    const [form, setForm] = useState({
        username: '', email: '', password: '', display_name: '', role: 'host'
    })
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const { addToast } = useToastStore()
    const navigate = useNavigate()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setIsLoading(true)
            await authApi.register(form)
            addToast({ type: 'success', title: 'Account created!', message: 'Signing you in…' })
            // Auto-login after registration
            const loginRes = await authApi.login(form.username, form.password)
            const { access_token, refresh_token } = loginRes.data
            localStorage.setItem('access_token', access_token)
            localStorage.setItem('refresh_token', refresh_token)
            const meRes = await authApi.me()
            const { setAuth } = useAuthStore.getState()
            setAuth(meRes.data, access_token, refresh_token)
            navigate('/dashboard')
        } catch (err: any) {
            // FastAPI validation errors return detail as an array
            const detail = err.response?.data?.detail
            const message = Array.isArray(detail)
                ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(', ')
                : (detail || 'Please try again')
            addToast({
                type: 'error',
                title: 'Registration failed',
                message,
            })
        } finally {
            setIsLoading(false)
        }
    }

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }))

    return (
        <div className="auth-page">
            <div style={{ width: '100%', maxWidth: 480, padding: '1.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '18px',
                        background: 'var(--gradient-brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem',
                        boxShadow: '0 8px 32px var(--color-primary-glow)',
                    }}>
                        <Video size={30} color="#fff" />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '0.375rem' }}>Create account</h1>
                    <p>Join MeetAI and start your first AI meeting</p>
                </div>

                <div className="card">
                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="label">Username *</label>
                                <input id="reg-username" className="input" placeholder="johndoe" value={form.username}
                                    onChange={set('username')} required minLength={3} pattern="[a-zA-Z0-9_-]+" />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    Letters, numbers, _ and - only (no spaces or @)
                                </span>
                            </div>
                            <div className="form-group">
                                <label className="label">Display Name</label>
                                <input id="reg-displayname" className="input" placeholder="John Doe" value={form.display_name} onChange={set('display_name')} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="label">Email *</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input id="reg-email" className="input" style={{ paddingLeft: '2.5rem' }} type="email" placeholder="john@example.com"
                                    value={form.email} onChange={set('email')} required />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="label">Password *</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input id="reg-password" className="input" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                    type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                                    value={form.password} onChange={set('password')} required minLength={8} />
                                <button type="button" className="btn btn-ghost btn-icon-sm"
                                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
                                    onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="label">Role</label>
                            <select id="reg-role" className="input" value={form.role} onChange={set('role')}>
                                <option value="host">Host (can create meetings)</option>
                                <option value="participant">Participant</option>
                            </select>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isLoading}>
                            {isLoading ? 'Creating account…' : 'Create Account'}
                        </button>
                    </form>

                    <div className="divider" style={{ marginTop: '1.25rem' }} />
                    <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
