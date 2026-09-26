import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

/**
 * Written from what the product actually does today — keep it in step with
 * the code. French for the French site, English everywhere else.
 * Have it reviewed by a lawyer before a commercial launch.
 */

const CONTACT = 'contact@ziggy-ai.fr';
const UPDATED = { fr: '26 septembre 2026', en: '26 September 2026' };

type Section = { title: string; body: (string | string[])[] };

const CONTENT: Record<'fr' | 'en', { title: string; updated: string; intro: string; sections: Section[] }> = {
  fr: {
    title: 'Politique de confidentialité',
    updated: `Dernière mise à jour : ${UPDATED.fr}`,
    intro:
      'Ziggy est une plateforme d’apprentissage pour les enfants de 5 à 12 ans. Nous collectons le strict minimum, nous ne vendons aucune donnée et nous n’affichons aucune publicité.',
    sections: [
      {
        title: '1. Qui crée le compte',
        body: [
          'Le compte est créé et géré par un parent ou un responsable légal, avec sa propre adresse e-mail. L’enfant ne crée jamais de compte seul. On peut aussi jouer sans compte : les étoiles restent alors uniquement sur l’appareil.',
        ],
      },
      {
        title: '2. Les données que nous conservons',
        body: [
          [
            'Pour le parent : l’adresse e-mail et le mot de passe (stocké chiffré, jamais lisible par nous).',
            'Pour l’enfant : son prénom, sa tranche d’âge (5-7, 8-10 ou 11-12 ans) et l’avatar choisi.',
            'Les résultats de jeu : le jeu, le score, les étoiles et la date.',
          ],
          'Nous ne demandons ni nom de famille, ni photo, ni date de naissance, ni adresse, ni téléphone.',
        ],
      },
      {
        title: '3. Les conversations avec Ziggy',
        body: [
          'Quand l’enfant écrit à Ziggy, son message est transmis à un fournisseur d’intelligence artificielle (actuellement Google Gemini) uniquement pour produire la réponse. Nous n’enregistrons pas ces conversations. Nous conseillons de rappeler aux enfants de ne jamais écrire d’informations personnelles dans le chat.',
        ],
      },
      {
        title: '4. Où sont les données',
        body: [
          [
            'Comptes et résultats : Supabase, serveurs situés à Paris (Union européenne).',
            'Hébergement du site : Vercel.',
            'Réponses du chat : Google (Gemini API).',
          ],
          'Ces prestataires traitent les données pour notre compte uniquement. Les échanges avec le site sont chiffrés (HTTPS).',
        ],
      },
      {
        title: '5. Cookies et stockage local',
        body: [
          'Aucun cookie publicitaire ni de pistage. Le navigateur garde seulement ce qui est nécessaire au fonctionnement : la session de connexion, le thème clair ou sombre, le réglage du son, la langue, votre choix concernant les cookies et, pour les invités, les étoiles gagnées.',
        ],
      },
      {
        title: '6. Durée de conservation',
        body: ['Les données sont conservées tant que le compte existe. Elles sont effacées définitivement lors de la suppression du compte.'],
      },
      {
        title: '7. Vos droits',
        body: [
          'Vous pouvez à tout moment accéder à vos données, les corriger ou les supprimer. La suppression complète du compte se fait en un clic depuis l’espace parent (« Mon compte »). Pour toute autre demande, écrivez-nous. Vous pouvez aussi saisir la CNIL (cnil.fr).',
        ],
      },
      {
        title: '8. Contact',
        body: [`Pour toute question sur vos données : ${CONTACT}`],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: `Last updated: ${UPDATED.en}`,
    intro:
      'Ziggy is a learning platform for children aged 5 to 12. We collect the bare minimum, sell no data and show no advertising.',
    sections: [
      {
        title: '1. Who creates the account',
        body: [
          'Accounts are created and managed by a parent or legal guardian, using their own email address. A child never creates an account alone. Children can also play without an account, in which case their stars stay on the device only.',
        ],
      },
      {
        title: '2. What we keep',
        body: [
          [
            'For the parent: the email address and password (stored hashed; we can never read it).',
            'For the child: first name, age range (5-7, 8-10 or 11-12) and chosen avatar.',
            'Game results: the game, score, stars and date.',
          ],
          'We never ask for a surname, photo, date of birth, address or phone number.',
        ],
      },
      {
        title: '3. Conversations with Ziggy',
        body: [
          'When a child writes to Ziggy, the message is sent to an AI provider (currently Google Gemini) solely to produce the reply. We do not store these conversations. Please remind children never to type personal information in the chat.',
        ],
      },
      {
        title: '4. Where data lives',
        body: [
          [
            'Accounts and results: Supabase, servers in Paris (European Union).',
            'Website hosting: Vercel.',
            'Chat replies: Google (Gemini API).',
          ],
          'These providers process data on our behalf only. Traffic to the site is encrypted (HTTPS).',
        ],
      },
      {
        title: '5. Cookies and local storage',
        body: [
          'No advertising or tracking cookies. The browser only keeps what the site needs to work: your sign-in session, light or dark theme, sound setting, language, your cookie choice and, for guests, the stars they have won.',
        ],
      },
      {
        title: '6. How long we keep data',
        body: ['Data is kept for as long as the account exists and is permanently erased when the account is deleted.'],
      },
      {
        title: '7. Your rights',
        body: [
          'You can access, correct or delete your data at any time. Deleting the whole account takes one click in the parent area ("My account"). For anything else, write to us. You may also contact your data protection authority.',
        ],
      },
      {
        title: '8. Contact',
        body: [`For any question about your data: ${CONTACT}`],
      },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = CONTENT[locale === 'fr' ? 'fr' : 'en'];
  return { title: `${c.title} — Ziggy`, description: c.intro };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
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
