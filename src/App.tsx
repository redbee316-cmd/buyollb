import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api/client';
import { AdminView } from './components/AdminView';
import { Footer } from './components/Footer';
import { LenderView } from './components/LenderView';
import { AuthModalMode, LoginView } from './components/LoginView';
import { MemberView } from './components/MemberView';
import { MerchantView } from './components/MerchantView';
import { ActiveModal, Modals } from './components/Modals';
import { OnboardingModal } from './components/OnboardingModal';
import { ProductAIModal } from './components/ProductAIModal';
import { SearchModal } from './components/SearchModal';
import { BottomNav, Header } from './components/SharedViews';
import { defState, type PromoTierId } from './utils/defaults';
import type { AppState, MyGroupEntry, Product, Tab } from './types/buyoll';
import { K, inst } from './utils/format';

export default function App() {
  const [state, setState] = useState<AppState>(() => ({ ...defState(), role: null, name: 'Guest' }));
  const [modal, setModal] = useState<ActiveModal>(null);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiProductId, setAiProductId] = useState<number | null>(null);
  const [onboardingProductId, setOnboardingProductId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2400);
  }, []);

  /**
   * Merges authoritative server state into React state while preserving client UI navigation
   * unless explicit navigation overrides are provided.
   */
  const syncServerState = useCallback(
    (
      next: AppState,
      navOverride?: { tab?: Tab; view?: string | null; sel?: string | number | null }
    ) => {
      setState((prev) => ({
        ...next,
        tab: navOverride?.tab ?? prev.tab ?? next.tab,
        view: navOverride && 'view' in navOverride ? (navOverride.view ?? null) : (prev.view ?? next.view),
        sel: navOverride && 'sel' in navOverride ? (navOverride.sel ?? null) : (prev.sel ?? next.sel),
        q: prev.q ?? '',
        mf: prev.mf ?? 'All',
        cf: prev.cf ?? 'All',
      }));
    },
    []
  );

  // Load live public shop catalog immediately on startup (no login required)
  useEffect(() => {
    let active = true;
    api
      .fetchPublicShop()
      .then((shopState) => {
        if (active) {
          syncServerState(shopState);
        }
      })
      .catch(() => {
        // fallback initial shop catalog already displayed
      });
    return () => {
      active = false;
    };
  }, [syncServerState]);

  const merchants = useMemo(
    () => [...new Set(state.products.map((p) => p.m))],
    [state.products]
  );

  const isVisible = useCallback(
    (p: Product) => !state.hidden.includes(p.id) && !state.sus.includes(p.m),
    [state.hidden, state.sus]
  );

  const go = useCallback((tab: Tab, view?: string | null, sel?: string | number | null) => {
    setState((prev) => ({
      ...prev,
      tab,
      view: view || null,
      sel: sel ?? null,
    }));
  }, []);

  const handleRequireAuth = useCallback(
    (mode: AuthModalMode, msg?: string) => {
      setAuthModalMode(mode);
      if (msg) showToast(msg);
    },
    [showToast]
  );

  const handleAuthenticated = useCallback((nextState: AppState) => {
    setAuthModalMode(null);
    setModal(null);
    setState((prev) => {
      const keepMemberShopContext =
        nextState.role === 'member' && (prev.tab === 'home' || prev.tab === 'groups');
      return {
        ...nextState,
        tab: keepMemberShopContext ? prev.tab : 'home',
        view: keepMemberShopContext ? prev.view : null,
        sel: keepMemberShopContext ? prev.sel : null,
        q: keepMemberShopContext ? prev.q : '',
        mf: keepMemberShopContext ? prev.mf : 'All',
        cf: keepMemberShopContext ? prev.cf : 'All',
      };
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await api.logout();
    setModal(null);
    setAuthModalMode(null);
    try {
      const publicShop = await api.fetchPublicShop();
      setState({
        ...publicShop,
        tab: 'home',
        view: null,
        sel: null,
      });
    } catch {
      setState({ ...defState(), role: null, name: 'Guest', tab: 'home', view: null, sel: null });
    }
    showToast('Logged out');
  }, [showToast]);

  const handleReset = useCallback(async () => {
    try {
      const next = await api.resetDemo();
      syncServerState(next, { tab: 'home', view: null, sel: null });
      showToast('Demo data reset');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reset failed');
    }
  }, [showToast, syncServerState]);

  const handleOpenNotifications = useCallback(async () => {
    setModal({ type: 'notifications' });
    if (!state.role) return;
    try {
      const next = await api.markNotificationsRead();
      syncServerState(next);
    } catch {
      // keep modal open even if mark-read fails
    }
  }, [state.role, syncServerState]);

  const handleClearReadNotifications = useCallback(async () => {
    if (!state.role) return;
    try {
      const next = await api.clearReadNotifications();
      syncServerState(next);
      showToast('Read notifications cleared');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not clear notifications');
    }
  }, [state.role, showToast, syncServerState]);

  const handleJoinSubmit = useCallback(
    async (
      pid: number,
      gn: string,
      referral?: { referredBy: string; referralCode?: string; knowsMember: boolean }
    ) => {
      try {
        const res = await api.joinGroup(pid, gn, referral);
        syncServerState(res.state, { tab: 'wallet', view: 'mine', sel: null });
        showToast(
          res.joinedImmediately
            ? 'Joined as first member & Group Moderator!'
            : 'Referral request sent to Group Moderator'
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not join group');
      }
    },
    [showToast, syncServerState]
  );

  const handleDecideJoinRequest = useCallback(
    async (requestId: string, approve: boolean, reason = '') => {
      try {
        const next = await api.decideJoinRequest(requestId, approve, reason);
        syncServerState(next);
        showToast(
          approve
            ? 'Member accepted into group & notified!'
            : 'Referral join request declined'
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Moderator decision failed');
      }
    },
    [showToast, syncServerState]
  );

  const handleAppointModerator = useCallback(
    async (pid: number, gn: string, candidateName: string, directTransfer = false) => {
      try {
        const res = await api.appointModerator(pid, gn, candidateName, directTransfer);
        syncServerState(res.state);
        showToast(
          res.appointed
            ? `${res.moderatorName} is now Group Moderator!`
            : `Vote recorded for ${candidateName} as Moderator`
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not appoint moderator');
      }
    },
    [showToast, syncServerState]
  );

  const handleEnforcePayment = useCallback(
    async (
      pid: number,
      gn: string,
      memberIdx: number,
      action: 'remind' | 'warn' | 'clear_pin',
      message = ''
    ) => {
      try {
        const next = await api.enforceGroupPayment(pid, gn, memberIdx, action, message);
        syncServerState(next);
        showToast(
          action === 'warn'
            ? 'Rule warning & 📌 pin sent to member'
            : action === 'clear_pin'
              ? 'Reminder pin cleared'
              : '📌 Payment reminder sent to member'
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Enforcement action failed');
      }
    },
    [showToast, syncServerState]
  );

  const handleUpdateGroupRules = useCallback(
    async (pid: number, gn: string, rules: string) => {
      try {
        const next = await api.updateGroupRules(pid, gn, rules);
        syncServerState(next);
        showToast('Group rules updated & members notified');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not update rules');
      }
    },
    [showToast, syncServerState]
  );

  const handleSubmitGroupPayment = useCallback(
    async (
      pid: number,
      gn: string,
      code: string,
      amount: number,
      payMethod: 'wallet' | 'mpesa' = 'mpesa'
    ): Promise<string | void> => {
      try {
        const next = await api.payGroup(pid, gn, code, amount, payMethod);
        syncServerState(next);
        showToast(
          payMethod === 'wallet'
            ? 'Paid from Wallet & tracking auto-checked!'
            : 'Payment sent to merchant for approval'
        );
      } catch (err) {
        return err instanceof Error ? err.message : 'Payment failed';
      }
    },
    [showToast, syncServerState]
  );

  const handleDecideGroupPayment = useCallback(
    async (paymentId: number, approve: boolean) => {
      try {
        const next = await api.decideGroupPayment(paymentId, approve);
        syncServerState(next);
        showToast(
          approve
            ? 'Payment approved & check-marked on Payment Tracking!'
            : 'Payment declined'
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Action failed');
      }
    },
    [showToast, syncServerState]
  );

  const handleTickMember = useCallback(
    async (pid: number, gn: string, memberIdx: number) => {
      try {
        const next = await api.tickMember(pid, gn, memberIdx);
        syncServerState(next);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not tick payment');
      }
    },
    [showToast, syncServerState]
  );

  const handleRotateGroup = useCallback(
    async (pid: number, gn: string) => {
      try {
        const res = await api.rotateGroup(pid, gn);
        syncServerState(res.state);
        showToast(`Product handed to ${res.handedTo}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not rotate group');
      }
    },
    [showToast, syncServerState]
  );

  const handleCopyLedger = useCallback(
    (pid: number, gn: string) => {
      const p = state.products.find((x) => x.id === pid);
      const g = p?.g.find((x) => x.n === gn);
      if (!p || !g) return;
      const daily = inst(p.p, g.c);
      const mx = g.r.length ? Math.max(0, ...g.r.map((x) => x.d ?? 0)) : 0;
      const daysLeft = Math.max(0, 10 - mx);
      const t = new Date(Date.now() + daysLeft * 864e5);
      const d = t.getDate();
      const suf =
        d % 10 === 1 && d !== 11
          ? 'st'
          : d % 10 === 2 && d !== 12
            ? 'nd'
            : d % 10 === 3 && d !== 13
              ? 'rd'
              : 'th';
      const deadline = `${d}${suf} ${t.toLocaleString('en', { month: 'long' })}`;

      const text =
        `${p.n} at ${p.p}\n` +
        `Daily ${daily} bob\n` +
        `Deadline for number ${g.done ? g.c : g.rot} is ${deadline}\n\n` +
        g.r
          .map((x, i) => {
            const activeDays = x.d ?? 0;
            const totalPaid = x.totalPaid ?? activeDays;
            const completedRounds = Math.floor(totalPaid / 10);
            const activeRound = totalPaid >= g.c * 10 ? g.c : completedRounds + 1;
            return (
              `${i + 1}.${x.mod ? '🆗' : ''}${x.pin ? '📌' : ''}${x.n}` +
              `${g.c > 1 ? ` [R${activeRound}/${g.c}]` : ''}` +
              `${'✅'.repeat(activeDays)}` +
              `${completedRounds > 0 ? ` 🆑×${completedRounds}` : ''}` +
              `${activeDays > 0 && activeDays < 10 ? ` *${(10 - activeDays) * daily}` : ''}`
            );
          })
          .join('\n') +
        `\n\nTill / Paybill. ${p.till}`;

      try {
        navigator.clipboard.writeText(text).then(
          () => showToast('Copied - paste into WhatsApp'),
          () => setModal({ type: 'copyText', text })
        );
      } catch {
        setModal({ type: 'copyText', text });
      }
    },
    [state.products, showToast]
  );

  const handleSubmitDeposit = useCallback(
    async (code: string, amt: number, phone: string): Promise<string | void> => {
      try {
        const next = await api.submitDeposit(code, amt, phone);
        syncServerState(next);
        showToast('Deposit pending admin verification');
      } catch (err) {
        return err instanceof Error ? err.message : 'Deposit failed';
      }
    },
    [showToast, syncServerState]
  );

  const handleDecideDeposit = useCallback(
    async (id: number, ok: boolean, reason = '') => {
      try {
        const next = await api.decideDeposit(id, ok, reason);
        syncServerState(next);
        showToast(ok ? 'Deposit approved' : 'Deposit declined');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Action failed');
      }
    },
    [showToast, syncServerState]
  );

  const handleSubmitLoan = useCallback(
    async (payload: {
      lenderId: number;
      amt: number;
      pid?: number;
      gn?: string;
      ctx: string;
      phone?: string;
    }): Promise<string | void> => {
      try {
        const next = await api.requestLoan(payload);
        syncServerState(next);
        showToast('Loan request posted globally to all Buyoll lenders');
      } catch (err) {
        return err instanceof Error ? err.message : 'Loan request failed';
      }
    },
    [showToast, syncServerState]
  );

  const handleDecideLoan = useCallback(
    async (id: number, approve: boolean, amount?: number) => {
      try {
        const next = await api.decideLoan(id, approve, amount);
        syncServerState(next);
        showToast(
          approve
            ? 'Loan transferred to borrower wallet (5% commission credited to Admin)!'
            : 'Loan declined'
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Action failed');
      }
    },
    [showToast, syncServerState]
  );

  const handleUploadProduct = useCallback(
    async (data: {
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
    }): Promise<string | void> => {
      try {
        const res = await api.createProduct(data);
        syncServerState(res.state, { tab: 'home', view: 'add', sel: res.productId });
        showToast(
          data.spotlightTier && data.spotlightTier !== 'none'
            ? 'Product published & Hero Spotlight activated!'
            : 'Published to announcements'
        );
      } catch (err) {
        return err instanceof Error ? err.message : 'Upload failed';
      }
    },
    [showToast, syncServerState]
  );

  const handleUpdateProductTill = useCallback(
    async (pid: number, till: string) => {
      const clean = till.trim();
      if (!clean) {
        showToast('Till / Paybill cannot be empty');
        return;
      }
      try {
        const next = await api.updateProductTill(pid, clean);
        syncServerState(next);
        showToast(`Till / Paybill updated to ${clean}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed');
      }
    },
    [showToast, syncServerState]
  );

  const handleSubscribe = useCallback(
    async (planIndex: number): Promise<string | void> => {
      try {
        const next = await api.subscribePlan(planIndex);
        syncServerState(next);
        showToast(`Subscription active (${K(next.plan.price)}) — upload unlocked!`);
      } catch (err) {
        return err instanceof Error ? err.message : 'Subscription failed';
      }
    },
    [showToast, syncServerState]
  );

  const handlePromoteProduct = useCallback(
    async (pid: number, tier: PromoTierId): Promise<string | void> => {
      try {
        const next = await api.promoteProduct(pid, tier);
        syncServerState(next);
        showToast('Product added to Hero Featured / Promotional showcase!');
      } catch (err) {
        return err instanceof Error ? err.message : 'Promotion failed';
      }
    },
    [showToast, syncServerState]
  );

  const handleToggleWishlist = useCallback(
    async (pid: number) => {
      if (!state.role) {
        handleRequireAuth('member-login', 'Log in or register to save products to your Wishlist');
        return;
      }
      try {
        const res = await api.toggleWishlist(pid);
        syncServerState(res.state);
        showToast(res.saved ? 'Saved to your Wishlist ❤️' : 'Removed from Wishlist');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not update Wishlist');
      }
    },
    [state.role, handleRequireAuth, showToast, syncServerState]
  );

  const unreadCount = state.role
    ? state.nt.filter((x) => !x.s).length
    : 0;
  const roleNotifications = state.role ? state.nt : [];

  return (
    <div id="app">
      <Header
        role={state.role}
        name={state.name}
        tab={state.tab}
        view={state.view}
        unreadCount={unreadCount}
        onGo={go}
        onBell={() => void handleOpenNotifications()}
      />

      <main>
        {(state.role === null ||
          state.role === 'member' ||
          state.view === 'prod' ||
          ((state.role === 'admin' || state.role === 'lender') && state.view === 'track')) && (
          <MemberView
            state={state}
            isVisible={isVisible}
            merchants={merchants}
            onGo={go}
            onOpenSearch={() => setSearchOpen(true)}
            onSearchChange={(q) => setState((prev) => ({ ...prev, q }))}
            onMerchantFilter={(mf) => setState((prev) => ({ ...prev, mf }))}
            onCategoryFilter={(cf) => setState((prev) => ({ ...prev, cf }))}
            onToggleWishlist={(pid) => void handleToggleWishlist(pid)}
            onJoinModal={(pid, gn) => setModal({ type: 'join', pid, gn })}
            onDecideJoinRequest={(reqId, approve, reason) =>
              void handleDecideJoinRequest(reqId, approve, reason)
            }
            onAppointModerator={(pid, gn, candidate, direct) =>
              void handleAppointModerator(pid, gn, candidate, direct)
            }
            onEnforcePayment={(pid, gn, idx, action, msg) =>
              void handleEnforcePayment(pid, gn, idx, action, msg)
            }
            onUpdateGroupRules={(pid, gn, rules) => void handleUpdateGroupRules(pid, gn, rules)}
            onOpenGroupPayModal={(entry: MyGroupEntry) =>
              setModal({ type: 'groupPay', entry })
            }
            onTickMember={(pid, gn, idx) => void handleTickMember(pid, gn, idx)}
            onRotateGroup={(pid, gn) => void handleRotateGroup(pid, gn)}
            onCopyLedger={handleCopyLedger}
            onOpenDeposit={() => setModal({ type: 'deposit' })}
            onOpenLoanModal={(lenderId) => setModal({ type: 'loan', lenderId })}
            onDecideLoan={(id, approve, amount) => void handleDecideLoan(id, approve, amount)}
            onOpenProductAI={(pid) => setAiProductId(pid)}
            onOpenOnboarding={(pid) => setOnboardingProductId(pid)}
            onShowReport={() => showToast(`Report: ${state.tx.length} transactions`)}
            onLogout={() => void handleLogout()}
            onReset={() => void handleReset()}
            onRequireAuth={handleRequireAuth}
          />
        )}

        {state.role === 'merchant' && state.view !== 'prod' && (
          <MerchantView
            state={state}
            onGo={go}
            onOpenDeposit={() => setModal({ type: 'deposit' })}
            onOpenSubscribe={() => setModal({ type: 'subscribe' })}
            onOpenUpload={() => {
              const active = state.plan.ts
                ? state.plan.ts >= Date.now() && state.plan.active
                : state.plan.active;
              if (!active) {
                showToast('Subscribe first to publish products');
                return;
              }
              setModal({ type: 'upload' });
            }}
            onOpenPromote={(pid) => setModal({ type: 'promote', pid })}
            onToggleWishlist={(pid) => void handleToggleWishlist(pid)}
            onUpdateProductTill={(pid, till) => void handleUpdateProductTill(pid, till)}
            onDecideGroupPayment={(id, approve) => void handleDecideGroupPayment(id, approve)}
            onOpenProductAI={(pid) => setAiProductId(pid)}
            onOpenOnboarding={(pid) => setOnboardingProductId(pid)}
            onToast={showToast}
            onRequireAuth={handleRequireAuth}
            onLogout={() => void handleLogout()}
            onReset={() => void handleReset()}
          />
        )}

        {state.role === 'lender' && state.view !== 'prod' && state.view !== 'track' && (
          <LenderView
            state={state}
            onGo={go}
            onOpenDeposit={() => setModal({ type: 'deposit' })}
            onDecideLoan={(id, approve, amount) => void handleDecideLoan(id, approve, amount)}
            onToggleWishlist={(pid) => void handleToggleWishlist(pid)}
            onRequireAuth={handleRequireAuth}
            onLogout={() => void handleLogout()}
            onReset={() => void handleReset()}
          />
        )}

        {state.role === 'admin' && state.view !== 'track' && state.view !== 'prod' && (
          <AdminView
            state={state}
            merchants={merchants}
            onGo={go}
            onApproveDeposit={(id) => void handleDecideDeposit(id, true)}
            onOpenDeclineDeposit={(id) => setModal({ type: 'declineDeposit', id })}
            onTogglePlan={(merchant) =>
              void api
                .adminTogglePlan(merchant)
                .then(syncServerState)
                .catch((e) => showToast(e instanceof Error ? e.message : 'Failed'))
            }
            onToggleSuspend={(merchant) =>
              void api
                .adminToggleSuspend(merchant)
                .then(syncServerState)
                .catch((e) => showToast(e instanceof Error ? e.message : 'Failed'))
            }
            onToggleHideProduct={(pid) =>
              void api
                .adminToggleHide(pid)
                .then(syncServerState)
                .catch((e) => showToast(e instanceof Error ? e.message : 'Failed'))
            }
            onToggleFeatureProduct={(pid) =>
              void api
                .adminToggleFeature(pid)
                .then(syncServerState)
                .catch((e) => showToast(e instanceof Error ? e.message : 'Failed'))
            }
            onTogglePromoteProduct={(pid) =>
              void api
                .adminTogglePromote(pid)
                .then(syncServerState)
                .catch((e) => showToast(e instanceof Error ? e.message : 'Failed'))
            }
            onRemoveProduct={(pid) =>
              void api
                .adminRemoveProduct(pid)
                .then(syncServerState)
                .catch((e) => showToast(e instanceof Error ? e.message : 'Failed'))
            }
            onSaveSettings={(till, banner) =>
              void api
                .adminSaveSettings(till, banner)
                .then((next) => {
                  syncServerState(next);
                  showToast('Settings saved');
                })
                .catch((e) => showToast(e instanceof Error ? e.message : 'Failed'))
            }
            onToggleWishlist={(pid) => void handleToggleWishlist(pid)}
            onRequireAuth={handleRequireAuth}
            onLogout={() => void handleLogout()}
            onReset={() => void handleReset()}
          />
        )}
      </main>

      <Footer onGo={go} onRequireAuth={handleRequireAuth} onToast={showToast} />

      <BottomNav role={state.role} tab={state.tab} view={state.view} onGo={go} />

      <SearchModal
        open={searchOpen}
        initialQuery={state.q}
        products={state.products}
        hiddenIds={state.hidden}
        suspendedMerchants={state.sus}
        featuredIds={state.feat}
        promotedIds={state.promo || []}
        onClose={() => setSearchOpen(false)}
        onSelectProduct={(pid) => go('home', 'prod', pid)}
        onSelectMerchant={(merchant) =>
          setState((prev) => ({ ...prev, tab: 'home', view: null, sel: null, mf: merchant, cf: 'All', q: '' }))
        }
        onSelectCategory={(cat) =>
          setState((prev) => ({ ...prev, tab: 'home', view: null, sel: null, cf: cat, mf: 'All', q: '' }))
        }
        onApplyQuery={(q) =>
          setState((prev) => ({ ...prev, tab: 'home', view: null, sel: null, q }))
        }
      />

      <Modals
        modal={modal}
        onClose={() => setModal(null)}
        isGuest={!state.role}
        onGoToProfile={() => go('profile')}
        tillGlobal={state.till}
        merchantWallet={state.mw}
        memberWallet={state.wallet}
        loanCredit={state.loanCredit || 0}
        notifications={roleNotifications}
        products={state.products}
        myGroups={state.my}
        lenders={state.lenders}
        onSubmitDeposit={handleSubmitDeposit}
        onSubmitJoin={(pid, gn, referral) => void handleJoinSubmit(pid, gn, referral)}
        onClearReadNotifications={() => void handleClearReadNotifications()}
        onSubmitGroupPayment={handleSubmitGroupPayment}
        onSubmitLoan={handleSubmitLoan}
        onSubmitUpload={handleUploadProduct}
        onSubmitSubscribe={handleSubscribe}
        onSubmitPromote={handlePromoteProduct}
        onConfirmDeclineDeposit={(id, reason) => void handleDecideDeposit(id, false, reason)}
        onOpenDeposit={() => setModal({ type: 'deposit' })}
        onToast={showToast}
      />

      {authModalMode && (
        <div
          className="mod"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAuthModalMode(null);
          }}
        >
          <LoginView
            initialMode={authModalMode}
            onAuthenticated={handleAuthenticated}
            onToast={showToast}
            onClose={() => setAuthModalMode(null)}
          />
        </div>
      )}

      <ProductAIModal
        product={state.products.find((p) => p.id === aiProductId) || null}
        role={state.role}
        currentUserName={state.name}
        onClose={() => setAiProductId(null)}
        onGoToPlans={(pid) => go('home', 'prod', pid)}
        onToast={showToast}
      />

      <OnboardingModal
        product={state.products.find((p) => p.id === onboardingProductId) || null}
        role={state.role}
        myGroups={state.my}
        onClose={() => setOnboardingProductId(null)}
        onJoinGroup={(pid, gn) => {
          if (!state.role) {
            handleRequireAuth(
              'member-register',
              'Register or log in as a Member to join your first group'
            );
            return;
          }
          if (state.role !== 'member') {
            go('home', 'prod', pid);
            return;
          }
          setModal({ type: 'join', pid, gn });
        }}
        onViewProduct={(pid) => go('home', 'prod', pid)}
      />

      {toastMsg && <div id="toast">{toastMsg}</div>}
    </div>
  );
}
