# Tiers — skills et sources ajoutés (branche `claude/ziggy-creatures-lutins-20261112`)

Ce fichier complète `THIRD_PARTY_LICENSES.md` (licences des dépendances runtime).
Il recense uniquement les **skills Claude Code** installés pour la passe Usine à Créatures / Lutins Farceurs.

## awesome-gamedev-agent-skills

- Source : https://github.com/gamedev-skills/awesome-gamedev-agent-skills
- Licence : **Apache License 2.0** (fichier recopié dans `.claude/skills/LICENSE-awesome-gamedev-agent-skills`)
- Commit installé : `c6ca6c41c839b68319ffc08430b99ab768debc32` (2026-11-12, 08:38 Europe/Paris)
- Emplacement : `.claude/skills/`
- Rien n'est payant. Les skills Unity, Unreal, Godot, Roblox, Steam, itch et Phaser/PixiJS n'ont pas été installés (hors sujet ici, et pour limiter le budget de listing des skills).
- Le skill communautaire MIT `adamlyttleapps/claude-skill-game-assets-enhancer` n'a **pas** été installé : il s'appuie sur l'API payante fal.ai.

### Skills installés (19, tous Apache-2.0, même source)

| Skill | Rôle |
|---|---|
| `router` | Choisir 2 ou 3 skills selon le moteur et la tâche |
| `game-feel` | Juice : squash & stretch, particules, screen shake, hit-stop |
| `audio-design` | Sons, musique adaptative, feedback audio |
| `level-design` | Rythme, flow, défis |
| `procedural-gen` | Génération et combinatoire |
| `create-game-assets` | Direction artistique et pipeline d'assets (sans service payant) |
| `shader-programming` | Éclairage et effets |
| `game-ui-ux` | HUD et interface jeu, accessibilité |
| `physics-tuning` | Ressort, rebond, corps mous |
| `save-systems` | Sauvegarde locale sûre |
| `performance-optimization` | Perf mobile / WebGL |
| `camera-systems` | Caméra, framing |
| `input-systems` | Tactile, tablette, clavier |
| `threejs-scene-setup` | Scène three.js |
| `threejs-materials-lighting` | Matières et lumières three.js |
| `threejs-gltf-loading` | Chargement glTF si besoin (seulement assets MIT/Apache/BSD ou créés ici) |
| `bevy-ecs` | Référence ECS Rust (inspiration, pas d'obligation d'adopter Bevy) |
| `prototype-fast` | Itérer vite en gardant le jeu jouable |
| `game-docs` | Documenter les choix de design |

### Règle d'usage

- S'inspirer des skills, recopier uniquement du code **MIT / Apache-2.0 / BSD**, et le citer.
- Ne jamais appeler un service payant (fal.ai, APIs d'images, etc.), même si un fichier d'un skill le mentionne (`agents/openai.yaml` n'est qu'un descripteur de format, pas une clé).
- Les graphismes et les sons de cette passe sont générés en code (procédural / synthèse), ou repris d'assets déjà présents et licenciés correctement.
