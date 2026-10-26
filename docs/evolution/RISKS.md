# Registre des risques

| Risque | Probabilité | Impact | Mitigation | Statut |
|---|---|---|---|---|
| Fuite de données enfant via RLS manquante | moyenne | critique | tests RLS croisés obligatoires par table (base locale), audit P1 | ouvert |
| Conversation libre enfant ↔ LLM encore en ligne (C1) | **élevée (existe aujourd'hui)** | critique | drapeau `child_chat=off` en P1, réponses scénarisées | ouvert |
| Photo d'enfant envoyée à un tiers (C4) | faible (consentement requis, peu utilisé) | critique | désactivation P1 | ouvert |
| Audio enfant vers Google (Web Speech) (C2) | moyenne | élevé | coupure par défaut P1, STT local P6 | ouvert |
| Contenu inapproprié généré | faible | critique | IA jamais en direct (D-06), ChildShield entrée/sortie, relecture humaine | ouvert |
| Dépassement de quota / coût surprise | moyenne | élevé | CostGuard (déjà en place) + table `ai_usage`, plafond sous le gratuit, repli local | partiellement couvert |
| Stockage Supabase saturé (voix, messages) | moyenne | moyen | quotas par famille, compression, alerte | ouvert |
| Licence qui change / ISC existant | moyenne | élevé | script licences en CI, re-vérification avant ajout, D-07 | ouvert |
| Modèles ML trop lourds sur mobile | élevée | moyen | chargement à la demande, modèles quantifiés, repli boutons | ouvert |
| Non-conformité RGPD / AI Act / Éducation nationale | moyenne | critique | LEGAL_KIDS.md, validation juriste avant lancement | ouvert |
| Régression de l'existant (20 mondes, dodo) | moyenne | élevé | 213 tests actuels + e2e de non-régression avant chaque PR | couvert en partie |
| Mot de passe propriétaire dans l'historique git (C9) | **avérée** | critique | changement du mot de passe (Maxime) | ouvert |
| Dépendance peu maintenue (mafs, d3-celestial…) | moyenne | faible | interface d'encapsulation, vendoring possible | ouvert |
| Correctifs critiques bloqués par le « rien sur main » | moyenne | élevé | PR P1 courte, fusion prioritaire par Maxime | ouvert |
