import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Trash2, Play, Pause } from 'lucide-react';
import { Item } from '../types';

interface ItemCardProps {
  item: Item;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onRefresh, showToast }) => {
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem('shopee_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const handleToggleActive = async () => {
    try {
      const res = await fetch(`/api/items/${item.id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Failed to update status');
      onRefresh();
      showToast(item.is_active ? 'Monitoring paused' : 'Monitoring resumed', 'success');
    } catch {
      showToast('Failed to toggle tracking status', 'error');
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/items/${item.id}/check`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Check failed');
      onRefresh();
      showToast('Checked latest stock status!', 'success');
    } catch {
      showToast('Failed to execute check', 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Stop tracking "${item.name}"?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Delete failed');
      onRefresh();
      showToast('Item deleted', 'success');
    } catch {
      showToast('Failed to delete item', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const trackedVariants = item.variants.filter((v) => v.is_tracked === 1);
  const displayVariants = trackedVariants.length > 0 ? trackedVariants : item.variants;

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="item-card">
      <div className="item-card-header">
        {item.image ? (
          <img src={item.image} alt={item.name} className="item-thumb" />
        ) : (
          <div className="item-thumb-placeholder">Shopee</div>
        )}
        <div className="item-title-col">
          <h4 className="item-title" title={item.name}>
            {item.name}
          </h4>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="item-link"
          >
            Open in Shopee <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="item-variants-list">
        {displayVariants.map((v) => {
          const isOut = v.stock === 0;
          return (
            <div key={v.id} className="variant-row">
              <span className="variant-name" title={v.name}>
                {v.name}
              </span>
              <div className="variant-meta">
                <span className={`badge ${isOut ? 'badge-out-stock' : 'badge-in-stock'}`}>
                  {isOut ? 'Out of Stock' : 'In Stock'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="item-card-footer">
        <span>Checked: {timeAgo(item.last_checked_at)}</span>

        <div className="card-actions">
          <button
            className="btn-icon"
            onClick={handleToggleActive}
            title={item.is_active ? 'Pause Tracking' : 'Resume Tracking'}
          >
            {item.is_active ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            className="btn-icon"
            onClick={handleCheckNow}
            disabled={checking}
            title="Check Now"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          </button>

          <button
            className="btn-icon"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete Item"
            style={{ color: 'var(--danger-text)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
