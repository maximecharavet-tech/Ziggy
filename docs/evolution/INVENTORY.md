# Inventaire de l'existant — doublons et conformité aux nouvelles règles

État lu le 26/10/2026 sur `c2bdc9a` (identique à `main`). Sert de base au plan : on **étend** l'existant au lieu de le refaire.

## 1. Ce qui existe déjà et recoupe le catalogue

| Demande (mission v3) | Existant | Décision proposée |
|---|---|---|
| F1 Labo IA (entraîner un modèle) | `/lab` : k-NN maison sur dessins 16×16, 100 % navigateur (`src/lib/lab/knn.ts`, tests) | **Étendre** : sons, gestes, biais (F13), J7. Pas de second labo. |
| F13 Mon IA a un biais | rien de spécifique ; le k-NN du labo le permet | Module du labo existant |
| J4 Boucles du robot jardinier | jeu `coding` + `src/lib/games/robot.ts` (« chemin du robot », débogage) | **Suite** du même jeu (boucles, conditions) |
| Phase 3 ts-fsrs | `ts-fsrs` déjà en dépendance, utilisé par `/memo` (Boîtes à souvenirs) | Réutiliser pour la révision par compétence |
| Phase 3 BKT + Elo | `src/lib/learning/adaptive.ts` : BKT amorti + EMA + niveau 1–5 ; **pas d'Elo** | Ajouter Elo à côté, garder BKT |
| F5 Carnet du parent | `/monde/parents` (console : progrès, compétences, consentements, usage IA, suppressions) | Carnet hebdo = nouvel onglet de la console |
| F10 Parcours adapté | tranches d'âge, lecture à voix haute auto, réponses en images, plafond de niveau | Ajouter police, contraste, durée, rythme |
| F6 Mode trajet sans écran | lecture à voix haute complète des jeux (`read-aloud.tsx`) | Réutiliser le narrateur ; réponses par gros boutons d'abord |
| F15 Ciel de Ziggy / A1 | mode dodo `/dodo` (31 histoires, sons Hyper Frequencies, minuterie) | Une « constellation du soir » dans le dodo, pas une 2e app |
| F3 Voix de papa/maman | lecteur dodo (audio pré-généré par scène) | Ajouter une piste « voix du parent » par scène |
| F8 Mon livre Ziggy | Story Builder `/monde/histoires` + bibliothèque | PDF local à partir des histoires gardées |
| F12 Univers / Princesse Lili | histoire Lili + visuel officiel dans `/dodo` | Coloriages et cartes à partir de ce visuel |
| J13 Syllabes / J14 phrases | mécaniques `spell` et `order` | Nouvelles **données** sur mécaniques existantes, pas de nouveau moteur |
| J15 Potion des états / J16 chaîne alimentaire | `sort`, `order` (déjà « tri », « habitats ») | Idem : contenus |
| G4 Bonjour du monde | `geography_explorer` (drapeaux) | Étendre, pas dupliquer |
| J18 Machine à rythmes | `music_garden` (mélodie à répéter) | Mécanique distincte (séquenceur) : nouveau |
| Pause / temps d'écran | `BreakReminder`, `/apprendre` Breathe | Brancher sur la fin de session décidée par le moteur |
| J1, J2, J3, J5, J6, J8–J12, J17, J19, J20, H1–H5, G1–G3, G5, A2–A5 | absents | Nouveaux (phase 8, par lots) |

Mécaniques arcade existantes : choice, runner, pairs, order, sort, spell, mix, dig, melody, slide (+ robot/coding hors arcade). 20 jeux d'arcade, 20 mondes, 120 quêtes.

## 2. Existant **en conflit** avec les règles absolues (à traiter en phase 1, derrière des drapeaux)

| # | Existant | Règle touchée | Gravité | Proposition |
|---|---|---|---|---|
| C1 | `/api/chat`, `ChatWindow`, `VoiceCall` (`/hyper`) : conversation libre enfant ↔ LLM (Gemini/DeepSeek/NVIDIA/Groq/Anthropic) | 1.2 « pas de conversation libre », 3 « Gemini gratuit jamais en direct côté enfant » | **critique** | Désactiver côté enfant (drapeau `chat_enabled=false`), remplacer par des réponses scénarisées locales ; conserver pour la démo parent si tu le souhaites |
| C2 | Micro : `SpeechRecognition` (Web Speech API) dans `voice.ts` / appel vocal | 3 « Web Speech API Chrome envoie l'audio à Google » | **critique** | Couper par défaut ; STT local (Vosk/Whisper navigateur) en phase 6 |
| C3 | `/api/tts` : voix Gemini **en direct** pour les enfants (jeux, lecture à voix haute) | 3 (Gemini gratuit EEE) | élevé (dépend de ton offre Gemini) | Par défaut : voix pré-générées + voix locale de l'appareil (Kokoro navigateur en phase 6) ; Gemini direct seulement si tu confirmes un compte payant |
| C4 | Avatar « depuis une photo » : photo envoyée à NVIDIA (vision) | 1.2 « aucune image d'enfant vers un tiers » (même avec consentement) | **critique** | Désactiver (drapeau) ; remplacer par une analyse locale (MediaPipe, phase 5) ou supprimer |
| C5 | Génération IA **en direct** de quêtes, histoires, questions (DeepSeek/NVIDIA) pour l'enfant | « le moteur décide, l'IA propose », « IA jamais en direct », relecture humaine | élevé | Basculer en pré-génération propriétaire + relecture, ou reformulation de textes déjà décidés ; contenu local par défaut |
| C6 | Génération d'avatar Agnes à la demande (texte uniquement, sans donnée enfant) | coût par enfant, image non relue, pas de contrôle image | moyen | Garder derrière drapeau + contrôle image (nsfwjs) + CostGuard, ou bibliothèque pré-générée |
| C7 | Pages `/agents` (agents « vente, marketing, finance… ») | hors cible enfant, chat LLM | moyen | Retirer de la navigation enfant (hors périmètre Ziggy) |
| C8 | Série de jours (flamme qui clignote, retour à 0) dans `MissionCard` | 1.2 « pas de série qui culpabilise » | moyen | Remplacer par un compteur cumulatif sans remise à zéro, sans clignotement |
| C9 | Mot de passe propriétaire présent dans l'historique git public (signalé plus tôt) | sécurité | **critique** | Changer le mot de passe (action de ta part) ; pas de réécriture d'historique sans ton accord |
| C10 | Supabase : protection mots de passe divulgués désactivée ; fonction `ziggy_generation_totals` SECURITY DEFINER (agrégat volontaire) | sécurité | faible | Activer la protection (réglage, action de ta part) ; documenter la fonction |
| C11 | Licences de dépendances en production : `lucide-react` (ISC), `picocolors`/`semver` (ISC, transitives de Next), `sharp`/libvips (LGPL-3.0, binaire optionnel de Next), `caniuse-lite` (CC-BY-4.0, données de build), police Fredoka (OFL-1.1) | 1.4 | à valider | Voir DECISIONS D-07 |
| C12 | Données « famille » : modèle actuel = `profiles` (1 parent ↔ 1 profil enfant) + `ziggy_*` | section 10 (familles, plusieurs enfants, classes) | structurel | Tables additives + backfill **soumis à ton accord** (phase 1/4) |

## 3. Routes actuelles (21) et protections

| Route | Auth | Limite | Remarque |
|---|---|---|---|
| `/api/chat` | aucune | 10/min/IP | C1 |
| `/api/tts` | aucune | 40/5 min/IP | C3 |
| `/api/detect-lang` | aucune | 30/min/IP | lit l'en-tête langue |
| `/api/revalidate` | jeton utilisateur vérifié | 10/min/IP | contrôle du rôle propriétaire à confirmer en P1 |
| `/api/ziggy/avatar/*` | parent | oui | C4, C6 |
| `/api/ziggy/quest|story|game/content` | optionnelle | oui | C5 |
| `/api/ziggy/game/result`, `progress` | optionnelle / parent | oui | OK, à couvrir de tests RLS |
| `/api/ziggy/companion/reaction` | aucune | **non** | à limiter |
| `/api/ziggy/worlds`, `dodo/assets` | public | cache | contenu public, sans donnée |
| `/api/ziggy/parent/*`, `privacy/photo`, `story` (GET/DELETE), `avatar` (GET/DELETE) | parent | **non** | ajouter limites + re-saisie pour suppressions (section 11) |
| `/api/ziggy/dodo/prepare` | propriétaire | — | OK |

Tables Supabase (10, RLS partout) : profiles, game_results, site_settings, ziggy_world_state, ziggy_consents, ziggy_avatars, ziggy_stories, ziggy_generations, ziggy_safety_events, ziggy_dodo_assets.
