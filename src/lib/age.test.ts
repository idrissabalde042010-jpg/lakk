import { describe, it, expect } from 'vitest';
import { parseAge } from './age';

describe('parseAge', () => {
  it('retourne null pour null', () => {
    expect(parseAge(null)).toBeNull();
  });

  it('retourne null pour undefined', () => {
    expect(parseAge(undefined as unknown)).toBeNull();
  });

  it('retourne null pour chaîne vide', () => {
    expect(parseAge('')).toBeNull();
  });

  it('retourne null pour chaîne avec seulement des espaces', () => {
    expect(parseAge('   ')).toBeNull();
  });

  it('retourne null pour "abc"', () => {
    expect(parseAge('abc')).toBeNull();
  });

  it('retourne null pour 12.5 (non entier)', () => {
    expect(parseAge(12.5)).toBeNull();
  });

  it('retourne null pour 200 (hors bornes)', () => {
    expect(parseAge(200)).toBeNull();
  });

  it('retourne null pour 3 (trop jeune)', () => {
    expect(parseAge(3)).toBeNull();
  });

  it('retourne 16 pour nombre 16', () => {
    expect(parseAge(16)).toBe(16);
  });

  it('retourne 16 pour chaîne "16"', () => {
    expect(parseAge('16')).toBe(16);
  });

  it('retourne 16 pour chaîne " 16 "', () => {
    expect(parseAge(' 16 ')).toBe(16);
  });

  it('retourne 13 pour la borne inférieure', () => {
    expect(parseAge(13)).toBe(13);
  });

  it('retourne 120 pour la borne supérieure', () => {
    expect(parseAge(120)).toBe(120);
  });

  it('retourne null pour 4 (en dessous de 5)', () => {
    expect(parseAge(4)).toBeNull();
  });

  it('retourne null pour 121 (au dessus de 120)', () => {
    expect(parseAge(121)).toBeNull();
  });
});
