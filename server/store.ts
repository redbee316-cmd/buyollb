import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_TILLS, LN, PL, defState } from '../src/utils/defaults.ts';
export { PROMO_TIERS, type PromoTierId } from '../src/utils/defaults.ts';
import type {
  AiInquiry,
  AppState,
  DepositItem,
  GroupMember,
  LenderInfo,
  LoanItem,
  LoanRequest,
  MyGroupEntry,
  NotificationCategory,
  NotificationItem,
  PendingGroupPayment,
  PendingJoinRequest,
  Plan,
  Product,
  ProductGroup,
  RevenueCategory,
  RevenueEntry,
  Role,
  TransactionItem,
} from '../src/types/buyoll.ts';
import {
  BM,
  C10,
  GROUP_LETTERS,
  K,
  ME,
  creditMemberDays,
  enforceProductGroups,
  getMemberTracking,
  inst,
} from '../src/utils/format.ts';

export interface StoredUser {
  id: string;
  username: string;
  name: string;
  phone?: string;
  role: Exclude<Role, 'admin'>;
  merchantName?: string;
  lenderId?: number;
  loc?: string;
  range?: string;
  wallet: number;
  loanCredit?: number;
  memberCode?: string;
  plan?: Plan;
  salt: string;
  passwordHash: string;
  canonicalPasswordHash: string;
  createdAt: string;
}

export interface RoleDatabase<T extends StoredUser = StoredUser> {
  v: number;
  users: T[];
}

export interface ServerDatabase {
  v: number;
  adminCredential: { salt: string; hash: string; canonicalHash?: string } | null;
  revokedTokens: string[];
  myByUser: Record<string, MyGroupEntry[]>;
  wishlistByUser: Record<string, number[]>;
  joinRequests: Array<PendingJoinRequest & { userId?: string }>;
  moderatorVotesByGroup: Record<string, Record<string, string>>;
  plan: Plan;
  products: Product[];
  groupPayments: PendingGroupPayment[];
  deposits: DepositItem[];
  lr: LoanRequest[];
  loans: LoanItem[];
  nt: NotificationItem[];
  tx: TransactionItem[];
  lent: number;
  rev: number;
  subRev: number;
  promoRev: number;
  fee: number;
  revenueLedger: RevenueEntry[];
  usersCount: number;
  hidden: number[];
  feat: number[];
  promo: number[];
  sus: string[];
  till: string;
  banner: string;
}

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'buyoll-db.json');
const MEMBERS_DB_FILE = path.resolve(DATA_DIR, 'members-db.json');
const MERCHANTS_DB_FILE = path.resolve(DATA_DIR, 'merchants-db.json');
const LENDERS_DB_FILE = path.resolve(DATA_DIR, 'lenders-db.json');

const SCRYPT_OPTS = { N: 4096, r: 8, p: 1 };

export function canonicalUsername(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  // Normalize common visual look-alike substitutions so usernames cannot look the same
  return cleaned
    .replace(/0/g, 'o')
    .replace(/[1l]/g, 'i')
    .replace(/2/g, 'z')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');
}

export function canonicalPassword(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_.\-!@#$%^&*+=~`|\\/:;"'?,<>()[\]{}]+/g, '')
    .replace(/0/g, 'o')
    .replace(/[1l]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

export function hashPassword(password: string, existingSalt?: string): {
  salt: string;
  hash: string;
  canonicalHash: string;
} {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32, SCRYPT_OPTS).toString('hex');
  const canonicalHash = crypto
    .scryptSync(canonicalPassword(password), salt, 32, SCRYPT_OPTS)
    .toString('hex');
  return { salt, hash, canonicalHash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  // Support both 32-byte (N=4096) and legacy 64-byte (default N=16384) hashes seamlessly
  const derived =
    expectedBuf.length === 64
      ? crypto.scryptSync(password, salt, 64)
      : crypto.scryptSync(password, salt, 32, SCRYPT_OPTS);
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function writeJsonAtomic(filePath: string, data: unknown) {
  ensureDirs();
  const tmpFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, filePath);
}

function createInitialMembersDb(baseWallet: number): RoleDatabase {
  const pass = hashPassword('amina!2026');
  return {
    v: 1,
    users: [
      {
        id: 'usr-member-demo',
        username: 'amina',
        name: 'Amina',
        phone: '0712345678',
        role: 'member',
        memberCode: 'BUY-M-001',
        wallet: baseWallet,
        loanCredit: 0,
        salt: pass.salt,
        passwordHash: pass.hash,
        canonicalPasswordHash: pass.canonicalHash,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function generateMemberCode(membersDb: RoleDatabase): string {
  const used = new Set(membersDb.users.map((u) => u.memberCode).filter(Boolean));
  let seq = membersDb.users.length + 1;
  while (used.has(`BUY-M-${String(seq).padStart(3, '0')}`)) {
    seq += 1;
  }
  return `BUY-M-${String(seq).padStart(3, '0')}`;
}

function createInitialMerchantsDb(baseMw: number): RoleDatabase {
  const pass = hashPassword('betty!2026');
  return {
    v: 1,
    users: [
      {
        id: 'usr-merchant-demo',
        username: 'bettyshop',
        name: BM,
        phone: '0712345678',
        role: 'merchant',
        merchantName: BM,
        wallet: baseMw,
        plan: { ...PL[0], active: true, exp: 'Dec 1, 2026' },
        salt: pass.salt,
        passwordHash: pass.hash,
        canonicalPasswordHash: pass.canonicalHash,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function createInitialLendersDb(baseLw: number): RoleDatabase {
  const pass = hashPassword('mwangi!2026');
  return {
    v: 1,
    users: [
      {
        id: 'usr-lender-demo',
        username: 'mwangicredit',
        name: 'Mwangi Credit',
        phone: '0712345678',
        role: 'lender',
        lenderId: 1,
        loc: 'Nairobi',
        range: 'KSh 500 – 5,000',
        wallet: baseLw,
        salt: pass.salt,
        passwordHash: pass.hash,
        canonicalPasswordHash: pass.canonicalHash,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function createInitialDb(preserveAdmin?: { salt: string; hash: string; canonicalHash?: string } | null): ServerDatabase {
  const base = defState();
  return {
    v: 5,
    adminCredential: preserveAdmin ?? null,
    revokedTokens: [],
    myByUser: {},
    wishlistByUser: {},
    joinRequests: [],
    moderatorVotesByGroup: {},
    plan: base.plan,
    products: base.products.map((p) => ({
      ...p,
      till: p.till || DEFAULT_TILLS[p.m] || '542100',
      g: enforceProductGroups(p.g),
    })),
    groupPayments: [],
    deposits: base.deposits,
    lr: base.lr,
    loans: base.loans,
    nt: base.nt,
    tx: base.tx,
    lent: base.lent,
    rev: base.rev,
    subRev: base.subRev,
    promoRev: base.promoRev || 0,
    fee: base.fee,
    revenueLedger: [],
    usersCount: base.users,
    hidden: [],
    feat: base.feat || [],
    promo: base.promo || [],
    sus: [],
    till: base.till,
    banner: base.banner,
  };
}

let dbCache: ServerDatabase | null = null;
let membersCache: RoleDatabase | null = null;
let merchantsCache: RoleDatabase | null = null;
let lendersCache: RoleDatabase | null = null;

export function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function loadRoleDb(
  filePath: string,
  expectedRole: Exclude<Role, 'admin'>,
  fallbackFactory: () => RoleDatabase
): RoleDatabase {
  ensureDirs();
  if (fs.existsSync(filePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<RoleDatabase>;
      if (raw && Array.isArray(raw.users)) {
        const cleaned = raw.users.map((u, idx) => ({
          ...u,
          role: expectedRole,
          username: u.username || u.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
          canonicalPasswordHash: u.canonicalPasswordHash || u.passwordHash,
          memberCode:
            expectedRole === 'member'
              ? u.memberCode || `BUY-M-${String(idx + 1).padStart(3, '0')}`
              : u.memberCode,
          loanCredit: expectedRole === 'member' ? (u.loanCredit ?? 0) : u.loanCredit,
        }));
        return { v: 1, users: cleaned };
      }
    } catch {
      // recreate below
    }
  }
  const initial = fallbackFactory();
  writeJsonAtomic(filePath, initial);
  return initial;
}

export function getMembersDb(): RoleDatabase {
  if (membersCache) return membersCache;
  const base = defState();
  membersCache = loadRoleDb(MEMBERS_DB_FILE, 'member', () => createInitialMembersDb(base.wallet));
  return membersCache;
}

export function getMerchantsDb(): RoleDatabase {
  if (merchantsCache) return merchantsCache;
  const base = defState();
  merchantsCache = loadRoleDb(MERCHANTS_DB_FILE, 'merchant', () => createInitialMerchantsDb(base.mw));
  return merchantsCache;
}

export function getLendersDb(): RoleDatabase {
  if (lendersCache) return lendersCache;
  const base = defState();
  lendersCache = loadRoleDb(LENDERS_DB_FILE, 'lender', () => createInitialLendersDb(base.lw));
  return lendersCache;
}

export function getRoleDb(role: Exclude<Role, 'admin'>): RoleDatabase {
  if (role === 'member') return getMembersDb();
  if (role === 'merchant') return getMerchantsDb();
  return getLendersDb();
}

export function saveRoleDb(role: Exclude<Role, 'admin'>) {
  if (role === 'member' && membersCache) writeJsonAtomic(MEMBERS_DB_FILE, membersCache);
  if (role === 'merchant' && merchantsCache) writeJsonAtomic(MERCHANTS_DB_FILE, merchantsCache);
  if (role === 'lender' && lendersCache) writeJsonAtomic(LENDERS_DB_FILE, lendersCache);
}

export function getAllUsersAcrossDatabases(): StoredUser[] {
  return [
    ...getMembersDb().users,
    ...getMerchantsDb().users,
    ...getLendersDb().users,
  ];
}

export function findUserById(userId: string): StoredUser | undefined {
  return getAllUsersAcrossDatabases().find((u) => u.id === userId);
}

export function findUserByMemberName(nameOrUsername: string): StoredUser | undefined {
  const target = nameOrUsername.trim().toLowerCase();
  return getMembersDb().users.find(
    (u) => u.name.toLowerCase() === target || u.username.toLowerCase() === target
  );
}

export function findUserByMerchantName(merchantName: string): StoredUser | undefined {
  const target = merchantName.trim().toLowerCase();
  return getMerchantsDb().users.find(
    (u) =>
      (u.merchantName && u.merchantName.toLowerCase() === target) ||
      u.name.toLowerCase() === target ||
      u.username.toLowerCase() === target
  );
}

export function findUserByLenderId(lenderId: number): StoredUser | undefined {
  return getLendersDb().users.find((u) => (u.lenderId || 1) === lenderId);
}

export function pushPrivateNote(
  db: ServerDatabase,
  note: { r: Role; userId?: string; t: string; category?: NotificationCategory }
) {
  db.nt.unshift({
    id: `nt-${crypto.randomUUID()}`,
    r: note.r,
    userId: note.userId,
    t: note.t,
    s: 0,
    category: note.category || 'system',
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
}

export function recordAdminRevenue(
  db: ServerDatabase,
  entry: {
    category: RevenueCategory;
    amount: number;
    sourceUser: string;
    description: string;
  }
) {
  db.revenueLedger = db.revenueLedger || [];
  const now = new Date();
  db.revenueLedger.unshift({
    id: `rev-${crypto.randomUUID()}`,
    category: entry.category,
    amount: entry.amount,
    sourceUser: entry.sourceUser,
    description: entry.description,
    timestamp: now.getTime(),
    dateLabel: now.toISOString().slice(0, 10),
  });
}

export function getPrivateNotificationsForSession(
  db: ServerDatabase,
  session: { userId: string; role: Role }
): NotificationItem[] {
  return db.nt
    .filter((n) => {
      if (session.role === 'admin') {
        return n.r === 'admin' && (!n.userId || n.userId === 'usr-admin');
      }
      return n.userId === session.userId;
    })
    .map(({ userId: _uid, ...clean }) => clean);
}

export function getGroupModerator(
  g: ProductGroup
): (GroupMember & { userId?: string }) | undefined {
  return (g.r.find((m) => m.mod) || g.r[0]) as (GroupMember & { userId?: string }) | undefined;
}

export function isGroupModerator(
  g: ProductGroup,
  session: { userId: string; role: Role; name: string }
): boolean {
  if (session.role === 'admin') return true;
  if (session.role !== 'member') return false;
  const mod = getGroupModerator(g);
  if (!mod) return false;
  return mod.userId ? mod.userId === session.userId : mod.n === session.name;
}

export function canViewProductInsights(
  product: Product,
  session?: { userId: string; role: Role; name: string; merchantName?: string }
): boolean {
  if (!session) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'merchant') {
    const ownerName = session.merchantName || session.name;
    return product.m === ownerName;
  }
  return false;
}

export function getScopedAiHistory(
  product: Product,
  session?: { userId: string; role: Role; name: string; merchantName?: string }
): AiInquiry[] {
  const all = product.aiInquiries || [];
  if (canViewProductInsights(product, session)) {
    return all;
  }
  if (!session) return [];
  return all.filter((item) => item.userId === session.userId);
}

/**
 * Enforces global uniqueness across Members, Merchants, Lenders, and Admin:
 * - No two users may have the same or visually similar username.
 * - No two users may have the same or visually similar password.
 */
export function validateUniqueCredentials(username: string, password: string): string | null {
  const trimmedUser = username.trim();
  const lowerUser = trimmedUser.toLowerCase();
  const canonUser = canonicalUsername(trimmedUser);
  const canonPass = canonicalPassword(password);

  if (trimmedUser.length < 3 || canonUser.length < 3 || !/[a-zA-Z0-9]/.test(trimmedUser)) {
    return 'Username must be at least 3 characters (letters/numbers).';
  }
  if (canonPass.length < 3) {
    return 'Password must contain at least 3 letters or numbers.';
  }
  if (canonUser === canonPass || lowerUser === password.trim().toLowerCase()) {
    return 'Username and password cannot be the same. Please use a different password.';
  }

  const allUsers = getAllUsersAcrossDatabases();

  for (const u of allUsers) {
    if (
      u.username.toLowerCase() === lowerUser ||
      canonicalUsername(u.username) === canonUser ||
      u.name.toLowerCase() === lowerUser ||
      canonicalUsername(u.name) === canonUser
    ) {
      return 'This username is already taken or looks too similar to an existing user. Please choose a different username.';
    }
  }

  if (['admin', 'administrator', 'root'].includes(canonUser)) {
    return 'This username is reserved. Please choose a different username.';
  }

  for (const u of allUsers) {
    if (
      verifyPassword(password, u.salt, u.passwordHash) ||
      verifyPassword(canonPass, u.salt, u.canonicalPasswordHash)
    ) {
      return 'This password is already used or looks too similar to another user\'s password. Please choose a different password.';
    }
  }

  const db = getDb();
  if (db.adminCredential) {
    if (
      verifyPassword(password, db.adminCredential.salt, db.adminCredential.hash) ||
      (db.adminCredential.canonicalHash &&
        verifyPassword(canonPass, db.adminCredential.salt, db.adminCredential.canonicalHash))
    ) {
      return 'This password is already in use on the platform. Please choose a different password.';
    }
  }

  return null;
}

export function validatePasswordReset(targetUser: StoredUser, newPassword: string): string | null {
  const lowerUser = targetUser.username.trim().toLowerCase();
  const canonUser = canonicalUsername(targetUser.username);
  const canonPass = canonicalPassword(newPassword);

  if (canonPass.length < 3) {
    return 'Password must contain at least 3 letters or numbers.';
  }
  if (canonUser === canonPass || lowerUser === newPassword.trim().toLowerCase()) {
    return 'Your new password cannot be the same as your username. Please choose a different password.';
  }

  if (
    verifyPassword(newPassword, targetUser.salt, targetUser.passwordHash) ||
    verifyPassword(canonPass, targetUser.salt, targetUser.canonicalPasswordHash)
  ) {
    return 'Please choose a new password that is different from your current password.';
  }

  const allUsers = getAllUsersAcrossDatabases();
  for (const u of allUsers) {
    if (u.id === targetUser.id) continue;
    if (
      verifyPassword(newPassword, u.salt, u.passwordHash) ||
      verifyPassword(canonPass, u.salt, u.canonicalPasswordHash)
    ) {
      return 'This password is already used or looks too similar to another user\'s password. Please choose a different password.';
    }
  }

  const db = getDb();
  if (db.adminCredential) {
    if (
      verifyPassword(newPassword, db.adminCredential.salt, db.adminCredential.hash) ||
      (db.adminCredential.canonicalHash &&
        verifyPassword(canonPass, db.adminCredential.salt, db.adminCredential.canonicalHash))
    ) {
      return 'This password is already in use on the platform. Please choose a different password.';
    }
  }

  return null;
}

export function getDb(): ServerDatabase {
  if (dbCache) return dbCache;
  ensureDirs();
  // Ensure separate role databases are initialized on startup
  getMembersDb();
  getMerchantsDb();
  getLendersDb();

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<ServerDatabase>;
      if (raw && raw.v === 5 && Array.isArray(raw.products)) {
        const normalizedProducts = raw.products.map((p) => ({
          ...p,
          till: p.till || DEFAULT_TILLS[p.m] || '542100',
          g: enforceProductGroups(p.g || []),
        }));
        dbCache = {
          ...createInitialDb(raw.adminCredential),
          ...raw,
          products: normalizedProducts,
          revokedTokens: (raw.revokedTokens || []).slice(-500),
        };
        return dbCache;
      }
    } catch {
      // fall through to recreate clean db
    }
  }
  dbCache = createInitialDb();
  saveDb();
  return dbCache;
}

export function saveDb() {
  if (!dbCache) return;
  writeJsonAtomic(DB_FILE, dbCache);
}

export function resetDemoDb(keepAdmin = true) {
  const current = getDb();
  const savedAdmin = keepAdmin ? current.adminCredential : null;
  const base = defState();
  dbCache = createInitialDb(savedAdmin);
  membersCache = createInitialMembersDb(base.wallet);
  merchantsCache = createInitialMerchantsDb(base.mw);
  lendersCache = createInitialLendersDb(base.lw);
  saveDb();
  saveRoleDb('member');
  saveRoleDb('merchant');
  saveRoleDb('lender');
  return dbCache;
}

export function advanceGroupRotations(
  g: ProductGroup,
  productName: string,
  merchantName: string,
  pushNote: (r: Role, t: string, userId?: string) => void
): ProductGroup {
  if (g.done || g.r.length < g.c) return g;
  let rot = g.rot;
  let done = Boolean(g.done);
  const merchantUserId = findUserByMerchantName(merchantName)?.id;

  while (!done && g.r.every((m) => getMemberTracking(m, g.c).totalPaid >= rot * 10)) {
    const receiver = g.r[rot - 1] as (GroupMember & { userId?: string }) | undefined;
    if (receiver) {
      const receiverUserId = receiver.userId || findUserByMemberName(receiver.n)?.id;
      pushNote(
        'merchant',
        `Deliver ${productName} to ${receiver.n} (Group ${g.n} Round ${rot})`,
        merchantUserId
      );
      pushNote(
        'member',
        `🎁 Round ${rot} complete! ${receiver.n}'s ${productName} is ready for delivery!`,
        receiverUserId
      );
    }
    if (rot >= g.c) {
      done = true;
    } else {
      rot += 1;
    }
  }

  return { ...g, rot, done };
}

function buildAllLendersList(): LenderInfo[] {
  const dbLenders = getLendersDb().users;
  const extras: LenderInfo[] = dbLenders
    .filter((u) => (u.lenderId || 1) > 3)
    .map((u) => ({
      id: u.lenderId!,
      n: u.name,
      loc: u.loc || 'Nairobi',
      range: u.range || 'KSh 500 – 10,000',
    }));
  return [...LN, ...extras];
}

export function isPlanCurrentlyActive(plan: Plan | undefined | null): boolean {
  if (!plan || !plan.active) return false;
  if (plan.ts && plan.ts < Date.now()) return false;
  return true;
}

export function getMerchantPlan(
  merchantUser: StoredUser | undefined,
  db: ServerDatabase
): Plan {
  if (merchantUser?.plan) return merchantUser.plan;
  if (merchantUser?.id === 'usr-merchant-demo') return db.plan;
  return {
    ...PL[0],
    active: false,
    exp: 'Not subscribed',
  };
}

export function buildClientState(
  db: ServerDatabase,
  session: { userId: string; role: Role; name: string; merchantName?: string; lenderId?: number }
): AppState {
  const membersDb = getMembersDb();
  const merchantsDb = getMerchantsDb();
  const lendersDb = getLendersDb();

  const currentMember = membersDb.users.find((u) => u.id === session.userId);
  const currentMerchant = merchantsDb.users.find((u) => u.id === session.userId);
  const currentLender = lendersDb.users.find((u) => u.id === session.userId);

  const memberWallet =
    session.role === 'member'
      ? currentMember?.wallet ?? 0
      : membersDb.users[0]?.wallet ?? 1250;
  const merchantWallet =
    session.role === 'merchant'
      ? currentMerchant?.wallet ?? 0
      : merchantsDb.users[0]?.wallet ?? 12450;
  const lenderWallet =
    session.role === 'lender'
      ? currentLender?.wallet ?? 0
      : lendersDb.users[0]?.wallet ?? 5000;

  const myGroups = session.role === 'member' ? db.myByUser[session.userId] || [] : [];

  const now = Date.now();
  const activeFeatIds = db.products
    .filter((p) => {
      const activeByFlag = p.featured && (!p.featuredUntil || p.featuredUntil >= now);
      return activeByFlag || db.feat.includes(p.id);
    })
    .map((p) => p.id);
  const activePromoIds = db.products
    .filter((p) => {
      const activeByFlag = p.promoted && (!p.promotedUntil || p.promotedUntil >= now);
      return activeByFlag || (db.promo || []).includes(p.id);
    })
    .map((p) => p.id);

  const votesMap = db.moderatorVotesByGroup || {};

  const productsForUser: Product[] = db.products.map((p) => ({
    ...p,
    aiInquiries: getScopedAiHistory(p, session),
    featured: activeFeatIds.includes(p.id),
    promoted: activePromoIds.includes(p.id),
    g: enforceProductGroups(
      p.g.map((g) => {
        const groupVotes = votesMap[`${p.id}:${g.n}`] || {};
        const counts: Record<string, number> = {};
        Object.values(groupVotes).forEach((candidate) => {
          counts[candidate] = (counts[candidate] || 0) + 1;
        });
        return {
          ...g,
          moderatorVotes: counts,
          myModVote: session.role === 'member' ? groupVotes[session.userId] : undefined,
          r: g.r.map((m) => {
            const { userId, ...cleanMember } = m as GroupMember & { userId?: string };
            const isCurrentMember =
              session.role === 'member' &&
              (userId ? userId === session.userId : m.n === session.name);
            return {
              ...cleanMember,
              me: isCurrentMember,
            };
          }),
        };
      })
    ),
  }));

  const groupPaymentsForUser = db.groupPayments.map((gp) => ({
    ...gp,
    isMe: session.role === 'member' ? gp.memberName === session.name : gp.isMe,
  }));

  const lrForUser = db.lr.map((r) => {
    const matchedMember =
      (r.userId ? membersDb.users.find((u) => u.id === r.userId) : undefined) ||
      membersDb.users.find((u) => u.name.toLowerCase() === r.by.toLowerCase());
    const canSeeBorrowerWallet =
      session.role === 'admin' ||
      (r.approvedByUserId && r.approvedByUserId === session.userId) ||
      (r.userId && r.userId === session.userId);
    return {
      ...r,
      memberCode: r.memberCode || matchedMember?.memberCode || 'BUY-M-000',
      phone: r.phone || matchedMember?.phone || '',
      borrowerWalletBalance: canSeeBorrowerWallet ? (matchedMember?.wallet ?? 0) : undefined,
      me:
        session.role === 'member' &&
        ((r.userId && r.userId === session.userId) || r.by === session.name)
          ? 1
          : r.me,
    };
  });

  const totalRegistered =
    membersDb.users.length + merchantsDb.users.length + lendersDb.users.length;

  const privateNotifications = getPrivateNotificationsForSession(db, session);

  const validProductIds = new Set(db.products.map((p) => p.id));
  const userWishlist = (db.wishlistByUser?.[session.userId] || []).filter((id) =>
    validProductIds.has(id)
  );

  const visibleJoinRequests: PendingJoinRequest[] = (db.joinRequests || [])
    .filter((jr) => {
      if (session.role === 'admin') return true;
      if (jr.userId === session.userId) return true;
      if (session.role === 'member') {
        const prod = db.products.find((p) => p.id === jr.pid);
        const grp = prod?.g.find((g) => g.n === jr.gn);
        if (!grp) return false;
        return grp.r.some((m) => {
          const typed = m as GroupMember & { userId?: string };
          return typed.userId ? typed.userId === session.userId : m.n === session.name;
        });
      }
      return false;
    })
    .map(({ userId, ...cleanReq }) => ({
      ...cleanReq,
      isMe: userId === session.userId,
    }));

  const effectivePlan =
    session.role === 'merchant'
      ? getMerchantPlan(currentMerchant, db)
      : db.plan;

  const merchantPlans =
    session.role === 'admin'
      ? Object.fromEntries(
          merchantsDb.users.map((u) => {
            const mp = getMerchantPlan(u, db);
            return [
              u.merchantName || u.name,
              {
                n: mp.n,
                term: mp.term || 'Monthly',
                active: isPlanCurrentlyActive(mp),
                exp: mp.exp,
                max: mp.max,
              },
            ];
          })
        )
      : undefined;

  const visibleDeposits =
    session.role === 'admin'
      ? db.deposits
      : db.deposits.filter((d) =>
          d.userId
            ? d.userId === session.userId
            : d.by === session.name && (d.role || 'member') === session.role
        );

  const visibleTx =
    session.role === 'admin'
      ? db.tx
      : db.tx.filter((t) =>
          t.userId ? t.userId === session.userId : (t.r || 'member') === session.role
        );

  return {
    v: 5,
    role: session.role,
    tab: 'home',
    view: null,
    sel: null,
    name: session.name,
    mf: 'All',
    cf: 'All',
    q: '',
    wallet: memberWallet,
    loanCredit: session.role === 'member' ? (currentMember?.loanCredit ?? 0) : 0,
    memberCode: session.role === 'member' ? (currentMember?.memberCode || 'BUY-M-001') : undefined,
    mw: merchantWallet,
    lw: lenderWallet,
    nt: privateNotifications,
    tx: visibleTx,
    plan: effectivePlan,
    products: productsForUser,
    my: myGroups,
    groupPayments: groupPaymentsForUser,
    deposits: visibleDeposits,
    lr: lrForUser,
    loans: db.loans,
    lent: db.lent,
    rev: db.rev,
    subRev: db.subRev,
    promoRev: db.promoRev || 0,
    fee: db.fee,
    users: db.usersCount + Math.max(0, totalRegistered - 3),
    hidden: db.hidden,
    feat: activeFeatIds,
    promo: activePromoIds,
    sus: db.sus,
    till: db.till,
    banner: db.banner,
    currentUserId: session.userId,
    lenderId: currentLender?.lenderId ?? session.lenderId,
    lenders: buildAllLendersList(),
    registeredMembers: membersDb.users.map((u) => u.username),
    registeredMerchants: merchantsDb.users.map((u) => u.name),
    registeredLenders: lendersDb.users.map((u) => u.name),
    wishlist: userWishlist,
    joinRequests: visibleJoinRequests,
    merchantPlans,
    revenueLedger: session.role === 'admin' ? (db.revenueLedger || []) : undefined,
  };
}

export function buildPublicShopState(db: ServerDatabase): AppState {
  const now = Date.now();
  const activeFeatIds = db.products
    .filter((p) => {
      const activeByFlag = p.featured && (!p.featuredUntil || p.featuredUntil >= now);
      return activeByFlag || db.feat.includes(p.id);
    })
    .map((p) => p.id);
  const activePromoIds = db.products
    .filter((p) => {
      const activeByFlag = p.promoted && (!p.promotedUntil || p.promotedUntil >= now);
      return activeByFlag || (db.promo || []).includes(p.id);
    })
    .map((p) => p.id);

  const publicProducts: Product[] = db.products.map((p) => ({
    ...p,
    aiInquiries: [],
    featured: activeFeatIds.includes(p.id),
    promoted: activePromoIds.includes(p.id),
    g: enforceProductGroups(
      p.g.map((g) => ({
        ...g,
        r: g.r.map((m) => {
          const { userId: _userId, ...cleanMember } = m as GroupMember & { userId?: string };
          return { ...cleanMember, me: false };
        }),
      }))
    ),
  }));

  const totalRegistered =
    getMembersDb().users.length +
    getMerchantsDb().users.length +
    getLendersDb().users.length;

  return {
    v: 5,
    role: null,
    tab: 'home',
    view: null,
    sel: null,
    name: 'Guest',
    mf: 'All',
    cf: 'All',
    q: '',
    wallet: 0,
    mw: 0,
    lw: 0,
    nt: [],
    tx: [],
    plan: db.plan,
    products: publicProducts,
    my: [],
    groupPayments: [],
    deposits: [],
    lr: [],
    loans: [],
    lent: 0,
    rev: 0,
    subRev: 0,
    promoRev: 0,
    fee: 0,
    users: db.usersCount + Math.max(0, totalRegistered - 3),
    hidden: db.hidden,
    feat: activeFeatIds,
    promo: activePromoIds,
    sus: db.sus,
    till: db.till,
    banner: db.banner,
    lenders: buildAllLendersList(),
    wishlist: [],
    joinRequests: [],
  };
}

export function buildGroupsList(): ProductGroup[] {
  return enforceProductGroups(
    C10.map((c, i) => ({
      n: GROUP_LETTERS[i],
      c,
      r: [],
      j: 0,
      rot: 1,
    }))
  );
}

export { BM, K, LN, ME, PL, creditMemberDays, enforceProductGroups, getMemberTracking, inst };
