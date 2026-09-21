import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { ItemCard } from './components/ItemCard';
import { AddItemModal } from './components/AddItemModal';
import { SettingsModal } from './components/SettingsModal';
import { AlertHistory } from './components/AlertHistory';
import { AuthModal } from './components/AuthModal';
import { Item, User } from './types';
import { Plus, Search, PackageOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'out_of_stock' | 'in_stock'>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [seenAlertId, setSeenAlertId] = useState(0);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  const getHeaders = (customToken?: string): Record<string, string> => {
    const token = customToken || localStorage.getItem('shopee_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchItems = useCallback(async (customToken?: string) => {
    try {
      const res = await fetch('/api/items', {
        headers: getHeaders(customToken)
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
      }
    } catch {
      showToast('Failed to fetch tracked items', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlertCount = useCallback(async (customToken?: string) => {
    try {
      const res = await fetch('/api/alerts', {
        headers: getHeaders(customToken)
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const latestId = json.data[0].id;
        if (latestId > seenAlertId) {
          setAlertCount(json.data.filter((a: any) => a.id > seenAlertId).length);
        }
      }
    } catch {}
  }, [seenAlertId]);

  const checkTelegramStatus = useCallback(async (customToken?: string) => {
    try {
      const res = await fetch('/api/settings', {
        headers: getHeaders(customToken)
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTelegramConfigured(!!(json.data.bot_configured && json.data.telegram_chat_id));
      }
    } catch {}
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('shopee_token');
    setUser(null);
    setItems([]);
    setIsAuthOpen(true);
    setLoading(false);
  };

  const handleAuthSuccess = (authenticatedUser: User, token: string) => {
    setUser(authenticatedUser);
    setIsAuthOpen(false);
    fetchItems(token);
    checkTelegramStatus(token);
    fetchAlertCount(token);
  };

  useEffect(() => {
    const token = localStorage.getItem('shopee_token');
    if (!token) {
      setIsAuthOpen(true);
      setLoading(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then((json) => {
        if (json.success && json.user) {
          setUser(json.user);
          fetchItems(token);
          checkTelegramStatus(token);
          fetchAlertCount(token);
        } else {
          handleLogout();
        }
      })
      .catch(() => {
        handleLogout();
      });
  }, [fetchItems, checkTelegramStatus, fetchAlertCount]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchItems();
      fetchAlertCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, fetchItems, fetchAlertCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalTrackedVariants = items.reduce(
    (acc, item) => acc + item.variants.filter((v) => v.is_tracked === 1).length,
    0
  );

  const totalOutOfStock = items.reduce(
    (acc, item) => acc + item.variants.filter((v) => v.is_tracked === 1 && v.stock === 0).length,
    0
  );

  const outOfStockItemsCount = items.filter((i) =>
    i.variants.some((v) => v.is_tracked === 1 && v.stock === 0)
  ).length;

  const inStockItemsCount = items.filter((i) =>
    i.variants.some((v) => v.is_tracked === 1 && v.stock > 0)
  ).length;

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
        onOpenAlertsModal={() => {
          setIsAlertsOpen(true);
          setAlertCount(0);
          setSeenAlertId((prev) => prev);
        }}
        unreadAlertCount={alertCount}
        telegramConfigured={telegramConfigured}
        user={user}
        onLogout={handleLogout}
      />

      <main className="container" style={{ flex: 1, paddingBottom: '3rem' }}>
        <div className="status-summary-strip">
          <div className="status-summary-meta">
            <span className="status-summary-item">
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{items.length}</span> products
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>•</span>
            <span className="status-summary-item">
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalTrackedVariants}</span> variants
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>•</span>
            <span className="status-summary-item">
              <span style={{ fontWeight: 600, color: totalOutOfStock > 0 ? 'var(--status-out-stock)' : 'var(--text-primary)' }}>
                {totalOutOfStock}
              </span> waiting restock
            </span>
          </div>
          <div className="status-summary-item" style={{ fontSize: '0.75rem' }}>
            <span
              className="status-dot status-dot-in-stock"
              style={{ width: 5, height: 5 }}
            />
            <span>Auto-monitoring active</span>
          </div>
        </div>

        <div className="toolbar">
          <div className="segmented-control">
            <button
              className={`segmented-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              <span>All Products</span>
              <span className="count-chip">{items.length}</span>
            </button>
            <button
              className={`segmented-btn ${filterTab === 'out_of_stock' ? 'active' : ''}`}
              onClick={() => setFilterTab('out_of_stock')}
            >
              <span className="status-dot status-dot-out-stock" />
              <span>Awaiting Restock</span>
              <span className="count-chip">{outOfStockItemsCount}</span>
            </button>
            <button
              className={`segmented-btn ${filterTab === 'in_stock' ? 'active' : ''}`}
              onClick={() => setFilterTab('in_stock')}
            >
              <span className="status-dot status-dot-in-stock" />
              <span>In Stock</span>
              <span className="count-chip">{inStockItemsCount}</span>
            </button>
          </div>

          <div className="search-box">
            <Search size={13} className="search-icon" />
            <input
              ref={searchRef}
              type="text"
              className="search-input"
              placeholder="Search tracked items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="shortcut-hint">/</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading monitored items...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <PackageOpen size={22} />
            </div>
            <h3 className="empty-title">
              {searchQuery ? 'No matching products' : 'No products tracked yet'}
            </h3>
            <p className="empty-desc">
              {searchQuery
                ? 'Try adjusting your search query.'
                : 'Add a Shopee Indonesia product link to monitor stock replenishments and get notified.'}
            </p>
            <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
              <Plus size={15} />
              <span>Track Product</span>
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

      <AuthModal
        isOpen={isAuthOpen}
        onSuccess={handleAuthSuccess}
        showToast={showToast}
      />

      {toast && (
        <div
          className="toast"
          style={{
            borderColor: toast.type === 'error' ? 'var(--status-out-stock-border)' : 'var(--status-in-stock-border)'
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
