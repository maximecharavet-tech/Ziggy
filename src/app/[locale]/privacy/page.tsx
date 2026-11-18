import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';

/**
 * Written from what the product actually does today — keep it in step with
 * the code (providers: src/lib/ai.ts, src/lib/santa/santa-ai.ts,
 * src/lib/tts-gemini.ts, src/lib/hyper-engine/providers/, src/lib/safety/child-shield.ts).
 * States facts only: no contractual guarantee, certification, data location or
 * no-training promise that the repo can't show. French for the French site,
 * English everywhere else. Have it reviewed by a lawyer before a commercial launch.
 */

const CONTACT = 'contact@ziggy-ai.fr';
const UPDATED = { fr: '18 novembre 2026', en: '18 November 2026' };

type Section = { title: string; body: (string | string[])[]; /** Anchor (e.g. #pere-noel). */ id?: string };

const CONTENT: Record<'fr' | 'en', { title: string; updated: string; intro: string; sections: Section[] }> = {
  fr: {
    title: 'Politique de confidentialité',
    updated: `Dernière mise à jour : ${UPDATED.fr}`,
    intro:
      'Ziggy est une plateforme d’apprentissage pour les enfants de 4 à 12 ans. Nous collectons le strict minimum, nous ne vendons aucune donnée et nous n’affichons aucune publicité. Cette page dit, fonction par fonction, ce qui reste sur votre appareil, ce que nous conservons et ce qui est envoyé à quel prestataire.',
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
            'Ziggy World : la progression (quêtes, étoiles, XP, niveau de jeu par compétence), les avatars créés (l’image et les choix de dessin : couleur des cheveux, de la peau, des yeux, lunettes, tenue…), les histoires gardées, les consentements parentaux, un journal technique des générations IA (type, statut, coût estimé — jamais le contenu) et la catégorie des contenus bloqués par notre filtre (jamais le texte).',
          ],
          'Nous ne demandons ni nom de famille, ni date de naissance, ni adresse, ni téléphone. Nous ne recevons et ne conservons jamais de photo d’enfant (voir « Ziggy World »).',
        ],
      },
      {
        title: '3. Les conversations avec Ziggy et ses amis',
        body: [
          'Sur les pages de discussion (Ziggy et ses amis spécialistes), l’enfant n’écrit rien : il touche une question parmi une liste écrite par l’équipe Ziggy. Notre serveur envoie le texte de cette question (et, pour « Dis-m’en plus », la question et la réponse précédentes) au fournisseur d’intelligence artificielle, uniquement pour produire la réponse. Rien de ce que l’enfant pourrait taper n’est envoyé.',
          'Écrire librement (clavier, micro, appel vocal) est réservé au parent, derrière une question pour les grands. Ce que le parent écrit est envoyé de la même façon, après le retrait des prénoms connus de l’appareil ; un message contenant une adresse, un numéro de téléphone, un e-mail ou un mot de passe n’est pas envoyé du tout.',
          'Le fournisseur : le premier disponible répond, dans cet ordre : Google (Gemini API), puis DeepSeek, NVIDIA, Groq et Anthropic en secours ; seuls ceux que nous avons activés sur notre serveur sont utilisés.',
          'Chaque réponse est nettoyée (liens, e-mails et numéros retirés), puis vérifiée par notre filtre ChildShield : nos propres règles d’abord, puis, quand il est activé, un modèle de sécurité de NVIDIA, à qui seul le texte de la réponse est envoyé. Une réponse refusée est remplacée par un message écrit par l’équipe. Nous n’enregistrons pas ces conversations.',
          'La voix de Ziggy : quand une phrase est lue à voix haute, son texte est envoyé à Google (Gemini API, synthèse vocale) pour produire le son ; nous ne gardons que quelques sons récents en mémoire, pour ne pas les refaire. Une phrase qui contient le prénom de l’enfant, un nom tapé ou des coordonnées est lue par la voix de l’appareil et n’est pas envoyée. Le micro (mode parent) n’utilise que la reconnaissance vocale faite sur l’appareil : la voix n’est jamais envoyée, et sans cette possibilité le bouton micro n’apparaît pas. La lecture automatique se coupe d’un clic dans le chat.',
        ],
      },
      {
        title: '3 bis. Ziggy World : avatars, photos et contenus créés par IA',
        body: [
          'Les enfants n’écrivent jamais de texte libre pour l’IA : ils choisissent parmi des options prédéfinies. Pour les quêtes, histoires et questions générées par IA, notre serveur envoie à DeepSeek (NVIDIA en secours) ces choix, la langue et la tranche d’âge. Le résultat est vérifié par un schéma strict puis par notre filtre ChildShield (qui peut envoyer le texte produit au modèle de sécurité de NVIDIA) ; en cas de doute, un contenu écrit par l’équipe Ziggy est affiché à la place. Ces générations nécessitent un compte parent.',
          'Avatar depuis une photo — uniquement à l’initiative du parent, derrière une question pour les grands et avec son accord explicite (enregistré sur le compte quand il est connecté) : la photo est lue sur l’appareil, dans le navigateur, par un logiciel de reconnaissance d’image (MediaPipe) servi par notre site. Il repère la couleur des cheveux et leur longueur, la couleur de la peau et des yeux, un foulard ou des lunettes. La photo n’est jamais envoyée, ni à notre serveur, ni à un prestataire, et elle est effacée de la page dès la lecture terminée. Ce qui n’est pas assez visible, ainsi que la coiffure et les taches de rousseur, est choisi à la main. Chaque choix reste modifiable.',
          'L’image de l’avatar est créée par Agnes AI à partir de ces seuls choix en texte (cheveux, peau, yeux, lunettes, tenue, style, décor), puis rangée avec ces choix dans un espace privé du compte, chez Supabase. Le parent peut retirer son consentement et supprimer les avatars, les histoires, la progression et l’historique IA à tout moment depuis l’Espace parents.',
        ],
      },
      {
        id: 'pere-noel',
        title: '3 ter. L’appli du Père Noël',
        body: [
          'Sur l’appareil uniquement : les prénoms, âges, listes de cadeaux, moments de fierté, signatures, dessins, photos et vidéos restent dans le navigateur. Nous ne les recevons pas, sauf ce que décrit le paragraphe sur l’appel en direct. Le montage de la photo avec le Père Noël se fait sur l’appareil : l’image de l’enfant ne le quitte pas. Le parent peut tout effacer d’un clic dans l’espace parents de l’appli.',
          'Le prénom : il n’est jamais envoyé à un prestataire. Pour les prénoms les plus courants, le Père Noël a été enregistré à l’avance : l’appareil télécharge depuis notre site le fichier audio de ce prénom (l’adresse du fichier contient le prénom, comme l’adresse de toute page passe par notre hébergeur). Pour les autres prénoms, le Père Noël salue l’enfant sans le nommer.',
          'La reconnaissance de la voix : elle se fait sur l’appareil. Si le navigateur ne sait pas le faire lui-même, l’appareil télécharge un modèle de reconnaissance vocale (Whisper) depuis Hugging Face, un site public d’hébergement de modèles ; aucun son n’y est envoyé.',
          'L’appel en direct (Pack magique, uniquement si le parent l’active sur l’appareil) : la voix de l’enfant est transcrite en texte sur l’appareil et n’est jamais envoyée. Notre serveur reçoit le texte de chaque phrase et des dernières phrases de l’échange, le prénom et les noms connus étant remplacés par un blanc sur l’appareil puis à nouveau sur le serveur, ainsi que l’âge de l’enfant et les cadeaux choisis dans sa liste. Il les envoie au fournisseur d’IA pour produire la réponse du Père Noël : DeepSeek, puis NVIDIA ou Mistral en secours. Chaque réponse passe par notre filtre ChildShield (qui peut envoyer le texte de la réponse au modèle de sécurité de NVIDIA), puis la réponse, et elle seule, est mise en voix par Google (Gemini API). Au début de l’appel en direct, le Père Noël dit à l’enfant que ses réponses sont créées par une IA, et c’est écrit à l’écran. Nous ne conservons ni les phrases ni les réponses. Seul un compteur de minutes est gardé chez Supabase, sous une clé pseudonyme (une empreinte cryptographique du pass) qui ne contient ni nom ni e-mail.',
          'Le paiement : il est traité par Stripe, qui reçoit l’adresse e-mail et les données de paiement du parent pour le paiement, le reçu et la lutte contre la fraude, et les conserve selon ses propres obligations légales. Nous ne voyons jamais les données bancaires. La preuve d’achat est gardée dans un cookie sécurisé de votre navigateur (« santa_pass » : le numéro de la session de paiement et le pack, signés, jusqu’au 31 janvier 2027).',
          'Aucun pistage : pas de pixel publicitaire (TikTok ou autre) ni de suivi des achats ; nous mesurons une campagne seulement par son lien et par le nombre de ventes chez Stripe.',
        ],
      },
      {
        id: 'lutins',
        title: '3 quater. Les Lutins Farceurs',
        body: [
          'Le parent photographie une pièce de la maison (jamais une personne) pour y faire apparaître les lutins. Avant tout envoi, le téléphone vérifie lui-même qu’aucune personne n’est visible sur la photo : si quelqu’un apparaît, la photo est refusée et ne part pas. Aucune image d’enfant n’est donc envoyée.',
          'La photo est recalculée sur l’appareil (les données du téléphone comme le lieu et la date sont retirées), envoyée à notre serveur puis à notre fournisseur d’images Agnes AI uniquement pour produire l’image de la farce, avec la description de la farce choisie ou écrite par le parent (vérifiée par notre filtre ChildShield). Si le parent demande une petite vidéo, l’image de la farce est envoyée à Agnes AI pour l’animer. Nous ne conservons ni la photo, ni la description, ni l’image ou la vidéo produites.',
          'Le journal des lutins (images, vidéos, légendes) reste sur l’appareil. Pour l’usage gratuit équitable, un identifiant aléatoire de l’appareil et l’adresse IP sont comptés en mémoire pendant la journée, puis oubliés.',
        ],
      },
      {
        title: '4. Nos prestataires et ce qu’ils reçoivent',
        body: [
          [
            'Vercel : hébergement du site et de notre serveur (toutes les pages et requêtes passent par lui, avec l’adresse IP), et mesure d’audience sans cookie (Vercel Web Analytics et Speed Insights, voir la Politique de cookies).',
            'Supabase : comptes, profils, résultats, données de Ziggy World, images des avatars et compteur de minutes du Père Noël.',
            'Google (Gemini API) : réponses du chat (en premier) et toutes les voix produites par serveur (Ziggy, Père Noël), à partir de texte seulement.',
            'DeepSeek : textes de Ziggy World, réponses de l’appel en direct du Père Noël (en premier) et réponses du chat en secours.',
            'NVIDIA : modèle de sécurité de ChildShield (texte des réponses de l’IA) et fournisseur de secours pour le chat, Ziggy World et l’appel en direct.',
            'Mistral : secours de l’appel en direct du Père Noël.',
            'Groq et Anthropic : secours du chat, s’ils sont activés sur notre serveur.',
            'Agnes AI : images des avatars (à partir de texte seulement), images et vidéos des Lutins Farceurs (photo d’une pièce sans personne).',
            'Stripe : paiement des packs du Père Noël.',
            'Hugging Face : téléchargement, par l’appareil, du modèle de reconnaissance vocale du Père Noël (aucune donnée envoyée).',
          ],
          'Nous n’envoyons à chacun que ce qui est décrit sur cette page, au moment où la fonction est utilisée. Plusieurs de ces prestataires sont établis hors de l’Union européenne : les données qu’ils reçoivent peuvent donc être traitées hors de l’UE. Les échanges avec le site sont chiffrés (HTTPS).',
        ],
      },
      {
        title: '5. Cookies et stockage local',
        body: [
          'Aucun cookie publicitaire ni de pistage. Le navigateur garde seulement ce qui est nécessaire au fonctionnement : la session de connexion, le thème clair ou sombre, le réglage du son, la langue, votre choix concernant les cookies, pour les invités les étoiles gagnées et, pour l’appli du Père Noël, le pass acheté (cookie « santa_pass ») et les données de la famille gardées sur l’appareil. Le détail est dans la Politique de cookies.',
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
      'Ziggy is a learning platform for children aged 4 to 12. We collect the bare minimum, sell no data and show no advertising. This page says, feature by feature, what stays on your device, what we keep and what is sent to which provider.',
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
            'Ziggy World: adventure progress (quests, stars, XP, game level per skill), avatars created (the picture and the drawing choices: hair, skin and eye colour, glasses, outfit…), saved stories, parental consents, a technical log of AI generations (type, status, estimated cost — never the content) and the category of content our filter blocked (never the text).',
          ],
          'We never ask for a surname, date of birth, address or phone number. We never receive or keep a photo of a child (see “Ziggy World”).',
        ],
      },
      {
        title: '3. Conversations with Ziggy and friends',
        body: [
          'On the chat pages (Ziggy and his specialist friends), the child types nothing: they tap a question from a list written by the Ziggy team. Our server sends the text of that question (and, for “Tell me more”, the previous question and answer) to the AI provider, solely to produce the reply. Nothing a child could type is sent.',
          'Typing freely (keyboard, microphone, voice call) is for parents only, behind a question for grown-ups. What the parent types is sent the same way, after first names known to the device are removed; a message containing an address, phone number, email or password is not sent at all.',
          'The provider: the first one available answers, in this order: Google (Gemini API), then DeepSeek, NVIDIA, Groq and Anthropic as fallbacks; only those we have switched on on our server are used.',
          'Every reply is cleaned (links, emails and numbers removed), then checked by our ChildShield filter: our own rules first, then, when it is switched on, a NVIDIA safety model, which receives only the text of the reply. A refused reply is replaced by a message written by the team. We do not store these conversations.',
          'Ziggy’s voice: when a sentence is read aloud, its text is sent to Google (Gemini API, text-to-speech) to produce the audio; we only keep a few recent sounds in memory so as not to make them again. A sentence containing the child’s first name, a typed name or contact details is read by the device’s own voice and is not sent. The microphone (parent mode) only uses speech recognition done on the device: the voice is never sent, and without it the microphone button does not appear. Auto-read can be switched off with one tap in the chat.',
        ],
      },
      {
        title: '3a. Ziggy World: avatars, photos and AI-made content',
        body: [
          'Children never type free text for the AI: they pick from predefined options. For AI-made quests, stories and questions, our server sends DeepSeek (NVIDIA as a fallback) those choices, the language and the age range. The result is checked against a strict schema and then by our ChildShield filter (which may send the generated text to NVIDIA’s safety model); if in doubt, content written by the Ziggy team is shown instead. These generations require a parent account.',
          'Avatar from a photo — only at the parent’s initiative, behind a question for grown-ups and with their explicit agreement (recorded on the account when signed in): the photo is read on the device, in the browser, by image-recognition software (MediaPipe) served by our site. It picks out hair colour and length, skin and eye colour, a headscarf or glasses. The photo is never sent, neither to our server nor to any provider, and it is wiped from the page as soon as it has been read. Anything not visible enough, as well as the hairstyle and freckles, is picked by hand. Every choice stays editable.',
          'The avatar picture is created by Agnes AI from those text choices only (hair, skin, eyes, glasses, outfit, style, background), then kept with those choices in the account’s private storage, at Supabase. Parents can withdraw consent and delete avatars, stories, progress and AI history at any time from the Parents’ area.',
        ],
      },
      {
        id: 'pere-noel',
        title: '3b. Santa’s app',
        body: [
          'On the device only: first names, ages, wish lists, proud moments, signatures, drawings, photos and videos stay in the browser. We do not receive them, except as described in the paragraph on the live call. The photo with Santa is put together on the device: the child’s picture never leaves it. Parents can erase everything in one tap in the app’s parents’ area.',
          'The first name: it is never sent to any provider. For the most common first names, Santa was recorded in advance: the device downloads the audio file for that name from our site (the file’s address contains the name, just as every page address goes through our host). For other names, Santa greets the child without naming them.',
          'Speech recognition: it happens on the device. If the browser cannot do it itself, the device downloads a speech-recognition model (Whisper) from Hugging Face, a public model-hosting site; no sound is sent there.',
          'The live call (Magic Pack, only if the parent switches it on on the device): the child’s voice is turned into text on the device and is never sent. Our server receives the text of each sentence and of the last few sentences of the exchange, with the first name and known names replaced by a gap on the device and again on the server, plus the child’s age and the gifts chosen in their wish list. It sends them to the AI provider to produce Santa’s answer: DeepSeek, then NVIDIA or Mistral as fallbacks. Every answer goes through our ChildShield filter (which may send the answer’s text to NVIDIA’s safety model), then the answer, and only that, is voiced by Google (Gemini API). At the start of the live call, Santa tells the child that his answers are made by an AI, and it is written on screen. We keep neither the sentences nor the answers. Only a minute counter is kept at Supabase, under a pseudonymous key (a cryptographic hash of the pass) that contains no name or email.',
          'Payment: it is processed by Stripe, which receives the parent’s email address and payment details for the payment, the receipt and fraud prevention, and keeps them under its own legal obligations. We never see bank details. Proof of purchase is kept in a secure cookie in your browser (“santa_pass”: the payment session number and the pack, signed, until 31 January 2027).',
          'No tracking: no advertising pixel (TikTok or other) and no purchase tracking; we measure a campaign only by its link and the number of sales in Stripe.',
        ],
      },
      {
        id: 'lutins',
        title: '3c. The Prankster Elves',
        body: [
          'The parent photographs a room of the house (never a person) to make the elves appear in it. Before anything is sent, the phone itself checks that no person is visible in the photo: if someone appears, the photo is refused and is not sent. So no child’s picture is ever sent.',
          'The photo is redrawn on the device (the phone’s data such as location and date is removed), sent to our server and then to our image provider Agnes AI only to make the prank picture, with the description of the prank chosen or written by the parent (checked by our ChildShield filter). If the parent asks for a short video, the prank picture is sent to Agnes AI to animate it. We keep neither the photo, the description nor the picture or video made.',
          'The elves’ journal (pictures, videos, captions) stays on the device. For free fair use, a random device identifier and the IP address are counted in memory during the day, then forgotten.',
        ],
      },
      {
        title: '4. Our providers and what they receive',
        body: [
          [
            'Vercel: hosting of the site and our server (every page and request goes through it, with the IP address), and cookie-free audience measurement (Vercel Web Analytics and Speed Insights, see the Cookie Policy).',
            'Supabase: accounts, profiles, results, Ziggy World data, avatar pictures and Santa’s minute counter.',
            'Google (Gemini API): chat replies (first) and every server-made voice (Ziggy, Santa), from text only.',
            'DeepSeek: Ziggy World texts, Santa’s live-call answers (first) and chat replies as a fallback.',
            'NVIDIA: ChildShield’s safety model (text of the AI’s replies) and fallback provider for the chat, Ziggy World and the live call.',
            'Mistral: fallback for Santa’s live call.',
            'Groq and Anthropic: chat fallbacks, if switched on on our server.',
            'Agnes AI: avatar pictures (from text only), Prankster Elves pictures and videos (photo of a room with nobody in it).',
            'Stripe: payment for Santa’s packs.',
            'Hugging Face: download, by the device, of Santa’s speech-recognition model (no data sent).',
          ],
          'We send each one only what is described on this page, when the feature is used. Several of these providers are established outside the European Union, so the data they receive may be processed outside the EU. Traffic to the site is encrypted (HTTPS).',
        ],
      },
      {
        title: '5. Cookies and local storage',
        body: [
          'No advertising or tracking cookies. The browser only keeps what the site needs to work: your sign-in session, light or dark theme, sound setting, language, your cookie choice, for guests the stars they have won and, for Santa’s app, the pass you bought (“santa_pass” cookie) and the family’s data kept on the device. Details are in the Cookie Policy.',
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
  return {
    ...{ title: `${c.title} — Ziggy`, description: c.intro },
    alternates: alternatesFor(locale, '/privacy'),
  };
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
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
