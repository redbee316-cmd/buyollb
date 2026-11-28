import type { AiInquiry, AppState, Role } from '../types/buyoll';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const res = await fetch(targetUrl, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  adminStatus: () => apiFetch<{ configured: boolean }>('/api/auth/admin-status'),

  adminClaim: async (password: string) => {
    const res = await apiFetch<{ token: string; state: AppState }>('/api/auth/admin-claim', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAuthToken(res.token);
    return res.state;
  },

  adminLogin: async (password: string) => {
    const res = await apiFetch<{ token: string; state: AppState }>('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAuthToken(res.token);
    return res.state;
  },

  login: async (username: string, password: string, role: Exclude<Role, 'admin'>) => {
    const res = await apiFetch<{ token: string; state: AppState }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
    setAuthToken(res.token);
    return res.state;
  },

  register: async (
    username: string,
    password: string,
    repeatPassword: string,
    role: Exclude<Role, 'admin'>
  ) => {
    const res = await apiFetch<{ token: string; state: AppState }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, repeatPassword, role }),
    });
    setAuthToken(res.token);
    return res.state;
  },

  verifyForgotPassword: (username: string, role: Exclude<Role, 'admin'>) =>
    apiFetch<{ resetToken: string; username: string; role: Exclude<Role, 'admin'> }>(
      '/api/auth/forgot-password/verify',
      {
        method: 'POST',
        body: JSON.stringify({ username, role }),
      }
    ),

  resetForgotPassword: (
    resetToken: string,
    newPassword: string,
    repeatPassword: string
  ) =>
    apiFetch<{ ok: boolean; username: string; role: Exclude<Role, 'admin'> }>(
      '/api/auth/forgot-password/reset',
      {
        method: 'POST',
        body: JSON.stringify({ resetToken, newPassword, repeatPassword }),
      }
    ),

  logout: async () => {
    try {
      if (memoryToken) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
    } finally {
      setAuthToken(null);
    }
  },

  fetchPublicShop: () => apiFetch<{ state: AppState }>('/api/shop').then((r) => r.state),

  fetchState: () => apiFetch<{ state: AppState }>('/api/state').then((r) => r.state),

  fetchNotifications: () =>
    apiFetch<{ notifications: AppState['nt']; unreadCount: number }>('/api/notifications'),

  markNotificationsRead: (id?: string) =>
    apiFetch<{ state: AppState }>('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify(id ? { id } : {}),
    }).then((r) => r.state),

  clearReadNotifications: () =>
    apiFetch<{ state: AppState }>('/api/notifications/clear', { method: 'POST' }).then(
      (r) => r.state
    ),

  toggleWishlist: (pid: number) =>
    apiFetch<{ saved: boolean; state: AppState }>('/api/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ pid }),
    }),

  uploadImage: (dataUrl: string, filename: string) =>
    apiFetch<{ url: string }>('/api/upload-image', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, filename }),
    }),

  createProduct: (payload: {
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
  }) =>
    apiFetch<{ productId: number; state: AppState }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProductTill: (pid: number, till: string) =>
    apiFetch<{ state: AppState }>(`/api/products/${pid}/till`, {
      method: 'PATCH',
      body: JSON.stringify({ till }),
    }).then((r) => r.state),

  promoteProduct: (pid: number, tier: 'featured' | 'promoted' | 'both') =>
    apiFetch<{ state: AppState }>(`/api/products/${pid}/promote`, {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }).then((r) => r.state),

  joinGroup: (
    pid: number,
    gn: string,
    referral?: { referredBy?: string; referralCode?: string; knowsMember?: boolean }
  ) =>
    apiFetch<{ joinedImmediately: boolean; state: AppState }>('/api/groups/join', {
      method: 'POST',
      body: JSON.stringify({
        pid,
        gn,
        referredBy: referral?.referredBy || '',
        referralCode: referral?.referralCode || '',
        knowsMember: referral?.knowsMember ?? false,
      }),
    }),

  decideJoinRequest: (requestId: string, approve: boolean, reason = '') =>
    apiFetch<{ state: AppState }>(`/api/groups/join-requests/${requestId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ approve, reason }),
    }).then((r) => r.state),

  appointModerator: (pid: number, gn: string, candidateName: string, directTransfer = false) =>
    apiFetch<{ appointed: boolean; moderatorName: string; state: AppState }>(
      '/api/groups/appoint-moderator',
      {
        method: 'POST',
        body: JSON.stringify({ pid, gn, candidateName, directTransfer }),
      }
    ),

  enforceGroupPayment: (
    pid: number,
    gn: string,
    memberIdx: number,
    action: 'remind' | 'warn' | 'clear_pin',
    message = ''
  ) =>
    apiFetch<{ state: AppState }>('/api/groups/enforce-payment', {
      method: 'POST',
      body: JSON.stringify({ pid, gn, memberIdx, action, message }),
    }).then((r) => r.state),

  updateGroupRules: (pid: number, gn: string, rules: string) =>
    apiFetch<{ state: AppState }>('/api/groups/rules', {
      method: 'PUT',
      body: JSON.stringify({ pid, gn, rules }),
    }).then((r) => r.state),

  approveJoin: (pid: number, gn: string) =>
    apiFetch<{ state: AppState }>('/api/groups/approve-join', {
      method: 'POST',
      body: JSON.stringify({ pid, gn }),
    }).then((r) => r.state),

  payGroup: (
    pid: number,
    gn: string,
    code: string,
    amount: number,
    payMethod: 'wallet' | 'mpesa' = 'mpesa'
  ) =>
    apiFetch<{ state: AppState }>('/api/groups/pay', {
      method: 'POST',
      body: JSON.stringify({ pid, gn, code, amount, payMethod }),
    }).then((r) => r.state),

  decideGroupPayment: (paymentId: number, approve: boolean) =>
    apiFetch<{ state: AppState }>(`/api/group-payments/${paymentId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    }).then((r) => r.state),

  tickMember: (pid: number, gn: string, memberIdx: number) =>
    apiFetch<{ state: AppState }>('/api/groups/tick', {
      method: 'POST',
      body: JSON.stringify({ pid, gn, memberIdx }),
    }).then((r) => r.state),

  rotateGroup: (pid: number, gn: string) =>
    apiFetch<{ handedTo: string; state: AppState }>('/api/groups/rotate', {
      method: 'POST',
      body: JSON.stringify({ pid, gn }),
    }),

  submitDeposit: (code: string, amt: number, phone: string) =>
    apiFetch<{ state: AppState }>('/api/deposits', {
      method: 'POST',
      body: JSON.stringify({ code, amt, phone }),
    }).then((r) => r.state),

  decideDeposit: (id: number, approve: boolean, reason = '') =>
    apiFetch<{ state: AppState }>(`/api/deposits/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ approve, reason }),
    }).then((r) => r.state),

  requestLoan: (payload: {
    lenderId: number;
    amt: number;
    pid?: number;
    gn?: string;
    ctx: string;
    phone?: string;
    memberName?: string;
    memberCode?: string;
  }) =>
    apiFetch<{ state: AppState }>('/api/loans/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((r) => r.state),

  decideLoan: (id: number, approve: boolean) =>
    apiFetch<{ state: AppState }>(`/api/loans/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    }).then((r) => r.state),

  transferLoan: (id: number, amount: number) =>
    apiFetch<{ state: AppState }>(`/api/loans/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }).then((r) => r.state),

  disburseLoan: (id: number, disbursedDate: string, completionDate: string) =>
    apiFetch<{ state: AppState }>(`/api/loans/${id}/disburse`, {
      method: 'POST',
      body: JSON.stringify({ disbursedDate, completionDate }),
    }).then((r) => r.state),

  completeLoan: (loanId: string) =>
    apiFetch<{ state: AppState }>(`/api/loans/${encodeURIComponent(loanId)}/complete`, {
      method: 'POST',
    }).then((r) => r.state),

  subscribePlan: (planIndex: number) =>
    apiFetch<{ state: AppState }>('/api/merchant/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planIndex }),
    }).then((r) => r.state),

  adminToggleHide: (pid: number) =>
    apiFetch<{ state: AppState }>(`/api/admin/products/${pid}/toggle-hide`, {
      method: 'POST',
    }).then((r) => r.state),

  adminToggleFeature: (pid: number) =>
    apiFetch<{ state: AppState }>(`/api/admin/products/${pid}/toggle-feature`, {
      method: 'POST',
    }).then((r) => r.state),

  adminTogglePromote: (pid: number) =>
    apiFetch<{ state: AppState }>(`/api/admin/products/${pid}/toggle-promote`, {
      method: 'POST',
    }).then((r) => r.state),

  adminRemoveProduct: (pid: number) =>
    apiFetch<{ state: AppState }>(`/api/admin/products/${pid}`, {
      method: 'DELETE',
    }).then((r) => r.state),

  adminToggleSuspend: (merchant: string) =>
    apiFetch<{ state: AppState }>('/api/admin/merchants/toggle-suspend', {
      method: 'POST',
      body: JSON.stringify({ merchant }),
    }).then((r) => r.state),

  adminTogglePlan: (merchant?: string) =>
    apiFetch<{ state: AppState }>('/api/admin/plan/toggle', {
      method: 'POST',
      body: JSON.stringify(merchant ? { merchant } : {}),
    }).then((r) => r.state),

  adminSaveSettings: (till: string, banner: string) =>
    apiFetch<{ state: AppState }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ till, banner }),
    }).then((r) => r.state),

  getProductAiHistory: (pid: number) =>
    apiFetch<{ history: AiInquiry[]; canViewInsights: boolean }>(
      `/api/products/${pid}/ai-history`
    ),

  askProductAi: (pid: number, question: string) =>
    apiFetch<{ inquiry: AiInquiry; history: AiInquiry[]; canViewInsights: boolean }>(
      `/api/products/${pid}/ai-chat`,
      {
        method: 'POST',
        body: JSON.stringify({ question }),
      }
    ),

  resetDemo: () =>
    apiFetch<{ state: AppState }>('/api/demo/reset', {
      method: 'POST',
    }).then((r) => r.state),
};
