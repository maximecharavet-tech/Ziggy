/**
 * « Mon carnet de découvertes » — the public door for features:
 *
 *   import { addToJournal } from '@/lib/journal';
 *   addToJournal({ id: 'first-rainbow', world: 'moments', kind: 'moment', emoji: '🌈', title: { fr: 'Un arc-en-ciel !', en: 'A rainbow!' } });
 *
 * Existing games need nothing: their own stores are read by ./adapters.ts.
 */
export { addToJournal, saveStory, readJournal, onJournalChange, type NewEntry } from './store';
export { JOURNAL_WORLDS, WORLD_INFO, type JournalEntry, type JournalWorld, type JournalKind, type StorySpec } from './types';
