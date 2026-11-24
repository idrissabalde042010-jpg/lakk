// Histoire d'introduction : état persistant + clés i18n des 3 étapes.
// Module pur (aucun import DOM) pour rester testable.

export const INTRO_KEY = 'lakk.intro.v1';
export const INTRO_DONE = 'done';

export interface IntroStep {
  /** Clé i18n pour le titre. */
  titleKey: string;
  /** Clé i18n pour le texte narratif. */
  textKey: string;
  /** Clé i18n pour le libellé du bouton principal. */
  ctaKey: string;
}

/** Les trois étapes de l'histoire de Lakk (clés i18n). */
export const INTRO_STEPS: IntroStep[] = [
  {
    titleKey: 'intro.step1_title',
    textKey: 'intro.step1_text',
    ctaKey: 'intro.step1_cta',
  },
  {
    titleKey: 'intro.step2_title',
    textKey: 'intro.step2_text',
    ctaKey: 'intro.step2_cta',
  },
  {
    titleKey: 'intro.step3_title',
    textKey: 'intro.step3_text',
    ctaKey: 'intro.step3_cta',
  },
];

export interface IntroStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): IntroStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** L'histoire a-t-elle déjà été vue ? */
export function introSeen(storage: IntroStorage | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(INTRO_KEY) === INTRO_DONE;
  } catch {
    return false;
  }
}

/** Marque l'histoire comme vue (idempotent). */
export function markIntroSeen(storage: IntroStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(INTRO_KEY, INTRO_DONE);
  } catch {
    /* stockage indisponible : on continue sans persister */
  }
}

/** Rejoue l'histoire au prochain lancement. */
export function resetIntro(storage: IntroStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(INTRO_KEY);
  } catch {
    /* ignore */
  }
}
