'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { WORLDS } from '@/data/worlds';
import { levelFor, worldProgress } from '@/lib/world/gamification';
import { masteryBand } from '@/lib/learning/adaptive';
import { LEARNING_SKILLS, SKILL_NAMES } from '@/lib/learning/skills';
import { emptyMemory, normalizeMemory, totalStars, type WorldMemory } from '@/lib/world/memory';
import { WORLD_KEY, accessToken, api, getMemory, setMemory } from '@/lib/world/store';
import { tr, type L } from '@/lib/i18n-text';
import { AppPage } from '@/components/learn/AppPage';
import { MASTERY_TEXT } from './text';
import { AGE_CHOICES, chooseAge } from './AgePicker';
import { readAloudOn } from '@/lib/world/memory';
import { syncWorld, useWorldMemory } from '@/lib/world/store';

type Overview = {
  memory: WorldMemory | null;
  usage: { generationCount: number; estimatedCost: number; byOperation: Record<string, number>; limits: Record<string, number> };
  counts: { stories: number; avatars: number };
  consents: Record<string, string>;
  safety: { blocked: Record<string, number>; total: number };
  generations: { id: string; operation: string; status: string; provider: string; world: string | null; safety_status: string; estimated_cost: number; latency_ms: number | null; created_at: string; expires_at: string }[];
  engine: { mode: string; text: string | null; vision: boolean; image: boolean };
};

const T = {
  title: { fr: 'Espace parents', en: 'Parents’ area' },
  subtitle: { fr: 'Les progrès d’apprentissage, les consentements, l’usage de l’IA et vos données — tout est ici, sans profilage ni diagnostic.', en: 'Learning progress, consents, AI usage and your data — all here, with no profiling and no diagnosis.' },
  signIn: { fr: 'Connectez-vous avec le compte parent pour voir la console.', en: 'Sign in with the parent account to see the console.' },
  login: { fr: 'Se connecter', en: 'Sign in' },
  progress: { fr: 'Progrès', en: 'Progress' },
  level: { fr: 'Niveau', en: 'Level' },
  stars: { fr: 'Étoiles', en: 'Stars' },
  quests: { fr: 'Quêtes terminées', en: 'Quests completed' },
  worlds: { fr: 'Mondes terminés', en: 'Worlds completed' },
  time: { fr: 'Temps de jeu', en: 'Play time' },
  games: { fr: 'Jeux les plus joués', en: 'Most played games' },
  skills: { fr: 'Compétences travaillées', en: 'Skills practised' },
  skillsNote: { fr: 'Estimation de maîtrise par compétence (traçage des connaissances) et niveau de jeu 1–5. Il s’agit uniquement d’apprentissage : aucune évaluation psychologique.', en: 'Mastery estimate per skill (knowledge tracing) and game level 1–5. Learning only: no psychological assessment.' },
  content: { fr: 'Histoires et avatars', en: 'Stories and avatars' },
  consents: { fr: 'Consentements', en: 'Consents' },
  photoConsent: { fr: 'Avatar depuis une photo (lecture en mémoire, jamais stockée)', en: 'Avatar from a photo (read in memory, never stored)' },
  aiConsent: { fr: 'Contenus créés par IA (quêtes, histoires, questions), vérifiés par ChildShield', en: 'AI-made content (quests, stories, questions), checked by ChildShield' },
  usage: { fr: 'Usage de l’IA ce mois-ci', en: 'AI usage this month' },
  generations: { fr: 'générations', en: 'generations' },
  cost: { fr: 'coût estimé', en: 'estimated cost' },
  limits: { fr: 'Limites : {d}/jour, {m}/mois, {i} images/jour', en: 'Limits: {d}/day, {m}/month, {i} images/day' },
  safety: { fr: 'Bouclier de sécurité', en: 'Safety shield' },
  safetyNone: { fr: 'Aucun contenu bloqué.', en: 'Nothing blocked.' },
  safetyNote: { fr: 'Contenus IA refusés par ChildShield (remplacés automatiquement par du contenu Ziggy). Seule la catégorie est gardée.', en: 'AI content refused by ChildShield (automatically replaced with Ziggy content). Only the category is kept.' },
  recent: { fr: 'Dernières générations', en: 'Recent generations' },
  engine: { fr: 'Moteur', en: 'Engine' },
  notSet: { fr: 'non configuré', en: 'not configured' },
  data: { fr: 'Vos données', en: 'Your data' },
  delAvatars: { fr: 'Supprimer les avatars', en: 'Delete avatars' },
  delStories: { fr: 'Supprimer les histoires', en: 'Delete stories' },
  delProgress: { fr: 'Effacer la progression', en: 'Erase progress' },
  delHistory: { fr: 'Effacer l’historique IA', en: 'Erase AI history' },
  delAll: { fr: 'Tout effacer (Ziggy World)', en: 'Erase everything (Ziggy World)' },
  confirm: { fr: 'Confirmer ?', en: 'Confirm?' },
  done: { fr: 'Supprimé.', en: 'Deleted.' },
  account: { fr: 'Pour supprimer tout le compte : page Compte.', en: 'To delete the whole account: Account page.' },
  none: { fr: 'Rien pour l’instant.', en: 'Nothing yet.' },
} satisfies Record<string, L>;

const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-text-body">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ParentConsole() {
  const locale = useLocale();
  const [state, setState] = useState<'loading' | 'guest' | 'ready'>('loading');
  const [data, setData] = useState<Overview | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const device = useWorldMemory();

  const load = useCallback(async () => {
    if (!(await accessToken())) return setState('guest');
    const res = await api<Overview>('parent/overview');
    if (res.ok) {
      setData(res.data);
      setState('ready');
    } else setState(res.status === 401 ? 'guest' : 'ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function consent(kind: 'photo_avatar' | 'ai_content', granted: boolean) {
    const r = await api('parent/consent', { body: { kind, granted } });
    if (r.ok) void load();
  }

  async function erase(scope: 'avatars' | 'stories' | 'progress' | 'history' | 'all') {
    if (armed !== scope) return setArmed(scope);
    setArmed(null);
    const r = await api('parent/data', { method: 'DELETE', body: { scope } });
    if (!r.ok) return;
    if (scope === 'progress' || scope === 'all') {
      try {
        localStorage.removeItem(WORLD_KEY);
      } catch {
        /* ignore */
      }
      setMemory(emptyMemory());
    }
    setNotice(tr(T.done, locale));
    void load();
  }

  if (state !== 'ready') {
    return (
      <AppPage eyebrow={<>👨‍👩‍👧 Parents</>} title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} color="#4FC9C0">
        {state === 'guest' ? (
          <div className="mx-auto max-w-md rounded-3xl bg-bg-card p-6 text-center shadow-sm">
            <p className="text-text-muted">{tr(T.signIn, locale)}</p>
            <Link href="/login" className="mt-4 inline-block rounded-full bg-teal px-6 py-3 font-bold text-white">
              {tr(T.login, locale)}
            </Link>
          </div>
        ) : (
          <div className="h-96 animate-pulse rounded-[2rem] bg-bg-card/60" aria-hidden="true" />
        )}
      </AppPage>
    );
  }

  const m = data?.memory ? normalizeMemory(data.memory) : getMemory();
  const lv = levelFor(m.xp);
  const worldsDone = WORLDS.filter((w) => worldProgress(w, m).done === w.quests.length).length;
  const minutes = Math.round(m.playMs / 60000);
  const topGames = Object.entries(m.gamesPlayed).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const skills = LEARNING_SKILLS.filter((s) => m.skills[s]);
  const scopes = [
    ['avatars', T.delAvatars],
    ['stories', T.delStories],
    ['progress', T.delProgress],
    ['history', T.delHistory],
    ['all', T.delAll],
  ] as const;

  return (
    <AppPage eyebrow={<>👨‍👩‍👧 Parents</>} title={tr(T.title, locale)} subtitle={tr(T.subtitle, locale)} color="#4FC9C0">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`📈 ${tr(T.progress, locale)}`}>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                [tr(T.level, locale), lv.level],
                [tr(T.stars, locale), totalStars(m)],
                [tr(T.quests, locale), Object.keys(m.completedQuests).length],
                [tr(T.worlds, locale), `${worldsDone}/${WORLDS.length}`],
                [tr(T.time, locale), minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60}`],
                ['XP', m.xp],
              ] as [string, string | number][]
            ).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-teal/10 p-3">
                <dt className="text-xs font-bold text-text-muted">{k}</dt>
                <dd className="font-display text-2xl font-bold text-text-body">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 text-sm font-bold text-text-body">{tr(T.games, locale)}</h3>
          {topGames.length ? (
            <ul className="mt-2 text-sm text-text-muted">
              {topGames.map(([g, n]) => (
                <li key={g}>
                  {g.replace(/_/g, ' ')} · {n}×
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-text-muted">{tr(T.none, locale)}</p>
          )}
        </Card>

        <Card title={`🌱 ${tr(T.skills, locale)}`}>
          <p className="text-xs text-text-muted">{tr(T.skillsNote, locale)}</p>
          {skills.length ? (
            <ul className="mt-3 grid gap-2">
              {skills.map((s) => {
                const st = m.skills[s]!;
                return (
                  <li key={s} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate font-semibold text-text-body">{tr(SKILL_NAMES[s], locale)}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-border/70" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(st.masteryEstimate * 100)} aria-label={tr(SKILL_NAMES[s], locale)}>
                      <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.round(st.masteryEstimate * 100)}%` }} />
                    </span>
                    <span className="text-xs font-bold text-text-muted">
                      {tr(MASTERY_TEXT[masteryBand(st.masteryEstimate)], locale)} · {st.difficulty}/5
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-muted">{tr(T.none, locale)}</p>
          )}
        </Card>

        <Card title={`👶 ${locale === 'fr' ? 'Âge et lecture' : 'Age and reading'}`}>
          <div className="grid gap-2" role="radiogroup" aria-label={locale === 'fr' ? 'Âge' : 'Age'}>
            {AGE_CHOICES.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={device.age === a.id}
                onClick={() => chooseAge(a.id)}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left text-sm ${device.age === a.id ? 'border-teal bg-teal/10' : 'border-border/60'}`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {a.emoji}
                </span>
                <span>
                  <span className="block font-bold text-text-body">{tr(a.title, locale)}</span>
                  <span className="block text-xs text-text-muted">{tr(a.detail, locale)}</span>
                </span>
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-text-body">
            <input
              type="checkbox"
              className="h-5 w-5 accent-teal"
              checked={readAloudOn(device)}
              onChange={(e) => {
                setMemory({ ...getMemory(), readAloud: e.target.checked, updatedAt: new Date().toISOString() });
                void syncWorld();
              }}
            />
            {locale === 'fr' ? '🔊 Ziggy lit à voix haute les consignes, les réponses et les histoires' : '🔊 Ziggy reads instructions, answers and stories aloud'}
          </label>
        </Card>

        <Card title={`🔐 ${tr(T.consents, locale)}`}>
          {(['photo_avatar', 'ai_content'] as const).map((k) => {
            const on = Boolean(data?.consents[k]);
            return (
              <label key={k} className="mb-3 flex items-start gap-3 text-sm text-text-body">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-teal" checked={on} onChange={(e) => void consent(k, e.target.checked)} />
                <span>
                  {tr(k === 'photo_avatar' ? T.photoConsent : T.aiConsent, locale)}
                  {on ? <span className="block text-xs text-text-muted">{new Date(data!.consents[k]).toLocaleDateString(locale)}</span> : null}
                </span>
              </label>
            );
          })}
          <p className="mt-2 text-sm text-text-muted">
            {tr(T.content, locale)} : {data?.counts.stories ?? 0} 📚 · {data?.counts.avatars ?? 0} 🧑‍🎨 —{' '}
            <Link href="/monde/histoires" className="font-bold text-teal underline">
              📚
            </Link>{' '}
            <Link href="/monde/avatar" className="font-bold text-teal underline">
              🧑‍🎨
            </Link>
          </p>
        </Card>

        <Card title={`⚡ ${tr(T.usage, locale)}`}>
          <p className="font-display text-3xl font-bold text-text-body">
            {data?.usage.generationCount ?? 0} <span className="text-base font-semibold text-text-muted">{tr(T.generations, locale)}</span>
          </p>
          <p className="text-sm text-text-muted">
            ≈ {(data?.usage.estimatedCost ?? 0).toFixed(3)} $ · {tr(T.cost, locale)}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(data?.usage.byOperation ?? {}).map(([op, n]) => (
              <li key={op} className="rounded-full bg-teal/10 px-3 py-1 font-semibold text-text-body">
                {op.replace(/_/g, ' ')} · {n}
              </li>
            ))}
          </ul>
          {data ? (
            <p className="mt-3 text-xs text-text-muted">
              {fmt(tr(T.limits, locale), { d: data.usage.limits.dailyGenerationLimit, m: data.usage.limits.monthlyGenerationLimit, i: data.usage.limits.dailyImageLimit })}
            </p>
          ) : null}
          {data ? (
            <p className="mt-2 text-xs text-text-muted">
              {tr(T.engine, locale)} : Hyper Engine ({data.engine.mode}) · texte {data.engine.text ?? tr(T.notSet, locale)} · vision {data.engine.vision ? 'NVIDIA' : tr(T.notSet, locale)} · image {data.engine.image ? 'Agnes' : tr(T.notSet, locale)}
            </p>
          ) : null}
        </Card>

        <Card title={`🛡️ ${tr(T.safety, locale)}`}>
          <p className="text-xs text-text-muted">{tr(T.safetyNote, locale)}</p>
          {data && data.safety.total ? (
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {Object.entries(data.safety.blocked).map(([c, n]) => (
                <li key={c} className="rounded-full bg-coral/10 px-3 py-1 font-semibold text-text-body">
                  {c.replace(/_/g, ' ')} · {n}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm font-semibold text-green">✓ {tr(T.safetyNone, locale)}</p>
          )}
        </Card>

        <Card title={`🧾 ${tr(T.recent, locale)}`}>
          {data?.generations.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-text-muted">
                  <tr>
                    <th className="py-1 pe-2">Op</th>
                    <th className="py-1 pe-2">Status</th>
                    <th className="py-1 pe-2">Provider</th>
                    <th className="py-1 pe-2">Safety</th>
                    <th className="py-1">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.generations.map((g) => (
                    <tr key={g.id} className="border-t border-border/60 text-text-body">
                      <td className="py-1 pe-2">{g.operation.replace('generate_', '').replace(/_/g, ' ')}</td>
                      <td className="py-1 pe-2">{g.status}</td>
                      <td className="py-1 pe-2">{g.provider}</td>
                      <td className="py-1 pe-2">{g.safety_status}</td>
                      <td className="py-1">{new Date(g.created_at).toLocaleDateString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{tr(T.none, locale)}</p>
          )}
        </Card>
      </div>

      <section className="mt-6 rounded-[2rem] border-2 border-coral/30 bg-bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-text-body">🗑️ {tr(T.data, locale)}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {scopes.map(([scope, label]) => (
            <button
              key={scope}
              type="button"
              onClick={() => void erase(scope)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${armed === scope ? 'bg-coral text-white' : 'border border-coral/40 text-coral hover:bg-coral/10'}`}
            >
              {armed === scope ? `⚠️ ${tr(T.confirm, locale)}` : tr(label, locale)}
            </button>
          ))}
        </div>
        {notice ? (
          <p role="status" className="mt-3 text-sm font-semibold text-green">
            {notice}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-text-muted">
          <Link href="/account" className="font-bold underline">
            {tr(T.account, locale)}
          </Link>
        </p>
      </section>
    </AppPage>
  );
}
