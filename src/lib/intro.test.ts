import { describe, it, expect } from 'vitest';
import {
  INTRO_DONE,
  INTRO_KEY,
  INTRO_STEPS,
  introSeen,
  markIntroSeen,
  resetIntro,
  type IntroStorage,
} from './intro';

function memoryStorage(): IntroStorage {
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

const brokenStorage: IntroStorage = {
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

describe('intro.ts', () => {
  it("l'histoire n'est pas vue au premier lancement", () => {
    expect(introSeen(memoryStorage())).toBe(false);
  });

  it('markIntroSeen persiste puis resetIntro efface', () => {
    const storage = memoryStorage();
    markIntroSeen(storage);
    expect(introSeen(storage)).toBe(true);
    expect(storage.getItem(INTRO_KEY)).toBe(INTRO_DONE);
    resetIntro(storage);
    expect(introSeen(storage)).toBe(false);
  });

  it('markIntroSeen est idempotent', () => {
    const storage = memoryStorage();
    markIntroSeen(storage);
    markIntroSeen(storage);
    expect(introSeen(storage)).toBe(true);
  });

  it("définit les 3 étapes de l'histoire avec le bon bouton final", () => {
    expect(INTRO_STEPS).toHaveLength(3);
    expect(INTRO_STEPS[0].textKey).toBe('intro.step1_text');
    expect(INTRO_STEPS[1].textKey).toBe('intro.step2_text');
    expect(INTRO_STEPS[2].textKey).toBe('intro.step3_text');
    expect(INTRO_STEPS[2].ctaKey).toBe('intro.step3_cta');
    for (const step of INTRO_STEPS) {
      expect(step.titleKey.length).toBeGreaterThan(0);
      expect(step.textKey.length).toBeGreaterThan(0);
      expect(step.ctaKey.length).toBeGreaterThan(0);
    }
  });

  it('tolère un stockage cassé ou absent', () => {
    expect(introSeen(brokenStorage)).toBe(false);
    expect(() => markIntroSeen(brokenStorage)).not.toThrow();
    expect(() => resetIntro(brokenStorage)).not.toThrow();
    expect(introSeen(null)).toBe(false);
    expect(() => markIntroSeen(null)).not.toThrow();
  });
});
