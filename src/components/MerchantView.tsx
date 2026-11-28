import React, { useState } from 'react';
import type { AppState, PendingGroupPayment, Tab } from '../types/buyoll';
import { BM, K, dn, inst } from '../utils/format';
import type { AuthModalMode } from './LoginView';
import { PageTop, ProductThumb, ProfileView, WalletView, WishlistView } from './SharedViews';

interface MerchantViewProps {
  state: AppState;
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onOpenDeposit: () => void;
  onOpenSubscribe: () => void;
  onOpenUpload: () => void;
  onOpenPromote: (pid: number) => void;
  onToggleWishlist: (pid: number) => void;
  onUpdateProductTill: (pid: number, till: string) => void;
  onDecideGroupPayment: (paymentId: number, approve: boolean) => void;
  onOpenProductAI: (pid: number) => void;
  onOpenOnboarding: (pid: number) => void;
  onToast: (msg: string) => void;
  onRequireAuth: (mode: AuthModalMode, msg?: string) => void;
  onLogout: () => void;
  onReset: () => void;
}

export const MerchantView: React.FC<MerchantViewProps> = ({
  state,
  onGo,
  onOpenDeposit,
  onOpenSubscribe,
  onOpenUpload,
  onOpenPromote,
  onToggleWishlist,
  onUpdateProductTill,
  onDecideGroupPayment,
  onOpenProductAI,
  onOpenOnboarding,
  onToast,
  onRequireAuth,
  onLogout,
  onReset,
}) => {
  const { tab: t, view: v, sel, plan: pl } = state;
  const merchantName = state.name || BM;
  const isPlanActive = pl.ts ? pl.ts >= Date.now() && pl.active : pl.active;
  const myProducts = state.products.filter((p) => p.m === merchantName);
  const [tillInput, setTillInput] = useState<string>('');
  const [editingPid, setEditingPid] = useState<number | null>(null);

  const pendingPayments = state.groupPayments.filter((gp) => gp.st === 'pending');

  if (v === 'add') {
    const p = state.products.find((x) => x.id === Number(sel));
    if (!p) return null;
    const currentTill = editingPid === p.id ? tillInput : p.till;

    return (
      <>
        <PageTop title="Add Groups to Product" backTab="home" onBack={() => onGo('home')} />
        <div className="card row">
          <ProductThumb p={p} h={60} w="80px" />
          <div>
            <b>{p.n}</b>
            <div className="price">{K(p.p)}</div>
            <div className="mu">Till / Paybill: {p.till}</div>
          </div>
        </div>

        <div className="card">
          <label className="mu">Product Till / Paybill Number (shown in Pay Today popup)</label>
          <div className="row" style={{ marginTop: '4px' }}>
            <input
              style={{ margin: 0 }}
              value={currentTill}
              placeholder="Enter Till or Paybill e.g. 542100"
              onChange={(e) => {
                setEditingPid(p.id);
                setTillInput(e.target.value);
              }}
            />
            <button
              className="btn y sm"
              onClick={() => {
                onUpdateProductTill(p.id, currentTill);
                setEditingPid(null);
              }}
            >
              Save
            </button>
          </div>
        </div>

        <div className="card mu" style={{ textAlign: 'center' }}>
          All 10 group sizes (1–10 members) are strictly enforced: Group A holds 1 member max,
          Group B holds 2 members max, ..., Group J holds 10 members max.
        </div>

        {p.g.map((g) => (
          <div key={g.n} className="grp">
            <span style={{ fontSize: '24px' }}>👥</span>
            <div>
              <b>
                Group {g.n} – {g.c} Member{g.c > 1 ? 's' : ''} Max
              </b>
              <div className="mu">
                {K(inst(p.p, g.c))}/day · cycle {g.c * 10} days · {g.j}/{g.c} joined
              </div>
            </div>
            <span className={`bd ${g.j >= g.c ? 'r' : ''}`}>
              {g.j >= g.c ? 'Full' : `${g.c - g.j} open`}
            </span>
          </div>
        ))}

        <button
          className="btn y bl"
          style={{ marginTop: '8px' }}
          onClick={() => {
            onToast('Groups & Till/Paybill saved');
            onGo('home');
          }}
        >
          Save Groups
        </button>
      </>
    );
  }

  if (t === 'wallet') {
    return <WalletView state={state} bal={state.mw} onOpenDeposit={onOpenDeposit} />;
  }

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
        role="merchant"
        walletBalance={state.mw}
        wishlistCount={wishlistCount}
        onOpenWallet={() => onGo('wallet')}
        onOpenWishlist={() => onGo('wishlist')}
        onRequireAuth={onRequireAuth}
        onLogout={onLogout}
        onReset={onReset}
      />
    );
  }

  const productList = myProducts.map((p) => {
    const isFeatured = state.feat.includes(p.id) || Boolean(p.featured);
    const isPromoted = (state.promo || []).includes(p.id) || Boolean(p.promoted);
    return (
      <div key={p.id} className="card" style={{ margin: 0 }}>
        <div className="row">
          <ProductThumb p={p} h={80} w="80px" />
          <div style={{ flex: 1 }}>
            <b>{p.n}</b>
            <div>
              <span className="price" style={{ fontSize: '16px' }}>
                {K(p.p)}
              </span>
              <span className="old">{K(p.o)}</span>
            </div>
            <div className="mu">
              📍 {p.loc} · {p.stock} in stock
            </div>
            <div className="mu">
              Till/Paybill: <b>{p.till}</b>
            </div>
            {(isFeatured || isPromoted) && (
              <div className="row" style={{ marginTop: '4px', gap: '4px', flexWrap: 'wrap' }}>
                {isFeatured && <span className="bd p">⭐ Featured</span>}
                {isPromoted && <span className="bd r">🔥 Promoted</span>}
              </div>
            )}
          </div>
        </div>
        <div className="row" style={{ marginTop: '8px', flexWrap: 'wrap' }}>
          <button className="btn sm bl" style={{ flex: 1 }} onClick={() => onGo('home', 'add', p.id)}>
            + Groups &amp; Till
          </button>
          <button
            className="btn y sm bl"
            style={{ flex: 1 }}
            onClick={() => onOpenPromote(p.id)}
          >
            📣 Feature / Promote
          </button>
          <button
            className="btn sm o"
            onClick={() =>
              onToast(`${p.g.reduce((a, g) => a + g.j, 0)} members joined`)
            }
          >
            Sales
          </button>
          <button
            type="button"
            className="btn sm o"
            onClick={() => onOpenProductAI(p.id)}
          >
            ✨ AI Insights
          </button>
          <button
            type="button"
            className="btn sm o"
            onClick={() => onOpenOnboarding(p.id)}
          >
            ❓ Chamaa Guide
          </button>
        </div>
      </div>
    );
  });

  if (t === 'products') {
    return (
      <>
        <PageTop title="My Products" />
        <div className="two">{productList}</div>
      </>
    );
  }

  const activeGroups = myProducts.flatMap((p) =>
    p.g
      .filter((g) => g.j > 0)
      .map((g) => (
        <div key={`${p.id}-${g.n}`} className="grp">
          <div>
            <b>
              {p.n} · Group {g.n}
            </b>
            <div className="mu">
              {g.j}/{g.c} members · Day {g.done ? g.c * 10 : dn(g)}/{g.c * 10}
              {g.done
                ? ' · completed'
                : ` · Next delivery: `}
              {!g.done && <b>{g.r[g.rot - 1] ? g.r[g.rot - 1].n : 'open slot'}</b>}
            </div>
          </div>
        </div>
      ))
  );

  const renderPaymentCard = (gp: PendingGroupPayment) => (
    <div key={gp.id} className="card">
      <div className="row sp">
        <b>
          {gp.memberName} · Group {gp.g}
        </b>
        <span className="bd p">{gp.merchant}</span>
      </div>
      <div className="mu">
        {gp.productName} · Till/Paybill: <b>{gp.till}</b>
        <br />
        Amount: <b>{K(gp.amount)}</b> ({gp.daysCount} day{gp.daysCount > 1 ? 's' : ''}) · Code:{' '}
        <b>{gp.code}</b>
      </div>
      <div className="row" style={{ marginTop: '8px' }}>
        <button
          className="btn sm"
          style={{ background: 'var(--gr)', color: '#041' }}
          onClick={() => onDecideGroupPayment(gp.id, true)}
        >
          Approve &amp; Check-mark
        </button>
        <button
          className="btn sm"
          style={{ background: 'var(--rd)' }}
          onClick={() => onDecideGroupPayment(gp.id, false)}
        >
          Decline
        </button>
      </div>
    </div>
  );

  return (
    <>
      <PageTop title="Merchant Zone" />
      <div className="card row">
        <span style={{ fontSize: '34px' }}>🏪</span>
        <div>
          <b>{merchantName}</b>
          <br />
          <span className="bd">✔ Verified Merchant</span>
        </div>
      </div>

      <div className="stats">
        <div>
          <b>
            {myProducts.length}/{pl.max}
          </b>
          Products
        </div>
        <div>
          <b>{myProducts.reduce((a, p) => a + p.g.length, 0)}</b>
          Groups
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => onGo('wallet')}>
          <b style={{ fontSize: '15px' }}>{K(state.mw)}</b>
          Private Wallet →
        </div>
      </div>

      <div className="card row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div className="mu">Private Merchant Wallet</div>
          <b style={{ fontSize: '18px' }}>{K(state.mw)}</b>
          {state.deposits.some((d) => d.st === 'pending') && (
            <div className="mu" style={{ color: '#b45309', fontWeight: 600 }}>
              ⏳ {state.deposits.filter((d) => d.st === 'pending').length} M-Pesa deposit(s)
              awaiting Admin approval
            </div>
          )}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn y sm" onClick={() => onGo('wallet')}>
            👛 Open Private Wallet
          </button>
          <button type="button" className="btn o sm" onClick={() => onGo('wishlist')}>
            ❤️ Wishlist ({wishlistCount})
          </button>
          <button type="button" className="btn o sm" onClick={onOpenDeposit}>
            ⬆ Deposit (M-Pesa)
          </button>
        </div>
      </div>

      <div className="card">
        <b>
          {pl.n} · {pl.term || 'Monthly'}
        </b>{' '}
        <span className={`bd ${isPlanActive ? '' : 'r'}`}>
          {isPlanActive ? 'Active' : 'Subscription Required'}
        </span>
        <div className="mu">
          {isPlanActive
            ? `Expires ${pl.exp} · ${myProducts.length}/${pl.max} products · Optional ⭐ Featured Spotlight & 🔥 Promotional Deals: KSh 500/mo each from wallet`
            : 'Mandatory before uploading products. Deposit via M-Pesa → Admin approves → Pay subscription from wallet.'}
        </div>
        <button className="btn sm" style={{ marginTop: '6px' }} onClick={onOpenSubscribe}>
          {isPlanActive ? 'Upgrade / Renew Plan' : 'Subscribe from Wallet'}
        </button>
      </div>

      {isPlanActive ? (
        <button className="btn y bl" style={{ margin: '8px 0' }} onClick={onOpenUpload}>
          + Upload Product
        </button>
      ) : (
        <div className="card" style={{ borderColor: '#f59e0b', background: '#fffbeb' }}>
          <b>🔒 Mandatory Subscription Required Before Uploading Products</b>
          <div className="mu" style={{ marginTop: '4px' }}>
            1. Deposit funds via manual M-Pesa &rarr; 2. Wait for Admin authentication to credit
            your wallet &rarr; 3. Subscribe from your private wallet to unlock product uploads.
          </div>
          <div className="row" style={{ marginTop: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn o sm" onClick={onOpenDeposit}>
              ⬆ 1. Deposit via M-Pesa
            </button>
            <button type="button" className="btn y sm" onClick={onOpenSubscribe}>
              💳 2. Subscribe from Wallet
            </button>
          </div>
        </div>
      )}

      <h3>Pending Member Payments ({pendingPayments.length})</h3>
      {pendingPayments.length ? (
        pendingPayments.map(renderPaymentCard)
      ) : (
        <p className="mu card">No pending group payments awaiting approval.</p>
      )}

      <h3>Members &amp; deliveries</h3>
      {activeGroups.length ? (
        activeGroups
      ) : (
        <p className="mu card">No members have joined yet.</p>
      )}

      <h3 style={{ marginTop: '12px' }}>My Products</h3>
      <div className="two">{productList}</div>
    </>
  );
};
