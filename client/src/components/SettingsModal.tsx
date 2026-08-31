import React, { useState, useEffect } from 'react';
import { X, Send, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  showToast
}) => {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [stockCron, setStockCron] = useState('0 */6 * * *');
  const [priceCron, setPriceCron] = useState('0 * * * *');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        const data: AppSettings = json.data;
        setBotToken(data.telegram_bot_token || '');
        setChatId(data.telegram_chat_id || '');
        setStockCron(data.stock_cron || '0 */6 * * *');
        setPriceCron(data.price_cron || '0 * * * *');
      }
    } catch {
      showToast('Failed to load settings', 'error');
    }
  };

  const handleTestTelegram = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Please enter both Bot Token and Chat ID to test.', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: botToken.trim(),
          chat_id: chatId.trim()
        })
      });
      const json = await res.json();
      setTestResult(json);
      if (json.success) {
        showToast('Telegram message sent! Check your app.', 'success');
      } else {
        showToast(json.message || 'Telegram test failed', 'error');
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Network error' });
      showToast('Failed to test Telegram', 'error');
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
          stock_cron: stockCron.trim(),
          price_cron: priceCron.trim()
        })
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Failed to update settings');

      showToast('Settings saved successfully!', 'success');
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
          <h3 className="modal-title">Settings & Telegram Configuration</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="guide-step">
              <span className="guide-num">Quick Telegram Bot Setup (Free & 2 mins)</span>
              <div>
                1. Open Telegram & search <span className="code-pill">@BotFather</span>. Send <span className="code-pill">/newbot</span> and copy the API Token.
              </div>
              <div>
                2. Search <span className="code-pill">@userinfobot</span> to get your numeric User ID.
              </div>
              <div>
                3. Open your new bot and click <b>Start</b>.
              </div>
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
              <label className="form-label">Telegram Chat ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="987654321"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestTelegram}
                disabled={testing}
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Test Message
              </button>

              {testResult && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: testResult.success ? 'var(--success-text)' : 'var(--danger-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {testResult.message}
                </span>
              )}
            </div>

            <hr style={{ borderColor: 'var(--border-subtle)' }} />

            <div className="form-group">
              <label className="form-label">Variant Stock Check Cron Expression</label>
              <input
                type="text"
                className="form-input"
                placeholder="0 */6 * * *"
                value={stockCron}
                onChange={(e) => setStockCron(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Default: <span className="code-pill">0 */6 * * *</span> (Every 6 hours)
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Price Check Cron Expression</label>
              <input
                type="text"
                className="form-input"
                placeholder="0 * * * *"
                value={priceCron}
                onChange={(e) => setPriceCron(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Default: <span className="code-pill">0 * * * *</span> (Every 1 hour)
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
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
