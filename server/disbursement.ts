import crypto from 'node:crypto';
import type { Role } from '../src/types/buyoll.ts';
import {
  type RoleDatabase,
  type ServerDatabase,
  type StoredUser,
  K,
  ME,
  findUserByMemberName,
  pushPrivateNote,
  recordAdminRevenue,
} from './store.ts';

const inFlightLoanIds = new Set<number>();

export interface LoanBreakdown {
  amount: number;
  commission: number;
  borrowerCredit: number;
}

/**
 * Computes exact integer shilling math with round-half-up 5% commission.
 * Guarantees debit === borrowerCredit + commission for all positive integer amounts.
 */
export function calculateLoanBreakdown(rawAmount: number): LoanBreakdown {
  if (!Number.isFinite(rawAmount) || !Number.isInteger(rawAmount) || rawAmount < 50) {
    throw new DisbursementError(
      400,
      'INVALID_AMOUNT',
      'Loan disbursement amount must be a whole integer of at least KSh 50.'
    );
  }
  const amount = rawAmount;
  const commission = Math.floor((amount * 5 + 50) / 100);
  const borrowerCredit = amount - commission;
  return { amount, commission, borrowerCredit };
}

export class DisbursementError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface DirectDisburseDeps {
  db: ServerDatabase;
  lendersDb: RoleDatabase;
  membersDb: RoleDatabase;
  persistLenders: () => void;
  persistMembers: () => void;
  persistDb: () => void;
}

export interface DirectDisburseInput {
  loanRequestId: number;
  session: { userId: string; role: Role; name: string };
  amount?: number;
  disbursedDate?: string;
  completionDate?: string;
  idempotencyKey?: string;
}

export interface DirectDisburseResult {
  loanCode: string;
  amount: number;
  commission: number;
  borrowerCredit: number;
  lenderBalanceAfter: number;
  borrowerBalanceAfter: number;
  adminRevenueAfter: number;
  idempotentReplay: boolean;
}

export function executeDirectLoanDisbursement(
  deps: DirectDisburseDeps,
  input: DirectDisburseInput
): DirectDisburseResult {
  const { db, lendersDb, membersDb, persistLenders, persistMembers, persistDb } = deps;
  const { loanRequestId, session } = input;

  if (session.role !== 'lender') {
    throw new DisbursementError(403, 'LENDER_ONLY', 'Only the approving lender can disburse this loan.');
  }

  if (inFlightLoanIds.has(loanRequestId)) {
    throw new DisbursementError(
      409,
      'CONCURRENT_DISBURSEMENT',
      'Disbursement is already in progress for this loan.'
    );
  }

  inFlightLoanIds.add(loanRequestId);
  try {
    const r = db.lr.find((x) => x.id === loanRequestId);
    if (!r) {
      throw new DisbursementError(404, 'LOAN_NOT_FOUND', 'Approved loan request was not found.');
    }

    // Strict lender ownership check (also checked before idempotency replay)
    if (!r.approvedByUserId || r.approvedByUserId !== session.userId) {
      throw new DisbursementError(
        403,
        'NOT_LOAN_OWNER',
        `Only ${r.lenderName || 'the approving lender'} can disburse this loan.`
      );
    }

    const cleanIdempotencyKey =
      typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey.trim()
        : `disb-${loanRequestId}-${session.userId}`;

    db.idempotencyKeys = db.idempotencyKeys || {};
    const existingIdem = db.idempotencyKeys[cleanIdempotencyKey];
    if (existingIdem && existingIdem.loanRequestId === loanRequestId) {
      const lenderUserNow = lendersDb.users.find((u) => u.id === session.userId);
      const memberUserNow =
        (r.userId ? membersDb.users.find((u) => u.id === r.userId) : undefined) ||
        findUserByMemberName(r.by);
      return {
        loanCode: existingIdem.loanCode,
        amount: existingIdem.amount,
        commission: existingIdem.commission,
        borrowerCredit: existingIdem.netAmount,
        lenderBalanceAfter: lenderUserNow?.wallet ?? 0,
        borrowerBalanceAfter: memberUserNow?.wallet ?? 0,
        adminRevenueAfter: db.rev,
        idempotentReplay: true,
      };
    }

    if (r.st === 'disbursed' || r.st === 'transferred') {
      throw new DisbursementError(
        409,
        'ALREADY_DISBURSED',
        `Loan ${r.loanCode || `#${r.id}`} has already been disbursed.`
      );
    }
    if (r.st !== 'approved') {
      throw new DisbursementError(
        409,
        'NOT_APPROVED',
        `Loan must be approved before disbursement (current status: ${r.st}).`
      );
    }

    const rawAmount = input.amount !== undefined ? Number(input.amount) : r.amt;
    const { amount, commission, borrowerCredit } = calculateLoanBreakdown(rawAmount);

    const lenderUser = lendersDb.users.find((u) => u.id === session.userId);
    if (!lenderUser) {
      throw new DisbursementError(404, 'LENDER_NOT_FOUND', 'Lender wallet account was not found.');
    }

    if (lenderUser.wallet < amount) {
      throw new DisbursementError(
        400,
        'INSUFFICIENT_LENDER_BALANCE',
        `Insufficient lender wallet balance: ${K(amount)} required, ${K(lenderUser.wallet)} available. Deposit funds via M-Pesa first.`,
        {
          requiredAmount: amount,
          availableBalance: lenderUser.wallet,
        }
      );
    }

    const memberUser: StoredUser | undefined =
      (r.userId ? membersDb.users.find((u) => u.id === r.userId) : undefined) ||
      membersDb.users.find((u) => u.name.trim().toLowerCase() === r.by.trim().toLowerCase()) ||
      membersDb.users.find((u) => u.username.trim().toLowerCase() === r.by.trim().toLowerCase());

    if (!memberUser) {
      throw new DisbursementError(404, 'BORROWER_NOT_FOUND', 'Borrower wallet account was not found.');
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultCompletionIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const disbursedDate =
      typeof input.disbursedDate === 'string' && input.disbursedDate.trim()
        ? input.disbursedDate.trim()
        : todayIso;
    const completionDate =
      typeof input.completionDate === 'string' && input.completionDate.trim()
        ? input.completionDate.trim()
        : defaultCompletionIso;

    // Pre-transaction snapshots for deterministic full rollback on any error
    const snapLenderWallet = lenderUser.wallet;
    const snapMemberWallet = memberUser.wallet;
    const snapMemberLoanCredit = memberUser.loanCredit ?? 0;
    const snapLoanRequest = { ...r };
    const snapLent = db.lent;
    const snapRev = db.rev;
    const snapFee = db.fee || 0;
    const snapLoansLen = db.loans.length;
    const snapTxLen = db.tx.length;
    const snapNtLen = db.nt.length;
    const snapRevLedgerLen = (db.revenueLedger || []).length;
    const snapAuditLen = (db.auditLog || []).length;
    const hadPrevIdem = Object.prototype.hasOwnProperty.call(db.idempotencyKeys, cleanIdempotencyKey);

    let persistedLenders = false;
    let persistedMembers = false;

    try {
      const loanCode = `#LN-${String(db.loans.length + 1).padStart(3, '0')}`;
      const nowIso = new Date().toISOString();
      const transferredAt = new Date().toLocaleString('en-KE', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // 1. Debit Lender Wallet
      lenderUser.wallet -= amount;

      // 2. Credit Borrower Wallet (amount - 5% commission)
      memberUser.wallet += borrowerCredit;
      memberUser.loanCredit = (memberUser.loanCredit || 0) + borrowerCredit;

      // 3. Credit Admin / Platform Revenue Wallet (5% commission)
      db.rev += commission;
      db.fee = (db.fee || 0) + commission;
      db.lent += amount;

      // 4. Mark Loan Disbursed
      r.st = 'disbursed';
      r.disbursedAmt = amount;
      r.commissionAmt = commission;
      r.netAmt = borrowerCredit;
      r.transferredAt = transferredAt;
      r.disbursedDate = disbursedDate;
      r.completionDate = completionDate;
      r.loanCode = loanCode;
      r.idempotencyKey = cleanIdempotencyKey;

      db.loans.unshift({
        id: loanCode,
        requestId: r.id,
        amt: amount,
        commissionAmt: commission,
        netAmt: borrowerCredit,
        st: 'Active',
        lender: r.lender || ME,
        lenderId: lenderUser.id,
        lenderName: lenderUser.name,
        who: r.by,
        memberCode: r.memberCode || memberUser.memberCode,
        phone: r.phone || memberUser.phone,
        pid: r.pid,
        gn: r.gn,
        disbursedDate,
        completionDate,
      });

      // 5. Write Three Ledger Entries (lender debit, borrower credit, admin credit)
      db.tx.unshift(
        {
          id: `tx-${crypto.randomUUID()}`,
          userId: 'usr-admin',
          t: `Income from borrower ${r.by}, loan code ${loanCode}`,
          a: commission,
          d: 'Just now',
          k: 'l',
          r: 'admin',
          loanCode,
          entryType: 'credit',
          source: 'Loan Platform Commission 5%',
        },
        {
          id: `tx-${crypto.randomUUID()}`,
          userId: memberUser.id,
          t: `Loan Disbursement from ${lenderUser.name} (${loanCode}: ${K(amount)} less 5% commission ${K(commission)})`,
          a: borrowerCredit,
          d: 'Just now',
          k: 'l',
          r: 'member',
          loanCode,
          entryType: 'credit',
        },
        {
          id: `tx-${crypto.randomUUID()}`,
          userId: lenderUser.id,
          t: `Loan Disbursement to ${r.by} (${loanCode})`,
          a: -amount,
          d: 'Just now',
          k: 'l',
          r: 'lender',
          loanCode,
          entryType: 'debit',
        }
      );

      // 6. Admin Income Entry in revenueLedger
      recordAdminRevenue(db, {
        category: 'loan_commission',
        source: 'Loan Platform Commission 5%',
        loanCode,
        borrowerName: r.by,
        amount: commission,
        sourceUser: `${r.by} (${r.memberCode || memberUser.memberCode || 'BUY-M'})`,
        description: `Income from borrower ${r.by}, loan code ${loanCode}`,
      });

      // 7. Audit Log Entry
      db.auditLog = db.auditLog || [];
      db.auditLog.unshift({
        id: `aud-${crypto.randomUUID()}`,
        action: 'LOAN_DIRECT_DISBURSEMENT',
        actorUserId: lenderUser.id,
        actorRole: 'lender',
        actorName: lenderUser.name,
        loanRequestId: r.id,
        loanCode,
        borrowerName: r.by,
        amount,
        commission,
        netAmount: borrowerCredit,
        idempotencyKey: cleanIdempotencyKey,
        timestamp: nowIso,
      });

      // 8. Record Idempotency Key
      db.idempotencyKeys[cleanIdempotencyKey] = {
        loanRequestId: r.id,
        loanCode,
        amount,
        commission,
        netAmount: borrowerCredit,
        disbursedAt: nowIso,
      };

      // 9. Persistent In-App Notifications
      pushPrivateNote(db, {
        r: 'member',
        userId: memberUser.id,
        category: 'loan',
        t: `Loan ${loanCode} disbursed by ${lenderUser.name}! ${K(borrowerCredit)} credited to your Member Wallet (${K(commission)} 5% commission). New balance: ${K(memberUser.wallet)}.`,
      });
      pushPrivateNote(db, {
        r: 'lender',
        userId: lenderUser.id,
        category: 'loan',
        t: `Loan ${loanCode} disbursed to ${r.by}! Debited ${K(amount)}, credited ${K(borrowerCredit)} to borrower and ${K(commission)} 5% commission. New wallet balance: ${K(lenderUser.wallet)}.`,
      });
      pushPrivateNote(db, {
        r: 'admin',
        userId: 'usr-admin',
        category: 'payment',
        t: `Income from borrower ${r.by}, loan code ${loanCode}: +${K(commission)} (Loan Platform Commission 5%).`,
      });
      for (const lu of lendersDb.users) {
        if (lu.id !== lenderUser.id) {
          pushPrivateNote(db, {
            r: 'lender',
            userId: lu.id,
            category: 'loan',
            t: `Loan Disbursed Notice: ${r.by} (${r.memberCode || 'Member'}) loan ${loanCode} of ${K(amount)} was disbursed on ${disbursedDate} by ${lenderUser.name} (Completes: ${completionDate}).`,
          });
        }
      }

      // 10. Commit persistence atomically with rollback if any write fails
      persistLenders();
      persistedLenders = true;
      persistMembers();
      persistedMembers = true;
      persistDb();

      return {
        loanCode,
        amount,
        commission,
        borrowerCredit,
        lenderBalanceAfter: lenderUser.wallet,
        borrowerBalanceAfter: memberUser.wallet,
        adminRevenueAfter: db.rev,
        idempotentReplay: false,
      };
    } catch (err) {
      // Full deterministic rollback on any failure
      lenderUser.wallet = snapLenderWallet;
      memberUser.wallet = snapMemberWallet;
      memberUser.loanCredit = snapMemberLoanCredit;
      Object.assign(r, snapLoanRequest);
      if (!('disbursedAmt' in snapLoanRequest)) delete r.disbursedAmt;
      if (!('commissionAmt' in snapLoanRequest)) delete r.commissionAmt;
      if (!('netAmt' in snapLoanRequest)) delete r.netAmt;
      if (!('transferredAt' in snapLoanRequest)) delete r.transferredAt;
      if (!('disbursedDate' in snapLoanRequest)) delete r.disbursedDate;
      if (!('completionDate' in snapLoanRequest)) delete r.completionDate;
      if (!('loanCode' in snapLoanRequest)) delete r.loanCode;
      if (!('idempotencyKey' in snapLoanRequest)) delete r.idempotencyKey;

      db.lent = snapLent;
      db.rev = snapRev;
      db.fee = snapFee;
      if (db.loans.length > snapLoansLen) {
        db.loans.splice(0, db.loans.length - snapLoansLen);
      }
      if (db.tx.length > snapTxLen) {
        db.tx.splice(0, db.tx.length - snapTxLen);
      }
      if (db.nt.length > snapNtLen) {
        db.nt.splice(0, db.nt.length - snapNtLen);
      }
      if (db.revenueLedger && db.revenueLedger.length > snapRevLedgerLen) {
        db.revenueLedger.splice(0, db.revenueLedger.length - snapRevLedgerLen);
      }
      if (db.auditLog && db.auditLog.length > snapAuditLen) {
        db.auditLog.splice(0, db.auditLog.length - snapAuditLen);
      }
      if (!hadPrevIdem) {
        delete db.idempotencyKeys[cleanIdempotencyKey];
      }

      if (persistedLenders) {
        try {
          persistLenders();
        } catch {
          // Best-effort disk rollback
        }
      }
      if (persistedMembers) {
        try {
          persistMembers();
        } catch {
          // Best-effort disk rollback
        }
      }

      throw err;
    }
  } finally {
    inFlightLoanIds.delete(loanRequestId);
  }
}
