# Mode dodo — intégration des dix premières histoires

**Objectif :** reprendre le lecteur générique de Lili pour d01–d10, sans changer son comportement ni publier en production.

**Architecture :** une table id → dossier d’assets enrichit le catalogue avec couverture WebP et deux chansons FR + calages. Le lecteur musical et SongPrompter existants restent communs à toutes les histoires. Les scènes d10/4–6 sont livrées sous public/ et ajoutées au manifeste comme repli ; les images Supabase existantes restent prioritaires.

**Contraintes :** aucune nouvelle dépendance, aucun appel IA, aucun coût nouveau, aucun secret, aucune modification de configuration, de base ou du stockage en production. Ne pas fusionner ni déployer.

## Étapes
- [x] Ajouter un test de catalogue : d01–d10 ont deux chansons, les bons chemins, un calage fiable et une couverture ; d11–d30 et Lili restent inchangés. Exécuter `npx vitest run src/data/dodo/releases.test.ts` et constater l’échec initial.
- [x] Créer `src/data/dodo/assets.ts` ; enrichir le catalogue dans `src/data/dodo/index.ts` ; copier les 20 MP3/calages dans `public/dodo/<slug>/`, réencoder à 112 kb/s si nécessaire, convertir les dix couvertures en WebP.
- [x] Tester le manifeste sans Supabase, avec erreur de lecture et avec données distantes. Ajouter les trois illustrations d10 manquantes comme repli local dans `src/app/api/ziggy/dodo/assets/route.ts`.
- [x] Relancer les tests ciblés puis `npm run check` et `npm run build`. Vérifier localement d04 : chanson v1 par défaut, prompteur, passage v2, URLs audio/calage/couverture HTTP 200.
- [x] Écrire le bilan de validation ; commit avec l’auteur demandé. Aucune fusion ni mise en production.
