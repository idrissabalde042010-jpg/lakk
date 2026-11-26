// Fonction pure pour parser et valider un âge.
// Accepte un nombre ou une chaîne, retourne un entier entre 5 et 120, sinon null.

/**
 * Parse une valeur d'âge (nombre ou chaîne) en entier compris entre 5 et 120.
 * Retourne null si la valeur est invalide, manquante ou hors bornes.
 * N'appelle jamais .trim() sur un nombre.
 */
export function parseAge(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    const age = value;
    if (age >= 5 && age <= 120) return age;
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
    const age = parsed;
    if (age >= 5 && age <= 120) return age;
    return null;
  }
  return null;
}
