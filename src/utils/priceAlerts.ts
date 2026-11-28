import type { Product } from '../types/buyoll';

export interface PriceAlert {
  productId: number;
  productName: string;
  targetPrice: number;
  priceWhenSet: number;
  createdAt: string;
  triggeredAt?: string;
  triggeredPrice?: number;
  dismissed?: boolean;
}

const STORAGE_KEY = 'buyoll_price_alerts_v1';

export function loadPriceAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PriceAlert =>
        Boolean(item) &&
        typeof item.productId === 'number' &&
        typeof item.targetPrice === 'number' &&
        item.targetPrice > 0
    );
  } catch {
    return [];
  }
}

export function savePriceAlerts(alerts: PriceAlert[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // ignore storage quota/privacy mode failures
  }
}

export function upsertPriceAlert(product: Product, targetPrice: number): PriceAlert[] {
  const cleanTarget = Math.round(targetPrice);
  const existing = loadPriceAlerts();
  const nextEntry: PriceAlert = {
    productId: product.id,
    productName: product.n,
    targetPrice: cleanTarget,
    priceWhenSet: product.p,
    createdAt: new Date().toISOString(),
    ...(product.p <= cleanTarget
      ? {
          triggeredAt: new Date().toISOString(),
          triggeredPrice: product.p,
          dismissed: false,
        }
      : { dismissed: false }),
  };

  const idx = existing.findIndex((a) => a.productId === product.id);
  const updated =
    idx >= 0
      ? existing.map((a, i) => (i === idx ? nextEntry : a))
      : [nextEntry, ...existing];

  savePriceAlerts(updated);
  return updated;
}

export function removePriceAlert(productId: number): PriceAlert[] {
  const updated = loadPriceAlerts().filter((a) => a.productId !== productId);
  savePriceAlerts(updated);
  return updated;
}

export function dismissTriggeredAlert(productId: number): PriceAlert[] {
  const updated = loadPriceAlerts().map((a) =>
    a.productId === productId ? { ...a, dismissed: true } : a
  );
  savePriceAlerts(updated);
  return updated;
}

export function evaluatePriceAlerts(
  products: Product[],
  currentAlerts?: PriceAlert[]
): { alerts: PriceAlert[]; newlyTriggered: PriceAlert[] } {
  const alerts = currentAlerts ? [...currentAlerts] : loadPriceAlerts();
  if (!alerts.length || !products.length) {
    return { alerts, newlyTriggered: [] };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const newlyTriggered: PriceAlert[] = [];
  let changed = false;

  const updated = alerts.map((alert) => {
    const product = productMap.get(alert.productId);
    if (!product) return alert;

    if (product.p <= alert.targetPrice) {
      const alreadyNotifiedAtThisOrLower =
        Boolean(alert.triggeredAt) &&
        typeof alert.triggeredPrice === 'number' &&
        alert.triggeredPrice <= product.p;

      if (!alreadyNotifiedAtThisOrLower) {
        changed = true;
        const nextAlert: PriceAlert = {
          ...alert,
          productName: product.n,
          triggeredAt: new Date().toISOString(),
          triggeredPrice: product.p,
          dismissed: false,
        };
        newlyTriggered.push(nextAlert);
        return nextAlert;
      }
    }
    return alert;
  });

  if (changed) {
    savePriceAlerts(updated);
  }

  return { alerts: updated, newlyTriggered };
}
