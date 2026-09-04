import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Save, CheckCircle2, AlertCircle, Loader2, ChevronDown, ExternalLink, Copy } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, showToast }) => {
  const [allowDevSettings, setAllowDevSettings] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [checkCron, setCheckCron] = useState('0 * * * *');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [linking, setLinking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showManualChatId, setShowManualChatId] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>('');
  const [telegramUrls, setTelegramUrls] = useState<{
    url: string;
    webAutoUrl?: string;
    webKUrl?: string;
    webAUrl?: string;
  } | null>(null);

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    } else {
      stopPolling();
      setLinking(false);
    }
    return () => stopPolling();
  }, [isOpen]);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem('shopee_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const handleCopyCode = async (text: string) => {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {}
    }
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {}
    }
    if (copied) {
      showToast('Pairing code copied to clipboard!', 'success');
    } else {
      showToast('Failed to copy. Please copy manually: ' + text, 'error');
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: {
          ...getAuthHeader()
        }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAllowDevSettings(!!json.data.allow_dev_settings);
        setBotConfigured(!!json.data.bot_configured);
        setBotToken(json.data.telegram_bot_token || '');
        setChatId(json.data.telegram_chat_id || '');
        setCheckCron(json.data.check_cron || '0 * * * *');
      }
    } catch {
      showToast('Failed to load settings', 'error');
    }
  };

  const handleConnectTelegram = async () => {
    setLinking(true);
    try {
      const res = await fetch('/api/telegram/connect-link', {
        headers: getAuthHeader()
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to generate Telegram link');
      }

      setPairCode(json.code || null);
      setBotUsername(json.botUsername || '');
      setTelegramUrls({
        url: json.url,
        webAutoUrl: json.webAutoUrl,
        webKUrl: json.webKUrl,
        webAUrl: json.webAUrl
      });

      stopPolling();
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch('/api/telegram/status', {
            headers: getAuthHeader()
          });
          const statusJson = await statusRes.json();
          if (statusJson.success && statusJson.connected) {
            setChatId(statusJson.chatId || '');
            setLinking(false);
            stopPolling();
            showToast('Telegram successfully connected!', 'success');
          }
        } catch {}
      }, 2000);

      setTimeout(() => {
        if (linking) {
          setLinking(false);
          stopPolling();
        }
      }, 120000);
    } catch (err: any) {
      setLinking(false);
      showToast(err.message || 'Could not initiate Telegram linking', 'error');
    }
  };

  const handleDisconnectTelegram = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/telegram/disconnect', {
        method: 'POST',
        headers: getAuthHeader()
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to disconnect');
      setChatId('');
      showToast('Telegram disconnected.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect Telegram', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTest = async () => {
    if (!chatId.trim()) {
      showToast('Connect Telegram or enter a Chat ID to test.', 'error');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const payload: Record<string, string> = { chat_id: chatId.trim() };
      if (allowDevSettings && botToken.trim()) {
        payload.bot_token = botToken.trim();
      }

      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
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
      const payload: Record<string, string> = {
        telegram_chat_id: chatId.trim()
      };

      if (allowDevSettings) {
        payload.telegram_bot_token = botToken.trim();
        payload.check_cron = checkCron.trim();
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
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
          <h3 className="modal-title">{allowDevSettings ? 'Settings & Telegram' : 'Telegram Notifications'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {allowDevSettings && (
              <div className="guide-step">
                <span className="guide-num">Developer Setup</span>
                <div>1. Search <span className="code-pill">@BotFather</span> on Telegram → send <span className="code-pill">/newbot</span> → copy API Token.</div>
                <div>2. Set token below. Users can then connect in 1 click without needing @userinfobot.</div>
              </div>
            )}

            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Telegram Connection</label>

              {chatId ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CheckCircle2 size={20} style={{ color: 'var(--success-text)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--success-text)' }}>
                        Telegram Connected
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Receiving alerts on Chat ID: {chatId}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                    onClick={handleDisconnectTelegram}
                    disabled={disconnecting}
                  >
                    {disconnecting ? <Loader2 size={14} className="animate-spin" /> : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Telegram Connection</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Get a 6-digit pairing code to link your Telegram account for instant restock alerts.
                    </div>
                  </div>

                  {!pairCode && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
                      onClick={handleConnectTelegram}
                      disabled={linking || (!botConfigured && !allowDevSettings)}
                    >
                      {linking ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Generating Pairing Code...
                        </>
                      ) : !botConfigured && !allowDevSettings ? (
                        'Bot Not Configured by Admin'
                      ) : (
                        <>
                          <Send size={16} />
                          Get Telegram Pairing Code
                        </>
                      )}
                    </button>
                  )}

                  {pairCode && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'var(--bg-primary)',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-subtle)',
                      gap: '0.65rem'
                    }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Send this 6-digit code to <b>@{botUsername}</b>:
                      </div>
                      <div style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        letterSpacing: '0.4rem',
                        color: 'var(--accent-primary)',
                        fontFamily: 'monospace',
                        userSelect: 'all'
                      }}>
                        {pairCode}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', width: '100%', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ flex: 1, minWidth: '110px', fontSize: '0.78rem', padding: '0.4rem 0.6rem', justifyContent: 'center' }}
                          onClick={() => handleCopyCode(pairCode)}
                        >
                          <Copy size={14} />
                          Copy Code
                        </button>
                        {telegramUrls?.webKUrl && (
                          <a
                            href={telegramUrls.webKUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ flex: 1, minWidth: '85px', fontSize: '0.75rem', padding: '0.4rem 0.5rem', justifyContent: 'center' }}
                          >
                            <ExternalLink size={13} />
                            Web (K)
                          </a>
                        )}
                        {telegramUrls?.webAUrl && (
                          <a
                            href={telegramUrls.webAUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ flex: 1, minWidth: '85px', fontSize: '0.75rem', padding: '0.4rem 0.5rem', justifyContent: 'center' }}
                          >
                            <ExternalLink size={13} />
                            Web (A)
                          </a>
                        )}
                        {telegramUrls?.url && (
                          <a
                            href={telegramUrls.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ flex: 1, minWidth: '85px', fontSize: '0.75rem', padding: '0.4rem 0.5rem', justifyContent: 'center' }}
                          >
                            <ExternalLink size={13} />
                            Desktop
                          </a>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.75rem',
                        color: 'var(--accent-primary)'
                      }}>
                        <Loader2 size={13} className="animate-spin" />
                        Listening for your code in Telegram...
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Already have Telegram open in another tab? Simply copy the code and send it to <b>@{botUsername}</b>.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  onClick={() => setShowManualChatId(!showManualChatId)}
                >
                  <ChevronDown
                    size={14}
                    style={{
                      transform: showManualChatId ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s'
                    }}
                  />
                  {showManualChatId ? 'Hide manual Chat ID' : 'Or enter Chat ID manually (for Groups / Channels)'}
                </button>

                {showManualChatId && (
                  <div className="form-group" style={{ marginTop: '0.65rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 1883216058 or -100123456789"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Group chats and channel IDs start with a minus sign (e.g. -100...)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {chatId && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Test Message
                </button>
                {testResult && (
                  <span style={{
                    fontSize: '0.8rem',
                    color: testResult.success ? 'var(--success-text)' : 'var(--danger-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {testResult.message}
                  </span>
                )}
              </div>
            )}

            {allowDevSettings && (
              <>
                <hr style={{ borderColor: 'var(--border-subtle)', margin: 0 }} />

                <div className="form-group">
                  <label className="form-label">Telegram Bot Token (Developer / Admin)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                </div>

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
                    Runs automated stock checks. Default: <span className="code-pill">0 * * * *</span> (every hour)
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            {(allowDevSettings || showManualChatId) && (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Settings
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
