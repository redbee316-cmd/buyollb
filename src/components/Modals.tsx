import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LN, PL, PROMO_TIERS, type PromoTierId } from '../utils/defaults';
import type { LenderInfo, MyGroupEntry, NotificationItem, Product } from '../types/buyoll';
import { CATS, K, inst } from '../utils/format';

export type ActiveModal =
  | { type: 'notifications' }
  | { type: 'deposit' }
  | { type: 'join'; pid: number; gn: string }
  | { type: 'groupPay'; entry: MyGroupEntry }
  | { type: 'loan'; lenderId: number }
  | { type: 'upload' }
  | { type: 'subscribe' }
  | { type: 'promote'; pid: number }
  | { type: 'declineDeposit'; id: number }
  | { type: 'copyText'; text: string }
  | null;

interface ModalsProps {
  modal: ActiveModal;
  onClose: () => void;
  isGuest?: boolean;
  onGoToProfile?: () => void;
  tillGlobal: string;
  merchantWallet?: number;
  memberWallet?: number;
  loanCredit?: number;
  notifications: NotificationItem[];
  products: Product[];
  myGroups: MyGroupEntry[];
  lenders?: LenderInfo[];
  onSubmitDeposit: (code: string, amt: number, phone: string) => Promise<string | void>;
  onSubmitJoin: (
    pid: number,
    gn: string,
    referral?: { referredBy: string; referralCode?: string; knowsMember: boolean }
  ) => void;
  onClearReadNotifications: () => void;
  onSubmitGroupPayment: (
    pid: number,
    gn: string,
    code: string,
    amount: number,
    payMethod: 'wallet' | 'mpesa'
  ) => Promise<string | void>;
  onSubmitLoan: (payload: {
    lenderId: number;
    amt: number;
    pid?: number;
    gn?: string;
    ctx: string;
    phone?: string;
  }) => Promise<string | void>;
  onSubmitUpload: (data: {
    n: string;
    cat: string;
    p: number;
    o: number;
    stock: number;
    loc: string;
    till: string;
    desc: string;
    img?: string;
    spotlightTier?: 'none' | 'featured' | 'promoted' | 'both';
  }) => Promise<string | void>;
  onSubmitSubscribe: (planIndex: number) => Promise<string | void>;
  onSubmitPromote: (pid: number, tier: PromoTierId) => Promise<string | void>;
  onConfirmDeclineDeposit: (id: number, reason: string) => void;
  onOpenDeposit?: () => void;
  onToast: (msg: string) => void;
}

export const Modals: React.FC<ModalsProps> = ({
  modal,
  onClose,
  isGuest = false,
  onGoToProfile,
  tillGlobal,
  merchantWallet = 0,
  memberWallet = 0,
  loanCredit = 0,
  notifications,
  products,
  myGroups,
  lenders,
  onSubmitDeposit,
  onSubmitJoin,
  onClearReadNotifications,
  onSubmitGroupPayment,
  onSubmitLoan,
  onSubmitUpload,
  onSubmitSubscribe,
  onSubmitPromote,
  onConfirmDeclineDeposit,
  onOpenDeposit,
  onToast,
}) => {
  const [depCode, setDepCode] = useState('');
  const [depAmt, setDepAmt] = useState('');
  const [depPhone, setDepPhone] = useState('');
  const [depNote, setDepNote] = useState('');

  const [referredBy, setReferredBy] = useState('');
  const [refCode, setRefCode] = useState('');
  const [knowsMember, setKnowsMember] = useState(true);

  const [payCode, setPayCode] = useState('');
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState<'wallet' | 'mpesa'>('mpesa');

  const [loanAmt, setLoanAmt] = useState('');
  const [loanCtx, setLoanCtx] = useState('');
  const [loanGroupKey, setLoanGroupKey] = useState('');
  const [loanPhone, setLoanPhone] = useState('');
  const [loanPreferredLender, setLoanPreferredLender] = useState(0);

  const [upName, setUpName] = useState('');
  const [upCat, setUpCat] = useState<string>(CATS[1]);
  const [upPrice, setUpPrice] = useState('');
  const [upOldPrice, setUpOldPrice] = useState('');
  const [upStock, setUpStock] = useState('10');
  const [upLoc, setUpLoc] = useState('Tom Mboya St, Nairobi CBD');
  const [upTill, setUpTill] = useState('542100');
  const [upDesc, setUpDesc] = useState('');
  const [upImgUrl, setUpImgUrl] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [upWantFeatured, setUpWantFeatured] = useState(false);
  const [upWantPromoted, setUpWantPromoted] = useState(false);

  const [decReason, setDecReason] = useState('');

  useEffect(() => {
    setDepCode('');
    setDepAmt('');
    setDepPhone('');
    setDepNote('');
    setReferredBy('');
    setRefCode('');
    setKnowsMember(true);
    setPayCode('');
    setPayAmt('');
    if (modal?.type === 'groupPay') {
      const p = products.find((x) => x.id === modal.entry.pid);
      const g = p?.g.find((x) => x.n === modal.entry.g);
      const daily = p && g ? inst(p.p, g.c) : 0;
      setPayMethod(memberWallet >= daily && daily > 0 ? 'wallet' : 'mpesa');
    } else {
      setPayMethod('mpesa');
    }
    setLoanAmt('');
    setLoanCtx('');
    if (modal?.type === 'loan') {
      const firstActive = myGroups.find((m) => m.st === 'ok');
      setLoanGroupKey(firstActive ? `${firstActive.pid}:${firstActive.g}` : '');
      setLoanPreferredLender(modal.lenderId || 0);
    } else {
      setLoanGroupKey('');
      setLoanPreferredLender(0);
    }
    setLoanPhone('');
    setUpName('');
    setUpCat(CATS[1]);
    setUpPrice('');
    setUpOldPrice('');
    setUpStock('10');
    setUpLoc('Tom Mboya St, Nairobi CBD');
    setUpTill('542100');
    setUpDesc('');
    setUpImgUrl('');
    setUploadingImg(false);
    setUpWantFeatured(false);
    setUpWantPromoted(false);
    setDecReason('');
  }, [modal, memberWallet, myGroups, products]);

  if (!modal) return null;

  const renderContent = () => {
    switch (modal.type) {
      case 'notifications': {
        const hasRead = notifications.some((n) => n.s === 1);
        const categoryMeta: Record<string, string> = {
          payment: '💳 Payment',
          approval: '✅ Approval',
          group: '👥 Group',
          loan: '🤝 Loan',
          moderation: '🛡️ Moderator',
          system: '🔔 Alert',
        };
        return (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3>🔔 Private Notifications</h3>
              <div className="row" style={{ gap: '6px' }}>
                {!isGuest && hasRead && (
                  <button
                    type="button"
                    className="btn o sm"
                    onClick={onClearReadNotifications}
                  >
                    Clear Read
                  </button>
                )}
                <button type="button" className="btn o sm" onClick={onClose}>
                  ✕
                </button>
              </div>
            </div>
            {isGuest ? (
              <div style={{ paddingTop: '6px' }}>
                <p className="mu" style={{ marginBottom: '10px' }}>
                  Notifications on Buyoll are strictly private per account. Register or log in inside{' '}
                  <b>👤 Profile</b> to see your personal group, payment, loan, and store alerts.
                </p>
                {onGoToProfile && (
                  <button
                    type="button"
                    className="btn y bl"
                    onClick={() => {
                      onClose();
                      onGoToProfile();
                    }}
                  >
                    Open Profile (Sign Up / Login)
                  </button>
                )}
              </div>
            ) : notifications.length ? (
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.slice(0, 20).map((x, idx) => (
                  <div key={x.id || idx} className="tx" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="row sp" style={{ marginBottom: '2px' }}>
                        <span className="bd" style={{ fontSize: '10px' }}>
                          {categoryMeta[x.category || 'system'] || '🔔 Alert'}
                        </span>
                        <span className="mu" style={{ fontSize: '11px' }}>
                          {!x.s ? '🔵 New' : 'Read'}
                          {x.createdAt ? ` · ${x.createdAt}` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px' }}>{x.t}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mu">No private notifications yet.</p>
            )}
          </>
        );
      }

      case 'deposit':
        return (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3>Deposit via Manual M-Pesa</h3>
              <button type="button" className="btn o sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <p className="mu">
              Send money via M-Pesa to Till <b>{tillGlobal}</b>, then enter your transaction code
              below. The Admin authenticates your payment before crediting your private wallet.
            </p>
            <input
              placeholder="M-Pesa code e.g. QF9387421"
              value={depCode}
              onChange={(e) => setDepCode(e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount paid (KSh)"
              value={depAmt}
              onChange={(e) => setDepAmt(e.target.value)}
            />
            <input
              placeholder="Phone used to pay"
              value={depPhone}
              onChange={(e) => setDepPhone(e.target.value)}
            />
            <input
              placeholder="Note (optional)"
              value={depNote}
              onChange={(e) => setDepNote(e.target.value)}
            />
            <button
              className="btn y bl"
              onClick={async () => {
                if (!depCode.trim() || !depAmt.trim() || !depPhone.trim()) {
                  onToast('Fill code, amount and phone');
                  return;
                }
                const err = await onSubmitDeposit(
                  depCode.trim().toUpperCase(),
                  Number(depAmt),
                  depPhone.trim()
                );
                if (err) {
                  onToast(err);
                  return;
                }
                onClose();
              }}
            >
              Process
            </button>
          </>
        );

      case 'join': {
        const p = products.find((x) => x.id === modal.pid);
        if (!p) return null;
        const g = p.g.find((x) => x.n === modal.gn);
        const isFirstMember = !g || g.r.length === 0;
        const currentMod = g ? g.r.find((m) => m.mod) || g.r[0] : undefined;
        return (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3>Join Group {modal.gn}?</h3>
              <button type="button" className="btn o sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <p className="mu">
              {p.n} · {p.m} ({g?.c} member{g && g.c > 1 ? 's' : ''} max)
            </p>
            {isFirstMember ? (
              <div className="card" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                <b>🛡️ You will become the Group Moderator</b>
                <p className="mu" style={{ marginTop: '4px' }}>
                  As the first member to enter this group, you assume the Moderator role — you will
                  enforce group rules, monitor fellow members&apos; payments, and approve future referred
                  members.
                </p>
              </div>
            ) : (
              <>
                <p className="mu" style={{ margin: '6px 0' }}>
                  Moderator <b>{currentMod?.n}</b> must verify who referred you and confirm that a
                  group member knows you before accepting your request.
                </p>
                <label className="mu">Who referred you? (Required — Member name who knows you)</label>
                <input
                  placeholder={`e.g. ${currentMod?.n || 'Amina'} (name of inviting member)`}
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                />
                <label className="mu">Referral code (Optional)</label>
                <input
                  placeholder="Referral code e.g. BUY-AMINA"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                />
                <label
                  className="row"
                  style={{ gap: '8px', margin: '6px 0 10px', cursor: 'pointer', fontSize: '13px' }}
                >
                  <input
                    type="checkbox"
                    checked={knowsMember}
                    onChange={(e) => setKnowsMember(e.target.checked)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <span>A member in this group personally knows me and vouches for me</span>
                </label>
              </>
            )}
            <button
              className="btn y bl"
              onClick={() => {
                if (!isFirstMember) {
                  if (referredBy.trim().length < 2) {
                    onToast('Enter the name of the member who referred you');
                    return;
                  }
                  if (!knowsMember) {
                    onToast('Confirm that a member in this group knows you');
                    return;
                  }
                }
                onSubmitJoin(
                  modal.pid,
                  modal.gn,
                  isFirstMember
                    ? undefined
                    : {
                        referredBy: referredBy.trim(),
                        referralCode: refCode.trim() || undefined,
                        knowsMember,
                      }
                );
                onClose();
              }}
            >
              {isFirstMember ? 'Join as First Member & Moderator' : 'Send Referral Request to Moderator'}
            </button>
          </>
        );
      }

      case 'groupPay': {
        const p = products.find((x) => x.id === modal.entry.pid);
        const g = p?.g.find((x) => x.n === modal.entry.g);
        if (!p || !g) return null;
        const daily = inst(p.p, g.c);
        const effectiveAmt = payAmt !== '' ? payAmt : String(daily);
        const numericAmt = Number(effectiveAmt);
        const canAffordWallet = memberWallet >= numericAmt && numericAmt >= daily;

        return (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3>Pay Today — Group {g.n}</h3>
              <button type="button" className="btn o sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <p className="mu">
              {p.n} · Owner: <b>{p.m}</b> · Daily: <b>{K(daily)}</b>/day
            </p>

            <div className="row" style={{ gap: '8px', margin: '10px 0' }}>
              <button
                type="button"
                className={`btn sm ${payMethod === 'wallet' ? 'y' : 'o'}`}
                style={{ flex: 1 }}
                onClick={() => setPayMethod('wallet')}
              >
                👛 Wallet / Loan ({K(memberWallet)})
              </button>
              <button
                type="button"
                className={`btn sm ${payMethod === 'mpesa' ? 'y' : 'o'}`}
                style={{ flex: 1 }}
                onClick={() => setPayMethod('mpesa')}
              >
                📱 M-Pesa Till
              </button>
            </div>

            {payMethod === 'wallet' ? (
              <div
                className="card"
                style={{
                  background: '#fff7ed',
                  borderColor: '#fed7aa',
                  margin: '8px 0 10px',
                }}
              >
                <div className="row sp">
                  <b>Private Member Wallet</b>
                  <b>{K(memberWallet)}</b>
                </div>
                {loanCredit > 0 && (
                  <div className="mu" style={{ color: '#9a3412', marginTop: '4px' }}>
                    🔒 Includes <b>{K(loanCredit)}</b> borrowed loan credit (valid only for active
                    group product installments; non-withdrawable).
                  </div>
                )}
                <div className="mu" style={{ marginTop: '4px' }}>
                  Paying from your wallet instantly credits {p.m} and check-marks your 10-day
                  tracking automatically.
                </div>
              </div>
            ) : (
              <>
                <div
                  className="card"
                  style={{
                    background: '#fff5f5',
                    borderColor: '#fecaca',
                    margin: '10px 0',
                    textAlign: 'center',
                  }}
                >
                  <div className="mu">Pay to Product Owner Till / Paybill</div>
                  <div
                    style={{ fontSize: '26px', fontWeight: 800, color: '#e62e04', margin: '4px 0' }}
                  >
                    {p.till}
                  </div>
                  <div className="mu">
                    Daily instalment: <b>{K(daily)}</b>/day
                  </div>
                </div>
                <label className="mu">Payment Code (M-Pesa Transaction Code)</label>
                <input
                  placeholder="Enter payment code e.g. QF9387421"
                  value={payCode}
                  onChange={(e) => setPayCode(e.target.value)}
                />
              </>
            )}

            <label className="mu">Payment Amount (KSh)</label>
            <input
              type="number"
              placeholder={`Amount paid (min ${daily})`}
              value={effectiveAmt}
              onChange={(e) => setPayAmt(e.target.value)}
            />

            {payMethod === 'mpesa' && (
              <p className="mu" style={{ marginBottom: '8px' }}>
                Once you pay and submit, {p.m} will approve the payment and it will be automatically
                check-marked on Payment Tracking.
              </p>
            )}

            <button
              className="btn y bl"
              onClick={async () => {
                const amt = Number(effectiveAmt);
                if (!amt || amt < daily) {
                  onToast(`Minimum daily payment is ${K(daily)}`);
                  return;
                }
                if (payMethod === 'wallet') {
                  if (!canAffordWallet) {
                    onToast(
                      `Insufficient wallet balance (${K(amt)} required, available ${K(memberWallet)}). Deposit or request a loan.`
                    );
                    return;
                  }
                  const err = await onSubmitGroupPayment(p.id, g.n, '', amt, 'wallet');
                  if (err) {
                    onToast(err);
                    return;
                  }
                  onClose();
                  return;
                }
                const code = payCode.trim().toUpperCase();
                if (!code) {
                  onToast('Enter the M-Pesa payment code');
                  return;
                }
                const err = await onSubmitGroupPayment(p.id, g.n, code, amt, 'mpesa');
                if (err) {
                  onToast(err);
                  return;
                }
                onClose();
              }}
            >
              {payMethod === 'wallet'
                ? `Pay ${K(numericAmt || daily)} from Wallet Now`
                : 'Submit Payment for Approval'}
            </button>
          </>
        );
      }

      case 'loan': {
        const allLenders = lenders || LN;
        const activeMy = myGroups.filter((m) => m.st === 'ok');
        const numericAmt = Math.round(Number(loanAmt) || 0);
        const feePreview = numericAmt > 50 ? Math.round(numericAmt * 0.05) : 0;

        return (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3>Request a Group Loan</h3>
              <button type="button" className="btn o sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <p className="mu" style={{ marginBottom: '8px' }}>
              Your request appears globally on the <b>Lender Dashboard</b> for all Buyoll lenders.
              Lenders inspect your active group (read-only), verify KYC &amp; repayment terms with
              you outside Buyoll, and transfer funds to your Member Wallet.
            </p>

            {activeMy.length === 0 ? (
              <div className="card" style={{ background: '#fff5f5', borderColor: '#fecaca' }}>
                <b>Join an active group first</b>
                <p className="mu" style={{ marginTop: '4px' }}>
                  Lenders require a group link to inspect your active group before disbursing a
                  loan. Join any product group first, then request your loan.
                </p>
              </div>
            ) : (
              <>
                <label className="mu">Active Group (linked for lender inspection)</label>
                <select value={loanGroupKey} onChange={(e) => setLoanGroupKey(e.target.value)}>
                  {activeMy.map((m) => {
                    const pr = products.find((x) => x.id === m.pid);
                    const label = `${pr?.n || 'Product'} · Group ${m.g}`;
                    return (
                      <option key={`${m.pid}-${m.g}`} value={`${m.pid}:${m.g}`}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <label className="mu">Your Phone Number (for Lender KYC outside Buyoll)</label>
                <input
                  placeholder="e.g. 0712345678"
                  value={loanPhone}
                  onChange={(e) => setLoanPhone(e.target.value)}
                />

                <label className="mu">Requested Loan Amount (KSh)</label>
                <input
                  type="number"
                  placeholder="Amount (e.g. 1500)"
                  value={loanAmt}
                  onChange={(e) => setLoanAmt(e.target.value)}
                />

                <label className="mu">Preferred Lender (Optional — all lenders see request)</label>
                <select
                  value={loanPreferredLender}
                  onChange={(e) => setLoanPreferredLender(Number(e.target.value))}
                >
                  <option value={0}>Any Available Lender (Global Board)</option>
                  {allLenders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.n} ({l.loc} · {l.range})
                    </option>
                  ))}
                </select>

                <label className="mu">Note / Repayment Plan Summary (Optional)</label>
                <input
                  placeholder="e.g. For 5 daily installments in Group J"
                  value={loanCtx}
                  onChange={(e) => setLoanCtx(e.target.value)}
                />

                <div
                  className="card mu"
                  style={{ background: '#fff7ed', borderColor: '#fed7aa', marginBottom: '10px' }}
                >
                  <b>5% Platform Commission:</b> Deducted once on disbursement (
                  <b>{K(feePreview)}</b> fee → <b>{K(Math.max(0, numericAmt - feePreview))}</b> net
                  credited). Borrowed funds <b>cannot be withdrawn</b> and can only pay installments
                  for your active groups.
                </div>

                <button
                  className="btn y bl"
                  onClick={async () => {
                    if (!loanGroupKey) {
                      onToast('Select an active group');
                      return;
                    }
                    if (loanPhone.trim().length < 7) {
                      onToast('Enter your phone number for lender KYC');
                      return;
                    }
                    if (!numericAmt || numericAmt <= 50) {
                      onToast('Enter an amount above KSh 50');
                      return;
                    }
                    const [pidStr, gn] = loanGroupKey.split(':');
                    const pidNum = Number(pidStr);
                    const pr = products.find((x) => x.id === pidNum);
                    const defaultCtx = `${pr?.n || 'Product'} · Group ${gn}`;
                    const err = await onSubmitLoan({
                      lenderId: loanPreferredLender,
                      amt: numericAmt,
                      pid: pidNum,
                      gn,
                      phone: loanPhone.trim(),
                      ctx: loanCtx.trim() || defaultCtx,
                    });
                    if (err) {
                      onToast(err);
                      return;
                    }
                    onClose();
                  }}
                >
                  Post Loan Request to Lenders
                </button>
              </>
            )}
          </>
        );
      }

      case 'upload': {
        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(file.type)) {
            onToast('Please choose a PNG, JPEG, WebP, or GIF image');
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            onToast('Image must be under 5MB');
            return;
          }
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!dataUrl) return;
            setUploadingImg(true);
            try {
              const { url } = await api.uploadImage(dataUrl, file.name);
              setUpImgUrl(url);
              onToast('Image uploaded');
            } catch (err) {
              onToast(err instanceof Error ? err.message : 'Image upload failed');
            } finally {
              setUploadingImg(false);
            }
          };
          reader.readAsDataURL(file);
        };

        return (
          <>
            <h3>Upload Product</h3>
            <input
              placeholder="Product name"
              value={upName}
              onChange={(e) => setUpName(e.target.value)}
            />
            <select value={upCat} onChange={(e) => setUpCat(e.target.value)}>
              {CATS.slice(1).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="row">
              <input
                type="number"
                placeholder="Selling price"
                value={upPrice}
                onChange={(e) => setUpPrice(e.target.value)}
              />
              <input
                type="number"
                placeholder="Previous price"
                value={upOldPrice}
                onChange={(e) => setUpOldPrice(e.target.value)}
              />
            </div>
            <div className="row">
              <input
                type="number"
                placeholder="Stock"
                value={upStock}
                onChange={(e) => setUpStock(e.target.value)}
              />
              <input
                placeholder="Shop location"
                value={upLoc}
                onChange={(e) => setUpLoc(e.target.value)}
              />
            </div>
            <label className="mu">Product Image (PNG, JPG, WebP, up to 5MB)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
            />
            {uploadingImg && <p className="mu">Uploading image...</p>}
            {upImgUrl && (
              <div className="row" style={{ margin: '4px 0 8px' }}>
                <img
                  src={upImgUrl}
                  alt="Preview"
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '10px' }}
                />
                <span className="bd">Image ready</span>
              </div>
            )}
            <label className="mu">Product Till / Paybill Number (required)</label>
            <input
              placeholder="M-Pesa Till or Paybill e.g. 542100"
              value={upTill}
              onChange={(e) => setUpTill(e.target.value)}
            />
            <input
              placeholder="Description"
              value={upDesc}
              onChange={(e) => setUpDesc(e.target.value)}
            />

            {/* Optional Paid Spotlight Placement (KSh 500/month each from private wallet) */}
            <div
              className="card"
              style={{
                margin: '6px 0 10px',
                background: '#fff7ed',
                borderColor: '#fed7aa',
              }}
            >
              <div className="row sp" style={{ marginBottom: '4px' }}>
                <b style={{ fontSize: '13px', color: '#9a3412' }}>
                  📣 Optional Hero Spotlight (KSh 500/month each)
                </b>
                <span className="bd" style={{ fontSize: '10px' }}>
                  Wallet: {K(merchantWallet)}
                </span>
              </div>
              <p className="mu" style={{ marginBottom: '6px' }}>
                Would you like your product featured or promoted on the Hero showcase? Both options
                are optional and paid from your private merchant wallet.
              </p>
              <label
                className="row"
                style={{ gap: '8px', marginBottom: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                <input
                  type="checkbox"
                  checked={upWantFeatured}
                  onChange={(e) => setUpWantFeatured(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span>
                  <b>⭐ Featured Items (Paid Spotlight)</b> — + KSh 500 / month
                </span>
              </label>
              <label
                className="row"
                style={{ gap: '8px', cursor: 'pointer', fontSize: '13px' }}
              >
                <input
                  type="checkbox"
                  checked={upWantPromoted}
                  onChange={(e) => setUpWantPromoted(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span>
                  <b>🔥 Promotional Items (Sponsored Deals)</b> — + KSh 500 / month
                </span>
              </label>
              {(upWantFeatured || upWantPromoted) && (
                <div className="mu" style={{ marginTop: '6px', fontWeight: 700, color: '#c2410c' }}>
                  Spotlight charge at upload:{' '}
                  {K((upWantFeatured ? 500 : 0) + (upWantPromoted ? 500 : 0))}
                </div>
              )}
            </div>

            <button
              className="btn y bl"
              disabled={uploadingImg}
              onClick={async () => {
                if (!upName.trim() || !upPrice.trim()) {
                  onToast('Enter name and price');
                  return;
                }
                if (!upTill.trim()) {
                  onToast('Enter your Till / Paybill number');
                  return;
                }
                const spotlightCost =
                  (upWantFeatured ? 500 : 0) + (upWantPromoted ? 500 : 0);
                if (spotlightCost > merchantWallet) {
                  onToast(
                    `Insufficient merchant wallet (${K(spotlightCost)} needed). Deposit via M-Pesa or uncheck optional spotlight.`
                  );
                  return;
                }
                const spotlightTier =
                  upWantFeatured && upWantPromoted
                    ? 'both'
                    : upWantFeatured
                      ? 'featured'
                      : upWantPromoted
                        ? 'promoted'
                        : 'none';
                const err = await onSubmitUpload({
                  n: upName.trim(),
                  cat: upCat,
                  p: Number(upPrice),
                  o: Number(upOldPrice) || Number(upPrice),
                  stock: Number(upStock) || 10,
                  loc: upLoc.trim() || 'Nairobi',
                  till: upTill.trim(),
                  desc: upDesc.trim() || 'New product. Pay little by little.',
                  img: upImgUrl || undefined,
                  spotlightTier,
                });
                if (err) {
                  onToast(err);
                  return;
                }
                onClose();
              }}
            >
              {uploadingImg
                ? 'Uploading image...'
                : upWantFeatured || upWantPromoted
                  ? `Publish & Pay ${K((upWantFeatured ? 500 : 0) + (upWantPromoted ? 500 : 0))}`
                  : 'Publish & add groups'}
            </button>
          </>
        );
      }

      case 'subscribe': {
        const renderPlans = (term: 'Monthly' | 'Annual') =>
          PL.map((x, i) => {
            if (x.term !== term) return null;
            const canAfford = merchantWallet >= x.price;
            return (
              <div key={`${x.n}-${x.term}`} className="grp">
                <div>
                  <b>
                    {x.n} · {K(x.price)}
                  </b>
                  <div className="mu">
                    {x.max} products on the announcement feed · 10 groups per product
                    {term === 'Annual'
                      ? ` · saves ${K(({ 2500: 500, 8500: 500, 17000: 1000 } as Record<number, number>)[x.price] || 0)}`
                      : ''}
                  </div>
                </div>
                <button
                  className={`btn sm ${canAfford ? 'y' : 'o'}`}
                  onClick={async () => {
                    if (!canAfford) {
                      onToast(`Insufficient wallet balance (${K(x.price)} needed). Deposit via M-Pesa first.`);
                      return;
                    }
                    const err = await onSubmitSubscribe(i);
                    if (err) {
                      onToast(err);
                      return;
                    }
                    onClose();
                  }}
                >
                  {canAfford ? 'Pay from Wallet' : 'Low Balance'}
                </button>
              </div>
            );
          });

        return (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3>Choose a Mandatory Merchant Plan</h3>
              <button type="button" className="btn o sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <div
              className="card row sp"
              style={{ margin: '6px 0 10px', background: '#fff7ed', borderColor: '#fed7aa' }}
            >
              <div>
                <div className="mu">Private Merchant Wallet</div>
                <b>{K(merchantWallet)}</b>
              </div>
              {onOpenDeposit && (
                <button
                  type="button"
                  className="btn y sm"
                  onClick={() => onOpenDeposit()}
                >
                  ⬆ Deposit via M-Pesa
                </button>
              )}
            </div>
            <b>Monthly · 30 days</b>
            {renderPlans('Monthly')}
            <b>Annual · 365 days</b>
            {renderPlans('Annual')}
            <p className="mu">
              Subscription is mandatory before uploading products. Paid from your private merchant
              wallet (funded via Admin-approved M-Pesa deposits). Optional ⭐ Featured &amp; 🔥
              Promotional spotlights cost KSh 500/month each.
            </p>
          </>
        );
      }

      case 'promote': {
        const p = products.find((x) => x.id === modal.pid);
        if (!p) return null;
        const tiers = Object.values(PROMO_TIERS);
        return (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3>📣 Feature &amp; Promote Item</h3>
              <button type="button" className="btn o sm" onClick={onClose}>
                ✕
              </button>
            </div>
            <div
              className="card row sp"
              style={{ margin: '4px 0 8px', background: '#fff7ed', borderColor: '#fed7aa' }}
            >
              <div>
                <div className="mu">Product: <b>{p.n}</b></div>
                <div>Private Merchant Wallet: <b>{K(merchantWallet)}</b></div>
              </div>
              {onOpenDeposit && (
                <button type="button" className="btn o sm" onClick={() => onOpenDeposit()}>
                  ⬆ Deposit
                </button>
              )}
            </div>
            <p className="mu" style={{ marginBottom: '10px' }}>
              Optional paid placement from your merchant wallet (KSh 500/month each) to appear in
              the Hero <b>⭐ Featured Items · Paid Spotlight</b> or{' '}
              <b>🔥 Promotional Items · Sponsored Deals</b> sections.
            </p>
            {tiers.map((tier) => {
              const canAfford = merchantWallet >= tier.price;
              return (
                <div key={tier.id} className="grp">
                  <div>
                    <b>
                      {tier.badge} · {K(tier.price)}/month
                    </b>
                    <div className="mu">{tier.desc}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn sm ${canAfford ? 'y' : 'o'}`}
                    onClick={async () => {
                      if (!canAfford) {
                        onToast(`Insufficient wallet balance (${K(tier.price)} needed). Deposit via M-Pesa first.`);
                        return;
                      }
                      const err = await onSubmitPromote(p.id, tier.id);
                      if (err) {
                        onToast(err);
                        return;
                      }
                      onClose();
                    }}
                  >
                    {canAfford ? `Pay ${K(tier.price)}` : 'Low Balance'}
                  </button>
                </div>
              );
            })}
          </>
        );
      }

      case 'declineDeposit':
        return (
          <>
            <h3>Decline deposit</h3>
            <input
              placeholder="Reason (e.g. code not found)"
              value={decReason}
              onChange={(e) => setDecReason(e.target.value)}
            />
            <button
              className="btn bl"
              style={{ background: 'var(--rd)' }}
              onClick={() => {
                onConfirmDeclineDeposit(modal.id, decReason);
                onClose();
              }}
            >
              Decline
            </button>
          </>
        );

      case 'copyText':
        return (
          <>
            <h3>Copy this</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '8px' }}>
              {modal.text}
            </pre>
          </>
        );
    }
  };

  return (
    <div
      className="mod"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div>{renderContent()}</div>
    </div>
  );
};
