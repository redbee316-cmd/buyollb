import React, { useEffect, useState } from 'react';
import { Bell, BellRing, Trash2, X } from 'lucide-react';
import type { Product } from '../types/buyoll';
import { K } from '../utils/format';
import type { PriceAlert } from '../utils/priceAlerts';

interface PriceAlertModalProps {
  product: Product | null;
  existingAlert: PriceAlert | null;
  onClose: () => void;
  onSave: (product: Product, targetPrice: number) => void;
  onRemove: (productId: number) => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  product,
  existingAlert,
  onClose,
  onSave,
  onRemove,
}) => {
  const [targetInput, setTargetInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const suggested = existingAlert
      ? existingAlert.targetPrice
      : Math.max(100, Math.round((product.p * 0.9) / 50) * 50);
    setTargetInput(String(Math.min(suggested, Math.max(1, product.p - 1))));
    setError(null);
  }, [product, existingAlert]);

  if (!product) return null;

  const quickPresets = [5, 10, 15, 25].map((pct) => ({
    pct,
    price: Math.max(1, Math.round((product.p * (1 - pct / 100)) / 10) * 10),
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Math.round(Number(targetInput));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter a valid target price in KSh above 0.');
      return;
    }
    if (numeric >= product.p) {
      setError(`Target price must be lower than the current price (${K(product.p)}).`);
      return;
    }
    onSave(product, numeric);
    onClose();
  };

  return (
    <div
      className="mod"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-alert-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div>
        <div className="row sp" style={{ marginBottom: '8px' }}>
          <div className="row" style={{ gap: '8px' }}>
            {existingAlert ? (
              <BellRing size={18} color="#e62e04" />
            ) : (
              <Bell size={18} color="#e62e04" />
            )}
            <h3 id="price-alert-modal-title">
              {existingAlert ? 'Update Price Alert' : 'Set Price Alert'}
            </h3>
          </div>
          <button
            type="button"
            className="btn o sm"
            onClick={onClose}
            aria-label="Close price alert dialog"
          >
            <X size={15} />
          </button>
        </div>

        <div
          className="card"
          style={{
            margin: '8px 0 12px',
            background: '#fafafa',
            borderColor: '#e5e5e5',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
            {product.n}
          </div>
          <div className="mu" style={{ fontVariantNumeric: 'tabular-nums' }}>
            Current price: <b style={{ color: '#191919' }}>{K(product.p)}</b>
            {existingAlert && (
              <>
                {' '}
                · Saved target: <b style={{ color: '#e62e04' }}>{K(existingAlert.targetPrice)}</b>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="price-alert-target-input"
            className="mu"
            style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}
          >
            Notify me when price drops to or below (KSh)
          </label>
          <input
            id="price-alert-target-input"
            type="number"
            min={1}
            max={Math.max(1, product.p - 1)}
            step={1}
            placeholder={`e.g. ${Math.max(1, Math.round(product.p * 0.9))}`}
            value={targetInput}
            onChange={(e) => {
              setTargetInput(e.target.value);
              if (error) setError(null);
            }}
            style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
            autoFocus
          />

          <div
            className="row"
            style={{ flexWrap: 'wrap', gap: '6px', margin: '6px 0 10px' }}
          >
            {quickPresets.map((preset) => {
              const selected = Number(targetInput) === preset.price;
              return (
                <button
                  key={preset.pct}
                  type="button"
                  onClick={() => {
                    setTargetInput(String(preset.price));
                    setError(null);
                  }}
                  className={`btn sm ${selected ? 'y' : 'o'}`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 10px',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  -{preset.pct}% ({K(preset.price)})
                </button>
              );
            })}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '8px 10px',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '10px',
              }}
            >
              {error}
            </div>
          )}

          <p className="mu" style={{ marginBottom: '12px', lineHeight: 1.5 }}>
            Stored locally on this device. You will be notified immediately in the app if this
            item&apos;s price drops to or below your target.
          </p>

          <div className="row" style={{ gap: '8px' }}>
            {existingAlert && (
              <button
                type="button"
                className="btn o"
                onClick={() => {
                  onRemove(product.id);
                  onClose();
                }}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Trash2 size={15} />
                <span>Remove</span>
              </button>
            )}
            <button type="submit" className="btn bl" style={{ flex: 1 }}>
              <Bell size={15} />
              <span>{existingAlert ? 'Update Alert' : 'Save Price Alert'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
