import { describe, it, expect } from 'vitest';
import { AVATARS, DEFAULT_AVATAR, displayName, isValidAvatar, MAX_NAME_LENGTH, sanitizeName } from './profile';

describe('profile.ts', () => {
  it('propose exactement 5 avatars uniques', () => {
    expect(AVATARS).toHaveLength(5);
    expect(new Set(AVATARS).size).toBe(5);
    expect(AVATARS).toContain(DEFAULT_AVATAR);
  });

  it('valide uniquement les 5 avatars autorisés', () => {
    for (const avatar of AVATARS) expect(isValidAvatar(avatar)).toBe(true);
    expect(isValidAvatar('🐍')).toBe(false);
    expect(isValidAvatar('')).toBe(false);
    expect(isValidAvatar(null)).toBe(false);
    expect(isValidAvatar(42)).toBe(false);
  });

  it('nettoie le nom : espaces, bords, longueur', () => {
    expect(sanitizeName('  Idrissa   Balde  ')).toBe('Idrissa Balde');
    expect(sanitizeName('\n\tAwa\n')).toBe('Awa');
    expect(sanitizeName('a'.repeat(50))).toHaveLength(MAX_NAME_LENGTH);
    expect(sanitizeName('   ')).toBe('');
  });

  it('affiche un nom de repli si vide', () => {
    expect(displayName('Idrissa')).toBe('Idrissa');
    expect(displayName('   ')).toBe('Apprenant');
  });
});
