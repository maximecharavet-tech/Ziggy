import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';

/**
 * Written from what the product actually does today — keep it in step with
 * the code (no payment is taken: the paid plans on the pricing section are
 * not wired to any checkout). French for the French site, English elsewhere.
 * Document à faire valider par un juriste avant tout lancement commercial
 * (identité complète de l'éditeur : siège, RCS, directeur de publication ;
 * conditions de vente et droit de rétractation le jour où un paiement existe).
 */

const CONTACT = 'contact@ziggy-ai.fr';
const UPDATED = { fr: '26 octobre 2026', en: '26 October 2026' };

type Section = { title: string; body: (string | string[])[] };

const CONTENT: Record<'fr' | 'en', { title: string; updated: string; intro: string; sections: Section[] }> = {
  fr: {
    title: 'Conditions d’utilisation',
    updated: `Dernière mise à jour : ${UPDATED.fr}`,
    intro:
      'Ces conditions expliquent ce que propose Ziggy, ce que nous attendons de chacun et comment nous protégeons les enfants. En utilisant Ziggy, vous les acceptez.',
    sections: [
      {
        title: '1. Le service',
        body: [
          'Ziggy, édité par Ziggy Technologies SAS, est une plateforme d’apprentissage ludique pour les enfants de 5 à 12 ans : jeux et exercices (intelligence artificielle, maths, logique, mémoire, créativité), conversations avec Ziggy et ses agents, aventures Ziggy World (quêtes, histoires, avatars), labo IA, coloriage, création musicale et mode dodo (histoires du soir).',
          'On peut utiliser Ziggy sans compte : la progression reste alors uniquement sur l’appareil. Certaines fonctions, comme les contenus créés par IA dans Ziggy World ou la sauvegarde de la progression, nécessitent un compte parent.',
        ],
      },
      {
        title: '2. Le compte parent',
        body: [
          'Le compte est créé par un parent ou un responsable légal majeur, avec sa propre adresse e-mail. L’enfant ne crée jamais de compte seul. Le parent y ajoute les profils de ses enfants (prénom, tranche d’âge, avatar), accepte ces conditions en leur nom et les accompagne dans leur utilisation.',
          'Vous êtes responsable de la confidentialité de votre mot de passe. Vous pouvez supprimer votre compte à tout moment, en un clic, depuis l’espace parent (« Mon compte ») : toutes les données associées sont alors effacées.',
        ],
      },
      {
        title: '3. Gratuité et offres à venir',
        body: [
          'Ziggy est aujourd’hui entièrement gratuit. Les offres présentées sur la page Tarifs (Famille, École, sur mesure) sont en préparation : aucun paiement n’est demandé ni collecté pour le moment.',
          'Avant toute offre payante, ses prix, sa durée, ses conditions de résiliation et votre droit de rétractation vous seront présentés clairement, et rien ne vous sera facturé sans votre accord exprès.',
        ],
      },
      {
        title: '4. La sécurité des enfants',
        body: [
          [
            'Aucune messagerie entre utilisateurs : un enfant ne peut jamais échanger avec un autre enfant ou un inconnu sur Ziggy.',
            'Dans Ziggy World, l’enfant n’écrit jamais de texte libre pour l’IA : il choisit parmi des options prédéfinies. Chaque contenu créé par IA est vérifié par notre filtre ChildShield ; en cas de doute, un contenu écrit par l’équipe Ziggy est affiché à la place.',
            'Dans le chat avec Ziggy, un filtre de sécurité vérifie chaque message : les adresses, numéros de téléphone, e-mails et mots de passe ne sont jamais transmis à l’IA, les liens et coordonnées sont retirés des réponses, et certains sujets invitent l’enfant à en parler à un adulte de confiance.',
            'Aucune publicité, aucun achat intégré, et un rappel invite l’enfant à faire une pause après un moment d’écran.',
          ],
          'Ces protections réduisent fortement les risques sans pouvoir les supprimer totalement. Nous recommandons qu’un adulte reste disponible quand l’enfant utilise Ziggy, surtout pour les plus jeunes.',
        ],
      },
      {
        title: '5. Les contenus créés par intelligence artificielle',
        body: [
          'Une partie des réponses, quêtes, histoires, voix et images de Ziggy est produite par des services d’intelligence artificielle (actuellement Google Gemini, DeepSeek, NVIDIA et Agnes AI). Dans Ziggy World, chaque contenu créé par IA est signalé comme tel.',
          'Une IA peut se tromper : ses réponses peuvent être inexactes ou incomplètes. Elles ne remplacent ni un enseignant, ni un professionnel de santé, ni l’avis d’un adulte. Si un contenu vous semble inapproprié, écrivez-nous : nous le corrigerons.',
        ],
      },
      {
        title: '6. Utilisation acceptable',
        body: [
          'Ziggy est destiné à un usage personnel, familial et éducatif. Il est interdit :',
          [
            'de chercher à contourner les filtres de sécurité ou à faire produire à l’IA des contenus inappropriés ;',
            'd’utiliser des robots, du scraping ou des requêtes automatisées, ou de surcharger le service ;',
            'de saisir des informations personnelles sur une autre personne ;',
            'de proposer une photo pour créer un avatar sans être le parent ou le responsable légal de l’enfant représenté ;',
            'de revendre ou d’exploiter commercialement le service ou ses contenus.',
          ],
          'En cas de manquement, nous pouvons limiter ou suspendre l’accès au service.',
        ],
      },
      {
        title: '7. Propriété intellectuelle',
        body: [
          'Le nom Ziggy, les personnages, textes, jeux, illustrations, sons et le code du site sont protégés. Nous vous accordons un droit d’utilisation personnel et non exclusif, pour la durée de votre utilisation du service.',
          'Les créations de l’enfant (dessins, chansons) lui appartiennent. Elles sont gardées sur l’appareil et ne sont pas publiées.',
        ],
      },
      {
        title: '8. Disponibilité et responsabilité',
        body: [
          'Ziggy évolue régulièrement et peut être interrompu, notamment pour maintenance. Nous faisons de notre mieux pour qu’il fonctionne bien, sans pouvoir garantir une disponibilité permanente. Les données gardées seulement sur l’appareil (progression d’un invité, dessins, chansons) peuvent être perdues si les données du navigateur sont effacées.',
          'Ziggy est un complément éducatif : il ne remplace ni l’école ni l’accompagnement des parents, et nous ne garantissons pas de résultat scolaire. Rien dans ces conditions ne limite les droits que la loi vous accorde, notamment en tant que consommateur.',
        ],
      },
      {
        title: '9. Données personnelles et cookies',
        body: [
          'La façon dont nous traitons les données est décrite dans la Politique de confidentialité, et ce que le site garde dans votre navigateur dans la Politique de cookies. Les comptes sont hébergés chez Supabase, sur des serveurs situés dans l’Union européenne, et le site chez Vercel.',
        ],
      },
      {
        title: '10. Modification des conditions',
        body: [
          'Nous pouvons faire évoluer ces conditions, par exemple quand une nouvelle fonction apparaît. La date de mise à jour figure en haut de cette page ; en cas de changement important, les titulaires d’un compte en seront informés.',
        ],
      },
      {
        title: '11. Droit applicable',
        body: [
          'Ces conditions sont soumises au droit français. En cas de désaccord, écrivez-nous d’abord : nous chercherons une solution amiable. À défaut, le litige sera porté devant les tribunaux compétents selon les règles de droit commun.',
        ],
      },
      {
        title: '12. Contact',
        body: [`Pour toute question : ${CONTACT}`],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    updated: `Last updated: ${UPDATED.en}`,
    intro:
      'These terms explain what Ziggy offers, what we expect from everyone and how we protect children. By using Ziggy, you accept them.',
    sections: [
      {
        title: '1. The service',
        body: [
          'Ziggy, published by Ziggy Technologies SAS, is a playful learning platform for children aged 5 to 12: games and exercises (artificial intelligence, maths, logic, memory, creativity), conversations with Ziggy and its agents, Ziggy World adventures (quests, stories, avatars), the AI lab, colouring, music making and bedtime mode (bedtime stories).',
          'Ziggy can be used without an account, in which case progress stays on the device only. Some features, such as AI-made content in Ziggy World or saving progress, require a parent account.',
        ],
      },
      {
        title: '2. The parent account',
        body: [
          'Accounts are created by a parent or legal guardian of age, using their own email address. A child never creates an account alone. The parent adds their children’s profiles (first name, age range, avatar), accepts these terms on their behalf and supports them in using Ziggy.',
          'You are responsible for keeping your password confidential. You can delete your account at any time, in one click, from the parent area (“My account”): all associated data is then erased.',
        ],
      },
      {
        title: '3. Free use and upcoming plans',
        body: [
          'Ziggy is currently entirely free. The plans shown on the Pricing section (Family, School, custom) are in preparation: no payment is requested or collected at this time.',
          'Before any paid plan, its price, duration, cancellation terms and your right of withdrawal will be presented clearly, and nothing will be charged without your express agreement.',
        ],
      },
      {
        title: '4. Children’s safety',
        body: [
          [
            'No messaging between users: a child can never exchange messages with another child or a stranger on Ziggy.',
            'In Ziggy World, children never type free text for the AI: they pick from predefined options. Every AI-made item is checked by our ChildShield filter; if in doubt, content written by the Ziggy team is shown instead.',
            'In the chat with Ziggy, a safety filter checks every message: addresses, phone numbers, emails and passwords are never passed to the AI, links and contact details are removed from replies, and some topics prompt the child to talk to a trusted adult.',
            'No advertising, no in-app purchases, and a reminder suggests a break after a while on screen.',
          ],
          'These safeguards greatly reduce risks but cannot remove them entirely. We recommend that an adult stays available while a child uses Ziggy, especially the youngest.',
        ],
      },
      {
        title: '5. AI-generated content',
        body: [
          'Some of Ziggy’s replies, quests, stories, voices and images are produced by artificial intelligence services (currently Google Gemini, DeepSeek, NVIDIA and Agnes AI). In Ziggy World, every AI-made item is labelled as such.',
          'AI can make mistakes: its answers may be inaccurate or incomplete. They do not replace a teacher, a health professional or an adult’s advice. If any content seems inappropriate, write to us and we will fix it.',
        ],
      },
      {
        title: '6. Acceptable use',
        body: [
          'Ziggy is meant for personal, family and educational use. You may not:',
          [
            'try to bypass the safety filters or get the AI to produce inappropriate content;',
            'use bots, scraping or automated requests, or overload the service;',
            'enter personal information about another person;',
            'submit a photo to create an avatar unless you are the parent or legal guardian of the child shown;',
            'resell or commercially exploit the service or its content.',
          ],
          'If these rules are broken, we may restrict or suspend access to the service.',
        ],
      },
      {
        title: '7. Intellectual property',
        body: [
          'The Ziggy name, characters, texts, games, illustrations, sounds and the site’s code are protected. We grant you a personal, non-exclusive right to use them for as long as you use the service.',
          'The child’s creations (drawings, songs) belong to them. They are kept on the device and are not published.',
        ],
      },
      {
        title: '8. Availability and liability',
        body: [
          'Ziggy evolves regularly and may be interrupted, for example for maintenance. We do our best to keep it running well but cannot guarantee permanent availability. Data kept only on the device (a guest’s progress, drawings, songs) may be lost if the browser data is cleared.',
          'Ziggy is an educational supplement: it replaces neither school nor parental support, and we do not guarantee any learning outcome. Nothing in these terms limits the rights the law gives you, in particular as a consumer.',
        ],
      },
      {
        title: '9. Personal data and cookies',
        body: [
          'How we handle data is described in the Privacy Policy, and what the site keeps in your browser in the Cookie Policy. Accounts are hosted by Supabase, on servers located in the European Union, and the site by Vercel.',
        ],
      },
      {
        title: '10. Changes to these terms',
        body: [
          'We may update these terms, for example when a new feature arrives. The date of the latest update is shown at the top of this page; account holders will be informed of any significant change.',
        ],
      },
      {
        title: '11. Governing law',
        body: [
          'These terms are governed by French law. If there is a disagreement, please write to us first and we will look for an amicable solution. Failing that, the dispute will be brought before the competent courts under the ordinary rules.',
        ],
      },
      {
        title: '12. Contact',
        body: [`Any question: ${CONTACT}`],
      },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = CONTENT[locale === 'fr' ? 'fr' : 'en'];
  return { title: `${c.title} — Ziggy`, description: c.intro, alternates: alternatesFor(locale, '/terms') };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
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
