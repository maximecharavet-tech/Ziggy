import type { NextRequest } from 'next/server';
import { WORLDS } from '@/data/worlds';
import { getGame } from '@/lib/arcade/registry';
import { tr } from '@/lib/i18n-text';
import { routing } from '@/i18n/routing';

/** The 20 worlds of Ziggy World, localised (public, cacheable by locale). */

export function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get('locale') ?? 'fr';
  const locale = (routing.locales as readonly string[]).includes(asked) ? asked : 'fr';
  return Response.json(
    {
      worlds: WORLDS.map((w) => ({
        id: w.id,
        name: tr(w.name, locale),
        description: tr(w.description, locale),
        icon: w.icon,
        colors: w.colors,
        map: w.map,
        unlockStars: w.unlockStars,
        companions: w.companions,
        learningSkills: w.learningSkills,
        games: w.availableGames.map((g) => ({ id: g, name: tr(getGame(g).name, locale), emoji: getGame(g).emoji })),
        quests: w.quests.map((q) => ({ id: q.id, title: tr(q.title, locale), chapter: q.chapter, gameId: q.gameId, skill: q.skill, reward: q.reward })),
      })),
    },
    { headers: { 'cache-control': 'public, max-age=3600' } }
  );
}
