export type Role = 'member' | 'merchant' | 'lender' | 'admin';
export type Tab =
  | 'home'
  | 'groups'
  | 'wallet'
  | 'wishlist'
  | 'profile'
  | 'products'
  | 'loans'
  | 'users'
  | 'fin'
  | 'set';

export type NotificationCategory = 'payment' | 'approval' | 'group' | 'loan' | 'moderation' | 'system';

export interface NotificationItem {
  id?: string;
  userId?: string;
  r: Role;
  t: string;
  s: 0 | 1;
  category?: NotificationCategory;
  createdAt?: string;
}

export interface TransactionItem {
  id?: string;
  userId?: string;
  t: string;
  a: number;
  d: string;
  k: 'c' | 'l' | 'p';
  r?: Role;
  loanCode?: string;
  entryType?: 'debit' | 'credit';
  source?: string;
}

export interface Plan {
  n: string;
  term: 'Monthly' | 'Annual';
  price: number;
  max: number;
  days: number;
  active?: boolean;
  exp?: string;
  ts?: number;
}

export interface GroupMember {
  n: string;
  /** Days paid in the current active 10-day tracking window (0..10) */
  d: number;
  /** Total days paid across all 10-day rounds (0..capacity*10) */
  totalPaid: number;
  /** Individual 10-day tracking history per round [round1Days, round2Days, ...] */
  rounds: number[];
  mod?: boolean;
  pin?: boolean;
  me?: boolean;
  referredBy?: string;
  warnings?: number;
  lastRemindedAt?: string;
}

export interface ProductGroup {
  /** Group letter A..J corresponding strictly to size 1..10 */
  n: string;
  /** Strictly enforced member capacity 1..10 (Group A=1, B=2, ..., J=10) */
  c: number;
  r: GroupMember[];
  j: number;
  rot: number;
  done?: boolean;
  rules?: string;
  moderatorVotes?: Record<string, number>;
  myModVote?: string;
}

export interface PendingJoinRequest {
  id: string;
  pid: number;
  gn: string;
  productName?: string;
  memberName: string;
  referredBy: string;
  referralCode?: string;
  knowsMember: boolean;
  st: 'pending' | 'approved' | 'declined';
  decidedBy?: string;
  reason?: string;
  isMe?: boolean;
  createdAt: string;
}

export interface AiInquiry {
  id: string;
  userId: string;
  userName: string;
  question: string;
  answer: string;
  timestamp: string;
}

export interface Product {
  id: number;
  n: string;
  cat: string;
  p: number;
  o: number;
  m: string;
  till: string;
  loc: string;
  stock: number;
  e: string;
  img?: string;
  b?: number;
  t: string;
  desc: string;
  g: ProductGroup[];
  featured?: boolean;
  promoted?: boolean;
  featuredUntil?: number;
  promotedUntil?: number;
  attributes?: Record<string, string>;
  bonusGift?: string;
  aiInquiries?: AiInquiry[];
}

export interface MyGroupEntry {
  pid: number;
  g: string;
  st: 'pending' | 'ok';
}

export interface PendingGroupPayment {
  id: number;
  pid: number;
  productName: string;
  g: string;
  memberName: string;
  isMe?: boolean;
  merchant: string;
  till: string;
  code: string;
  amount: number;
  dailyAmount: number;
  daysCount: number;
  st: 'pending' | 'approved' | 'declined';
  reason?: string;
  createdAt: string;
}

export interface DepositItem {
  id: number;
  userId?: string;
  by: string;
  amt: number;
  code: string;
  phone?: string;
  st: 'pending' | 'approved' | 'declined';
  role?: Role;
  reason?: string;
}

export type LoanRequestStatus =
  | 'pending'
  | 'approved'
  | 'transferred'
  | 'disbursed'
  | 'declined';

export interface LoanRequest {
  id: number;
  userId?: string;
  by: string;
  memberCode?: string;
  phone?: string;
  me?: number;
  amt: number;
  lender: number;
  pid?: number;
  gn?: string;
  st: LoanRequestStatus;
  ctx: string;
  score: number;
  loc: string;
  createdAt?: string;
  declinedBy?: string[];
  approvedByUserId?: string;
  approvedAt?: string;
  borrowerWalletBalance?: number;
  disbursedAmt?: number;
  commissionAmt?: number;
  netAmt?: number;
  transferredAt?: string;
  disbursedDate?: string;
  completionDate?: string;
  lenderName?: string;
  loanCode?: string;
  idempotencyKey?: string;
}

export interface LoanItem {
  id: string;
  requestId?: number;
  amt: number;
  st: 'Active' | 'Paid';
  lender: number;
  lenderId?: string;
  lenderName?: string;
  who: string;
  memberCode?: string;
  phone?: string;
  pid?: number;
  gn?: string;
  commissionAmt?: number;
  netAmt?: number;
  disbursedDate?: string;
  completionDate?: string;
}

export type RevenueCategory =
  | 'subscription'
  | 'loan_commission'
  | 'featured_spotlight'
  | 'promotional_deal';

export interface RevenueEntry {
  id: string;
  category: RevenueCategory;
  source?: string;
  loanCode?: string;
  borrowerName?: string;
  amount: number;
  sourceUser: string;
  description: string;
  timestamp: number;
  dateLabel: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorUserId: string;
  actorRole: Role;
  actorName: string;
  loanRequestId: number;
  loanCode: string;
  borrowerName: string;
  amount: number;
  commission: number;
  netAmount: number;
  idempotencyKey: string;
  timestamp: string;
}

export interface LenderInfo {
  id: number;
  n: string;
  loc: string;
  range: string;
}

export interface AppState {
  v: number;
  role: Role | null;
  tab: Tab;
  view: string | null;
  sel: string | number | null;
  name: string;
  mf: string;
  cf: string;
  q: string;
  wallet: number;
  loanCredit?: number;
  memberCode?: string;
  mw: number;
  lw: number;
  nt: NotificationItem[];
  tx: TransactionItem[];
  plan: Plan;
  products: Product[];
  my: MyGroupEntry[];
  groupPayments: PendingGroupPayment[];
  deposits: DepositItem[];
  lr: LoanRequest[];
  loans: LoanItem[];
  lent: number;
  rev: number;
  subRev: number;
  promoRev?: number;
  fee: number;
  users: number;
  hidden: number[];
  feat: number[];
  promo?: number[];
  sus: string[];
  till: string;
  banner: string;
  currentUserId?: string;
  lenderId?: number;
  lenders?: LenderInfo[];
  registeredMembers?: string[];
  registeredMerchants?: string[];
  registeredLenders?: string[];
  wishlist?: number[];
  joinRequests?: PendingJoinRequest[];
  merchantPlans?: Record<string, { n: string; term: string; active: boolean; exp?: string; max: number }>;
  revenueLedger?: RevenueEntry[];
}
