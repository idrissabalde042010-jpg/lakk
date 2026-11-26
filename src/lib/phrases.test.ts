import { describe, it, expect } from 'vitest';
import type { CourseData, LessonData, Exercise } from './engine';
import {
  extractPhrases,
  makeCloze,
  makeConstruction,
  dailyPhrase,
  marketExerciseFor,
  type PhraseItem,
} from './phrases';

function ex(kind: Exercise['kind'], prompt: string, answer: string): Exercise {
  return { kind, prompt, answer };
}

function lesson(title: string, exercises: Exercise[]): LessonData {
  return { title, exercises };
}

function unit(title: string, lessons: LessonData[]): CourseData['units'][number] {
  return { title, lessons };
}

function course(): CourseData {
  return {
    course: { source: 'fr', target: 'en', title: 'Test' },
    units: [
      unit('Unité 1', [
        lesson('Leçon 1', [
          ex('translate', 'Bonjour, comment tu t\'appelles ?', 'Hello, what is your name?'),
          ex('fill_blank', 'I have a ___', 'I have a cat'),
          ex('multiple_choice', 'Choisis : She ___ a dog.', 'She has a dog'),
        ]),
      ]),
    ],
  };
}

describe('Marché des Phrases — extraction', () => {
  it('extrait les phrases des exercices', () => {
    const phrases = extractPhrases(course());
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.some((p) => p.en === "Hello, what is your name?")).toBe(true);
  });

  it('déduplique les phrases identiques', () => {
    const c = course();
    c.units[0].lessons[0].exercises.push(
      ex('translate', 'Bonjour, comment tu t\'appelles ?', 'Hello, what is your name?'),
    );
    const phrases = extractPhrases(c);
    const dupes = phrases.filter((p) => p.en === "Hello, what is your name?");
    expect(dupes).toHaveLength(1);
  });

  it('ignore les mots isolés et les trous seuls', () => {
    const c = course();
    c.units[0].lessons[0].exercises.push(
      ex('fill_blank', '___', 'cat'),
      ex('multiple_choice', 'A', 'B'),
    );
    const phrases = extractPhrases(c);
    expect(phrases.some((p) => p.en === '___')).toBe(false);
    expect(phrases.some((p) => p.en === 'A')).toBe(false);
  });

  it('retourne un tableau vide pour un cours sans phrases', () => {
    const empty: CourseData = {
      course: { source: 'fr', target: 'en', title: 'Vide' },
      units: [
        {
          title: 'U',
          lessons: [{ title: 'L', exercises: [ex('fill_blank', '___', 'x')] }],
        },
      ],
    };
    expect(extractPhrases(empty)).toEqual([]);
  });
});

describe('Marché des Phrases — cloze', () => {
  it('remplace le mot cible par un trou', () => {
    const c = makeCloze('I have a cat', 'cat');
    expect(c.kind).toBe('cloze');
    expect(c.body).toBe('I have a ___');
    expect(c.target).toBe('cat');
    expect(c.phrase).toBe('I have a cat');
  });

  it('est insensible à la casse', () => {
    const c = makeCloze('The Cat sleeps', 'cat');
    expect(c.body).toBe('The ___ sleeps');
  });

  it('échappe les caractères spéciaux du mot cible', () => {
    const c = makeCloze('How much is this?', 'this');
    expect(c.body).toBe('How much is ___?');
  });
});

describe('Marché des Phrases — construction', () => {
  it('mélange les mots et garde l\'ordre correct (permutation)', () => {
    const c = makeConstruction('I have a cat');
    expect(c.kind).toBe('construction');
    expect(c.body.split(' ').sort()).toEqual(['I', 'a', 'cat', 'have']);
    expect(c.words).toEqual(['I', 'have', 'a', 'cat']);
    expect(c.phrase).toBe('I have a cat');
  });
});

describe('Marché des Phrases — phrase du jour', () => {
  const phrases: PhraseItem[] = [
    { en: 'A', fr: '', source: 'a' },
    { en: 'B', fr: '', source: 'b' },
    { en: 'C', fr: '', source: 'c' },
  ];

  it('est déterministe : même jour = même phrase', () => {
    const a = dailyPhrase(phrases, 1_000_000_000_000);
    const b = dailyPhrase(phrases, 1_000_000_000_000);
    expect(a?.en).toBe(b?.en);
  });

  it('change selon le jour', () => {
    const ids = new Set([0, 1, 2, 3, 4].map((d) => dailyPhrase(phrases, d * 86_400_000)?.en));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('retourne undefined pour un tableau vide', () => {
    expect(dailyPhrase([])).toBeUndefined();
  });
});

describe('marketExerciseFor', () => {
  const phrases: PhraseItem[] = [
    { en: 'I have a cat', fr: '', source: 'x' },
    { en: 'She likes tea', fr: '', source: 'y' },
  ];

  it('génère un exercice à partir d\'une phrase contenant le mot', () => {
    const ex = marketExerciseFor('cat', phrases);
    expect(ex).toBeDefined();
    expect(ex!.phrase).toBe('I have a cat');
  });

  it('retourne undefined si aucun mot ne correspond', () => {
    expect(marketExerciseFor('inconnu', phrases)).toBeUndefined();
  });
});
