import type { GroupMember, Product, ProductGroup } from '../types/buyoll.ts';

export const C10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const GROUP_LETTERS = 'ABCDEFGHIJ';
export const BM = "Betty's Shop";
export const ME = 1;

export const CATS = [
  'All',
  'Bedding',
  'Kitchen',
  'Electronics',
  'Cell Phones & Accessories',
  'Furniture',
  'Bags & Luggage',
  'Home',
] as const;

export const K = (n: number | string) => 'KSh ' + Number(n).toLocaleString();

export const inst = (p: number, c: number) => Math.round(p / (c * 10));

export const dc = (p: Product) => (p.o > p.p ? Math.round((1 - p.p / p.o) * 100) : 0);

export const dl = (n: number) => {
  const t = new Date(Date.now() + n * 864e5);
  const d = t.getDate();
  const s = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
  return `${d}${s} ${t.toLocaleString('en', { month: 'long' })}`;
};

/**
 * Computes a member's active 10-day round (1..capacity), days in the active round (0..10),
 * and full per-round breakdown.
 * When 10 days of a round are over and round < capacity, automatically starts the next
 * 10-day tracking window (round + 1, activeDays = 0) until all members get the product.
 */
export function getMemberTracking(m: GroupMember, capacity: number) {
  const maxDays = capacity * 10;
  const totalPaid = Math.max(0, Math.min(maxDays, m.totalPaid ?? m.d ?? 0));
  const rounds: number[] = [];
  let rem = totalPaid;
  for (let r = 0; r < capacity; r++) {
    const val = Math.min(10, rem);
    rounds.push(val);
    rem -= val;
  }

  const completedAll = totalPaid >= maxDays;
  const completedRounds = Math.floor(totalPaid / 10);
  // Active 10-day tracking round (1-indexed): rolls over immediately when 10 days are over until final round
  const activeRound = completedAll ? capacity : completedRounds + 1;
  const activeDays = completedAll ? 10 : totalPaid % 10;

  return {
    totalPaid,
    maxDays,
    rounds,
    completedRounds,
    activeRound,
    activeDays,
    completedAll,
  };
}

/**
 * Applies `daysToAdd` paid days to a single member and automatically rolls over
 * to the next 10-day Payment Tracking cycle when 10 days are over.
 */
export function creditMemberDays(m: GroupMember, capacity: number, daysToAdd: number): GroupMember {
  const maxDays = capacity * 10;
  const prevTotal = m.totalPaid ?? m.d ?? 0;
  const nextTotal = Math.min(maxDays, prevTotal + Math.max(0, daysToAdd));
  const info = getMemberTracking({ ...m, totalPaid: nextTotal }, capacity);
  return {
    ...m,
    totalPaid: info.totalPaid,
    d: info.activeDays,
    rounds: info.rounds,
  };
}

export function dn(g: ProductGroup) {
  if (g.done) return g.c * 10;
  const maxInRound = g.r.length
    ? Math.max(
        0,
        ...g.r.map((m) => {
          const t = getMemberTracking(m, g.c);
          const idx = Math.max(0, g.rot - 1);
          return t.rounds[idx] ?? t.activeDays;
        })
      )
    : 0;
  return (g.rot - 1) * 10 + maxInRound;
}

/**
 * Globally enforces that every product has group sizes 1..10 (A=1 .. J=10)
 * and that each group size k strictly accommodates at most k members.
 */
export function enforceProductGroups(groups: ProductGroup[]): ProductGroup[] {
  return C10.map((size, idx) => {
    const letter = GROUP_LETTERS[idx];
    const existing = groups.find((g) => g.n === letter) || groups.find((g) => g.c === size);
    const rawMembers = existing ? existing.r.slice(0, size) : [];
    const hasExplicitMod = rawMembers.some((m) => Boolean(m.mod));
    const normalizedMembers: GroupMember[] = rawMembers.map((m, mIdx) => {
      const info = getMemberTracking(m, size);
      return {
        ...m,
        mod: hasExplicitMod ? Boolean(m.mod) : mIdx === 0,
        totalPaid: info.totalPaid,
        d: info.activeDays,
        rounds: info.rounds,
      };
    });

    // Determine group rotation state based on all members completing each 10-day round
    let rot = existing?.rot ? Math.min(size, Math.max(1, existing.rot)) : 1;
    let done = Boolean(existing?.done);

    if (normalizedMembers.length === size) {
      while (!done && normalizedMembers.every((m) => (m.totalPaid ?? 0) >= rot * 10)) {
        if (rot >= size) {
          done = true;
        } else {
          rot += 1;
        }
      }
    }

    return {
      n: letter,
      c: size,
      r: normalizedMembers,
      j: normalizedMembers.length,
      rot,
      done,
      rules:
        existing?.rules ||
        'Pay daily instalments on time. New members must be referred by someone the group knows and accepted by the Moderator.',
      moderatorVotes: existing?.moderatorVotes,
      myModVote: existing?.myModVote,
    };
  });
}
