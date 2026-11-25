import React from 'react';
import { Heart, Search, Sparkles } from 'lucide-react';
import { LN } from '../utils/defaults';
import type { AppState, MyGroupEntry, Product, ProductGroup, Tab } from '../types/buyoll';
import {
  CATS,
  K,
  dc,
  dl,
  dn,
  getMemberTracking,
  inst,
} from '../utils/format';
import type { AuthModalMode } from './LoginView';
import {
  MerchantInitial,
  PageTop,
  ProductThumb,
  ProfileSettingsPanel,
  ProfileView,
  SquareProductImage,
  WalletView,
  WishlistView,
} from './SharedViews';

interface MemberViewProps {
  state: AppState;
  isVisible: (p: Product) => boolean;
  merchants: string[];
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onOpenSearch: () => void;
  onSearchChange: (q: string) => void;
  onMerchantFilter: (m: string) => void;
  onCategoryFilter: (c: string) => void;
  onToggleWishlist: (pid: number) => void;
  onJoinModal: (pid: number, gn: string) => void;
  onDecideJoinRequest: (requestId: string, approve: boolean, reason?: string) => void;
  onAppointModerator: (
    pid: number,
    gn: string,
    candidateName: string,
    directTransfer?: boolean
  ) => void;
  onEnforcePayment: (
    pid: number,
    gn: string,
    memberIdx: number,
    action: 'remind' | 'warn' | 'clear_pin',
    message?: string
  ) => void;
  onUpdateGroupRules: (pid: number, gn: string, rules: string) => void;
  onOpenGroupPayModal: (entry: MyGroupEntry) => void;
  onTickMember: (pid: number, gn: string, memberIdx: number) => void;
  onRotateGroup: (pid: number, gn: string) => void;
  onCopyLedger: (pid: number, gn: string) => void;
  onOpenDeposit: () => void;
  onOpenLoanModal: (lenderId: number) => void;
  onDecideLoan?: (id: number, approve: boolean, amount?: number) => void;
  onOpenProductAI: (pid: number) => void;
  onShowReport: () => void;
  onLogout: () => void;
  onReset: () => void;
  onRequireAuth: (mode: AuthModalMode, msg?: string) => void;
}

export const MemberView: React.FC<MemberViewProps> = ({
  state,
  isVisible,
  merchants,
  onGo,
  onOpenSearch,
  onSearchChange,
  onMerchantFilter,
  onCategoryFilter,
  onToggleWishlist,
  onJoinModal,
  onDecideJoinRequest,
  onAppointModerator,
  onEnforcePayment,
  onUpdateGroupRules,
  onOpenGroupPayModal,
  onTickMember,
  onRotateGroup,
  onCopyLedger,
  onOpenDeposit,
  onOpenLoanModal,
  onDecideLoan,
  onOpenProductAI,
  onShowReport,
  onLogout,
  onReset,
  onRequireAuth,
}) => {
  const { tab: t, view: v, sel } = state;
  const [groupQuery, setGroupQuery] = React.useState('');
  const [rulesDraft, setRulesDraft] = React.useState('');
  const [editingRulesKey, setEditingRulesKey] = React.useState<string | null>(null);
  const [lenderTransferAmounts, setLenderTransferAmounts] = React.useState<Record<number, string>>({});

  const prod = (id: number | string | null) => state.products.find((x) => x.id === Number(id));
  const grp = (pid: number | string | null, n: string) => prod(pid)?.g.find((x) => x.n === n);

  const renderGroupAction = (p: Product, g: ProductGroup) => {
    const m = state.my.find((x) => x.pid === p.id && x.g === g.n);
    const full = g.j >= g.c || g.r.length >= g.c;
    if (m) {
      return m.st === 'ok' ? (
        <button className="btn sm o" onClick={() => onGo('groups', 'track', `${p.id}:${g.n}`)}>
          Track
        </button>
      ) : (
        <span className="bd p">Pending</span>
      );
    }
    if (full) return <span className="bd r">Full</span>;
    return (
      <button
        className="btn sm"
        onClick={() => {
          if (!state.role) {
            onRequireAuth('member-register', 'Register as a Member to join a group');
            return;
          }
          onJoinModal(p.id, g.n);
        }}
      >
        Join
      </button>
    );
  };

  const renderGroupCard = (p: Product, g: ProductGroup) => {
    const full = g.j >= g.c || g.r.length >= g.c;
    return (
      <div key={g.n} className="card" style={{ margin: 0 }}>
        <div className="row sp">
          <b>Group {g.n}</b>
          <span className={`bd ${full ? 'r' : ''}`}>{full ? 'Full' : `${g.c - g.j} slots`}</span>
        </div>
        <div className="mu">
          {g.c} member{g.c > 1 ? 's' : ''} max · {g.j} joined
        </div>
        <div className="price" style={{ fontSize: '20px', color: '#e62e04' }}>
          {K(inst(p.p, g.c))}
          <span className="mu">/day</span>
        </div>
        <div className="mu">
          1st member gets it day 10 · last member day {g.c * 10}
        </div>
        <div style={{ marginTop: '8px' }}>{renderGroupAction(p, g)}</div>
      </div>
    );
  };

  const wishlistIds = state.wishlist || [];
  const isWishlisted = (pid: number) => wishlistIds.includes(pid);

  // Product details
  if (v === 'prod') {
    const p = prod(sel);
    if (!p) return null;
    const discount = dc(p);
    const saved = isWishlisted(p.id);
    const returnTab: Tab = state.role && state.role !== 'member' ? 'wishlist' : 'home';
    return (
      <>
        <PageTop title="Product Details" backTab={returnTab} onBack={() => onGo(returnTab)} />
        <div className="two">
          <div style={{ borderRadius: '14px', overflow: 'hidden', position: 'relative' }}>
            <SquareProductImage p={p} />
            <button
              type="button"
              onClick={() => onOpenProductAI(p.id)}
              aria-label={`Ask Buyoll.AI Assistant about ${p.n}`}
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                background: 'linear-gradient(135deg, #e62e04 0%, #ff6a00 100%)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.45)',
                borderRadius: '999px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 6px 18px rgba(230, 46, 4, 0.35)',
              }}
            >
              <Sparkles size={14} />
              <span>Ask Buyoll.AI Assistant</span>
            </button>
          </div>
          <div>
            <div className="row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span className="price" style={{ fontSize: '28px' }}>
                  {K(p.p)}
                </span>
                <span className="old">{K(p.o)}</span>{' '}
                {discount > 0 && <span className="bd r">-{discount}% OFF</span>}
              </div>
              <button
                type="button"
                className={`btn sm ${saved ? '' : 'o'}`}
                onClick={() => {
                  if (!state.role) {
                    onRequireAuth('member-login', 'Log in or register to save items to your Wishlist');
                    return;
                  }
                  onToggleWishlist(p.id);
                }}
              >
                <Heart size={15} fill={saved ? '#fff' : 'none'} />
                {saved ? 'Saved in Wishlist' : 'Save to Wishlist'}
              </button>
            </div>
            <h2 style={{ fontSize: '22px', margin: '8px 0' }}>{p.n}</h2>
            <p className="mu">
              {p.cat} · {p.stock} in stock
            </p>
            <p style={{ margin: '8px 0' }}>{p.desc}</p>
            <div className="card row">
              <MerchantInitial name={p.m} />
              <div>
                <b>{p.m}</b> <span className="bd">✔ Verified</span>
                <div className="mu">
                  📍 {p.loc} · Till/Paybill: <b>{p.till}</b>
                </div>
              </div>
            </div>
            <div className="card mu">
              💸 Pay little by little: join a group and pay daily for 10 days. Each 10-day round one
              member receives the product, in joining order, until everyone has theirs.
            </div>
          </div>
        </div>
        <h3 style={{ margin: '14px 0 4px' }}>Choose a group (1–10 members)</h3>
        <p className="mu" style={{ marginBottom: '8px' }}>
          Fewer members = higher daily payment but you get the product sooner.
        </p>
        <div className="gcs">{p.g.map((g) => renderGroupCard(p, g))}</div>
      </>
    );
  }

  // Payment Tracking (also shared with Admin view and Lender Read-Only Inspection)
  if (t === 'groups' && v === 'track') {
    const [pid, gn] = String(sel).split(':');
    const p = prod(pid);
    const g = grp(pid, gn);
    if (!p || !g) return null;
    const daily = inst(p.p, g.c);
    const isLenderReadOnly = state.role === 'lender';
    const modMember = g.r.find((x) => x.mod) || g.r[0];
    const im = !isLenderReadOnly && (state.role === 'admin' || Boolean(modMember?.me));
    const isMemberInGroup = !isLenderReadOnly && g.r.some((x) => Boolean(x.me));
    const majorityNeeded = Math.max(1, Math.floor(g.r.length / 2) + 1);
    const groupKey = `${p.id}:${gn}`;
    const currentRules =
      g.rules ||
      'Pay daily on time, respect rotation order, and only invite known, trusted members.';
    const pendingJoinRequests = (state.joinRequests || []).filter(
      (jr) => jr.pid === p.id && jr.gn === gn && jr.st === 'pending'
    );
    const groupLoanRequests = isLenderReadOnly
      ? state.lr.filter((r) => r.st === 'pending' && r.pid === p.id && r.gn === gn)
      : [];
    const allCompletedAllRounds =
      g.r.length === g.c && g.r.every((x) => getMemberTracking(x, g.c).completedAll);
    const allCurrentRoundDone =
      g.r.length === g.c && g.r.every((x) => getMemberTracking(x, g.c).totalPaid >= g.rot * 10);
    const cur = g.done || allCompletedAllRounds ? g.c * 10 : dn(g);
    const mx = g.r.length
      ? Math.max(0, ...g.r.map((x) => getMemberTracking(x, g.c).activeDays))
      : 0;

    return (
      <>
        <PageTop
          title={isLenderReadOnly ? 'Group Inspection (Read-Only)' : 'Payment Tracking'}
          backTab={isLenderReadOnly ? 'home' : 'groups'}
          onBack={() => onGo(isLenderReadOnly ? 'home' : 'groups')}
        />
        {isLenderReadOnly && (
          <div
            className="card"
            style={{ background: '#fff7ed', borderColor: '#fdba74', marginBottom: '10px' }}
          >
            <div className="row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <b>👁️ Lender Read-Only Mode</b>
                <div className="mu" style={{ color: '#7c2d12' }}>
                  You can verify all group members, 10-day payment progress, and rules. Group edits,
                  ticks, and rules remain locked in read-only mode.
                </div>
              </div>
              <button type="button" className="btn o sm" onClick={() => onGo('home')}>
                ← Back to Lender Dashboard
              </button>
            </div>
          </div>
        )}

        {isLenderReadOnly &&
          groupLoanRequests.map((r) => {
            const rawInput = lenderTransferAmounts[r.id];
            const transferAmt =
              rawInput !== undefined && rawInput !== '' ? Math.round(Number(rawInput) || 0) : r.amt;
            const commission = Math.round(Math.max(0, transferAmt) * 0.05);
            const net = Math.max(0, transferAmt - commission);
            const hasBalance = state.lw >= transferAmt && transferAmt >= 50;

            return (
              <div
                key={`lender-transfer-${r.id}`}
                className="card"
                style={{ borderColor: '#fb923c', background: '#fffaf5' }}
              >
                <div className="row sp" style={{ flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <b>
                      💸 Link Wallets &amp; Transfer Loan to {r.by}
                    </b>{' '}
                    <span className="bd p">{r.memberCode || 'BUY-M-000'}</span>
                  </div>
                  <b style={{ color: '#e62e04' }}>Requested: {K(r.amt)}</b>
                </div>
                <div className="mu" style={{ marginTop: '4px', lineHeight: 1.5 }}>
                  📞 Borrower Phone (KYC outside Buyoll): <b>{r.phone || 'Not provided'}</b>
                  <br />
                  🔗 Linked Wallets: <b>Your Lender Wallet ({K(state.lw)})</b> ➔{' '}
                  <b>
                    {r.by}&apos;s Member Wallet ({r.memberCode || 'Member'})
                  </b>
                </div>
                <div className="row" style={{ marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: '170px' }}>
                    <label className="mu" style={{ display: 'block', marginBottom: '2px' }}>
                      Agreed Transfer Loan Amount (KSh)
                    </label>
                    <input
                      type="number"
                      style={{ margin: 0 }}
                      value={rawInput !== undefined ? rawInput : String(r.amt)}
                      onChange={(e) =>
                        setLenderTransferAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                  </div>
                  <div className="mu" style={{ flex: 1.3, minWidth: '210px', fontSize: '12px' }}>
                    Debits Lender Wallet: <b>{K(transferAmt)}</b>
                    <br />
                    5% Commission to Admin (once): <b>{K(commission)}</b>
                    <br />
                    Credited to Borrower Wallet: <b>{K(net)}</b> (active group installments only)
                  </div>
                </div>
                <div className="row" style={{ marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn y sm"
                    onClick={() => {
                      if (!hasBalance) {
                        onOpenDeposit();
                        return;
                      }
                      onDecideLoan?.(r.id, true, transferAmt);
                    }}
                  >
                    {hasBalance
                      ? `💸 Transfer ${K(transferAmt)} Loan Amount`
                      : `Deposit Coins (${K(transferAmt)} needed)`}
                  </button>
                  <button
                    type="button"
                    className="btn o sm"
                    onClick={() => onDecideLoan?.(r.id, false)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}

        <div className="card">
          <b>
            {p.n} at {K(p.p)}
          </b>
          <div className="mu">
            Group {gn} · {g.c} member{g.c > 1 ? 's' : ''} · Daily {K(daily)} · Till/Paybill:{' '}
            <b>{p.till}</b> · Rotation {g.done ? g.c : g.rot} of {g.c}
          </div>
          <div style={{ background: '#f0f0f0', borderRadius: '8px', height: '8px', margin: '8px 0' }}>
            <div
              style={{
                width: `${(cur / (g.c * 10)) * 100}%`,
                background: 'var(--pu)',
                height: '8px',
                borderRadius: '8px',
              }}
            />
          </div>
          <div className="mu">
            Day {cur} of {g.c * 10} · Last member receives on day {g.c * 10}
          </div>
          <div className="mu">
            🛡️ Moderator: <b>{modMember ? modMember.n : 'First member to join'}</b> (first member
            or appointed by group)
            {im ? ' · you manage rules, referrals & payment adherence' : ''}
          </div>
        </div>

        {/* Group Rules & Moderator Governance */}
        <div className="card" style={{ background: '#fffaf5', borderColor: '#fed7aa' }}>
          <div className="row sp" style={{ marginBottom: '4px' }}>
            <b>🛡️ Group Rules &amp; Moderator</b>
            {im && (
              <button
                type="button"
                className="btn o sm"
                onClick={() => {
                  if (editingRulesKey === groupKey) {
                    setEditingRulesKey(null);
                  } else {
                    setRulesDraft(currentRules);
                    setEditingRulesKey(groupKey);
                  }
                }}
              >
                {editingRulesKey === groupKey ? 'Cancel' : 'Edit Rules'}
              </button>
            )}
          </div>
          {editingRulesKey === groupKey ? (
            <div style={{ marginTop: '6px' }}>
              <input
                value={rulesDraft}
                onChange={(e) => setRulesDraft(e.target.value)}
                placeholder="Enter group payment & invitation rules..."
              />
              <button
                type="button"
                className="btn y sm"
                onClick={() => {
                  onUpdateGroupRules(p.id, gn, rulesDraft);
                  setEditingRulesKey(null);
                }}
              >
                Save &amp; Notify Members
              </button>
            </div>
          ) : (
            <p className="mu" style={{ color: '#431407' }}>
              {currentRules}
            </p>
          )}
        </div>

        {/* Moderator Referral Approval Queue */}
        {pendingJoinRequests.length > 0 && (
          <div className="card" style={{ borderColor: '#fdba74', background: '#fff7ed' }}>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <b>🤝 Referred Member Requests ({pendingJoinRequests.length})</b>
              <span className="bd p">Moderator Review</span>
            </div>
            {pendingJoinRequests.map((jr) => (
              <div
                key={jr.id}
                className="tx"
                style={{ flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}
              >
                <div style={{ flex: 1, minWidth: '190px' }}>
                  <b>{jr.memberName}</b>
                  <div className="mu">
                    Referred by: <b>{jr.referredBy}</b>
                    {jr.referralCode ? ` · Code: ${jr.referralCode}` : ''} ·{' '}
                    {jr.knowsMember ? 'Known by member ✓' : 'Unverified'}
                  </div>
                </div>
                {im ? (
                  <div className="row" style={{ gap: '6px' }}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => onDecideJoinRequest(jr.id, true)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn o sm"
                      style={{ color: '#dc2626', borderColor: '#fecaca' }}
                      onClick={() => onDecideJoinRequest(jr.id, false)}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span className="bd p">Awaiting Mod {modMember?.n}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WhatsApp style group ledger */}
        <div className="wa">
          <div>
            <b>
              {p.n} at {p.p}
            </b>
          </div>
          <div>Daily {daily} bob</div>
          <div>
            Deadline for number {g.done ? g.c : g.rot} is {dl(Math.max(0, 10 - mx))}
          </div>
          <br />
          {g.r.map((x, i) => {
            const tr = getMemberTracking(x, g.c);
            const ticks = '✅'.repeat(tr.activeDays);
            const bal =
              tr.activeDays > 0 && tr.activeDays < 10 ? ` *${(10 - tr.activeDays) * daily}` : '';
            const tag = g.done || i < g.rot - 1 ? ' ✔' : i === g.rot - 1 ? ' 🎁' : '';
            const roundLabel = g.c > 1 ? ` [R${tr.activeRound}/${g.c}]` : '';
            return (
              <div key={`${x.n}-${i}`}>
                {i + 1}.{x.mod ? '🆗' : ''}
                {x.pin ? '📌' : ''}
                {x.n}
                {x.me ? ' (you)' : ''}
                {tag}
                <span className="wa2">{roundLabel}</span> {ticks}
                {im && !g.done && !tr.completedAll && (
                  <button className="tkb" onClick={() => onTickMember(p.id, gn, i)}>
                    ＋
                  </button>
                )}
                {tr.completedRounds > 0 && ` 🆑×${tr.completedRounds}`}
                {bal && <span className="wa2">{bal}</span>}
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, g.c - g.r.length) }).map((_, k) => (
            <div key={`empty-${k}`} className="wa2">
              {g.r.length + k + 1}.
            </div>
          ))}
          <br />
          <div>
            Till / Paybill. <u style={{ color: '#25d366' }}>{p.till}</u>
          </div>
        </div>

        <div className="row" style={{ margin: '8px 0' }}>
          <button className="btn o sm" onClick={() => onCopyLedger(p.id, gn)}>
            📋 Copy for WhatsApp
          </button>
        </div>
        <p className="mu">
          🆗 moderator · 📌 reminder · 🆑 round cleared · *balance due this round · 🎁 receives
          product now
        </p>

        {/* Per-member individual 10-day Payment Tracking mechanism */}
        <h3 style={{ marginTop: '14px' }}>Individual Member Payment Tracking</h3>
        <p className="mu">
          Each member has their own 10-day Payment Tracking. When 10 days are over, a new 10-day
          cycle starts automatically until all {g.c} member{g.c > 1 ? 's' : ''} get the product.
        </p>
        {g.r.map((x, i) => {
          const tr = getMemberTracking(x, g.c);
          const gotProduct = g.done || i < g.rot - 1 || tr.completedAll;
          const isCurrentReceiver = !g.done && i === g.rot - 1;
          const isBehind = !tr.completedAll && tr.activeDays < mx;
          const voteCount = g.moderatorVotes?.[x.n] || 0;
          return (
            <div key={`ind-${x.n}-${i}`} className="card">
              <div className="row sp">
                <b>
                  {i + 1}. {x.mod ? '🛡️ ' : ''}
                  {x.n}
                  {x.me ? ' (you)' : ''}
                </b>
                <span className={`bd ${gotProduct ? '' : isCurrentReceiver ? 'p' : ''}`}>
                  {gotProduct
                    ? '✔ Product Received'
                    : isCurrentReceiver
                      ? `🎁 Round ${g.rot} Receiver`
                      : `Round ${tr.activeRound}/${g.c}`}
                </span>
              </div>
              <div className="mu" style={{ marginTop: '4px' }}>
                {tr.completedAll
                  ? `All ${g.c} rounds (${tr.maxDays} days) completed!`
                  : `Current 10-Day Cycle: Round ${tr.activeRound} of ${g.c} · ${tr.activeDays}/10 days paid (${tr.totalPaid}/${tr.maxDays} total days)`}
              </div>
              <div className="mu" style={{ marginTop: '2px' }}>
                {x.mod ? 'Role: Group Moderator' : 'Role: Member'}
                {x.referredBy ? ` · Referred by: ${x.referredBy}` : ''}
                {isBehind ? ' · ⏳ Behind group pace' : ' · ✓ Adhering'}
                {x.pin ? ` · 📌 Reminder active${x.lastRemindedAt ? ` (${x.lastRemindedAt})` : ''}` : ''}
                {x.warnings ? ` · ⚠️ ${x.warnings} warning${x.warnings > 1 ? 's' : ''}` : ''}
              </div>
              <div className="days">
                {Array.from({ length: 10 }).map((_, dIdx) => {
                  const isPaid = tr.completedAll ? true : dIdx < tr.activeDays;
                  return (
                    <i key={dIdx} className={isPaid ? 'd' : ''}>
                      {isPaid ? '✓' : dIdx + 1}
                    </i>
                  );
                })}
              </div>
              {g.c > 1 && (
                <div className="mu" style={{ marginTop: '6px' }}>
                  Rounds:{' '}
                  {tr.rounds
                    .map((daysInRound, rIdx) => `R${rIdx + 1}: ${daysInRound}/10${daysInRound >= 10 ? '✅' : ''}`)
                    .join(' · ')}
                </div>
              )}

              {(im || isMemberInGroup) && (
                <div className="row" style={{ marginTop: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  {im && !tr.completedAll && (
                    <>
                      <button
                        type="button"
                        className="btn o sm"
                        onClick={() => onEnforcePayment(p.id, gn, i, 'remind')}
                      >
                        📌 Remind to Pay
                      </button>
                      <button
                        type="button"
                        className="btn o sm"
                        style={{ color: '#b45309', borderColor: '#fde68a' }}
                        onClick={() => onEnforcePayment(p.id, gn, i, 'warn')}
                      >
                        ⚠️ Warn (Rule)
                      </button>
                      {x.pin && (
                        <button
                          type="button"
                          className="btn o sm"
                          onClick={() => onEnforcePayment(p.id, gn, i, 'clear_pin')}
                        >
                          Clear 📌
                        </button>
                      )}
                    </>
                  )}

                  {!x.mod && (im || isMemberInGroup) && (
                    <button
                      type="button"
                      className="btn o sm"
                      onClick={() => onAppointModerator(p.id, gn, x.n, im)}
                    >
                      {im
                        ? '👑 Appoint Moderator'
                        : g.myModVote === x.n
                          ? `✓ Voted Mod (${voteCount}/${majorityNeeded})`
                          : `👑 Vote Mod (${voteCount}/${majorityNeeded})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {g.r.length < g.c && (
          <p className="mu">{g.c - g.r.length} slot(s) open (max {g.c} members)</p>
        )}

        {g.done ? (
          <div className="card">
            ✅ All members have received the product. Find another product to join.
          </div>
        ) : (
          im &&
          allCurrentRoundDone && (
            <button className="btn y bl" onClick={() => onRotateGroup(p.id, gn)}>
              Complete rotation {g.rot} and hand over product
            </button>
          )
        )}
      </>
    );
  }

  // Product specific group list
  if (t === 'groups' && v === 'list') {
    const p = prod(sel);
    if (!p) return null;
    return (
      <>
        <PageTop title="Groups You Can Join" backTab="groups" onBack={() => onGo('groups')} />
        <div className="card row">
          <ProductThumb p={p} h={70} w="90px" />
          <div>
            <b>{p.n}</b>
            <div className="price">{K(p.p)}</div>
            <span className="mu">
              {p.m} · 📍 {p.loc}
            </span>
          </div>
        </div>
        <div className="gcs">{p.g.map((g) => renderGroupCard(p, g))}</div>
      </>
    );
  }

  // Groups directory
  if (t === 'groups') {
    const lq = groupQuery.toLowerCase();
    const visibleProducts = state.products.filter(
      (p) => isVisible(p) && (p.n + p.m).toLowerCase().includes(lq)
    );

    return (
      <>
        <PageTop title="Groups You Can Join" />
        <input
          placeholder="🔍 Search groups..."
          value={groupQuery}
          onChange={(e) => setGroupQuery(e.target.value)}
        />
        <button
          className="btn o sm"
          onClick={() => {
            if (!state.role) {
              onRequireAuth('member-register', 'Register or sign in to view My Groups');
              return;
            }
            onGo('wallet', 'mine');
          }}
        >
          My Groups ({state.my.length})
        </button>
        <div id="gl">
          {visibleProducts.length ? (
            visibleProducts.map((p) =>
              p.g.map((g) => {
                const m = state.my.find((x) => x.pid === p.id && x.g === g.n);
                return (
                  <div key={`${p.id}-${g.n}`} className="grp">
                    <span
                      style={{
                        fontSize: '26px',
                        background: '#fff1f0',
                        borderRadius: '10px',
                        width: '48px',
                        height: '48px',
                        display: 'grid',
                        placeItems: 'center',
                        flex: 'none',
                      }}
                    >
                      {p.e}
                    </span>
                    <div>
                      <b>
                        Group {g.n} · {p.n}
                      </b>
                      <div className="mu">
                        {m && m.st === 'pending'
                          ? 'Request pending'
                          : g.j
                            ? `${g.j}/${g.c} members`
                            : `Recently added • 0/${g.c} members`}{' '}
                        · {K(inst(p.p, g.c))}/day · cycle {g.c * 10} days
                      </div>
                    </div>
                    {renderGroupAction(p, g)}
                  </div>
                );
              })
            )
          ) : (
            <p className="mu">No groups found</p>
          )}
        </div>
      </>
    );
  }

  // My Groups (under Wallet -> My Groups)
  if (t === 'wallet' && v === 'mine') {
    return (
      <>
        <PageTop title="My Groups" backTab="wallet" onBack={() => onGo('wallet')} />
        {state.my.length ? (
          state.my.map((m, i) => {
            const p = prod(m.pid);
            const g = grp(m.pid, m.g);
            if (!p || !g) return null;
            const me = g.r.find((x) => x.me);
            const pos = me ? g.r.indexOf(me) + 1 : 0;
            const tr = me ? getMemberTracking(me, g.c) : null;
            const daily = inst(p.p, g.c);
            const pendingPayments = state.groupPayments.filter(
              (gp) => gp.pid === p.id && gp.g === m.g && gp.isMe && gp.st === 'pending'
            );

            return (
              <div key={`${m.pid}-${m.g}`} className="card">
                <div className="row sp">
                  <b>{p.n}</b>
                  <span className={`bd ${m.st === 'ok' ? '' : 'p'}`}>
                    {m.st === 'ok' ? 'Active' : 'Pending'}
                  </span>
                </div>
                <div className="mu">
                  Group {m.g} ({g.c} Member{g.c > 1 ? 's' : ''}) · {K(daily)}/day · Owner:{' '}
                  <b>{p.m}</b>
                </div>
                <div className="mu">
                  Till / Paybill: <b style={{ color: '#e62e04' }}>{p.till}</b>
                  {tr && me
                    ? ` · Position ${pos}/${g.c} · Round ${tr.activeRound}/${g.c} (${tr.activeDays}/10 days)`
                    : ''}
                </div>
                {me && tr && (
                  <>
                    <div className="mu">
                      🎁 You receive the product on day <b>{pos * 10}</b> (
                      {Math.max(0, pos * 10 - tr.totalPaid)} personal days /{' '}
                      {Math.max(0, pos * 10 - dn(g))} group days left)
                    </div>
                    <div className="days">
                      {Array.from({ length: 10 }).map((_, dIdx) => {
                        const paid = tr.completedAll ? true : dIdx < tr.activeDays;
                        return (
                          <i key={dIdx} className={paid ? 'd' : ''}>
                            {paid ? '✓' : dIdx + 1}
                          </i>
                        );
                      })}
                    </div>
                  </>
                )}

                {pendingPayments.map((pp) => (
                  <div
                    key={pp.id}
                    className="mu"
                    style={{
                      marginTop: '6px',
                      padding: '6px 8px',
                      background: '#fef9c3',
                      borderRadius: '8px',
                      color: '#713f12',
                    }}
                  >
                    ⏳ Pending merchant approval: Code <b>{pp.code}</b> · {K(pp.amount)} (
                    {pp.daysCount} day{pp.daysCount > 1 ? 's' : ''})
                  </div>
                ))}

                {m.st === 'ok' ? (
                  <div className="row" style={{ marginTop: '8px' }}>
                    <button
                      className="btn y sm"
                      onClick={() => onOpenGroupPayModal(m)}
                      disabled={Boolean(g.done || tr?.completedAll)}
                    >
                      {g.done || tr?.completedAll ? 'Completed' : 'Pay today (wallet)'}
                    </button>
                    <button
                      className="btn o sm"
                      onClick={() => onGo('groups', 'track', `${p.id}:${m.g}`)}
                    >
                      Track
                    </button>
                  </div>
                ) : (
                  (() => {
                    const modName = (g.r.find((x) => x.mod) || g.r[0])?.n || 'Group Moderator';
                    const pendingJoin = (state.joinRequests || []).find(
                      (jr) => jr.pid === p.id && jr.gn === m.g && jr.isMe && jr.st === 'pending'
                    );
                    return (
                      <div
                        className="mu"
                        style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: '#fff7ed',
                          borderRadius: '8px',
                          color: '#7c2d12',
                        }}
                      >
                        ⏳ Waiting for Moderator <b>{modName}</b> to accept your referral request
                        {pendingJoin?.referredBy ? ` (Referred by: ${pendingJoin.referredBy})` : ''}.
                        <div style={{ marginTop: '6px' }}>
                          <button
                            type="button"
                            className="btn o sm"
                            onClick={() => onGo('groups', 'track', `${p.id}:${m.g}`)}
                          >
                            View Group
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })
        ) : (
          <p className="mu card">You have not joined any group yet.</p>
        )}
      </>
    );
  }

  // My Loans
  if (t === 'wallet' && v === 'loans') {
    const myReqs = state.lr.filter((r) => r.me);
    return (
      <>
        <PageTop title="My Loans" backTab="wallet" onBack={() => onGo('wallet')} />
        <div className="card">
          <div className="row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <b>Simple Group Loan Request</b>
              {state.memberCode && (
                <span className="bd p" style={{ marginLeft: '6px' }}>
                  Code: {state.memberCode}
                </span>
              )}
              <div className="mu" style={{ marginTop: '4px' }}>
                Post your request once and <b>all Buyoll lenders</b> see your Name, Member Code,
                Phone, and Group Link globally. KYC &amp; terms are agreed outside Buyoll. A 5%
                platform commission is deducted once on disbursement; loan funds can only pay
                installments in your active groups (non-withdrawable).
              </div>
            </div>
            <button type="button" className="btn y sm" onClick={() => onOpenLoanModal(0)}>
              💸 Request a Loan
            </button>
          </div>
        </div>

        <h3>Buyoll Lenders</h3>
        {(state.lenders || LN).map((l) => (
          <div key={l.id} className="grp">
            <MerchantInitial name={l.n} />
            <div>
              <b>{l.n}</b>
              <div className="mu">
                📍 {l.loc} · {l.range}
              </div>
            </div>
            <button className="btn sm" onClick={() => onOpenLoanModal(l.id)}>
              Request
            </button>
          </div>
        ))}
        <h3 style={{ marginTop: '12px' }}>My loan requests</h3>
        {myReqs.length ? (
          myReqs.map((r) => (
            <div key={r.id} className="grp">
              <div>
                <b>{K(r.amt)}</b> ·{' '}
                {r.lenderName ||
                  (r.lender ? (state.lenders || LN).find((l) => l.id === r.lender)?.n : 'All Buyoll Lenders')}
                <div className="mu">
                  {r.ctx}
                  {r.phone ? ` · 📞 ${r.phone}` : ''}
                  {r.st === 'approved' && r.netAmt
                    ? ` · Credited ${K(r.netAmt)} (5% fee ${K(r.commissionAmt || 0)})`
                    : ''}
                </div>
              </div>
              <span
                className={`bd ${r.st === 'declined' ? 'r' : r.st === 'pending' ? 'p' : ''}`}
              >
                {r.st}
              </span>
            </div>
          ))
        ) : (
          <p className="mu">No requests yet.</p>
        )}
      </>
    );
  }

  // Guest Wallet / Wishlist / Profile prompt when not signed in
  if (!state.role && (t === 'wallet' || t === 'profile' || t === 'wishlist')) {
    return (
      <>
        <PageTop
          title={
            t === 'wallet'
              ? 'Private Member Wallet'
              : t === 'wishlist'
                ? 'My Wishlist'
                : 'Profile, Sign Up, Login & Settings'
          }
        />
        <div className="card">
          <h3>
            {t === 'wallet'
              ? 'Private Wallet (Login Required)'
              : t === 'wishlist'
                ? 'Personal Wishlist (Login Required)'
                : 'Sign Up / Register & Login'}
          </h3>
          <p className="mu" style={{ margin: '6px 0 12px' }}>
            Browsing the Shop is open to everyone. Register or log in to save products to your
            personalized Wishlist, access your private wallet, and join groups.
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn y sm" onClick={() => onRequireAuth('member-register')}>
              Sign Up / Register
            </button>
            <button type="button" className="btn sm" onClick={() => onRequireAuth('member-login')}>
              Member Login
            </button>
          </div>
        </div>
        <div className="card">
          <h3>Private Dashboards (Sign Up &amp; Login)</h3>
          <p className="mu" style={{ margin: '4px 0 10px' }}>
            Merchant, Lender, and Admin dashboards are private — create a unique username and password or log in.
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn o sm" onClick={() => onRequireAuth('merchant-register')}>
              Merchant Sign Up
            </button>
            <button type="button" className="btn o sm" onClick={() => onRequireAuth('merchant')}>
              Merchant Login
            </button>
            <button type="button" className="btn o sm" onClick={() => onRequireAuth('lender-register')}>
              Lender Sign Up
            </button>
            <button type="button" className="btn o sm" onClick={() => onRequireAuth('lender')}>
              Lender Login
            </button>
            <button type="button" className="btn o sm" onClick={() => onRequireAuth('admin')}>
              Admin Login
            </button>
          </div>
        </div>
        {t === 'profile' && <ProfileSettingsPanel role={null} />}
      </>
    );
  }

  if (t === 'wishlist' && state.role) {
    return (
      <WishlistView
        state={state}
        onGo={onGo}
        onToggleWishlist={onToggleWishlist}
        onViewProduct={(pid) => onGo('home', 'prod', pid)}
      />
    );
  }

  // Wallet home
  if (t === 'wallet') {
    return (
      <>
        <WalletView state={state} bal={state.wallet} onOpenDeposit={onOpenDeposit} />
        <h3>Quick Actions</h3>
        <div className="stats" style={{ marginTop: '8px' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => onGo('wallet', 'mine')}>
            👥
            <br />
            My Groups
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => onGo('wishlist')}>
            ❤️
            <br />
            Wishlist ({wishlistIds.length})
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => onGo('wallet', 'loans')}>
            🤝
            <br />
            My Loans
          </div>
        </div>
        <button
          type="button"
          className="btn o bl"
          style={{ marginTop: '8px' }}
          onClick={onShowReport}
        >
          📄 View Transactions Report
        </button>
        <div className="ban row" style={{ padding: '12px', marginTop: '12px' }}>
          🎁{' '}
          <div>
            <b>Grow Together</b>
            <div className="mu" style={{ color: '#fff' }}>
              Invite friends and earn rewards!
            </div>
          </div>
        </div>
      </>
    );
  }

  if (t === 'profile') {
    return (
      <ProfileView
        name={state.name}
        role="member"
        walletBalance={state.wallet}
        wishlistCount={wishlistIds.length}
        onOpenWallet={() => onGo('wallet')}
        onOpenWishlist={() => onGo('wishlist')}
        onRequireAuth={onRequireAuth}
        onLogout={onLogout}
        onReset={onReset}
      />
    );
  }

  // Shop / Home feed
  const lq = (state.q || '').toLowerCase();
  const visibleCatalog = state.products.filter(isVisible);
  const featuredProducts = visibleCatalog.filter(
    (p) => state.feat.includes(p.id) || Boolean(p.featured)
  );
  const promotedProducts = visibleCatalog.filter(
    (p) => (state.promo || []).includes(p.id) || Boolean(p.promoted)
  );
  const filteredProducts = visibleCatalog
    .filter(
      (p) =>
        (state.mf === 'All' || p.m === state.mf) &&
        (state.cf === 'All' || p.cat === state.cf) &&
        `${p.n} ${p.m} ${p.cat} ${p.loc}`.toLowerCase().includes(lq)
    )
    .sort((a, b) => {
      const aScore = (state.feat.includes(a.id) || a.featured ? 2 : 0) + ((state.promo || []).includes(a.id) || a.promoted ? 1 : 0);
      const bScore = (state.feat.includes(b.id) || b.featured ? 2 : 0) + ((state.promo || []).includes(b.id) || b.promoted ? 1 : 0);
      return bScore - aScore;
    });

  return (
    <>
      <div className="ban">
        <div className="row sp" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <h2>{state.banner}</h2>
            <p style={{ margin: '4px 0 10px' }} className="mu">
              Chamaa &amp; Lipa Mdogo Mdogo marketplace
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn y sm" onClick={() => onGo('groups')}>
                Browse groups →
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ background: '#ffffff26', border: '1px solid #ffffff44', color: '#fff' }}
                onClick={() => onRequireAuth('merchant', 'Sign in as Merchant to pay for Featured or Promotional placement')}
              >
                📣 Merchant Promote (Paid)
              </button>
            </div>
          </div>
        </div>

        {/* Single unified Search Mode in the Hero section */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search products, merchants, categories, or Till numbers"
            className="flex items-center gap-2.5 w-full bg-white text-[#191919] rounded-xl px-3.5 py-2.5 text-sm shadow-sm cursor-pointer border-0 text-left hover:bg-[#fffdf7]"
          >
            <Search size={17} className="text-[#e62e04] shrink-0" />
            <span className={state.q ? 'font-semibold text-[#191919] truncate' : 'text-[#757575] truncate'}>
              {state.q ? state.q : 'Search products, merchant names, categories, or Till/Paybill...'}
            </span>
          </button>
          {state.q && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="btn y sm shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Hero Featured & Promotional Items (Paid Merchant Placements) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="bg-white/95 text-[#191919] rounded-xl p-3">
            <div className="row sp" style={{ marginBottom: '8px' }}>
              <b className="text-[13px] text-[#191919]">⭐ Featured Items</b>
              <span className="bd p" style={{ fontSize: '10px' }}>
                Paid Spotlight
              </span>
            </div>
            {featuredProducts.length ? (
              <div className="grid grid-cols-2 gap-2">
                {featuredProducts.slice(0, 4).map((p) => (
                  <div
                    key={`feat-${p.id}`}
                    onClick={() => onGo('home', 'prod', p.id)}
                    className="border border-[#ebebeb] rounded-lg p-2 cursor-pointer hover:shadow-sm bg-white flex flex-col gap-1"
                  >
                    <ProductThumb p={p} h={72} />
                    <div className="text-[12px] font-bold leading-tight line-clamp-1">{p.n}</div>
                    <div className="text-[12px] font-extrabold text-[#fd384f]">{K(p.p)}</div>
                    <div className="text-[10px] text-[#757575] truncate">🏪 {p.m}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mu">Merchants can pay in Merchant Zone to feature items here.</p>
            )}
          </div>

          <div className="bg-white/95 text-[#191919] rounded-xl p-3">
            <div className="row sp" style={{ marginBottom: '8px' }}>
              <b className="text-[13px] text-[#191919]">🔥 Promotional Items</b>
              <span className="bd r" style={{ fontSize: '10px' }}>
                Sponsored Deals
              </span>
            </div>
            {promotedProducts.length ? (
              <div className="grid grid-cols-2 gap-2">
                {promotedProducts.slice(0, 4).map((p) => {
                  const discount = dc(p);
                  return (
                    <div
                      key={`promo-${p.id}`}
                      onClick={() => onGo('home', 'prod', p.id)}
                      className="border border-[#fecaca] rounded-lg p-2 cursor-pointer hover:shadow-sm bg-white flex flex-col gap-1"
                    >
                      <div className="relative">
                        <ProductThumb p={p} h={72} />
                        {discount > 0 && (
                          <span
                            className="bd r"
                            style={{ position: 'absolute', top: '4px', left: '4px', fontSize: '10px', padding: '1px 5px' }}
                          >
                            -{discount}%
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] font-bold leading-tight line-clamp-1">{p.n}</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[12px] font-extrabold text-[#fd384f]">{K(p.p)}</span>
                        {p.o > p.p && (
                          <span className="text-[10px] line-through text-[#999]">{K(p.o)}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#757575] truncate">🏪 {p.m}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mu">Merchants can pay in Merchant Zone to promote deals here.</p>
            )}
          </div>
        </div>
      </div>

      <div className="steps">
        <div>
          🛍️
          <br />
          <b>1. Pick a product</b>
        </div>
        <div>
          👥
          <br />
          <b>2. Join a group</b>
        </div>
        <div>
          💸
          <br />
          <b>3. Pay daily, 10 days</b>
        </div>
      </div>

      {/* Private Member Wallet & Wishlist moved into Member's individual dashboard */}
      {state.role === 'member' && (
        <div className="card row sp" style={{ flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
          <div>
            <div className="mu">Private Member Dashboard</div>
            <b style={{ fontSize: '20px', color: '#191919' }}>{K(state.wallet)}</b>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn y sm" onClick={() => onGo('wallet')}>
              👛 My Wallet
            </button>
            <button type="button" className="btn o sm" onClick={() => onGo('wishlist')}>
              ❤️ Wishlist ({wishlistIds.length})
            </button>
            <button type="button" className="btn o sm" onClick={() => onGo('wallet', 'mine')}>
              👥 My Groups ({state.my.length})
            </button>
            <button type="button" className="btn o sm" onClick={() => onGo('wallet', 'loans')}>
              🤝 Loans
            </button>
            <button type="button" className="btn o sm" onClick={onOpenDeposit}>
              ⬆ Deposit
            </button>
          </div>
        </div>
      )}

      <div className="row sp" style={{ margin: '14px 0 8px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="row" style={{ overflowX: 'auto', flex: 1 }}>
          {CATS.map((c) => (
            <button
              key={c}
              className={`btn sm ${state.cf === c ? '' : 'o'}`}
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => onCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          style={{ width: 'auto', margin: 0 }}
          value={state.mf}
          onChange={(e) => onMerchantFilter(e.target.value)}
        >
          <option value="All">All merchants</option>
          {merchants.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="row sp">
        <h3>Latest announcements</h3>
        <span className="mu">{merchants.length} merchants</span>
      </div>

      <div className="pg" id="pf" style={{ marginTop: '8px' }}>
        {filteredProducts.length ? (
          filteredProducts.map((p) => {
            const discount = dc(p);
            const openCount = p.g.filter((g) => g.j < g.c).length;
            const saved = isWishlisted(p.id);
            return (
              <div key={p.id} className="pc" onClick={() => onGo('home', 'prod', p.id)}>
                <div className="ph">
                  <SquareProductImage p={p} />
                  {(state.feat.includes(p.id) || p.featured) && (
                    <span className="bg" style={{ left: 'auto', right: '8px', background: '#f59e0b' }}>
                      ⭐
                    </span>
                  )}
                  {((state.promo || []).includes(p.id) || p.promoted) && (
                    <span
                      className="bg"
                      style={{
                        left: 'auto',
                        right: state.feat.includes(p.id) || p.featured ? '38px' : '8px',
                        background: '#e62e04',
                      }}
                    >
                      🔥
                    </span>
                  )}
                  {discount > 0 && <span className="bg">-{discount}%</span>}
                  <button
                    type="button"
                    aria-label={saved ? `Remove ${p.n} from Wishlist` : `Save ${p.n} to Wishlist`}
                    title={saved ? 'Saved in Wishlist' : 'Save to Wishlist'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!state.role) {
                        onRequireAuth('member-login', 'Log in or register to save items to your Wishlist');
                        return;
                      }
                      onToggleWishlist(p.id);
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      border: '1px solid rgba(0,0,0,0.08)',
                      background: 'rgba(255,255,255,0.92)',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.14)',
                    }}
                  >
                    <Heart
                      size={15}
                      color={saved ? '#e62e04' : '#555'}
                      fill={saved ? '#e62e04' : 'none'}
                    />
                  </button>
                </div>
                <div className="bd2">
                  <div className="nm">{p.n}</div>
                  <div>
                    <span className="price" style={{ fontSize: '18px' }}>
                      {K(p.p)}
                    </span>
                    <span className="old">{K(p.o)}</span>
                  </div>
                  <div className="mu" style={{ color: '#e62e04', fontWeight: 700 }}>
                    from {K(Math.ceil(p.p / 100))}/day · {openCount} groups open
                  </div>
                  <div className="mu">
                    🏪 {p.m}
                    <br />
                    📍 {p.loc.split(',')[0]}
                  </div>
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid #f1f1f1',
                    }}
                  >
                    <button
                      type="button"
                      className="btn o sm bl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProductAI(p.id);
                      }}
                      style={{
                        borderColor: '#fed7aa',
                        background: '#fff7ed',
                        color: '#c2410c',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      <Sparkles size={13} /> Ask Buyoll.AI
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="mu">No products found</p>
        )}
      </div>
    </>
  );
};
