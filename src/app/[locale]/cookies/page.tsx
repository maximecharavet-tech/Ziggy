import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';

/**
 * Written from what the code actually stores — keep it in step with it:
 * the next-intl locale cookie (middleware), the Supabase session
 * (`storageKey: 'ziggy-auth'` in src/lib/supabase.ts), the `ziggy:*`
 * localStorage / sessionStorage keys and the `ziggy-coloring` IndexedDB base.
 * French for the French site, English everywhere else.
 * Document à faire valider par un juriste avant tout lancement commercial.
 */

const CONTACT = 'contact@ziggy-ai.fr';
const UPDATED = { fr: '26 octobre 2026', en: '26 October 2026' };

type Section = { title: string; body: (string | string[])[] };

const CONTENT: Record<'fr' | 'en', { title: string; updated: string; intro: string; sections: Section[] }> = {
  fr: {
    title: 'Politique de cookies',
    updated: `Dernière mise à jour : ${UPDATED.fr}`,
    intro:
      'Ziggy n’utilise aucun cookie publicitaire, aucun outil de mesure d’audience et aucun traceur de réseaux sociaux. Ce que le site garde dans votre navigateur sert uniquement à le faire fonctionner et à retenir vos réglages.',
    sections: [
      {
        title: '1. Cookies et stockage local, de quoi parle-t-on ?',
        body: [
          'Un cookie est un petit fichier que le site dépose dans votre navigateur. Le stockage local (localStorage, sessionStorage et IndexedDB) fonctionne de la même façon : des informations rangées sur votre appareil, que seul le site Ziggy peut relire. La loi traite les deux de la même manière, c’est pourquoi cette page les présente ensemble.',
        ],
      },
      {
        title: '2. Le seul cookie',
        body: [
          [
            'NEXT_LOCALE : retient la langue du site quand vous en choisissez une autre que celle de votre navigateur. Cookie de session, effacé à la fermeture du navigateur.',
          ],
          'Aucun autre cookie n’est déposé par Ziggy, ni par un tiers à travers Ziggy.',
        ],
      },
      {
        title: '3. Ce qui est rangé sur votre appareil',
        body: [
          'Session de connexion (uniquement si un parent se connecte) :',
          [
            'ziggy-auth : la session du compte parent, gérée par Supabase. Elle est supprimée à la déconnexion.',
          ],
          'Réglages :',
          [
            'theme : le mode clair ou sombre.',
            'ziggy:muted : le son des jeux activé ou coupé.',
            'ziggy:auto-voice : la lecture à voix haute automatique des réponses de Ziggy.',
            'ziggy:dodo : les réglages du mode dodo (ambiance sonore, volume, minuteur, affichage du texte, histoires favorites et déjà écoutées).',
            'ziggy:avatar : l’avatar choisi dans Ziggy World.',
            'cookie-consent : le fait que vous ayez déjà lu le bandeau d’information.',
          ],
          'Progression :',
          [
            'ziggy:progress : les résultats des jeux et les étoiles gagnées.',
            'ziggy:world : la progression dans Ziggy World (quêtes, étoiles, XP, niveau par compétence).',
            'ziggy:today et ziggy:streak : la mission du jour et la série de jours.',
            'ziggy:memo:…, ziggy:palace-level, ziggy:nid, ziggy:sandbox : l’avancement des cartes de révision, du palais de la mémoire, du Nid et du bac à sable.',
            'ziggy:rewards-seen:… : les récompenses déjà montrées, pour ne pas les fêter deux fois.',
          ],
          'Créations de l’enfant :',
          [
            'ziggy:songs : les chansons composées.',
            'Base IndexedDB « ziggy-coloring » : les dessins du coloriage. Ils restent sur l’appareil et ne sont jamais envoyés.',
          ],
          'Le temps d’un onglet (sessionStorage, effacé à sa fermeture) :',
          [
            'ziggy:intro : l’animation d’accueil de Ziggy déjà vue.',
            'ziggy:screen-time : le temps passé, pour proposer une pause à l’enfant.',
          ],
          'Pour un invité, la progression reste uniquement sur l’appareil. Quand un parent est connecté, elle est aussi enregistrée sur son compte (voir la Politique de confidentialité).',
        ],
      },
      {
        title: '4. Ce que nous ne faisons pas',
        body: [
          [
            'Aucune publicité, ni sur le site ni ailleurs à partir de vos données.',
            'Aucune mesure d’audience (pas de Google Analytics, pas de pixel, pas d’outil équivalent).',
            'Aucun bouton de réseau social ni contenu tiers qui suivrait votre navigation.',
            'Aucun profilage des enfants.',
          ],
          'Le site est hébergé par Vercel et les comptes sont gérés par Supabase, sur des serveurs situés dans l’Union européenne. Aucun de ces prestataires ne dépose de cookie publicitaire ou de pistage par l’intermédiaire de Ziggy.',
        ],
      },
      {
        title: '5. Votre consentement',
        body: [
          'Tout ce qui est décrit ici est strictement nécessaire au fonctionnement du site ou à un réglage que vous avez choisi : la loi ne demande pas de consentement préalable pour ce type de stockage. Le bandeau affiché à la première visite est donc une simple information. Si Ziggy devait un jour utiliser un traceur non essentiel, il ne serait activé qu’après votre accord.',
        ],
      },
      {
        title: '6. Gérer ou effacer ces données',
        body: [
          'Vous pouvez tout effacer à tout moment depuis les réglages de votre navigateur (« Effacer les données de navigation » ou « Données du site »). Attention : pour un invité, cela efface aussi les étoiles, la progression, les chansons et les dessins gardés sur l’appareil. La déconnexion supprime la session du compte parent, et la suppression du compte se fait depuis l’espace parent (« Mon compte »).',
        ],
      },
      {
        title: '7. Contact',
        body: [`Pour toute question : ${CONTACT}`],
      },
    ],
  },
  en: {
    title: 'Cookie Policy',
    updated: `Last updated: ${UPDATED.en}`,
    intro:
      'Ziggy uses no advertising cookies, no audience measurement and no social media trackers. What the site keeps in your browser is only there to make it work and to remember your settings.',
    sections: [
      {
        title: '1. Cookies and local storage: what are they?',
        body: [
          'A cookie is a small file a website places in your browser. Local storage (localStorage, sessionStorage and IndexedDB) works the same way: information kept on your device that only the Ziggy site can read back. The law treats both alike, which is why this page covers them together.',
        ],
      },
      {
        title: '2. The only cookie',
        body: [
          [
            'NEXT_LOCALE: remembers the site language when you choose one other than your browser’s. Session cookie, removed when the browser closes.',
          ],
          'No other cookie is set by Ziggy, or by any third party through Ziggy.',
        ],
      },
      {
        title: '3. What is kept on your device',
        body: [
          'Sign-in session (only when a parent signs in):',
          ['ziggy-auth: the parent account session, managed by Supabase. It is removed when you sign out.'],
          'Settings:',
          [
            'theme: light or dark mode.',
            'ziggy:muted: game sounds on or off.',
            'ziggy:auto-voice: whether Ziggy’s replies are read aloud automatically.',
            'ziggy:dodo: bedtime mode settings (background sound, volume, timer, text display, favourite and already-heard stories).',
            'ziggy:avatar: the avatar chosen in Ziggy World.',
            'cookie-consent: that you have already seen the information banner.',
          ],
          'Progress:',
          [
            'ziggy:progress: game results and stars won.',
            'ziggy:world: Ziggy World progress (quests, stars, XP, level per skill).',
            'ziggy:today and ziggy:streak: today’s mission and the day streak.',
            'ziggy:memo:…, ziggy:palace-level, ziggy:nid, ziggy:sandbox: progress in flashcards, the memory palace, the Nest and the sandbox.',
            'ziggy:rewards-seen:…: rewards already shown, so they are not celebrated twice.',
          ],
          'The child’s creations:',
          [
            'ziggy:songs: songs the child has composed.',
            'IndexedDB database “ziggy-coloring”: colouring drawings. They stay on the device and are never uploaded.',
          ],
          'For one tab only (sessionStorage, cleared when the tab closes):',
          [
            'ziggy:intro: Ziggy’s welcome animation has been seen.',
            'ziggy:screen-time: time spent, so the child can be offered a break.',
          ],
          'For a guest, progress stays on the device only. When a parent is signed in, it is also saved to their account (see the Privacy Policy).',
        ],
      },
      {
        title: '4. What we don’t do',
        body: [
          [
            'No advertising, on the site or anywhere else based on your data.',
            'No audience measurement (no Google Analytics, no pixel, nothing similar).',
            'No social media buttons or third-party content that follows your browsing.',
            'No profiling of children.',
          ],
          'The site is hosted by Vercel and accounts are managed by Supabase, on servers located in the European Union. None of these providers sets advertising or tracking cookies through Ziggy.',
        ],
      },
      {
        title: '5. Your consent',
        body: [
          'Everything described here is strictly necessary for the site to work or for a setting you chose, so the law does not require prior consent for it. The banner shown on your first visit is therefore just information. Should Ziggy ever use a non-essential tracker, it would only be switched on with your agreement.',
        ],
      },
      {
        title: '6. Managing or clearing this data',
        body: [
          'You can clear everything at any time from your browser settings (“Clear browsing data” or “Site data”). Note that for a guest this also erases the stars, progress, songs and drawings kept on the device. Signing out removes the parent account session, and the account itself can be deleted from the parent area (“My account”).',
        ],
      },
      {
        title: '7. Contact',
        body: [`Any question: ${CONTACT}`],
      },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = CONTENT[locale === 'fr' ? 'fr' : 'en'];
  return { title: `${c.title} — Ziggy`, description: c.intro, alternates: alternatesFor(locale, '/cookies') };
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = CONTENT[locale === 'fr' ? 'fr' : 'en'];

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <article className="max-w-3xl mx-auto rounded-3xl border border-border/60 bg-bg-card p-8 sm:p-12 shadow-[0_30px_70px_-40px_rgba(26,26,46,0.35)]">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-body mb-2">{c.title}</h1>
        <p className="text-sm text-text-dim mb-6">{c.updated}</p>
        <p className="text-lg text-text-body leading-relaxed mb-10">{c.intro}</p>

        <div className="space-y-8 text-[15px] text-text-muted leading-relaxed">
          {c.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-bold text-text-body mb-3">{s.title}</h2>
              <div className="space-y-3">
                {s.body.map((block, i) =>
                  Array.isArray(block) ? (
                    <ul key={i} className="list-disc ps-5 space-y-1.5">
                      {block.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{block}</p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
