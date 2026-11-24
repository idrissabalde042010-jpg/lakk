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
  { code: 'en', name: 'Anglais', native: 'English', available: true },
  { code: 'es', name: 'Espagnol', native: 'Español', available: false },
  { code: 'de', name: 'Allemand', native: 'Deutsch', available: false },
  { code: 'ar', name: 'Arabe', native: 'العربية', available: false },
  { code: 'zh', name: 'Chinois', native: '中文', available: false },
  { code: 'pt', name: 'Portugais', native: 'Português', available: false },
  { code: 'ru', name: 'Russe', native: 'Русский', available: false },
  { code: 'ja', name: 'Japonais', native: '日本語', available: false },
  { code: 'ko', name: 'Coréen', native: '한국어', available: false },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', available: false },
  { code: 'it', name: 'Italien', native: 'Italiano', available: false },
  { code: 'tr', name: 'Turc', native: 'Türkçe', available: false },
  { code: 'nl', name: 'Néerlandais', native: 'Nederlands', available: false },
  { code: 'pl', name: 'Polonais', native: 'Polski', available: false },
  { code: 'vi', name: 'Vietnamien', native: 'Tiếng Việt', available: false },
  { code: 'wo', name: 'Wolof', native: 'Wolof', available: false },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', available: false },
  { code: 'ha', name: 'Haoussa', native: 'Hausa', available: false },
  { code: 'am', name: 'Amharique', native: 'አማርኛ', available: false },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', available: false },
] as const;
export type LearnLanguage = (typeof LEARN_LANGUAGES)[number];