import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Send, Loader2, LogIn, UserPlus } from 'lucide-react';
import { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserType, token: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess, showToast }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError('Please choose a username.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? { username: cleanUsername, password, telegram_chat_id: telegramChatId.trim() || undefined }
        : { username: cleanUsername, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Authentication failed');
        setErrorCode(json.code || null);
        return;
      }

      localStorage.setItem('shopee_token', json.token);
      showToast(isRegister ? `Welcome, @${json.user.username}!` : `Welcome back, @${json.user.username}!`, 'success');
      onSuccess(json.user, json.token);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setErrorCode(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', borderBottom: 'none', paddingBottom: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
            <ShieldCheck size={24} />
            <h3 className="modal-title" style={{ fontSize: '1.25rem' }}>
              {isRegister ? 'Create Anonymous Account' : 'Sign In to Shopee Monitor'}
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Zero personal information required. No email, no phone number.
          </p>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', margin: '1rem 0 0 0' }}>
          <button
            type="button"
            className={`tab-btn ${!isRegister ? 'active' : ''}`}
            style={{ flex: 1, textAlign: 'center', borderRadius: 0, padding: '0.75rem' }}
            onClick={() => { setIsRegister(false); setError(null); setErrorCode(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`tab-btn ${isRegister ? 'active' : ''}`}
            style={{ flex: 1, textAlign: 'center', borderRadius: 0, padding: '0.75rem' }}
            onClick={() => { setIsRegister(true); setError(null); setErrorCode(null); }}
          >
            New Account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1.25rem' }}>
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger-text)',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                <div>{error}</div>
                {errorCode === 'USER_NOT_FOUND' && !isRegister && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      marginTop: '0.6rem',
                      width: '100%',
                      fontSize: '0.8rem',
                      padding: '0.45rem 0.75rem',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                    onClick={() => {
                      setIsRegister(true);
                      setError(null);
                      setErrorCode(null);
                    }}
                  >
                    <UserPlus size={14} />
                    Create account as @{username.trim()}
                  </button>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  autoFocus
                  className="form-input"
                  style={{ width: '100%', paddingLeft: '2.25rem' }}
                  placeholder="e.g. casio_fan"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <User size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="password"
                  className="form-input"
                  style={{ width: '100%', paddingLeft: '2.25rem' }}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Lock size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
              </div>
              {isRegister && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Keep your password safe. Since we don't store your email, accounts cannot be recovered via email.
                </span>
              )}
            </div>

            {isRegister && (
              <div className="form-group">
                <label className="form-label">Telegram Chat ID (Optional)</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '2.25rem' }}
                    placeholder="e.g. 1883216058"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                  />
                  <Send size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Get from @userinfobot on Telegram. You can also configure this later.
                </span>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isRegister ? (
                <>
                  <UserPlus size={16} />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
