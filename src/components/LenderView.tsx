import React, { useState } from 'react';
import type { AppState, Tab } from '../types/buyoll';
import { K, ME } from '../utils/format';
import type { AuthModalMode } from './LoginView';
import { PageTop, ProfileView, WalletView, WishlistView } from './SharedViews';

interface LenderViewProps {
  state: AppState;
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onOpenDeposit: () => void;
  onDecideLoan: (id: number, approve: boolean, amount?: number) => void;
  onToggleWishlist: (pid: number) => void;
  onRequireAuth: (mode: AuthModalMode, msg?: string) => void;
  onLogout: () => void;
  onReset: () => void;
}

export const LenderView: React.FC<LenderViewProps> = ({
  state,
  onGo,
  onOpenDeposit,
  onDecideLoan,
  onToggleWishlist,
  onRequireAuth,
  onLogout,
  onReset,
}) => {
  const { tab: t } = state;
  const wishlistCount = (state.wishlist || []).length;
  const [transferAmounts, setTransferAmounts] = useState<Record<number, string>>({});

  if (t === 'wallet') {
    return <WalletView state={state} bal={state.lw} onOpenDeposit={onOpenDeposit} />;
  }
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
        role="lender"
        walletBalance={state.lw}
        wishlistCount={wishlistCount}
        onOpenWallet={() => onGo('wallet')}
        onOpenWishlist={() => onGo('wishlist')}
        onRequireAuth={onRequireAuth}
        onLogout={onLogout}
        onReset={onReset}
      />
    );
  }

  const activeLenderId = state.lenderId || ME;
  // Global board: ALL pending loan requests across the platform are visible to every logged-in lender
  const rq = state.lr.filter((r) => r.st === 'pending');
  const ls = state.loans.filter(
    (l) => l.lender === activeLenderId || (l.lenderName && l.lenderName === state.name)
  );

  const hist = (
    <div className="card">
      {ls.length ? (
        ls.map((l) => (
          <div key={l.id} className="tx" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <b>
                {l.id} · {l.who} {l.memberCode ? `(${l.memberCode})` : ''}
              </b>
              <div className="mu">
                {l.phone ? `📞 ${l.phone} · ` : ''}
                {l.pid && l.gn ? `Group ${l.gn} · ` : ''}
                5% fee: {K(l.commissionAmt ?? Math.round(l.amt * 0.05))} · Net credited:{' '}
                {K(l.netAmt ?? l.amt - Math.round(l.amt * 0.05))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>
                <b>{K(l.amt)}</b>
              </div>
              <span className={`bd ${l.st === 'Paid' ? 'p' : ''}`}>{l.st}</span>
            </div>
          </div>
        ))
      ) : (
        <p className="mu">No loans disbursed yet</p>
      )}
    </div>
  );

  if (t === 'loans') {
    return (
      <>
        <PageTop title="My Disbursed Loans" />
        {hist}
      </>
    );
  }

  return (
    <>
      <PageTop title="Lender Dashboard" />
      <div className="ban">
        <h2 style={{ fontSize: '24px' }}>Lend. Empower. Earn.</h2>
        <p className="mu">
          {state.name} · inspect borrowers&apos; active groups (read-only), agree KYC &amp; terms
          outside Buyoll, and transfer agreed amounts from your wallet
        </p>
      </div>
      <div className="stats">
        <div>
          <b style={{ fontSize: '16px' }}>{K(state.lent)}</b>Platform lent
        </div>
        <div>
          <b>{ls.filter((l) => l.st === 'Active').length}</b>My Active loans
        </div>
        <div>
          <b>{rq.length}</b>Global requests
        </div>
      </div>

      <div className="card row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div className="mu">Private Lender Wallet</div>
          <b style={{ fontSize: '20px' }}>{K(state.lw)}</b>
          <div className="mu" style={{ fontSize: '11px' }}>
            Deposit via manual M-Pesa (Admin approved) to fund borrower loans
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn y sm" onClick={() => onGo('wallet')}>
            👛 Open Private Wallet
          </button>
          <button type="button" className="btn o sm" onClick={() => onGo('wishlist')}>
            ❤️ Wishlist ({wishlistCount})
          </button>
          <button type="button" className="btn o sm" onClick={onOpenDeposit}>
            ⬆ Deposit via M-Pesa
          </button>
        </div>
      </div>

      <h3>Global Member Loan Requests ({rq.length})</h3>
      <p className="mu" style={{ marginBottom: '8px' }}>
        Every member loan request is shown globally. Click the borrower&apos;s Group Link to inspect
        their group in strict <b>Read-Only Mode</b>, verify KYC &amp; repayment terms with them via
        phone outside Buyoll, then link your Lender Wallet to transfer the agreed amount.
      </p>

      {rq.length ? (
        rq.map((r) => {
          const linkedProduct = r.pid ? state.products.find((p) => p.id === r.pid) : undefined;
          const rawInput = transferAmounts[r.id];
          const transferAmt =
            rawInput !== undefined && rawInput !== '' ? Math.round(Number(rawInput) || 0) : r.amt;
          const commission = Math.round(Math.max(0, transferAmt) * 0.05);
          const net = Math.max(0, transferAmt - commission);
          const hasBalance = state.lw >= transferAmt && transferAmt >= 50;

          return (
            <div key={r.id} className="card">
              <div className="row sp" style={{ flexWrap: 'wrap', gap: '6px' }}>
                <div>
                  <b style={{ fontSize: '15px' }}>{r.by}</b>{' '}
                  <span className="bd p" style={{ fontSize: '11px' }}>
                    {r.memberCode || 'BUY-M-000'}
                  </span>
                </div>
                <b style={{ color: '#e62e04', fontSize: '16px' }}>Requested: {K(r.amt)}</b>
              </div>

              <div className="mu" style={{ marginTop: '4px', lineHeight: 1.55 }}>
                📞 Phone: <b>{r.phone || 'Not provided'}</b> · 📍 {r.loc} · Credit score {r.score}
                <br />
                Purpose: <b>{r.ctx}</b>
              </div>

              {r.pid && r.gn && (
                <div style={{ margin: '8px 0' }}>
                  <button
                    type="button"
                    className="btn o sm"
                    style={{ borderColor: '#fb923c', color: '#c2410c', background: '#fff7ed' }}
                    onClick={() => onGo('groups', 'track', `${r.pid}:${r.gn}`)}
                  >
                    👥 Inspect Group {r.gn} · {linkedProduct?.n || r.ctx} (Read-Only) →
                  </button>
                </div>
              )}

              <div
                className="card"
                style={{
                  background: '#fffaf5',
                  borderColor: '#fed7aa',
                  margin: '8px 0',
                  padding: '10px',
                }}
              >
                <div className="row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: '170px' }}>
                    <label className="mu" style={{ display: 'block', marginBottom: '2px' }}>
                      Agreed Transfer Amount (KSh)
                    </label>
                    <input
                      type="number"
                      style={{ margin: 0 }}
                      value={rawInput !== undefined ? rawInput : String(r.amt)}
                      onChange={(e) =>
                        setTransferAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                  </div>
                  <div className="mu" style={{ flex: 1.4, minWidth: '210px', fontSize: '12px' }}>
                    Debits your Lender Wallet: <b>{K(transferAmt)}</b>
                    <br />
                    5% Platform Commission (deducted once): <b>{K(commission)}</b>
                    <br />
                    Net credited to {r.by}&apos;s Wallet: <b>{K(net)}</b> (installments only)
                  </div>
                </div>
              </div>

              <div className="row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                {r.pid && r.gn && (
                  <button
                    type="button"
                    className="btn o sm"
                    onClick={() => onGo('groups', 'track', `${r.pid}:${r.gn}`)}
                  >
                    👁️ Open Group &amp; Link Wallet
                  </button>
                )}
                <button
                  type="button"
                  className="btn y sm"
                  onClick={() => {
                    if (!hasBalance) {
                      onOpenDeposit();
                      return;
                    }
                    onDecideLoan(r.id, true, transferAmt);
                  }}
                >
                  {hasBalance
                    ? `💸 Transfer ${K(transferAmt)} to Borrower`
                    : `Deposit Funds (${K(transferAmt)} needed)`}
                </button>
                <button
                  type="button"
                  className="btn o sm"
                  onClick={() => onDecideLoan(r.id, false)}
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <p className="mu card">No pending loan requests on the global board.</p>
      )}

      <h3>My Loan History</h3>
      {hist}
    </>
  );
};
