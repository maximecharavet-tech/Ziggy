import type { L } from '@/lib/i18n-text';
import type { BoothSceneId } from '@/lib/santa/types';

/** Every visible text of the photo booth, FR + EN. */
export const T = {
  title: { fr: 'Photo avec le Père Noël', en: 'Photo with Santa' },
  chooseScene: { fr: 'Choisis où tu veux faire ta photo avec le Père Noël.', en: 'Choose where you want to take your photo with Santa.' },
  go: { fr: 'C’est parti !', en: 'Let’s go!' },
  sceneAria: { fr: 'Décor', en: 'Scene' },
  privacy: { fr: 'La photo reste sur ton appareil : elle n’est envoyée nulle part.', en: 'The photo stays on your device: it is never sent anywhere.' },
  cameraNoteTitle: { fr: 'Pour les parents', en: 'For parents' },
  cameraNote: {
    fr: 'On va allumer la caméra de face pour la photo. Le détourage se fait sur votre appareil : aucune image n’est envoyée, ni à Ziggy ni à personne.',
    en: 'We will turn on the front camera for the photo. The cut-out is made on your device: no picture is sent, not to Ziggy, not to anyone.',
  },
  cameraOn: { fr: 'Allumer la caméra', en: 'Turn on the camera' },
  pickPhoto: { fr: 'Choisir une photo', en: 'Choose a photo' },
  lookAndSmile: { fr: 'Regarde la caméra et fais un grand sourire ! Appuie sur le gros bouton rond.', en: 'Look at the camera and give a big smile! Press the big round button.' },
  shutter: { fr: 'Prendre la photo', en: 'Take the photo' },
  camOff: { fr: 'Pas de caméra ? Pas de souci !', en: 'No camera? No problem!' },
  camOffDenied: { fr: 'La caméra n’est pas allumée. Tu peux choisir une photo à la place, ou réessayer.', en: 'The camera is not on. You can choose a photo instead, or try again.' },
  camOffNone: { fr: 'On n’a pas trouvé de caméra. Choisis une jolie photo à la place !', en: 'We could not find a camera. Choose a nice photo instead!' },
  retry: { fr: 'Réessayer', en: 'Try again' },
  nativeCamera: { fr: 'Prendre une photo', en: 'Take a photo' },
  magic: { fr: 'La magie de Noël opère…', en: 'Christmas magic at work…' },
  magicSub: { fr: 'On te découpe avec des ciseaux magiques, sur ton appareil.', en: 'Magic scissors are cutting you out, right on your device.' },
  adjust: { fr: 'Déplace-toi avec ton doigt. Avec deux doigts, tu deviens plus grand ou plus petit.', en: 'Move yourself with your finger. With two fingers, you get bigger or smaller.' },
  bigger: { fr: 'Plus grand', en: 'Bigger' },
  smaller: { fr: 'Plus petit', en: 'Smaller' },
  recenter: { fr: 'Remettre au centre', en: 'Back to the middle' },
  nameLabel: { fr: 'Prénom sur la photo', en: 'Name on the photo' },
  namePlaceholder: { fr: 'Ton prénom', en: 'Your name' },
  perfect: { fr: 'C’est parfait !', en: 'Perfect!' },
  retake: { fr: 'Refaire', en: 'Retake' },
  ovalTip: { fr: 'Astuce : mets-toi bien en face, avec de la lumière, pour être découpé tout seul.', en: 'Tip: face the camera in good light to be cut out on your own.' },
  bravo: { fr: 'Bravo ! Voici ta photo avec le Père Noël.', en: 'Well done! Here is your photo with Santa.' },
  share: { fr: 'Partager', en: 'Share' },
  save: { fr: 'Enregistrer', en: 'Save' },
  shared: { fr: 'Envoyé !', en: 'Shared!' },
  saved: { fr: 'Enregistré !', en: 'Saved!' },
  makeVideo: { fr: 'Créer ma vidéo', en: 'Make my video' },
  videoHint: { fr: 'Une petite vidéo avec la neige, la musique et le Père Noël qui te fait coucou.', en: 'A little video with snow, music and Santa waving at you.' },
  recording: { fr: 'Le Père Noël tourne ta vidéo…', en: 'Santa is filming your video…' },
  videoReady: { fr: 'Ta vidéo est prête !', en: 'Your video is ready!' },
  shareVideo: { fr: 'Partager la vidéo', en: 'Share the video' },
  saveVideo: { fr: 'Enregistrer la vidéo', en: 'Save the video' },
  videoUnsupported: { fr: 'Ce navigateur ne sait pas encore faire de vidéo. La photo, elle, est prête !', en: 'This browser cannot make videos yet. Your photo is ready though!' },
  upsellTitle: { fr: 'Le Pack Noël', en: 'The Christmas Pack' },
  upsell: { fr: 'Photos en HD, sans filigrane, et petites vidéos avec le Père Noël. À voir avec un parent.', en: 'HD photos without watermark, and little videos with Santa. Ask a grown-up.' },
  upsellLink: { fr: 'Pour les parents', en: 'For parents' },
  hdBadge: { fr: 'HD', en: 'HD' },
  merry: { fr: 'Joyeux Noël', en: 'Merry Christmas' },
  christmas: { fr: 'Noël', en: 'Christmas' },
  watermark: { fr: 'ziggy-ai.fr — Pack Noël', en: 'ziggy-ai.fr — Christmas Pack' },
  photoAlt: { fr: 'Ta photo avec le Père Noël', en: 'Your photo with Santa' },
  shareTitle: { fr: 'Ma photo avec le Père Noël', en: 'My photo with Santa' },
  previewAria: { fr: 'Aperçu de ta photo avec le Père Noël', en: 'Preview of your photo with Santa' },
} satisfies Record<string, L>;

export const SCENES: { id: BoothSceneId; label: L; emoji: string; bg: string }[] = [
  { id: 'cheminee', label: { fr: 'La cheminée', en: 'The fireplace' }, emoji: '🔥', bg: 'from-[#8a2433] to-[#e0763a]' },
  { id: 'traineau', label: { fr: 'Le traîneau', en: 'The sleigh' }, emoji: '🛷', bg: 'from-[#0b1240] to-[#6a4a9a]' },
  { id: 'rennes', label: { fr: 'Les rennes', en: 'The reindeer' }, emoji: '🦌', bg: 'from-[#1d2a6b] to-[#f2a3a0]' },
  { id: 'atelier', label: { fr: 'L’atelier', en: 'The workshop' }, emoji: '🧸', bg: 'from-[#5a3418] to-[#d08a3a]' },
];

/** "Joyeux Noël Léa !" / "Merry Christmas Léa!" (or without a name). */
export function photoTitle(name: string, locale: string): string {
  const n = name.trim();
  if (locale === 'fr') return n ? `Joyeux Noël ${n} !` : 'Joyeux Noël !';
  return n ? `Merry Christmas ${n}!` : 'Merry Christmas!';
}
