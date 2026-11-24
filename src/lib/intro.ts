// Histoire d'introduction : état persistant + texte des 3 étapes.
// Module pur (aucun import DOM) pour rester testable.

export const INTRO_KEY = 'lakk.intro.v1';
export const INTRO_DONE = 'done';

export interface IntroStep {
  /** Petit titre au-dessus du texte. */
  title: string;
  /** Texte narratif affiché. */
  text: string;
  /** Libellé du bouton principal. */
  cta: string;
}

/** Les trois étapes de l'histoire de Lakk. */
export const INTRO_STEPS: IntroStep[] = [
  {
    title: 'Au cœur du Sénégal',
    text: "Il était une fois, au cœur du Sénégal, un petit arbre nommé Lakk. Il rêvait de devenir un grand baobab, assez haut pour toucher le ciel.",
    cta: 'Suivant',
  },
  {
    title: 'Le livre magique',
    text: "Un jour, il trouva un livre magique. Pour grandir, il devait apprendre l'anglais… et chaque mot appris faisait pousser une nouvelle feuille.",
    cta: 'Suivant',
  },
  {
    title: "À toi de jouer",
    text: "Aujourd'hui, Lakk a besoin de toi. Apprends avec lui, un mot à la fois, et fais grandir ton propre baobab. Es-tu prêt ?",
    cta: "C'est parti !",
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
