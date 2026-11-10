# Le Père Noël va t'appeler ! — Plan d'amélioration profonde (Noël 2026)

Repo : `maximecharavet-tech/Ziggy` (module, pas un repo séparé) · branche locale `feat/pere-noel-deep-upgrade` (depuis `origin/main` 2ba5084, non poussée)
Prod : https://ziggy-ai.fr/pere-noel (+ /lettre /appel /photo /parents /merci) — HTTP 200 via `vercel curl` le 10/11/2026 ; curl anonyme depuis la box = 429 (bot protection, normal).
Contraintes : 0 € sans OK de Maxime · aucune fusion/déploiement/env/DNS sans OK · licences MIT/Apache/BSD seulement · pas de Claude · pas de secrets.

---

## 1. Audit (état actuel)

**Stack** : Next.js 15 + React 19 + next-intl (fr/en…), Tailwind 4, framer-motion 12, three.js 0.186 (Père Noël 3D codé : `src/games3d/santa/` — santa.ts 885 l., props 976, stages 851), MediaPipe selfie segmentation (Apache-2.0) pour la photo, Stripe Checkout (REST maison), cookie pass HMAC, Vitest. ~9 000 lignes santa.

**Parcours existant**
| Page | Fonction |
|---|---|
| `/pere-noel` | Village (hub 3D, neige) |
| `/lettre` | Lettre : prénom, âge, cadeaux (catalogue `data/santa/gifts.ts`), dessin/signature, lettre imprimable |
| `/appel` | Appel guidé (3 scripts : liste / nouvelles / veille, clips Gemini TTS cachés CDN 1 an, prénom dit), écoute « a-t-il répondu ? » sur l'appareil ; **appel IA en direct** (Pack magique, consentement parent) |
| `/photo` | Photomaton : détourage sur l'appareil, décors 3D, filigrane en gratuit, vidéo courte |
| `/parents` | Porte adulte, achat, réglages, moment de fierté |
| `/merci` | Retour Stripe, restauration du pass sur un autre appareil |

**IA live** : STT Chrome on-device (`processLocally`, Chrome 139+) → `/api/santa/chat` → **Anthropic Haiku puis NVIDIA Llama 3.3** → ChildShield (local + NemoGuard) → Gemini TTS « santa ». 20 min / pass.
**Monétisation** : gratuit · Pack Noël 4,99 € · Pack magique 9,99 € (upgrade 5 €) ; paiement unique jusqu'au 31/01/2027 ; codes promo Stripe actifs. `/api/santa/status` répond (tier null) ; achat réel non testé (ne pas créer de session Stripe sans OK).

**Forces** : vie privée exemplaire (tout sur l'appareil), pas d'abonnement (≠ PNP : 1★ massifs sur renouvellements), tests, i18n, accessibilité (reduced motion, SayButton).

**Manques / risques**
1. Appel IA live **impossible sur Safari/iOS/Firefox** (≈ 50 % des parents FR sur iPhone) → gros manque à gagner.
2. Pas de vrai « Le Père Noël t'appelle » : pas d'appel **programmé** (sonnerie à l'heure choisie, veille du 24), pas de notification push.
3. Latence IA tour par tour (STT → LLM → TTS WAV complet) : pas de streaming, pas d'interruption (barge-in), bouche pilotée par l'amplitude seulement.
4. Le fournisseur n°1 du live est **Anthropic** (payant, et Maxime veut éviter Claude) → passer sur DeepSeek/NVIDIA/Mistral + option locale.
5. Aucune **vidéo personnalisée** du Père Noël (cœur du marché PNP), pas de « verdict sage », pas de certificat, pas de vidéo-réaction de l'enfant.
6. Visuels : tout est code/emoji (🎅 dans le teaser), aucun asset illustré/vidéo ; landing peu « premium » ; OG image codée.
7. Monétisation courte : 2 packs, pas de pack famille/grands-parents, pas de carte cadeau, pas de recharge minutes, pas de parrainage, pas d'early-bird.
8. Charge du 24 décembre : rate-limit en mémoire, pas de file/repli si les fournisseurs saturent (avis 1★ « Santa is busy » chez les concurrents).

---

## 2. Veille mondiale (code source réutilisable — licences vérifiées via GitHub API le 10/11/2026)

### Voix temps réel (orchestration)
| Projet | Licence | ★ | Usage |
|---|---|---|---|
| pipecat-ai/pipecat (+ pipecat-client-web) | BSD-2 | 17k | Pipeline voix STT→LLM→TTS streaming, VAD, interruptions, transport WebRTC/WebSocket — **référence n°1** (serveur Python sur le PC/Hyper Engine) |
| livekit/agents (+ client-sdk-js) | Apache-2.0 | 15k | Alternative WebRTC + turn detection ; LiveKit Cloud payant ⇒ self-host seulement |
| huggingface/speech-to-speech | Apache-2.0 | 14k | Pipeline local VAD→Whisper→LLM→TTS, bon modèle d'archi |
| kyutai-labs/unmute | MIT | 1.5k | Kyutai (Paris) : STT/TTS streaming à très faible latence, **français natif** ; poids des modèles CC-BY-4.0 ⚠ (hors liste → demander OK) |
| kyutai-labs/moshi | Apache-2.0 (code) | 11k | Full-duplex speech-to-speech (poids CC-BY ⚠) |
| openai/openai-realtime-agents | MIT | 7k | Patterns d'agents voix (handoff, garde-fous) — **pattern seulement**, l'API OpenAI est payante |
| lipku/LiveTalking (Chine) | Apache-2.0 | 10k | Avatar numérique temps réel (WebRTC, lip-sync) — inspiration pour visage vidéo |
| TEN-framework (Agora, Chine) | ⚠ licence Apache + conditions | — | À éviter (conditions supplémentaires) |

### STT (reconnaissance) — pour débloquer Safari/iOS sans envoyer la voix
| Projet | Licence | Usage |
|---|---|---|
| k2-fsa/sherpa-onnx (Chine) | Apache-2.0 | **WASM dans le navigateur**, VAD + ASR streaming, marche sur Safari → STT on-device universel |
| ggml-org/whisper.cpp | MIT | WASM whisper tiny/base (poids MIT) en repli |
| huggingface/transformers.js | Apache-2.0 | Whisper WebGPU (déjà écarté pour `sharp` côté Node ; OK si chargé uniquement côté client) |
| SYSTRAN/faster-whisper | MIT | Côté PC si un parent accepte le mode serveur |
| modelscope/FunASR, FunAudioLLM/SenseVoice (Chine) | MIT (code) | Très rapides ; poids sous licence modèle ⚠ |
| snakers4/silero-vad | MIT | VAD (détection fin de parole) |
| moonshine | ⚠ NOASSERTION (poids non-anglais = licence communautaire) | éviter |

### TTS (voix du Père Noël)
| Projet | Licence | Usage |
|---|---|---|
| resemble-ai/chatterbox (multilingue) | MIT | **Meilleur candidat** : FR, émotion réglable, voix grave chaleureuse ; tourne sur le PC (GPU) → clips pré-générés gratuits |
| hexgrad/kokoro (+ kokoro-js) | Apache-2.0 | 82M, très rapide, tourne **dans le navigateur** (voix FR `ff_siwis`) → repli on-device |
| FunAudioLLM/CosyVoice (Alibaba) | Apache-2.0 | Streaming FR/zero-shot, latence ~150 ms |
| KittenML/KittenTTS | Apache-2.0 | Ultra-léger CPU (anglais surtout) |
| nari-labs/dia | Apache-2.0 | Dialogues expressifs (rires « Ho ho ho ») — anglais |
| rhasspy/piper | MIT (archivé) | Repli CPU ; **piper1-gpl = GPL ⇒ interdit** |
| F5-TTS (code MIT, poids CC-BY-NC), fish-speech, index-tts, ChatTTS (AGPL) | ⚠ | **Exclus** |

### Visage / animation
| Projet | Licence | Usage |
|---|---|---|
| met4citizen/TalkingHead | MIT | Lip-sync visèmes FR/EN pour avatar 3D three.js — à porter sur notre Père Noël codé |
| bytedance/LatentSync | Apache-2.0 | Lip-sync vidéo (PC GPU) pour vidéos personnalisées pré-rendues |
| motiondivision/motion | MIT | Motion (motion.dev) — UI/gestes ; déjà via framer-motion 12 → migrer import `motion/react` |
| pmndrs/react-three-fiber | MIT | Optionnel (on garde three.js impératif existant) |
| google-ai-edge/mediapipe | Apache-2.0 | Déjà utilisé ; ajouter Face Landmarker pour filtres « bonnet/barbe » AR |
| Remotion | ⚠ licence entreprise | **Exclu** → vidéos via canvas + MediaRecorder / ffmpeg (déjà sur la box) |
| LivePortrait, MuseTalk, rhubarb | ⚠ NOASSERTION/poids non commerciaux | Exclus |

### Concurrence et prix (sources : portablenorthpole.com/en/premium, santawishlist.app « Best Santa apps 2026 », papanoel.chat, callsanta.us)
| Concurrent | Offre | Prix |
|---|---|---|
| PNP (leader, 350 M vues) | 50+ vidéos, 20+ appels, histoires, « Talk to Santa » IA en crédits, « Christmas Journey » (10+ moments planifiés) | vidéo 4,99–11,99 $, appel 5,99–11,99 $, Magic Pass 24,99 $/an **abonnement**, Ultimate 34,99 $ ; 228/500 avis récents = 1★ (renouvellements, appels du 24 non reçus) |
| Speak to Santa | appels simulés | 3,99 $/mois … 29,99 $ à vie |
| PapaNoel.chat | **avatar vidéo IA temps réel**, packs de minutes, code PIN | à la minute |
| CallSanta.us | appel téléphonique IA (ElevenLabs/Twilio) | 29 $ / 49 $, vidéo 25 $ |
| Call a Claus AI | appel IA | 3,99–99,99 $ ; « Santa est occupé » le 24 |
| Better Call Santa | OpenAI Realtime, liste de souhaits pour parents | — |

**Notre angle** : « le Père Noël le plus magique ET le plus honnête » : paiement unique, aucune donnée de l'enfant ne quitte le téléphone, appel garanti le 24 (pré-rendu, pas de file d'attente), français natif.

---

## 3. Roadmap priorisée

### P0 — avant le 22 novembre (ventes Black Friday)
1. **Appel programmé « Le Père Noël t'appelle »** : le parent choisit date/heure (dont le 24 au soir) → écran d'appel entrant plein écran + sonnerie (Web Push + PWA `sw.js` existant, calendrier .ics de repli, rappel parent). Pré-rendu → zéro risque de saturation.
2. **STT on-device universel** : sherpa-onnx WASM (Apache) + silero-vad → appel IA live sur Safari/iOS/Firefox ; Chrome local reste prioritaire.
3. **Live IA streaming + barge-in** : réponse LLM en flux, découpage par phrase, TTS phrase par phrase ; l'enfant peut couper la parole ; « Ho ho ho » et bruitages pendant la réflexion (cache la latence).
4. **Retirer Anthropic** du chemin par défaut : DeepSeek v4-flash → NVIDIA Llama 3.3 → Mistral (env `SANTA_AI_PROVIDERS`), mêmes garde-fous ChildShield.
5. **Landing premium** : hero vidéo Grok Imagine + illustrations ChatGPT, preuve sociale, tableau des offres, FAQ vie privée, compte à rebours de Noël.
6. **Nouvelle grille de prix** (cf. §4) + recharge minutes + carte cadeau.

### P1 — avant le 6 décembre
7. **Vidéo personnalisée du Père Noël** (« Le Grand Livre ») : séquence 3D rendue dans le navigateur (canvas + MediaRecorder) : prénom écrit dans le livre, photo de l'enfant dans le livre (sur l'appareil), verdict « Enfant formidable », cadeaux de la lettre ; voix = clips cachés + prénom. Export MP4/WebM HD (payant).
8. **Lip-sync visèmes** (approche TalkingHead MIT) sur le Père Noël 3D + clignements, regard qui suit le visage de l'enfant (MediaPipe Face Landmarker).
9. **Calendrier de l'Avent du Pôle Nord** (24 cases : mini-vidéo, coloriage, jeu Ziggy, message vocal) → rétention quotidienne + upsell.
10. **Traceur du traîneau le 24** (carte 3D, ETA « dans ton quartier » sans géolocalisation précise).
11. **Certificat officiel + diplôme « Enfant sage »** PDF imprimable signé, + **Réponse du Père Noël à la lettre** (lettre manuscrite générée, imprimable / envoi postal option payante ⚠).
12. **Enregistreur de réaction** (caméra frontale pendant l'appel, reste sur l'appareil) → le parent partage la vidéo (viral).

### P2 — décembre
13. Appel **multi-enfants** (fratrie dans le même appel), **Mère Noël** et **lutin Ziggy** comme intervenants.
14. **Espace grands-parents** : offrir un pack à distance (lien cadeau), recevoir la vidéo-réaction.
15. Mode **Pôle Nord AR** (bonnet/barbe en direct, flocons, renne derrière l'enfant).
16. Tableau parent : historique, minutes, planning, « moments de fierté » libres (modérés), contrôle PIN.
17. Résilience 24/12 : rate-limit Upstash/KV ⚠ (gratuit possible), file + repli guidé auto, page statut.
18. Saison 2027 : anniversaires, Pâques (lapin), petite souris (même moteur).

---

## 4. Monétisation (paiement unique, jamais d'abonnement — argument marketing)
| Offre | Prix | Contenu |
|---|---|---|
| Gratuit | 0 € | Lettre, 1 message vocal prénom, 1re minute d'appel guidé, photo filigranée, 1 enfant |
| Pack Noël | **5,99 €** (lancement 4,99 € jusqu'au 1/12) | Appels guidés illimités, **1 appel programmé**, photos HD + vidéo, certificat, 3 enfants |
| Pack Magique ⭐ | **12,99 €** (lancement 9,99 €) | Pack Noël + **30 min d'appel IA live**, **vidéo personnalisée « Grand Livre » HD**, appels programmés illimités, calendrier de l'Avent complet, enregistreur de réaction |
| Pack Famille Ultime | **19,99 €** | Magique + **5 enfants**, 60 min IA, appel fratrie, 3 liens grands-parents, Mère Noël & lutin |
| Recharge minutes | 3,99 € / 15 min · 6,99 € / 30 min | Pour le live IA |
| Appel du 24 décembre seul | 2,99 € | Appel programmé veille de Noël (entrée de gamme, upsell) |
| Carte cadeau grands-parents | 9,99 / 14,99 € | Lien cadeau + carte imprimable |
| Lettre réponse postale ⚠ | 7,99 € | Coût d'envoi réel (prestataire payant → OK requis) |

**Leviers** : early-bird jusqu'au 1/12, Black Friday −30 % (codes Stripe déjà permis), parrainage (« offre 5 min, reçois 5 min »), upsell dans le flux (après la 1re minute d'appel, après le filigrane, après la lettre), bundle « Ziggy Premium + Père Noël », TikTok/Instagram avec vidéos-réaction (UTM), pages SEO « appel du Père Noël gratuit », « vidéo personnalisée Père Noël », « lettre au Père Noël ».
**Hypothèse** : 50 000 visites → 4 % conversion → 2 000 ventes × 11 € panier moyen ≈ **22 k€** (Stripe ≈ 1,5 % + 0,25 €).
**Coûts à valider (⚠ payants)** : Stripe compte live, Gemini TTS au-delà du gratuit, DeepSeek/NVIDIA au-delà du gratuit, Web Push (gratuit via VAPID), KV Upstash (gratuit jusqu'à un seuil), envoi postal.

---

## 5. Architecture cible
```
Navigateur (enfant)                         Vercel (Next.js, inchangé : pas de changement de région)
 ├ STT on-device : Chrome local │ sherpa-onnx WASM + silero-vad
 ├ Père Noël 3D three.js + visèmes + Motion UI
 ├ Kokoro-js (repli TTS on-device)
 ├ Vidéo « Grand Livre » : canvas → MediaRecorder (MP4/WebM)
 ├ Push/PWA (sw.js) : appel programmé
 └ IndexedDB : enfants, photos, vidéos   ── texte seul ──▶ /api/santa/chat (SSE streaming)
                                                         ├ ChildShield local + NemoGuard
                                                         ├ DeepSeek → NVIDIA → Mistral (pas Anthropic)
                                                         └ TTS phrase par phrase (Gemini ; cache par phrase)
PC Maxime (gratuit) : Chatterbox/CosyVoice → pré-génère TOUS les clips fixes (voix unique du Père Noël) → public/santa/voice/*.opus ; LatentSync pour vidéos marketing.
Hyper Engine (optionnel) : serveur Pipecat (BSD-2) pour le live « qualité max » si OK.
```
Nouvelles routes : `/api/santa/chat` (SSE), `/api/santa/schedule` (push VAPID), `/api/santa/gift` (carte cadeau = checkout avec metadata), `/api/santa/webhook` (Stripe, idempotent). Nouvelles pages : `/pere-noel/video`, `/avent`, `/traineau`, `/cadeau`, `/certificat`.

---

## 6. Spéc Motion (motion.dev, MIT)
- Migrer `framer-motion` → `motion` (`import { motion, AnimatePresence } from "motion/react"`), même API.
- **Appel entrant** : carte qui glisse du haut (`spring` stiffness 260 damping 20), anneaux concentriques pulsés (`scale [1,1.6]`, `opacity [0.6,0]`, repeat ∞, 1,4 s), bouton décrocher qui « respire », vibration `navigator.vibrate`.
- **Décroché** : transition plein écran `layoutId="santa-window"`, flou → net (filter blur 12px→0, 0,5 s), flocons parallax.
- **Lettre** : cadeaux qui volent dans l'enveloppe (`useAnimate` séquence), enveloppe qui se ferme + cachet de cire, envoi par renne (path SVG `offsetDistance` 0→100 %).
- **Village** : cartes d'activités `whileHover` tilt 3D (`rotateX/Y` via `useMotionValue` + `useSpring`), apparition stagger 0,06 s, scroll-linked (`useScroll`) aurores boréales.
- **Offres** : carte ⭐ qui brille (gradient animé), compteur prix `animate(0, 12.99)`, confettis après achat.
- **Avent** : portes qui s'ouvrent `rotateY: -110` avec `transformPerspective: 800`.
- Toujours `useReducedMotion()` → transitions d'opacité seulement. 60 fps mobile : n'animer que `transform`/`opacity`.

---

## 7. Visuels ChatGPT (images) — prompts prêts
Style commun (à coller en tête) : *« Illustration 3D type film d'animation premium (Pixar/Illumination), chaleureuse, lumière dorée de bougie et bleu nuit polaire, neige douce, palette rouge profond #c92a2a, or #f5c542, bleu nuit #17124a, vert sapin. Aucun texte, aucun logo. Pour enfants 3–9 ans, rassurant, merveilleux. »* Référence de cohérence : le robot peluche Ziggy (`/workspace/dodo-art2/ref/ziggy.jpg`) quand il apparaît.

1. **hero-landing.png (16:9)** — « Le Père Noël, barbe blanche bouffante, lunettes rondes dorées, dans son bureau du Pôle Nord, tient un grand téléphone vintage rouge et sourit en regardant la caméra comme en appel vidéo ; derrière lui, fenêtre givrée avec aurores boréales, rennes au loin, établi de lutins, lettres d'enfants empilées ; petit robot peluche Ziggy sur le bureau. »
2. **appel-entrant.png (9:16)** — « Écran de smartphone posé sur une couette d'enfant, la nuit, qui s'illumine d'une lumière dorée magique ; des flocons et étincelles sortent de l'écran ; silhouette de traîneau dans la lueur. »
3. **bureau-fond-appel.png (16:9, sans personnage)** — « Bureau du Père Noël vu de face à hauteur de webcam, fauteuil de cuir rouge vide, cheminée qui crépite, sapin décoré, horloge à coucou, carte du monde avec trajets lumineux. » (fond derrière le Père Noël 3D)
4. **grand-livre.png (3:2)** — « Immense livre ancien ouvert aux pages dorées sur un pupitre, plume d'oie, encrier, poussière d'étoiles qui s'élève des pages ; un cadre vide sur la page de droite pour une photo. »
5. **atelier-lutins.png (16:9)** — « Atelier des lutins en pleine activité : tapis roulant de jouets, lutins souriants qui emballent des cadeaux, rubans, Ziggy qui aide. »
6. **traineau-nuit.png (21:9)** — « Traîneau du Père Noël tiré par neuf rennes (Rudolph nez rouge) au-dessus d'une petite ville française enneigée la nuit, toits, clocher, guirlandes. »
7. **mere-noel.png (3:4)** — « Mère Noël souriante, tablier fleuri, sort des biscuits du four dans une cuisine en bois chaleureuse. »
8. **certificat-cadre.png (4:3)** — « Cadre de diplôme ornemental rouge et or avec houx, cachet de cire rouge du Pôle Nord, espace central vierge parchemin. »
9. **carte-cadeau.png (16:10)** — « Carte cadeau premium : enveloppe rouge velours avec ruban doré, flocons, petit renne en relief. »
10. **calendrier-avent.png (1:1)** — « Maison du Pôle Nord en façade avec 24 petites portes et fenêtres de formes différentes, lumières chaudes. » (portes numérotées en code)
11. **og-image.png (1200×630)** — « Le Père Noël en appel vidéo avec un enfant (de dos, anonyme) qui lève les bras de joie, ambiance salon de Noël. »
12. **offres-3-cadeaux.png (16:9)** — « Trois paquets cadeaux de taille croissante (petit vert, moyen rouge, grand doré brillant) sous un sapin, lumière magique. »
Export : WebP 1600 px (q 82) + AVIF ; `public/santa/art/`.

## 8. Vidéos Grok Imagine — prompts prêts (6–10 s, sans texte)
1. **hero-loop.mp4** (16:9, boucle) — « Le Père Noël dans son bureau du Pôle Nord regarde la caméra, rit, fait un clin d'œil et salue de la main ; flammes de cheminée, flocons à la fenêtre, lumière chaude ; mouvement de caméra doux en avant. » (image de départ : visuel 1)
2. **appel-entrant.mp4** (9:16) — « Un téléphone sur un lit d'enfant s'allume, étincelles dorées et flocons jaillissent de l'écran, la chambre s'emplit de lumière magique. » (visuel 2)
3. **traineau-decollage.mp4** (21:9) — « Le traîneau décolle du Pôle Nord, rennes au galop dans le ciel, traînée d'étoiles, aurores boréales. »
4. **lettre-envoyee.mp4** (1:1) — « Une enveloppe rouge cachetée s'envole d'une boîte aux lettres enneigée, traverse les nuages et atterrit sur le bureau du Père Noël. »
5. **atelier.mp4** (16:9) — « Travelling dans l'atelier des lutins : jouets sur tapis roulant, lutins qui emballent, Ziggy qui fait un pouce levé. » (visuel 5)
6. **grand-livre.mp4** (3:2) — « Le Grand Livre s'ouvre seul, pages qui tournent, poussière d'étoiles dorée qui s'élève. » (visuel 4) → fond de la vidéo personnalisée
7. **tiktok-teaser.mp4** (9:16) — « Gros plan Père Noël qui chuchote un secret à la caméra puis rit ; zoom lent. »
Règle : pas de visage d'enfant réel, pas de marque ; vérifier usage commercial des conditions Grok Imagine.

---

## 9. Packs de tâches prêts à coller

### 9.1 DeepSeek (chat web) — contenu & prompts (gratuit)
**DS-1 Scripts** : « Tu es scénariste pour enfants 3–9 ans. Écris en français (tutoiement, phrases ≤ 15 mots) 6 nouveaux scripts d'appel du Père Noël (veille de Noël, réveil du matin, félicitations sage, aide pour s'endormir, anniversaire, retour d'école) au format JSON `{id, steps:[{t:'say',lines:[…]}, {t:'listen'}, …]}` avec 6 réactions génériques par étape d'écoute, jamais de promesse de cadeau précis, jamais de liste des vilains, aucun sujet sombre. Inclure variantes {prénom}. Puis la version anglaise. »
**DS-2 Persona live** : « Améliore ce prompt système (colle `santaSystemPrompt` de `src/lib/santa/santa-ai.ts`) : style oral français naturel, 1–2 phrases, questions ouvertes adaptées à l'âge, souvenirs de la lettre, 30 exemples de dialogues courts (few-shot), 20 cas pièges (« t'es un robot ? », « mon chien est mort », adresse, insultes, demande d'argent) avec réponse idéale. Rends un JSON testable. »
**DS-3 Calendrier de l'Avent** : 24 contenus (message, défi gentil, mini-histoire 60 s, devinette) JSON fr/en.
**DS-4 SEO** : 10 pages (titre, meta, H1, 600 mots, FAQ schema.org) sur les requêtes « appel du Père Noël gratuit », « vidéo personnalisée Père Noël », « lettre au Père Noël en ligne », etc.

### 9.2 Codex CLI (PC) — front, sans clé payante
Préambule commun : « Repo Ziggy, branche `feat/pere-noel-deep-upgrade`. Lis `docs/PERE_NOEL.md` et `PLAN.md`. Licences MIT/Apache/BSD uniquement. Pas de nouveaux services payants. `npm run check` doit passer. Ne pousse pas sur main. »
- **CX-1 Motion** : migrer `framer-motion` → `motion` ; appliquer la spéc §6 à `SantaCall`, `LetterBuilder`, `SantaVillage`, `SantaParents` ; reduced-motion.
- **CX-2 Appel programmé** : page parents « Programmer l'appel » (date/heure, enfant, script), stockage IndexedDB, notification locale + Web Push VAPID (`/api/santa/schedule`, clés en env, à ajouter par Maxime), écran d'appel entrant plein écran, export .ics ; tests Vitest.
- **CX-3 Vidéo Grand Livre** : `src/components/santa/video/` : scène three.js du livre + photo enfant (on-device) + clips voix → `MediaRecorder` 1080p, filigrane en gratuit ; tests de layout.
- **CX-4 Landing & offres** : nouveau hero (vidéo `hero-loop.mp4` en `<video muted autoplay playsinline>` + poster), tableau 4 offres, FAQ, compte à rebours, OG ; mettre `offer.ts` + `docs/PERE_NOEL.md` à jour (prix §4) ; checkout : recharges, carte cadeau (metadata), webhook Stripe idempotent.
- **CX-5 Avent + certificat + traîneau** : pages `/avent`, `/certificat` (PDF via canvas → print), `/traineau`.

### 9.3 Hyper Code (Hyper Engine, moteurs gratuits d'abord) — voix & IA
- **HC-1 STT universel** : intégrer sherpa-onnx WASM (Apache-2.0) + silero-vad dans `src/lib/santa/transcribe.ts` (`kind: 'chrome-local' | 'sherpa-wasm'`), chargement paresseux des poids depuis `public/santa/asr/`, test Safari iOS ; aucune donnée audio envoyée.
- **HC-2 Live streaming** : `/api/santa/chat` en SSE : flux LLM → découpe par phrase → ChildShield par phrase → TTS par phrase ; client : file audio, barge-in (VAD coupe la lecture), « Ho ho ho / hmm » de remplissage ; fournisseurs `DeepSeek → NVIDIA → Mistral`, **Anthropic retiré du défaut**.
- **HC-3 Voix maison** : script `scripts/santa-voice/` (PC GPU, Chatterbox MIT ou CosyVoice Apache) qui pré-génère tous les clips fixes fr/en en Opus → `public/santa/voice/`, `audio.ts` lit d'abord ces fichiers (0 € à l'usage) ; Kokoro-js en repli on-device.
- **HC-4 Visèmes** : porter la logique de visèmes de TalkingHead (MIT, créditer) sur `games3d/santa/santa.ts` (bouche 8 visèmes, clignements, regard via MediaPipe Face Landmarker).
- **HC-5 Charge 24/12** : rate-limit distribué (Upstash si OK ⚠, sinon Edge Config), budget minutes par pass côté serveur, repli automatique vers appel guidé, page statut.

### Ordre conseillé
1. ChatGPT visuels 1–4, 11, 12 → Grok Imagine 1, 2, 7 · 2. DeepSeek DS-1/DS-2 · 3. Codex CX-4 + CX-1 · 4. Hyper Code HC-2 + HC-1 · 5. Codex CX-2, CX-3 · 6. HC-3, HC-4 · 7. CX-5, HC-5. PR unique par lot, **aucune fusion sans OK**.

## 10. Crédits (à ajouter dans `docs/CREDITS.md`)
Pipecat (BSD-2), LiveKit Agents (Apache-2.0), sherpa-onnx (Apache-2.0), silero-vad (MIT), whisper.cpp (MIT), Kokoro (Apache-2.0), Chatterbox (MIT), CosyVoice (Apache-2.0), TalkingHead (MIT), Motion (MIT), MediaPipe (Apache-2.0), three.js (MIT), huggingface speech-to-speech (Apache-2.0), LiveTalking (Apache-2.0, inspiration).

## ⚠ Points payants / OK requis
Stripe live · éventuelle hausse de quotas Gemini/DeepSeek/NVIDIA · Upstash KV · envoi postal · poids Kyutai (CC-BY) · conditions commerciales Grok Imagine · toute fusion/déploiement/variable d'env (VAPID, clés).
