# Mode dodo — dix premières histoires musicales

## Contenu livré

- 20 chansons françaises (v1/v2) et leurs 20 calages de paroles, 10 nouvelles couvertures WebP.
- Débit MP3 : 112 kb/s, comme Lili ; environ 71,53 Mo pour les 20 chansons, maximum 4,13 Mo par fichier.
- Catalogue enrichi par une table id → dossier : même lecteur, mêmes réglages musicaux, mêmes paroles synchronisées que Lili, sans duplication du lecteur.
- La musique reste le choix initial ; les choix de voix et de version déjà enregistrés sont respectés.
- Lili et d11–d30 ne changent pas ; aucune dépendance ajoutée.

## Illustrations

Contrôle des URL du manifeste public effectué le 8 novembre 2026 (heure de Paris).

| Histoires | Scènes disponibles dans le manifeste public avant intégration | Réponse des images |
| --- | --- | --- |
| d01 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d02 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d03 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d04 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d05 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d06 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d07 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d08 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d09 | 1, 2, 3, 4, 5, 6 | HTTP 200 pour chaque scène listée |
| d10 | 1, 2, 3 | HTTP 200 pour chaque scène listée |

Les scènes 4, 5 et 6 de d10 manquent dans le bucket/manifeste existant. Elles sont donc livrées dans `public/dodo/pingouins/{4,5,6}.jpg` et ajoutées au manifeste comme repli local. Une future scène publiée dans Supabase restera prioritaire. Aucun objet ni ligne Supabase n’a été changé.

## Validation

- `npm run check` : typecheck, lint et **771 tests réussis** (58 fichiers).
- Tests ciblés dodo : **129 tests réussis**, dont les 15 nouveaux tests de catalogue/manifeste ; échec attendu constaté avant implémentation.
- `NEXT_TELEMETRY_DISABLED=1 NEXT_DIST_DIR=.next-dodo-integration npm run build` : **réussi**. L’ajout automatique du dossier de build à `tsconfig.json` a été retiré.
- Serveur du build local : **53 URL d’assets en HTTP 200** (20 MP3, 20 JSON, 10 couvertures, 3 scènes d10) ; streaming d04/v1 en HTTP 206 sur une requête Range.
- Les 20 durées audio correspondent aux durées des calages à moins de 0,2 seconde après compression ; qualité d’alignement de 96,0 à 98,9 %.
- Le manifeste local contient les scènes d10/4–6. Le HTML français pré-rendu de d04 et Lili contient la version musicale, v1 sélectionnée et les deux versions disponibles.
- Limite de contrôle : pas d’écoute ni de test interactif de prompteur dans un navigateur. Le serveur local présente une boucle 307 pour les pages françaises sans préfixe (`/dodo`, `/dodo/lili`, `/dodo/d04`), dans la réécriture next-intl non modifiée ; les pages EN et les assets répondent correctement. La page d04 actuellement en production répond HTTP 200. Il reste à contrôler la page FR sur une preview ou la production après publication autorisée.
- `npm ci` signale 16 vulnérabilités dans les dépendances déjà verrouillées (7 modérées, 6 élevées, 3 critiques). Aucune dépendance ni version n’a été modifiée dans cette intégration.

## Publication

Le checkout est issu de `origin/main` (`308caa5`) après `git fetch origin`. Aucune modification d’environnement, DNS, stockage de production ou base de données.
