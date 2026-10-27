import type { GameFactoryOutput, StoryJson } from './schemas';

/**
 * VERIFY — give the model a way to check its own work.
 *
 * Boris Cherny's first rule for Claude Code ("the most important thing:
 * give Claude a way to verify its work") applied to Hyper Engine: after the
 * JSON matches its schema, deterministic checks look at what a schema can't
 * see — is 7 + 5 really 12? does a 5-year-old get a 10-word question? — and
 * every problem found goes back to the model ONCE as concrete feedback.
 * Still wrong after that → the human-written local content is used.
 *
 * Pure functions, no I/O: each returns the list of problems (empty = good).
 */

export type AgeGroup = '5-7' | '8-10' | '11-12';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/[.!?…]+(?:\s|$)/).filter((x) => x.trim().length > 1).length;
const numbersIn = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
const startsWithEmoji = (s: string) => /^\p{Extended_Pictographic}/u.test(s.trim());

/** The value of a plain arithmetic question ("7 + 5 = ?", "Combien font 9 − 4 ?"), or null. */
export function arithmetic(prompt: string): number | null {
  const m = prompt.replace(/\s+/g, ' ').match(/(\d+)\s*([+\-−–×x*÷/:])\s*(\d+)\s*(?:=\s*\?|\?|=)/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case '+':
      return a + b;
    case '-':
    case '−':
    case '–':
      return a - b;
    case '×':
    case 'x':
    case 'X':
    case '*':
      return a * b;
    default:
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

const optionValue = (o: string) => {
  const n = numbersIn(o);
  return n.length === 1 ? n[0] : null;
};

export function verifyGameFactory(out: GameFactoryOutput, want: { gameType: string; difficulty: number; rounds: number; mechanic: string; ageGroup: AgeGroup }): string[] {
  const issues: string[] = [];
  if (out.gameType !== want.gameType) issues.push(`gameType must be "${want.gameType}"`);
  if (out.difficulty !== want.difficulty) issues.push(`difficulty must be ${want.difficulty}`);
  if (out.questions.length !== want.rounds) issues.push(`exactly ${want.rounds} questions are needed (got ${out.questions.length})`);
  const seen = new Set<string>();
  out.questions.forEach((q, i) => {
    const at = `questions[${i}]`;
    const key = q.prompt.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(key)) issues.push(`${at}: same question twice`);
    seen.add(key);
    if (want.mechanic === 'runner' && q.options.length !== 3) issues.push(`${at}: needs exactly 3 options`);
    // The facts a program can check: arithmetic.
    const value = arithmetic(q.prompt);
    if (value !== null) {
      const marked = optionValue(q.options[q.answer]);
      const matching = q.options.filter((o) => optionValue(o) === value).length;
      if (marked !== value) issues.push(`${at}: the correct result is ${value}, but "answer" points to "${q.options[q.answer]}"`);
      else if (matching > 1) issues.push(`${at}: more than one option equals ${value}`);
    }
    if (want.ageGroup === '5-7') {
      if (words(q.prompt) > 10) issues.push(`${at}: prompt must have at most 10 words for a 5–7 year old`);
      q.options.forEach((o, k) => {
        if (!startsWithEmoji(o)) issues.push(`${at}.options[${k}]: must start with one emoji (the child cannot read yet)`);
        if (words(o.replace(/^\p{Extended_Pictographic}️?/u, '')) > 3) issues.push(`${at}.options[${k}]: at most 3 words`);
      });
      if ([q.prompt, ...q.options].some((s) => numbersIn(s).some((n) => n > 10))) issues.push(`${at}: numbers must stay at or below 10`);
    }
  });
  return issues;
}

export function verifyStory(story: StoryJson, ageGroup: AgeGroup, shape = { chapters: 3, scenes: 2 }): string[] {
  const issues: string[] = [];
  if (story.chapters.length !== shape.chapters) issues.push(`exactly ${shape.chapters} chapters are needed`);
  const maxSentences = ageGroup === '5-7' ? 2 : 4;
  story.chapters.forEach((c, i) => {
    if (c.scenes.length !== shape.scenes) issues.push(`chapters[${i}]: exactly ${shape.scenes} scenes`);
    c.scenes.forEach((s, k) => {
      if (sentences(s.text) > maxSentences) issues.push(`chapters[${i}].scenes[${k}]: at most ${maxSentences} sentences for ages ${ageGroup}`);
      if (ageGroup === '5-7' && words(s.text) > 40) issues.push(`chapters[${i}].scenes[${k}]: too long for ages 5–7 (max 40 words)`);
    });
  });
  return issues;
}
