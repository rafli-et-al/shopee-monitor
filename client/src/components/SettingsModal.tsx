import React, { useState, useEffect } from 'react';
import { X, Send, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, showToast }) => {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [checkCron, setCheckCron] = useState('0 * * * *');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        setBotToken(json.data.telegram_bot_token || '');
        setChatId(json.data.telegram_chat_id || '');
        setCheckCron(json.data.check_cron || '0 * * * *');
      }
    } catch {
      showToast('Failed to load settings', 'error');
    }
  };

  const handleTest = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Enter both Bot Token and Chat ID to test.', 'error');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: botToken.trim(), chat_id: chatId.trim() })
      });
      const json = await res.json();
      setTestResult(json);
      showToast(json.success ? 'Test message sent! Check Telegram.' : json.message, json.success ? 'success' : 'error');
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
      showToast('Telegram test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_bot_token: botToken.trim(),
          telegram_chat_id: chatId.trim(),
          check_cron: checkCron.trim()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      showToast('Settings saved!', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Settings & Telegram</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="guide-step">
              <span className="guide-num">Telegram Setup (2 minutes)</span>
              <div>1. Search <span className="code-pill">@BotFather</span> on Telegram → send <span className="code-pill">/newbot</span> → copy the API Token.</div>
              <div>2. Search <span className="code-pill">@userinfobot</span> → press Start → copy your numeric ID.</div>
              <div>3. Open your new bot and press <b>Start</b>.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Telegram Bot Token</label>
              <input
                type="password"
                className="form-input"
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Telegram Chat ID (your user ID)</label>
              <input
                type="text"
                className="form-input"
                placeholder="987654321"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Test Message
              </button>
              {testResult && (
                <span style={{ fontSize: '0.8rem', color: testResult.success ? 'var(--success-text)' : 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {testResult.message}
                </span>
              )}
            </div>

            <hr style={{ borderColor: 'var(--border-subtle)' }} />

            <div className="form-group">
              <label className="form-label">Check Interval (Cron Expression)</label>
              <input
                type="text"
                className="form-input"
                placeholder="0 * * * *"
                value={checkCron}
                onChange={(e) => setCheckCron(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Runs both stock &amp; price checks. Default: <span className="code-pill">0 * * * *</span> (every hour)
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
