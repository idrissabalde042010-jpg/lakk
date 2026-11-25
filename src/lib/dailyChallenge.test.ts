import { describe, it, expect } from 'vitest';
import { QUEST_CONFIG, getChestReward, checkDailyQuest } from './dailyChallenge';

// ──────────────────────────────────────────────────────────────────────
// QUEST_CONFIG — Récompenses par tier (constantes pures)
// ──────────────────────────────────────────────────────────────────────
describe('QUEST_CONFIG', () => {
  it('bronze has lowest rewards', () => {
    expect(QUEST_CONFIG.bronze.xp).toBe(10);
    expect(QUEST_CONFIG.bronze.gems).toBe(3);
    expect(QUEST_CONFIG.bronze.weight).toBe(1);
  });

  it('silver has medium rewards', () => {
    expect(QUEST_CONFIG.silver.xp).toBe(20);
    expect(QUEST_CONFIG.silver.gems).toBe(8);
    expect(QUEST_CONFIG.silver.weight).toBe(2);
  });

  it('gold has highest rewards', () => {
    expect(QUEST_CONFIG.gold.xp).toBe(35);
    expect(QUEST_CONFIG.gold.gems).toBe(15);
    expect(QUEST_CONFIG.gold.weight).toBe(3);
  });

  it('rewards increase with tier', () => {
    expect(QUEST_CONFIG.bronze.xp).toBeLessThan(QUEST_CONFIG.silver.xp);
    expect(QUEST_CONFIG.silver.xp).toBeLessThan(QUEST_CONFIG.gold.xp);
    expect(QUEST_CONFIG.bronze.gems).toBeLessThan(QUEST_CONFIG.silver.gems);
    expect(QUEST_CONFIG.silver.gems).toBeLessThan(QUEST_CONFIG.gold.gems);
  });
});

// ──────────────────────────────────────────────────────────────────────
// getChestReward — Récompenses d'affichage (fonction pure)
// ──────────────────────────────────────────────────────────────────────
describe('getChestReward', () => {
  it('returns correct reward for bronze', () => {
    const reward = getChestReward('bronze');
    expect(reward.type).toBe('bronze');
    expect(reward.gems).toBe(3);
    expect(reward.message).toContain('bronze');
    expect(reward.xpBoostMinutes).toBeUndefined();
  });

  it('returns correct reward for silver', () => {
    const reward = getChestReward('silver');
    expect(reward.type).toBe('silver');
    expect(reward.gems).toBe(8);
    expect(reward.message).toContain('argent');
    expect(reward.xpBoostMinutes).toBeUndefined();
  });

  it('returns correct reward for gold with XP boost', () => {
    const reward = getChestReward('gold');
    expect(reward.type).toBe('gold');
    expect(reward.gems).toBe(15);
    expect(reward.xpBoostMinutes).toBe(5);
    expect(reward.message).toContain('or');
  });

  it('rewards increase with tier', () => {
    const bronze = getChestReward('bronze');
    const silver = getChestReward('silver');
    const gold = getChestReward('gold');
    expect(bronze.gems).toBeLessThan(silver.gems);
    expect(silver.gems).toBeLessThan(gold.gems);
  });
});

// ──────────────────────────────────────────────────────────────────────
// checkDailyQuest — Validation des réponses (fonction pure)
// ──────────────────────────────────────────────────────────────────────
describe('checkDailyQuest', () => {
  const baseQuest = {
    id: 'bronze' as const,
    type: 'multiple_choice' as const,
    prompt: 'Test',
    question: 'Test',
    answer: 'hello',
    choices: ['hello', 'world', 'thank you', 'please'],
    vocab: { en: 'hello', fr: 'bonjour' },
    audioText: 'hello',
    xp: 10,
    gemReward: 3,
    tip: 'Indice',
    completed: false,
  };

  it('validates correct multiple_choice answer', () => {
    const quest = { ...baseQuest };
    expect(checkDailyQuest(quest, 'hello')).toBe(true);
  });

  it('rejects incorrect multiple_choice answer', () => {
    const quest = { ...baseQuest };
    expect(checkDailyQuest(quest, 'world')).toBe(false);
  });

  it('handles case insensitivity', () => {
    const quest = { ...baseQuest, answer: 'hello' };
    expect(checkDailyQuest(quest, 'HELLO')).toBe(true);
    expect(checkDailyQuest(quest, 'Hello')).toBe(true);
  });

  it('handles punctuation normalization', () => {
    const quest = { ...baseQuest, answer: 'hello', type: 'translate' as const, choices: undefined };
    expect(checkDailyQuest(quest, 'hello!')).toBe(true);
    expect(checkDailyQuest(quest, 'hello.')).toBe(true);
  });

  it('handles contractions for listen_write', () => {
    const quest = { ...baseQuest, answer: 'it is', type: 'listen_write' as const, choices: undefined };
    expect(checkDailyQuest(quest, "it's")).toBe(true);
  });

  it('validates translate type with word_bank', () => {
    const quest = { ...baseQuest, type: 'translate' as const, choices: undefined, word_bank: ['hello', 'world', 'thanks', 'please'] };
    expect(checkDailyQuest(quest, 'hello')).toBe(true);
    expect(checkDailyQuest(quest, 'world')).toBe(false);
  });

  it('validates order_words type', () => {
    const quest = { ...baseQuest, type: 'order_words' as const, answer: 'thank you', choices: undefined, word_bank: ['you', 'thank'] };
    expect(checkDailyQuest(quest, 'thank you')).toBe(true);
    expect(checkDailyQuest(quest, 'you thank')).toBe(false);
  });

  it('validates fill_blank type', () => {
    const quest = { ...baseQuest, type: 'fill_blank' as const, answer: 'hello', choices: undefined, word_bank: undefined };
    expect(checkDailyQuest(quest, 'hello')).toBe(true);
    expect(checkDailyQuest(quest, 'world')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Pure utility functions (copied from dailyChallenge.ts for testing)
// ──────────────────────────────────────────────────────────────────────
describe('Pure utility functions', () => {
  // Fisher-Yates shuffle
  function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  it('shuffle returns same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.sort()).toEqual(arr);
    // Note: could be same order by chance (1/120), so we don't assert inequality
  });

  it('shuffle preserves length', () => {
    const arr = [1, 2, 3];
    expect(shuffle(arr)).toHaveLength(3);
  });

  it('shuffle empty array returns empty', () => {
    expect(shuffle([])).toEqual([]);
  });

  // pickOne
  function pickOne<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  it('pickOne returns element from array', () => {
    const arr = ['a', 'b', 'c'];
    const picked = pickOne(arr);
    expect(arr).toContain(picked);
  });

  // weightedPick
  function weightedPick<T>(items: Array<{ weight: number; value: T }>, random: () => number): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = random() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }

  it('weightedPick respects weights (deterministic random)', () => {
    const items = [
      { weight: 100, value: 'a' },
      { weight: 1, value: 'b' },
    ];
    const random = () => 0.001;
    expect(weightedPick(items, random)).toBe('a');
  });

  it('weightedPick picks last item if random is high', () => {
    const items = [
      { weight: 1, value: 'a' },
      { weight: 100, value: 'b' },
    ];
    const random = () => 0.99;
    expect(weightedPick(items, random)).toBe('b');
  });

  // createSeededRandom
  function createSeededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  }

  it('createSeededRandom produces deterministic sequence', () => {
    const r1 = createSeededRandom(12345);
    const r2 = createSeededRandom(12345);
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it('createSeededRandom produces different sequences for different seeds', () => {
    const r1 = createSeededRandom(12345);
    const r2 = createSeededRandom(54321);
    let same = true;
    for (let i = 0; i < 10; i++) {
      if (r1() !== r2()) { same = false; break; }
    }
    expect(same).toBe(false);
  });

  // Test TIER_CHALLENGE_MAKERS structure (using dynamic import for ESM)
  it('each tier has challenge makers', async () => {
    const { TIER_CHALLENGE_MAKERS } = await import('./dailyChallenge');
    expect(TIER_CHALLENGE_MAKERS.bronze).toBeDefined();
    expect(TIER_CHALLENGE_MAKERS.silver).toBeDefined();
    expect(TIER_CHALLENGE_MAKERS.gold).toBeDefined();
    expect(TIER_CHALLENGE_MAKERS.bronze.length).toBeGreaterThan(0);
    expect(TIER_CHALLENGE_MAKERS.silver.length).toBeGreaterThan(0);
    expect(TIER_CHALLENGE_MAKERS.gold.length).toBeGreaterThan(0);
  });

  it('weights sum to reasonable values per tier', async () => {
    const { TIER_CHALLENGE_MAKERS } = await import('./dailyChallenge');
    for (const tier of ['bronze', 'silver', 'gold'] as const) {
      const totalWeight = TIER_CHALLENGE_MAKERS[tier].reduce((s, m) => s + m.weight, 0);
      expect(totalWeight).toBeGreaterThan(0);
    }
  });
});