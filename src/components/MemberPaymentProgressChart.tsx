import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import type { AppState, MyGroupEntry, Product, ProductGroup } from '../types/buyoll';
import { K, getMemberTracking, inst } from '../utils/format';

interface MemberPaymentProgressChartProps {
  state: AppState;
  onOpenGroups: () => void;
  onOpenTrack: (pid: number, gn: string) => void;
  onOpenPayModal?: (entry: MyGroupEntry) => void;
}

interface TimelinePoint {
  label: string;
  subLabel: string;
  paidAmount: number;
  targetAmount: number;
  paidDays: number;
  remainingDays: number;
  roundDaysPaid: number;
  roundAmountPaid: number;
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: TimelinePoint;
}

const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '10px 12px',
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
        fontSize: '12px',
        color: '#191919',
        minWidth: '175px',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: '2px' }}>{label}</div>
      {pt?.subLabel && (
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>{pt.subLabel}</div>
      )}
      {payload.map((entry, idx) => (
        <div
          key={`${entry.dataKey || idx}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginTop: '3px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ color: '#475569' }}>{entry.name}:</span>
          <b style={{ color: entry.color || '#191919' }}>
            {entry.dataKey === 'paidDays' || entry.dataKey === 'remainingDays'
              ? `${entry.value ?? 0} day(s)`
              : K(entry.value ?? 0)}
          </b>
        </div>
      ))}
    </div>
  );
};

export const MemberPaymentProgressChart: React.FC<MemberPaymentProgressChartProps> = ({
  state,
  onOpenGroups,
  onOpenTrack,
  onOpenPayModal,
}) => {
  const [chartType, setChartType] = useState<'cumulative' | 'rounds'>('cumulative');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('all');

  const activeItems = useMemo(() => {
    const items: Array<{
      key: string;
      entry: MyGroupEntry;
      product: Product;
      group: ProductGroup;
      daily: number;
      tracking: ReturnType<typeof getMemberTracking>;
    }> = [];

    for (const entry of state.my) {
      const product = state.products.find((p) => p.id === entry.pid);
      const group = product?.g.find((g) => g.n === entry.g);
      if (!product || !group) continue;
      const me = group.r.find((r) => r.me);
      const tracking = getMemberTracking(
        me || { n: state.name, d: 0, totalPaid: 0, rounds: [] },
        group.c
      );
      items.push({
        key: `${entry.pid}:${entry.g}`,
        entry,
        product,
        group,
        daily: inst(product.p, group.c),
        tracking,
      });
    }
    return items;
  }, [state.my, state.products, state.name]);

  const effectiveKey = useMemo(() => {
    if (selectedGroupKey === 'all') return 'all';
    return activeItems.some((item) => item.key === selectedGroupKey) ? selectedGroupKey : 'all';
  }, [selectedGroupKey, activeItems]);

  const scopedItems = useMemo(
    () =>
      effectiveKey === 'all'
        ? activeItems
        : activeItems.filter((item) => item.key === effectiveKey),
    [activeItems, effectiveKey]
  );

  const summary = useMemo(() => {
    const totalPaidDays = scopedItems.reduce((s, item) => s + item.tracking.totalPaid, 0);
    const totalTargetDays = scopedItems.reduce((s, item) => s + item.tracking.maxDays, 0);
    const totalPaidAmt = scopedItems.reduce(
      (s, item) => s + item.tracking.totalPaid * item.daily,
      0
    );
    const totalTargetAmt = scopedItems.reduce(
      (s, item) => s + item.tracking.maxDays * item.daily,
      0
    );
    const pendingAmt = state.groupPayments
      .filter(
        (gp) =>
          gp.isMe &&
          gp.st === 'pending' &&
          (effectiveKey === 'all' || `${gp.pid}:${gp.g}` === effectiveKey)
      )
      .reduce((s, gp) => s + gp.amount, 0);
    const pct =
      totalTargetAmt > 0 ? Math.min(100, Math.round((totalPaidAmt / totalTargetAmt) * 100)) : 0;
    return {
      totalPaidDays,
      totalTargetDays,
      totalPaidAmt,
      totalTargetAmt,
      pendingAmt,
      pct,
    };
  }, [scopedItems, state.groupPayments, effectiveKey]);

  const timelineData = useMemo<TimelinePoint[]>(() => {
    if (scopedItems.length === 0) {
      // Fall back to member wallet transaction history if they have no active groups yet
      const memberTx = state.tx
        .filter((t) => (t.r || 'member') === 'member')
        .slice(0, 6)
        .reverse();
      if (memberTx.length > 0) {
        let running = 0;
        return memberTx.map((t, idx) => {
          const amt = Math.abs(t.a);
          running += t.k === 'c' ? amt : 0;
          return {
            label: t.d === 'Just now' ? `Tx ${idx + 1}` : t.d,
            subLabel: t.t,
            paidAmount: amt,
            targetAmount: running,
            paidDays: 0,
            remainingDays: 0,
            roundDaysPaid: 0,
            roundAmountPaid: amt,
          };
        });
      }
      return [];
    }

    // If a single 1-member group is selected, plot each day 1..10 for clear daily granularity
    if (scopedItems.length === 1 && scopedItems[0].group.c === 1) {
      const item = scopedItems[0];
      const points: TimelinePoint[] = [];
      let cumPaid = 0;
      for (let day = 1; day <= 10; day++) {
        const isPaid = day <= item.tracking.totalPaid;
        if (isPaid) cumPaid += item.daily;
        points.push({
          label: `Day ${day}`,
          subLabel: `${item.product.n} · Solo 10-day plan`,
          paidAmount: cumPaid,
          targetAmount: day * item.daily,
          paidDays: isPaid ? 1 : 0,
          remainingDays: isPaid ? 0 : 1,
          roundDaysPaid: isPaid ? 1 : 0,
          roundAmountPaid: isPaid ? item.daily : 0,
        });
      }
      return points;
    }

    // Otherwise plot across 10-day rounds (Round 1 .. maxRounds) showing cumulative progress over time
    const maxRounds = Math.max(1, ...scopedItems.map((i) => i.group.c));
    const points: TimelinePoint[] = [];
    let cumPaidAmt = 0;
    let cumTargetAmt = 0;

    for (let rIdx = 0; rIdx < maxRounds; rIdx++) {
      let roundPaidDays = 0;
      let roundTargetDays = 0;
      let roundPaidAmt = 0;
      let roundTargetAmt = 0;

      for (const item of scopedItems) {
        if (rIdx < item.group.c) {
          const daysInRound = item.tracking.rounds[rIdx] ?? 0;
          roundPaidDays += daysInRound;
          roundTargetDays += 10;
          roundPaidAmt += daysInRound * item.daily;
          roundTargetAmt += 10 * item.daily;
        }
      }

      cumPaidAmt += roundPaidAmt;
      cumTargetAmt += roundTargetAmt;

      points.push({
        label: `R${rIdx + 1} (D${rIdx * 10 + 1}–${(rIdx + 1) * 10})`,
        subLabel: `10-Day Cycle Round ${rIdx + 1} · ${roundPaidDays}/${roundTargetDays} days`,
        paidAmount: cumPaidAmt,
        targetAmount: cumTargetAmt,
        paidDays: roundPaidDays,
        remainingDays: Math.max(0, roundTargetDays - roundPaidDays),
        roundDaysPaid: roundPaidDays,
        roundAmountPaid: roundPaidAmt,
      });
    }
    return points;
  }, [scopedItems, state.tx]);

  const singleSelected = scopedItems.length === 1 ? scopedItems[0] : null;

  return (
    <section
      className="card"
      aria-label="Member Payment Progress Over Time"
      style={{ marginTop: '12px', padding: '16px' }}
    >
      <div className="row sp" style={{ flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '16px', color: '#191919' }}>
            Payment Progress Over Time
          </h3>
          <div className="mu">
            10-day cycle contributions tracked against your group completion target
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: '8px' }}>
          {activeItems.length > 0 && (
            <select
              aria-label="Filter payment progress by group"
              value={effectiveKey}
              onChange={(e) => setSelectedGroupKey(e.target.value)}
              style={{
                width: 'auto',
                margin: 0,
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '10px',
              }}
            >
              <option value="all">All Active Groups ({activeItems.length})</option>
              {activeItems.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.product.n} · Group {item.group.n}
                </option>
              ))}
            </select>
          )}

          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              background: '#f1f5f9',
              borderRadius: '10px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setChartType('cumulative')}
              style={{
                border: 0,
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: chartType === 'cumulative' ? '#ffffff' : 'transparent',
                color: chartType === 'cumulative' ? '#191919' : '#64748b',
                boxShadow: chartType === 'cumulative' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <TrendingUp size={13} />
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setChartType('rounds')}
              style={{
                border: 0,
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: chartType === 'rounds' ? '#ffffff' : 'transparent',
                color: chartType === 'rounds' ? '#191919' : '#64748b',
                boxShadow: chartType === 'rounds' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <BarChart3 size={13} />
              Per Cycle
            </button>
          </div>
        </div>
      </div>

      {/* Clean tabular KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          padding: '10px 12px',
          background: '#fafafa',
          border: '1px solid #ebebeb',
          borderRadius: '12px',
          marginBottom: '12px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div>
          <div className="mu">Total Contributed</div>
          <b style={{ fontSize: '16px', color: '#e62e04' }}>{K(summary.totalPaidAmt)}</b>
        </div>
        <div>
          <div className="mu">Cycle Target</div>
          <b style={{ fontSize: '16px', color: '#191919' }}>{K(summary.totalTargetAmt)}</b>
        </div>
        <div>
          <div className="mu">Days Completed</div>
          <b style={{ fontSize: '16px', color: '#191919' }}>
            {summary.totalPaidDays} / {summary.totalTargetDays}
          </b>
        </div>
        <div>
          <div className="mu">Overall Progress</div>
          <b style={{ fontSize: '16px', color: '#16a34a' }}>
            {summary.pct}%
            {summary.pendingAmt > 0 ? (
              <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginLeft: '6px' }}>
                ({K(summary.pendingAmt)} pending)
              </span>
            ) : null}
          </b>
        </div>
      </div>

      {timelineData.length > 0 ? (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'cumulative' ? (
              <ComposedChart data={timelineData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="buyollPaidFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e62e04" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#ff7a00" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v) =>
                    Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : `${v}`
                  }
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Area
                  type="monotone"
                  dataKey="paidAmount"
                  name="Paid So Far"
                  stroke="#e62e04"
                  strokeWidth={2.5}
                  fill="url(#buyollPaidFill)"
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="targetAmount"
                  name="Target Pace"
                  stroke="#0f766e"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </ComposedChart>
            ) : (
              <BarChart data={timelineData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Bar
                  dataKey="paidDays"
                  name="Paid Days"
                  stackId="days"
                  fill="#16a34a"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="remainingDays"
                  name="Remaining Days"
                  stackId="days"
                  fill="#fed7aa"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          style={{
            padding: '22px 14px',
            textAlign: 'center',
            background: '#fafafa',
            borderRadius: '12px',
            border: '1px dashed #e2e8f0',
          }}
        >
          <b style={{ fontSize: '14px' }}>No active payment timeline yet</b>
          <p className="mu" style={{ margin: '4px 0 10px' }}>
            Join your first 1–10 member Chamaa group to track your 10-day installment progress here.
          </p>
          <button type="button" className="btn y sm" onClick={onOpenGroups}>
            Browse Open Groups →
          </button>
        </div>
      )}

      {activeItems.length > 0 && (
        <div className="row sp" style={{ marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <span className="mu">
            {singleSelected
              ? `Viewing ${singleSelected.product.n} · Group ${singleSelected.group.n} (${K(singleSelected.daily)}/day)`
              : `Tracking ${activeItems.length} active group${activeItems.length > 1 ? 's' : ''}`}
          </span>
          <div className="row" style={{ gap: '6px' }}>
            {singleSelected && onOpenPayModal && singleSelected.entry.st === 'ok' && !singleSelected.tracking.completedAll && (
              <button
                type="button"
                className="btn y sm"
                onClick={() => onOpenPayModal(singleSelected.entry)}
              >
                Pay Today ({K(singleSelected.daily)})
              </button>
            )}
            <button
              type="button"
              className="btn o sm"
              onClick={() =>
                singleSelected
                  ? onOpenTrack(singleSelected.product.id, singleSelected.group.n)
                  : onOpenGroups()
              }
            >
              {singleSelected ? 'Open Group Ledger →' : 'View All My Groups →'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
