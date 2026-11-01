# Les applications Ziggy AI (Android, Android TV, iPhone, iPad)

Ce document est pour toi, le propriétaire de Ziggy. Il explique ce qui a été construit, comment
tester l'application, ce que toi seul peux faire pour la publier, et les règles des stores pour les
applications destinées aux enfants.

## 1. Ce qui a été construit

Une seule application, `fr.ziggyai.app`, nom affiché **Ziggy AI**, version 1.0.0 (build 1), pour :

- les téléphones et tablettes Android (Android 7 et plus),
- Android TV, Google TV et Fire TV (télécommande, écran d'accueil TV avec bannière),
- les iPhone et iPad (iOS / iPadOS 15 et plus, application universelle).

C'est une coque native écrite en **Rust** avec **Tauri 2** (licences MIT / Apache-2.0) qui affiche le site
https://ziggy-ai.fr. Le site reconnaît l'application et passe en **mode app** (barre d'onglets, bouton
Parents, pas de prix ni de liens commerciaux, liens extérieurs derrière la barrière « grand »), et sur
une TV en **mode TV** (navigation à la télécommande).

| Où | Quoi |
|---|---|
| `apps/ziggy-app/src-tauri/src/` | Le cœur, en Rust : règles de navigation, commandes appelées par le site, détection TV, bouton retour, audio iOS, retour haptique |
| `apps/ziggy-app/src-tauri/src/shell.js` | Petit script injecté dans chaque page : supprime les « artefacts web » et règle la couleur de la barre d'état |
| `apps/ziggy-app/www/` | La page de lancement embarquée (Ziggy sur la couleur du site), qui devient la page « pas d'Internet » |
| `apps/ziggy-app/src-tauri/gen/android/` | Le projet Android (manifeste, icônes, bannière TV, thème, 2 petits rappels Kotlin imposés par Android) |
| `apps/ziggy-app/src-tauri/ios/`, `Info.ios.plist` | Les réglages iPhone/iPad (icône, écran de lancement, audio en arrière-plan, manifeste de confidentialité) |
| `apps/ziggy-app/scripts/` | Génération des images (icônes, bannière, captures des stores), contrôle des licences, scripts iOS |
| `apps/ziggy-app/store/` | Les images prêtes pour Google Play et l'App Store |
| `.github/workflows/apps.yml` | La fabrication des applications sur GitHub Actions |

### Ce que fait l'application, en natif

- **Lancement sans flash blanc** : l'écran de démarrage du système montre Ziggy sur la couleur de fond du
  site (clair ou sombre selon le téléphone), puis la page de lancement embarquée reprend exactement la même
  image (Ziggy « respire » doucement), et le site apparaît dès qu'il est prêt.
- **Pas d'Internet** : l'application le vérifie avant d'ouvrir le site. Sans réseau, Ziggy affiche une page
  amicale en français ou en anglais (« Pas d'Internet pour le moment — Ziggy t'attend ! Demande à un grand
  de vérifier le Wi-Fi »), avec un gros bouton **Réessayer**, un bouton 🔊 qui lit le message quand le
  système sait le faire, et un nouvel essai automatique dès que le réseau revient. Si la connexion coupe
  pendant une partie, le site affiche sa propre page hors ligne (service worker) ou, à défaut, la même page
  de Ziggy, qui ramène l'enfant là où il était.
- **L'enfant ne peut pas sortir de Ziggy** : la fenêtre n'ouvre que ziggy-ai.fr, www.ziggy-ai.fr, le projet
  Supabase de Ziggy et la page embarquée. Tout autre lien est bloqué ; le site doit passer par sa barrière
  « grand » puis demander à l'application d'ouvrir le lien dans le navigateur, et l'application revérifie
  l'adresse (https vers un vrai nom de domaine, ou mailto).
- **Bouton retour Android** : il revient en arrière dans l'historique ; au bout de l'historique, le site
  décide (fermer un panneau, revenir à l'accueil de l'app, ou demander « Tu veux quitter Ziggy ? ») ; sur la
  page embarquée, l'application passe en arrière-plan comme toute application Android.
- **Android TV / Google TV / Fire TV** : détectée en Rust (mode d'interface « télévision », fonction
  `leanback` ou fonction Fire TV d'Amazon). L'application apparaît sur l'écran d'accueil de la TV avec sa
  bannière 320×180 ; le site passe en mode TV.
- **Histoires du soir sur iPhone/iPad** : l'audio continue écran verrouillé et en mode silencieux (session
  audio « lecture » + mode arrière-plan audio).
- **Retour haptique** léger quand le site le demande (téléphones uniquement, réglage « vibrations au
  toucher » du système respecté ; aucune permission « vibreur » sur Android).
- **Barre d'état lisible** : icônes claires sur les pages sombres (mode dodo), foncées sur les pages claires,
  automatiquement.
- **Aucun « artefact web »** : pas de surbrillance bleue au toucher, pas de menu par appui long, pas de
  sélection de texte sur les boutons, pas de zoom par pincement ou double tape, pas d'effet élastique qui
  montre du blanc. Les champs de saisie restent sélectionnables. Le clavier rétrécit la page (pas de champ
  caché derrière).
- **Micro coupé** : dans l'application, la reconnaissance vocale et l'accès au micro/à la caméra par la page
  sont désactivés, pour qu'aucune voix d'enfant ne parte chez Google ou Apple. Le site cache donc la dictée.
- **Orientation** : téléphone en portrait et paysage (jeux), tablettes et iPad dans tous les sens, TV en
  paysage.

### Contrat entre l'application et le site

- Jeton ajouté au user agent (défini dans `src/lib/app-shell.ts`) : `ZiggyApp/1.0.0 (android)`,
  `ZiggyApp/1.0.0 (android; tv)` ou `ZiggyApp/1.0.0 (ios)`.
- Commandes (appelées depuis `src/lib/app-bridge.ts`) : `app_info` → `{ platform, tv, version }`, `exit_app`
  (Android seulement ; une app iOS ne se ferme jamais elle-même), `haptic(kind)` (`light`, `medium`, `heavy`,
  `selection`, `success`, `warning`, `error`), `open_external(url)`, `set_bar_style(style)` (`dark` / `light`).
- Événement : `ziggy://back`, le bouton retour Android arrivé au bout de l'historique.
- Une page peut forcer la couleur des icônes de la barre d'état avec `<html data-app-bars="dark">` (page
  sombre) ou `"light"`.

Rien d'autre n'est accessible depuis le web : ni fichiers, ni autres modules.

## 2. Tester l'application

### Le plus simple : la page « Applis » du site

**ziggy-ai.fr/telecharger** (onglet « Applis » du menu, lien en bas de page) : un bouton « Télécharger pour
Android », les étapes pour la télé, l'iPhone et l'iPad, et un QR code pour passer de l'ordinateur au téléphone.
Le bouton pointe sur **ziggy-ai.fr/apk**, une adresse courte à taper sur une télé (appli Downloader), qui renvoie
vers l'APK de la dernière « release » GitHub (onglet **Releases** du dépôt).

Cette release est publiée automatiquement par le CI (job « Publish the Android download ») à chaque fabrication
Android sur `main`, c'est-à-dire quand `apps/ziggy-app/` change. À la main : Actions → **Apps** → **Run
workflow**, case « Publish » cochée, ou pousser un commit qui touche `apps/` avec `[apk]` dans son message. Tant que la clé de signature n'est pas configurée, l'APK publié est signé avec
une clé de test qui change à chaque fabrication : pour passer à une nouvelle version, il faut désinstaller
l'ancienne. Dès que les secrets `ANDROID_*` existent, l'APK publié est signé avec ta clé.

### Télécharger le fichier de test (APK) depuis le CI

1. Sur GitHub : onglet **Actions** → workflow **Apps** → la dernière exécution verte.
2. En bas de la page, section **Artifacts** : télécharger **ziggy-ai-android** (un .zip).
3. Dans le zip : `ziggy-ai-android-debug.apk` (environ 18 Mo, s'installe sur téléphone, tablette et TV) et
   `ziggy-ai-android-debug-signed.aab` (format du Play Store, inutile pour tester).

Cet APK est une version optimisée signée avec une **clé de test** : il sert à essayer, pas à publier. Avant
d'installer plus tard la version du Play Store, désinstalle-le (les signatures sont différentes).

### Sur un téléphone ou une tablette Android

- Le plus simple : envoie-toi l'APK (Drive, e-mail…), ouvre-le sur le téléphone et accepte « installer
  des applications inconnues » pour l'application qui l'ouvre.
- Ou avec un ordinateur : activer les **Options pour les développeurs** (Paramètres → À propos → appuyer 7 fois
  sur « Numéro de build »), puis **Débogage USB**, brancher le téléphone et lancer
  `adb install -r ziggy-ai-android-debug.apk`.

### Sur une Android TV / Google TV

1. Sur la TV : Paramètres → Système → À propos → appuyer 7 fois sur **Version de l'OS Android TV** (ou
   « Build ») pour activer les options pour les développeurs.
2. Méthode sans ordinateur : installer l'application **Send files to TV** sur le téléphone et sur la TV,
   envoyer l'APK, puis l'ouvrir sur la TV avec un gestionnaire de fichiers (autoriser les sources inconnues
   pour lui).
3. Méthode avec ordinateur : dans les options pour les développeurs, activer le **Débogage réseau** (ou
   « Débogage ADB »), noter l'adresse IP de la TV, puis :
   `adb connect 192.168.x.y:5555` et `adb install -r ziggy-ai-android-debug.apk`.
4. Ziggy AI apparaît dans la rangée des applications, avec sa bannière.

Sur une **Fire TV** : Paramètres → Ma Fire TV → Options pour les développeurs → Applications de sources
inconnues, puis installer avec l'application **Downloader** ou avec `adb` comme ci-dessus.

### Sur iPhone / iPad

Sans compte Apple Developer, on ne peut pas installer sur un vrai iPhone. Le CI fabrique une version pour le
**simulateur** (artifact `ziggy-ai-ios-simulator`), utilisable sur un Mac avec Xcode : décompresser, puis
glisser le `.app` sur un simulateur ouvert. Pour la lancer : Actions → **Apps** → **Run workflow** (case
« iOS » cochée), ou pousser un commit dont le message contient `[ios]`. Le build iOS tourne sur un Mac de
GitHub, dont les minutes coûtent 10 fois plus cher sur un dépôt privé : il ne se lance que sur demande.

## 3. Ce que toi seul peux faire pour publier

Ces deux comptes sont des **nouveaux coûts** : c'est ta décision.

| | Google Play | App Store (Apple) |
|---|---|---|
| Compte | Google Play Console | Apple Developer Program |
| Prix | **25 $ une seule fois** | **99 € par an** |
| Délai | vérification d'identité, quelques jours | vérification, quelques jours |

### Publier sur Google Play

1. Créer le compte Play Console (vérification d'identité). Un compte **personnel** récent doit faire un
   **test fermé** (au moins 12 testeurs pendant 14 jours) avant la mise en production ; un compte
   **organisation** (numéro D-U-N-S) n'a pas cette étape.
2. Créer la **clé d'envoi** (upload key) sur ton ordinateur, une fois, et la garder précieusement (coffre de
   mots de passe + copie de secours) :
   ```
   keytool -genkeypair -v -keystore ziggy-upload.jks -keyalg RSA -keysize 4096 -validity 10000 -alias ziggy-upload
   base64 -w0 ziggy-upload.jks > ziggy-upload.jks.b64      # sur Mac : base64 -i ziggy-upload.jks -o ziggy-upload.jks.b64
   ```
3. Sur GitHub : Settings → Secrets and variables → Actions → **New repository secret**, quatre secrets :
   `ANDROID_KEYSTORE_BASE64` (le contenu de `ziggy-upload.jks.b64`), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`ziggy-upload`), `ANDROID_KEY_PASSWORD` (souvent le même mot de passe).
   Dès lors, le CI produit `ziggy-ai-android.aab` signé, prêt à envoyer.
4. Dans Play Console : créer l'application « Ziggy AI », activer **Play App Signing** (Google garde la clé de
   signature finale, toi la clé d'envoi), envoyer l'AAB dans un test interne puis fermé.
5. Pour chaque nouvelle version envoyée : augmenter `bundle.android.versionCode` (1, 2, 3…) dans
   `apps/ziggy-app/src-tauri/tauri.conf.json`.
6. Fiche du store : icône `store/google-play/icon-512.png`, image de présentation
   `store/google-play/feature-graphic-1024x500.jpg`, captures `store/google-play/phone|tablet-7in|tablet-10in/`,
   et pour la TV : bannière `store/google-play/tv-banner-1280x720.jpg` et captures `store/google-play/tv/`
   (Android TV demande aussi d'activer « Android TV » dans *Advanced settings → Form factors*, puis une
   revue spécifique TV).

### Publier sur l'App Store

1. Adhérer à l'Apple Developer Program (99 €/an) ; noter le **Team ID**.
2. Dans App Store Connect : créer l'app avec l'identifiant `fr.ziggyai.app`, nom « Ziggy AI ».
3. Créer un certificat **Apple Distribution** (exporté en .p12 avec un mot de passe) et un profil de
   provisionnement **App Store** pour `fr.ziggyai.app` ; créer une **clé API App Store Connect** (.p8).
4. Ajouter les secrets GitHub : `APPLE_DEVELOPMENT_TEAM`, `IOS_CERTIFICATE` (le .p12 en base64),
   `IOS_CERTIFICATE_PASSWORD`, `IOS_MOBILE_PROVISION` (le profil en base64), `APPLE_API_KEY`,
   `APPLE_API_ISSUER` et la clé .p8. Le job signé est décrit à la fin de `.github/workflows/apps.yml`
   (`tauri ios build --export-method app-store-connect` puis envoi vers **TestFlight**).
5. Tester avec TestFlight sur un iPhone et un iPad, puis soumettre à la revue. Captures :
   `store/app-store/iphone-6.9in/` et `store/app-store/ipad-13in/` ; l'icône vient de l'application.
6. Pour chaque version : augmenter `bundle.iOS.bundleVersion` (et la version 1.0.0 → 1.0.1 pour une mise à jour
   visible).

## 4. Applications pour enfants : les règles des stores

### Google Play — programme « Familles »

- Dans *Contenu de l'application → Public cible*, choisir les tranches d'âge (par exemple 5 ans et moins,
  6–8, 9–12). L'application doit alors respecter le **règlement Familles** : pas de publicité (aucune),
  pas d'identifiant publicitaire (l'application le retire explicitement), pas de SDK non certifié pour les
  familles (aucun SDK tiers), contenu adapté, et pour les fonctions d'IA générative, des protections
  (ChildShield).
- **Teacher Approved** : il n'y a pas de candidature ; les applications du programme Familles peuvent être
  choisies par les enseignants évaluateurs de Google. Une fiche soignée et un contenu éducatif clair aident.
- Politique de confidentialité : **https://ziggy-ai.fr/privacy** (obligatoire, dans la fiche et dans l'app).

### Apple — catégorie « Enfants » (Kids)

- Choisir la catégorie **Kids** et une tranche d'âge (5 ans et moins, 6–8, 9–11).
- Obligatoire : une **barrière parentale** avant tout lien qui sort de l'application, tout achat, toute
  demande de permission (le site l'a en mode app ; l'application bloque les autres liens) ;
  **aucune analyse d'audience ni publicité de tiers** (il n'y en a pas) ; politique de confidentialité.
- Point à décider par toi : Apple demande qu'une app de la catégorie Enfants n'envoie pas de données
  personnelles à des tiers. Les fournisseurs d'IA du site (DeepSeek, NVIDIA, Agnes AI, Google Gemini pour la
  voix de Ziggy et le chat) reçoivent du texte ou une photo (avatar, sur consentement parental). Vérifie
  qu'en mode app aucune fonction n'envoie du texte libre écrit par un enfant, et décris clairement ces
  sous-traitants dans la fiche de confidentialité.

### Ce que le site collecte réellement (pour la fiche « Sécurité des données » de Google et les « étiquettes de confidentialité » d'Apple)

Lu dans le code (`src/lib`, `src/app/api`, `supabase/migrations`) — l'application elle-même ne collecte rien
de plus : pas d'analytics, pas de rapport de plantage, pas d'identifiant d'appareil.

| Donnée | Quand | Où | Lien avec le compte |
|---|---|---|---|
| Adresse e-mail et mot de passe du parent | création d'un compte (facultatif : on peut jouer sans compte) | Supabase (Paris) | oui |
| Prénom de l'enfant, tranche d'âge, avatar choisi | création du compte (`profiles`) | Supabase | oui |
| Résultats de jeux (jeu, score, étoiles) | fin de partie, si connecté (`game_results`) | Supabase | oui |
| Progression Ziggy World, compétences, choix | si connecté (`ziggy_world_state`) ; sinon seulement sur l'appareil | Supabase / appareil | oui |
| Histoires créées, images d'avatar générées | Ziggy World, compte parent (`ziggy_stories`, `ziggy_avatars`) | Supabase | oui |
| Historique des générations IA (sans contenu), catégories bloquées par le filtre | `ziggy_generations`, `ziggy_safety_events` | Supabase | oui |
| Consentements parentaux | Espace parents (`ziggy_consents`) | Supabase | oui |
| Photo pour l'avatar | facultatif, à l'initiative du parent, avec consentement | traitée **en mémoire** par NVIDIA, jamais enregistrée | traitement éphémère |
| Texte envoyé au chat de Ziggy / texte lu par la voix de Ziggy | si l'enfant écrit au chat ; lecture à voix haute | Google Gemini, non conservé | traitement éphémère |
| Journaux techniques du serveur (adresse IP) | à chaque requête | hébergeur Vercel | à déclarer selon ton choix |

À déclarer côté Google : *Informations personnelles* (e-mail, nom), *Activité dans l'application* et
*Contenu généré par l'utilisateur*, *Photos* (traitées de manière éphémère), toutes « non partagées »
(sous-traitants), chiffrées en transit, avec **suppression possible** (Espace parents). Côté Apple :
*Coordonnées* (e-mail), *Identifiants* (ID utilisateur), *Contenu utilisateur* (histoires, contenu de jeu),
« liées à l'utilisateur », **non utilisées pour le suivi** ; les données traitées en temps réel sans être
conservées (photo, texte lu à voix haute) peuvent ne pas être déclarées selon les règles d'Apple.

## 5. Le risque « simple site web dans une app » (règle Apple 4.2)

Apple refuse les applications qui ne sont qu'un site web « emballé ». Ce qui a été ajouté pour montrer une
vraie valeur native :

- un démarrage natif soigné et une **page hors ligne** embarquée, avec nouvel essai automatique ;
- **l'audio en arrière-plan** pour les histoires du soir (écran verrouillé) ;
- le **retour haptique** natif, la **barre d'état** adaptée à chaque page ;
- le **mode app** du site (navigation par onglets, accueil dédié, barrière parentale), et sur Android le
  **bouton retour** natif et le **mode TV** à la télécommande ;
- aucune trace de navigateur : pas de zoom, pas de menus, pas de sélection, pas de rebond.

Le risque reste réel : si Apple refuse, la réponse habituelle est de détailler ces fonctions dans les notes
pour la revue (avec une courte vidéo). Google Play est moins strict sur ce point.

## 6. Mettre à jour

- **Le contenu (le site)** : chaque déploiement de ziggy-ai.fr est visible **immédiatement** dans les
  applications, sans passer par les stores.
- **La coque native** (icône, permissions, comportement natif, version de Tauri) : seulement quand on modifie
  `apps/ziggy-app/`. Le CI fabrique alors un nouvel APK/AAB ; il faut augmenter le numéro de build
  (`versionCode` Android, `bundleVersion` iOS) et renvoyer aux stores.
- Si le site change son contrat avec l'application (commandes, événement, user agent), il faut garder la
  compatibilité avec les applications déjà installées.

## 7. Licences

Seul du code MIT / Apache-2.0 / BSD est compilé dans les applications. Deux petites briques MPL-2.0 de
Tauri sont remplacées par des versions MIT écrites pour Ziggy (`apps/ziggy-app/src-tauri/patches/`).
**À valider par toi** : 15 briques ICU4X (gestion Unicode des adresses web, utilisées par Tauri) sont sous
licence **Unicode-3.0**, une licence permissive de type MIT, hors de la liste MIT/Apache/BSD. Détails :
`THIRD_PARTY_LICENSES.md` et `apps/ziggy-app/THIRD_PARTY_CRATES.md`.

## 8. Pour les développeurs

```
cd apps/ziggy-app
npm ci                                  # la CLI Tauri
npm run check                           # fmt + clippy (ordinateur, Android, iOS) + tests Rust
npm run android:build                   # nécessite le SDK + NDK Android (NDK_HOME)
npm run assets                          # régénère icônes, bannières, marques de lancement
node scripts/store-screenshots.mjs      # captures des stores (site lancé sur le port 3320)
node scripts/licenses.mjs               # liste des licences compilées
```

Le projet Xcode (`src-tauri/gen/apple`) ne peut être généré que sur un Mac : le CI le crée au premier build
iOS (`tauri ios init` + `scripts/ios-overlay.sh`) et le publie sur la branche `ci/ziggy-app-gen-apple` pour
qu'il soit relu puis versionné.
