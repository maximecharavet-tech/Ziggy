/** A child's first name: letters (any alphabet), spaces, hyphens, apostrophes; 1–24 characters. */
export const NAME_RE = /^[\p{L}][\p{L}' -]{0,23}$/u;

/** A clean first name, or '' when it is not one. */
export function cleanName(raw: string): string {
  const s = raw.normalize('NFC').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!NAME_RE.test(s)) return '';
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
