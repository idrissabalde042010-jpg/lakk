import { describe, it, expect } from 'vitest';
import { TOUR_KEY, TOUR_STEPS, markTourSeen, resetTour, tourSeen, type TourStorage } from './tour';

function memoryStorage(): TourStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const brokenStorage: TourStorage = {
  getItem: () => {
    throw new Error('lecture impossible');
  },
  setItem: () => {
    throw new Error('écriture impossible');
  },
  removeItem: () => {
    throw new Error('suppression impossible');
  },
};

describe('tour.ts', () => {
  it('la visite n’est pas vue au premier lancement', () => {
    expect(tourSeen(memoryStorage())).toBe(false);
  });

  it('markTourSeen persiste puis resetTour efface', () => {
    const storage = memoryStorage();
    markTourSeen(storage);
    expect(tourSeen(storage)).toBe(true);
    expect(storage.getItem(TOUR_KEY)).toBe('done');
    resetTour(storage);
    expect(tourSeen(storage)).toBe(false);
  });

  it('markTourSeen est idempotent', () => {
    const storage = memoryStorage();
    markTourSeen(storage);
    markTourSeen(storage);
    expect(tourSeen(storage)).toBe(true);
  });

  it('définit les 3 étapes demandées', () => {
    expect(TOUR_STEPS).toHaveLength(3);
    expect(TOUR_STEPS.map((s) => s.element)).toEqual([
      '[data-tour="start"]',
      '[data-tour="review"]',
      '[data-tour="profile"]',
    ]);
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  it('tolère un stockage cassé ou absent', () => {
    expect(tourSeen(brokenStorage)).toBe(false);
    expect(() => markTourSeen(brokenStorage)).not.toThrow();
    expect(() => resetTour(brokenStorage)).not.toThrow();
    expect(tourSeen(null)).toBe(false);
    expect(() => markTourSeen(null)).not.toThrow();
  });
});
