# Jeux 3D (three.js)

Deux jeux 3D au style « PS2 » (low-poly, couleurs peintes, brouillard, ombres douces, halos lumineux),
entièrement construits en code : aucun modèle, texture ni son téléchargé.

- **Le Noël de Ziggy** (`/monde/3d/noel`) : village enneigé de nuit. 4 missions décidées par le moteur
  (couleurs pour les 4–6 ans, compter, puis additions qui doivent faire un nombre exact), livraison
  aux maisons, puis décoration du grand sapin (suites de couleurs). Toucher le sol pour marcher.
- **La Luge des nombres** (`/monde/3d/luge`) : descente en luge, 10 questions (compter, additions,
  soustractions, tables) ; on choisit l'arche de la bonne réponse parmi 3 couloirs, et on ramasse des étoiles.

Règles appliquées : zéro échec (une erreur donne un indice, rien n'est perdu), consignes lues à voix
haute (réponses couloir par couloir pour les petits), niveau adapté par le moteur et plafonné par l'âge,
résultats comptés dans la World Memory (XP, badges, Moments magiques), aucun réseau pendant le jeu.

Code : `src/games3d/kit` (rendu, modèles, neige, commandes, musique), `src/games3d/noel`,
`src/games3d/luge` (logique pure testée + scène), `src/components/games3d` (interfaces).
three.js est chargé à la demande au lancement d'une partie.
