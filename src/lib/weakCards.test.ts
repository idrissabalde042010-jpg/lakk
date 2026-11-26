import { describe, it, expect } from 'vitest';
import { newCard, weakCards, mastery } from './engine';

function makeCard(stability: number, state: 'new' | 'learning' | 'review' | 'relearning' = 'review'): import('./engine').Card {
  return newCard({ en: 'test', fr: 'test' }, 0);
  // On surcharge après création
}

describe('weakCards — Mots faibles (maîtrise < 70%)', () => {
  it('retourne un tableau vide quand aucune carte n\'est faible', () => {
    const cards = [
      newCard({ en: 'a', fr: 'a' }, 0),
      newCard({ en: 'b', fr: 'b' }, 0),
    ];
    // Forcer une maîtrise élevée (stabilité = 21 -> 100%)
    cards[0].stability = 21;
    cards[0].state = 'review';
    cards[1].stability = 21;
    cards[1].state = 'review';

    const result = weakCards(cards);
    expect(result).toEqual([]);
  });

  it('retourne les cartes avec maîtrise < 70%', () => {
    const cards = [
      newCard({ en: 'a', fr: 'a' }, 0),
      newCard({ en: 'b', fr: 'b' }, 0),
      newCard({ en: 'c', fr: 'c' }, 0),
    ];
    // a: stabilité 7 -> 33% (faible)
    cards[0].stability = 7;
    cards[0].state = 'review';
    // b: stabilité 15 -> 71% (solide, pas faible)
    cards[1].stability = 15;
    cards[1].state = 'review';
    // c: stabilité 3 -> 14% (faible)
    cards[2].stability = 3;
    cards[2].state = 'review';

    const result = weakCards(cards);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.vocab.en)).toEqual(['c', 'a']); // trié par maîtrise croissante
  });

  it('limite à 10 cartes maximum', () => {
    const cards: import('./engine').Card[] = [];
    for (let i = 0; i < 15; i++) {
      const c = newCard({ en: `w${i}`, fr: `w${i}` }, 0);
      c.stability = 1; // ~5% (faible)
      c.state = 'review';
      cards.push(c);
    }

    const result = weakCards(cards);
    expect(result).toHaveLength(10);
  });

  it('exclut les cartes "Nouveau" (état new)', () => {
    const cards = [
      newCard({ en: 'new1', fr: 'n1' }, 0),
      newCard({ en: 'weak1', fr: 'w1' }, 0),
    ];
    cards[0].state = 'new'; // Nouveau, pas compté comme faible même si pct=0
    cards[1].stability = 5;
    cards[1].state = 'review';

    const result = weakCards(cards);
    expect(result).toHaveLength(1);
    expect(result[0].vocab.en).toBe('weak1');
  });

  it('respecte la limite personnalisée', () => {
    const cards: import('./engine').Card[] = [];
    for (let i = 0; i < 5; i++) {
      const c = newCard({ en: `w${i}`, fr: `w${i}` }, 0);
      c.stability = 1;
      c.state = 'review';
      cards.push(c);
    }

    const result = weakCards(cards, 3);
    expect(result).toHaveLength(3);
  });

  it('tri par maîtrise croissante (plus faible en premier)', () => {
    const cards: import('./engine').Card[] = [
      newCard({ en: 'medium', fr: 'm' }, 0),
      newCard({ en: 'veryweak', fr: 'v' }, 0),
      newCard({ en: 'weak', fr: 'w' }, 0),
    ];
    cards[0].stability = 10; // ~48%
    cards[0].state = 'review';
    cards[1].stability = 1; // ~5%
    cards[1].state = 'review';
    cards[2].stability = 5; // ~24%
    cards[2].state = 'review';

    const result = weakCards(cards);
    expect(result.map((c) => c.vocab.en)).toEqual(['veryweak', 'weak', 'medium']);
  });
});
