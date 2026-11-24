// Configuration i18n avec svelte-i18n
// Initialisation côté client uniquement (pas de SSR)

import { locale, waitLocale, init, register } from 'svelte-i18n';

// Enregistre les locales (chargement paresseux)
register('fr', () => import('./locales/fr.json'));
register('en', () => import('./locales/en.json'));

// Initialisation : locale par défaut = français, fallback = français
init({
  fallbackLocale: 'fr',
  initialLocale: 'fr',
  loadingDelay: 200, // ms avant d'afficher le fallback
  // formats: using default Intl formats
});

/**
 * Change la locale active et attend le chargement.
 * À appeler depuis les composants quand l'utilisateur change de langue.
 */
export async function setLocale(newLocale: 'fr' | 'en'): Promise<void> {
  locale.set(newLocale);
  await waitLocale(newLocale);
}

/**
 * Locale courante (réactive).
 * Utilisation : $locale dans les composants Svelte.
 */
export { locale };

/** Liste des locales supportées. */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Langues d'apprentissage disponibles (pour le sélecteur). */
export const LEARN_LANGUAGES = [
  { code: 'en', name: 'Anglais', available: true },
  { code: 'es', name: 'Espagnol', available: false },
  { code: 'wo', name: 'Wolof', available: false },
] as const;
export type LearnLanguage = (typeof LEARN_LANGUAGES)[number];