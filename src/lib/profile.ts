// Profil : avatars et nom d'affichage (helpers purs, testables).

/** Les 5 avatars proposés (emojis). */
export const AVATARS = ['🦁', '🌳', '🥭', '🐘', '☀️'] as const;

export type Avatar = (typeof AVATARS)[number];

export const DEFAULT_AVATAR: Avatar = AVATARS[0];

export const MAX_NAME_LENGTH = 24;

/** Vérifie qu'une valeur est bien l'un des 5 avatars. */
export function isValidAvatar(value: unknown): value is Avatar {
  return typeof value === 'string' && (AVATARS as readonly string[]).includes(value);
}

/** Nettoie un nom : espaces multiples, bords, longueur maximale. */
export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/** Nom affiché, avec repli si le nom est vide. */
export function displayName(raw: string): string {
  return sanitizeName(raw) || 'Apprenant';
}
