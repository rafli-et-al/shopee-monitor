import React from 'react';
import { ShoppingBag, Plus, Settings as SettingsIcon, Bell } from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAlertsModal: () => void;
  unreadAlertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenAlertsModal,
  unreadAlertCount
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
          <button className="btn btn-icon" onClick={onOpenAlertsModal} title="Notification History">
            <Bell size={18} />
            {unreadAlertCount > 0 && <span className="badge badge-in-stock">{unreadAlertCount}</span>}
          </button>

          <button className="btn btn-secondary" onClick={onOpenSettingsModal}>
            <SettingsIcon size={16} />
            Telegram & Settings
          </button>

          <button className="btn btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            Track Item
          </button>
        </div>
      </div>
    </header>
  );
};
