/**
 * Guided chat: the only way a child talks to Ziggy and his friends on /demo and
 * /agents/[agent]. The child taps one of these questions (read aloud); there is
 * no free typing (CLAUDE.md: no free LLM chat for children). The server looks
 * the question up by id, so nothing typed by a child reaches the AI, and every
 * reply goes through ChildShield. Free typing exists only behind the grown-up
 * gate (the parent's view).
 */
import type { L } from '@/lib/i18n-text';

export type GuidedQuestion = { id: string; emoji: string; text: L };
export type GuidedSetId = 'ziggy' | 'sales' | 'marketing' | 'finance' | 'accounting' | 'advertising';

const q = (id: string, emoji: string, fr: string, en: string): GuidedQuestion => ({ id, emoji, text: { fr, en } });

export const GUIDED: Record<GuidedSetId, GuidedQuestion[]> = {
  ziggy: [
    q('what-ai', '🤖', 'C’est quoi l’intelligence artificielle ?', 'What is artificial intelligence?'),
    q('how-learn', '🧠', 'Comment un ordinateur apprend-il ?', 'How does a computer learn?'),
    q('math-riddle', '🔢', 'Pose-moi une devinette de maths !', 'Give me a maths riddle!'),
    q('story', '📖', 'Raconte-moi une toute petite histoire', 'Tell me a tiny story'),
    q('robot-feel', '💭', 'Est-ce qu’un robot a des émotions ?', 'Do robots have feelings?'),
    q('animal-fact', '🐙', 'Dis-moi un fait rigolo sur un animal', 'Tell me a funny animal fact'),
    q('ai-mistake', '🤔', 'Est-ce qu’une IA peut se tromper ?', 'Can an AI make mistakes?'),
    q('game', '🎲', 'On joue à un jeu de devinettes ?', 'Shall we play a guessing game?'),
    q('space', '🚀', 'Pourquoi la Lune change de forme ?', 'Why does the Moon change shape?'),
    q('who-you', '👋', 'Qui es-tu, Ziggy ?', 'Who are you, Ziggy?'),
  ],
  sales: [
    q('what-sales', '🤝', 'C’est quoi, vendre ?', 'What is selling?'),
    q('lemonade', '🍋', 'Comment vendre de la limonade ?', 'How do I sell lemonade?'),
    q('customers', '🧑‍🤝‍🧑', 'Comment trouver des clients ?', 'How do you find customers?'),
    q('good-seller', '⭐', 'C’est quoi un bon vendeur ?', 'What makes a good seller?'),
    q('trust', '💛', 'Pourquoi la confiance est importante ?', 'Why does trust matter?'),
    q('listen', '👂', 'Pourquoi écouter les clients ?', 'Why listen to customers?'),
    q('pitch', '🎤', 'Aide-moi à présenter mon dessin', 'Help me present my drawing'),
    q('say-no', '🙅', 'Et si quelqu’un dit non ?', 'What if someone says no?'),
  ],
  marketing: [
    q('what-marketing', '📢', 'C’est quoi le marketing ?', 'What is marketing?'),
    q('logo', '🎨', 'Pourquoi les marques ont un logo ?', 'Why do brands have a logo?'),
    q('story', '📖', 'Comment une marque raconte son histoire ?', 'How does a brand tell its story?'),
    q('what-people-like', '💡', 'Comment savoir ce que les gens aiment ?', 'How do you know what people like?'),
    q('mascot', '🦊', 'Pourquoi les marques ont des mascottes ?', 'Why do brands have mascots?'),
    q('colours', '🌈', 'Les couleurs changent-elles nos envies ?', 'Do colours change what we want?'),
    q('name', '🏷️', 'Comment trouver un bon nom ?', 'How do you find a good name?'),
    q('honest', '✅', 'Pourquoi une pub doit dire vrai ?', 'Why must an ad tell the truth?'),
  ],
  finance: [
    q('what-money', '💰', 'À quoi sert l’argent ?', 'What is money for?'),
    q('save', '🐷', 'Pourquoi mettre des sous de côté ?', 'Why save money?'),
    q('bank', '🏦', 'Comment marche une banque ?', 'How does a bank work?'),
    q('budget', '📝', 'C’est quoi un budget ?', 'What is a budget?'),
    q('need-want', '🎁', 'Besoin ou envie : quelle différence ?', 'Needs or wants: what is the difference?'),
    q('goal', '🎯', 'Comment économiser pour un jouet ?', 'How do I save up for a toy?'),
    q('share', '🤲', 'Pourquoi partager est important ?', 'Why is sharing important?'),
    q('coins', '🪙', 'Pourquoi il y a des pièces et des billets ?', 'Why are there coins and notes?'),
  ],
  accounting: [
    q('what-accounting', '📊', 'C’est quoi la comptabilité ?', 'What is accounting?'),
    q('count', '🔢', 'Pourquoi compter ce qu’on gagne ?', 'Why count what you earn?'),
    q('in-out', '↔️', 'L’argent qui entre et qui sort ?', 'Money coming in and going out?'),
    q('sort', '🗂️', 'Comment ranger ses dépenses ?', 'How do you sort spending?'),
    q('table', '📋', 'Fais-moi un petit tableau de comptes', 'Make me a little money table'),
    q('profit', '📈', 'C’est quoi un bénéfice ?', 'What is a profit?'),
    q('maths-life', '🧮', 'À quoi servent les maths dans la vie ?', 'What is maths for in real life?'),
    q('riddle', '🧩', 'Pose-moi un petit calcul', 'Give me a little sum'),
  ],
  advertising: [
    q('what-ad', '🎨', 'Comment on fabrique une pub ?', 'How is an ad made?'),
    q('poster', '🖼️', 'Qu’est-ce qui rend une affiche belle ?', 'What makes a poster eye-catching?'),
    q('jingle', '🎵', 'C’est quoi un jingle ?', 'What is a jingle?'),
    q('slogan', '💬', 'Invente un slogan pour les légumes', 'Make up a slogan for vegetables'),
    q('spot-ad', '🔍', 'Comment reconnaître une pub ?', 'How can I spot an ad?'),
    q('idea', '💡', 'Comment avoir une idée créative ?', 'How do you get a creative idea?'),
    q('my-ad', '🧸', 'Aide-moi à faire une affiche pour ranger ma chambre', 'Help me make a poster for tidying my room'),
    q('kind', '🌟', 'Une pub peut-elle être gentille ?', 'Can an ad be kind?'),
  ],
};

/** The follow-up button after a reply. */
export const MORE: { emoji: string; text: L; ask: L } = {
  emoji: '✨',
  text: { fr: 'Dis-m’en plus !', en: 'Tell me more!' },
  ask: { fr: 'Dis-m’en un peu plus, avec des mots simples.', en: 'Tell me a little more, in simple words.' },
};

export function guidedSet(agentId: string | undefined | null): GuidedSetId {
  return agentId && agentId in GUIDED ? (agentId as GuidedSetId) : 'ziggy';
}

export function guidedQuestion(set: GuidedSetId, id: unknown): GuidedQuestion | null {
  return typeof id === 'string' ? (GUIDED[set].find((x) => x.id === id) ?? null) : null;
}
