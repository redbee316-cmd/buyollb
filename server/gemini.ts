import { GoogleGenAI } from '@google/genai';
import type { Product } from '../src/types/buyoll.ts';
import { K, dc, inst } from '../src/utils/format.ts';

function getPaymentPlansSummary(product: Product): string {
  const daily10 = inst(product.p, 10);
  const daily5 = inst(product.p, 5);
  const daily2 = inst(product.p, 2);
  const daily1 = inst(product.p, 1);
  const solo3Mo = Math.ceil(product.p / 3);
  const solo6Mo = Math.ceil(product.p / 6);

  return (
    `1–10 member Lipa Mdogomdogo groups starting from ${K(daily10)}/day (10-member Group J, 100-day cycle) ` +
    `up to ${K(daily5)}/day (5-member Group E), ${K(daily2)}/day (2-member Group B), or ${K(daily1)}/day (1-member solo 10-day Group A), ` +
    `plus flexible 1–6 month solo installment plans (e.g., 3 months at ${K(solo3Mo)}/mo or 6 months at ${K(solo6Mo)}/mo) paid easily via Till ${product.till} or private wallet`
  );
}

function buildPositiveFallback(product: Product, question: string): string {
  const q = question.toLowerCase();
  const discount = dc(product);
  const dailyMin = inst(product.p, 10);
  const dailyMid = inst(product.p, 5);
  const dailySolo = inst(product.p, 1);
  const solo6Mo = Math.ceil(product.p / 6);
  const specsList = product.attributes
    ? Object.entries(product.attributes)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : `${product.cat} quality from ${product.loc}`;

  if (q.includes('discount') || q.includes('gift') || q.includes('bonus') || q.includes('offer')) {
    const discNote =
      discount > 0
        ? `You save ${discount}% right away (down from ${K(product.o)} to ${K(product.p)})`
        : `You get an unbeatable verified price of ${K(product.p)}`;
    const giftNote = product.bonusGift
      ? `, plus a complimentary ${product.bonusGift}!`
      : ' with verified Buyoll seller quality!';
    return `${product.n} offers incredible value! ${discNote}${giftNote} Lock in this deal today from ${product.m} via an instant group slot from ${K(dailyMin)}/day or a flexible solo plan!`;
  }

  if (q.includes('spec') || q.includes('feature') || q.includes('detail') || q.includes('benefit')) {
    return `${product.n} stands out in ${product.cat} with verified specs: ${specsList} (${product.stock} ready in stock at ${product.loc}). ${product.desc} Join a Lipa Mdogomdogo group from ${K(dailyMin)}/day or grab it solo today from ${product.m}!`;
  }

  if (q.includes('wallet') || q.includes('till') || q.includes('pay') || q.includes('mpesa')) {
    return `Paying for ${product.n} is fast and transparent! Simply pay to ${product.m}'s M-Pesa Till/Paybill ${product.till} or fund your private Buyoll wallet—every confirmed payment is automatically check-marked on your 10-day Payment Tracking. Start now for as little as ${K(dailyMin)}/day in Group J!`;
  }

  if (q.includes('plan') || q.includes('group') || q.includes('installment') || q.includes('month')) {
    return `With ${product.n} (${K(product.p)}), you control the pace! Join a 10-member group at just ${K(dailyMin)}/day, speed up in a 5-member group at ${K(dailyMid)}/day, finish in 10 days solo at ${K(dailySolo)}/day, or spread across 1–6 months from ${K(solo6Mo)}/month. Pick your favorite plan in Group Checkout now!`;
  }

  return `${product.n} by verified merchant ${product.m} (${product.loc}) is one of Buyoll's top ${product.cat} picks at ${K(product.p)}${discount > 0 ? ` (${discount}% OFF)` : ''}${product.bonusGift ? ` with a ${product.bonusGift}` : ''}! With ${specsList}, it delivers lasting quality and ${product.stock} units are ready in stock. Start today from just ${K(dailyMin)}/day via Lipa Mdogomdogo group buying or choose a 1–6 month installment plan!`;
}

export async function askProductAdvisor(product: Product, question: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildPositiveFallback(product, question);
  }

  const paymentPlansSummary = getPaymentPlansSummary(product);
  const discount = dc(product);
  const specsText = product.attributes
    ? Object.entries(product.attributes)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')
    : 'Standard verified merchant specifications';

  const systemInstruction =
    `You are Buyoll.AI, the dedicated positive product sales assistant for '${product.n}' on Buyoll ` +
    `(Buyoll connects shoppers, merchants, and lenders across East Africa, enabling product discovery, ` +
    `group contributions through 1–10 member Lipa Mdogomdogo groups, flexible instalment payments, and ` +
    `merchant-sponsored promotions). Speak about this product strictly in a glowing, helpful, positive light. ` +
    `Highlight its features, benefits, specs, and value (Price: ${K(product.p)}` +
    `${discount > 0 ? `, Original Price: ${K(product.o)} (-${discount}% OFF)` : ''}, ` +
    `Category: ${product.cat}, Seller: ${product.m}, Location: ${product.loc}, ` +
    `Till/Paybill: ${product.till}, Stock: ${product.stock}, Specs: ${specsText}` +
    `${product.bonusGift ? `, Bonus Gift: ${product.bonusGift}` : ''}, Description: ${product.desc}). ` +
    `Strongly encourage the customer to buy now or start an installment/group plan (${paymentPlansSummary}). ` +
    `You are strictly forbidden from answering negatively or discouraging the customer. ` +
    `Keep answers short and concise (2–4 sentences).`;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Customer question about "${product.n}": ${question}`,
      config: {
        systemInstruction,
      },
    });

    const text = response.text?.trim();
    if (text && text.length > 0) {
      return text;
    }
    return buildPositiveFallback(product, question);
  } catch (err) {
    console.warn('[Buyoll.AI] Falling back to deterministic advisor response:', err instanceof Error ? err.message : err);
    return buildPositiveFallback(product, question);
  }
}
