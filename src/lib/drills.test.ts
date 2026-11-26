import { describe, it, expect } from 'vitest';
import type { CourseData, LessonData, Exercise } from './engine';
import {
  generateDrills,
  drillLabel,
  type Drill,
} from './drills';

function ex(kind: Exercise['kind'], prompt: string, answer: string): Exercise {
  return { kind, prompt, answer };
}

function lesson(title: string, exercises: Exercise[]): LessonData {
  return { title, exercises };
}

function unit(title: string, lessons: LessonData[]): CourseData['units'][number] {
  return { title, lessons };
}

function makeCourse(): CourseData {
  return {
    course: { source: 'fr', target: 'en', title: 'Test' },
    units: [
      unit('Unité 1', [
        lesson('Leçon 1', [
          ex('translate', 'I have a cat', 'J\'ai un chat'),
          ex('fill_blank', 'The book is on the table', 'The book is on the table'),
          ex('multiple_choice', 'She ___ to school', 'goes'),
          ex('order_words', 'cats like I', 'I like cats'),
        ]),
      ]),
      unit('Unité 2', [
        lesson('Leçon 2', [
          ex('translate', 'He goes to the market', 'Il va au marché'),
          ex('fill_blank', 'An apple a day', 'An apple a day'),
        ]),
      ]),
    ],
  };
}

describe('Générateur de Drills', () => {
  const course = makeCourse();

  it('génère 5 drills d\'articles', () => {
    const drills = generateDrills('article', course);
    expect(drills.length).toBeGreaterThan(0);
    expect(drills.length).toBeLessThanOrEqual(5);
    for (const d of drills) {
      expect(d.pattern).toBe('article');
      expect(d.kind).toBe('fill_blank');
      expect(d.answer).toBeTruthy();
    }
  });

  it('génère des drills d\'ordre', () => {
    const drills = generateDrills('ordre', course);
    expect(drills.length).toBeGreaterThan(0);
    expect(drills.length).toBeLessThanOrEqual(5);
    for (const d of drills) {
      expect(d.pattern).toBe('ordre');
      expect(d.kind).toBe('order_words');
      expect(d.word_bank).toBeDefined();
    }
  });

  it('génère des drills d\'orthographe', () => {
    const drills = generateDrills('orthographe', course);
    expect(drills.length).toBeGreaterThan(0);
    expect(drills.length).toBeLessThanOrEqual(5);
    for (const d of drills) {
      expect(d.pattern).toBe('orthographe');
      expect(d.kind).toBe('fill_blank');
    }
  });

  it('génère des drills de conjugaison', () => {
    const drills = generateDrills('conjugaison', course);
    // Peut être vide si aucun verbe connu dans les phrases de test
    expect(drills.length).toBeLessThanOrEqual(5);
    for (const d of drills) {
      expect(d.pattern).toBe('conjugaison');
      expect(d.kind).toBe('multiple_choice');
    }
  });

  it('génère des drills de sens', () => {
    const drills = generateDrills('sens', course);
    expect(drills.length).toBeGreaterThan(0);
    expect(drills.length).toBeLessThanOrEqual(5);
    for (const d of drills) {
      expect(d.pattern).toBe('sens');
      expect(d.kind).toBe('translate');
    }
  });

  it('ne génère jamais plus de 5 drills', () => {
    for (const pattern of ['article', 'ordre', 'orthographe', 'conjugaison', 'sens'] as const) {
      const drills = generateDrills(pattern, course);
      expect(drills.length).toBeLessThanOrEqual(5);
    }
  });

  it('drillLabel retourne un libellé pour chaque pattern', () => {
    expect(drillLabel('article')).toContain('Articles');
    expect(drillLabel('ordre')).toContain('Ordre');
    expect(drillLabel('orthographe')).toContain('Orthographe');
    expect(drillLabel('conjugaison')).toContain('Conjugaison');
    expect(drillLabel('sens')).toContain('traduction');
  });
});
