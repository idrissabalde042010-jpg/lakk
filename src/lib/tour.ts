// Visite guidée : état persistant + définition des étapes.
// Ce module est volontairement pur (aucun import de driver.js) pour rester
// testable sans DOM.

export const TOUR_KEY = 'lakk.tour.v1';
export const TOUR_DONE = 'done';

export interface TourStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TourStep {
  /** Sélecteur CSS de l'élément à mettre en avant. */
  element: string;
  title: string;
  description: string;
  side: 'top' | 'bottom' | 'left' | 'right';
}

/** Les trois étapes demandées : leçon, révision, profil. */
export const TOUR_STEPS: TourStep[] = [
  {
    element: '[data-tour="start"]',
    title: 'Commencer une leçon',
    description:
      'Appuie ici pour reprendre ton parcours. Chaque leçon mêle écoute, traduction et mots à reconstruire.',
    side: 'bottom',
  },
  {
    element: '[data-tour="review"]',
    title: 'Révision',
    description:
      'Lakk te rappelle les mots juste avant que tu les oublies. Deux minutes par jour suffisent pour ne plus perdre le fil.',
    side: 'top',
  },
  {
    element: '[data-tour="profile"]',
    title: 'Profil',
    description:
      'Change ton nom, choisis ton avatar et suis ta série et le nombre de mots appris.',
    side: 'top',
  },
];

function defaultStorage(): TourStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** La visite a-t-elle déjà été vue ? */
export function tourSeen(storage: TourStorage | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(TOUR_KEY) === TOUR_DONE;
  } catch {
    return false;
  }
}

/** Marque la visite comme vue (idempotent). */
export function markTourSeen(storage: TourStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(TOUR_KEY, TOUR_DONE);
  } catch {
    /* stockage indisponible : on continue sans persister */
  }
}

/** Autorise à revoir la visite au prochain lancement (ou tout de suite). */
export function resetTour(storage: TourStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(TOUR_KEY);
  } catch {
    /* ignore */
  }
}
