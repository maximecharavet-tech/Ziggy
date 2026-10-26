# Journal des décisions — Ziggy evolution

Format : contexte · options · choix · raison · risques. **Statut** : `proposé` (attend Maxime) · `validé` · `rejeté`.

---

### D-01 · Branches et déploiement — proposé
- **Contexte** : jusqu'ici, chaque version était poussée sur `main` (= production Vercel). La mission v3 interdit de pousser sur `main` et de déployer.
- **Choix** : branche d'intégration `feat/ziggy-evolution` ; une sous-branche et une PR par phase (`feat/ziggy-evolution-p<N>-<nom>` → `feat/ziggy-evolution`). Rien sur `main`, aucune variable Vercel modifiée.
- **Risque** : les correctifs urgents de production (C1, C4) attendent ta fusion. Je peux préparer une PR « phase 1 critique » courte vers `main` si tu me le demandes explicitement.

### D-02 · Architecture : étendre en place, pas de grand déménagement — proposé
- **Contexte** : la section 9 propose `src/engine`, `src/ai`, `src/childshield`, groupes `(child)/(parent)/(school)`. L'existant vit dans `src/lib/{world,learning,hyper-engine,safety,arcade,dodo}` et `src/app/[locale]/...`.
- **Options** : (a) tout déplacer d'un coup ; (b) créer les dossiers cibles comme **façades** et migrer module par module ; (c) ne rien changer.
- **Choix** : (b). `src/engine/index.ts` réexporte le moteur actuel, `src/ai/` regroupe les fournisseurs, `src/childshield/` réexporte `safety`. Les règles d'import (« engine n'importe jamais ai », « l'espace enfant n'importe jamais billing ») sont **imposées par ESLint** (`no-restricted-imports`) et testées. Les groupes de routes `(child)/(parent)/(school)` sont ajoutés pour les **nouvelles** pages ; les URL publiques existantes (`/monde`, `/dodo`, `/lab`…) ne changent pas (pas de liens cassés).
- **Risque** : deux chemins pendant la transition ; chaque déplacement est noté ici.

### D-03 · Conversation libre avec un LLM (C1) — proposé
- **Choix** : drapeau `child_chat=false` par défaut ; l'onglet « parler à Ziggy » devient un dialogue scénarisé local (arbre de réponses écrites à la main + lecture à voix haute). Le chat LLM reste accessible uniquement dans un espace adulte si tu le veux.
- **Raison** : règle 1.2, conditions Gemini gratuit (EEE).

### D-04 · Voix (C2, C3) — proposé
- **Choix** : par défaut, (1) audio pré-généré (dodo, consignes fréquentes), (2) voix locale de l'appareil, (3) Kokoro-82M dans le navigateur (phase 6, voix `ff_siwis`, licence du modèle et de la voix à re-vérifier). Gemini TTS direct uniquement si tu confirmes un compte **payant**. Micro : Web Speech API coupée par défaut ; STT local en phase 6.
- **Question** : ton compte Gemini est-il en offre payante (Paid Services) ?

### D-05 · Photo d'enfant (C4) — proposé
- **Choix** : désactiver le parcours « avatar depuis une photo » (drapeau), supprimer l'appel NVIDIA vision. Alternative locale possible en phase 5 (repères du visage MediaPipe dans le navigateur, rien n'est envoyé) — à confirmer.

### D-06 · Génération IA en direct (C5, C6) — proposé
- **Choix** : contenu local par défaut ; l'IA ne sert plus qu'à (a) la pré-génération par le propriétaire avec relecture, (b) la reformulation de textes déjà choisis par le moteur (`/ai/rephrase`, CostGuard, repli local). Story Builder : histoires locales (gabarits) ; variantes IA pré-générées et relues.

### D-07 · Licences de l'existant (C11) — **à valider par Maxime**
- `lucide-react` (ISC) est **déjà utilisé** (icônes). Options : (a) le garder (ISC est une licence permissive proche de MIT) ; (b) le remplacer par une bibliothèque MIT (ex. Heroicons MIT) ou des SVG maison.
- `picocolors`, `semver` (ISC) : dépendances internes de Next.js, non remplaçables sans quitter Next → à accepter ou à exclure de la règle.
- `sharp` + libvips (LGPL-3.0) : binaire optionnel de Next (optimisation d'images), lié dynamiquement. Option : le désactiver (`images.unoptimized`) ou l'accepter comme dépendance système non modifiée.
- `caniuse-lite` (CC-BY-4.0) : données utilisées au build seulement → mention en page Crédits.
- Fredoka, Andika, OpenDyslexic, Lexend, Atkinson (OFL-1.1) : licence de police permissive, proposée comme autorisée pour les **polices** uniquement.

### D-08 · Modèle de données — proposé
- **Contexte** : `profiles` lie un parent à un profil enfant ; la section 10 veut familles, plusieurs enfants, classes.
- **Choix** : tables additives (`families`, `family_members`, `children`, …) ; `ziggy_world_state` gagne une colonne `child_id` nullable. Le **backfill** des données existantes (5 profils) est une migration qui touche des données → soumis à ton accord, script `down` testé.

### D-09 · Paiements — à clarifier
- Aucun Stripe dans ce dépôt. Question : quelle solution de paiement est « déjà utilisée dans le groupe » (compte Stripe existant ? autre) ? Sans réponse, la phase 4 se limite au mode test sans clé.

### D-10 · Fichiers annexes manquants — bloquant mineur
- `ziggy-stack.md` et `ziggy-github-repos.md` ne sont pas joints. STACK.md et GITHUB_REPOS.md seront créés dès réception (pas de contenu inventé).

### D-11 · AuthenticSeal — à clarifier
- Fonctions 2, 3, 17, 29 citent AuthenticSeal (sceau de consentement, provenance). Le dépôt n'est pas accessible dans cette session ; il faut son accès (et sa licence) ou une spécification d'API. En attendant : C2PA via `@contentauth/c2pa-web` (licence à re-vérifier).
