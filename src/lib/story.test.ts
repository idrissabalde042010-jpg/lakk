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

  it('chaque gabarit a un id, un titre, une traduction et des trous', () => {
    for (const t of STORY_TEMPLATES) {
      expect(t.id.trim()).not.toBe('');
      expect(t.title.trim()).not.toBe('');
      expect(t.translation.trim()).not.toBe('');
      expect(t.template.includes('{')).toBe(true);
      expect(t.slots).toBeGreaterThan(0);
    }
  });

  it('les titres des gabarits sont en anglais (pas de mots français)', () => {
    const frenchWords = ['le', 'la', 'les', 'un', 'une', 'et', 'avec', 'à', 'au', 'du'];
    for (const t of STORY_TEMPLATES) {
      const words = t.title.toLowerCase().split(/\s+/);
      for (const w of words) {
        expect(frenchWords).not.toContain(w);
      }
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
    expect(s!.text.includes('{')).toBe(false); // tous les trous remplis
    expect(s!.words.length).toBeGreaterThan(0);
  });

  it('utilise bien des mots du deck', () => {
    const s = generateStory('marche', cards, newWords);
    expect(s!).toBeDefined();
    for (const w of s!.words) {
      expect(
        cards.some((c) => c.vocab.en === w.en) || newWords.some((nw) => nw.en === w.en),
      ).toBe(true);
    }
  });

  it('l\'histoire générée ne contient que de l\'anglais (pas de mots français isolés)', () => {
    const frenchStopWords = [
      'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'avec', 'à', 'au',
      'aux', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'suis',
      'est', 'sont', 'a', 'ai', 'as', 'avons', 'avez', 'ont', 'chez', 'dans',
      'pour', 'sur', 'sous', 'par', 'sans', 'mais', 'donc', 'or', 'ni', 'car',
      'que', 'qui', 'quoi', 'dont', 'où', 'ce', 'cette', 'ces', 'mon', 'ma',
      'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'leur',
      'leurs', 'aujourd', "hui", 'matin', 'soir', 'nuit',
    ];
    for (const t of STORY_TEMPLATES) {
      const s = generateStory(t.id, cards, newWords);
      expect(s).toBeDefined();
      const text = s!.text.toLowerCase();
      const words = text.split(/\s+/);
      for (const w of words) {
        const clean = w.replace(/[.,!?:"' ]/g, '');
        if (clean.length > 1) {
          expect(frenchStopWords).not.toContain(clean);
        }
      }
    }
  });

  it('retourne undefined pour un gabarit inconnu', () => {
    expect(generateStory('inconnu', cards, newWords)).toBeUndefined();
  });

  it('chaque conte généré a une traduction française', () => {
    const s = generateStory('marche', cards, newWords);
    expect(s).toBeDefined();
    expect(s!.translation.trim()).not.toBe('');
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
