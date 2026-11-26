import { describe, it, expect } from 'vitest';
import { newCard } from './engine';
import {
  generateStory,
  newVocab,
  pickDistribution,
  storyOfTheDay,
  STORY_TEMPLATES,
} from './story';

function card(vocab: { en: string; fr: string }, state: 'new' | 'review' = 'review', stability = 5): import('./engine').Card {
  const c = newCard(vocab, 0);
  c.state = state;
  c.stability = stability;
  return c;
}

describe('Conte du Baobab — modèles', () => {
  it('contient entre 20 et 30 gabarits', () => {
    expect(STORY_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    expect(STORY_TEMPLATES.length).toBeLessThanOrEqual(30);
  });

  it('chaque gabarit a un id, un titre et des trous', () => {
    for (const t of STORY_TEMPLATES) {
      expect(t.id.trim()).not.toBe('');
      expect(t.title.trim()).not.toBe('');
      expect(t.template.includes('{{')).toBe(true);
      expect(t.slots).toBeGreaterThan(0);
    }
  });

  it('les ids de gabarit sont uniques', () => {
    const ids = STORY_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Conte du Baobab — répartition des mots', () => {
  it('respecte la répartition 60 % faibles / 30 % solides / 10 % nouveaux', () => {
    for (let slots = 1; slots <= 10; slots++) {
      const picks = pickDistribution(slots);
      const weak = picks.filter((p: 'weak' | 'solid' | 'new') => p === 'weak').length;
      const solid = picks.filter((p: 'weak' | 'solid' | 'new') => p === 'solid').length;
      const nw = picks.filter((p: 'weak' | 'solid' | 'new') => p === 'new').length;
      expect(weak + solid + nw).toBe(slots);
      // Le nombre de faibles doit être proche de 60 % (arrondi).
      expect(weak).toBeGreaterThanOrEqual(Math.floor(slots * 0.5));
      expect(weak).toBeLessThanOrEqual(Math.ceil(slots * 0.7));
    }
  });
});

describe('Conte du Baobab — génération', () => {
  const cards = [
    card({ en: 'apple', fr: 'pomme' }, 'review', 3), // faible
    card({ en: 'book', fr: 'livre' }, 'review', 15), // solide
    card({ en: 'house', fr: 'maison' }, 'new'), // nouveau
    card({ en: 'water', fr: 'eau' }, 'review', 2), // faible
    card({ en: 'bread', fr: 'pain' }, 'review', 20), // solide
  ];
  const newWords = cards.filter((c) => c.state === 'new').map((c) => c.vocab);

  it('génère un conte avec tous les trous remplis', () => {
    const s = generateStory('marche', cards, newWords);
    expect(s).toBeDefined();
    expect(s!.text.includes('{{')).toBe(false); // tous les trous remplis
    expect(s!.words.length).toBeGreaterThan(0);
  });

  it('utilise bien des mots du deck', () => {
    const s = generateStory('marche', cards, newWords);
    expect(s!).toBeDefined();
    for (const w of s!.words) {
      expect(cards.some((c) => c.vocab.en === w.en || newWords.some((nw) => nw.en === w.en))).toBe(true);
    }
  });

  it('retourne undefined pour un gabarit inconnu', () => {
    expect(generateStory('inconnu', cards, newWords)).toBeUndefined();
  });
});

describe('Conte du Baobab — conte du jour', () => {
  const cards = [
    card({ en: 'sun', fr: 'soleil' }, 'review', 3),
    card({ en: 'tree', fr: 'arbre' }, 'review', 15),
  ];

  it('est déterministe : même jour = même gabarit', () => {
    const a = storyOfTheDay(cards, [], 1_000_000_000_000);
    const b = storyOfTheDay(cards, [], 1_000_000_000_000);
    expect(a?.id).toBe(b?.id);
  });

  it('change de gabarit selon le jour', () => {
    const ids = new Set(
      [0, 1, 2, 3, 4].map((d) => storyOfTheDay(cards, [], d * 86_400_000)?.id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('newVocab', () => {
  it('retourne uniquement les cartes état "new"', () => {
    const cards = [
      card({ en: 'n1', fr: 'a' }, 'new'),
      card({ en: 'n2', fr: 'b' }, 'new'),
      card({ en: 'w1', fr: 'c' }, 'review', 5),
    ];
    const result = newVocab(cards);
    expect(result.map((w) => w.en)).toEqual(['n1', 'n2']);
  });

  it('respecte la limite', () => {
    const cards: import('./engine').Card[] = [];
    for (let i = 0; i < 10; i++) {
      cards.push(card({ en: `n${i}`, fr: `a${i}` }, 'new'));
    }
    const result = newVocab(cards, 3);
    expect(result).toHaveLength(3);
  });
});
