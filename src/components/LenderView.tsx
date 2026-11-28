import React, { useState } from 'react';
import type { AppState, LoanRequest, Tab } from '../types/buyoll';
import { K, ME } from '../utils/format';
import type { AuthModalMode } from './LoginView';
import { PageTop, ProfileView, WalletView, WishlistView } from './SharedViews';

interface LenderViewProps {
  state: AppState;
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onOpenDeposit: () => void;
  onDecideLoan: (id: number, approve: boolean) => void;
  onDirectDisburseLoan: (
    id: number,
    amount: number,
    disbursedDate: string,
    completionDate: string,
    idempotencyKey: string
  ) => Promise<void> | void;
  onTransferLoan: (id: number, amount: number) => void;
  onDisburseLoan: (id: number, disbursedDate: string, completionDate: string) => void;
  onCompleteLoan: (loanId: string) => void;
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
  onDirectDisburseLoan,
  onTransferLoan: _onTransferLoan,
  onDisburseLoan,
  onCompleteLoan,
  onToggleWishlist,
  onRequireAuth,
  onLogout,
  onReset,
}) => {
  const { tab: t } = state;
  const wishlistCount = (state.wishlist || []).length;
  const [transferAmounts, setTransferAmounts] = useState<Record<number, string>>({});
  const [disburseDates, setDisburseDates] = useState<
    Record<number, { disbursedDate: string; completionDate: string }>
  >({});
  const [submittingIds, setSubmittingIds] = useState<Record<number, boolean>>({});
  const [idemKeys] = useState<Record<number, string>>({});

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
  const currentUserId = state.currentUserId || '';
  const todayIso = new Date().toISOString().slice(0, 10);
  const plus30Iso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const isMyApprovedRequest = (r: LoanRequest) =>
    Boolean(currentUserId && r.approvedByUserId === currentUserId) ||
    (!r.approvedByUserId && r.lenderName === state.name);

  // Pending requests available to THIS lender (excludes requests this lender declined, while remaining open for others)
  const rq = state.lr.filter(
    (r) => r.st === 'pending' && !(currentUserId && r.declinedBy?.includes(currentUserId))
  );

  // Requests approved or transferred by THIS lender awaiting wallet transfer or "Loan Disbursed"
  const myPipeline = state.lr.filter(
    (r) => (r.st === 'approved' || r.st === 'transferred') && isMyApprovedRequest(r)
  );

  // Active borrower locks visible to ALL lenders so nobody double-lends or double-disburses
  const activeBorrowerRequests = state.lr.filter(
    (r) => r.st === 'approved' || r.st === 'transferred'
  );
  const activeDisbursedLoans = state.loans.filter((l) => l.st === 'Active');

  const getBorrowerLock = (r: LoanRequest): string | null => {
    const normName = r.by.trim().toLowerCase();
    const normCode = (r.memberCode || '').trim().toLowerCase();

    const activeLoan = activeDisbursedLoans.find((l) => {
      const codeMatch = normCode && l.memberCode && l.memberCode.toLowerCase() === normCode;
      const nameMatch = l.who.trim().toLowerCase() === normName;
      return Boolean(codeMatch || nameMatch);
    });
    if (activeLoan) {
      return `Active disbursed loan of ${K(activeLoan.amt)} by ${activeLoan.lenderName || 'another lender'}${
        activeLoan.disbursedDate ? ` on ${activeLoan.disbursedDate}` : ''
      }${activeLoan.completionDate ? ` (completes ${activeLoan.completionDate})` : ''}`;
    }

    const otherApproved = activeBorrowerRequests.find((other) => {
      if (other.id === r.id) return false;
      const codeMatch =
        normCode && other.memberCode && other.memberCode.toLowerCase() === normCode;
      const nameMatch = other.by.trim().toLowerCase() === normName;
      return Boolean(codeMatch || nameMatch);
    });
    if (otherApproved) {
      return `Already approved by ${otherApproved.lenderName || 'another lender'} (${otherApproved.st})`;
    }
    return null;
  };

  const ls = state.loans.filter(
    (l) =>
      (currentUserId && l.lenderId === currentUserId) ||
      l.lender === activeLenderId ||
      (l.lenderName && l.lenderName === state.name)
  );

  const hist = (
    <div className="card">
      {ls.length ? (
        ls.map((l) => {
          const isMine =
            (currentUserId && l.lenderId === currentUserId) ||
            l.lender === activeLenderId ||
            l.lenderName === state.name;
          return (
            <div key={l.id} className="tx" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <b>
                  {l.id} · {l.who} {l.memberCode ? `(${l.memberCode})` : ''}
                </b>
                <div className="mu">
                  {l.phone ? `📞 ${l.phone} · ` : ''}
                  {l.pid && l.gn ? `Group ${l.gn} · ` : ''}
                  5% fee: {K(l.commissionAmt ?? Math.floor((l.amt * 5 + 50) / 100))} · Net credited:{' '}
                  {K(l.netAmt ?? l.amt - Math.floor((l.amt * 5 + 50) / 100))}
                </div>
                {(l.disbursedDate || l.completionDate) && (
                  <div className="mu">
                    {l.disbursedDate ? `Disbursed: ${l.disbursedDate}` : ''}
                    {l.completionDate ? ` · Completion: ${l.completionDate}` : ''}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <b>{K(l.amt)}</b>
                </div>
                <span className={`bd ${l.st === 'Paid' ? 'p' : ''}`}>{l.st}</span>
                {l.st === 'Active' && isMine && (
                  <div style={{ marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn o sm"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => onCompleteLoan(l.id)}
                    >
                      Mark Repaid
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
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
          {state.name} · Inspect borrower groups (read-only), agree terms outside Buyoll, approve
          one borrower at a time, transfer to borrower wallet, and mark Loan Disbursed
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
          <b>{rq.length}</b>Open requests
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

      {myPipeline.length > 0 && (
        <>
          <h3 style={{ marginTop: '12px' }}>
            Approved Loans Ready for Transfer &amp; Disbursement ({myPipeline.length})
          </h3>
          <p className="mu" style={{ marginBottom: '6px' }}>
            Disburse directly from your Lender Wallet to the Borrower Wallet in one step. No admin
            approval needed.
          </p>
          {myPipeline.map((r) => {
            const linkedProduct = r.pid ? state.products.find((p) => p.id === r.pid) : undefined;
            const rawInput = transferAmounts[r.id];
            const parsedInput = rawInput !== undefined && rawInput !== '' ? Number(rawInput) : r.amt;
            const transferAmt = Number.isFinite(parsedInput) ? Math.floor(Math.max(0, parsedInput)) : r.amt;
            const commission = Math.floor((transferAmt * 5 + 50) / 100);
            const net = Math.max(0, transferAmt - commission);
            const validAmount = Number.isInteger(transferAmt) && transferAmt >= 50;
            const hasBalance = validAmount && state.lw >= transferAmt;
            const isBusy = Boolean(submittingIds[r.id]);
            const dates = disburseDates[r.id] || {
              disbursedDate: r.disbursedDate || todayIso,
              completionDate: r.completionDate || plus30Iso,
            };

            return (
              <div
                key={`pipeline-${r.id}`}
                className="card"
                style={{ borderColor: '#fb923c', background: '#fffaf5' }}
              >
                <div className="row sp" style={{ flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <b style={{ fontSize: '15px' }}>{r.by}</b>{' '}
                    <span className="bd p" style={{ fontSize: '11px' }}>
                      {r.memberCode || 'BUY-M-000'}
                    </span>{' '}
                    <span className="bd" style={{ fontSize: '11px' }}>
                      {r.st === 'approved' ? 'Approved · Ready to Disburse' : 'Transferred · Confirm Disbursement'}
                    </span>
                  </div>
                  <b style={{ color: '#e62e04' }}>Requested: {K(r.amt)}</b>
                </div>

                <div className="mu" style={{ marginTop: '4px', lineHeight: 1.5 }}>
                  📞 Phone: <b>{r.phone || 'Not provided'}</b> · {r.ctx}
                  {r.pid && r.gn && (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        style={{ color: '#c2410c', cursor: 'pointer', fontWeight: 700 }}
                        onClick={() => onGo('groups', 'track', `${r.pid}:${r.gn}`)}
                      >
                        Inspect Group {r.gn} ({linkedProduct?.n || 'Product'})
                      </a>
                    </>
                  )}
                </div>

                {r.st === 'approved' && (
                  <div
                    className="card"
                    style={{ background: '#fff', borderColor: '#fed7aa', margin: '8px 0 0', padding: '10px' }}
                  >
                    <div className="mu" style={{ marginBottom: '8px' }}>
                      💳 <b>Borrower Wallet:</b> {r.by}&apos;s Wallet ({r.memberCode || 'Member'}) ·
                      Current Balance: <b>{K(r.borrowerWalletBalance ?? 0)}</b>
                    </div>

                    <div className="row sp" style={{ flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="mu" style={{ display: 'block', marginBottom: '2px' }}>
                          Disbursement Amount (KSh)
                        </label>
                        <input
                          type="number"
                          step={1}
                          min={50}
                          style={{ margin: 0 }}
                          value={rawInput !== undefined ? rawInput : String(r.amt)}
                          onChange={(e) =>
                            setTransferAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <label className="mu" style={{ display: 'block', marginBottom: '2px' }}>
                          Disbursement Date
                        </label>
                        <input
                          type="date"
                          style={{ margin: 0 }}
                          value={dates.disbursedDate}
                          onChange={(e) =>
                            setDisburseDates((prev) => ({
                              ...prev,
                              [r.id]: { ...dates, disbursedDate: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <label className="mu" style={{ display: 'block', marginBottom: '2px' }}>
                          Loan Completion Date
                        </label>
                        <input
                          type="date"
                          style={{ margin: 0 }}
                          value={dates.completionDate}
                          onChange={(e) =>
                            setDisburseDates((prev) => ({
                              ...prev,
                              [r.id]: { ...dates, completionDate: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div
                      className="card"
                      style={{ background: '#fff7ed', borderColor: '#fed7aa', padding: '8px 10px', margin: '0 0 8px' }}
                    >
                      <div className="row sp mu" style={{ fontSize: '12px', padding: '2px 0' }}>
                        <span>Debits Your Lender Wallet</span>
                        <b>{K(transferAmt)}</b>
                      </div>
                      <div className="row sp mu" style={{ fontSize: '12px', padding: '2px 0' }}>
                        <span>Credit admin wallet: 5% Platform Commission</span>
                        <b>{K(commission)}</b>
                      </div>
                      <div
                        className="row sp"
                        style={{
                          fontSize: '13px',
                          padding: '4px 0 0',
                          marginTop: '4px',
                          borderTop: '1px solid #fed7aa',
                        }}
                      >
                        <b>Credited to Borrower Wallet</b>
                        <b style={{ color: '#15803d' }}>{K(net)}</b>
                      </div>
                    </div>

                    {validAmount && state.lw < transferAmt && (
                      <div
                        className="card"
                        style={{
                          background: '#fef2f2',
                          borderColor: '#fecaca',
                          color: '#991b1b',
                          margin: '0 0 8px',
                          padding: '8px 10px',
                          fontSize: '12px',
                        }}
                      >
                        Insufficient Lender Wallet balance. Required: <b>{K(transferAmt)}</b> ·
                        Available: <b>{K(state.lw)}</b>.{' '}
                        <a
                          style={{ color: '#b91c1c', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                          onClick={onOpenDeposit}
                        >
                          Deposit Funds via M-Pesa →
                        </a>
                      </div>
                    )}

                    <div className="row" style={{ marginTop: '4px', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn y sm"
                        disabled={!hasBalance || isBusy}
                        onClick={async () => {
                          if (!hasBalance || isBusy) return;
                          const idemKey =
                            idemKeys[r.id] ||
                            `disb-${r.id}-${transferAmt}-${Date.now()}`;
                          idemKeys[r.id] = idemKey;
                          setSubmittingIds((prev) => ({ ...prev, [r.id]: true }));
                          try {
                            await onDirectDisburseLoan(
                              r.id,
                              transferAmt,
                              dates.disbursedDate,
                              dates.completionDate,
                              idemKey
                            );
                          } finally {
                            setSubmittingIds((prev) => ({ ...prev, [r.id]: false }));
                          }
                        }}
                      >
                        {isBusy ? 'Disbursing...' : 'Disburse to Borrower Wallet'}
                      </button>
                      {!hasBalance && (
                        <button type="button" className="btn o sm" onClick={onOpenDeposit}>
                          Deposit Funds
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {r.st === 'transferred' && (
                  <div
                    className="card"
                    style={{ background: '#ecfdf5', borderColor: '#86efac', margin: '8px 0 0', padding: '10px' }}
                  >
                    <div className="mu" style={{ color: '#14532d', fontWeight: 700, marginBottom: '6px' }}>
                      ✔ Transferred {K(r.disbursedAmt || r.amt)} (Net {K(r.netAmt || r.amt)} credited to {r.by}&apos;s wallet).
                      Set dates and click Loan Disbursed:
                    </div>
                    <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="mu" style={{ display: 'block', marginBottom: '2px' }}>
                          Disbursement Date
                        </label>
                        <input
                          type="date"
                          style={{ margin: 0 }}
                          value={dates.disbursedDate}
                          onChange={(e) =>
                            setDisburseDates((prev) => ({
                              ...prev,
                              [r.id]: { ...dates, disbursedDate: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="mu" style={{ display: 'block', marginBottom: '2px' }}>
                          Loan Completion Date
                        </label>
                        <input
                          type="date"
                          style={{ margin: 0 }}
                          value={dates.completionDate}
                          onChange={(e) =>
                            setDisburseDates((prev) => ({
                              ...prev,
                              [r.id]: { ...dates, completionDate: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="row" style={{ marginTop: '8px' }}>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() =>
                          onDisburseLoan(r.id, dates.disbursedDate, dates.completionDate)
                        }
                      >
                        ✅ Loan Disbursed
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <h3 style={{ marginTop: '12px' }}>Global Member Loan Requests ({rq.length})</h3>
      <p className="mu" style={{ marginBottom: '8px' }}>
        New loan requests appear here in real time. Click the borrower&apos;s Group Link to inspect
        members and contributions (read-only), call them outside Buyoll to agree terms &amp;
        interest, then click <b>Approve Loan</b> or <b>Decline</b>.
      </p>

      {rq.length ? (
        rq.map((r) => {
          const linkedProduct = r.pid ? state.products.find((p) => p.id === r.pid) : undefined;
          const borrowerLock = getBorrowerLock(r);

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
                📞 Mobile: <b>{r.phone || 'Not provided'}</b> · 📍 {r.loc}
                {r.createdAt ? ` · Posted ${r.createdAt}` : ''}
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
                    👥 Group Link: {linkedProduct?.n || r.ctx} · Group {r.gn} (Read-Only) →
                  </button>
                </div>
              )}

              {borrowerLock ? (
                <div
                  className="card mu"
                  style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', margin: '6px 0 0' }}
                >
                  🔒 <b>Locked against double-lending:</b> {borrowerLock}
                </div>
              ) : (
                <div className="row" style={{ flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn y sm"
                    onClick={() => onDecideLoan(r.id, true)}
                  >
                    ✔ Approve Loan
                  </button>
                  <button
                    type="button"
                    className="btn o sm"
                    onClick={() => onDecideLoan(r.id, false)}
                  >
                    Decline (Pass to Next Lender)
                  </button>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <p className="mu card">No open loan requests on the global board.</p>
      )}

      {(activeBorrowerRequests.length > 0 || activeDisbursedLoans.length > 0) && (
        <>
          <h3 style={{ marginTop: '14px' }}>
            Active Borrower Lock Registry (Anti-Double-Lending)
          </h3>
          <p className="mu" style={{ marginBottom: '6px' }}>
            Visible to all Buyoll lenders so no borrower is double-approved or over-lent.
          </p>
          <div className="card">
            {activeBorrowerRequests.map((r) => (
              <div key={`lock-req-${r.id}`} className="tx" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <b>
                    {r.by} ({r.memberCode || 'BUY-M'})
                  </b>
                  <div className="mu">
                    Loan of <b>{K(r.disbursedAmt || r.amt)}</b> was <b>{r.st}</b> by{' '}
                    <b>{r.lenderName || 'Lender'}</b>
                    {r.approvedAt ? ` (${r.approvedAt})` : ''} · Locked against double-lending
                  </div>
                </div>
                <span className="bd p">Locked</span>
              </div>
            ))}
            {activeDisbursedLoans.map((l) => (
              <div key={`lock-loan-${l.id}`} className="tx" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <b>
                    {l.who} ({l.memberCode || 'BUY-M'})
                  </b>
                  <div className="mu">
                    Loan of <b>{K(l.amt)}</b> was disbursed on{' '}
                    <b>{l.disbursedDate || 'Recorded date'}</b> by <b>{l.lenderName || 'Lender'}</b>{' '}
                    · Completes on <b>{l.completionDate || 'Agreed date'}</b>
                  </div>
                </div>
                <span className="bd">Disbursed</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ marginTop: '14px' }}>My Loan History</h3>
      {hist}
    </>
  );
};
