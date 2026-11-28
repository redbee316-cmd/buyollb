import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AiInquiry, GroupMember, Product, Role } from './src/types/buyoll.ts';
import { askProductAdvisor } from './server/gemini.ts';
import {
  BM,
  K,
  ME,
  PL,
  PROMO_TIERS,
  type PromoTierId,
  UPLOADS_DIR,
  advanceGroupRotations,
  buildClientState,
  buildPublicShopState,
  buildGroupsList,
  canViewProductInsights,
  canonicalPassword,
  creditMemberDays,
  enforceProductGroups,
  ensureDirs,
  findUserByMemberName,
  findUserByMerchantName,
  generateMemberCode,
  getAllUsersAcrossDatabases,
  getDb,
  getGroupModerator,
  getLendersDb,
  getMemberTracking,
  getMembersDb,
  getMerchantPlan,
  getMerchantsDb,
  getPrivateNotificationsForSession,
  getRoleDb,
  getScopedAiHistory,
  hashPassword,
  inst,
  isGroupModerator,
  isPlanCurrentlyActive,
  pushPrivateNote,
  recordAdminRevenue,
  resetDemoDb,
  saveDb,
  saveRoleDb,
  validatePasswordReset,
  validateUniqueCredentials,
  verifyPassword,
} from './server/store.ts';

interface SessionPayload {
  jti: string;
  userId: string;
  role: Role;
  name: string;
  merchantName?: string;
  lenderId?: number;
  exp: number;
}

interface AuthedRequest extends Request {
  session?: SessionPayload;
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function signToken(payload: Omit<SessionPayload, 'jti' | 'exp'>): string {
  const full: SessionPayload = {
    ...payload,
    jti: crypto.randomUUID(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    const db = getDb();
    if (db.revokedTokens.includes(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface ResetPayload {
  typ: 'password-reset';
  jti: string;
  userId: string;
  role: Exclude<Role, 'admin'>;
  exp: number;
}

function signResetToken(userId: string, role: Exclude<Role, 'admin'>): string {
  const full: ResetPayload = {
    typ: 'password-reset',
    jti: crypto.randomUUID(),
    userId,
    role,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`reset:${body}`)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyResetToken(token: string): ResetPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`reset:${body}`)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ResetPayload;
    if (parsed.typ !== 'password-reset' || !parsed.exp || parsed.exp < Date.now()) return null;
    const db = getDb();
    if (db.revokedTokens.includes(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = auth.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.session = payload;
  next();
}

function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.session || !roles.includes(req.session.role)) {
      res.status(403).json({ error: 'Forbidden for your role' });
      return;
    }
    next();
  };
}

function getOptionalSession(req: Request): SessionPayload | undefined {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return undefined;
  return verifyToken(auth.slice(7).trim()) || undefined;
}

function verifyEnvAdminPasscode(submitted: string, envPasscode: string): boolean {
  const a = crypto.createHash('sha256').update(submitted).digest();
  const b = crypto.createHash('sha256').update(envPasscode).digest();
  return crypto.timingSafeEqual(a, b);
}

async function startServer() {
  ensureDirs();
  getDb();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8mb' }));

  // Serve uploaded product images safely
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(UPLOADS_DIR)
  );

  // ---------- AUTH ROUTES ----------

  app.get('/api/auth/admin-status', (_req, res) => {
    const db = getDb();
    const hasEnv = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    res.json({
      configured: hasEnv || Boolean(db.adminCredential),
    });
  });

  app.post('/api/auth/admin-claim', (req, res) => {
    const db = getDb();
    const hasEnv = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    if (hasEnv || db.adminCredential) {
      res.status(403).json({ error: 'Admin password is already configured' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (password.length < 4) {
      res.status(400).json({ error: 'Choose an admin password (at least 4 characters)' });
      return;
    }
    const canonPass = canonicalPassword(password);
    for (const u of getAllUsersAcrossDatabases()) {
      if (
        verifyPassword(password, u.salt, u.passwordHash) ||
        verifyPassword(canonPass, u.salt, u.canonicalPasswordHash)
      ) {
        res.status(409).json({
          error: 'This password matches or looks too similar to an existing user password. Choose a unique password.',
        });
        return;
      }
    }
    const hashed = hashPassword(password);
    db.adminCredential = { salt: hashed.salt, hash: hashed.hash, canonicalHash: hashed.canonicalHash };
    saveDb();

    const sessionInfo = { userId: 'usr-admin', role: 'admin' as Role, name: 'Admin' };
    const token = signToken(sessionInfo);
    res.json({ token, state: buildClientState(db, sessionInfo) });
  });

  app.post('/api/auth/admin-login', (req, res) => {
    const db = getDb();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const envPass = process.env.ADMIN_PASSCODE?.trim();

    if (envPass) {
      if (!verifyEnvAdminPasscode(password, envPass)) {
        res.status(401).json({ error: 'Invalid admin password' });
        return;
      }
    } else if (db.adminCredential) {
      if (!verifyPassword(password, db.adminCredential.salt, db.adminCredential.hash)) {
        res.status(401).json({ error: 'Invalid admin password' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Admin password not yet set' });
      return;
    }

    const sessionInfo = { userId: 'usr-admin', role: 'admin' as Role, name: 'Admin' };
    const token = signToken(sessionInfo);
    res.json({ token, state: buildClientState(db, sessionInfo) });
  });

  app.post('/api/auth/login', (req, res) => {
    const rawUsername =
      typeof req.body?.username === 'string'
        ? req.body.username
        : typeof req.body?.phone === 'string'
          ? req.body.phone
          : '';
    const identifier = rawUsername.trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role as Exclude<Role, 'admin'>;

    if (!identifier || !password || !['member', 'merchant', 'lender'].includes(role)) {
      res.status(400).json({ error: 'Username, password, and valid role are required' });
      return;
    }

    const db = getDb();
    const roleDb = getRoleDb(role);
    const idLower = identifier.toLowerCase();
    const user = roleDb.users.find(
      (u) =>
        u.username.toLowerCase() === idLower ||
        u.name.toLowerCase() === idLower ||
        (u.phone && u.phone === identifier)
    );
    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      res.status(401).json({ error: `Invalid ${role} username or password` });
      return;
    }

    const sessionInfo = {
      userId: user.id,
      role: user.role,
      name: user.name,
      merchantName: user.merchantName,
      lenderId: user.lenderId,
    };
    const token = signToken(sessionInfo);
    res.json({ token, state: buildClientState(db, sessionInfo) });
  });

  app.post('/api/auth/register', (req, res) => {
    const rawUsername =
      typeof req.body?.username === 'string'
        ? req.body.username
        : typeof req.body?.name === 'string'
          ? req.body.name
          : '';
    const username = rawUsername.trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const repeatPassword =
      typeof req.body?.repeatPassword === 'string' ? req.body.repeatPassword : password;
    const role = req.body?.role as Exclude<Role, 'admin'>;

    if (!username || !password || !['member', 'merchant', 'lender'].includes(role)) {
      res.status(400).json({ error: 'Username, password, and valid role are required' });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters long' });
      return;
    }
    if (password !== repeatPassword) {
      res.status(400).json({ error: 'Passwords do not match. Please repeat the exact same password.' });
      return;
    }

    const db = getDb();
    const uniqueError = validateUniqueCredentials(username, password);
    if (uniqueError) {
      res.status(409).json({ error: uniqueError });
      return;
    }

    const { salt, hash, canonicalHash } = hashPassword(password);
    const id = `usr-${role}-${crypto.randomUUID()}`;
    const roleDb = getRoleDb(role);
    const nextLenderId =
      role === 'lender'
        ? Math.max(3, ...roleDb.users.map((u) => u.lenderId || 3)) + 1
        : undefined;
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

    const newUser = {
      id,
      username,
      name: username,
      phone: rawPhone || undefined,
      role,
      memberCode: role === 'member' ? generateMemberCode(roleDb) : undefined,
      merchantName: role === 'merchant' ? username : undefined,
      lenderId: nextLenderId,
      loc: role === 'lender' ? 'Nairobi' : undefined,
      range: role === 'lender' ? 'KSh 500 – 10,000' : undefined,
      wallet: 0,
      loanCredit: role === 'member' ? 0 : undefined,
      plan: role === 'merchant' ? { ...PL[0], active: false, exp: 'Not subscribed' } : undefined,
      salt,
      passwordHash: hash,
      canonicalPasswordHash: canonicalHash,
      createdAt: new Date().toISOString(),
    };
    roleDb.users.push(newUser);
    saveRoleDb(role);

    pushPrivateNote(db, {
      r: role,
      userId: newUser.id,
      t: `Welcome ${newUser.name}! Your private ${role} account and notifications are active.`,
    });
    saveDb();

    const sessionInfo = {
      userId: newUser.id,
      role: newUser.role,
      name: newUser.name,
      merchantName: newUser.merchantName,
      lenderId: newUser.lenderId,
    };
    const token = signToken(sessionInfo);
    res.json({ token, state: buildClientState(db, sessionInfo) });
  });

  app.post('/api/auth/forgot-password/verify', (req, res) => {
    const rawUsername = typeof req.body?.username === 'string' ? req.body.username : '';
    const identifier = rawUsername.trim();
    const role = req.body?.role as Exclude<Role, 'admin'>;

    if (!identifier || !['member', 'merchant', 'lender'].includes(role)) {
      res.status(400).json({ error: 'Enter your username to reset your password' });
      return;
    }

    const roleDb = getRoleDb(role);
    const idLower = identifier.toLowerCase();
    const user = roleDb.users.find(
      (u) => u.username.toLowerCase() === idLower || u.name.toLowerCase() === idLower
    );
    if (!user) {
      res.status(404).json({ error: `No ${role} account found with username "${identifier}"` });
      return;
    }

    const resetToken = signResetToken(user.id, user.role);
    res.json({ resetToken, username: user.username, role: user.role });
  });

  app.post('/api/auth/forgot-password/reset', (req, res) => {
    const resetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const repeatPassword =
      typeof req.body?.repeatPassword === 'string' ? req.body.repeatPassword : '';

    if (!resetToken) {
      res.status(400).json({ error: 'Password reset session is missing or expired. Please try again.' });
      return;
    }
    const payload = verifyResetToken(resetToken);
    if (!payload) {
      res.status(401).json({ error: 'Password reset session expired or already used. Please start again.' });
      return;
    }
    if (newPassword.length < 4) {
      res.status(400).json({ error: 'New password must be at least 4 characters long' });
      return;
    }
    if (newPassword !== repeatPassword) {
      res.status(400).json({ error: 'Passwords do not match. Please repeat the exact same new password.' });
      return;
    }

    const db = getDb();
    const roleDb = getRoleDb(payload.role);
    const user = roleDb.users.find((u) => u.id === payload.userId);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const validationError = validatePasswordReset(user, newPassword);
    if (validationError) {
      res.status(409).json({ error: validationError });
      return;
    }

    const { salt, hash, canonicalHash } = hashPassword(newPassword);
    user.salt = salt;
    user.passwordHash = hash;
    user.canonicalPasswordHash = canonicalHash;
    saveRoleDb(payload.role);

    db.revokedTokens.push(payload.jti);
    if (db.revokedTokens.length > 500) {
      db.revokedTokens = db.revokedTokens.slice(-500);
    }
    saveDb();

    res.json({ ok: true, username: user.username, role: user.role });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    if (req.session) {
      const db = getDb();
      db.revokedTokens.push(req.session.jti);
      if (db.revokedTokens.length > 500) {
        db.revokedTokens = db.revokedTokens.slice(-500);
      }
      saveDb();
    }
    res.json({ ok: true });
  });

  // ---------- STATE SYNC ----------

  app.get('/api/shop', (_req, res) => {
    const db = getDb();
    res.json({ state: buildPublicShopState(db) });
  });

  app.get('/api/state', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    res.json({ state: buildClientState(db, req.session!) });
  });

  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const notifications = getPrivateNotificationsForSession(db, req.session!);
    const unreadCount = notifications.filter((n) => !n.s).length;
    res.json({ notifications, unreadCount });
  });

  app.post('/api/notifications/read', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const session = req.session!;
    const targetId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';

    db.nt = db.nt.map((n) => {
      const belongsToUser =
        session.role === 'admin'
          ? n.r === 'admin' && (!n.userId || n.userId === 'usr-admin')
          : n.userId === session.userId;
      if (!belongsToUser) return n;
      if (targetId && n.id !== targetId) return n;
      return { ...n, s: 1 };
    });
    saveDb();
    const notifications = getPrivateNotificationsForSession(db, session);
    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.s).length,
      state: buildClientState(db, session),
    });
  });

  app.post('/api/notifications/clear', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const session = req.session!;
    db.nt = db.nt.filter((n) => {
      const belongsToUser =
        session.role === 'admin'
          ? n.r === 'admin' && (!n.userId || n.userId === 'usr-admin')
          : n.userId === session.userId;
      if (!belongsToUser) return true;
      return n.s === 0;
    });
    saveDb();
    const notifications = getPrivateNotificationsForSession(db, session);
    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.s).length,
      state: buildClientState(db, session),
    });
  });

  // ---------- PERSONALIZED WISHLIST ----------

  app.post('/api/wishlist/toggle', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const session = req.session!;
    const pid = Number(req.body?.pid);

    if (!Number.isFinite(pid) || !db.products.some((p) => p.id === pid)) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    db.wishlistByUser = db.wishlistByUser || {};
    const current = db.wishlistByUser[session.userId] || [];
    const exists = current.includes(pid);
    const updated = exists ? current.filter((id) => id !== pid) : [pid, ...current];
    db.wishlistByUser[session.userId] = updated;
    saveDb();

    res.json({ saved: !exists, state: buildClientState(db, session) });
  });

  // ---------- PRODUCT IMAGE UPLOAD ----------

  app.post(
    '/api/upload-image',
    requireAuth,
    requireRole('merchant', 'admin'),
    (req: AuthedRequest, res) => {
      const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        res.status(400).json({ error: 'Invalid image format. Use PNG, JPEG, WebP, or GIF.' });
        return;
      }

      const mime = match[1];
      const extMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };
      const ext = extMap[mime];
      if (!ext) {
        res.status(400).json({ error: 'Unsupported image type' });
        return;
      }

      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: 'Image size must be between 1 byte and 5MB' });
        return;
      }

      const safeFilename = `${crypto.randomUUID()}.${ext}`;
      const resolvedPath = path.resolve(UPLOADS_DIR, safeFilename);
      if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      fs.writeFileSync(resolvedPath, buffer);
      res.json({ url: `/uploads/${safeFilename}` });
    }
  );

  // ---------- PRODUCTS ----------

  app.post(
    '/api/products',
    requireAuth,
    requireRole('merchant', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const merchantName = session.merchantName || session.name || BM;
      const merchantsDb = getMerchantsDb();
      const merchantUser =
        session.role === 'merchant'
          ? merchantsDb.users.find((u) => u.id === session.userId)
          : undefined;
      const merchantPlan =
        session.role === 'merchant' ? getMerchantPlan(merchantUser, db) : db.plan;

      if (session.role !== 'admin' && !isPlanCurrentlyActive(merchantPlan)) {
        res.status(403).json({
          error:
            'Subscription required: Deposit funds via M-Pesa, wait for Admin approval, and pay for a merchant subscription plan before uploading products.',
        });
        return;
      }

      const mineCount = db.products.filter((p) => p.m === merchantName).length;
      if (mineCount >= merchantPlan.max && session.role !== 'admin') {
        res.status(400).json({
          error: `${merchantPlan.n} limit: ${merchantPlan.max} products. Upgrade your plan.`,
        });
        return;
      }

      const n = typeof req.body?.n === 'string' ? req.body.n.trim() : '';
      const cat = typeof req.body?.cat === 'string' ? req.body.cat.trim() : 'Home';
      const p = Number(req.body?.p);
      const o = Number(req.body?.o) || p;
      const stock = Math.max(1, Number(req.body?.stock) || 10);
      const loc = typeof req.body?.loc === 'string' ? req.body.loc.trim() : 'Nairobi';
      const till = typeof req.body?.till === 'string' ? req.body.till.trim() : '';
      const desc = typeof req.body?.desc === 'string' ? req.body.desc.trim() : 'New product. Pay little by little.';
      const rawImg = typeof req.body?.img === 'string' ? req.body.img.trim() : '';
      const img =
        rawImg.startsWith('/uploads/') || rawImg.startsWith('data:image/')
          ? rawImg
          : undefined;

      const rawSpotlight = typeof req.body?.spotlightTier === 'string' ? req.body.spotlightTier : 'none';
      const validSpotlight = ['none', 'featured', 'promoted', 'both'].includes(rawSpotlight)
        ? (rawSpotlight as 'none' | PromoTierId)
        : 'none';

      if (!n || !Number.isFinite(p) || p <= 0) {
        res.status(400).json({ error: 'Enter a valid product name and price' });
        return;
      }
      if (!till) {
        res.status(400).json({ error: 'Enter your Till / Paybill number' });
        return;
      }

      const tierInfo = validSpotlight !== 'none' ? PROMO_TIERS[validSpotlight] : null;
      if (tierInfo && session.role === 'merchant') {
        if (!merchantUser || merchantUser.wallet < tierInfo.price) {
          res.status(400).json({
            error: `Insufficient merchant wallet balance for ${tierInfo.label} (${K(tierInfo.price)} required). Deposit via M-Pesa for Admin approval or uncheck the optional spotlight.`,
          });
          return;
        }
      }

      const newProductId = Date.now();
      const expiresAt = tierInfo ? Date.now() + tierInfo.days * 864e5 : undefined;
      const wantsFeat = validSpotlight === 'featured' || validSpotlight === 'both';
      const wantsPromo = validSpotlight === 'promoted' || validSpotlight === 'both';

      const newProduct: Product = {
        id: newProductId,
        n,
        cat,
        p,
        o,
        m: merchantName,
        till,
        loc,
        stock,
        e: '📦',
        img,
        t: 'Just now',
        desc,
        featured: wantsFeat || undefined,
        promoted: wantsPromo || undefined,
        featuredUntil: wantsFeat ? expiresAt : undefined,
        promotedUntil: wantsPromo ? expiresAt : undefined,
        g: buildGroupsList(),
      };

      if (tierInfo && session.role === 'merchant' && merchantUser) {
        merchantUser.wallet -= tierInfo.price;
        saveRoleDb('merchant');
        db.rev += tierInfo.price;
        db.promoRev = (db.promoRev || 0) + tierInfo.price;
        if (wantsFeat) {
          if (!db.feat.includes(newProductId)) db.feat.push(newProductId);
          recordAdminRevenue(db, {
            category: 'featured_spotlight',
            amount: 500,
            sourceUser: merchantName,
            description: `⭐ Featured Items (Paid Spotlight) · "${n}"`,
          });
        }
        if (wantsPromo) {
          db.promo = db.promo || [];
          if (!db.promo.includes(newProductId)) db.promo.push(newProductId);
          recordAdminRevenue(db, {
            category: 'promotional_deal',
            amount: 500,
            sourceUser: merchantName,
            description: `🔥 Promotional Items (Sponsored Deals) · "${n}"`,
          });
        }
        db.tx.unshift({
          userId: session.userId,
          t: `${tierInfo.label}: ${n}`,
          a: -tierInfo.price,
          d: 'Just now',
          k: 'p',
          r: 'merchant',
        });
        pushPrivateNote(db, {
          r: 'merchant',
          userId: session.userId,
          category: 'payment',
          t: `Paid ${K(tierInfo.price)} from wallet for ${tierInfo.label} on "${n}" (30 days).`,
        });
        pushPrivateNote(db, {
          r: 'admin',
          userId: 'usr-admin',
          category: 'moderation',
          t: `New paid spotlight: ${merchantName} paid ${K(tierInfo.price)} for ${tierInfo.label} on "${n}". Moderate in Admin Products.`,
        });
      }

      db.products.unshift(newProduct);
      saveDb();
      res.json({ productId: newProduct.id, state: buildClientState(db, session) });
    }
  );

  app.patch(
    '/api/products/:id/till',
    requireAuth,
    requireRole('merchant', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const pid = Number(req.params.id);
      const till = typeof req.body?.till === 'string' ? req.body.till.trim() : '';
      if (!till) {
        res.status(400).json({ error: 'Till / Paybill cannot be empty' });
        return;
      }

      const product = db.products.find((p) => p.id === pid);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      product.till = till;
      db.groupPayments = db.groupPayments.map((gp) =>
        gp.pid === pid && gp.st === 'pending' ? { ...gp, till } : gp
      );
      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  // Paid Featured / Promotional hero placement for merchants
  app.post(
    '/api/products/:id/promote',
    requireAuth,
    requireRole('merchant'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const pid = Number(req.params.id);
      const tier = req.body?.tier as PromoTierId;
      const tierInfo = PROMO_TIERS[tier];

      if (!tierInfo) {
        res.status(400).json({ error: 'Choose a valid Featured or Promotional package' });
        return;
      }

      const product = db.products.find((p) => p.id === pid);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const merchantName = session.merchantName || session.name || BM;
      if (product.m !== merchantName) {
        res.status(403).json({ error: 'You can only pay to feature or promote your own products' });
        return;
      }

      const merchantsDb = getMerchantsDb();
      const merchantUser = merchantsDb.users.find((u) => u.id === session.userId);
      if (!merchantUser || merchantUser.wallet < tierInfo.price) {
        res.status(400).json({
          error: `Insufficient merchant wallet balance (${K(tierInfo.price)} required). Deposit funds first.`,
        });
        return;
      }

      merchantUser.wallet -= tierInfo.price;
      saveRoleDb('merchant');

      db.rev += tierInfo.price;
      db.promoRev = (db.promoRev || 0) + tierInfo.price;

      const expiresAt = Date.now() + tierInfo.days * 864e5;
      if (tier === 'featured' || tier === 'both') {
        product.featured = true;
        product.featuredUntil = expiresAt;
        if (!db.feat.includes(pid)) db.feat.push(pid);
        recordAdminRevenue(db, {
          category: 'featured_spotlight',
          amount: 500,
          sourceUser: merchantName,
          description: `⭐ Featured Items (Paid Spotlight) · "${product.n}"`,
        });
      }
      if (tier === 'promoted' || tier === 'both') {
        product.promoted = true;
        product.promotedUntil = expiresAt;
        db.promo = db.promo || [];
        if (!db.promo.includes(pid)) db.promo.push(pid);
        recordAdminRevenue(db, {
          category: 'promotional_deal',
          amount: 500,
          sourceUser: merchantName,
          description: `🔥 Promotional Items (Sponsored Deals) · "${product.n}"`,
        });
      }

      db.tx.unshift({
        userId: session.userId,
        t: `${tierInfo.label}: ${product.n}`,
        a: -tierInfo.price,
        d: 'Just now',
        k: 'p',
        r: 'merchant',
      });
      pushPrivateNote(db, {
        r: 'merchant',
        userId: session.userId,
        category: 'payment',
        t: `Payment of ${K(tierInfo.price)} received: ${tierInfo.badge} active for ${product.n} (${tierInfo.days} days)!`,
      });
      pushPrivateNote(db, {
        r: 'admin',
        userId: 'usr-admin',
        category: 'payment',
        t: `Merchant ${merchantName} paid ${K(tierInfo.price)} for ${tierInfo.label} on ${product.n}.`,
      });

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  // ---------- BUYOLL.AI PER-PRODUCT SALES ADVISOR ----------

  app.get('/api/products/:id/ai-history', (req, res) => {
    const db = getDb();
    const pid = Number(req.params.id);
    const product = db.products.find((p) => p.id === pid);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const session = getOptionalSession(req);
    const canViewInsights = canViewProductInsights(product, session);
    const history = getScopedAiHistory(product, session);
    res.json({ history, canViewInsights });
  });

  app.post('/api/products/:id/ai-chat', async (req, res) => {
    const db = getDb();
    const pid = Number(req.params.id);
    const product = db.products.find((p) => p.id === pid);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const rawQuestion = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!rawQuestion) {
      res.status(400).json({ error: 'Please enter a question for Buyoll.AI' });
      return;
    }
    const question = rawQuestion.slice(0, 500);

    const session = getOptionalSession(req);
    const answer = await askProductAdvisor(product, question);

    const inquiry: AiInquiry = {
      id: `ai-${crypto.randomUUID()}`,
      userId: session?.userId || 'guest',
      userName: session?.name || 'Guest Shopper',
      question,
      answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    product.aiInquiries = product.aiInquiries || [];
    product.aiInquiries.push(inquiry);
    if (product.aiInquiries.length > 100) {
      product.aiInquiries = product.aiInquiries.slice(-100);
    }

    saveDb();

    const canViewInsights = canViewProductInsights(product, session);
    const history = getScopedAiHistory(product, session);
    res.json({ inquiry, history, canViewInsights });
  });

  // ---------- GROUPS, MODERATOR & REFERRAL ENFORCEMENT ----------

  app.post('/api/groups/join', requireAuth, requireRole('member'), (req: AuthedRequest, res) => {
    const db = getDb();
    const session = req.session!;
    const pid = Number(req.body?.pid);
    const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';
    const referredBy = typeof req.body?.referredBy === 'string' ? req.body.referredBy.trim() : '';
    const referralCode =
      typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim().toUpperCase() : '';
    const knowsMember = Boolean(req.body?.knowsMember);

    const product = db.products.find((p) => p.id === pid);
    const group = product?.g.find((g) => g.n === gn);
    if (!product || !group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Strict global 1..10 capacity enforcement
    if (group.j >= group.c || group.r.length >= group.c) {
      res.status(400).json({
        error: `Group ${group.n} is full (max ${group.c} member${group.c > 1 ? 's' : ''})`,
      });
      return;
    }

    const userMy = db.myByUser[session.userId] || [];
    if (userMy.some((m) => m.pid === pid && m.g === gn)) {
      res.status(400).json({ error: 'Already requested or joined' });
      return;
    }

    let joinedImmediately = false;
    const merchantUserId = findUserByMerchantName(product.m)?.id;

    if (group.r.length === 0) {
      // First member enters directly and assumes the Group Moderator role
      joinedImmediately = true;
      const memberRecord: GroupMember & { userId?: string } = {
        ...creditMemberDays(
          {
            n: session.name,
            d: 0,
            totalPaid: 0,
            rounds: Array(group.c).fill(0),
            mod: true,
            referredBy: 'Group Founder (First Member)',
          },
          group.c,
          0
        ),
        userId: session.userId,
      };
      group.r.push(memberRecord);
      group.j = group.r.length;
      if (!group.rules) {
        group.rules = 'Pay daily on time, respect rotation order, and only invite known, trusted members.';
      }
      userMy.push({ pid, g: gn, st: 'ok' });

      pushPrivateNote(db, {
        r: 'merchant',
        userId: merchantUserId,
        category: 'group',
        t: `${session.name} opened Group ${gn} of ${product.n} as Moderator (1/${group.c}).`,
      });
      pushPrivateNote(db, {
        r: 'member',
        userId: session.userId,
        category: 'moderation',
        t: `You joined Group ${gn} of ${product.n} as first member & Group Moderator (1/${group.c}).`,
      });
      if (group.c === 1) {
        pushPrivateNote(db, {
          r: 'merchant',
          userId: merchantUserId,
          category: 'group',
          t: `Group ${gn} of ${product.n} is now full (1/1).`,
        });
      }
    } else {
      // Non-empty group: enforce invitation/referral rules for the Moderator to review
      if (!referredBy || referredBy.length < 2) {
        res.status(400).json({
          error: 'Enter who referred you so the Group Moderator knows who invited you.',
        });
        return;
      }
      if (!knowsMember) {
        res.status(400).json({
          error: 'Confirm that a member in this group knows you before requesting to join.',
        });
        return;
      }

      const modRecord = getGroupModerator(group);
      const reqId = `jr-${crypto.randomUUID()}`;
      db.joinRequests = db.joinRequests || [];
      db.joinRequests.unshift({
        id: reqId,
        pid,
        gn,
        productName: product.n,
        userId: session.userId,
        memberName: session.name,
        referredBy,
        referralCode: referralCode || undefined,
        knowsMember,
        st: 'pending',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      userMy.push({ pid, g: gn, st: 'pending' });
      pushPrivateNote(db, {
        r: 'member',
        userId: session.userId,
        category: 'group',
        t: `Join request for Group ${gn} (${product.n}) sent to Moderator ${modRecord?.n || 'Group Mod'} (Referred by: ${referredBy}).`,
      });

      const modUserId =
        modRecord?.userId || (modRecord ? findUserByMemberName(modRecord.n)?.id : undefined);
      if (modUserId && modUserId !== session.userId) {
        pushPrivateNote(db, {
          r: 'member',
          userId: modUserId,
          category: 'moderation',
          t: `Moderator Action: ${session.name} wants to join Group ${gn} (${product.n}). Referred by: ${referredBy}${referralCode ? ` (Code: ${referralCode})` : ''}. Review & accept in Payment Tracking.`,
        });
      }
    }

    db.myByUser[session.userId] = userMy;
    product.g = enforceProductGroups(product.g);
    saveDb();
    res.json({ joinedImmediately, state: buildClientState(db, session) });
  });

  // Moderator (or Admin) accepts or declines a referred member's join request
  app.post(
    '/api/groups/join-requests/:id/decide',
    requireAuth,
    requireRole('member', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const requestId = req.params.id;
      const approve = Boolean(req.body?.approve);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      db.joinRequests = db.joinRequests || [];
      const jr = db.joinRequests.find((item) => item.id === requestId && item.st === 'pending');
      if (!jr) {
        res.status(404).json({ error: 'Pending join request not found' });
        return;
      }

      const product = db.products.find((p) => p.id === jr.pid);
      const group = product?.g.find((g) => g.n === jr.gn);
      if (!product || !group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      if (!isGroupModerator(group, session)) {
        res.status(403).json({
          error: 'Only the Group Moderator (or Admin) can accept or decline referred members.',
        });
        return;
      }

      const applicantUserId = jr.userId || findUserByMemberName(jr.memberName)?.id;

      if (!approve) {
        jr.st = 'declined';
        jr.decidedBy = session.name;
        jr.reason = reason;
        if (applicantUserId && db.myByUser[applicantUserId]) {
          db.myByUser[applicantUserId] = db.myByUser[applicantUserId].filter(
            (m) => !(m.pid === jr.pid && m.g === jr.gn && m.st === 'pending')
          );
        }
        pushPrivateNote(db, {
          r: 'member',
          userId: applicantUserId,
          category: 'moderation',
          t: `Moderator ${session.name} declined your request to join Group ${jr.gn} (${product.n})${reason ? `: ${reason}` : '.'}`,
        });
        saveDb();
        res.json({ state: buildClientState(db, session) });
        return;
      }

      if (group.j >= group.c || group.r.length >= group.c) {
        res.status(400).json({
          error: `Group ${group.n} is already full (max ${group.c} member${group.c > 1 ? 's' : ''})`,
        });
        return;
      }

      const alreadyMember = group.r.some((m) => {
        const typed = m as GroupMember & { userId?: string };
        return applicantUserId && typed.userId ? typed.userId === applicantUserId : m.n === jr.memberName;
      });
      if (!alreadyMember) {
        const memberRecord: GroupMember & { userId?: string } = {
          ...creditMemberDays(
            {
              n: jr.memberName,
              d: 0,
              totalPaid: 0,
              rounds: Array(group.c).fill(0),
              mod: group.r.length === 0,
              referredBy: jr.referredBy,
            },
            group.c,
            0
          ),
          userId: applicantUserId,
        };
        group.r.push(memberRecord);
        group.j = group.r.length;
      }

      jr.st = 'approved';
      jr.decidedBy = session.name;
      if (applicantUserId) {
        const applicantMy = db.myByUser[applicantUserId] || [];
        const existingEntry = applicantMy.find((m) => m.pid === jr.pid && m.g === jr.gn);
        if (existingEntry) {
          existingEntry.st = 'ok';
        } else {
          applicantMy.push({ pid: jr.pid, g: jr.gn, st: 'ok' });
        }
        db.myByUser[applicantUserId] = applicantMy;
      }

      product.g = enforceProductGroups(product.g);

      const merchantUserId = findUserByMerchantName(product.m)?.id;
      pushPrivateNote(db, {
        r: 'member',
        userId: applicantUserId,
        category: 'approval',
        t: `Approved by Moderator ${session.name}! You joined Group ${jr.gn} of ${product.n} (Referred by: ${jr.referredBy}).`,
      });
      pushPrivateNote(db, {
        r: 'member',
        userId: session.userId,
        category: 'moderation',
        t: `You accepted ${jr.memberName} (referred by ${jr.referredBy}) into Group ${jr.gn} of ${product.n}.`,
      });
      pushPrivateNote(db, {
        r: 'merchant',
        userId: merchantUserId,
        category: 'group',
        t: `${jr.memberName} joined Group ${jr.gn} of ${product.n} (${group.j}/${group.c}), approved by Moderator ${session.name}.`,
      });
      if (group.j === group.c) {
        pushPrivateNote(db, {
          r: 'merchant',
          userId: merchantUserId,
          category: 'group',
          t: `Group ${jr.gn} of ${product.n} is now full (${group.c}/${group.c})!`,
        });
      }

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  // Appoint or vote for a Group Moderator (members vote for majority OR current moderator / admin transfers)
  app.post(
    '/api/groups/appoint-moderator',
    requireAuth,
    requireRole('member', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const pid = Number(req.body?.pid);
      const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';
      const candidateName =
        typeof req.body?.candidateName === 'string' ? req.body.candidateName.trim() : '';
      const directTransfer = Boolean(req.body?.directTransfer);

      const product = db.products.find((p) => p.id === pid);
      const group = product?.g.find((g) => g.n === gn);
      if (!product || !group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const callerIsMember = group.r.some((m) => {
        const typed = m as GroupMember & { userId?: string };
        return typed.userId ? typed.userId === session.userId : m.n === session.name;
      });
      if (session.role !== 'admin' && !callerIsMember) {
        res.status(403).json({ error: 'Only active members of this group can appoint a moderator.' });
        return;
      }

      const candidate = group.r.find((m) => m.n === candidateName) as
        | (GroupMember & { userId?: string })
        | undefined;
      if (!candidate) {
        res.status(404).json({ error: 'Selected member is not in this group.' });
        return;
      }

      const key = `${pid}:${gn}`;
      db.moderatorVotesByGroup = db.moderatorVotesByGroup || {};
      const votes = db.moderatorVotesByGroup[key] || {};
      votes[session.userId] = candidate.n;
      db.moderatorVotesByGroup[key] = votes;

      const candidateVotes = Object.values(votes).filter((v) => v === candidate.n).length;
      const majorityNeeded = Math.floor(group.r.length / 2) + 1;
      const canTransferNow =
        session.role === 'admin' ||
        (directTransfer && isGroupModerator(group, session)) ||
        candidateVotes >= majorityNeeded;

      if (canTransferNow) {
        group.r = group.r.map((m) => ({ ...m, mod: m.n === candidate.n }));
        delete db.moderatorVotesByGroup[key];
        product.g = enforceProductGroups(product.g);

        for (const m of group.r) {
          const typed = m as GroupMember & { userId?: string };
          const memberUid = typed.userId || findUserByMemberName(m.n)?.id;
          if (memberUid) {
            pushPrivateNote(db, {
              r: 'member',
              userId: memberUid,
              category: 'moderation',
              t: `${candidate.n} was appointed Group Moderator for Group ${gn} of ${product.n} (by ${session.role === 'admin' ? 'Admin' : directTransfer ? session.name : 'member vote'}).`,
            });
          }
        }
      } else {
        const candidateUid = candidate.userId || findUserByMemberName(candidate.n)?.id;
        if (candidateUid) {
          pushPrivateNote(db, {
            r: 'member',
            userId: candidateUid,
            category: 'moderation',
            t: `${session.name} voted for you to become Moderator of Group ${gn} (${product.n}) (${candidateVotes}/${majorityNeeded} votes).`,
          });
        }
      }

      saveDb();
      const activeMod = getGroupModerator(group);
      res.json({
        appointed: canTransferNow,
        moderatorName: activeMod?.n || candidate.n,
        state: buildClientState(db, session),
      });
    }
  );

  // Moderator monitors payments and reinforces payment adherence / rule warnings
  app.post(
    '/api/groups/enforce-payment',
    requireAuth,
    requireRole('member', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const pid = Number(req.body?.pid);
      const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';
      const memberIdx = Number(req.body?.memberIdx);
      const action = req.body?.action as 'remind' | 'warn' | 'clear_pin';
      const customMsg = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

      const product = db.products.find((p) => p.id === pid);
      const group = product?.g.find((g) => g.n === gn);
      if (!product || !group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      if (!isGroupModerator(group, session)) {
        res.status(403).json({
          error: 'Only the Group Moderator (or Admin) can enforce payment adherence.',
        });
        return;
      }

      const target = group.r[memberIdx] as (GroupMember & { userId?: string }) | undefined;
      if (!target) {
        res.status(404).json({ error: 'Group member not found' });
        return;
      }
      if (!['remind', 'warn', 'clear_pin'].includes(action)) {
        res.status(400).json({ error: 'Invalid enforcement action' });
        return;
      }

      const daily = inst(product.p, group.c);
      const tr = getMemberTracking(target, group.c);
      const targetUserId = target.userId || findUserByMemberName(target.n)?.id;
      const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (action === 'clear_pin') {
        target.pin = false;
        if (targetUserId) {
          pushPrivateNote(db, {
            r: 'member',
            userId: targetUserId,
            category: 'moderation',
            t: `Moderator ${session.name} cleared your payment reminder pin in Group ${gn} (${product.n}).`,
          });
        }
      } else {
        target.pin = true;
        target.lastRemindedAt = nowLabel;
        if (action === 'warn') {
          target.warnings = (target.warnings || 0) + 1;
        }
        if (targetUserId) {
          pushPrivateNote(db, {
            r: 'member',
            userId: targetUserId,
            category: 'moderation',
            t:
              action === 'warn'
                ? `⚠️ Moderator Warning (#${target.warnings}) from ${session.name} in Group ${gn} (${product.n}): ${customMsg || `Adhere to group rules and pay your daily ${K(daily)} (${tr.activeDays}/10 days paid this round).`}`
                : `📌 Payment Reminder from Moderator ${session.name} in Group ${gn} (${product.n}): ${customMsg || `Please pay your daily ${K(daily)} to Till ${product.till} (${tr.activeDays}/10 days paid in Round ${tr.activeRound}).`}`,
          });
        }
      }

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  // Moderator sets/updates group rules and notifies members
  app.put(
    '/api/groups/rules',
    requireAuth,
    requireRole('member', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const pid = Number(req.body?.pid);
      const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';
      const rules = typeof req.body?.rules === 'string' ? req.body.rules.trim() : '';

      if (!rules) {
        res.status(400).json({ error: 'Group rules text cannot be empty' });
        return;
      }

      const product = db.products.find((p) => p.id === pid);
      const group = product?.g.find((g) => g.n === gn);
      if (!product || !group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      if (!isGroupModerator(group, session)) {
        res.status(403).json({ error: 'Only the Group Moderator can update group rules.' });
        return;
      }

      group.rules = rules;
      for (const m of group.r) {
        const typed = m as GroupMember & { userId?: string };
        const memberUid = typed.userId || findUserByMemberName(m.n)?.id;
        if (memberUid) {
          pushPrivateNote(db, {
            r: 'member',
            userId: memberUid,
            category: 'moderation',
            t: `Group ${gn} (${product.n}) rules updated by Moderator ${session.name}: "${rules}"`,
          });
        }
      }

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  // Legacy join approval endpoint locked strictly to Group Moderator (or Admin)
  app.post(
    '/api/groups/approve-join',
    requireAuth,
    requireRole('member', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const pid = Number(req.body?.pid);
      const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';

      const product = db.products.find((p) => p.id === pid);
      const group = product?.g.find((g) => g.n === gn);
      if (!product || !group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      if (!isGroupModerator(group, session)) {
        res.status(403).json({
          error: 'Only the Group Moderator can accept pending join requests.',
        });
        return;
      }

      db.joinRequests = db.joinRequests || [];
      const pendingReq = db.joinRequests.find(
        (jr) => jr.pid === pid && jr.gn === gn && jr.st === 'pending'
      );
      if (!pendingReq) {
        res.status(404).json({ error: 'No pending referral join request found for this group' });
        return;
      }

      if (group.j >= group.c || group.r.length >= group.c) {
        res.status(400).json({
          error: `Group ${group.n} is full (max ${group.c} member${group.c > 1 ? 's' : ''})`,
        });
        return;
      }

      const applicantUid = pendingReq.userId || findUserByMemberName(pendingReq.memberName)?.id;
      const memberRecord: GroupMember & { userId?: string } = {
        ...creditMemberDays(
          {
            n: pendingReq.memberName,
            d: 0,
            totalPaid: 0,
            rounds: Array(group.c).fill(0),
            mod: group.r.length === 0,
            referredBy: pendingReq.referredBy,
          },
          group.c,
          0
        ),
        userId: applicantUid,
      };
      group.r.push(memberRecord);
      group.j = group.r.length;
      pendingReq.st = 'approved';
      pendingReq.decidedBy = session.name;

      if (applicantUid) {
        const userMy = db.myByUser[applicantUid] || [];
        const entry = userMy.find((m) => m.pid === pid && m.g === gn);
        if (entry) entry.st = 'ok';
        else userMy.push({ pid, g: gn, st: 'ok' });
        db.myByUser[applicantUid] = userMy;
      }
      product.g = enforceProductGroups(product.g);

      const merchantUserId = findUserByMerchantName(product.m)?.id;
      pushPrivateNote(db, {
        r: 'merchant',
        userId: merchantUserId,
        category: 'group',
        t: `${pendingReq.memberName} joined Group ${gn} of ${product.n} (${group.j}/${group.c})`,
      });
      pushPrivateNote(db, {
        r: 'member',
        userId: applicantUid,
        category: 'approval',
        t: `Approved by Moderator ${session.name}! You joined Group ${gn} of ${product.n} (${group.j}/${group.c}).`,
      });

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  // Member submits Till/Paybill or Wallet/Loan Credit installment payment for an active group they belong to
  app.post('/api/groups/pay', requireAuth, requireRole('member'), (req: AuthedRequest, res) => {
    const db = getDb();
    const session = req.session!;
    const pid = Number(req.body?.pid);
    const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';
    const payMethod = req.body?.payMethod === 'wallet' ? 'wallet' : 'mpesa';
    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    const amount = Number(req.body?.amount);

    const product = db.products.find((p) => p.id === pid);
    const group = product?.g.find((g) => g.n === gn);
    if (!product || !group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const daily = inst(product.p, group.c);
    if (!Number.isFinite(amount) || amount < daily) {
      res.status(400).json({ error: `Minimum daily payment is ${K(daily)}` });
      return;
    }

    const daysCount = Math.max(1, Math.floor(amount / daily));
    const merchantUserId = findUserByMerchantName(product.m)?.id;

    if (payMethod === 'wallet') {
      const userMy = db.myByUser[session.userId] || [];
      const activeMembership = userMy.some((m) => m.pid === pid && m.g === gn && m.st === 'ok');
      const inGroupRoster = group.r.some((m) => {
        const typed = m as GroupMember & { userId?: string };
        return typed.userId ? typed.userId === session.userId : m.n === session.name;
      });
      if (!activeMembership || !inGroupRoster) {
        res.status(403).json({
          error: 'Wallet and borrowed loan funds can only pay installments for active groups you belong to.',
        });
        return;
      }
      if (group.done) {
        res.status(400).json({ error: 'This group has already completed all rotations.' });
        return;
      }

      const membersDb = getMembersDb();
      const memberUser = membersDb.users.find((u) => u.id === session.userId);
      if (!memberUser || memberUser.wallet < amount) {
        res.status(400).json({
          error: `Insufficient wallet balance (${K(amount)} required). Available: ${K(memberUser?.wallet ?? 0)}.`,
        });
        return;
      }

      memberUser.wallet -= amount;
      memberUser.loanCredit = Math.max(0, (memberUser.loanCredit || 0) - amount);
      saveRoleDb('member');

      const merchantsDb = getMerchantsDb();
      const merchantUser =
        merchantsDb.users.find(
          (u) => u.merchantName === product.m || u.username === product.m || u.id === merchantUserId
        ) || merchantsDb.users[0];
      if (merchantUser) {
        merchantUser.wallet += amount;
        saveRoleDb('merchant');
      }

      const pushNote = (r: Role, t: string, userId?: string) =>
        pushPrivateNote(db, { r, userId, t, category: 'group' });
      product.g = enforceProductGroups(
        product.g.map((gItem) => {
          if (gItem.n !== gn) return gItem;
          const updatedMembers = gItem.r.map((m) => {
            const typed = m as GroupMember & { userId?: string };
            const isCaller = typed.userId ? typed.userId === session.userId : m.n === session.name;
            return isCaller ? { ...creditMemberDays(m, gItem.c, daysCount), pin: false } : m;
          });
          return advanceGroupRotations({ ...gItem, r: updatedMembers }, product.n, product.m, pushNote);
        })
      );

      const walletCode = `WLT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      db.groupPayments.unshift({
        id: Date.now(),
        pid,
        productName: product.n,
        g: gn,
        memberName: session.name,
        isMe: true,
        merchant: product.m,
        till: product.till,
        code: walletCode,
        amount,
        dailyAmount: daily,
        daysCount,
        st: 'approved',
        createdAt: 'Just now',
      });

      db.tx.unshift(
        {
          userId: session.userId,
          t: `Wallet Installment (${product.n} · Grp ${gn})`,
          a: -amount,
          d: 'Just now',
          k: 'c',
          r: 'member',
        },
        {
          userId: merchantUser?.id || merchantUserId,
          t: `Wallet Group Payment (${session.name} · ${walletCode})`,
          a: amount,
          d: 'Just now',
          k: 'p',
          r: 'merchant',
        }
      );

      pushPrivateNote(db, {
        r: 'member',
        userId: session.userId,
        category: 'payment',
        t: `Paid ${K(amount)} from Wallet (${walletCode}) for ${product.n} · Group ${gn}. ${daysCount} day(s) credited automatically!`,
      });
      pushPrivateNote(db, {
        r: 'merchant',
        userId: merchantUser?.id || merchantUserId,
        category: 'payment',
        t: `Wallet Payment Credited: ${session.name} paid ${K(amount)} (${walletCode}) for ${product.n} · Group ${gn}.`,
      });

      const modMember = getGroupModerator(group);
      const modUserId =
        modMember?.userId || (modMember ? findUserByMemberName(modMember.n)?.id : undefined);
      if (modUserId && modUserId !== session.userId) {
        pushPrivateNote(db, {
          r: 'member',
          userId: modUserId,
          category: 'moderation',
          t: `Group ${gn} (${product.n}): ${session.name} paid ${K(amount)} from wallet (${daysCount} day(s) auto-checked).`,
        });
      }

      saveDb();
      res.json({ state: buildClientState(db, session) });
      return;
    }

    if (!rawCode) {
      res.status(400).json({ error: 'Payment code is required' });
      return;
    }

    const duplicate =
      db.groupPayments.some((gp) => gp.code === rawCode) ||
      db.deposits.some((d) => d.code === rawCode);
    if (duplicate) {
      res.status(400).json({ error: 'Duplicate payment code' });
      return;
    }

    db.groupPayments.unshift({
      id: Date.now(),
      pid,
      productName: product.n,
      g: gn,
      memberName: session.name,
      isMe: true,
      merchant: product.m,
      till: product.till,
      code: rawCode,
      amount,
      dailyAmount: daily,
      daysCount,
      st: 'pending',
      createdAt: 'Just now',
    });

    pushPrivateNote(db, {
      r: 'merchant',
      userId: merchantUserId,
      category: 'payment',
      t: `Payment Received: ${session.name} paid ${K(amount)} (Code ${rawCode}) to Till ${product.till} for ${product.n} · Group ${gn}. Approve to check-mark tracking.`,
    });
    pushPrivateNote(db, {
      r: 'member',
      userId: session.userId,
      category: 'payment',
      t: `Payment Sent: ${K(amount)} (Code ${rawCode}) paid to ${product.m} Till ${product.till} for Group ${gn} of ${product.n}. Awaiting approval.`,
    });

    const modMember = getGroupModerator(group);
    const modUserId =
      modMember?.userId || (modMember ? findUserByMemberName(modMember.n)?.id : undefined);
    if (modUserId && modUserId !== session.userId) {
      pushPrivateNote(db, {
        r: 'member',
        userId: modUserId,
        category: 'moderation',
        t: `Group ${gn} (${product.n}): ${session.name} submitted payment ${rawCode} (${K(amount)}) for ${daysCount} day(s).`,
      });
    }

    saveDb();
    res.json({ state: buildClientState(db, session) });
  });

  // Explicitly block borrowed loan withdrawals
  app.post('/api/wallet/withdraw', requireAuth, (_req, res) => {
    res.status(403).json({
      error: 'Borrowed loan funds cannot be withdrawn and may only be used to pay product installments in active groups you belong to.',
    });
  });

  // Merchant approves or declines member payment -> auto check-mark + 10-day rollover
  app.post(
    '/api/group-payments/:id/decide',
    requireAuth,
    requireRole('merchant', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const paymentId = Number(req.params.id);
      const approve = Boolean(req.body?.approve);

      const payment = db.groupPayments.find((gp) => gp.id === paymentId);
      if (!payment || payment.st !== 'pending') {
        res.status(404).json({ error: 'Pending payment not found' });
        return;
      }

      if (session.role === 'merchant') {
        const myMerchantName = session.merchantName || session.name;
        if (payment.merchant !== myMerchantName) {
          res.status(403).json({ error: 'You can only decide payments for your own products' });
          return;
        }
      }

      payment.st = approve ? 'approved' : 'declined';

      const memberUserId = findUserByMemberName(payment.memberName)?.id;
      const merchantUserId = findUserByMerchantName(payment.merchant)?.id || session.userId;

      if (!approve) {
        pushPrivateNote(db, {
          r: 'member',
          userId: memberUserId,
          category: 'approval',
          t: `Your payment ${payment.code} (${K(payment.amount)}) for ${payment.productName} Group ${payment.g} was declined by ${payment.merchant}.`,
        });
        pushPrivateNote(db, {
          r: 'merchant',
          userId: merchantUserId,
          category: 'approval',
          t: `You declined payment ${payment.code} (${K(payment.amount)}) from ${payment.memberName}.`,
        });
        saveDb();
        res.json({ state: buildClientState(db, session) });
        return;
      }

      const product = db.products.find((p) => p.id === payment.pid);
      if (product) {
        const pushNote = (r: Role, t: string, userId?: string) =>
          pushPrivateNote(db, { r, userId, t, category: 'group' });
        product.g = enforceProductGroups(
          product.g.map((gItem) => {
            if (gItem.n !== payment.g) return gItem;
            const updatedMembers = gItem.r.map((m) =>
              m.n === payment.memberName
                ? { ...creditMemberDays(m, gItem.c, payment.daysCount), pin: false }
                : m
            );
            return advanceGroupRotations({ ...gItem, r: updatedMembers }, product.n, product.m, pushNote);
          })
        );
      }

      // Credit merchant wallet in merchants-db
      const merchantsDb = getMerchantsDb();
      const merchantUser =
        merchantsDb.users.find((u) => u.merchantName === payment.merchant || u.username === payment.merchant) ||
        merchantsDb.users[0];
      if (merchantUser) {
        merchantUser.wallet += payment.amount;
        saveRoleDb('merchant');
      }

      db.tx.unshift(
        {
          t: `Group Contribution (${payment.productName} · Grp ${payment.g})`,
          a: -payment.amount,
          d: 'Just now',
          k: 'c',
          r: 'member',
        },
        {
          t: `Group Payment (${payment.memberName} · ${payment.code})`,
          a: payment.amount,
          d: 'Just now',
          k: 'p',
          r: 'merchant',
        }
      );

      pushPrivateNote(db, {
        r: 'member',
        userId: memberUserId,
        category: 'approval',
        t: `Payment ${payment.code} (${K(payment.amount)}) approved by ${payment.merchant}! ${payment.daysCount} day(s) check-marked on Payment Tracking.`,
      });
      pushPrivateNote(db, {
        r: 'merchant',
        userId: merchantUser?.id || merchantUserId,
        category: 'payment',
        t: `Approved ${payment.code} (${K(payment.amount)}) from ${payment.memberName} for ${payment.productName} · Group ${payment.g}. Wallet credited.`,
      });

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  app.post(
    '/api/groups/tick',
    requireAuth,
    requireRole('member', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const pid = Number(req.body?.pid);
      const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';
      const memberIdx = Number(req.body?.memberIdx);

      const product = db.products.find((p) => p.id === pid);
      const group = product?.g.find((g) => g.n === gn);
      if (!product || !group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      if (!isGroupModerator(group, session)) {
        res.status(403).json({ error: 'Only the Group Moderator can tick payments' });
        return;
      }
      if (group.done || memberIdx < 0 || memberIdx >= group.r.length) {
        res.status(400).json({ error: 'Cannot tick this member' });
        return;
      }

      const pushNote = (r: Role, t: string, userId?: string) =>
        pushPrivateNote(db, { r, userId, t, category: 'group' });
      product.g = enforceProductGroups(
        product.g.map((gItem) => {
          if (gItem.n !== gn) return gItem;
          const nextMembers = gItem.r.map((m, idx) =>
            idx === memberIdx ? { ...creditMemberDays(m, gItem.c, 1), pin: false } : m
          );
          return advanceGroupRotations({ ...gItem, r: nextMembers }, product.n, product.m, pushNote);
        })
      );

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  app.post(
    '/api/groups/rotate',
    requireAuth,
    requireRole('member', 'merchant', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const pid = Number(req.body?.pid);
      const gn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : '';

      const product = db.products.find((p) => p.id === pid);
      const group = product?.g.find((g) => g.n === gn);
      if (!product || !group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      if (session.role === 'member' && !isGroupModerator(group, session)) {
        res.status(403).json({ error: 'Only the Group Moderator, Merchant, or Admin can rotate the group' });
        return;
      }
      if (session.role === 'merchant' && product.m !== (session.merchantName || session.name)) {
        res.status(403).json({ error: 'You can only rotate groups for your own products' });
        return;
      }

      const currentRot = group.rot;
      const receiver = group.r[currentRot - 1];
      if (!receiver) {
        res.status(400).json({ error: 'No receiver in current slot' });
        return;
      }

      const receiverTyped = receiver as GroupMember & { userId?: string };
      const merchantUserId = findUserByMerchantName(product.m)?.id;
      const receiverUserId = receiverTyped.userId || findUserByMemberName(receiver.n)?.id;
      pushPrivateNote(db, {
        r: 'merchant',
        userId: merchantUserId,
        category: 'group',
        t: `Deliver ${product.n} to ${receiver.n} (Group ${gn})`,
      });
      pushPrivateNote(db, {
        r: 'member',
        userId: receiverUserId,
        category: 'group',
        t: `🎁 ${receiver.n}'s ${product.n} is ready for delivery!`,
      });

      if (group.rot >= group.c) group.done = true;
      else group.rot += 1;

      saveDb();
      res.json({ handedTo: `#${currentRot} ${receiver.n}`, state: buildClientState(db, session) });
    }
  );

  // ---------- WALLET DEPOSITS ----------

  app.post('/api/deposits', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const session = req.session!;
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    const amt = Number(req.body?.amt);
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

    if (!code || !phone || !Number.isFinite(amt) || amt <= 0) {
      res.status(400).json({ error: 'Code, positive amount, and phone are required' });
      return;
    }

    if (
      db.deposits.some((d) => d.code === code) ||
      db.groupPayments.some((gp) => gp.code === code)
    ) {
      res.status(400).json({ error: 'Duplicate M-Pesa code' });
      return;
    }

    db.deposits.unshift({
      id: Date.now(),
      userId: session.userId,
      by: session.name,
      amt,
      code,
      phone,
      st: 'pending',
      role: session.role,
    });
    pushPrivateNote(db, {
      r: session.role,
      userId: session.userId,
      category: 'payment',
      t: `Deposit payment submitted: ${K(amt)} (Code ${code}) to Till ${db.till}. Pending admin verification.`,
    });
    pushPrivateNote(db, {
      r: 'admin',
      userId: 'usr-admin',
      category: 'approval',
      t: `New M-Pesa deposit of ${K(amt)} (Code ${code}) from ${session.role} ${session.name} to verify.`,
    });
    saveDb();
    res.json({ state: buildClientState(db, session) });
  });

  app.post(
    '/api/deposits/:id/decide',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const id = Number(req.params.id);
      const approve = Boolean(req.body?.approve);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

      const d = db.deposits.find((x) => x.id === id);
      if (!d || d.st !== 'pending') {
        res.status(404).json({ error: 'Pending deposit not found' });
        return;
      }

      d.st = approve ? 'approved' : 'declined';
      d.reason = reason;

      const targetRole = d.role || 'member';
      let targetUserId: string | undefined = targetRole === 'admin' ? 'usr-admin' : d.userId;
      if (targetRole !== 'admin') {
        const roleDb = getRoleDb(targetRole);
        const user =
          (d.userId ? roleDb.users.find((u) => u.id === d.userId) : undefined) ||
          roleDb.users.find((u) => u.name === d.by || u.username === d.by) ||
          roleDb.users[0];
        if (user) {
          targetUserId = user.id;
          if (approve) {
            user.wallet += d.amt;
            saveRoleDb(targetRole);
          }
        }
      }

      if (approve) {
        db.tx.unshift({
          userId: targetUserId,
          t: 'M-Pesa Deposit',
          a: d.amt,
          d: 'Just now',
          k: 'l',
          r: targetRole,
        });
      }

      pushPrivateNote(db, {
        r: targetRole,
        userId: targetUserId,
        category: 'approval',
        t: `Your deposit of ${K(d.amt)} (Code ${d.code}) was ${
          approve
            ? 'approved by Admin and credited to your private wallet!'
            : `declined by Admin${reason ? `: ${reason}` : '.'}`
        }`,
      });
      pushPrivateNote(db, {
        r: 'admin',
        userId: 'usr-admin',
        category: 'approval',
        t: `Deposit ${d.code} (${K(d.amt)}) for ${targetRole} ${d.by} marked ${approve ? 'Approved' : 'Declined'}.`,
      });

      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  // ---------- LOANS (GLOBAL LENDER BOARD + 5% AUTO COMMISSION) ----------

  app.post('/api/loans/request', requireAuth, requireRole('member'), (req: AuthedRequest, res) => {
    const db = getDb();
    const session = req.session!;
    const lenderId = Number(req.body?.lenderId) || 0;
    const amt = Math.round(Number(req.body?.amt));
    const ctx = typeof req.body?.ctx === 'string' ? req.body.ctx.trim() : '';
    const reqPid = req.body?.pid ? Number(req.body.pid) : undefined;
    const reqGn = typeof req.body?.gn === 'string' ? req.body.gn.trim() : undefined;
    const reqPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

    if (!Number.isFinite(amt) || amt <= 50) {
      res.status(400).json({ error: 'Enter a loan amount above KSh 50' });
      return;
    }

    const membersDb = getMembersDb();
    const memberUser = membersDb.users.find((u) => u.id === session.userId);
    const phone = reqPhone || memberUser?.phone || '';
    if (!phone || phone.length < 7) {
      res.status(400).json({ error: 'Enter your phone number so lenders can verify KYC with you' });
      return;
    }
    if (memberUser && !memberUser.phone) {
      memberUser.phone = phone;
      saveRoleDb('member');
    }

    const activeMy = (db.myByUser[session.userId] || []).filter((m) => m.st === 'ok');
    let chosenGroup = reqPid && reqGn ? activeMy.find((m) => m.pid === reqPid && m.g === reqGn) : undefined;
    if (reqPid && reqGn && !chosenGroup) {
      res.status(400).json({ error: 'You must be an active member of the selected group to request a loan for it.' });
      return;
    }
    if (!chosenGroup) {
      chosenGroup = activeMy[0];
    }
    if (!chosenGroup) {
      res.status(400).json({ error: 'Join an active group first before requesting a loan.' });
      return;
    }

    const groupProduct = db.products.find((p) => p.id === chosenGroup!.pid);
    const groupLabel = `${groupProduct?.n || 'Product'} · Group ${chosenGroup.g}`;
    const memberCode = memberUser?.memberCode || 'BUY-M-001';

    db.lr.unshift({
      id: Date.now(),
      userId: session.userId,
      by: session.name,
      memberCode,
      phone,
      me: 1,
      amt,
      lender: lenderId,
      pid: chosenGroup.pid,
      gn: chosenGroup.g,
      st: 'pending',
      ctx: ctx || groupLabel,
      score: 700,
      loc: 'Nairobi',
    });

    // Notify all registered lenders globally so any lender sees the request
    const allLenders = getLendersDb().users;
    for (const lu of allLenders) {
      pushPrivateNote(db, {
        r: 'lender',
        userId: lu.id,
        category: 'loan',
        t: `Global Loan Request: ${session.name} (${memberCode} · ${phone}) requested ${K(amt)} for ${groupLabel}. Inspect group & transfer from Lender Dashboard.`,
      });
    }
    pushPrivateNote(db, {
      r: 'member',
      userId: session.userId,
      category: 'loan',
      t: `Loan request of ${K(amt)} (${memberCode}) posted to all Buyoll lenders for ${groupLabel}.`,
    });

    saveDb();
    res.json({ state: buildClientState(db, session) });
  });

  app.post(
    '/api/loans/:id/decide',
    requireAuth,
    requireRole('lender', 'admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const id = Number(req.params.id);
      const approve = Boolean(req.body?.approve);
      const requestedTransfer = Number(req.body?.amount);

      const r = db.lr.find((x) => x.id === id);
      if (!r || r.st !== 'pending') {
        res.status(404).json({ error: 'Pending loan request not found or already disbursed' });
        return;
      }

      const membersDb = getMembersDb();
      const targetMemberUser =
        (r.userId ? membersDb.users.find((u) => u.id === r.userId) : undefined) ||
        findUserByMemberName(r.by);

      if (!approve) {
        r.st = 'declined';
        pushPrivateNote(db, {
          r: 'member',
          userId: targetMemberUser?.id,
          category: 'loan',
          t: `Lender ${session.name} declined your ${K(r.amt)} loan request.`,
        });
        if (session.role === 'lender') {
          pushPrivateNote(db, {
            r: 'lender',
            userId: session.userId,
            category: 'loan',
            t: `You declined ${r.by} (${r.memberCode || 'Member'})'s loan request of ${K(r.amt)}.`,
          });
        }
        saveDb();
        res.json({ state: buildClientState(db, session) });
        return;
      }

      const transferAmt =
        Number.isFinite(requestedTransfer) && requestedTransfer > 0
          ? Math.round(requestedTransfer)
          : r.amt;

      if (transferAmt < 50) {
        res.status(400).json({ error: 'Transfer amount must be at least KSh 50' });
        return;
      }

      const lendersDb = getLendersDb();
      const lenderUser =
        session.role === 'lender'
          ? lendersDb.users.find((u) => u.id === session.userId)
          : lendersDb.users.find((u) => (u.lenderId || 1) === (r.lender || 1)) || lendersDb.users[0];

      if (!lenderUser || lenderUser.wallet < transferAmt) {
        res.status(400).json({
          error: `Insufficient lender wallet balance (${K(transferAmt)} required). Deposit funds via M-Pesa first.`,
        });
        return;
      }

      lenderUser.wallet -= transferAmt;
      saveRoleDb('lender');

      // Deduct 5% platform commission strictly once per loan disbursed
      const commission = Math.round(transferAmt * 0.05);
      const net = transferAmt - commission;
      db.rev += commission;
      db.fee = (db.fee || 0) + commission;
      db.lent += transferAmt;
      r.st = 'approved';
      r.disbursedAmt = transferAmt;
      r.commissionAmt = commission;
      r.netAmt = net;
      r.lender = lenderUser.lenderId || ME;
      r.lenderName = lenderUser.name;

      recordAdminRevenue(db, {
        category: 'loan_commission',
        amount: commission,
        sourceUser: `${r.by} (${r.memberCode || targetMemberUser?.memberCode || 'BUY-M'})`,
        description: `5% Loan Commission on ${K(transferAmt)} disbursed by ${lenderUser.name}`,
      });

      const loanRecordId = `#LN-${String(db.loans.length + 1).padStart(3, '0')}`;
      db.loans.unshift({
        id: loanRecordId,
        amt: transferAmt,
        commissionAmt: commission,
        netAmt: net,
        st: 'Active',
        lender: lenderUser.lenderId || ME,
        lenderName: lenderUser.name,
        who: r.by,
        memberCode: r.memberCode || targetMemberUser?.memberCode,
        phone: r.phone || targetMemberUser?.phone,
        pid: r.pid,
        gn: r.gn,
      });

      const memberUser = targetMemberUser || membersDb.users[0];
      if (memberUser) {
        memberUser.wallet += net;
        memberUser.loanCredit = (memberUser.loanCredit || 0) + net;
        saveRoleDb('member');
      }

      db.tx.unshift(
        {
          userId: memberUser?.id,
          t: `Loan Disbursed by ${lenderUser.name} (${K(transferAmt)} less 5% fee ${K(commission)})`,
          a: net,
          d: 'Just now',
          k: 'l',
          r: 'member',
        },
        {
          userId: lenderUser.id,
          t: `Loan Transfer to ${r.by} (${r.memberCode || 'Member'})`,
          a: -transferAmt,
          d: 'Just now',
          k: 'l',
          r: 'lender',
        }
      );

      pushPrivateNote(db, {
        r: 'member',
        userId: memberUser?.id,
        category: 'loan',
        t: `Loan transferred by ${lenderUser.name}: ${K(net)} credited to your wallet (${K(commission)} 5% fee deducted once). Borrowed funds can only pay installments in your active groups.`,
      });
      pushPrivateNote(db, {
        r: 'lender',
        userId: lenderUser.id,
        category: 'loan',
        t: `Transferred ${K(transferAmt)} from your Lender Wallet to ${r.by} (${r.memberCode || 'Member'} · ${r.phone || ''}).`,
      });
      pushPrivateNote(db, {
        r: 'admin',
        userId: 'usr-admin',
        category: 'payment',
        t: `5% Loan Commission: ${K(commission)} credited to Admin wallet from ${K(transferAmt)} loan disbursed by ${lenderUser.name} to ${r.by}.`,
      });

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  // ---------- MERCHANT SUBSCRIPTION ----------

  app.post(
    '/api/merchant/subscribe',
    requireAuth,
    requireRole('merchant'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const session = req.session!;
      const planIndex = Number(req.body?.planIndex);
      const plan = PL[planIndex];
      if (!plan) {
        res.status(400).json({ error: 'Invalid plan' });
        return;
      }

      const merchantsDb = getMerchantsDb();
      const merchantUser = merchantsDb.users.find((u) => u.id === session.userId);
      if (!merchantUser || merchantUser.wallet < plan.price) {
        res.status(400).json({ error: 'Insufficient wallet balance - deposit first' });
        return;
      }

      merchantUser.wallet -= plan.price;
      const ts = Date.now() + plan.days * 864e5;
      const nextPlan = {
        ...plan,
        active: true,
        ts,
        exp: new Date(ts).toLocaleDateString(),
      };
      merchantUser.plan = nextPlan;
      saveRoleDb('merchant');

      db.rev += plan.price;
      db.subRev = (db.subRev || 0) + plan.price;
      recordAdminRevenue(db, {
        category: 'subscription',
        amount: plan.price,
        sourceUser: session.merchantName || session.name,
        description: `${plan.n} (${plan.term}) Merchant Subscription`,
      });
      if (merchantUser.id === 'usr-merchant-demo') {
        db.plan = nextPlan;
      }
      db.tx.unshift({
        userId: session.userId,
        t: `${plan.n} ${plan.term} subscription`,
        a: -plan.price,
        d: 'Just now',
        k: 'p',
        r: 'merchant',
      });

      pushPrivateNote(db, {
        r: 'merchant',
        userId: session.userId,
        category: 'payment',
        t: `Subscription payment confirmed: ${K(plan.price)} paid from wallet for ${plan.n} (${plan.term}, active until ${nextPlan.exp}). You can now upload products!`,
      });
      pushPrivateNote(db, {
        r: 'admin',
        userId: 'usr-admin',
        category: 'payment',
        t: `Merchant ${session.merchantName || session.name} paid ${K(plan.price)} for ${plan.n} (${plan.term}) subscription.`,
      });

      saveDb();
      res.json({ state: buildClientState(db, session) });
    }
  );

  // ---------- ADMIN MODERATION & SETTINGS ----------

  app.post(
    '/api/admin/products/:id/toggle-hide',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const pid = Number(req.params.id);
      db.hidden = db.hidden.includes(pid)
        ? db.hidden.filter((x) => x !== pid)
        : [...db.hidden, pid];
      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  app.post(
    '/api/admin/products/:id/toggle-feature',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const pid = Number(req.params.id);
      const isNowFeatured = !db.feat.includes(pid);
      db.feat = isNowFeatured
        ? [...db.feat, pid]
        : db.feat.filter((x) => x !== pid);
      const product = db.products.find((p) => p.id === pid);
      if (product) {
        product.featured = isNowFeatured;
        if (isNowFeatured && !product.featuredUntil) {
          product.featuredUntil = Date.now() + 30 * 864e5;
        }
        if (!isNowFeatured) delete product.featuredUntil;

        const merchantUserId = findUserByMerchantName(product.m)?.id;
        if (merchantUserId) {
          pushPrivateNote(db, {
            r: 'merchant',
            userId: merchantUserId,
            category: 'moderation',
            t: `Admin moderation: "${product.n}" was ${
              isNowFeatured
                ? 'approved for ⭐ Featured Items (Paid Spotlight)'
                : 'removed from ⭐ Featured Items (Paid Spotlight)'
            }.`,
          });
        }
      }
      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  app.post(
    '/api/admin/products/:id/toggle-promote',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const pid = Number(req.params.id);
      db.promo = db.promo || [];
      const isNowPromoted = !db.promo.includes(pid);
      db.promo = isNowPromoted
        ? [...db.promo, pid]
        : db.promo.filter((x) => x !== pid);
      const product = db.products.find((p) => p.id === pid);
      if (product) {
        product.promoted = isNowPromoted;
        if (isNowPromoted && !product.promotedUntil) {
          product.promotedUntil = Date.now() + 30 * 864e5;
        }
        if (!isNowPromoted) delete product.promotedUntil;

        const merchantUserId = findUserByMerchantName(product.m)?.id;
        if (merchantUserId) {
          pushPrivateNote(db, {
            r: 'merchant',
            userId: merchantUserId,
            category: 'moderation',
            t: `Admin moderation: "${product.n}" was ${
              isNowPromoted
                ? 'approved for 🔥 Promotional Items (Sponsored Deals)'
                : 'removed from 🔥 Promotional Items (Sponsored Deals)'
            }.`,
          });
        }
      }
      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  app.delete(
    '/api/admin/products/:id',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const pid = Number(req.params.id);
      const product = db.products.find((p) => p.id === pid);
      if (product && product.g.some((g) => g.j > 0)) {
        res.status(400).json({ error: 'Has active members - hide it instead' });
        return;
      }
      db.products = db.products.filter((p) => p.id !== pid);
      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  app.post(
    '/api/admin/merchants/toggle-suspend',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const merchant = typeof req.body?.merchant === 'string' ? req.body.merchant : '';
      if (!merchant) {
        res.status(400).json({ error: 'Merchant name required' });
        return;
      }
      db.sus = db.sus.includes(merchant)
        ? db.sus.filter((x) => x !== merchant)
        : [...db.sus, merchant];
      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  app.post(
    '/api/admin/plan/toggle',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const merchantTarget = typeof req.body?.merchant === 'string' ? req.body.merchant.trim() : '';
      const merchantsDb = getMerchantsDb();
      const targetUser = merchantTarget
        ? merchantsDb.users.find(
            (u) => (u.merchantName || u.name).toLowerCase() === merchantTarget.toLowerCase()
          )
        : merchantsDb.users.find((u) => u.id === 'usr-merchant-demo') || merchantsDb.users[0];

      if (targetUser) {
        const currentPlan = getMerchantPlan(targetUser, db);
        const nextActive = !currentPlan.active;
        targetUser.plan = {
          ...currentPlan,
          active: nextActive,
          ts: nextActive ? Date.now() + (currentPlan.days || 30) * 864e5 : undefined,
          exp: nextActive
            ? new Date(Date.now() + (currentPlan.days || 30) * 864e5).toLocaleDateString()
            : 'Paused by Admin',
        };
        saveRoleDb('merchant');
        if (targetUser.id === 'usr-merchant-demo') {
          db.plan = targetUser.plan;
        }
        pushPrivateNote(db, {
          r: 'merchant',
          userId: targetUser.id,
          category: 'moderation',
          t: `Admin updated your merchant subscription status to ${nextActive ? 'Active' : 'Paused'}.`,
        });
      } else {
        db.plan.active = !db.plan.active;
      }

      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  app.put(
    '/api/admin/settings',
    requireAuth,
    requireRole('admin'),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const till = typeof req.body?.till === 'string' ? req.body.till.trim() : '';
      const banner = typeof req.body?.banner === 'string' ? req.body.banner.trim() : '';
      if (till) db.till = till;
      if (banner) db.banner = banner;
      saveDb();
      res.json({ state: buildClientState(db, req.session!) });
    }
  );

  app.post('/api/demo/reset', requireAuth, (req: AuthedRequest, res) => {
    const db = resetDemoDb(true);
    res.json({ state: buildClientState(db, req.session!) });
  });

  // ---------- VITE DEV / PROD STATIC SERVING ----------

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR === 'true' ? false : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Buyoll server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
