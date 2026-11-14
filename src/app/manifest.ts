import type { MetadataRoute } from 'next';
import { AGE_MAX, AGE_MIN } from '@/lib/ages';

/**
 * The web app manifest (served at /manifest.webmanifest, linked by Next).
 * French by default (the site's default language, no URL prefix); `start_url`
 * opens the app home, the same screen the Ziggy app starts on.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Ziggy — apprendre l’IA en jouant',
    short_name: 'Ziggy',
    description: `Le compagnon d’apprentissage de Ziggy pour les enfants curieux de ${AGE_MIN} à ${AGE_MAX} ans : jeux, histoires du soir, création. Sans publicité.`,
    lang: 'fr',
    dir: 'ltr',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#FAFBFC',
    theme_color: '#22C55E',
    categories: ['education', 'kids'],
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Full-bleed with the face inside the central 80 % (the safe zone).
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      { src: '/screenshots/1-accueil.jpg', sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Accueil de Ziggy' },
      { src: '/screenshots/2-monde.jpg', sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Le monde de Ziggy' },
      { src: '/screenshots/3-jeux.jpg', sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Les jeux' },
      { src: '/screenshots/4-creer.jpg', sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Créer avec Ziggy' },
      { src: '/screenshots/5-dodo.jpg', sizes: '1080x1920', type: 'image/jpeg', form_factor: 'narrow', label: 'Les histoires du soir' },
    ],
    shortcuts: [
      { name: 'Mode dodo', short_name: 'Dodo', description: 'Les histoires du soir', url: '/dodo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Jouer', short_name: 'Jouer', description: 'Le monde de jeux de Ziggy', url: '/monde', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Noël', short_name: 'Noël', description: 'L’appli du Père Noël', url: '/pere-noel', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
