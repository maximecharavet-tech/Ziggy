'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from '@/i18n/navigation';
import {
  ShieldCheck, LogOut, Users, Star, Gamepad2, Save, RotateCcw,
  Eye, EyeOff, TriangleAlert,
} from 'lucide-react';
import { isOwner, endOwnerSession, OWNER_EVENT } from '@/lib/owner';
import {
  getSiteConfig, saveSiteConfig, resetSiteConfig,
  DEFAULT_SITE_CONFIG, type SiteConfig,
} from '@/lib/site-config';
import { getProfile, avatarColor, type ZiggyProfile } from '@/lib/account';
import { getProgress, totalStars, totalPlays, clearProgress, type ProgressMap } from '@/lib/progress';
import { GAMES } from '@/lib/games';
import { AgentAvatar } from '@/components/agents/AgentAvatar';

const SECTION_LABELS: Record<keyof SiteConfig['sections'], string> = {
  showcase: 'Meet Ziggy (video)',
  agents: 'Agents',
  games: 'Games arcade',
  reviews: 'Reviews',
  pricing: 'Pricing',
};

export function OwnerDashboard() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [profile, setProfile] = useState<ZiggyProfile | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(isOwner());
    sync();
    setConfig(getSiteConfig());
    setProfile(getProfile());
    setProgress(getProgress());
    window.addEventListener(OWNER_EVENT, sync);
    return () => window.removeEventListener(OWNER_EVENT, sync);
  }, []);

  // Not the owner: send them to the login screen rather than showing a shell.
  useEffect(() => {
    if (allowed === false) router.replace('/login');
  }, [allowed, router]);

  if (allowed !== true) return <div className="min-h-[70vh]" aria-hidden="true" />;

  const commit = (next: SiteConfig) => {
    setConfig(next);
    saveSiteConfig(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const signOut = () => {
    endOwnerSession();
    router.replace('/');
  };

  const stars = totalStars(progress);
  const plays = totalPlays(progress);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-green/10 flex items-center justify-center">
              <ShieldCheck size={24} className="text-green" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-text-body">Owner dashboard</h1>
              <p className="text-sm text-text-muted">Signed in as mastermax07</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-text-muted hover:text-text-body glass border border-border/50 transition-colors"
          >
            <LogOut size={15} className="rtl:rotate-180" />
            Sign out
          </button>
        </div>

        {/* Honest warning — this matters more than it looks */}
        <div className="flex gap-3 rounded-2xl border border-yellow/40 bg-yellow/5 p-4 mb-8">
          <TriangleAlert size={18} className="text-yellow shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">
            This dashboard runs entirely in your browser and the site&apos;s source code is public,
            so this login is a convenience gate — not real security. Everything shown below comes
            from <em>this device only</em>. Don&apos;t put private data behind it; that needs a
            server with real authentication.
          </p>
        </div>

        {/* Live figures */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            { icon: Users, label: 'Profiles here', value: profile ? 1 : 0 },
            { icon: Star, label: 'Stars earned', value: stars },
            { icon: Gamepad2, label: 'Games played', value: plays },
            { icon: Gamepad2, label: 'Games live', value: GAMES.length },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="glass rounded-2xl border border-border/50 p-4 text-center">
              <Icon size={18} className="text-green mx-auto mb-1.5" />
              <div className="text-2xl font-extrabold text-text-body tabular-nums">{value}</div>
              <div className="text-xs text-text-dim">{label}</div>
            </div>
          ))}
        </div>

        {/* Editable headline figures */}
        <section className="glass-strong rounded-2xl border border-border/50 p-6 mb-6">
          <h2 className="font-extrabold text-text-body mb-1">Headline figures</h2>
          <p className="text-xs text-text-muted mb-5">Shown under the hero. Saved instantly.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            {(Object.keys(config.stats) as (keyof SiteConfig['stats'])[]).map((key) => (
              <label key={key} className="block">
                <span className="block text-xs font-bold text-text-muted mb-1.5 capitalize">{key}</span>
                <input
                  value={config.stats[key]}
                  onChange={(e) => commit({ ...config, stats: { ...config.stats, [key]: e.target.value } })}
                  className="w-full glass rounded-xl px-3 py-2.5 text-sm font-bold text-text-body border border-border/50 outline-none focus:ring-2 focus:ring-green/30"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Section visibility */}
        <section className="glass-strong rounded-2xl border border-border/50 p-6 mb-6">
          <h2 className="font-extrabold text-text-body mb-1">Landing page sections</h2>
          <p className="text-xs text-text-muted mb-5">Hide a section without a deploy.</p>

          <div className="space-y-2">
            {(Object.keys(config.sections) as (keyof SiteConfig['sections'])[]).map((key) => {
              const on = config.sections[key];
              return (
                <button
                  key={key}
                  onClick={() => commit({ ...config, sections: { ...config.sections, [key]: !on } })}
                  className="w-full flex items-center justify-between gap-3 glass rounded-xl border border-border/50 px-4 py-3 text-start transition-colors hover:border-green/40"
                >
                  <span className="text-sm font-bold text-text-body">{SECTION_LABELS[key]}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                      on ? 'text-green bg-green/10' : 'text-text-dim bg-border/40'
                    }`}
                  >
                    {on ? <Eye size={13} /> : <EyeOff size={13} />}
                    {on ? 'Visible' : 'Hidden'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Per-game data */}
        <section className="glass-strong rounded-2xl border border-border/50 p-6 mb-6">
          <h2 className="font-extrabold text-text-body mb-5">Games on this device</h2>
          <div className="space-y-2">
            {GAMES.map((g) => {
              const entry = progress[g.id];
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                  <span className="text-sm font-bold" style={{ color: g.color }}>{g.id}</span>
                  <span className="text-xs text-text-dim tabular-nums">
                    {entry ? `${entry.plays} plays · best ${entry.bestScore} · ${entry.bestStars}★` : 'never played'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-pink/40 bg-pink/5 p-6">
          <h2 className="font-extrabold text-text-body mb-1">Reset</h2>
          <p className="text-xs text-text-muted mb-5">Clears data stored on this device. Cannot be undone.</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { resetSiteConfig(); setConfig(DEFAULT_SITE_CONFIG); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold glass border border-border/50 text-text-body"
            >
              <RotateCcw size={15} />
              Restore defaults
            </button>
            <button
              onClick={() => { clearProgress(); setProgress({}); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold glass border border-border/50 text-text-body"
            >
              <RotateCcw size={15} />
              Clear game progress
            </button>
          </div>
        </section>

        {profile && (
          <div className="mt-8 flex items-center gap-3 text-sm text-text-muted">
            <AgentAvatar agentId={profile.avatar} color={avatarColor(profile.avatar)} size={30} />
            Child profile on this device: <strong className="text-text-body">{profile.name}</strong>
          </div>
        )}

        <motion.div
          initial={false}
          animate={{ opacity: saved ? 1 : 0, y: saved ? 0 : 12 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full gradient-green-cta text-white text-sm font-bold shadow-lg">
            <Save size={15} />
            Saved
          </span>
        </motion.div>
      </div>
    </div>
  );
}
