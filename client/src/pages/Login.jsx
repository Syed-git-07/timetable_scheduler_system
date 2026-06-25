import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/api';
import { Lock, User, Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form);
      signIn(res.data.token, res.data.user);
      navigate(res.data.user.role === 'ADMIN' ? '/dashboard' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🗓️</div>
          <h1>TimeTable Pro</h1>
          <p>College-wide timetable scheduling system</p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 24 }}>Welcome back</h2>

          {error && (
            <div className="alert alert-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: 38, paddingRight: 40 }}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
              {loading ? <span className="inline-spinner" /> : <LogIn size={16} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Demo credentials:</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admin: <strong>admin</strong> / <strong>admin123</strong></p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Student: <strong>student</strong> / <strong>student123</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
