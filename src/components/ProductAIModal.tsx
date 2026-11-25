import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BarChart3, MessageSquareText, ShieldCheck, Sparkles, X } from 'lucide-react';
import { api } from '../api/client';
import type { AiInquiry, Product, Role } from '../types/buyoll';
import { C10, K, dc, getMemberTracking, inst } from '../utils/format';
import { ProductThumb } from './SharedViews';

interface ProductAIModalProps {
  product: Product | null;
  role: Role | null;
  currentUserName: string;
  onClose: () => void;
  onGoToPlans: (pid: number) => void;
  onToast: (msg: string) => void;
}

type ModalTab = 'chat' | 'plans' | 'insights';

const SOLO_MONTH_PLANS = [1, 2, 3, 4, 5, 6] as const;

export const ProductAIModal: React.FC<ProductAIModalProps> = ({
  product,
  role,
  currentUserName,
  onClose,
  onGoToPlans,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('chat');
  const [history, setHistory] = useState<AiInquiry[]>([]);
  const [canViewInsights, setCanViewInsights] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedGroupSize, setSelectedGroupSize] = useState<number>(10);
  const [selectedSoloMonths, setSelectedSoloMonths] = useState<number>(3);
  const [d3Metric, setD3Metric] = useState<'pct' | 'amount'>('pct');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const d3SvgRef = useRef<SVGSVGElement | null>(null);

  const localOwnerOrAdmin = useMemo(() => {
    if (!product || !role) return false;
    if (role === 'admin') return true;
    return role === 'merchant' && product.m === currentUserName;
  }, [product, role, currentUserName]);

  useEffect(() => {
    if (!product) return;
    setActiveTab('chat');
    setQuestion('');
    setSelectedGroupSize(10);
    setSelectedSoloMonths(3);
    setCanViewInsights(localOwnerOrAdmin);

    let cancelled = false;
    setLoadingHistory(true);
    api
      .getProductAiHistory(product.id)
      .then((res) => {
        if (cancelled) return;
        setHistory(res.history || []);
        setCanViewInsights(Boolean(res.canViewInsights || localOwnerOrAdmin));
      })
      .catch(() => {
        if (!cancelled) {
          setHistory(product.aiInquiries || []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [product, localOwnerOrAdmin]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, sending, activeTab]);

  const groupRates = useMemo(() => {
    if (!product) return [];
    return [...C10].reverse().map((size) => {
      const grp = product.g.find((g) => g.c === size);
      const daily = inst(product.p, size);
      const targetTotal = product.p * size;
      const targetDays = size * (size * 10);
      const collectedDays = Math.min(
        targetDays,
        (grp?.r || []).reduce((sum, m) => sum + getMemberTracking(m, size).totalPaid, 0)
      );
      const collectedTotal = Math.min(targetTotal, collectedDays * daily);
      const progressPct =
        targetTotal > 0 ? Math.min(100, Math.round((collectedTotal / targetTotal) * 100)) : 0;

      return {
        size,
        letter: grp?.n || 'A',
        daily,
        days: size * 10,
        joined: grp?.j ?? 0,
        targetTotal,
        collectedTotal,
        targetDays,
        collectedDays,
        progressPct,
      };
    });
  }, [product]);

  useEffect(() => {
    if (activeTab !== 'plans' || !product || !d3SvgRef.current || groupRates.length === 0) return;

    const svgEl = d3SvgRef.current;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 560;
    const height = 278;
    const margin = { top: 22, right: 108, bottom: 32, left: 96 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('role', 'img')
      .attr('aria-label', `D3 Group Payment Progress vs Target chart for ${product.n}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxAmountTarget = d3.max(groupRates, (d) => d.targetTotal) || product.p * 10;
    const xScale = d3
      .scaleLinear()
      .domain([0, d3Metric === 'pct' ? 100 : maxAmountTarget])
      .range([0, innerW])
      .nice();

    const yScale = d3
      .scaleBand<string>()
      .domain(groupRates.map((d) => d.letter))
      .range([0, innerH])
      .padding(0.26);

    // Subtle vertical grid lines
    const xGrid = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickSize(-innerH)
      .tickFormat(() => '');

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xGrid)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('line')
          .attr('stroke', '#e2e8f0')
          .attr('stroke-dasharray', '3,3')
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((val) =>
            d3Metric === 'pct'
              ? `${val}%`
              : Number(val) >= 1000
                ? `${Math.round(Number(val) / 1000)}k`
                : `${val}`
          )
      )
      .call((sel) => sel.select('.domain').attr('stroke', '#cbd5e1'))
      .call((sel) =>
        sel.selectAll('text').attr('fill', '#64748b').attr('font-size', '10px')
      );

    // Y Axis (Group labels)
    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .tickFormat((letter) => {
            const item = groupRates.find((r) => r.letter === letter);
            return item ? `Grp ${item.letter} (${item.joined}/${item.size})` : `Grp ${letter}`;
          })
      )
      .call((sel) => sel.select('.domain').attr('stroke', '#cbd5e1'))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', (letter) => {
            const item = groupRates.find((r) => r.letter === letter);
            return item?.size === selectedGroupSize ? '#c2410c' : '#334155';
          })
          .attr('font-weight', (letter) => {
            const item = groupRates.find((r) => r.letter === letter);
            return item?.size === selectedGroupSize ? '700' : '500';
          })
          .attr('font-size', '10.5px')
      );

    // Target track bars (full target capacity per group)
    g.selectAll('.target-bar')
      .data(groupRates)
      .enter()
      .append('rect')
      .attr('class', 'target-bar')
      .attr('x', 0)
      .attr('y', (d) => yScale(d.letter) ?? 0)
      .attr('width', (d) =>
        Math.max(4, xScale(d3Metric === 'pct' ? 100 : d.targetTotal))
      )
      .attr('height', yScale.bandwidth())
      .attr('rx', 5)
      .attr('fill', '#f1f5f9')
      .attr('stroke', (d) => (d.size === selectedGroupSize ? '#fb923c' : '#cbd5e1'))
      .attr('stroke-width', (d) => (d.size === selectedGroupSize ? 1.5 : 1))
      .style('cursor', 'pointer')
      .on('click', (_event, d) => setSelectedGroupSize(d.size));

    // Target threshold reference markers
    if (d3Metric === 'pct') {
      const targetX = xScale(100);
      g.append('line')
        .attr('x1', targetX)
        .attr('x2', targetX)
        .attr('y1', -6)
        .attr('y2', innerH)
        .attr('stroke', '#0f766e')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');

      g.append('text')
        .attr('x', targetX)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0f766e')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .text('Target 100%');
    } else {
      g.selectAll('.target-cap')
        .data(groupRates)
        .enter()
        .append('line')
        .attr('class', 'target-cap')
        .attr('x1', (d) => xScale(d.targetTotal))
        .attr('x2', (d) => xScale(d.targetTotal))
        .attr('y1', (d) => (yScale(d.letter) ?? 0) - 1)
        .attr('y2', (d) => (yScale(d.letter) ?? 0) + yScale.bandwidth() + 1)
        .attr('stroke', '#0f766e')
        .attr('stroke-width', 2);
    }

    // Paid progress bars animated via D3 transition
    const progressBars = g
      .selectAll('.progress-bar')
      .data(groupRates)
      .enter()
      .append('rect')
      .attr('class', 'progress-bar')
      .attr('x', 0)
      .attr('y', (d) => yScale(d.letter) ?? 0)
      .attr('width', 0)
      .attr('height', yScale.bandwidth())
      .attr('rx', 5)
      .attr('fill', (d) => {
        if (d.progressPct >= 100) return '#16a34a';
        if (d.size === selectedGroupSize) return '#e62e04';
        return d.collectedTotal > 0 ? '#f97316' : '#fed7aa';
      })
      .style('cursor', 'pointer')
      .on('click', (_event, d) => setSelectedGroupSize(d.size));

    progressBars
      .transition()
      .duration(350)
      .attr('width', (d) => {
        const val = d3Metric === 'pct' ? d.progressPct : d.collectedTotal;
        if (val <= 0) return 0;
        return Math.max(4, xScale(val));
      });

    // Value / Target labels at right edge of each target bar
    g.selectAll('.bar-label')
      .data(groupRates)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', (d) =>
        xScale(d3Metric === 'pct' ? 100 : d.targetTotal) + 6
      )
      .attr('y', (d) => (yScale(d.letter) ?? 0) + yScale.bandwidth() / 2 + 3.5)
      .attr('fill', (d) => (d.progressPct > 0 ? '#191919' : '#64748b'))
      .attr('font-size', '10px')
      .attr('font-weight', (d) => (d.size === selectedGroupSize ? '700' : '600'))
      .text((d) =>
        d3Metric === 'pct'
          ? `${d.progressPct}% (${K(d.collectedTotal)})`
          : `${K(d.collectedTotal)} / ${K(d.targetTotal)}`
      );
  }, [activeTab, product, groupRates, selectedGroupSize, d3Metric]);

  if (!product) return null;

  const discount = dc(product);
  const showInsightsTab = canViewInsights || localOwnerOrAdmin;
  const maxGroupDaily = inst(product.p, 2);
  const maxSoloMonthly = Math.ceil(product.p / 1);

  const suggestedPrompts = [
    { label: '✨ Main benefits', q: `What are the main benefits of ${product.n}?` },
    { label: '💡 Why buy this?', q: `Why should I buy ${product.n} from ${product.m}?` },
    { label: '📋 Verified specs', q: `What are the verified specifications and stock of ${product.n}?` },
    { label: '🏷️ Discounts & bonus gift', q: `What discounts or bonus gifts come with ${product.n}?` },
    { label: '💳 Wallet / Till payment', q: `How do I pay using my Buyoll wallet or M-Pesa Till for ${product.n}?` },
    { label: '👥 Group vs Solo plans', q: `Compare the 2–10 member group and solo installment plans for ${product.n}.` },
  ];

  const handleSend = async (promptText?: string) => {
    const clean = (promptText ?? question).trim();
    if (!clean || sending) return;
    if (!promptText) setQuestion('');
    setSending(true);
    setActiveTab('chat');
    try {
      const res = await api.askProductAi(product.id, clean);
      if (role) {
        setHistory(res.history);
      } else {
        // Guests keep their own browser-session chat without seeing other anonymous visitors
        setHistory((prev) => [...prev, res.inquiry]);
      }
      if (res.canViewInsights) setCanViewInsights(true);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Buyoll.AI could not respond right now');
    } finally {
      setSending(false);
    }
  };

  const selectedGroupObj = groupRates.find((g) => g.size === selectedGroupSize) || groupRates[0];
  const selectedSoloMonthlyAmt = Math.ceil(product.p / selectedSoloMonths);
  const selectedSoloDailyEq = Math.ceil(product.p / (selectedSoloMonths * 30));

  const specEntries: Array<[string, string]> = [
    ...(product.attributes ? Object.entries(product.attributes) : []),
    ['Category', product.cat],
    ['Available Stock', `${product.stock} unit(s)`],
    ['Pickup / Shop Location', product.loc],
    ['M-Pesa Till / Paybill', product.till],
  ];

  return (
    <div
      className="mod"
      role="dialog"
      aria-modal="true"
      aria-label={`Buyoll.AI Sales Advisor for ${product.n}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
        }}
      >
        {/* Product-bound Header */}
        <div
          style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            borderBottom: '1px solid #fed7aa',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <ProductThumb p={product} h={56} w="56px" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
              <span
                className="bd"
                style={{ background: '#e62e04', color: '#fff', fontSize: '10px' }}
              >
                ✨ Buyoll.AI Advisor
              </span>
              {discount > 0 && (
                <span className="bd r" style={{ fontSize: '10px' }}>
                  -{discount}% OFF
                </span>
              )}
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: '15px',
                color: '#191919',
                marginTop: '3px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.n}
            </div>
            <div style={{ fontSize: '12px', color: '#57534e' }}>
              <b style={{ color: '#e62e04', fontSize: '14px' }}>{K(product.p)}</b>
              {product.o > product.p && (
                <span className="old" style={{ marginLeft: '6px' }}>
                  {K(product.o)}
                </span>
              )}
              {' · '}Seller: <b>{product.m}</b>
            </div>
          </div>
          <button
            type="button"
            className="btn o sm"
            aria-label="Close Buyoll.AI modal"
            onClick={onClose}
            style={{ flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Three-Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px 14px',
            background: '#fafafa',
            borderBottom: '1px solid #ebebeb',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className={`btn sm ${activeTab === 'chat' ? '' : 'o'}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquareText size={14} /> Chat Advisor
          </button>
          <button
            type="button"
            className={`btn sm ${activeTab === 'plans' ? '' : 'o'}`}
            onClick={() => setActiveTab('plans')}
          >
            <BarChart3 size={14} /> Payment &amp; Installment
          </button>
          {showInsightsTab && (
            <button
              type="button"
              className={`btn sm ${activeTab === 'insights' ? '' : 'o'}`}
              onClick={() => setActiveTab('insights')}
            >
              <ShieldCheck size={14} /> Merchant Insights ({history.length})
            </button>
          )}
        </div>

        {/* Tab Body */}
        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'chat' && (
            <>
              {/* One-click suggested prompt chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {suggestedPrompts.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    disabled={sending}
                    onClick={() => void handleSend(chip.q)}
                    style={{
                      background: '#fff7ed',
                      color: '#9a3412',
                      border: '1px solid #fed7aa',
                      borderRadius: '10px',
                      padding: '5px 9px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Conversation Thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#292524',
                  }}
                >
                  <div className="row sp" style={{ marginBottom: '4px' }}>
                    <b style={{ color: '#c2410c' }}>✨ Buyoll.AI · {product.n}</b>
                    <span className="mu" style={{ fontSize: '11px' }}>
                      Product Advisor
                    </span>
                  </div>
                  Karibu to Buyoll! I&apos;m <b>Buyoll.AI</b>, your personal sales advisor for{' '}
                  <b>{product.n}</b> by verified seller <b>{product.m}</b> ({K(product.p)}
                  {discount > 0 ? `, ${discount}% OFF` : ''}).
                  {product.bonusGift ? ` Includes a bonus ${product.bonusGift}!` : ''} Ask me about
                  benefits, specs, or start for just <b>{K(inst(product.p, 10))}/day</b> in a
                  10-member Lipa Mdogomdogo group!
                </div>

                {loadingHistory && (
                  <div className="mu" style={{ textAlign: 'center', padding: '8px' }}>
                    Loading your product Q&amp;A history...
                  </div>
                )}

                {history.map((item) => (
                  <React.Fragment key={item.id}>
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        maxWidth: '85%',
                        background: '#e62e04',
                        color: '#fff',
                        borderRadius: '12px 12px 2px 12px',
                        padding: '8px 12px',
                        fontSize: '13px',
                      }}
                    >
                      <div>{item.question}</div>
                      <div
                        style={{
                          fontSize: '10px',
                          opacity: 0.85,
                          marginTop: '3px',
                          textAlign: 'right',
                        }}
                      >
                        {item.userName} · {item.timestamp}
                      </div>
                    </div>

                    <div
                      style={{
                        alignSelf: 'flex-start',
                        maxWidth: '88%',
                        background: '#f5f5f5',
                        border: '1px solid #e5e5e5',
                        color: '#191919',
                        borderRadius: '12px 12px 12px 2px',
                        padding: '9px 12px',
                        fontSize: '13px',
                      }}
                    >
                      <div className="row sp" style={{ marginBottom: '3px' }}>
                        <b style={{ color: '#c2410c', fontSize: '12px' }}>✨ Buyoll.AI</b>
                        <span className="mu" style={{ fontSize: '10px' }}>
                          {item.timestamp}
                        </span>
                      </div>
                      <div>{item.answer}</div>
                    </div>
                  </React.Fragment>
                ))}

                {sending && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#9a3412',
                      fontWeight: 600,
                    }}
                  >
                    <Sparkles size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    Buyoll.AI is preparing your personalized answer...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="row"
                style={{ marginTop: '12px', gap: '8px' }}
              >
                <input
                  style={{ margin: 0, flex: 1 }}
                  placeholder={`Ask Buyoll.AI anything about ${product.n}...`}
                  value={question}
                  maxLength={500}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn y sm"
                  disabled={sending || !question.trim()}
                >
                  {sending ? '...' : 'Ask AI'}
                </button>
              </form>
            </>
          )}

          {activeTab === 'plans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* D3 Dynamic Bar Chart: Group Payment Progress vs Target */}
              <div className="card" style={{ margin: 0 }}>
                <div className="row sp" style={{ marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <b>📊 Group Payment Progress vs Target (D3)</b>
                  <div className="row" style={{ gap: '4px' }}>
                    <button
                      type="button"
                      className={`btn sm ${d3Metric === 'pct' ? '' : 'o'}`}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => setD3Metric('pct')}
                    >
                      % Progress
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${d3Metric === 'amount' ? '' : 'o'}`}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => setD3Metric('amount')}
                    >
                      KSh vs Target
                    </button>
                  </div>
                </div>
                <p className="mu" style={{ marginBottom: '6px', fontSize: '11.5px' }}>
                  Live D3 comparison of total group contributions paid against each group&apos;s
                  full-cycle target. Click any bar to inspect that group.
                </p>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <svg ref={d3SvgRef} style={{ display: 'block', width: '100%', minWidth: '340px' }} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '6px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '11.5px',
                  }}
                >
                  <span>
                    Selected: <b>Group {selectedGroupObj.letter}</b> ({selectedGroupObj.joined}/
                    {selectedGroupObj.size} members)
                  </span>
                  <span>
                    Paid: <b style={{ color: '#e62e04' }}>{K(selectedGroupObj.collectedTotal)}</b> /
                    Target: <b style={{ color: '#0f766e' }}>{K(selectedGroupObj.targetTotal)}</b> (
                    <b>{selectedGroupObj.progressPct}%</b> · {selectedGroupObj.collectedDays}/
                    {selectedGroupObj.targetDays} days)
                  </span>
                </div>
              </div>

              {/* Promotional Bonus Gift */}
              {product.bonusGift && (
                <div
                  className="card"
                  style={{
                    margin: 0,
                    background: 'linear-gradient(90deg, #fff7ed 0%, #fef3c7 100%)',
                    borderColor: '#fcd34d',
                  }}
                >
                  <b style={{ color: '#92400e' }}>🎁 Promotional Bonus Gift Included</b>
                  <div style={{ fontSize: '13px', color: '#78350f', marginTop: '3px' }}>
                    {product.bonusGift} — included automatically with your {product.m} order.
                  </div>
                </div>
              )}

              {/* Interactive Lipa Mdogomdogo Group Speed Calculator & Bar Chart (10 down to 1) */}
              <div className="card" style={{ margin: 0 }}>
                <div className="row sp" style={{ marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <b>👥 Lipa Mdogomdogo Group Plans (10 → 1 Member)</b>
                  <span className="bd">
                    Group {selectedGroupObj.letter}: {K(selectedGroupObj.daily)}/day
                  </span>
                </div>
                <label className="mu">
                  Slide or pick group size ({selectedGroupSize} member
                  {selectedGroupSize > 1 ? 's' : ''} · {selectedGroupObj.days}-day full cycle)
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={selectedGroupSize}
                  onChange={(e) => setSelectedGroupSize(Number(e.target.value))}
                  style={{ margin: '6px 0' }}
                />
                <div
                  style={{
                    background: '#fff7ed',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    marginBottom: '10px',
                  }}
                >
                  <b>Group {selectedGroupObj.letter}</b> ({selectedGroupObj.size} member
                  {selectedGroupObj.size > 1 ? 's' : ''}): Pay{' '}
                  <b style={{ color: '#e62e04' }}>{K(selectedGroupObj.daily)}/day</b> · 1st
                  member receives on <b>Day 10</b> · Complete cycle <b>{selectedGroupObj.days} days</b>{' '}
                  ({selectedGroupObj.joined}/{selectedGroupObj.size} joined)
                </div>

                {/* Visual Bar Chart comparing all group speeds */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {groupRates.map((item) => {
                    const pct = Math.min(100, Math.round((item.daily / Math.max(1, maxGroupDaily)) * 100));
                    const isSelected = item.size === selectedGroupSize;
                    return (
                      <div
                        key={item.letter}
                        onClick={() => setSelectedGroupSize(item.size)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '92px 1fr 86px',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '6px',
                          background: isSelected ? '#fff7ed' : 'transparent',
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? 800 : 600 }}>
                          Grp {item.letter} ({item.size} {item.size === 1 ? 'solo' : 'ppl'})
                        </span>
                        <div
                          style={{
                            height: '10px',
                            background: '#f1f5f9',
                            borderRadius: '99px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(8, pct)}%`,
                              height: '100%',
                              background: isSelected ? '#e62e04' : '#fb923c',
                              borderRadius: '99px',
                            }}
                          />
                        </div>
                        <span style={{ textAlign: 'right', fontWeight: 700, color: '#191919' }}>
                          {K(item.daily)}/day
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Solo 1–6 Month Installment Calculator & Comparison Chart */}
              <div className="card" style={{ margin: 0 }}>
                <div className="row sp" style={{ marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                  <b>📅 1-Member Solo Installment Plans (1–6 Months)</b>
                  <span className="bd p">
                    {selectedSoloMonths} mo: {K(selectedSoloMonthlyAmt)}/mo
                  </span>
                </div>
                <div className="row" style={{ gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {SOLO_MONTH_PLANS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`btn sm ${selectedSoloMonths === m ? '' : 'o'}`}
                      onClick={() => setSelectedSoloMonths(m)}
                    >
                      {m} {m === 1 ? 'Month' : 'Months'}
                    </button>
                  ))}
                </div>
                <p className="mu" style={{ marginBottom: '8px' }}>
                  Pay solo over <b>{selectedSoloMonths} month(s)</b>: <b>{K(selectedSoloMonthlyAmt)}/mo</b>{' '}
                  (approx. <b>{K(selectedSoloDailyEq)}/day</b>) via Till <b>{product.till}</b>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {SOLO_MONTH_PLANS.map((months) => {
                    const monthly = Math.ceil(product.p / months);
                    const pct = Math.min(100, Math.round((monthly / Math.max(1, maxSoloMonthly)) * 100));
                    const isSelected = months === selectedSoloMonths;
                    return (
                      <div
                        key={`solo-${months}`}
                        onClick={() => setSelectedSoloMonths(months)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '76px 1fr 94px',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '6px',
                          background: isSelected ? '#fff7ed' : 'transparent',
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? 800 : 600 }}>
                          {months} Month{months > 1 ? 's' : ''}
                        </span>
                        <div
                          style={{
                            height: '10px',
                            background: '#f1f5f9',
                            borderRadius: '99px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(10, pct)}%`,
                              height: '100%',
                              background: isSelected ? '#2563eb' : '#93c5fd',
                              borderRadius: '99px',
                            }}
                          />
                        </div>
                        <span style={{ textAlign: 'right', fontWeight: 700 }}>
                          {K(monthly)}/mo
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Verified Product Specifications */}
              <div className="card" style={{ margin: 0 }}>
                <b style={{ display: 'block', marginBottom: '6px' }}>📋 Verified Product Specifications</b>
                {specEntries.map(([label, val]) => (
                  <div
                    key={label}
                    className="tx"
                    style={{ padding: '6px 0', fontSize: '12px', justifyContent: 'space-between' }}
                  >
                    <span className="mu">{label}</span>
                    <b style={{ textAlign: 'right' }}>{val}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'insights' && showInsightsTab && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="card" style={{ margin: 0, background: '#f8fafc' }}>
                <div className="row sp">
                  <b>📊 Merchant AI Inquiry Log</b>
                  <span className="bd">
                    {history.length} buyer question{history.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mu" style={{ marginTop: '4px' }}>
                  Customer questions asked to Buyoll.AI for <b>{product.n}</b>. Use these insights
                  to refine pricing, stock, and specifications.
                </p>
              </div>

              {history.length ? (
                [...history].reverse().map((entry) => (
                  <div key={`ins-${entry.id}`} className="card" style={{ margin: 0 }}>
                    <div className="row sp" style={{ marginBottom: '4px' }}>
                      <b>👤 {entry.userName}</b>
                      <span className="mu" style={{ fontSize: '11px' }}>
                        {entry.timestamp}
                      </span>
                    </div>
                    <div
                      style={{
                        background: '#fff7ed',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        fontSize: '12px',
                        marginBottom: '6px',
                      }}
                    >
                      <b>Q:</b> {entry.question}
                    </div>
                    <div style={{ fontSize: '12px', color: '#44403c' }}>
                      <b>Buyoll.AI:</b> {entry.answer}
                    </div>
                  </div>
                ))
              ) : (
                <p className="mu">
                  No customer questions logged for this product yet. Share the listing or ask a test
                  question in the Chat Advisor tab!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #ebebeb',
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button type="button" className="btn o sm" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn y sm"
            onClick={() => {
              onClose();
              onGoToPlans(product.id);
            }}
          >
            Choose Plan &amp; Checkout →
          </button>
        </div>
      </div>
    </div>
  );
};
