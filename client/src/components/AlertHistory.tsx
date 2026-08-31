import React, { useEffect, useState } from 'react';
import { X, Bell, TrendingDown, PackageCheck } from 'lucide-react';
import { AlertLog } from '../types';

interface AlertHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const AlertHistory: React.FC<AlertHistoryProps> = ({
  isOpen,
  onClose,
  showToast
}) => {
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data);
      }
    } catch {
      showToast('Failed to load alert history', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Notification History</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Loading alert logs...
            </div>
          ) : alerts.length === 0 ? (
            <div className="empty-state" style={{ margin: 0, padding: '2.5rem 1rem' }}>
              <div className="empty-icon">
                <Bell size={24} />
              </div>
              <h4 className="empty-title">No notifications yet</h4>
              <p className="empty-desc">
                When items restock or prices drop, instant Telegram alerts and activity records will appear here.
              </p>
            </div>
          ) : (
            <div className="alert-feed">
              {alerts.map((a) => {
                const isRestock = a.alert_type === 'STOCK_RESTOCKED';
                return (
                  <div key={a.id} className="alert-card">
                    <div
                      className="alert-icon"
                      style={{
                        background: isRestock ? 'var(--success-bg)' : 'var(--warning-bg)',
                        color: isRestock ? 'var(--success-text)' : 'var(--warning-text)'
                      }}
                    >
                      {isRestock ? <PackageCheck size={18} /> : <TrendingDown size={18} />}
                    </div>

                    <div className="alert-content">
                      <div className="alert-header">
                        <span
                          className="alert-type"
                          style={{ color: isRestock ? 'var(--success-text)' : 'var(--warning-text)' }}
                        >
                          {isRestock ? 'Restocked' : 'Price Drop'}
                        </span>
                        <span className="alert-time">{new Date(a.sent_at).toLocaleString()}</span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.2rem' }}>
                        {a.item_name || 'Product'} {a.variant_name ? `• ${a.variant_name}` : ''}
                      </div>

                      <div className="alert-text">{a.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
