# PLAN — Ziggy evolution (mission v3) · Phase 0

> Statut : **en attente de ton feu vert**. Aucun code n'a été écrit pour cette mission.
> Base : `c2bdc9a` (= `main`). Lire avec [INVENTORY.md](INVENTORY.md) (doublons + conflits) et [DECISIONS.md](DECISIONS.md) (décisions à valider).

## 1. Principes appliqués partout
1. **Le moteur décide, l'IA propose** : `src/engine` (déterministe, testé, même graine → même séquence) choisit niveau, activité, maîtrise, fin de session. `src/ai` ne fait que reformuler ou pré-générer ; toute sortie repasse par `engine` (validation) puis `childshield`.
2. **Tout marche sans clé et hors ligne** : contenu local écrit à la main (`content/`), validé par zod ; un test e2e « aucune clé » et un test « mode avion » bloquent chaque PR.
3. **Aucune donnée d'enfant vers un tiers** : caméra, micro, dessins traités sur l'appareil ; un test réseau échoue si une session enfant contacte un domaine non listé.
4. **Zéro dépense** : uniquement contenu local, modèles navigateur, et clés existantes dans leurs quotas, derrière CostGuard (plafond quotidien, coupure automatique).
5. **Chaque nouveauté derrière un drapeau**, désactivé par défaut tant que tu n'as pas validé.

## 2. Architecture cible (adaptée à l'existant — D-02)
```
src/
  app/[locale]/
    (child)/   nouvelles pages enfant (detective, trajet, ciel…) — jamais d'import billing
    (parent)/parents/{carnet,famille,abonnement,reglages}
    (school)/ecole/{classes,[classId],badges}
    monde/ dodo/ lab/ …         pages existantes, URL inchangées
  app/api/ziggy/…               routes (section 11), zod entrée/sortie, { error: code }
  app/sw.ts                     Serwist (phase 2)
  engine/      façade + nouveaux modules : mastery/ (BKT existant + Elo), srs/ (ts-fsrs), session/ (pauses, fin), generators/ (mathjs), robo-student/
  ai/          providers/{nvidia,gemini,deepseek,groq,local}.ts, router.ts (CostGuard + repli) — déplacés depuis lib/hyper-engine
  childshield/ policy (existant) + filters/ (obscenity + dico FR), local/ (toxicité navigateur), image/ (nsfwjs)
  games/       registry existant (lib/arcade) + mechanics/<id>/ nouvelles
  lib/offline (Dexie), lib/voice (local d'abord), lib/flags
content/{fr,en}/   contenus écrits à la main, JSON + schémas zod
tests/{unit,e2e,a11y,perf,network}
vendor/<repo>/     code copié (en-tête d'origine)
```
Frontières imposées par ESLint (`no-restricted-imports`) : `engine` ↛ `ai` ; `(child)` ↛ `billing` ; `ai` ↛ `app`. Un test vérifie ces règles.

## 3. Modèle de données (migrations additives, RLS + tests croisés)
Nouvelles tables de la section 10 : `families`, `family_members`, `children`, `consents` (remplace à terme `ziggy_consents`), `skill_mastery`, `srs_cards`, `progress_events`, `family_messages`, `child_questions`, `classes`, `class_members`, `badges`, `subscriptions`, `gift_cards`, `ai_usage`, `deletion_requests`, `audit_log`.
- Existant conservé : `profiles`, `game_results`, `ziggy_*`. `ziggy_world_state` reçoit `child_id` (nullable) pour le multi-enfant.
- Backfill (5 profils existants → `families`/`children`) : migration séparée, **soumise à ton accord** (D-08).
- Chaque migration a un script `down` testé localement ; aucune suppression.
- Tests RLS : pour chaque table, accès autorisé + refus croisé (autre famille, autre classe) via deux utilisateurs de test sur une base locale (Supabase CLI) — pas sur la production.

## 4. Phases (une PR par phase vers `feat/ziggy-evolution`)

| Phase | Contenu principal | Critère de fin (mesurable) | Drapeau |
|---|---|---|---|
| **0** Plan | ce dossier | ta validation | — |
| **1** Sécurité & vie privée | C1–C10 de l'inventaire ; auth + limite sur toutes les routes ; re-saisie (mot de passe) pour suppressions ; RLS testée ; logs sans donnée enfant ; LEGAL_KIDS.md | 0 route sans auth (sauf contenu public listé) ni limite ; tests RLS croisés verts ; liste failles corrigées/restantes | `child_chat`, `photo_avatar`, `live_ai` = off |
| **2** Socle | i18n FR complet (next-intl existant) ; PWA hors ligne (Serwist) + Dexie + file de synchro ; UI enfant (grosses cibles, dnd-kit) ; polices Andika/OpenDyslexic/Lexend/Atkinson ; accessibilité | quête complète en mode avion ; PWA installable ; axe 0 critique ; clavier complet | `offline` |
| **3** Moteur | Elo à côté du BKT ; ts-fsrs par compétence ; générateurs mathjs ; `session/` (pause, fin) ; robo-student | couverture ≥ 90 % du module ; déterminisme testé ; 0 décision IA | — |
| **4** Parent & paiements | Carnet (base), Duel bienveillant (25), offre Famille, cartes cadeaux, garde-fous | e2e « l'enfant n'atteint jamais un paiement » ; carte cadeau test | `billing` |
| **5** Labo IA & Détective | extension du `/lab` (sons, gestes, biais), Détective (2), Conseil des 3 IA (22), Robo (21), Tampon C2PA (17), dessin complété (18), chef d'orchestre (14) ; J4, J7, J8, J9 | modèle 3 classes entraîné < 2 min, 0 requête réseau ; Carnet sans clé | `lab_v2`, `detective` |
| **6** Voix & famille | STT/TTS locaux, voix du parent (3), famille connectée (4), trajet (6), fratrie (7), boîte à questions (23) ; ChildShield renforcé | histoire voix parent hors ligne ; trajet sans écran ; tests insultes/l33t/images ; compte non lié = 403 ; 0 audio vers un tiers | `family`, `trip`, `parent_voice` |
| **7** École & accessibilité | code de classe, tableau enseignant, Open Badges (19), passeport (29), prof d'un jour (27), données de classe (28), parcours adapté (10) | classe créée < 2 min (e2e chronométré) ; 0 donnée nominative obligatoire | `school` |
| **8** Mini-jeux par lots de 5 | 8a maths/logique · 8b code/lecture/créa · 8c sciences · 8d histoire · 8e géographie (+ globe F20) · 8f astronomie (+ F15) ; Fabrique ton jeu (24) | par jeu : tactile, local, zéro échec, lu à voix haute, ≥ 55 fps profil mobile, e2e de complétion | par jeu |
| **9** Saisons, livre, univers | saisons pré-générées (11), livre PDF (8), coloriages Lili (12), journal des erreurs heureuses (26) | PDF local prévisualisable ; saison servie depuis le cache, 0 génération | `seasons`, `book` |
| **10** Pages commerciales & kit atelier | Familles, Écoles, Cadeaux, démo du Labo sur l'accueil, kit atelier hors ligne (30) | Lighthouse ≥ 90 ; textes relus (aucun chiffre/avis inventé) | `pricing_pages` |

Ordre de priorité si le temps manque : 1 → 2 → 3 → 5 → 6 → 4 → 7 → 8 → 9 → 10 (la sécurité et le socle hors ligne d'abord ; le paiement attend la réponse D-09).

## 5. Coût zéro par fonction
| Fonction | Ce qui tourne | Coût |
|---|---|---|
| Labo, biais, gestes, dessin complété | TF.js / MediaPipe / Magenta dans le navigateur | 0 (chargés à la demande) |
| Détective, Conseil des 3 IA, Robo | contenu local scénarisé + moteur | 0 |
| Carnet, journal des erreurs | moteur + gabarits locaux ; reformulation NVIDIA optionnelle (quota) | 0 |
| Voix | pré-génération (une fois) + voix locale / Kokoro navigateur | 0 en usage |
| Famille connectée, fratrie | Supabase existant (Realtime, Storage) | dans l'offre actuelle — **volumes à surveiller** |
| Saisons, illustrations | pré-génération propriétaire (FLUX via NVIDIA, quota) | 0 en usage |
| Livre imprimé | PDF local ; impression payée par le client à la commande | 0 avance |
| École | mêmes tables, sans donnée nominative | 0 |
Point d'attention : le stockage Supabase (voix des parents, messages audio) peut dépasser l'offre gratuite → quotas par famille + alerte, à valider avant la phase 6.

## 6. Licences (règle 1.4)
- Script de vérification en CI (lockfile → licences) qui échoue hors MIT/Apache-2.0/BSD/0BSD/CC0 et signale ISC « en attente ».
- Existant à trancher : D-07 (lucide-react ISC, sharp LGPL, caniuse-lite CC-BY, polices OFL).
- Chaque nouvelle dépendance : re-vérification du LICENSE au moment de l'ajout, ligne dans `THIRD_PARTY_LICENSES.md`, `NOTICE` si Apache-2.0, page Crédits si CC-BY.
- Modèles : licence vérifiée **modèle par modèle** (MobileNet, speech-commands, MediaPipe hand landmarker, sketch-rnn, Kokoro + voix, Whisper/Vosk/Moonshine FR, nsfwjs, détecteurs) avant intégration ; tout doute → je m'arrête et te demande.

## 7. Sous-agents prévus (fichiers disjoints)
Phase 1 : audit routes/RLS · audit licences/THIRD_PARTY · rédaction LEGAL_KIDS (brouillon, à faire valider). Phase 8 : un agent par jeu (dossier `games/mechanics/<id>` propre). Contenus locaux (Détective, Conseil, saisons) rédigés en parallèle, relus par moi, passés au filtre ChildShield.

## 8. Ce dont j'ai besoin de toi pour démarrer
1. Feu vert sur ce plan (et l'ordre des phases).
2. Décisions D-03 à D-07 (chat, voix/Gemini payant ?, photo, IA en direct, licences existantes).
3. D-09 : solution de paiement du groupe.
4. Les fichiers `ziggy-stack.md` et `ziggy-github-repos.md` (D-10), et l'accès/la licence d'AuthenticSeal (D-11).
5. Actions de ta part (je ne touche pas aux secrets) : changer le mot de passe propriétaire (C9), activer la protection des mots de passe divulgués dans Supabase (C10).
