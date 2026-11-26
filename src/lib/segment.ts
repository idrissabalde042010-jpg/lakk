// Segment utilisateur selon l'âge.
// Fonction pure, sans dépendance, facilement testable.

export type UserSegment = 'ado' | 'jeune_adulte' | 'adulte' | 'senior';

/**
 * Retourne le segment d'un utilisateur selon son âge.
 * - ado: 13-17
 * - jeune adulte: 18-29
 * - adulte: 30-59
 * - senior: 60+
 * Retourne null si l'âge est inconnu ou < 13.
 */
export function getUserSegment(age: number | null): UserSegment | null {
  if (age === null || age === undefined) return null;
  if (age < 13) return null;
  if (age <= 17) return 'ado';
  if (age <= 29) return 'jeune_adulte';
  if (age <= 59) return 'adulte';
  return 'senior';
}

/** Libellé d'affichage d'un segment (français). */
export function segmentLabel(segment: UserSegment): string {
  const labels: Record<UserSegment, string> = {
    ado: 'Adolescent',
    jeune_adulte: 'Jeune adulte',
    adulte: 'Adulte',
    senior: 'Senior',
  };
  return labels[segment];
}
