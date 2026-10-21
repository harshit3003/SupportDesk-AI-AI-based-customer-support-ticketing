import { CATEGORIES } from '../models.js';

const ML_URL = process.env.ML_URL || 'http://localhost:8000';
const LEVELS = ['low', 'medium', 'high', 'urgent'];

const KEYWORDS = {
  billing: ['invoice', 'charge', 'refund', 'payment', 'billing', 'subscription', 'price'],
  technical: ['error', 'crash', 'bug', 'timeout', 'api', 'not working', 'freeze', 'login'],
  account: ['password', 'account', 'profile', 'two-factor', 'locked', 'email change'],
  shipping: ['order', 'delivery', 'package', 'tracking', 'shipping', 'parcel'],
  feature_request: ['feature', 'suggestion', 'would be great', 'please add', 'support for'],
};

function keywordClassify(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  // Whole-word matching so e.g. "download" doesn't trip "down" and "capital" doesn't trip "api".
  const has = (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
  let best = 'general', hits = 0;
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    const n = words.filter(has).length;
    if (n > hits) { best = cat; hits = n; }
  }
  const urgent = /\b(urgent|asap|down|critical|emergency|immediately)\b/.test(text);
  return { category: best, priority: urgent ? 'urgent' : 'medium', confidence: hits ? 0.5 : 0.2, sentiment: 0 };
}

// Post-process: angry customers get bumped one level; low-confidence goes to human review.
function finalize(raw) {
  // Never trust the ML payload: coerce to values the Ticket schema accepts.
  const category = CATEGORIES.includes(raw.category) ? raw.category : 'general';
  let priority = LEVELS.includes(raw.priority) ? raw.priority : 'medium';
  const sentiment = Number.isFinite(raw.sentiment) ? raw.sentiment : 0;
  const confidence = Number.isFinite(raw.confidence) ? raw.confidence : 0;
  if (sentiment < -0.5 && LEVELS.indexOf(priority) < 2) priority = LEVELS[LEVELS.indexOf(priority) + 1];
  return { ...raw, category, priority, sentiment, confidence, needsReview: confidence < 0.45 };
}

export async function classify(subject, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(`${ML_URL}/classify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }), signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`ml ${r.status}`);
    return finalize({ ...(await r.json()), source: 'ml' });
  } catch {
    return finalize({ ...keywordClassify(subject, body), source: 'fallback' });
  } finally {
    clearTimeout(timer);
  }
}
