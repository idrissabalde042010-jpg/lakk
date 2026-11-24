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
    expect(INTRO_STEPS[0].text).toContain('Sénégal');
    expect(INTRO_STEPS[1].text).toContain('livre magique');
    expect(INTRO_STEPS[2].text).toContain('Es-tu prêt');
    expect(INTRO_STEPS[2].cta).toBe("C'est parti !");
    for (const step of INTRO_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.text.length).toBeGreaterThan(0);
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
