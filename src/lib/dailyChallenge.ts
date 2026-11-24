// Défi quotidien — système dynamique et varié.
// Génère des défis personnalisés basés sur le vocabulaire appris,
// avec plusieurs types : écoute, traduction, complétion, ordonnancement.

import { app } from './store.svelte';
import type { Vocab, Phrase } from './engine';
import { normalize, answersMatch } from './engine';

export type ChallengeType =
  | 'listen_write'      // Écouter + écrire
  | 'translate'         // FR → EN (banque de mots)
  | 'fill_blank'        // Compléter la phrase
  | 'order_words'       // Remettre les mots dans l'ordre
  | 'multiple_choice';  // Choix multiple

export interface DailyChallenge {
  type: ChallengeType;
  prompt: string;           // Consigne affichée
  question: string;         // Question/phrase source
  answer: string;           // Réponse attendue
  choices?: string[];       // Pour multiple_choice
  word_bank?: string[];     // Pour translate / order_words
  vocab?: Vocab;            // Vocab associé (pour SRS)
  audioText?: string;       // Texte à lire (TTS)
  xp: number;               // XP récompense
  tip?: string;             // Indice contextuel
}

/** Mélange un tableau (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Sélectionne un élément aléatoire. */
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Génère un défi d'écoute : entendre + écrire. */
function makeListenWrite(vocab: Vocab, knownWords: Vocab[]): DailyChallenge {
  const sentences = [
    `${vocab.en}.`,
    `I say "${vocab.en}".`,
    `Do you know "${vocab.en}"?`,
    `The word is "${vocab.en}".`,
  ];
  const sentence = pickOne(sentences);
  return {
    type: 'listen_write',
    prompt: 'Écris ce que tu entends',
    question: sentence,
    answer: sentence,
    vocab,
    audioText: sentence,
    xp: 15,
    tip: `Indice : "${vocab.fr}"`,
  };
}

/** Génère un défi de traduction FR → EN avec banque de mots. */
function makeTranslate(vocab: Vocab, knownWords: Vocab[]): DailyChallenge {
  const distractors = shuffle(knownWords.filter((v) => v.en !== vocab.en).map((v) => v.en)).slice(0, 3);
  const bank = shuffle([vocab.en, ...distractors]);
  return {
    type: 'translate',
    prompt: 'Traduis en anglais',
    question: vocab.fr,
    answer: vocab.en,
    word_bank: bank,
    vocab,
    audioText: vocab.en,
    xp: 12,
    tip: `Mots disponibles : ${bank.join(', ')}`,
  };
}

/** Génère un défi à trous. */
function makeFillBlank(vocab: Vocab, knownWords: Vocab[]): DailyChallenge {
  const templates = [
    `I want to ___ ${vocab.en.replace(/^[a-z]/, (c) => c.toLowerCase())}.`,
    `She knows ___ ${vocab.en.replace(/^[a-z]/, (c) => c.toLowerCase())}.`,
    `Can you ___ ${vocab.en.replace(/^[a-z]/, (c) => c.toLowerCase())}?`,
    `We learn ___ ${vocab.en.replace(/^[a-z]/, (c) => c.toLowerCase())}.`,
  ];
  const template = pickOne(templates);
  const blankIndex = template.indexOf('___');
  const before = template.slice(0, blankIndex).trim();
  const after = template.slice(blankIndex + 3).trim();
  const fullSentence = `${before} ${vocab.en} ${after}`.replace(/\s+/g, ' ').trim();

  return {
    type: 'fill_blank',
    prompt: 'Complète la phrase',
    question: template.replace('___', '_____'),
    answer: vocab.en,
    vocab,
    audioText: fullSentence,
    xp: 10,
    tip: `Indice : "${vocab.fr}"`,
  };
}

/** Génère un défi d'ordonnancement. */
function makeOrderWords(vocab: Vocab, knownWords: Vocab[]): DailyChallenge {
  const words = vocab.en.split(' ');
  if (words.length < 2) return makeFillBlank(vocab, knownWords);

  const shuffled = shuffle([...words]);
  return {
    type: 'order_words',
    prompt: 'Remets les mots dans l\'ordre',
    question: vocab.fr,
    answer: vocab.en,
    word_bank: shuffled,
    vocab,
    audioText: vocab.en,
    xp: 14,
    tip: `${words.length} mots à ordonner`,
  };
}

/** Génère un défi choix multiple. */
function makeMultipleChoice(vocab: Vocab, knownWords: Vocab[]): DailyChallenge {
  const distractors = shuffle(knownWords.filter((v) => v.en !== vocab.en).map((v) => v.en)).slice(0, 3);
  const choices = shuffle([vocab.en, ...distractors]);
  return {
    type: 'multiple_choice',
    prompt: 'Choisis la bonne réponse',
    question: `Comment dit-on « ${vocab.fr} » ?`,
    answer: vocab.en,
    choices,
    vocab,
    audioText: vocab.en,
    xp: 8,
  };
}

/** Types de défis disponibles avec leur poids (probabilité). */
const CHALLENGE_MAKERS: Array<{ weight: number; make: (v: Vocab, k: Vocab[]) => DailyChallenge }> = [
  { weight: 25, make: makeListenWrite },
  { weight: 20, make: makeTranslate },
  { weight: 20, make: makeFillBlank },
  { weight: 15, make: makeOrderWords },
  { weight: 20, make: makeMultipleChoice },
];

/** Choix pondéré. */
function weightedPick<T>(items: Array<{ weight: number; value: T }>): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

/**
 * Génère le défi du jour.
 * - Basé sur les mots déjà appris (personnalisé)
 * - Type varié chaque jour
 * - Déterministe par jour (même défi pour tous à une date donnée)
 */
export function generateDailyChallenge(): DailyChallenge {
  const knownWords = Object.values(app.data.cards)
    .map((c) => c.vocab)
    .filter((v) => v.en.trim());

  // Si pas encore de mots appris, utiliser le vocabulaire de base du cours
  const fallbackVocab: Vocab[] = [
    { en: 'hello', fr: 'bonjour' },
    { en: 'goodbye', fr: 'au revoir' },
    { en: 'thank you', fr: 'merci' },
    { en: 'please', fr: "s'il te plaît" },
    { en: 'yes', fr: 'oui' },
    { en: 'no', fr: 'non' },
    { en: 'how are you', fr: 'comment vas-tu' },
    { en: 'what is your name', fr: 'comment tu t\'appelles' },
    { en: 'nice to meet you', fr: 'enchanté' },
  ];

  const pool = knownWords.length >= 3 ? knownWords : fallbackVocab;

  // Seed déterministe par jour (YYYY-MM-DD)
  const today = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < today.length; i++) seed = seed * 31 + today.charCodeAt(i);
  const seededRandom = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  // Remplacer Math.random temporairement pour le choix du vocab et du type
  const originalRandom = Math.random;
  Math.random = seededRandom;

  try {
    const vocab = pool[Math.floor(Math.random() * pool.length)];
    const maker = weightedPick(CHALLENGE_MAKERS.map((m) => ({ weight: m.weight, value: m.make })));
    return maker(vocab, pool);
  } finally {
    Math.random = originalRandom;
  }
}

/** Vérifie la réponse du défi quotidien. */
export function checkDailyChallenge(challenge: DailyChallenge, userAnswer: string): boolean {
  if (challenge.type === 'multiple_choice') {
    return answersMatch(challenge.answer, userAnswer);
  }
  if (challenge.type === 'translate' || challenge.type === 'order_words') {
    return answersMatch(challenge.answer, userAnswer);
  }
  if (challenge.type === 'listen_write') {
    return answersMatch(challenge.answer, userAnswer);
  }
  if (challenge.type === 'fill_blank') {
    return answersMatch(challenge.answer, userAnswer);
  }
  return false;
}