import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { SettingsModal } from './components/SettingsModal';
import { AlertHistory } from './components/AlertHistory';
import { Item } from './types';
import { Layers, PackageX, PackageCheck, Send, Plus, Search } from 'lucide-react';

export const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'out_of_stock' | 'in_stock'>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/items');
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
      }
    } catch {
      showToast('Failed to fetch tracked items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkTelegramStatus = async () => {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        setTelegramConfigured(!!(json.data.telegram_bot_token && json.data.telegram_chat_id));
      }
    } catch {}
  };

  useEffect(() => {
    fetchItems();
    checkTelegramStatus();
    const interval = setInterval(fetchItems, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalTrackedVariants = items.reduce(
    (acc, item) => acc + item.variants.filter((v) => v.is_tracked === 1).length,
    0
  );

  const totalOutOfStock = items.reduce(
    (acc, item) => acc + item.variants.filter((v) => v.is_tracked === 1 && v.stock === 0).length,
    0
  );

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'out_of_stock') {
      return item.variants.some((v) => v.is_tracked === 1 && v.stock === 0);
    }
    if (filterTab === 'in_stock') {
      return item.variants.some((v) => v.is_tracked === 1 && v.stock > 0);
    }
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        onOpenAddModal={() => setIsAddOpen(true)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onOpenAlertsModal={() => setIsAlertsOpen(true)}
        unreadAlertCount={0}
      />

      <main className="container" style={{ flex: 1, paddingBottom: '3rem' }}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Tracked Products</span>
              <span className="stat-value">{items.length}</span>
            </div>
            <div className="stat-icon-wrapper">
              <Layers size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Active Variants</span>
              <span className="stat-value">{totalTrackedVariants}</span>
            </div>
            <div className="stat-icon-wrapper" style={{ color: 'var(--accent-primary)' }}>
              <PackageCheck size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-label">Waiting for Restock</span>
              <span className="stat-value" style={{ color: 'var(--danger-text)' }}>
                {totalOutOfStock}
              </span>
            </div>
            <div className="stat-icon-wrapper" style={{ color: 'var(--danger-text)' }}>
              <PackageX size={22} />
            </div>
          </div>

          <div
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setIsSettingsOpen(true)}
          >
            <div className="stat-info">
              <span className="stat-label">Telegram Status</span>
              <span
                className="stat-value"
                style={{
                  fontSize: '1.25rem',
                  color: telegramConfigured ? 'var(--success-text)' : 'var(--warning-text)'
                }}
              >
                {telegramConfigured ? 'Active' : 'Setup Required'}
              </span>
            </div>
            <div
              className="stat-icon-wrapper"
              style={{ color: telegramConfigured ? 'var(--success-text)' : 'var(--warning-text)' }}
            >
              <Send size={22} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="tabs-nav" style={{ margin: 0 }}>
            <button
              className={`tab-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All Items ({items.length})
            </button>
            <button
              className={`tab-btn ${filterTab === 'out_of_stock' ? 'active' : ''}`}
              onClick={() => setFilterTab('out_of_stock')}
            >
              Out of Stock ({items.filter(i => i.variants.some(v => v.is_tracked === 1 && v.stock === 0)).length})
            </button>
            <button
              className={`tab-btn ${filterTab === 'in_stock' ? 'active' : ''}`}
              onClick={() => setFilterTab('in_stock')}
            >
              In Stock ({items.filter(i => i.variants.some(v => v.is_tracked === 1 && v.stock > 0)).length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '300px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', paddingLeft: '2rem' }}
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            Loading monitored items...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <PackageX size={28} />
            </div>
            <h3 className="empty-title">No items found</h3>
            <p className="empty-desc">
              {searchQuery
                ? 'No items match your search query.'
                : 'Start tracking out-of-stock items and specific variants on Shopee Indonesia.'}
            </p>
            <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
              <Plus size={16} />
              Track First Item
            </button>
          </div>
        ) : (
          <div className="items-grid">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onRefresh={fetchItems}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </main>

      <AddItemModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onItemAdded={fetchItems}
        showToast={showToast}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          checkTelegramStatus();
        }}
        showToast={showToast}
      />

      <AlertHistory
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        showToast={showToast}
      />

      {toast && (
        <div
          className="toast"
          style={{
            borderColor: toast.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
