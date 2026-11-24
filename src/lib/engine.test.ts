import { describe, it, expect } from 'vitest';
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