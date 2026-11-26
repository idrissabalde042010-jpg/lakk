import { describe, it, expect } from 'vitest';
import { getUserSegment, segmentLabel } from './segment';

describe('getUserSegment', () => {
  it('retourne null si l’âge est null', () => {
    expect(getUserSegment(null)).toBeNull();
  });

  it('retourne null si l’âge est undefined', () => {
    // @ts-expect-error - testing undefined input
    expect(getUserSegment(undefined)).toBeNull();
  });

  it('retourne null si l’âge est < 13', () => {
    expect(getUserSegment(12)).toBeNull();
    expect(getUserSegment(5)).toBeNull();
  });

  it('retourne ado pour 13-17', () => {
    expect(getUserSegment(13)).toBe('ado');
    expect(getUserSegment(15)).toBe('ado');
    expect(getUserSegment(17)).toBe('ado');
  });

  it('retourne jeune_adulte pour 18-29', () => {
    expect(getUserSegment(18)).toBe('jeune_adulte');
    expect(getUserSegment(25)).toBe('jeune_adulte');
    expect(getUserSegment(29)).toBe('jeune_adulte');
  });

  it('retourne adulte pour 30-59', () => {
    expect(getUserSegment(30)).toBe('adulte');
    expect(getUserSegment(45)).toBe('adulte');
    expect(getUserSegment(59)).toBe('adulte');
  });

  it('retourne senior pour 60+', () => {
    expect(getUserSegment(60)).toBe('senior');
    expect(getUserSegment(75)).toBe('senior');
    expect(getUserSegment(100)).toBe('senior');
  });

  it('boundary exact ages', () => {
    expect(getUserSegment(12)).toBeNull();
    expect(getUserSegment(13)).toBe('ado');
    expect(getUserSegment(17)).toBe('ado');
    expect(getUserSegment(18)).toBe('jeune_adulte');
    expect(getUserSegment(29)).toBe('jeune_adulte');
    expect(getUserSegment(30)).toBe('adulte');
    expect(getUserSegment(59)).toBe('adulte');
    expect(getUserSegment(60)).toBe('senior');
  });
});

describe('segmentLabel', () => {
  it('retourne le bon libellé pour chaque segment', () => {
    expect(segmentLabel('ado')).toBe('Adolescent');
    expect(segmentLabel('jeune_adulte')).toBe('Jeune adulte');
    expect(segmentLabel('adulte')).toBe('Adulte');
    expect(segmentLabel('senior')).toBe('Senior');
  });
});
