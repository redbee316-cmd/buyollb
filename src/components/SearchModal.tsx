import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Store, Tag, X } from 'lucide-react';
import type { Product } from '../types/buyoll';
import { CATS, K } from '../utils/format';
import { ProductThumb } from './SharedViews';

interface SearchModalProps {
  open: boolean;
  initialQuery: string;
  products: Product[];
  hiddenIds: number[];
  suspendedMerchants: string[];
  featuredIds: number[];
  promotedIds: number[];
  onClose: () => void;
  onSelectProduct: (pid: number) => void;
  onSelectMerchant: (merchant: string) => void;
  onSelectCategory: (category: string) => void;
  onApplyQuery: (q: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  open,
  initialQuery,
  products,
  hiddenIds,
  suspendedMerchants,
  featuredIds,
  promotedIds,
  onClose,
  onSelectProduct,
  onSelectMerchant,
  onSelectCategory,
  onApplyQuery,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
  }, [open, initialQuery]);

  const visibleProducts = useMemo(
    () => products.filter((p) => !hiddenIds.includes(p.id) && !suspendedMerchants.includes(p.m)),
    [products, hiddenIds, suspendedMerchants]
  );

  const trimmed = query.trim().toLowerCase();

  const matchingMerchants = useMemo(() => {
    const map = new Map<string, { name: string; count: number; loc: string }>();
    for (const p of visibleProducts) {
      if (!map.has(p.m)) {
        map.set(p.m, { name: p.m, count: 0, loc: p.loc });
      }
      map.get(p.m)!.count += 1;
    }
    const list = [...map.values()];
    if (!trimmed) return list.slice(0, 4);
    return list.filter(
      (m) => m.name.toLowerCase().includes(trimmed) || m.loc.toLowerCase().includes(trimmed)
    );
  }, [visibleProducts, trimmed]);

  const matchingCategories = useMemo(() => {
    const cats = CATS.filter((c) => c !== 'All');
    if (!trimmed) return cats.slice(0, 5);
    return cats.filter((c) => c.toLowerCase().includes(trimmed));
  }, [trimmed]);

  const matchingProducts = useMemo(() => {
    const list = visibleProducts.filter((p) => {
      if (!trimmed) return true;
      const haystack = `${p.n} ${p.m} ${p.cat} ${p.loc} ${p.desc} ${p.till}`.toLowerCase();
      return haystack.includes(trimmed);
    });
    return list.sort((a, b) => {
      const scoreA = (featuredIds.includes(a.id) || a.featured ? 2 : 0) + (promotedIds.includes(a.id) || a.promoted ? 1 : 0);
      const scoreB = (featuredIds.includes(b.id) || b.featured ? 2 : 0) + (promotedIds.includes(b.id) || b.promoted ? 1 : 0);
      return scoreB - scoreA;
    });
  }, [visibleProducts, trimmed, featuredIds, promotedIds]);

  if (!open) return null;

  return (
    <div
      className="mod"
      style={{ zIndex: 45, alignItems: 'start', paddingTop: '56px' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{ maxWidth: '640px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row sp" style={{ marginBottom: '10px' }}>
          <b style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={18} color="#ff4747" /> Search Buyoll
          </b>
          <button
            type="button"
            className="btn o sm"
            aria-label="Close search modal"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="row" style={{ gap: '8px', marginBottom: '10px' }}>
          <input
            ref={inputRef}
            style={{ margin: 0, flex: 1 }}
            placeholder="Search product name, merchant name, category, location, or Till..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onApplyQuery(query);
                onClose();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="btn o sm"
              onClick={() => setQuery('')}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="btn y sm"
            onClick={() => {
              onApplyQuery(query);
              onClose();
            }}
          >
            Search
          </button>
        </div>

        {matchingCategories.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div className="mu" style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Tag size={12} /> Categories
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
              {matchingCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="btn o sm"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => {
                    onSelectCategory(c);
                    onClose();
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {matchingMerchants.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div className="mu" style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Store size={12} /> Merchants ({matchingMerchants.length})
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
              {matchingMerchants.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  className="btn o sm"
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                  onClick={() => {
                    onSelectMerchant(m.name);
                    onClose();
                  }}
                >
                  🏪 {m.name} ({m.count})
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="row sp" style={{ marginBottom: '6px' }}>
            <span className="mu">
              Products ({matchingProducts.length} match{matchingProducts.length === 1 ? '' : 'es'})
            </span>
            {trimmed && (
              <button
                type="button"
                className="btn o sm"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => {
                  onApplyQuery(query);
                  onClose();
                }}
              >
                Show all in Shop →
              </button>
            )}
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {matchingProducts.length ? (
              matchingProducts.map((p) => {
                const isFeat = featuredIds.includes(p.id) || Boolean(p.featured);
                const isPromo = promotedIds.includes(p.id) || Boolean(p.promoted);
                const openCount = p.g.filter((g) => g.j < g.c).length;
                return (
                  <div
                    key={p.id}
                    className="grp"
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={() => {
                      onSelectProduct(p.id);
                      onClose();
                    }}
                  >
                    <ProductThumb p={p} h={56} w="56px" />
                    <div style={{ flex: 1 }}>
                      <div className="row" style={{ flexWrap: 'wrap', gap: '4px' }}>
                        <b>{p.n}</b>
                        {isFeat && (
                          <span className="bd p" style={{ fontSize: '10px' }}>
                            ⭐ Featured
                          </span>
                        )}
                        {isPromo && (
                          <span className="bd r" style={{ fontSize: '10px' }}>
                            🔥 Promoted
                          </span>
                        )}
                      </div>
                      <div className="mu">
                        <b style={{ color: '#fd384f' }}>{K(p.p)}</b> · from{' '}
                        {K(Math.ceil(p.p / 100))}/day · {openCount} open groups
                      </div>
                      <div className="mu">
                        🏪 {p.m} · {p.cat} · 📍 {p.loc.split(',')[0]}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="mu" style={{ padding: '12px 0', textAlign: 'center' }}>
                No products or merchants match "{query}". Try another term.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
