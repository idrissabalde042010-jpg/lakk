import { describe, it, expect, beforeEach } from 'vitest';
import { app } from './store.svelte';
import type { CourseData, LessonData, Exercise } from './engine';

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
        ]),
        lesson('Leçon 2', [
          ex('multiple_choice', 'She ___ to school', 'goes'),
        ]),
      ]),
      unit('Unité 2', [
        lesson('Leçon 3', [
          ex('translate', 'He goes to the market', 'Il va au marché'),
        ]),
      ]),
    ],
  };
}

describe('Séance Express', () => {
  beforeEach(() => {
    app.expressExercises = [];
    app.expressIndex = 0;
    app.expressCorrect = 0;
    app.expressDone = false;
    app.screen = 'home';
    const completed: Record<string, boolean> = {};
    const course = makeCourse();
    course.units.forEach((unit, u) => {
      unit.lessons.forEach((_lesson, l) => {
        completed[`${u}-${l}`] = true;
      });
    });
    app.data.completed = completed;
    app.course = course as unknown as typeof app.course;
  });

  it('startExpress sélectionne jusqu\'à 3 exercices', () => {
    app.startExpress();
    expect(app.expressExercises.length).toBeGreaterThan(0);
    expect(app.expressExercises.length).toBeLessThanOrEqual(3);
    expect(app.screen).toBe('express');
    expect(app.expressIndex).toBe(0);
  });

  it('checkExpress retourne true pour la bonne réponse', () => {
    app.startExpress();
    const current = app.expressExercises[0];
    expect(current).toBeDefined();
    const ok = app.checkExpress(current.exercise.answer);
    expect(ok).toBe(true);
    expect(app.expressCorrect).toBe(1);
  });

  it('checkExpress retourne false pour une mauvaise réponse', () => {
    app.startExpress();
    const ok = app.checkExpress('n\'importe quoi');
    expect(ok).toBe(false);
    expect(app.expressCorrect).toBe(0);
  });

  it('nextExpress avance l\'index et termine à la fin', () => {
    app.startExpress();
    const total = app.expressExercises.length;
    expect(app.expressIndex).toBe(0);
    for (let i = 0; i < total; i++) {
      app.nextExpress();
    }
    expect(app.expressDone).toBe(true);
  });

  it('finishExpress retourne à l\'accueil', () => {
    app.startExpress();
    app.finishExpress(50);
    expect(app.screen).toBe('home');
    expect(app.expressDone).toBe(false);
  });
});
