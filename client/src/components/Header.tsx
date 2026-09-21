import React from 'react';
import { ShoppingBag, Plus, Send, Bell, User as UserIcon, LogOut } from 'lucide-react';
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
            <ShoppingBag size={17} />
          </div>
          <div className="brand-title">
            Shopee Monitor
            <span className="region-pill">ID</span>
          </div>
        </div>

        <div className="header-actions">
          {user && (
            <div className="user-tag" title={`Logged in as @${user.username}`}>
              <UserIcon size={13} style={{ color: 'var(--text-muted)' }} />
              <span>@{user.username}</span>
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={onOpenSettingsModal}
            title={telegramConfigured ? 'Telegram alerts connected' : 'Configure Telegram alerts'}
          >
            <Send size={13} style={{ color: telegramConfigured ? 'var(--status-in-stock)' : 'var(--text-muted)' }} />
            <span>Telegram</span>
            <span
              className={`status-dot ${telegramConfigured ? 'status-dot-in-stock' : ''}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: telegramConfigured ? 'var(--status-in-stock)' : 'var(--text-muted)'
              }}
            />
          </button>

          <button className="btn-icon" onClick={onOpenAlertsModal} title="Notification History" style={{ position: 'relative' }}>
            <Bell size={15} />
            {unreadAlertCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)'
                }}
              />
            )}
          </button>

          <button className="btn btn-primary" onClick={onOpenAddModal}>
            <Plus size={15} />
            <span>Track Product</span>
          </button>

          {user && onLogout && (
            <button className="btn-icon" onClick={onLogout} title="Sign Out">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
