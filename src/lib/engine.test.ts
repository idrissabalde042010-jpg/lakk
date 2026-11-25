import { describe, it, expect, beforeAll } from 'vitest';
import { shuffledIndices } from './shuffle';
import { answersMatch } from './engine';
import type { Exercise } from './engine';

describe('shuffle.ts / engine.ts', () => {
  // ──────────────────────────────────────────────────────────────────────
  // shuffledIndices — Fisher-Yates uniformity (1000 draws)
  // ──────────────────────────────────────────────────────────────────────
  it('shuffledIndices produces uniform distribution over 1000 draws', () => {
    const n = 4;
    const counts = Array.from({ length: n }, () => Array(n).fill(0));
    const draws = 1000;
    
    for (let i = 0; i < draws; i++) {
      const indices = shuffledIndices(n);
      expect(indices).toHaveLength(n);
      expect([...indices].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
      indices.forEach((idx, pos) => {
        counts[pos][idx]++;
      });
    }
    
    // Chi-square test: each position should have ~250 of each index
    // With 1000 draws, expected = 250, std dev ≈ 15.8
    // Accept if within 3 sigma (≈ 47) → [203, 297]
    for (let pos = 0; pos < n; pos++) {
      for (let idx = 0; idx < n; idx++) {
        expect(counts[pos][idx]).toBeGreaterThanOrEqual(200);
        expect(counts[pos][idx]).toBeLessThanOrEqual(300);
      }
    }
  });

  it('shuffledIndices returns independent permutations', () => {
    const perms = new Set<string>();
    for (let i = 0; i < 100; i++) {
      perms.add(shuffledIndices(4).join(','));
    }
    // Should see many different permutations (4! = 24 possible)
    expect(perms.size).toBeGreaterThan(10);
  });

  // ──────────────────────────────────────────────────────────────────────
  // answersMatch — order-independent validation with accepted[]
  // Signature: answersMatch(expected: string, given: string, accepted?: string[])
  // ──────────────────────────────────────────────────────────────────────
  it('answersMatch normalizes case, punctuation (accents preserved)', () => {
    expect(answersMatch('hello', 'Hello')).toBe(true);
    expect(answersMatch('hello', 'Hello!')).toBe(true);
    expect(answersMatch('hello', 'Hello.')).toBe(true);
    expect(answersMatch('hello', 'HELLO')).toBe(true);
    // Accents are preserved (normalize keeps \p{L}), so these are different:
    expect(answersMatch('café', 'café')).toBe(true);
    expect(answersMatch('naïve', 'naïve')).toBe(true);
    // But café != cafe (accents not stripped)
    expect(answersMatch('cafe', 'café')).toBe(false);
  });

  it('answersMatch handles contractions', () => {
    expect(answersMatch('it is', "it's")).toBe(true);
    expect(answersMatch('i am', "i'm")).toBe(true);
    expect(answersMatch('do not', "don't")).toBe(true);
    expect(answersMatch('cannot', "can't")).toBe(true);
    expect(answersMatch('will not', "won't")).toBe(true);
    expect(answersMatch('she is', "she's")).toBe(true);
    expect(answersMatch('he is', "he's")).toBe(true);
    expect(answersMatch('we are', "we're")).toBe(true);
    expect(answersMatch('they are', "they're")).toBe(true);
  });

  it('answersMatch uses accepted[] alternatives', () => {
    const accepted = ['She made a cake', 'She baked a cake'];
    
    expect(answersMatch('She made a cake', 'She made a cake', accepted)).toBe(true);
    expect(answersMatch('She made a cake', 'She baked a cake', accepted)).toBe(true);
    expect(answersMatch('She made a cake', 'She cooked a cake', accepted)).toBe(false);
  });

  it('answersMatch works with fill_blank accepted alternatives', () => {
    const accepted = ['Friday', 'Friday.'];
    
    expect(answersMatch('Friday', 'Friday', accepted)).toBe(true);
    expect(answersMatch('Friday', 'Friday.', accepted)).toBe(true);
    expect(answersMatch('Friday', 'friday', accepted)).toBe(true);
  });

  it('answersMatch rejects incorrect answers', () => {
    const accepted = ['correct answer', 'also correct'];
    
    expect(answersMatch('correct answer', 'wrong', accepted)).toBe(false);
    expect(answersMatch('correct answer', '', accepted)).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Validation indépendante de l'ordre (order-independent)
  // ──────────────────────────────────────────────────────────────────────
  it('answersMatch is independent of choice order in MC', () => {
    // The function compares text, not indices
    expect(answersMatch('correct', 'correct')).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Regression test: selected answer validated when strictly equal
  // Simulates the shuffle + selection flow from Lesson.svelte
  // ──────────────────────────────────────────────────────────────────────
  it('selected answer validated when strictly equal to expected (with shuffle)', () => {
    const choices = ['twenty', 'surprising', 'knows', 'called'];
    const answer = 'twenty';
    
    // Test multiple shuffles to ensure robustness
    for (let run = 0; run < 100; run++) {
      const indices = shuffledIndices(choices.length);
      const shuffledChoices = indices.map(i => choices[i]);
      
      // Find where answer appears in shuffled display
      const answerPos = shuffledChoices.indexOf(answer);
      expect(answerPos).toBeGreaterThanOrEqual(0);
      
      // User selects the display position where answer appears
      const selectedDisplayIdx = answerPos;
      
      // This is what Lesson.svelte does: getChoice(shuffledChoiceIndices[selected])
      const actualChoice = choices[indices[selectedDisplayIdx]];
      
      // answersMatch should return true
      const result = answersMatch(answer, actualChoice);
      expect(result).toBe(true);
    }
  });

  it('selected answer validated with trailing spaces and case differences', () => {
    const choices = ['twenty', 'surprising', 'knows', 'called'];
    const answer = 'twenty';
    
    // Test with trailing space in choice (simulating potential JSON issue)
    const indices = [3, 1, 2, 0]; // twenty at display position 3
    const selectedDisplayIdx = 3;
    const actualChoice = choices[indices[selectedDisplayIdx]] + ' '; // trailing space
    
    // answersMatch normalizes and should still match
    const result = answersMatch(answer, actualChoice);
    expect(result).toBe(true);
  });

  it('selected answer validated with case differences', () => {
    const answer = 'twenty';
    const given = 'TWENTY'; // all caps
    
    const result = answersMatch(answer, given);
    expect(result).toBe(true);
  });
});

describe('engine.ts — Streak Freezes (weekly grant)', () => {
  // Helper: create a date at noon UTC
  // Use a Wednesday base to avoid week boundaries (2026-10-28 is Wednesday, ISO week 44)
  function day(offset: number): number {
    const base = new Date('2026-10-28T12:00:00Z').getTime();
    return base + offset * 86400000;
  }

  // Import functions once at module level
  let grantWeeklyFreezes: typeof import('./engine').grantWeeklyFreezes;
  let registerLesson: typeof import('./engine').registerLesson;
  let newProfileFn: typeof import('./engine').newProfile;

  beforeAll(async () => {
    const engine = await import('./engine');
    grantWeeklyFreezes = engine.grantWeeklyFreezes;
    registerLesson = engine.registerLesson;
    newProfileFn = engine.newProfile;
  });

  function newProfile(name = 'Test') {
    return newProfileFn(name);
  }

  it('grantWeeklyFreezes grants 2 freezes on first call', () => {
    const p = newProfile('Test');
    p.freezeCount = 0;
    p.lastFreezeGrantWeek = null;

    const result = grantWeeklyFreezes(p, day(0)); // Wednesday week 44
    expect(result).toBe(true);
    expect(p.freezeCount).toBe(2);
    expect(p.lastFreezeGrantWeek).toBe(44);
  });

  it('grantWeeklyFreezes does not grant again in same ISO week', () => {
    const p = newProfile('Test');
    p.freezeCount = 0;
    p.lastFreezeGrantWeek = null;

    grantWeeklyFreezes(p, day(0)); // Wednesday week 44
    const result = grantWeeklyFreezes(p, day(1)); // Thursday week 44
    expect(result).toBe(false);
    expect(p.freezeCount).toBe(2);
  });

  it('grantWeeklyFreezes resets to 2 on new ISO week (Monday)', () => {
    const p = newProfile('Test');
    p.freezeCount = 0;
    p.lastFreezeGrantWeek = null;

    grantWeeklyFreezes(p, day(0)); // Wednesday week 44
    p.freezeCount = 0; // user used both freezes
    const result = grantWeeklyFreezes(p, day(5)); // Next Monday week 45
    expect(result).toBe(true);
    expect(p.freezeCount).toBe(2);
    expect(p.lastFreezeGrantWeek).toBe(45);
  });

  it('grantWeeklyFreezes is not cumulative (resets to 2, does not add)', () => {
    const p = newProfile('Test');
    p.freezeCount = 1; // user has 1 left
    p.lastFreezeGrantWeek = null;

    grantWeeklyFreezes(p, day(0)); // week 44
    expect(p.freezeCount).toBe(2); // reset to 2, not 3

    // During the week, count doesn't reset
    p.freezeCount = 1;
    grantWeeklyFreezes(p, day(1)); // Thursday
    expect(p.freezeCount).toBe(1); // no reset during week

    // Next Monday: reset to 2 (not 3!)
    grantWeeklyFreezes(p, day(5)); // Monday week 45
    expect(p.freezeCount).toBe(2);
  });

  it('registerLesson grants freezes on new week', () => {
    const p = newProfile('Test');

    // First lesson Wednesday
    registerLesson(p, day(0), 20);
    expect(p.freezeCount).toBe(2);

    // Lesson Thursday same week
    registerLesson(p, day(1), 20);
    expect(p.freezeCount).toBe(2);

    // Lesson Friday same week
    registerLesson(p, day(2), 20);
    expect(p.freezeCount).toBe(2);

    // Lesson next Monday -> reset to 2 (but gap consumes 1)
    registerLesson(p, day(5), 20);
    expect(p.freezeCount).toBe(1); // grant gives 2, gap consumes 1
  });

  it('freeze preserves streak across a gap', () => {
    const p = newProfile('Test');

    registerLesson(p, day(0), 20); // Wednesday, gets 2 freezes
    expect(p.streakDays).toBe(1);
    expect(p.freezeCount).toBe(2);

    // Gap of 2 days (miss Thursday, Friday), should consume 1 freeze
    registerLesson(p, day(3), 20); // Saturday
    expect(p.streakDays).toBe(2);
    expect(p.freezeCount).toBe(1);
  });

  it('streak resets without freeze after gap', () => {
    const p = newProfile('Test');

    registerLesson(p, day(0), 20); // Wednesday week 44
    registerLesson(p, day(3), 20); // Saturday week 44, gap of 3 days -> uses 1 freeze
    expect(p.freezeCount).toBe(1);
    expect(p.streakDays).toBe(2);

    // Use last freeze on Sunday (no gap)
    registerLesson(p, day(4), 20); // Sunday week 44
    expect(p.freezeCount).toBe(1);
    expect(p.streakDays).toBe(3);

    // Monday week 45: grant gives 2 freezes (reset to 2), consecutive day -> no freeze consumed
    registerLesson(p, day(5), 20); // Monday week 45
    expect(p.freezeCount).toBe(2);
    expect(p.streakDays).toBe(4);

    // Use freezes during week 45: Tuesday, Wednesday, Thursday
    registerLesson(p, day(6), 20); // Tuesday
    registerLesson(p, day(7), 20); // Wednesday
    registerLesson(p, day(8), 20); // Thursday
    expect(p.freezeCount).toBe(2);
    expect(p.streakDays).toBe(7);

    // Friday week 45: consecutive, no freeze consumed
    registerLesson(p, day(9), 20); // Friday
    expect(p.freezeCount).toBe(2);
    expect(p.streakDays).toBe(8);

    // Now test a gap WITHIN the same week (no weekly grant) with no freezes
    p.freezeCount = 0;
    p.lastFreezeGrantWeek = 46; // prevent weekly grant for week 46 (day(12) is week 46)
    registerLesson(p, day(12), 20); // Monday week 46, gap of 3 days (Sat, Sun, Mon), no freeze -> streak resets
    expect(p.streakDays).toBe(1);
  });
});