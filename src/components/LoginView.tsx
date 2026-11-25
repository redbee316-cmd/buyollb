import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AppState, Role } from '../types/buyoll';
import { PasswordInput } from './PasswordInput';

export type AuthModalMode =
  | 'member-register'
  | 'member-login'
  | 'merchant'
  | 'merchant-register'
  | 'lender'
  | 'lender-register'
  | 'admin';

interface LoginViewProps {
  initialMode?: AuthModalMode;
  onAuthenticated: (state: AppState) => void;
  onToast: (msg: string) => void;
  onClose?: () => void;
}

const DEMO_CREDS: Record<Exclude<Role, 'admin'>, { username: string; password: string }> = {
  member: { username: 'amina', password: 'amina!2026' },
  merchant: { username: 'bettyshop', password: 'betty!2026' },
  lender: { username: 'mwangicredit', password: 'mwangi!2026' },
};

export const LoginView: React.FC<LoginViewProps> = ({
  initialMode = 'member-register',
  onAuthenticated,
  onToast,
  onClose,
}) => {
  const [roleTab, setRoleTab] = useState<'member' | 'merchant' | 'lender'>('member');
  const [authAction, setAuthAction] = useState<'login' | 'signup' | 'forgot'>('signup');

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign Up fields (shared across Member, Merchant, Lender)
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRepeatPassword, setSignupRepeatPassword] = useState('');

  // Forgot Password flow state
  const [forgotUsername, setForgotUsername] = useState('');
  const [resetModal, setResetModal] = useState<{
    resetToken: string;
    username: string;
    role: Exclude<Role, 'admin'>;
  } | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetRepeatPassword, setResetRepeatPassword] = useState('');
  const [resetCompleted, setResetCompleted] = useState(false);

  // Admin modal state
  const [adminView, setAdminView] = useState<null | 'adminLogin' | 'adminClaim'>(null);
  const [adminPass, setAdminPass] = useState('');
  const [busy, setBusy] = useState(false);

  const openAdminPrompt = async () => {
    setBusy(true);
    try {
      const { configured } = await api.adminStatus();
      setAdminPass('');
      setAdminView(configured ? 'adminLogin' : 'adminClaim');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not check admin status');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setLoginUsername('');
    setLoginPassword('');
    setSignupUsername('');
    setSignupPassword('');
    setSignupRepeatPassword('');
    setForgotUsername('');
    setResetModal(null);
    setResetNewPassword('');
    setResetRepeatPassword('');
    setResetCompleted(false);

    if (initialMode === 'admin') {
      void openAdminPrompt();
    } else if (initialMode === 'merchant') {
      setRoleTab('merchant');
      setAuthAction('login');
      setAdminView(null);
    } else if (initialMode === 'merchant-register') {
      setRoleTab('merchant');
      setAuthAction('signup');
      setAdminView(null);
    } else if (initialMode === 'lender') {
      setRoleTab('lender');
      setAuthAction('login');
      setAdminView(null);
    } else if (initialMode === 'lender-register') {
      setRoleTab('lender');
      setAuthAction('signup');
      setAdminView(null);
    } else {
      setRoleTab('member');
      setAuthAction(initialMode === 'member-login' ? 'login' : 'signup');
      setAdminView(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  const handleRoleSwitch = (nextRole: 'member' | 'merchant' | 'lender') => {
    setRoleTab(nextRole);
    setLoginUsername('');
    setLoginPassword('');
    setSignupUsername('');
    setSignupPassword('');
    setSignupRepeatPassword('');
    setForgotUsername('');
    setResetModal(null);
    setResetNewPassword('');
    setResetRepeatPassword('');
    setResetCompleted(false);
    if (authAction === 'forgot') {
      setAuthAction('login');
    }
  };

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword) {
      onToast('Enter your username and password');
      return;
    }
    setBusy(true);
    try {
      const nextState = await api.login(loginUsername.trim(), loginPassword, roleTab);
      onAuthenticated(nextState);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    const cleanUser = signupUsername.trim();
    if (cleanUser.length < 3) {
      onToast('Create a unique username (at least 3 characters)');
      return;
    }
    if (signupPassword.length < 4) {
      onToast('Create a unique password (at least 4 characters)');
      return;
    }
    if (signupPassword !== signupRepeatPassword) {
      onToast('Passwords do not match. Please repeat the exact same password.');
      return;
    }
    setBusy(true);
    try {
      const nextState = await api.register(
        cleanUser,
        signupPassword,
        signupRepeatPassword,
        roleTab
      );
      onAuthenticated(nextState);
      onToast(`${roleTab[0].toUpperCase() + roleTab.slice(1)} account created!`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  const handleStartForgotPassword = () => {
    setForgotUsername(loginUsername.trim());
    setResetModal(null);
    setResetNewPassword('');
    setResetRepeatPassword('');
    setResetCompleted(false);
    setAuthAction('forgot');
  };

  const handleVerifyForgotUsername = async () => {
    const cleanUser = forgotUsername.trim();
    if (!cleanUser) {
      onToast('Enter your username to reset your password');
      return;
    }
    setBusy(true);
    try {
      const res = await api.verifyForgotPassword(cleanUser, roleTab);
      setResetNewPassword('');
      setResetRepeatPassword('');
      setResetCompleted(false);
      setResetModal({
        resetToken: res.resetToken,
        username: res.username,
        role: res.role,
      });
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not verify username');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveResetPassword = async () => {
    if (!resetModal) return;
    if (resetNewPassword.length < 4) {
      onToast('Create a new password (at least 4 characters)');
      return;
    }
    if (resetNewPassword !== resetRepeatPassword) {
      onToast('Passwords do not match. Please repeat the exact same new password.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.resetForgotPassword(
        resetModal.resetToken,
        resetNewPassword,
        resetRepeatPassword
      );
      setResetCompleted(true);
      setLoginUsername(res.username);
      setLoginPassword('');
      setAuthAction('login');
      onToast('Password updated! Your new password replaced the old one.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  const closeResetModal = () => {
    setResetModal(null);
    setResetNewPassword('');
    setResetRepeatPassword('');
    setResetCompleted(false);
  };

  const handleAdminSubmit = async () => {
    if (adminPass.length < 4) {
      onToast('Enter admin password (4+ chars)');
      return;
    }
    setBusy(true);
    try {
      const nextState =
        adminView === 'adminClaim'
          ? await api.adminClaim(adminPass)
          : await api.adminLogin(adminPass);
      setAdminView(null);
      onAuthenticated(nextState);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Admin sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  if (adminView) {
    return (
      <div>
        <div className="row sp" style={{ marginBottom: '6px' }}>
          <h3>{adminView === 'adminClaim' ? 'Set Initial Admin Password' : 'Admin Dashboard Login'}</h3>
          <button
            type="button"
            className="btn o sm"
            onClick={() => setAdminView(null)}
          >
            Back
          </button>
        </div>
        <p className="mu">
          {adminView === 'adminClaim'
            ? 'First-time setup: choose a unique admin password to secure the private Admin dashboard.'
            : 'Private admin dashboard — login required.'}
        </p>
        <PasswordInput
          placeholder="Admin password"
          value={adminPass}
          onChange={(e) => setAdminPass(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAdminSubmit();
          }}
        />
        <button className="btn y bl" disabled={busy} onClick={() => void handleAdminSubmit()}>
          {busy
            ? 'Verifying...'
            : adminView === 'adminClaim'
              ? 'Set Admin Password & Enter'
              : 'Enter Admin Dashboard'}
        </button>
      </div>
    );
  }

  const roleLabel = roleTab[0].toUpperCase() + roleTab.slice(1);
  const demo = DEMO_CREDS[roleTab];

  return (
    <div>
      <div className="row sp">
        <div className="row" style={{ gap: '8px' }}>
          <img
            src={`${import.meta.env.BASE_URL}assets/aistudio/Buyoll_Shopping_Cart_Logo_23c2cc30.png`}
            alt="Buyoll"
            style={{ height: '32px', width: 'auto', display: 'block', objectFit: 'contain' }}
          />
          <b style={{ fontSize: '16px' }}>Account</b>
        </div>
          {onClose && (
            <button type="button" className="btn o sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className="tabs">
          {(['member', 'merchant', 'lender'] as const).map((r) => (
            <a key={r} className={roleTab === r ? 'on' : ''} onClick={() => handleRoleSwitch(r)}>
              {r[0].toUpperCase() + r.slice(1)}
            </a>
          ))}
        </div>

        <div className="row" style={{ marginBottom: '8px' }}>
          <button
            type="button"
            className={`btn sm bl ${authAction === 'login' ? '' : 'o'}`}
            onClick={() => setAuthAction('login')}
          >
            {roleLabel} Login
          </button>
          <button
            type="button"
            className={`btn sm bl ${authAction === 'signup' ? '' : 'o'}`}
            onClick={() => setAuthAction('signup')}
          >
            {roleLabel} Sign Up
          </button>
        </div>

        {authAction === 'signup' && (
          <>
            <p className="mu" style={{ marginBottom: '6px' }}>
              {roleTab === 'member'
                ? 'Create a unique username and password to join groups and pay daily.'
                : `🔒 Private ${roleTab} dashboard — sign up with a unique username and password.`}
            </p>
            <label className="mu">Username</label>
            <input
              placeholder={`Create a unique ${roleTab} username`}
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
              autoComplete="username"
            />
            <label className="mu">Password</label>
            <PasswordInput
              placeholder="Create a unique password (min 4 characters)"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              autoComplete="new-password"
            />
            <label className="mu">Repeat Password</label>
            <PasswordInput
              placeholder="Repeat the same password"
              value={signupRepeatPassword}
              onChange={(e) => setSignupRepeatPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSignUp();
              }}
            />
            <button
              className="btn y bl"
              disabled={busy}
              onClick={() => void handleSignUp()}
            >
              {busy ? 'Creating Account...' : `Sign Up as ${roleLabel} →`}
            </button>
          </>
        )}

        {authAction === 'login' && (
          <>
            <p className="mu" style={{ marginBottom: '6px' }}>
              {roleTab === 'member'
                ? 'Log in with your Member username and password.'
                : `🔒 Private ${roleTab} dashboard — login required.`}
            </p>
            <label className="mu">Username</label>
            <input
              placeholder={`Enter your ${roleTab} username`}
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              autoComplete="username"
            />
            <div className="row sp" style={{ marginTop: '4px' }}>
              <label className="mu">Password</label>
              <button
                type="button"
                onClick={handleStartForgotPassword}
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  color: 'var(--pu2)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Forgot Password?
              </button>
            </div>
            <PasswordInput
              placeholder="Enter your password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleLogin();
              }}
            />
            <button
              className="btn y bl"
              disabled={busy}
              onClick={() => void handleLogin()}
            >
              {busy ? 'Signing in...' : `${roleLabel} Login →`}
            </button>
          </>
        )}

        {authAction === 'forgot' && (
          <>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <b>Reset {roleLabel} Password</b>
              <button
                type="button"
                className="btn o sm"
                onClick={() => setAuthAction('login')}
              >
                Back to Login
              </button>
            </div>
            <p className="mu" style={{ marginBottom: '6px' }}>
              Enter your {roleTab} username to open a private screen and create a new password.
            </p>
            <label className="mu">Username</label>
            <input
              placeholder={`Enter your ${roleTab} username`}
              value={forgotUsername}
              onChange={(e) => setForgotUsername(e.target.value)}
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleVerifyForgotUsername();
              }}
            />
            <button
              type="button"
              className="btn y bl"
              disabled={busy}
              onClick={() => void handleVerifyForgotUsername()}
            >
              {busy ? 'Checking Username...' : 'Reset Password →'}
            </button>
          </>
        )}

        <div className="row sp" style={{ marginTop: '12px', fontSize: '13px' }}>
          <span
            style={{ color: 'var(--pu2)', cursor: 'pointer' }}
            onClick={() => {
              setAuthAction('login');
              setLoginUsername(demo.username);
              setLoginPassword(demo.password);
              onToast(`Demo ${roleTab}: ${demo.username} / ${demo.password}`);
            }}
          >
            Fill Demo ({demo.username})
          </span>
          <span style={{ cursor: 'pointer' }}>
            <u onClick={() => void openAdminPrompt()}>Admin Login</u>
          </span>
        </div>
      {resetModal && (
        <div
          className="mod"
          style={{ zIndex: 35 }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) closeResetModal();
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <div className="row sp" style={{ marginBottom: '8px' }}>
              <h3 style={{ fontSize: '17px' }}>🔒 Create New Password</h3>
              <button
                type="button"
                className="btn o sm"
                aria-label="Cancel password reset"
                onClick={closeResetModal}
              >
                ✕
              </button>
            </div>
            <p className="mu" style={{ marginBottom: '10px' }}>
              Private reset for <b>@{resetModal.username}</b> ({resetModal.role}). Your new
              password will replace your old password.
            </p>

            {resetCompleted ? (
              <div className="card" style={{ borderColor: 'var(--gr)', marginTop: 0 }}>
                <b style={{ color: 'var(--gr)' }}>✔ Password Replaced</b>
                <p className="mu" style={{ marginTop: '4px', marginBottom: '10px' }}>
                  Your new password is active for <b>@{resetModal.username}</b>. Close this screen
                  with ✕ to log in.
                </p>
                <button
                  type="button"
                  className="btn y bl"
                  onClick={closeResetModal}
                >
                  Close &amp; Login
                </button>
              </div>
            ) : (
              <>
                <label className="mu">New Password</label>
                <PasswordInput
                  placeholder="Create a unique new password (min 4 chars)"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <label className="mu">Repeat New Password</label>
                <PasswordInput
                  placeholder="Repeat your new password"
                  value={resetRepeatPassword}
                  onChange={(e) => setResetRepeatPassword(e.target.value)}
                  autoComplete="new-password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveResetPassword();
                  }}
                />
                <button
                  type="button"
                  className="btn y bl"
                  disabled={busy}
                  onClick={() => void handleSaveResetPassword()}
                >
                  {busy ? 'Saving Password...' : 'Save New Password →'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
