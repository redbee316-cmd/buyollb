import React, { useState } from 'react';
import {
  AlertCircle,
  Bike,
  ChevronDown,
  ChevronUp,
  Cookie,
  FileText,
  HelpCircle,
  Landmark,
  Lock,
  Mail,
  MessageSquare,
  RotateCcw,
  Scale,
  Share2,
  Store,
} from 'lucide-react';
import type { AuthModalMode } from './LoginView';
import type { Tab } from '../types/buyoll';

export type FooterTopicId =
  | 'rider'
  | 'merchant'
  | 'referral'
  | 'lender'
  | 'community'
  | 'complaints'
  | 'faq'
  | 'support-email'
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'refund'
  | 'agreement';

interface FooterTopic {
  id: FooterTopicId;
  title: string;
  subtitle: string;
  sections: Array<{ heading: string; body: string }>;
  cta?: {
    label: string;
    action: 'merchant-signup' | 'lender-signup' | 'member-signup' | 'browse-groups' | 'copy-email';
  };
}

const FOOTER_TOPICS: Record<FooterTopicId, FooterTopic> = {
  rider: {
    id: 'rider',
    title: 'Become a Rider / Delivery Partner',
    subtitle: 'Deliver completed group products across Nairobi and major Kenyan towns.',
    sections: [
      {
        heading: 'How Rider Deliveries Work',
        body: 'Whenever a 1–10 member Chamaa group completes a 10-day round, Buyoll dispatches the merchant product to the round receiver. Verified riders receive instant pickup notifications with merchant shop location and customer delivery details.',
      },
      {
        heading: 'Requirements & Earnings',
        body: 'Valid Kenyan National ID, motorcycle or van license, active M-Pesa number, and smartphone. Riders earn per-drop delivery fees plus priority bonuses in Nairobi CBD, Thika, Nakuru, Mombasa, and Kisumu.',
      },
      {
        heading: 'How to Apply',
        body: 'Send your full name, town, vehicle type, and ID number to buyoll@customerservive.com with the subject "Rider Partner Application".',
      },
    ],
    cta: { label: 'Copy Official Support Email', action: 'copy-email' },
  },
  merchant: {
    id: 'merchant',
    title: 'Become a Verified Merchant',
    subtitle: 'Sell products via 1–10 member daily instalment groups and paid Hero promotions.',
    sections: [
      {
        heading: 'Reach Group Buyers Daily',
        body: 'List your products with your own M-Pesa Till or Paybill number. Shoppers form 1–10 member Lipa Mdogomdogo groups and pay directly to your Till every day, while you approve payments to auto-check their 10-day Payment Tracking.',
      },
      {
        heading: 'Merchant Subscriptions & Paid Promotions',
        body: 'Choose Monthly or Annual plans starting at KSh 250/month, and boost visibility anytime with paid Featured Items (KSh 300) or Promotional Deals (KSh 500) placement in the Shop Hero section.',
      },
    ],
    cta: { label: 'Open Merchant Sign Up →', action: 'merchant-signup' },
  },
  referral: {
    id: 'referral',
    title: 'Become a Referral Partner',
    subtitle: 'Invite friends and Chamaa groups to Buyoll and earn rewards.',
    sections: [
      {
        heading: 'Share Your Referral Code',
        body: 'Every Buyoll member can invite friends using a referral code (e.g. BUY-AMINA) when joining any 1–10 member group.',
      },
      {
        heading: 'Partner Commissions',
        body: 'Community organizers and Chamaa leaders who bring active buyers and verified merchants qualify for monthly referral bonuses. Reach out via buyoll@customerservive.com to register your partner code.',
      },
    ],
    cta: { label: 'Register as Member to Start →', action: 'member-signup' },
  },
  lender: {
    id: 'lender',
    title: 'Become a Group Lender',
    subtitle: 'Empower members with short-term contribution support from your private Lender dashboard.',
    sections: [
      {
        heading: 'How Group Lending Works',
        body: 'Members needing help completing a daily instalment submit loan requests showing their credit score, town, and target product group. You review requests in your private Lender dashboard and fund directly from your Lender wallet.',
      },
      {
        heading: 'Transparent Terms & Fees',
        body: 'Loan terms are agreed directly between lender and borrower outside Buyoll. A flat KSh 50 platform processing fee applies once per approved loan.',
      },
    ],
    cta: { label: 'Open Lender Sign Up →', action: 'lender-signup' },
  },
  community: {
    id: 'community',
    title: 'Community Questions & Feed',
    subtitle: 'Connect with East African Chamaa buyers, group moderators, and merchants.',
    sections: [
      {
        heading: 'How Group Moderators Help',
        body: 'The first member to join a group (marked 🆗) acts as the group moderator, helping coordinate the 10-day payment tracking ledger and WhatsApp check-ins.',
      },
      {
        heading: 'Ask the Community',
        body: 'Browse open groups across Bedding, Kitchen, Electronics, Phones, Furniture, and Travel Gear, or email community questions to buyoll@customerservive.com.',
      },
    ],
    cta: { label: 'Browse Open Groups →', action: 'browse-groups' },
  },
  complaints: {
    id: 'complaints',
    title: 'Complaints & Dispute Feedback',
    subtitle: 'Fast resolution for payment codes, deliveries, or merchant issues.',
    sections: [
      {
        heading: 'Payment Code & Verification Issues',
        body: 'If your M-Pesa payment code is pending approval or mistakenly declined, keep your SMS confirmation message and check your Till/Paybill details in My Groups.',
      },
      {
        heading: 'Escalating a Dispute',
        body: 'Email buyoll@customerservive.com with your username, product name, group letter (A–J), and M-Pesa transaction code. Our Kenya support desk responds within 24 hours.',
      },
    ],
    cta: { label: 'Copy Official Support Email', action: 'copy-email' },
  },
  faq: {
    id: 'faq',
    title: 'Frequently Asked Questions (FAQ)',
    subtitle: 'Everything you need to know about Buyoll Lipa Mdogomdogo groups.',
    sections: [
      {
        heading: '1. How do 1–10 member groups work?',
        body: 'Every product offers Group A (1 member) through Group J (10 members). Each round lasts 10 days. Every 10 days, one member receives the product in joining order, and Payment Tracking rolls into the next 10-day round until every member gets theirs.',
      },
      {
        heading: '2. How do I pay my daily instalment?',
        body: 'Open Wallet → My Groups, tap "Pay today (wallet)", pay to the product owner’s Till/Paybill shown in the popup, and submit your payment code and amount. Once the merchant approves, your Payment Tracking is automatically check-marked.',
      },
      {
        heading: '3. Do I need an account to browse?',
        body: 'No! Anyone can browse the Shop and search products or merchants without signing in. Member registration is needed to join groups, and Merchant, Lender, and Admin dashboards are private.',
      },
    ],
    cta: { label: 'Browse Shop & Groups →', action: 'browse-groups' },
  },
  'support-email': {
    id: 'support-email',
    title: 'Official Support Email',
    subtitle: 'buyoll@customerservive.com',
    sections: [
      {
        heading: 'Direct Support Desk',
        body: 'Reach our support team for account recovery questions, merchant onboarding, rider applications, deposit verifications, and dispute resolution.',
      },
      {
        heading: 'Support Hours',
        body: 'Monday – Saturday, 8:00 AM – 8:00 PM EAT (Nairobi, Kenya). Include your Buyoll username and relevant M-Pesa code for fastest help.',
      },
    ],
    cta: { label: 'Copy buyoll@customerservive.com', action: 'copy-email' },
  },
  terms: {
    id: 'terms',
    title: 'Terms & Conditions',
    subtitle: 'Effective 2026 · Buyoll Fintech Marketplace (Kenya)',
    sections: [
      {
        heading: '1. Account & Credential Rules',
        body: 'All Member, Merchant, and Lender accounts must register with a unique username and unique password. Account sharing or impersonation is strictly prohibited.',
      },
      {
        heading: '2. Group Commitments',
        body: 'Group capacities (1 to 10 members) are strictly enforced. Members joining a group agree to make daily instalment payments across all 10-day rounds until every member receives their product.',
      },
      {
        heading: '3. Merchant Listings & Promotions',
        body: 'Merchants must provide accurate product pricing, stock, shop location, and valid M-Pesa Till/Paybill details. Paid Hero Featured and Promotional slots are billed from the Merchant wallet.',
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    subtitle: 'How Buyoll protects your account and transaction data.',
    sections: [
      {
        heading: '1. Data We Store',
        body: 'Buyoll stores role-separated records for Members, Merchants, and Lenders, along with group participation, Payment Tracking progress, and M-Pesa reference codes required to verify transactions.',
      },
      {
        heading: '2. Password Security',
        body: 'Passwords are never stored in plaintext. All credentials are salted and cryptographically hashed on the server, and session tokens are verified for every private dashboard action.',
      },
    ],
  },
  cookies: {
    id: 'cookies',
    title: 'Cookie Policy',
    subtitle: 'Essential session and preference handling on Buyoll.',
    sections: [
      {
        heading: '1. Essential Storage',
        body: 'Buyoll uses minimal in-memory authentication tokens and essential browser capabilities strictly to keep your active session working while browsing or managing your dashboard.',
      },
      {
        heading: '2. No Invasive Ad Tracking',
        body: 'We do not sell your personal browsing history or Chamaa group activity to third-party ad networks.',
      },
    ],
  },
  refund: {
    id: 'refund',
    title: 'Refund & Dispute Policy',
    subtitle: 'Protection for group contributors and merchants.',
    sections: [
      {
        heading: '1. Unapproved or Duplicate Payment Codes',
        body: 'If a merchant declines a submitted payment code due to a mismatch or unreceived funds, no tracking days are credited and the member can immediately resubmit the correct M-Pesa code.',
      },
      {
        heading: '2. Delivery & Product Quality Disputes',
        body: 'Merchants must deliver products matching the advertised description and price at the end of each 10-day round. Disputes reported to buyoll@customerservive.com within 48 hours of delivery are reviewed by Buyoll Admin, who may suspend non-compliant merchants.',
      },
    ],
    cta: { label: 'Copy Support Email for Disputes', action: 'copy-email' },
  },
  agreement: {
    id: 'agreement',
    title: 'Group & Lender Agreement',
    subtitle: 'Rules governing 1–10 member Chamaa rotations and lender loans.',
    sections: [
      {
        heading: '1. Rotation & 10-Day Tracking Cycle',
        body: 'Members receive products in joining order (Position 1 in Round 1, Position 2 in Round 2, etc.). After each 10-day round completes, a fresh 10-day tracking window starts automatically until all members receive their product.',
      },
      {
        heading: '2. Lender & Borrower Terms',
        body: 'Lenders approve requests from their funded Lender wallet. Buyoll deducts a single KSh 50 platform fee per loan and credits the net amount to the Member wallet; repayment terms are agreed directly between lender and borrower.',
      },
    ],
  },
};

interface FooterProps {
  onGo: (tab: Tab, view?: string | null, sel?: string | number | null) => void;
  onRequireAuth: (mode: AuthModalMode, msg?: string) => void;
  onToast: (msg: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onGo, onRequireAuth, onToast }) => {
  const [activeTopic, setActiveTopic] = useState<FooterTopic | null>(null);
  const [brandExpanded, setBrandExpanded] = useState(true);

  const handleTopicClick = (id: FooterTopicId) => {
    setActiveTopic(FOOTER_TOPICS[id]);
  };

  const handleCta = (action: NonNullable<FooterTopic['cta']>['action']) => {
    setActiveTopic(null);
    if (action === 'merchant-signup') {
      onRequireAuth('merchant-register');
    } else if (action === 'lender-signup') {
      onRequireAuth('lender-register');
    } else if (action === 'member-signup') {
      onRequireAuth('member-register');
    } else if (action === 'browse-groups') {
      onGo('groups');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'copy-email') {
      try {
        void navigator.clipboard.writeText('buyoll@customerservive.com');
        onToast('Copied buyoll@customerservive.com');
      } catch {
        onToast('Support email: buyoll@customerservive.com');
      }
    }
  };

  return (
    <>
      <footer className="bg-white border-t border-[#ebebeb] text-[#333] mt-10 pb-20 md:pb-8">
        <div className="max-w-[1180px] mx-auto px-5 pt-10 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Column 1: Brand & Marketplace Description */}
            <div className="md:col-span-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={`${import.meta.env.BASE_URL}assets/aistudio/Buyoll_Shopping_Cart_Logo_23c2cc30.png`}
                    alt="Buyoll Logo"
                    className="h-11 w-auto object-contain rounded"
                  />
                  <div className="text-[#f97316] font-extrabold text-[15px] leading-snug">
                    Buyoll Social Fintech
                    <br />
                    Marketplace
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBrandExpanded((v) => !v)}
                  aria-label="Toggle marketplace summary"
                  className="text-[#555] hover:text-[#191919] p-1 bg-transparent border-0 cursor-pointer"
                >
                  {brandExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              {brandExpanded && (
                <p className="text-[13px] leading-relaxed text-[#4b5563] mt-4">
                  Buyoll connects shoppers, merchants, and lenders across East Africa, enabling
                  product discovery, group contributions through 1–10 member Lipa Mdogomdogo
                  groups, flexible instalment payments, and merchant-sponsored promotions.
                </p>
              )}
            </div>

            {/* Column 2: MAKE MONEY WITH BUYOLL */}
            <div className="md:col-span-3">
              <h4 className="text-[12px] font-extrabold tracking-wide uppercase text-[#111827] mb-3">
                MAKE MONEY WITH BUYOLL
              </h4>
              <ul className="space-y-2.5 list-none p-0 m-0">
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('rider')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <Bike size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Become a Rider / Delivery Partner</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('merchant')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <Store size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Become a Verified Merchant</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('referral')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <Share2 size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Become a Referral Partner</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('lender')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <Landmark size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Become group lender</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: NEED HELP & SUPPORT? */}
            <div className="md:col-span-3">
              <h4 className="text-[12px] font-extrabold tracking-wide uppercase text-[#111827] mb-3">
                NEED HELP &amp; SUPPORT?
              </h4>
              <ul className="space-y-2.5 list-none p-0 m-0">
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('community')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <MessageSquare size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Community Questions &amp; Feed</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('complaints')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <AlertCircle size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Complaints &amp; Dispute Feedback</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('faq')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <HelpCircle size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Frequently Asked Questions (FAQ)</span>
                  </button>
                </li>
              </ul>

              <div className="mt-5">
                <div className="text-[11px] font-extrabold tracking-wide uppercase text-[#111827] mb-1.5">
                  OFFICIAL SUPPORT EMAIL
                </div>
                <button
                  type="button"
                  onClick={() => handleTopicClick('support-email')}
                  className="flex items-center gap-2 text-left text-[13px] font-bold text-[#f97316] hover:underline bg-transparent border-0 p-0 cursor-pointer"
                >
                  <Mail size={16} className="text-[#f97316] shrink-0" />
                  <span>buyoll@customerservive.com</span>
                </button>
              </div>
            </div>

            {/* Column 4: LEGAL */}
            <div className="md:col-span-2">
              <h4 className="text-[12px] font-extrabold tracking-wide uppercase text-[#111827] mb-3">
                LEGAL
              </h4>
              <ul className="space-y-2.5 list-none p-0 m-0">
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('terms')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <FileText size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Terms &amp; Conditions</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('privacy')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <Lock size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Privacy Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('cookies')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <Cookie size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Cookie Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('refund')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <RotateCcw size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Refund &amp; Dispute Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleTopicClick('agreement')}
                    className="flex items-start gap-2.5 text-left text-[13px] text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
                  >
                    <Scale size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <span>Group &amp; Lender Agreement</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="border-t border-[#ebebeb] mt-8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#6b7280]">
            <div>© 2026 Buyoll Fintech. All rights reserved. Made in Kenya.</div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => handleTopicClick('faq')}
                className="flex items-center gap-1 font-bold text-[#f97316] hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                <HelpCircle size={14} className="text-[#f97316]" />
                <span>Help &amp; FAQ</span>
              </button>
              <button
                type="button"
                onClick={() => handleTopicClick('terms')}
                className="text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => handleTopicClick('privacy')}
                className="text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => handleTopicClick('cookies')}
                className="text-[#4b5563] hover:text-[#f97316] bg-transparent border-0 p-0 cursor-pointer"
              >
                Cookies
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Relevant Footer Content Modal */}
      {activeTopic && (
        <div
          className="mod"
          style={{ zIndex: 45 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveTopic(null);
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <h3 style={{ fontSize: '18px' }}>{activeTopic.title}</h3>
              <button
                type="button"
                className="btn o sm"
                aria-label="Close footer info"
                onClick={() => setActiveTopic(null)}
              >
                ✕
              </button>
            </div>
            <p className="mu" style={{ marginBottom: '12px' }}>
              {activeTopic.subtitle}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeTopic.sections.map((sec) => (
                <div
                  key={sec.heading}
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #ebebeb',
                    borderRadius: '12px',
                    padding: '10px 12px',
                  }}
                >
                  <b style={{ fontSize: '13px', color: '#191919' }}>{sec.heading}</b>
                  <p style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px', lineHeight: 1.5 }}>
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: '14px' }}>
              {activeTopic.cta && (
                <button
                  type="button"
                  className="btn y bl"
                  onClick={() => handleCta(activeTopic.cta!.action)}
                >
                  {activeTopic.cta.label}
                </button>
              )}
              <button
                type="button"
                className="btn o sm"
                onClick={() => setActiveTopic(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
