import React from 'react';
import { ShoppingBag, Plus, Settings as SettingsIcon, Bell, User as UserIcon, LogOut } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAlertsModal: () => void;
  unreadAlertCount: number;
  telegramConfigured?: boolean;
  user?: User | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenAlertsModal,
  unreadAlertCount,
  telegramConfigured,
  user,
  onLogout
}) => {
  return (
    <header className="header">
      <div className="container header-content">
        <div className="brand">
          <div className="brand-icon">
            <ShoppingBag size={20} />
          </div>
          <div className="brand-title">
            Shopee Monitor
            <span className="region-pill">ID</span>
          </div>
        </div>

        <div className="header-actions">
          {user && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}
              title={`Logged in as ${user.username}`}
            >
              <UserIcon size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>@{user.username}</span>
            </div>
          )}

          <button className="btn btn-icon" onClick={onOpenAlertsModal} title="Notification History">
            <Bell size={18} />
            {unreadAlertCount > 0 && <span className="badge badge-in-stock">{unreadAlertCount}</span>}
          </button>

          <button className="btn btn-secondary" onClick={onOpenSettingsModal} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <SettingsIcon size={16} />
            Telegram
            {telegramConfigured && (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'var(--success-text)',
                  display: 'inline-block'
                }}
                title="Telegram alerts active"
              />
            )}
          </button>

          <button className="btn btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            Track Item
          </button>

          {user && onLogout && (
            <button className="btn btn-secondary btn-icon" onClick={onLogout} title="Log Out">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
