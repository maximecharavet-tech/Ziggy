/**
 * The grown-up gate (Apple Kids Category, Google Play Families): in the app,
 * anything that leaves Ziggy (other sites, e-mail, phone) or opens the
 * parents' area first asks a question a 4–8 year-old cannot answer by
 * tapping around — a number written in words to type on a keypad, or a
 * multiplication. Pure logic here (tested); the modal is GrownUpGate.tsx.
 */
import type { L } from './i18n-text';
import { stripLocale } from './app-shell';

export type GateQuestion = {
  kind: 'words' | 'product';
  /** What the grown-up reads (never read aloud: a child could just type what they hear). */
  text: L;
  answer: number;
};

const FR_UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const FR_TENS: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

/** French number words, 0–99 (traditional spelling: "vingt et un", "quatre-vingts"). */
export function frenchNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new RangeError(`0–99 only: ${n}`);
  if (n <= 16) return FR_UNITS[n];
  if (n < 20) return `dix-${FR_UNITS[n - 10]}`;
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens === 7 || tens === 9) {
    // 70–79 = soixante + 10–19; 90–99 = quatre-vingt + 10–19.
    const head = tens === 7 ? 'soixante' : 'quatre-vingt';
    const rest = frenchNumber(10 + unit);
    return tens === 7 && unit === 1 ? `${head} et ${rest}` : `${head}-${rest}`;
  }
  if (tens === 8) return unit === 0 ? 'quatre-vingts' : `quatre-vingt-${FR_UNITS[unit]}`;
  const head = FR_TENS[tens];
  if (unit === 0) return head;
  if (unit === 1) return `${head} et un`;
  return `${head}-${FR_UNITS[unit]}`;
}

const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** English number words, 0–99. */
export function englishNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new RangeError(`0–99 only: ${n}`);
  if (n < 20) return EN_UNITS[n];
  const unit = n % 10;
  return unit ? `${EN_TENS[Math.floor(n / 10)]}-${EN_UNITS[unit]}` : EN_TENS[Math.floor(n / 10)];
}

/**
 * A fresh question. Numbers 21–99 that are not round (too easy to guess)
 * and products of 6–9 (beyond the tables a young child knows).
 * `random` returns [0, 1) like Math.random (injectable for tests).
 */
export function makeGateQuestion(random: () => number = Math.random): GateQuestion {
  const pick = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  if (random() < 0.5) {
    let n = pick(21, 99);
    if (n % 10 === 0 || n % 11 === 0) n += n === 99 ? -2 : 1;
    if (n % 10 === 0 || n % 11 === 0) n += 1;
    return {
      kind: 'words',
      text: { fr: `Écris le nombre : ${frenchNumber(n)}`, en: `Type the number: ${englishNumber(n)}` },
      answer: n,
    };
  }
  const a = pick(6, 9);
  const b = pick(6, 9);
  return { kind: 'product', text: { fr: `Combien font ${a} × ${b} ?`, en: `What is ${a} × ${b}?` }, answer: a * b };
}

/** Digits typed on the keypad. Anything else (empty, letters, extra digits) is a no. */
export function checkGateAnswer(question: GateQuestion, typed: string): boolean {
  const t = typed.trim();
  if (!/^\d{1,3}$/.test(t)) return false;
  return Number.parseInt(t, 10) === question.answer;
}

/* ── Which links need a grown-up ── */

/** The parents' area and everything grown-up: account, sign-in, legal pages. */
export const PARENT_PATHS = ['/monde/parents', '/account', '/login', '/signup', '/owner', '/privacy', '/terms', '/cookies'] as const;

/** Ziggy's own hosts (the page's own host counts too). */
export const ZIGGY_HOSTS = ['ziggy-ai.fr', 'www.ziggy-ai.fr'];

export function isParentsPath(pathname: string, locales: readonly string[]): boolean {
  const { path } = stripLocale(pathname, locales);
  return PARENT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export type GateReason = 'external' | 'parents';

/**
 * Does following this link need a grown-up? `here` is the page's URL.
 * Returns why, or null for an ordinary link inside Ziggy.
 */
export function gateReasonFor(href: string, here: string, locales: readonly string[]): GateReason | null {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || /^javascript:/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, here);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'external'; // mailto:, tel:, sms:, intent:, market:…
  const own = new URL(here);
  if (url.host !== own.host && !ZIGGY_HOSTS.includes(url.hostname)) return 'external';
  return isParentsPath(url.pathname, locales) ? 'parents' : null;
}

/** How long a passed gate opens the parents' area without asking again. */
export const GATE_GRACE_MS = 5 * 60 * 1000;
