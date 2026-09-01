import React, { useState } from 'react';
import { X, Search, CheckCircle2, Loader2 } from 'lucide-react';
import { ScrapedPreview, ScrapedVariantPreview } from '../types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onItemAdded,
  showToast
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ScrapedPreview | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setPreview(null);
    setSelectedVariants({});

    try {
      const res = await fetch('/api/items/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to extract product.');
      }

      setPreview(json.data);

      const initialSelected: Record<string, boolean> = {};
      json.data.variants.forEach((v: ScrapedVariantPreview) => {
        initialSelected[v.model_id] = v.stock === 0 || json.data.variants.length === 1;
      });
      setSelectedVariants(initialSelected);
    } catch (err: any) {
      showToast(err.message || 'Failed to preview product.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleVariant = (modelId: string) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [modelId]: !prev[modelId]
    }));
  };

  const selectAllOutOfStock = () => {
    if (!preview) return;
    const updated: Record<string, boolean> = {};
    preview.variants.forEach((v) => {
      updated[v.model_id] = v.stock === 0;
    });
    setSelectedVariants(updated);
  };

  const handleSave = async () => {
    if (!preview) return;

    const variantsToSave = preview.variants.map((v) => ({
      model_id: v.model_id,
      name: v.name,
      stock: v.stock,
      is_tracked: selectedVariants[v.model_id] ? 1 : 0
    }));

    const trackedCount = variantsToSave.filter((v) => v.is_tracked === 1).length;
    if (trackedCount === 0) {
      showToast('Please select at least one variant to track.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: preview.shop_id,
          item_id: preview.item_id,
          name: preview.name,
          image: preview.image,
          url: preview.url,
          variants: variantsToSave
        })
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to save item.');
      }

      showToast('Product and variants added to monitor!', 'success');
      onItemAdded();
      handleClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setPreview(null);
    setSelectedVariants({});
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Track Shopee Indonesia Item</h3>
          <button className="btn-icon" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handlePreview} className="form-group">
            <label className="form-label">Shopee Indonesia Product Link</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="https://shopee.co.id/product/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !url.trim()}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Fetch
              </button>
            </div>
          </form>

          {preview && (
            <div className="preview-box">
              <div className="preview-header">
                {preview.image ? (
                  <img src={preview.image} alt={preview.name} className="item-thumb" />
                ) : (
                  <div className="item-thumb-placeholder">Shopee</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 className="item-title">{preview.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Shop: {preview.shop_id} | Item: {preview.item_id}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span className="form-label">Select Variants to Monitor</span>
                <button
                  type="button"
                  onClick={selectAllOutOfStock}
                  style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}
                >
                  Select Out of Stock
                </button>
              </div>

              <div className="variant-picker">
                {preview.variants.map((variant) => {
                  const isChecked = !!selectedVariants[variant.model_id];
                  const isOutOfStock = variant.stock === 0;

                  return (
                    <div
                      key={variant.model_id}
                      className="variant-select-row"
                      onClick={() => toggleVariant(variant.model_id)}
                    >
                      <div className="variant-select-left">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{variant.name}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`badge ${isOutOfStock ? 'badge-out-stock' : 'badge-in-stock'}`}>
                          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!preview || saving}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Start Tracking
          </button>
        </div>
      </div>
    </div>
  );
};
