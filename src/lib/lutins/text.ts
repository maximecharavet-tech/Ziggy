import { MAX_PARENT_TEXT } from '@/data/lutins/pranks';

/** The parent's prank idea, cleaned: no markup, no links, short. */
export function cleanParentText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .replace(/[<>{}[\]`*_#|\\]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PARENT_TEXT);
}
