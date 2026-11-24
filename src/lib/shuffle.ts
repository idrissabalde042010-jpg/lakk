/**
 * Mélange Fisher-Yates — module partagé pour tout l'application.
 * Utilisé pour les QCM, banques de mots, paires à associer, etc.
 */

export function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Mélange un tableau et retourne une nouvelle référence (utile pour forcer le re-rendu)
 */
export function shuffleNew<T>(array: T[]): T[] {
  return shuffle([...array]);
}

/**
 * Sélectionne n éléments uniques au hasard
 */
export function sample<T>(array: T[], n: number): T[] {
  return shuffle(array).slice(0, Math.min(n, array.length));
}

/**
 * Crée un tableau d'indices mélangés pour accéder aux éléments dans un ordre aléatoire
 * sans modifier l'array original
 */
export function shuffledIndices(length: number): number[] {
  return shuffle(Array.from({ length }, (_, i) => i));
}