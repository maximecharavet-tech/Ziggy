import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';

/**
 * Written from what the product actually does today — keep it in step with
 * the code. The only payment is L'appli du Père Noël (section 3 bis, Stripe
 * Checkout, src/app/api/santa/); the plans on the pricing section are not
 * wired to any checkout. French for the French site, English elsewhere.
 * Document à faire valider par un juriste avant tout lancement commercial
 * (identité complète de l'éditeur : siège, RCS, directeur de publication ;
 * conditions de vente et droit de rétractation le jour où un paiement existe).
 */

const CONTACT = 'contact@ziggy-ai.fr';
const UPDATED = { fr: '8 novembre 2026', en: '8 November 2026' };

type Section = { title: string; body: (string | string[])[]; /** Anchor (e.g. #pere-noel, linked from the Stripe payment page). */ id?: string };

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
          'Ziggy, édité par Ziggy Technologies SAS, est une plateforme d’apprentissage ludique pour les enfants de 4 à 12 ans : jeux et exercices (intelligence artificielle, maths, logique, mémoire, créativité), conversations avec Ziggy et ses agents, aventures Ziggy World (quêtes, histoires, avatars), labo IA, coloriage, création musicale et mode dodo (histoires du soir).',
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
          'Ziggy est aujourd’hui gratuit. Seule exception : L’appli du Père Noël propose deux packs payants, décrits à la section 3 bis. Les offres présentées sur la page Tarifs (Famille, École, sur mesure) sont en préparation : aucun paiement n’est demandé ni collecté pour elles.',
          'Avant toute offre payante, ses prix, sa durée, ses conditions de résiliation et votre droit de rétractation vous seront présentés clairement, et rien ne vous sera facturé sans votre accord exprès.',
        ],
      },
      {
        id: 'pere-noel',
        title: '3 bis. L’appli du Père Noël : conditions de vente',
        body: [
          'L’appli du Père Noël (lettre, message vocal, photo et appels avec le Père Noël) a une partie gratuite. Ziggy Technologies SAS y vend aussi deux packs, prix TTC :',
          [
            'Pack Noël — 4,99 € : photos avec le Père Noël illimitées, en HD, et vidéo ; appels guidés (3 histoires) illimités ; jusqu’à 3 enfants.',
            'Pack magique — 9,99 € : tout le Pack Noël, plus 20 minutes au total d’appel en direct avec un Père Noël joué par une intelligence artificielle (activé par le parent sur l’appareil, après avoir lu ce qu’il fait). Avec un Pack Noël déjà acheté, le passage au Pack magique coûte la différence, 5,00 €.',
          ],
          'C’est un paiement unique, sans abonnement ni renouvellement. Le pack est valable jusqu’au 31 janvier 2027 inclus. Il est acheté par un parent majeur, derrière une question réservée aux grands ; aucun compte n’est nécessaire. Le paiement est traité par Stripe : nous ne voyons jamais vos données bancaires, et Stripe vous envoie le reçu.',
          'Contenu numérique fourni immédiatement : le pack s’active dès que le paiement est confirmé. En validant la commande, vous demandez cette exécution immédiate et renoncez expressément à votre droit de rétractation de 14 jours (article L221-28 13° du Code de la consommation). Cette renonciation vous est présentée sur la page de paiement et doit y être acceptée.',
          'Le pass est gardé dans un cookie sécurisé de votre navigateur. Gardez le lien affiché après le paiement (page « C’est prêt ! ») : il permet de retrouver le pass sur un autre appareil. Ne le partagez pas en dehors de la famille. Les 20 minutes d’appel en direct sont un total pour le pack, tous enfants et appareils confondus.',
          `Un souci (un pack qui ne s’active pas, une fonction qui ne marche pas comme décrit) ? Écrivez-nous à ${CONTACT} avec le lien reçu après le paiement : nous corrigerons le problème ou vous rembourserons. Vos garanties légales de conformité des contenus numériques (articles L224-25-1 et suivants du Code de la consommation) restent entières.`,
        ],
      },
      {
        title: '4. La sécurité des enfants',
        body: [
          [
            'Aucune messagerie entre utilisateurs : un enfant ne peut jamais échanger avec un autre enfant ou un inconnu sur Ziggy.',
            'Dans Ziggy World, l’enfant n’écrit jamais de texte libre pour l’IA : il choisit parmi des options prédéfinies. Chaque contenu créé par IA est vérifié par notre filtre ChildShield ; en cas de doute, un contenu écrit par l’équipe Ziggy est affiché à la place.',
            'Dans le chat avec Ziggy, un filtre de sécurité vérifie chaque message : les adresses, numéros de téléphone, e-mails et mots de passe ne sont jamais transmis à l’IA, les liens et coordonnées sont retirés des réponses, et certains sujets invitent l’enfant à en parler à un adulte de confiance.',
            'Aucune publicité, aucun achat par l’enfant (les packs de l’appli du Père Noël s’achètent par un parent, derrière une question réservée aux grands, et jamais dans l’application mobile), et un rappel invite l’enfant à faire une pause après un moment d’écran.',
          ],
          'Ces protections réduisent fortement les risques sans pouvoir les supprimer totalement. Nous recommandons qu’un adulte reste disponible quand l’enfant utilise Ziggy, surtout pour les plus jeunes.',
        ],
      },
      {
        title: '5. Les contenus créés par intelligence artificielle',
        body: [
          'Une partie des réponses, quêtes, histoires, voix et images de Ziggy est produite par des services d’intelligence artificielle (actuellement Google Gemini, DeepSeek, NVIDIA et Agnes AI ; Anthropic pour l’appel en direct du Pack magique). Dans Ziggy World, chaque contenu créé par IA est signalé comme tel, et le Père Noël de l’appel en direct est présenté au parent comme une IA.',
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
          'Ziggy, published by Ziggy Technologies SAS, is a playful learning platform for children aged 4 to 12: games and exercises (artificial intelligence, maths, logic, memory, creativity), conversations with Ziggy and its agents, Ziggy World adventures (quests, stories, avatars), the AI lab, colouring, music making and bedtime mode (bedtime stories).',
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
          'Ziggy is currently free. The one exception: Santa’s app offers two paid packs, described in section 3a. The plans shown on the Pricing section (Family, School, custom) are in preparation: no payment is requested or collected for them.',
          'Before any paid plan, its price, duration, cancellation terms and your right of withdrawal will be presented clearly, and nothing will be charged without your express agreement.',
        ],
      },
      {
        id: 'pere-noel',
        title: '3a. Santa’s app: terms of sale',
        body: [
          'Santa’s app (letter, voice message, photo and calls with Santa) has a free part. Ziggy Technologies SAS also sells two packs there, prices including VAT:',
          [
            'Christmas Pack — €4.99: unlimited photos with Santa, in HD, and video; unlimited guided calls (3 stories); up to 3 children.',
            'Magic Pack — €9.99: everything in the Christmas Pack, plus 20 minutes in total of live call with a Santa played by an artificial intelligence (switched on by the parent on the device, after reading what it does). With a Christmas Pack already bought, the upgrade to the Magic Pack costs the difference, €5.00.',
          ],
          'It is a one-time payment, with no subscription or renewal. The pack is valid until 31 January 2027 inclusive. It is bought by a parent of age, behind a question for grown-ups; no account is needed. Payment is processed by Stripe: we never see your bank details, and Stripe sends you the receipt.',
          'Digital content supplied immediately: the pack switches on as soon as the payment is confirmed. By placing the order, you ask for this immediate supply and expressly waive your 14-day right of withdrawal (French Consumer Code, article L221-28 13°). This waiver is shown on the payment page and must be accepted there.',
          'The pass is kept in a secure cookie in your browser. Keep the link shown after payment (the “It’s ready!” page): it restores the pass on another device. Don’t share it outside the family. The 20 minutes of live call are a total for the pack, across all children and devices.',
          `A problem (a pack that doesn’t switch on, a feature that doesn’t work as described)? Write to ${CONTACT} with the link you got after paying: we will fix it or refund you. Your legal conformity guarantees for digital content (French Consumer Code, articles L224-25-1 and following) remain in full.`,
        ],
      },
      {
        title: '4. Children’s safety',
        body: [
          [
            'No messaging between users: a child can never exchange messages with another child or a stranger on Ziggy.',
            'In Ziggy World, children never type free text for the AI: they pick from predefined options. Every AI-made item is checked by our ChildShield filter; if in doubt, content written by the Ziggy team is shown instead.',
            'In the chat with Ziggy, a safety filter checks every message: addresses, phone numbers, emails and passwords are never passed to the AI, links and contact details are removed from replies, and some topics prompt the child to talk to a trusted adult.',
            'No advertising, no purchase by a child (Santa’s app packs are bought by a parent, behind a question for grown-ups, and never inside the mobile app), and a reminder suggests a break after a while on screen.',
          ],
          'These safeguards greatly reduce risks but cannot remove them entirely. We recommend that an adult stays available while a child uses Ziggy, especially the youngest.',
        ],
      },
      {
        title: '5. AI-generated content',
        body: [
          'Some of Ziggy’s replies, quests, stories, voices and images are produced by artificial intelligence services (currently Google Gemini, DeepSeek, NVIDIA and Agnes AI; Anthropic for the Magic Pack’s live call). In Ziggy World, every AI-made item is labelled as such, and the live-call Santa is presented to the parent as an AI.',
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
            <section key={s.title} id={s.id} className={s.id ? 'scroll-mt-28' : undefined}>
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
