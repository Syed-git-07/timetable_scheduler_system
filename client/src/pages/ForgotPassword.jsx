import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/api';
import { ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const [form, setForm] = useState({ username: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPassword({ username: form.username, newPassword: form.newPassword });
      setMsg({ type: 'success', text: res.data.message });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to reset password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🔐</div>
          <h1>Reset Password</h1>
          <p>Enter your username and a new password</p>
        </div>
        <div className="card">
          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input className="form-control" placeholder="Your username" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" className="form-control" placeholder="New password" value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" className="form-control" placeholder="Confirm password" value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12 }} disabled={loading}>
              {loading ? <span className="inline-spinner" /> : <KeyRound size={16} />}
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/login" style={{ fontSize: '0.8rem', color: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
