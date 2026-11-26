// Marché des Phrases — génération locale d'exercices à partir des phrases
// du contenu existant (content/fr-en-a1.json). Aucun appel réseau.

import type { CourseData, Exercise, Vocab } from './engine';
import { shuffle } from './shuffle';

export interface PhraseItem {
  en: string;
  fr: string;
  source: string; // exercice d'origine (kind + index)
}

export type ClozeKind = 'cloze' | 'construction' | 'daily';

export interface MarketExercise {
  kind: ClozeKind;
  /** Phrase complète (réponse). */
  phrase: string;
  /** Pour cloze : phrase avec le trou « ___ ». Pour construction : mots mélangés. */
  body: string;
  /** Pour construction : mots dans l'ordre correct. */
  words?: string[];
  /** Pour cloze : mot manquant. */
  target?: string;
}

/** Extrait toutes les phrases-sentences des exercices du cours. */
export function extractPhrases(course: CourseData): PhraseItem[] {
  const seen = new Set<string>();
  const phrases: PhraseItem[] = [];

  let idx = 0;
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      for (const ex of lesson.exercises) {
        idx += 1;
        const source = `${ex.kind}-${idx}`;
        for (const field of [ex.prompt, ex.answer]) {
          if (!field) continue;
          const s = field.trim();
          // Une phrase « réelle » : contient au moins un espace et quelques lettres.
          if (s.length < 6 || !/[a-zA-ZÀ-ÿ]{3}/.test(s)) continue;
          if (seen.has(s)) continue;
          seen.add(s);
          // On utilise l'anglais comme phrase principale quand présent.
          phrases.push({ en: s, fr: '', source });
        }
      }
    }
  }
  return phrases;
}

/** Remplace le mot cible par un trou « ___ » (cloze). */
export function makeCloze(phrase: string, target: string): MarketExercise {
  const regex = new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i');
  const body = phrase.replace(regex, '___');
  return {
    kind: 'cloze',
    phrase,
    body,
    target,
  };
}

/** Mélange les mots d'une phrase pour l'exercice de construction. */
export function makeConstruction(phrase: string): MarketExercise {
  const words = phrase.split(/\s+/).filter(Boolean);
  const shuffled = shuffle([...words]);
  return {
    kind: 'construction',
    phrase,
    body: shuffled.join(' '),
    words,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Phrase du jour : tirage déterministe selon la date. */
export function dailyPhrase(
  phrases: PhraseItem[],
  now = Date.now(),
): PhraseItem | undefined {
  if (phrases.length === 0) return undefined;
  const day = Math.floor(now / 86_400_000);
  return phrases[day % phrases.length];
}

/** Génère un exercice de marché pour un mot donné, tiré d'une phrase contenant ce mot. */
export function marketExerciseFor(
  word: string,
  phrases: PhraseItem[],
  now = Date.now(),
): MarketExercise | undefined {
  const lower = word.toLowerCase();
  const match = phrases.find((p) => p.en.toLowerCase().includes(lower));
  if (!match) return undefined;

  const day = Math.floor(now / 86_400_000);
  const kind: ClozeKind = (['cloze', 'construction', 'daily'] as ClozeKind[])[
    day % 3
  ];

  if (kind === 'cloze') {
    return makeCloze(match.en, word);
  }
  if (kind === 'construction') {
    return makeConstruction(match.en);
  }
  // daily : phrase complète avec audio (le frontend l'itéresse)
  return { kind: 'daily', phrase: match.en, body: match.en };
}
