// Générateur de Drills — exercices ciblés à partir du contenu existant.
// Prend un pattern d'erreur et génère 5 exercices d'entraînement.

import type { CourseData, Exercise } from './engine';
import type { ErrorPattern } from './errors';
import { shuffle } from './shuffle';

export interface Drill {
  id: string;
  pattern: ErrorPattern;
  kind: Exercise['kind'];
  prompt: string;
  answer: string;
  choices?: string[];
  word_bank?: string[];
  accepted?: string[];
}

/** Extrait toutes les phrases anglaises du cours. */
function englishPhrases(course: CourseData): string[] {
  const phrases: string[] = [];
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      for (const ex of lesson.exercises) {
        if (ex.prompt) phrases.push(ex.prompt);
        if (ex.answer) phrases.push(ex.answer);
      }
    }
  }
  return phrases.filter((p) => p.trim().length > 0);
}

/** Génère 5 exercices ciblés pour un pattern donné. */
export function generateDrills(
  pattern: ErrorPattern,
  course: CourseData,
): Drill[] {
  const phrases = englishPhrases(course);
  switch (pattern) {
    case 'article':
      return articleDrills(phrases);
    case 'ordre':
      return orderDrills(phrases);
    case 'orthographe':
      return spellingDrills(phrases);
    case 'conjugaison':
      return conjugationDrills(phrases);
    case 'sens':
      return senseDrills(phrases);
  }
}

/* ---------------- Article drills (cloze: retirer l'article) ---------------- */

const ARTICLES = ['a', 'an', 'the'];

function articleDrills(phrases: string[]): Drill[] {
  const drills: Drill[] = [];
  let idx = 0;
  for (const phrase of phrases) {
    if (drills.length >= 5) break;
    const words = phrase.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      if (drills.length >= 5) break;
      const w = words[i].toLowerCase().replace(/[.,!?]/g, '');
      if (ARTICLES.includes(w)) {
        const copy = [...words];
        copy[i] = '___';
        drills.push({
          id: `drill-article-${idx++}`,
          pattern: 'article',
          kind: 'fill_blank',
          prompt: copy.join(' '),
          answer: words[i],
          accepted: [ARTICLES.find((a) => a === w)!],
        });
      }
    }
  }
  return drills;
}

/* ---------------- Ordre drills (mots mélangés) ---------------- */

function orderDrills(phrases: string[]): Drill[] {
  const drills: Drill[] = [];
  let idx = 0;
  for (const phrase of phrases) {
    if (drills.length >= 5) break;
    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length < 4 || words.length > 9) continue;
    drills.push({
      id: `drill-order-${idx++}`,
      pattern: 'ordre',
      kind: 'order_words',
      prompt: 'Remets les mots dans l’ordre :',
      answer: words.join(' '),
      word_bank: shuffle([...words]),
    });
  }
  return drills;
}

/* ---------------- Orthographe drills (fill_blank avec mot proche) ---------------- */

function spellingDrills(phrases: string[]): Drill[] {
  const drills: Drill[] = [];
  let idx = 0;
  for (const phrase of phrases) {
    if (drills.length >= 5) break;
    const words = phrase.split(/\s+/).filter(Boolean);
    const target = words[Math.floor(Math.random() * words.length)];
    const masked = phrase.replace(target, '___');
    drills.push({
      id: `drill-spelling-${idx++}`,
      pattern: 'orthographe',
      kind: 'fill_blank',
      prompt: masked,
      answer: target,
      accepted: [target],
    });
  }
  return drills;
}

/* ---------------- Conjugaison drills (verbe à la bonne forme) ---------------- */

const VERB_FORMS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were'],
  have: ['has', 'have', 'had'],
  do: ['does', 'do', 'did'],
  go: ['goes', 'go', 'went'],
  like: ['likes', 'like', 'liked'],
  eat: ['eats', 'eat', 'ate'],
};

function conjugationDrills(phrases: string[]): Drill[] {
  const drills: Drill[] = [];
  let idx = 0;
  for (const phrase of phrases) {
    if (drills.length >= 5) break;
    const words = phrase.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      if (drills.length >= 5) break;
      const w = words[i].toLowerCase().replace(/[.,!?]/g, '');
      const forms = VERB_FORMS[w];
      if (forms && forms.length > 1) {
        const correct = forms[0];
        const distractors = forms.slice(1);
        drills.push({
          id: `drill-conj-${idx++}`,
          pattern: 'conjugaison',
          kind: 'multiple_choice',
          prompt: phrase.replace(words[i], '___'),
          answer: correct,
          choices: [correct, ...distractors],
        });
      }
    }
  }
  return drills;
}

/* ---------------- Sens drills (traduction) ---------------- */

function senseDrills(phrases: string[]): Drill[] {
  const drills: Drill[] = [];
  let idx = 0;
  for (const phrase of phrases) {
    if (drills.length >= 5) break;
    drills.push({
      id: `drill-sense-${idx++}`,
      pattern: 'sens',
      kind: 'translate',
      prompt: `Traduis : "${phrase}"`,
      answer: phrase,
    });
  }
  return drills;
}

/** Libellé d'un pattern de drill. */
export function drillLabel(pattern: ErrorPattern): string {
  const labels: Record<ErrorPattern, string> = {
    article: 'Drill : Articles (a, an, the)',
    ordre: 'Drill : Ordre des mots',
    orthographe: 'Drill : Orthographe',
    conjugaison: 'Drill : Conjugaison des verbes',
    sens: 'Drill : Compréhension & traduction',
  };
  return labels[pattern];
}
