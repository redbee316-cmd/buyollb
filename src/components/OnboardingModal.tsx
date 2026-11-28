import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, HelpCircle, ShieldCheck, Users, Wallet, X } from 'lucide-react';
import type { MyGroupEntry, Product, Role } from '../types/buyoll';
import { K, dc, inst } from '../utils/format';
import { ProductThumb } from './SharedViews';

interface OnboardingModalProps {
  product: Product | null;
  role: Role | null;
  myGroups: MyGroupEntry[];
  onClose: () => void;
  onJoinGroup: (pid: number, gn: string) => void;
  onViewProduct: (pid: number) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  product,
  role,
  myGroups,
  onClose,
  onJoinGroup,
  onViewProduct,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGroupLetter, setSelectedGroupLetter] = useState<string>('');

  const openGroups = useMemo(() => {
    if (!product) return [];
    return [...product.g]
      .filter((g) => g.j < g.c && g.r.length < g.c)
      .sort((a, b) => b.c - a.c);
  }, [product]);

  const joinedForProduct = useMemo(() => {
    if (!product) return [];
    return myGroups.filter((m) => m.pid === product.id);
  }, [product, myGroups]);

  useEffect(() => {
    if (!product) return;
    setStep(1);
    const firstOpen = [...product.g]
      .filter((g) => g.j < g.c && g.r.length < g.c)
      .sort((a, b) => b.c - a.c)[0];
    setSelectedGroupLetter(firstOpen?.n || product.g[0]?.n || 'J');
  }, [product]);

  if (!product) return null;

  const discount = dc(product);
  const tenMemberDaily = inst(product.p, 10);
  const twoMemberDaily = inst(product.p, 2);
  const soloDaily = inst(product.p, 1);

  const chosenGroup =
    openGroups.find((g) => g.n === selectedGroupLetter) ||
    openGroups[0] ||
    product.g[product.g.length - 1];
  const chosenDaily = chosenGroup ? inst(product.p, chosenGroup.c) : tenMemberDaily;
  const alreadyInChosen = joinedForProduct.some((m) => m.g === chosenGroup?.n);

  const steps = [
    { id: 1 as const, label: '1. The Concept' },
    { id: 2 as const, label: '2. 10-Day Rotation' },
    { id: 3 as const, label: '3. Join a Group' },
  ];

  return (
    <div
      className="mod"
      role="dialog"
      aria-modal="true"
      aria-label={`Chamaa & Lipa Mdogo Mdogo Guide for ${product.n}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            background: '#fff7ed',
            borderBottom: '1px solid #fed7aa',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <ProductThumb p={product} h={54} w="54px" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#c2410c',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <HelpCircle size={13} />
              <span>Chamaa &amp; Lipa Mdogo Mdogo Guide</span>
              {discount > 0 && <span>· Save {discount}%</span>}
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: '15px',
                color: '#191919',
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.n}
            </div>
            <div className="mu" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <b style={{ color: '#e62e04' }}>{K(product.p)}</b> · {product.m} · from{' '}
              <b>{K(tenMemberDaily)}/day</b>
            </div>
          </div>
          <button
            type="button"
            className="btn o sm"
            onClick={onClose}
            aria-label="Close onboarding guide"
            style={{ padding: '6px 8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px',
            padding: '8px 14px',
            background: '#f8fafc',
            borderBottom: '1px solid #ebebeb',
          }}
        >
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              style={{
                border: step === s.id ? '1px solid #fdba74' : '1px solid transparent',
                borderRadius: '8px',
                padding: '7px 8px',
                fontSize: '12px',
                fontWeight: step === s.id ? 700 : 600,
                cursor: 'pointer',
                background: step === s.id ? '#ffffff' : 'transparent',
                color: step === s.id ? '#c2410c' : '#475569',
                boxShadow: step === s.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {step === 1 && (
            <>
              <div>
                <h3 style={{ fontSize: '17px', color: '#191919', marginBottom: '6px' }}>
                  Own {product.n} Without Paying {K(product.p)} Upfront
                </h3>
                <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: '#334155' }}>
                  <b>Chamaa &amp; Lipa Mdogo Mdogo</b> combines East Africa&apos;s trusted{' '}
                  <b>Chamaa group pooling</b> with small daily installments. Instead of struggling
                  to raise {K(product.p)} all at once, you team up with 1 to 10 shoppers, contribute
                  a small daily amount for 10-day cycles, and every member receives the exact item
                  in turn.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    border: '1px solid #fed7aa',
                    background: '#fffaf5',
                    borderRadius: '12px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#c2410c', marginBottom: '4px' }}>
                    Chamaa Group Buying (2–10 Members)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#191919', fontVariantNumeric: 'tabular-nums' }}>
                    {K(tenMemberDaily)} – {K(twoMemberDaily)} / day
                  </div>
                  <p className="mu" style={{ marginTop: '4px', lineHeight: 1.5 }}>
                    More members means a smaller daily payment. In a 10-member group, your daily
                    share is just {K(tenMemberDaily)}/day.
                  </p>
                </div>

                <div
                  style={{
                    border: '1px solid #ebebeb',
                    background: '#fafafa',
                    borderRadius: '12px',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#191919', marginBottom: '4px' }}>
                    Solo Lipa Mdogo Mdogo (1 Member)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#191919', fontVariantNumeric: 'tabular-nums' }}>
                    {K(soloDaily)} / day
                  </div>
                  <p className="mu" style={{ marginTop: '4px', lineHeight: 1.5 }}>
                    Prefer to buy alone without waiting for other members? Pay {K(soloDaily)}/day
                    for 10 days and collect right after Day 10.
                  </p>
                </div>
              </div>

              <div className="mu" style={{ fontSize: '12.5px', lineHeight: 1.5, color: '#475569' }}>
                Verified seller: <b>{product.m}</b> ({product.loc}) · M-Pesa Till/Paybill:{' '}
                <b>{product.till}</b>
                {product.bonusGift ? ` · Includes bonus: ${product.bonusGift}` : ''}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h3 style={{ fontSize: '17px', color: '#191919', marginBottom: '6px' }}>
                  How the 10-Day Chamaa Rotation Works
                </h3>
                <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: '#334155' }}>
                  Every group runs in clear 10-day rounds so everyone knows when they pay and when
                  they receive <b>{product.n}</b>.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #ebebeb',
                    background: '#fff',
                  }}
                >
                  <Users size={20} color="#e62e04" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <b style={{ fontSize: '13.5px' }}>1. Join in Order &amp; Moderator Trust</b>
                    <p className="mu" style={{ marginTop: '2px', lineHeight: 1.5 }}>
                      Position #1 in a group becomes the Group Moderator (or members appoint one).
                      If a group already has members, enter who referred you so the moderator can
                      approve trusted members.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #ebebeb',
                    background: '#fff',
                  }}
                >
                  <Wallet size={20} color="#e62e04" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <b style={{ fontSize: '13.5px' }}>2. Pay Daily via Wallet or M-Pesa Till</b>
                    <p className="mu" style={{ marginTop: '2px', lineHeight: 1.5 }}>
                      Fund your private Buyoll wallet (verified by Admin) or pay directly to Till{' '}
                      <b>{product.till}</b> and submit your confirmation code. Track every green ✓
                      tick in your Member Dashboard chart.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #ebebeb',
                    background: '#fff',
                  }}
                >
                  <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <b style={{ fontSize: '13.5px' }}>3. One Member Receives Every 10 Days</b>
                    <p className="mu" style={{ marginTop: '2px', lineHeight: 1.5 }}>
                      After Day 10, Member #1 collects the product. The group automatically rolls
                      into Round 2 (Days 11–20) for Member #2, and continues until every member
                      receives theirs. Need help with an installment? Post a loan request to
                      Buyoll Lenders anytime.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h3 style={{ fontSize: '17px', color: '#191919', marginBottom: '6px' }}>
                  Step-by-Step: Join Your First Group for {product.n}
                </h3>
                <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: '#334155' }}>
                  Pick an open group below that fits your daily budget. Smaller daily amounts give
                  you more time; fewer members deliver faster.
                </p>
              </div>

              {joinedForProduct.length > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    You are already in{' '}
                    <b>
                      {joinedForProduct.map((m) => `Group ${m.g}`).join(', ')}
                    </b>{' '}
                    for this product.
                  </span>
                </div>
              )}

              {openGroups.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
                    gap: '8px',
                  }}
                >
                  {openGroups.slice(0, 6).map((g) => {
                    const isSelected = chosenGroup?.n === g.n;
                    const dailyAmt = inst(product.p, g.c);
                    return (
                      <button
                        key={g.n}
                        type="button"
                        onClick={() => setSelectedGroupLetter(g.n)}
                        style={{
                          textAlign: 'left',
                          padding: '10px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #e62e04' : '1px solid #e2e8f0',
                          background: isSelected ? '#fff7ed' : '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        <div className="row sp">
                          <b style={{ fontSize: '13px', color: '#191919' }}>Group {g.n}</b>
                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                            {g.c - g.j} open
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            color: '#e62e04',
                            marginTop: '3px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {K(dailyAmt)}/day
                        </div>
                        <div className="mu" style={{ fontSize: '11px' }}>
                          {g.c} member{g.c > 1 ? 's' : ''} · {g.c * 10}-day cycle
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mu">All groups on this product are currently full.</p>
              )}

              {chosenGroup && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#fafafa',
                    border: '1px solid #ebebeb',
                    fontSize: '12.5px',
                    lineHeight: 1.6,
                    color: '#334155',
                  }}
                >
                  <b>Your Checklist for Group {chosenGroup.n}:</b>
                  <div>1. Daily installment: <b>{K(chosenDaily)}/day</b> ({chosenGroup.c} member{chosenGroup.c > 1 ? 's' : ''})</div>
                  <div>
                    2. Account step:{' '}
                    {role === 'member'
                      ? 'Signed in as Member — ready to join immediately.'
                      : 'Sign up or log in as a Member to lock in your slot.'}
                  </div>
                  <div>
                    3. After joining: Go to <b>My Wallet → My Groups</b> to pay daily and monitor
                    your chart.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #ebebeb',
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div className="row" style={{ gap: '6px' }}>
            {step > 1 && (
              <button
                type="button"
                className="btn o sm"
                onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              className="btn o sm"
              onClick={() => {
                onClose();
                onViewProduct(product.id);
              }}
            >
              View All 10 Groups
            </button>
          </div>

          {step < 3 ? (
            <button
              type="button"
              className="btn y sm"
              onClick={() => setStep((prev) => (prev === 1 ? 2 : 3))}
            >
              Next: {step === 1 ? '10-Day Rotation' : 'Choose Your Group'} <ArrowRight size={14} />
            </button>
          ) : (
            chosenGroup && (
              <button
                type="button"
                className="btn sm"
                disabled={alreadyInChosen}
                onClick={() => {
                  onClose();
                  onJoinGroup(product.id, chosenGroup.n);
                }}
              >
                {alreadyInChosen
                  ? `Already in Group ${chosenGroup.n}`
                  : role === 'member'
                    ? `Join Group ${chosenGroup.n} (${K(chosenDaily)}/day)`
                    : `Sign Up / Join Group ${chosenGroup.n}`}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
