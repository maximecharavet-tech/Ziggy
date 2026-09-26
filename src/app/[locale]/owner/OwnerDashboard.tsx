'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  ShieldCheck, LogOut, Users, Star, Gamepad2, Trophy, Save, RotateCcw, Eye, EyeOff,
  RefreshCw, Loader2, Check, ExternalLink,
} from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { useProfile } from '@/components/account/ProfileProvider';
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { loadSupabase } from '@/lib/supabase';
import { avatarColor } from '@/lib/account';
import { GAMES } from '@/lib/games';
import { DEFAULT_SITE_CONFIG, normaliseSiteConfig, type SiteConfig } from '@/lib/site-config';

const SECTION_LABELS: Record<keyof SiteConfig['sections'], string> = {
  showcase: 'Rencontre Ziggy (vidéo)',
  agents: 'Les agents',
  games: 'L’arcade de jeux',
  reviews: 'Avis des parents',
  pricing: 'Tarifs',
};

const STAT_LABELS: Record<keyof SiteConfig['stats'], string> = {
  children: 'Enfants actifs',
  sessions: 'Sessions',
  countries: 'Pays',
  rating: 'Note des parents',
};

interface GameStat { game_id: string; plays: number; players: number; avg_score: number; total_stars: number }
interface RecentProfile { child_name: string; avatar: string; age_group: string | null; created_at: string }
interface RecentResult {
  game_id: string;
  score: number;
  stars: number;
  created_at: string;
  profiles: { child_name: string; avatar: string } | null;
}

const gameColor = (id: string) => GAMES.find((g) => g.id === id)?.color ?? '#22C55E';

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export function OwnerDashboard() {
  const router = useRouter();
  const tg = useTranslations('games');
  const gameName = (id: string) => (GAMES.some((g) => g.id === id) ? tg(`${id}.name`) : id);
  const { ready, isOwner, user, signOut } = useProfile();

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [recentProfiles, setRecentProfiles] = useState<RecentProfile[]>([]);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [ages, setAges] = useState<Record<string, number>>({});

  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [savedConfig, setSavedConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');

  // The page gate is for comfort; the data itself is protected by row level security.
  useEffect(() => {
    if (ready && !isOwner) router.replace('/login');
  }, [ready, isOwner, router]);

  const load = useCallback(async () => {
    const sb = await loadSupabase();
    if (!sb) return;
    setLoading(true);
    const [acc, res, stats, profs, recent, ageRows, settings] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('game_results').select('*', { count: 'exact', head: true }),
      sb.rpc('owner_game_stats'),
      sb.from('profiles').select('child_name, avatar, age_group, created_at').order('created_at', { ascending: false }).limit(8),
      sb
        .from('game_results')
        .select('game_id, score, stars, created_at, profiles(child_name, avatar)')
        .order('created_at', { ascending: false })
        .limit(10),
      sb.from('profiles').select('age_group').limit(5000),
      sb.from('site_settings').select('stats, sections').eq('id', 1).maybeSingle(),
    ]);

    setAccounts(acc.count ?? 0);
    setRounds(res.count ?? 0);
    setGameStats((stats.data as GameStat[] | null) ?? []);
    setRecentProfiles((profs.data as RecentProfile[] | null) ?? []);
    setRecentResults((recent.data as unknown as RecentResult[] | null) ?? []);

    const counts: Record<string, number> = { '5-7': 0, '8-10': 0, '11-12': 0, '?': 0 };
    for (const row of (ageRows.data as { age_group: string | null }[] | null) ?? []) {
      counts[row.age_group ?? '?'] = (counts[row.age_group ?? '?'] ?? 0) + 1;
    }
    setAges(counts);

    const cfg = normaliseSiteConfig(settings.data);
    setConfig(cfg);
    setSavedConfig(cfg);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ready && isOwner) void load();
  }, [ready, isOwner, load]);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedConfig), [config, savedConfig]);
  const totalStars = gameStats.reduce((s, g) => s + Number(g.total_stars), 0);
  const maxPlays = Math.max(1, ...gameStats.map((g) => Number(g.plays)));

  async function saveConfig() {
    const sb = await loadSupabase();
    if (!sb) return;
    setSaving(true);
    const { error } = await sb.from('site_settings').update({ stats: config.stats, sections: config.sections }).eq('id', 1);
    if (error) {
      setSaving(false);
      setSaveState('error');
      return;
    }
    // Publish now rather than at the next minute.
    const token = (await sb.auth.getSession()).data.session?.access_token;
    if (token) {
      await fetch('/api/revalidate', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    setSavedConfig(config);
    setSaving(false);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2500);
  }

  if (!ready || !isOwner) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center" aria-busy="true">
        <Loader2 size={28} className="animate-spin text-green" />
      </div>
    );
  }

  const card = 'glass-strong rounded-2xl border border-border/50 p-6';

  return (
    <div className="min-h-screen pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl gradient-green-cta flex items-center justify-center shadow-lg shadow-green/25">
              <ShieldCheck size={24} className="text-white" />
            </span>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-body">Tableau de bord</h1>
              <p className="text-sm text-text-muted">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-text-muted hover:text-text-body glass border border-border/50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-text-muted hover:text-text-body glass border border-border/50"
            >
              <ExternalLink size={15} />
              Voir le site
            </Link>
            <button
              onClick={async () => {
                await signOut();
                router.replace('/');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-text-muted hover:text-text-body glass border border-border/50"
            >
              <LogOut size={15} className="rtl:rotate-180" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: 'Comptes familles', value: accounts },
            { icon: Gamepad2, label: 'Parties jouées', value: rounds },
            { icon: Star, label: 'Étoiles gagnées', value: totalStars },
            { icon: Trophy, label: 'Jeux en ligne', value: GAMES.length },
          ].map(({ icon: Icon, label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={card}
            >
              <Icon size={18} className="text-green mb-3" />
              <div className="text-3xl font-extrabold text-text-body tabular-nums">{loading ? '–' : value}</div>
              <div className="text-xs font-semibold text-text-dim mt-1">{label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
          {/* Plays per game */}
          <section className={card}>
            <h2 className="font-extrabold text-text-body mb-5">Popularité des jeux</h2>
            {gameStats.length === 0 ? (
              <p className="text-sm text-text-muted">Aucune partie enregistrée pour l’instant.</p>
            ) : (
              <ul className="space-y-3">
                {gameStats.map((g) => (
                  <li key={g.game_id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-bold" style={{ color: gameColor(g.game_id) }}>{gameName(g.game_id)}</span>
                      <span className="text-text-dim tabular-nums">
                        {g.plays} parties · {g.players} joueurs · moy. {g.avg_score}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-border/40 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(Number(g.plays) / maxPlays) * 100}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: gameColor(g.game_id) }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Ages */}
          <section className={card}>
            <h2 className="font-extrabold text-text-body mb-5">Âge des enfants</h2>
            <div className="grid grid-cols-4 gap-2">
              {['5-7', '8-10', '11-12', '?'].map((k) => (
                <div key={k} className="glass rounded-xl border border-border/50 p-3 text-center">
                  <div className="text-2xl font-extrabold text-text-body tabular-nums">{ages[k] ?? 0}</div>
                  <div className="text-[11px] font-semibold text-text-dim">{k === '?' ? 'non précisé' : `${k} ans`}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <section className={card}>
            <h2 className="font-extrabold text-text-body mb-4">Dernières inscriptions</h2>
            {recentProfiles.length === 0 ? (
              <p className="text-sm text-text-muted">Personne pour l’instant.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {recentProfiles.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <AgentAvatar agentId={p.avatar} color={avatarColor(p.avatar)} size={30} />
                    <span className="font-bold text-sm text-text-body flex-1 truncate">{p.child_name}</span>
                    <span className="text-xs text-text-dim">{p.age_group ? `${p.age_group} ans` : '—'}</span>
                    <span className="text-xs text-text-dim w-24 text-end">{timeAgo(p.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={card}>
            <h2 className="font-extrabold text-text-body mb-4">Dernières parties</h2>
            {recentResults.length === 0 ? (
              <p className="text-sm text-text-muted">Aucune partie pour l’instant.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {recentResults.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span className="text-sm font-bold w-20 truncate" style={{ color: gameColor(r.game_id) }}>
                      {gameName(r.game_id)}
                    </span>
                    <span className="text-sm text-text-body flex-1 truncate">{r.profiles?.child_name ?? '—'}</span>
                    <span className="flex">
                      {[0, 1, 2].map((s) => (
                        <Star key={s} size={12} className={s < r.stars ? 'text-yellow fill-yellow' : 'text-border'} />
                      ))}
                    </span>
                    <span className="text-xs text-text-dim w-24 text-end">{timeAgo(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Site settings */}
        <section className={`${card} mb-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-extrabold text-text-body">Réglages du site</h2>
              <p className="text-xs text-text-muted mt-1">Publiés sur ziggy-ai.fr dès l’enregistrement.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfig(DEFAULT_SITE_CONFIG)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold glass border border-border/50 text-text-muted"
              >
                <RotateCcw size={13} />
                Valeurs par défaut
              </button>
              <button
                onClick={() => void saveConfig()}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold gradient-green-cta text-white disabled:opacity-40"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : saveState === 'saved' ? <Check size={13} /> : <Save size={13} />}
                {saveState === 'saved' ? 'Publié' : 'Enregistrer et publier'}
              </button>
            </div>
          </div>
          {saveState === 'error' && (
            <p role="alert" className="text-sm font-semibold text-pink mb-4">
              L’enregistrement a échoué. Vérifiez votre connexion et réessayez.
            </p>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">Chiffres de l’accueil</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(config.stats) as (keyof SiteConfig['stats'])[]).map((key) => (
                  <label key={key} className="block">
                    <span className="block text-xs font-bold text-text-muted mb-1.5">{STAT_LABELS[key]}</span>
                    <input
                      value={config.stats[key]}
                      maxLength={16}
                      onChange={(e) => setConfig({ ...config, stats: { ...config.stats, [key]: e.target.value } })}
                      className="w-full glass rounded-xl px-3 py-2.5 text-sm font-bold text-text-body border border-border/50 outline-none focus:ring-2 focus:ring-green/30"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">Sections visibles</p>
              <div className="space-y-2">
                {(Object.keys(config.sections) as (keyof SiteConfig['sections'])[]).map((key) => {
                  const on = config.sections[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setConfig({ ...config, sections: { ...config.sections, [key]: !on } })}
                      aria-pressed={on}
                      className="w-full flex items-center justify-between gap-3 glass rounded-xl border border-border/50 px-4 py-2.5 text-start transition-colors hover:border-green/40"
                    >
                      <span className="text-sm font-bold text-text-body">{SECTION_LABELS[key]}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                          on ? 'text-green bg-green/10' : 'text-text-dim bg-border/40'
                        }`}
                      >
                        {on ? <Eye size={13} /> : <EyeOff size={13} />}
                        {on ? 'Visible' : 'Masquée'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <ChangePasswordForm
          labels={{
            title: 'Changer mon mot de passe',
            newPassword: 'Nouveau mot de passe',
            confirmPassword: 'Confirmer',
            save: 'Mettre à jour',
            saved: 'Mot de passe mis à jour.',
            errorLength: 'Au moins 8 caractères.',
            errorMismatch: 'Les deux mots de passe ne correspondent pas.',
            errorGeneric: 'La mise à jour a échoué. Réessayez.',
          }}
        />
      </div>
    </div>
  );
}
