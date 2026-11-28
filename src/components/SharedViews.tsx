import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import type { AppState, Product, Role, Tab } from '../types/buyoll';
import { K, dc } from '../utils/format';
import type { AuthModalMode } from './LoginView';

export const NAV_ITEMS: Record<Role, Array<[Tab, string, string]>> = {
  member: [
    ['home', '🏠', 'Shop'],
    ['groups', '👥', 'Groups'],
  ],
  merchant: [
    ['home', '🏠', 'Home'],
    ['products', '📦', 'Products'],
  ],
  lender: [
    ['home', '🏠', 'Home'],
    ['loans', '💰', 'Loans'],
  ],
  admin: [
    ['home', '📊', 'Dashboard'],
    ['users', '👥', 'Users'],
    ['products', '📦', 'Products'],
    ['groups', '👥', 'Groups'],
    ['fin', '💰', 'Finance'],
    ['set', '⚙️', 'Settings'],
  ],
};

export const PageTop: React.FC<{
  title: string;
  backTab?: Tab;
  onBack?: () => void;
}> = ({ title, backTab, onBack }) => (
  <div className="top">
    {backTab && onBack ? (
      <span style={{ cursor: 'pointer' }} onClick={onBack}>
        ←
      </span>
    ) : (
      <span>☰</span>
    )}
    <span>{title}</span>
    <span>{backTab ? '♡' : '⟳'}</span>
  </div>
);

function isSafeImg(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('/uploads/') ||
    url.startsWith('/assets/') ||
    url.startsWith('data:image/') ||
    url.startsWith('https://picsum.photos/')
  );
}

function resolveImgSrc(url: string): string {
  if (url.startsWith('/assets/')) {
    return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  }
  return url;
}

export const SquareProductImage: React.FC<{ p: Product }> = ({ p }) => {
  const [failed, setFailed] = useState(false);
  return isSafeImg(p.img) && p.img && !failed ? (
    <img
      src={resolveImgSrc(p.img)}
      alt={p.n}
      onError={() => setFailed(true)}
      style={{ aspectRatio: '1', width: '100%', objectFit: 'cover', display: 'block' }}
    />
  ) : (
    <div className={`pimg ${p.b ? 'b' : ''}`} style={{ aspectRatio: '1', fontSize: '60px', borderRadius: 0 }}>
      {p.e}
    </div>
  );
};

export const ProductThumb: React.FC<{ p: Product; h?: number; w?: string }> = ({ p, h = 90, w = '100%' }) => {
  const [failed, setFailed] = useState(false);
  return isSafeImg(p.img) && p.img && !failed ? (
    <img
      src={resolveImgSrc(p.img)}
      alt={p.n}
      onError={() => setFailed(true)}
      style={{ height: `${h}px`, width: w, objectFit: 'cover', borderRadius: '12px', flex: 'none' }}
    />
  ) : (
    <div
      className={`pimg ${p.b ? 'b' : ''}`}
      style={{ height: `${h}px`, width: w, flex: 'none' }}
    >
      {p.e}
    </div>
  );
};

export const MerchantInitial: React.FC<{ name: string }> = ({ name }) => (
  <span
    style={{
      display: 'grid',
      placeItems: 'center',
      width: '38px',
      height: '38px',
      borderRadius: '50%',
      background: 'var(--pu)',
      color: '#fff',
      fontWeight: 800,
      flex: 'none',
    }}
  >
    {name?.[0] || 'B'}
  </span>
);

export const Header: React.FC<{
  role: Role | null;
  name: string;
  tab: Tab;
  view: string | null;
  unreadCount: number;
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onBell: () => void;
}> = ({
  role,
  name,
  tab,
  view,
  unreadCount,
  onGo,
  onBell,
}) => {
  const items = NAV_ITEMS[role || 'member'];
  const isProfileActive = tab === 'profile' && !view;

  return (
    <header className="hdr">
      <button
        type="button"
        onClick={() => onGo('home')}
        aria-label="Buyoll Home"
        style={{
          background: '#fff',
          border: '1px solid rgba(255, 115, 29, 0.25)',
          borderRadius: '8px',
          padding: '2px 8px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/aistudio/Buyoll_Shopping_Cart_Logo_23c2cc30.png`}
          alt="Buyoll"
          style={{ height: '30px', width: 'auto', display: 'block', objectFit: 'contain' }}
        />
      </button>

      <div className="dn">
        {items.map(([k, i, l]) => (
          <a key={k} className={tab === k && !view ? 'on' : ''} onClick={() => onGo(k)}>
            <i>{i}</i> {l}
          </a>
        ))}
      </div>

      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="bell"
          onClick={onBell}
          aria-label="Private Notifications"
          title="Private Notifications"
          style={{
            background: 'rgba(255, 255, 255, 0.72)',
            border: '1px solid rgba(255, 102, 0, 0.3)',
            borderRadius: '10px',
            color: '#231409',
            padding: '4px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🔔{unreadCount > 0 && <i>{unreadCount}</i>}
        </button>

        <button
          type="button"
          onClick={() => onGo('profile')}
          aria-label="Open Profile, Login, Sign Up, and Settings"
          style={{
            background: isProfileActive ? '#ff5500' : 'rgba(255, 255, 255, 0.85)',
            color: isProfileActive ? '#fff' : '#231409',
            border: '1px solid rgba(255, 102, 0, 0.35)',
            borderRadius: '10px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <span>👤</span>
          <span>Profile{role ? ` · ${name}` : ''}</span>
        </button>
      </div>
    </header>
  );
};

export const BottomNav: React.FC<{
  role: Role | null;
  tab: Tab;
  view: string | null;
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
}> = ({ role, tab, view, onGo }) => {
  const items = NAV_ITEMS[role || 'member'];
  return (
    <div className="bn">
      {items.map(([k, i, l]) => (
        <a key={k} className={tab === k && !view ? 'on' : ''} onClick={() => onGo(k)}>
          <i>{i}</i> {l}
        </a>
      ))}
    </div>
  );
};

export const WalletView: React.FC<{
  state: AppState;
  bal: number;
  onOpenDeposit: () => void;
}> = ({ state, bal, onOpenDeposit }) => {
  const role = state.role || 'member';
  const pendingTotal = state.deposits
    .filter((d) => d.st === 'pending' && (d.role || 'member') === role)
    .reduce((a, d) => a + d.amt, 0);

  const txItems = state.tx.filter((t) => (t.r || 'member') === role).slice(0, 6);

  return (
    <>
      <PageTop title="My Wallet" />
      <div className="bal">
        <div className="row sp">
          <div className="row">
            <span style={{ fontSize: '36px' }}>👛</span>
            <div>
              <span className="mu" style={{ color: '#ffe4e0' }}>
                Private {role} wallet · Balance
                {role === 'member' && state.memberCode ? ` · Code ${state.memberCode}` : ''}
              </span>
              <h2 style={{ fontSize: '30px' }}>{K(bal)}</h2>
            </div>
          </div>
          <span className="bd">Active</span>
        </div>
        {role === 'member' && (state.loanCredit || 0) > 0 && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.16)',
              color: '#fff',
              fontSize: '12px',
            }}
          >
            🔒 <b>Borrowed Loan Credit: {K(state.loanCredit || 0)}</b> — Non-withdrawable. Can only
            be used inside <b>My Groups → Pay today (wallet)</b> for products in active groups you
            belong to.
          </div>
        )}
        {pendingTotal > 0 && (
          <p className="mu" style={{ color: '#fde68a', marginTop: '6px' }}>
            Pending deposits: {K(pendingTotal)}
          </p>
        )}
        <div className="row" style={{ marginTop: '10px' }}>
          <button className="btn y bl" onClick={onOpenDeposit}>
            ⬆ Deposit
          </button>
        </div>
      </div>

      <div className="row sp">
        <h3>Recent Transactions</h3>
        <span className="mu" style={{ color: 'var(--pu2)' }}>
          See All →
        </span>
      </div>
      <div className="card">
        {txItems.map((t, idx) => (
          <div key={idx} className="tx">
            <div className="ic">{t.k === 'c' ? '⬆' : t.k === 'l' ? '👤' : '🛒'}</div>
            <div style={{ flex: 1 }}>
              <b>{t.t}</b>
              <div className="mu">{K(Math.abs(t.a))}</div>
            </div>
            <span className="mu">{t.d}</span>
          </div>
        ))}
      </div>
    </>
  );
};

export const ProfileSettingsPanel: React.FC<{
  role: Role | null;
  onOpenAdminSettings?: () => void;
}> = ({ role, onOpenAdminSettings }) => {
  const [privateAlerts, setPrivateAlerts] = useState(true);
  const [groupReminders, setGroupReminders] = useState(true);

  return (
    <div className="card">
      <h3>⚙️ Settings</h3>
      <p className="mu" style={{ margin: '4px 0 10px' }}>
        Manage your private notifications, account preferences, and privacy settings.
      </p>
      <div className="tx">
        <div style={{ flex: 1 }}>
          <b>Private Notifications</b>
          <div className="mu">Only your account receives and reads your alerts</div>
        </div>
        <button
          type="button"
          className={`btn sm ${privateAlerts ? '' : 'o'}`}
          onClick={() => setPrivateAlerts((prev) => !prev)}
        >
          {privateAlerts ? 'On' : 'Off'}
        </button>
      </div>
      <div className="tx" style={{ borderBottom: role === 'admin' ? undefined : 0 }}>
        <div style={{ flex: 1 }}>
          <b>10-Day Cycle Reminders</b>
          <div className="mu">Highlight upcoming daily payment deadlines</div>
        </div>
        <button
          type="button"
          className={`btn sm ${groupReminders ? '' : 'o'}`}
          onClick={() => setGroupReminders((prev) => !prev)}
        >
          {groupReminders ? 'On' : 'Off'}
        </button>
      </div>
      {role === 'admin' && onOpenAdminSettings && (
        <div style={{ marginTop: '10px' }}>
          <button type="button" className="btn o sm" onClick={onOpenAdminSettings}>
            ⚙️ Open Platform Admin Settings
          </button>
        </div>
      )}
    </div>
  );
};

export const WishlistView: React.FC<{
  state: AppState;
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onToggleWishlist: (pid: number) => void;
  onViewProduct: (pid: number) => void;
  onOpenOnboarding?: (pid: number) => void;
}> = ({ state, onGo, onToggleWishlist, onViewProduct, onOpenOnboarding }) => {
  const wishlistIds = state.wishlist || [];
  const savedSet = new Set(wishlistIds);
  const visibleProducts = state.products.filter(
    (p) => !state.hidden.includes(p.id) && !state.sus.includes(p.m)
  );
  const savedProducts = wishlistIds
    .map((id) => state.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));
  const discoverProducts = visibleProducts.filter((p) => !savedSet.has(p.id)).slice(0, 6);

  return (
    <>
      <PageTop title="My Wishlist" backTab="home" onBack={() => onGo('home')} />
      <div className="card row sp" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3>❤️ Saved Products ({savedProducts.length})</h3>
          <div className="mu">
            Your private personalized wishlist synced to your {state.role} account.
          </div>
        </div>
        <button type="button" className="btn o sm" onClick={() => onGo('home')}>
          ← Back to Dashboard
        </button>
      </div>

      {savedProducts.length ? (
        <div className="two">
          {savedProducts.map((p) => {
            const discount = dc(p);
            const openCount = p.g.filter((g) => g.j < g.c).length;
            return (
              <div key={p.id} className="card" style={{ margin: 0 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => onViewProduct(p.id)}>
                    <ProductThumb p={p} h={84} w="84px" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <b style={{ cursor: 'pointer' }} onClick={() => onViewProduct(p.id)}>
                      {p.n}
                    </b>
                    <div>
                      <span className="price" style={{ fontSize: '17px' }}>
                        {K(p.p)}
                      </span>
                      {p.o > p.p && <span className="old">{K(p.o)}</span>}{' '}
                      {discount > 0 && <span className="bd r">-{discount}%</span>}
                    </div>
                    <div className="mu">
                      🏪 {p.m} · 📍 {p.loc.split(',')[0]}
                    </div>
                    <div className="mu" style={{ color: '#e62e04', fontWeight: 700 }}>
                      from {K(Math.ceil(p.p / 100))}/day · {openCount} groups open
                    </div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn y sm"
                    style={{ flex: 1 }}
                    onClick={() => onViewProduct(p.id)}
                  >
                    View Product &amp; Groups
                  </button>
                  {onOpenOnboarding && (
                    <button
                      type="button"
                      className="btn o sm"
                      onClick={() => onOpenOnboarding(p.id)}
                    >
                      Guide
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn o sm"
                    onClick={() => onToggleWishlist(p.id)}
                  >
                    <Heart size={14} fill="#e62e04" color="#e62e04" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '22px 14px' }}>
          <div style={{ fontSize: '34px', marginBottom: '6px' }}>🤍</div>
          <b>Your Wishlist is empty</b>
          <p className="mu" style={{ margin: '4px 0 10px' }}>
            Tap the heart icon on any product in the marketplace or pick from recommendations below.
          </p>
        </div>
      )}

      {discoverProducts.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Discover &amp; Save to Wishlist</h3>
          <div className="two">
            {discoverProducts.map((p) => (
              <div key={`disc-${p.id}`} className="card row sp" style={{ margin: 0, gap: '10px' }}>
                <div className="row" style={{ flex: 1, minWidth: 0 }}>
                  <ProductThumb p={p} h={58} w="58px" />
                  <div style={{ minWidth: 0 }}>
                    <b className="truncate" style={{ display: 'block' }}>
                      {p.n}
                    </b>
                    <div className="price" style={{ fontSize: '15px' }}>
                      {K(p.p)}
                    </div>
                    <div className="mu truncate">🏪 {p.m}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn o sm shrink-0"
                  onClick={() => onToggleWishlist(p.id)}
                >
                  <Heart size={14} /> Save
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
};

export const ProfileView: React.FC<{
  name: string;
  role: Role;
  walletBalance?: number;
  wishlistCount?: number;
  onOpenWallet?: () => void;
  onOpenWishlist?: () => void;
  onOpenAdminSettings?: () => void;
  onRequireAuth: (mode: AuthModalMode, msg?: string) => void;
  onLogout: () => void;
  onReset: () => void;
}> = ({
  name,
  role,
  walletBalance,
  wishlistCount = 0,
  onOpenWallet,
  onOpenWishlist,
  onOpenAdminSettings,
  onRequireAuth,
  onLogout,
  onReset,
}) => (
  <>
    <PageTop title="Profile, Settings & Account" />
    <div className="card row sp" style={{ flexWrap: 'wrap', gap: '10px' }}>
      <div className="row">
        <MerchantInitial name={name} />
        <div>
          <h3>{name}</h3>
          <span className="bd" style={{ textTransform: 'capitalize' }}>
            {role} Account
          </span>
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {onOpenWishlist && (
          <button type="button" className="btn o sm" onClick={onOpenWishlist}>
            ❤️ My Wishlist ({wishlistCount})
          </button>
        )}
        {onOpenWallet && role !== 'admin' && (
          <button type="button" className="btn y sm" onClick={onOpenWallet}>
            👛 My Private Wallet
            {typeof walletBalance === 'number' ? ` (${K(walletBalance)})` : ''}
          </button>
        )}
      </div>
    </div>

    <div className="card">
      <h3>Sign Up / Register &amp; Login</h3>
      <p className="mu" style={{ margin: '4px 0 10px' }}>
        Create a new account or log in to a different Member, Merchant, Lender, or Admin dashboard.
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn y sm" onClick={() => onRequireAuth('member-register')}>
          Member Sign Up
        </button>
        <button type="button" className="btn sm" onClick={() => onRequireAuth('member-login')}>
          Member Login
        </button>
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

    <ProfileSettingsPanel role={role} onOpenAdminSettings={onOpenAdminSettings} />

    <div className="card">
      <h3>Session &amp; Security</h3>
      <p className="mu" style={{ margin: '4px 0 10px' }}>
        Sign out of your private {role} session or reset demo marketplace data.
      </p>
      <button type="button" className="btn bl" onClick={onLogout}>
        Log out
      </button>
      <button
        type="button"
        className="btn o bl"
        style={{ marginTop: '8px' }}
        onClick={onReset}
      >
        Reset demo data
      </button>
    </div>
  </>
);
