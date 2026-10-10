/**
 * A hand-written story template, filled from the child's choices: always
 * available, free, and safe. Used when the AI is unavailable, over budget,
 * or its answer did not pass the schema or ChildShield.
 */
import type { StoryJson } from '@/lib/hyper-engine/schemas';
import { tr } from '@/lib/i18n-text';
import { HEROES, PLACES, STORY_COMPANIONS, OBJECTS, GOALS, pick, type StoryChoices } from './choices';

export function localStory(c: StoryChoices, locale: string): StoryJson {
  const fr = locale === 'fr';
  const hero = tr(pick(HEROES, c.hero).label, locale);
  const place = tr(pick(PLACES, c.place).label, locale);
  const friend = tr(pick(STORY_COMPANIONS, c.companion).label, locale);
  const object = tr(pick(OBJECTS, c.object).label, locale);
  const goal = tr(pick(GOALS, c.goal).label, locale);
  const e = (list: typeof HEROES, id: string) => pick(list, id).emoji;
  const long = c.ageGroup !== '5-7';

  if (fr) {
    return {
      title: `${cap(hero)} et ${object}`,
      chapters: [
        {
          title: 'Le départ',
          scenes: [
            { emoji: e(PLACES, c.place), text: `Ce matin-là, ${hero} se réveille dans ${place}. Tout est calme… jusqu’à ce que ${friend} arrive en courant.` },
            { emoji: e(STORY_COMPANIONS, c.companion), text: `« J’ai besoin de toi, dit ${friend}. Il faut ${goal} ! » ${long ? 'Le cœur battant, ' + hero + ' accepte tout de suite : une aventure commence.' : 'Et l’aventure commence !'}` },
          ],
        },
        {
          title: 'Le défi',
          scenes: [
            { emoji: e(OBJECTS, c.object), text: `En chemin, ils trouvent ${object}. Elle brille doucement, comme pour dire : « Je vais vous aider. »` },
            { emoji: '🧩', text: long ? `Mais le chemin se sépare en trois. ${cap(hero)} réfléchit, observe les indices et choisit le bon passage. Se tromper n’est pas grave : on recommence et on apprend.` : `Il faut choisir le bon chemin. ${cap(hero)} réfléchit… et trouve !` },
          ],
        },
        {
          title: 'La réussite',
          scenes: [
            { emoji: '⭐', text: `Grâce à ${object} et à l’aide de ${friend}, ils réussissent enfin à ${goal}. Tout le monde applaudit !` },
            { emoji: '💚', text: `Le soir venu, ${hero} sourit : ensemble, on va plus loin.` },
          ],
        },
      ],
      moral: 'Avec de la patience et de l’entraide, on réussit de grandes choses.',
    };
  }
  return {
    title: `${cap(hero)} and ${object}`,
    chapters: [
      {
        title: 'Setting off',
        scenes: [
          { emoji: e(PLACES, c.place), text: `That morning, ${hero} wakes up in ${place}. All is quiet… until ${friend} comes running.` },
          { emoji: e(STORY_COMPANIONS, c.companion), text: `"I need you," says ${friend}. "We have to ${goal}!" ${long ? `Heart pounding, ${hero} says yes at once: an adventure begins.` : 'And the adventure begins!'}` },
        ],
      },
      {
        title: 'The challenge',
        scenes: [
          { emoji: e(OBJECTS, c.object), text: `On the way they find ${object}. It glows softly, as if to say: "I'll help you."` },
          { emoji: '🧩', text: long ? `But the path splits into three. ${cap(hero)} thinks, looks at the clues and picks the right way. Getting it wrong is fine: you try again and you learn.` : `They must choose the right path. ${cap(hero)} thinks… and finds it!` },
        ],
      },
      {
        title: 'Success',
        scenes: [
          { emoji: '⭐', text: `Thanks to ${object} and ${friend}'s help, they finally ${goal}. Everyone cheers!` },
          { emoji: '💚', text: `That evening, ${hero} smiles: together, we go further.` },
        ],
      },
    ],
    moral: 'With patience and helping each other, we achieve great things.',
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
