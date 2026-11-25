import React, { useState } from 'react';
import { LN } from '../utils/defaults';
import type { AppState, DepositItem, RevenueCategory, RevenueEntry, Tab } from '../types/buyoll';
import { BM, K, dn } from '../utils/format';
import { PageTop, ProductThumb, ProfileView, WishlistView } from './SharedViews';
import type { AuthModalMode } from './LoginView';

interface AdminViewProps {
  state: AppState;
  merchants: string[];
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onApproveDeposit: (id: number) => void;
  onOpenDeclineDeposit: (id: number) => void;
  onTogglePlan: (merchant?: string) => void;
  onToggleSuspend: (merchant: string) => void;
  onToggleHideProduct: (pid: number) => void;
  onToggleFeatureProduct: (pid: number) => void;
  onTogglePromoteProduct: (pid: number) => void;
  onRemoveProduct: (pid: number) => void;
  onSaveSettings: (till: string, banner: string) => void;
  onToggleWishlist: (pid: number) => void;
  onRequireAuth: (mode: AuthModalMode, msg?: string) => void;
  onLogout: () => void;
  onReset: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  state,
  merchants,
  onGo,
  onApproveDeposit,
  onOpenDeclineDeposit,
  onTogglePlan,
  onToggleSuspend,
  onToggleHideProduct,
  onToggleFeatureProduct,
  onTogglePromoteProduct,
  onRemoveProduct,
  onSaveSettings,
  onToggleWishlist,
  onRequireAuth,
  onLogout,
  onReset,
}) => {
  const { tab: t } = state;
  const [tillVal, setTillVal] = useState(state.till);
  const [bannerVal, setBannerVal] = useState(state.banner);
  const [modFilter, setModFilter] = useState<'all' | 'featured' | 'promoted' | 'hidden'>('all');
  const [revPeriod, setRevPeriod] = useState<'day' | 'month' | 'year' | 'all'>('day');
  const wishlistCount = (state.wishlist || []).length;

  if (t === 'wishlist') {
    return (
      <WishlistView
        state={state}
        onGo={onGo}
        onToggleWishlist={onToggleWishlist}
        onViewProduct={(pid) => onGo('home', 'prod', pid)}
      />
    );
  }

  if (t === 'profile') {
    return (
      <ProfileView
        name={state.name}
        role="admin"
        wishlistCount={wishlistCount}
        onOpenWishlist={() => onGo('wishlist')}
        onOpenAdminSettings={() => onGo('set')}
        onRequireAuth={onRequireAuth}
        onLogout={onLogout}
        onReset={onReset}
      />
    );
  }

  const pd = state.deposits.filter((d) => d.st === 'pending');
  const gs = state.products.flatMap((p) => p.g.filter((g) => g.j > 0).map((g) => ({ p, g })));

  const renderDepositCard = (d: DepositItem) => (
    <div key={d.id} className="card">
      <div className="row sp">
        <b>{d.by}</b>
        <span className="bd p">{d.role || 'member'}</span>
      </div>
      <div className="mu">
        Amount: <b>{K(d.amt)}</b> · Code: <b>{d.code}</b>
        {d.phone && (
          <>
            <br />
            Phone: {d.phone}
          </>
        )}
      </div>
      <div className="row" style={{ marginTop: '8px' }}>
        <button
          className="btn sm"
          style={{ background: 'var(--gr)', color: '#041' }}
          onClick={() => onApproveDeposit(d.id)}
        >
          Authenticate &amp; Approve
        </button>
        <button
          className="btn sm"
          style={{ background: 'var(--rd)' }}
          onClick={() => onOpenDeclineDeposit(d.id)}
        >
          Decline
        </button>
      </div>
    </div>
  );

  if (t === 'users') {
    const mem = new Set<string>([state.name, ...(state.registeredMembers || [])]);
    state.products.forEach((p) => p.g.forEach((g) => g.r.forEach((x) => mem.add(x.n))));
    const allLenders = state.lenders || LN;
    const allMerchants = [...new Set([...merchants, ...(state.registeredMerchants || [])])];

    return (
      <>
        <PageTop title="Users" />
        <div className="stats">
          <div>
            <b>{state.users}</b>Users
          </div>
          <div>
            <b>{allMerchants.length}</b>Merchants
          </div>
          <div>
            <b>{allLenders.length}</b>Lenders
          </div>
        </div>
        <h3 style={{ marginTop: '12px' }}>Merchants ({allMerchants.length})</h3>
        {allMerchants.map((m) => {
          const sp = state.sus.includes(m);
          const mPlan = state.merchantPlans?.[m];
          const pl = mPlan
            ? mPlan.active
              ? `${mPlan.n} ${mPlan.term} active${mPlan.exp ? ` (exp ${mPlan.exp})` : ''}`
              : 'Not subscribed'
            : m === BM
              ? state.plan.active
                ? `${state.plan.n} ${state.plan.term || 'Monthly'} active`
                : 'No active plan'
              : 'Seeded store';
          return (
            <div key={m} className="grp">
              <div>
                <b>{m}</b> {sp && <span className="bd r">Suspended</span>}
                <div className="mu">
                  {state.products.filter((p) => p.m === m).length} products · {pl}
                </div>
              </div>
              {(Boolean(mPlan) || m === BM) && (
                <button className="btn sm o" onClick={() => onTogglePlan(m)}>
                  {mPlan?.active ? 'Pause plan' : 'Activate plan'}
                </button>
              )}
              <button className="btn sm o" onClick={() => onToggleSuspend(m)}>
                {sp ? 'Restore' : 'Suspend'}
              </button>
            </div>
          );
        })}

        <h3 style={{ marginTop: '12px' }}>Lenders ({allLenders.length})</h3>
        {allLenders.map((l) => (
          <div key={l.id} className="grp">
            <div>
              <b>{l.n}</b>
              <div className="mu">
                📍 {l.loc} · {l.range}
              </div>
            </div>
            <span className="bd">Active</span>
          </div>
        ))}

        <h3 style={{ marginTop: '12px' }}>Members ({mem.size})</h3>
        <div className="card mu">{[...mem].join(' · ')}</div>
      </>
    );
  }

  if (t === 'products') {
    const featIds = state.feat || [];
    const promoIds = state.promo || [];
    const filteredMod = state.products.filter((p) => {
      const h = state.hidden.includes(p.id);
      const f = featIds.includes(p.id) || Boolean(p.featured);
      const pr = promoIds.includes(p.id) || Boolean(p.promoted);
      if (modFilter === 'featured') return f;
      if (modFilter === 'promoted') return pr;
      if (modFilter === 'hidden') return h;
      return true;
    });

    return (
      <>
        <PageTop title="Product & Spotlight Moderation" />
        <div className="stats" style={{ marginBottom: '10px' }}>
          <div>
            <b>{state.products.length}</b>All Listings
          </div>
          <div>
            <b>{state.products.filter((p) => featIds.includes(p.id) || p.featured).length}</b>
            ⭐ Featured
          </div>
          <div>
            <b>{state.products.filter((p) => promoIds.includes(p.id) || p.promoted).length}</b>
            🔥 Promotional
          </div>
        </div>

        <div className="cats" style={{ marginBottom: '10px' }}>
          <span
            className={`cat ${modFilter === 'all' ? 'on' : ''}`}
            onClick={() => setModFilter('all')}
          >
            All ({state.products.length})
          </span>
          <span
            className={`cat ${modFilter === 'featured' ? 'on' : ''}`}
            onClick={() => setModFilter('featured')}
          >
            ⭐ Featured Items (Paid Spotlight)
          </span>
          <span
            className={`cat ${modFilter === 'promoted' ? 'on' : ''}`}
            onClick={() => setModFilter('promoted')}
          >
            🔥 Promotional Items (Sponsored Deals)
          </span>
          <span
            className={`cat ${modFilter === 'hidden' ? 'on' : ''}`}
            onClick={() => setModFilter('hidden')}
          >
            Hidden ({state.hidden.length})
          </span>
        </div>

        {filteredMod.length ? (
          filteredMod.map((p) => {
            const h = state.hidden.includes(p.id);
            const f = featIds.includes(p.id) || Boolean(p.featured);
            const pr = promoIds.includes(p.id) || Boolean(p.promoted);
            return (
              <div key={p.id} className="card">
                <div className="row">
                  <ProductThumb p={p} h={56} w="56px" />
                  <div style={{ flex: 1 }}>
                    <b>{p.n}</b>{' '}
                    {h ? <span className="bd r">Hidden</span> : <span className="bd">Live</span>}{' '}
                    {f && <span className="bd p">⭐ Featured Spotlight</span>}{' '}
                    {pr && <span className="bd r">🔥 Sponsored Deal</span>}
                    <div className="mu">
                      {p.m} · {K(p.p)} · {p.g.length} groups · Till: {p.till}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: '8px', flexWrap: 'wrap' }}>
                  <button className="btn sm o" onClick={() => onToggleHideProduct(p.id)}>
                    {h ? 'Show' : 'Hide'}
                  </button>
                  <button
                    className={`btn sm ${f ? 'y' : 'o'}`}
                    onClick={() => onToggleFeatureProduct(p.id)}
                  >
                    {f ? '⭐ Unfeature' : '⭐ Approve Featured'}
                  </button>
                  <button
                    className={`btn sm ${pr ? 'y' : 'o'}`}
                    onClick={() => onTogglePromoteProduct(p.id)}
                  >
                    {pr ? '🔥 Unpromote' : '🔥 Approve Promo'}
                  </button>
                  <button className="btn sm o" onClick={() => onRemoveProduct(p.id)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="mu card">No listings match this moderation filter.</p>
        )}
      </>
    );
  }

  if (t === 'groups') {
    return (
      <>
        <PageTop title="Group monitoring" />
        {gs.length ? (
          gs.map(({ p, g }) => (
            <div key={`${p.id}-${g.n}`} className="grp">
              <div>
                <b>
                  {p.n} · Group {g.n}
                </b>
                <div className="mu">
                  {g.j}/{g.c} members · Rotation {g.done ? g.c : g.rot}/{g.c} · Day{' '}
                  {g.done ? g.c * 10 : dn(g)}/{g.c * 10} · Mod: {g.r[0]?.n}
                </div>
              </div>
              <button
                className="btn sm o"
                onClick={() => onGo('groups', 'track', `${p.id}:${g.n}`)}
              >
                View
              </button>
            </div>
          ))
        ) : (
          <p className="mu card">No active groups.</p>
        )}
      </>
    );
  }

  if (t === 'fin') {
    const ledger: RevenueEntry[] = state.revenueLedger || [];
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const monthPrefix = todayPrefix.slice(0, 7);
    const yearPrefix = todayPrefix.slice(0, 4);

    const filterByPeriod = (items: RevenueEntry[]) => {
      if (revPeriod === 'day') return items.filter((e) => e.dateLabel === todayPrefix);
      if (revPeriod === 'month') return items.filter((e) => e.dateLabel.startsWith(monthPrefix));
      if (revPeriod === 'year') return items.filter((e) => e.dateLabel.startsWith(yearPrefix));
      return items;
    };

    const periodEntries = filterByPeriod(ledger);
    const sumCat = (items: RevenueEntry[], cat: RevenueCategory) =>
      items.filter((e) => e.category === cat).reduce((acc, e) => acc + e.amount, 0);

    const subPeriod = sumCat(periodEntries, 'subscription');
    const loanPeriod = sumCat(periodEntries, 'loan_commission');
    const featPeriod = sumCat(periodEntries, 'featured_spotlight');
    const promoPeriod = sumCat(periodEntries, 'promotional_deal');
    const totalPeriod = subPeriod + loanPeriod + featPeriod + promoPeriod;

    // Group ledger entries by day (YYYY-MM-DD), month (YYYY-MM), or year (YYYY)
    const groupKeyFor = (e: RevenueEntry) =>
      revPeriod === 'year'
        ? e.dateLabel.slice(0, 4)
        : revPeriod === 'month'
          ? e.dateLabel.slice(0, 7)
          : e.dateLabel;

    const bucketMap = new Map<
      string,
      {
        label: string;
        subscription: number;
        loan_commission: number;
        featured_spotlight: number;
        promotional_deal: number;
        total: number;
      }
    >();
    for (const e of ledger) {
      const key = groupKeyFor(e);
      const bucket = bucketMap.get(key) || {
        label: key,
        subscription: 0,
        loan_commission: 0,
        featured_spotlight: 0,
        promotional_deal: 0,
        total: 0,
      };
      bucket[e.category] += e.amount;
      bucket.total += e.amount;
      bucketMap.set(key, bucket);
    }
    const buckets = [...bucketMap.values()];

    const categoryLabels: Record<RevenueCategory, string> = {
      subscription: 'Merchant Subscription',
      loan_commission: '5% Loan Commission',
      featured_spotlight: '⭐ Paid Spotlight',
      promotional_deal: '🔥 Sponsored Deal',
    };

    return (
      <>
        <PageTop title="Finance & Commission Wallet" />
        <div className="bal">
          <div className="row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span className="mu" style={{ color: '#ffe4e0' }}>
                Admin Revenue Wallet (Total Earnings)
              </span>
              <h2>{K(state.rev)}</h2>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#ffe4e0' }}>
              All-Time Subs: <b>{K(state.subRev || 0)}</b> · Spotlights &amp; Deals:{' '}
              <b>{K(state.promoRev || 0)}</b> · Loan 5% Fees: <b>{K(state.fee || 0)}</b>
            </div>
          </div>
        </div>

        <div className="cats" style={{ margin: '10px 0' }}>
          <span
            className={`cat ${revPeriod === 'day' ? 'on' : ''}`}
            onClick={() => setRevPeriod('day')}
          >
            📅 Per Day ({todayPrefix})
          </span>
          <span
            className={`cat ${revPeriod === 'month' ? 'on' : ''}`}
            onClick={() => setRevPeriod('month')}
          >
            🗓️ Per Month ({monthPrefix})
          </span>
          <span
            className={`cat ${revPeriod === 'year' ? 'on' : ''}`}
            onClick={() => setRevPeriod('year')}
          >
            📆 Per Year ({yearPrefix})
          </span>
          <span
            className={`cat ${revPeriod === 'all' ? 'on' : ''}`}
            onClick={() => setRevPeriod('all')}
          >
            🏦 All Ledger ({ledger.length})
          </span>
        </div>

        <div className="card" style={{ background: '#fffaf5', borderColor: '#fed7aa' }}>
          <div className="row sp" style={{ marginBottom: '8px' }}>
            <b>
              Commission Breakdown —{' '}
              {revPeriod === 'day'
                ? `Today (${todayPrefix})`
                : revPeriod === 'month'
                  ? `This Month (${monthPrefix})`
                  : revPeriod === 'year'
                    ? `This Year (${yearPrefix})`
                    : 'All Recorded Commissions'}
            </b>
            <b style={{ color: '#e62e04' }}>Period Total: {K(totalPeriod)}</b>
          </div>
          <div className="stats">
            <div>
              <b style={{ fontSize: '14px' }}>{K(subPeriod)}</b>Merchant Subscriptions
            </div>
            <div>
              <b style={{ fontSize: '14px' }}>{K(loanPeriod)}</b>5% Loan Commissions
            </div>
            <div>
              <b style={{ fontSize: '14px' }}>{K(featPeriod)}</b>⭐ Paid Spotlights
            </div>
            <div>
              <b style={{ fontSize: '14px' }}>{K(promoPeriod)}</b>🔥 Sponsored Deals
            </div>
          </div>
        </div>

        {buckets.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '6px' }}>
              📊 Commission History ({revPeriod === 'year' ? 'Yearly' : revPeriod === 'month' ? 'Monthly' : 'Daily'} Summary)
            </h3>
            {buckets.map((b) => (
              <div key={b.label} className="tx" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <b>{b.label}</b>
                  <div className="mu">
                    Subs: {K(b.subscription)} · Loan 5%: {K(b.loan_commission)} · Spotlight:{' '}
                    {K(b.featured_spotlight)} · Promo: {K(b.promotional_deal)}
                  </div>
                </div>
                <b style={{ color: '#e62e04' }}>{K(b.total)}</b>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ marginTop: '12px' }}>Commission Ledger ({periodEntries.length})</h3>
        {periodEntries.length ? (
          periodEntries.map((e) => (
            <div key={e.id} className="card">
              <div className="row sp">
                <b>{categoryLabels[e.category]}</b>
                <b style={{ color: '#16a34a' }}>+{K(e.amount)}</b>
              </div>
              <div className="mu">
                {e.description} · From: <b>{e.sourceUser}</b> · {e.dateLabel}
              </div>
            </div>
          ))
        ) : (
          <p className="mu card">No commission transactions recorded in this period yet.</p>
        )}

        <h3 style={{ marginTop: '12px' }}>All deposits</h3>
        {state.deposits.map((d) => (
          <div key={d.id} className="card">
            <div className="row sp">
              <b>
                {d.by} · {d.role || 'member'}
              </b>
              <span
                className={`bd ${
                  d.st === 'declined' ? 'r' : d.st === 'pending' ? 'p' : ''
                }`}
              >
                {d.st}
              </span>
            </div>
            <div className="mu">
              {K(d.amt)} · {d.code}
              {d.reason ? ` · Reason: ${d.reason}` : ''}
            </div>
          </div>
        ))}
      </>
    );
  }

  if (t === 'set') {
    return (
      <>
        <PageTop title="Platform settings" />
        <div className="card">
          <label className="mu">M-Pesa Till / Paybill shown in deposit pop-ups</label>
          <input value={tillVal} onChange={(e) => setTillVal(e.target.value)} />
          <label className="mu">Home banner headline</label>
          <input value={bannerVal} onChange={(e) => setBannerVal(e.target.value)} />
          <button
            className="btn y bl"
            onClick={() => onSaveSettings(tillVal, bannerVal)}
          >
            Save settings
          </button>
        </div>
        <div className="card mu">
          Loan commission: 5% deducted once per disbursed loan · Merchant Plans: KSh 250 / 750 / 1,500
          (Monthly) &amp; Annual · Paid Spotlight / Promotional Deals: KSh 500/month each
        </div>
      </>
    );
  }

  return (
    <>
      <PageTop title="Admin Panel" />
      <div className="stats">
        <div>
          <b>{pd.length}</b>Pending deposits
        </div>
        <div>
          <b style={{ fontSize: '15px' }}>{K(state.rev)}</b>Revenue
        </div>
        <div>
          <b>{state.users}</b>Users
        </div>
      </div>
      <div className="stats" style={{ marginTop: '8px' }}>
        <div>
          <b>{merchants.length}</b>Merchants
        </div>
        <div>
          <b>{state.products.length}</b>Products
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => onGo('wishlist')}>
          <b>❤️ {wishlistCount}</b>My Wishlist →
        </div>
      </div>

      <div className="card row sp" style={{ marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <b>📣 Spotlight &amp; Subscription Moderation</b>
          <div className="mu">
            {(state.feat || []).length} ⭐ Featured Spotlights · {(state.promo || []).length} 🔥
            Promotional Deals · {K(state.subRev || 0)} Subscriptions · {K(state.promoRev || 0)}{' '}
            Spotlights
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn y sm" onClick={() => onGo('products')}>
            Moderate Featured &amp; Promo
          </button>
          <button type="button" className="btn o sm" onClick={() => onGo('users')}>
            Merchant Plans
          </button>
        </div>
      </div>

      <h3 style={{ marginTop: '12px' }}>Manual M-Pesa Deposit Authentication</h3>
      {pd.length ? (
        pd.map(renderDepositCard)
      ) : (
        <p className="mu card">No pending deposits awaiting authentication.</p>
      )}

      <div className="card">
        <svg viewBox="0 0 300 100" width="100%">
          <path
            d="M0 90 L30 65 60 75 90 40 120 55 150 28 180 50 210 22 240 36 270 10 300 18"
            stroke="#ff4747"
            fill="none"
            strokeWidth="3"
          />
        </svg>
      </div>
    </>
  );
};
