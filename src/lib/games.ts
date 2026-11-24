// Mini-jeux de vocabulaire — conçus pour la rétention (spaced repetition intégré).
// Chaque jeu utilise le vocabulaire appris et adapte la difficulté.

import { app } from './store.svelte';
import type { Vocab } from './engine';
import { shuffle, sample } from './shuffle';

export type GameType =
  | 'memory'          // Memory / paires
  | 'speed_match'     // Association rapide
  | 'word_builder'    // Construire le mot lettre par lettre
  | 'listening'       // Écoute et choisis
  | 'sentence_scramble' // Remettre phrase dans l'ordre
  | 'spelling_bee'    // Épellation
  | 'alphabet_car'    // Voiture alphabet qui saute
  | 'word_race'       // Course de mots
  | 'sound_hunter'    // Chasseur de sons
  | 'grammar_guardian'; // Gardien de grammaire

export interface GameSession {
  type: GameType;
  vocab: Vocab[];
  score: number;
  round: number;
  maxRounds: number;
  streak: number;
  bestStreak: number;
  startTime: number;
  completed: boolean;
  xpEarned: number;
}

/** Récupère le vocabulaire appris (avec cartes SRS). */
function getLearnedVocab(): Vocab[] {
  return Object.values(app.data.cards)
    .map((c) => c.vocab)
    .filter((v) => v.en.trim());
}

/** Vocabulaire de secours si rien appris. */
const FALLBACK_VOCAB: Vocab[] = [
  { en: 'hello', fr: 'bonjour' },
  { en: 'goodbye', fr: 'au revoir' },
  { en: 'thank you', fr: 'merci' },
  { en: 'please', fr: "s'il te plaît" },
  { en: 'yes', fr: 'oui' },
  { en: 'no', fr: 'non' },
  { en: 'water', fr: 'eau' },
  { en: 'food', fr: 'nourriture' },
  { en: 'friend', fr: 'ami' },
  { en: 'family', fr: 'famille' },
  { en: 'school', fr: 'école' },
  { en: 'book', fr: 'livre' },
  { en: 'pen', fr: 'stylo' },
  { en: 'table', fr: 'table' },
  { en: 'chair', fr: 'chaise' },
];

function getVocabPool(): Vocab[] {
  const learned = getLearnedVocab();
  return learned.length >= 6 ? learned : [...learned, ...FALLBACK_VOCAB].slice(0, 15);
}

/** Crée une nouvelle session de jeu. */
export function newGame(type: GameType): GameSession {
  const pool = getVocabPool();
  const vocab = sample(pool, Math.min(10, pool.length));
  
  // Configuration spécifique par type de jeu
  const configs: Record<GameType, { maxRounds: number; useAlphabet?: boolean }> = {
    memory: { maxRounds: 8 },
    speed_match: { maxRounds: 10 },
    word_builder: { maxRounds: 10 },
    listening: { maxRounds: 10 },
    sentence_scramble: { maxRounds: 10 },
    spelling_bee: { maxRounds: 10 },
    alphabet_car: { maxRounds: 26, useAlphabet: true }, // 26 lettres
    word_race: { maxRounds: 15 },
    sound_hunter: { maxRounds: 12 },
    grammar_guardian: { maxRounds: 10 },
  };
  
  const config = configs[type] || { maxRounds: 10 };
  
  // Pour alphabet_car, on utilise l'alphabet au lieu du vocabulaire
  const gameVocab = config.useAlphabet 
    ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, i) => ({ 
        en: letter, 
        fr: `Lettre ${letter}`,
        phonetic: getPhonetic(letter)
      })) 
    : sample(pool, Math.min(10, pool.length));
  
  return {
    type,
    vocab: gameVocab as Vocab[],
    score: 0,
    round: 0,
    maxRounds: config.maxRounds,
    streak: 0,
    bestStreak: 0,
    startTime: Date.now(),
    completed: false,
    xpEarned: 0,
  };
}

/** Phonétique simple pour l'alphabet */
function getPhonetic(letter: string): string {
  const phonetics: Record<string, string> = {
    A: 'ei', B: 'bi', C: 'si', D: 'di', E: 'i', F: 'ef', G: 'dji',
    H: 'eitʃ', I: 'ai', J: 'djei', K: 'kei', L: 'el', M: 'em',
    N: 'en', O: 'ou', P: 'pi', Q: 'kju', R: 'ar', S: 'es',
    T: 'ti', U: 'ju', V: 'vi', W: 'dablju', X: 'eks', Y: 'wai', Z: 'zi'
  };
  return phonetics[letter] || letter;
}

/** Calcule l'XP basé sur la performance. */
export function calculateGameXP(session: GameSession): number {
  const base = session.maxRounds * 5;
  const streakBonus = session.bestStreak * 3;
  const speedBonus = Math.max(0, 100 - Math.floor((Date.now() - session.startTime) / 1000));
  return base + streakBonus + Math.min(speedBonus, 50);
}

/** Génère le contenu d'un round selon le type de jeu. */
export interface GameRound {
  question: string;
  answer: string;
  choices?: string[];
  audioText?: string;
  hint?: string;
  metadata?: Record<string, unknown>;
}

export function generateRound(session: GameSession): GameRound | null {
  if (session.round >= session.maxRounds) return null;
  const vocab = session.vocab[session.round % session.vocab.length];
  const pool = getVocabPool().filter((v) => v.en !== vocab.en);

  switch (session.type) {
    case 'memory': {
      // Memory : on montre 6 paires au début, puis on demande de retrouver
      if (session.round === 0) {
        const pairs = sample(pool, 5).map((v) => ({ en: v.en, fr: v.fr }));
        pairs.push({ en: vocab.en, fr: vocab.fr });
        return {
          question: 'Mémorise ces paires',
          answer: '',
          choices: shuffle(pairs.flatMap((p) => [p.en, p.fr])),
          metadata: { pairs, phase: 'memorize' },
        };
      }
      return {
        question: `Où est « ${vocab.fr} » ?`,
        answer: vocab.en,
        choices: shuffle([vocab.en, ...sample(pool, 3).map((v) => v.en)]),
        audioText: vocab.en,
        hint: `Son anglais commence par « ${vocab.en[0].toUpperCase()} »`,
      };
    }

    case 'speed_match': {
      const distractors = sample(pool, 3);
      return {
        question: `Associe : « ${vocab.fr} »`,
        answer: vocab.en,
        choices: shuffle([vocab.en, ...distractors.map((v) => v.en)]),
        audioText: vocab.en,
        hint: 'Réponds vite pour plus de points !',
      };
    }

    case 'word_builder': {
      const letters = shuffle(vocab.en.replace(/\s+/g, '').split(''));
      return {
        question: `Écris « ${vocab.fr} » en anglais`,
        answer: vocab.en,
        choices: letters,
        audioText: vocab.en,
        hint: `${vocab.en.length} lettres`,
        metadata: { targetWord: vocab.en, letters },
      };
    }

    case 'listening': {
      return {
        question: 'Écoute et choisis le bon mot',
        answer: vocab.en,
        choices: shuffle([vocab.en, ...sample(pool, 3).map((v) => v.en)]),
        audioText: vocab.en,
        hint: 'Utilise le bouton 🔊 pour réécouter',
      };
    }

    case 'sentence_scramble': {
      // Crée une phrase simple avec le mot
      const templates = [
        `I like ${vocab.en}.`,
        `This is a ${vocab.en}.`,
        `Do you have ${vocab.en}?`,
        `The ${vocab.en} is here.`,
      ];
      const sentence = templates[Math.floor(Math.random() * templates.length)];
      const words = shuffle(sentence.replace(/[.?]/g, '').split(' '));
      return {
        question: `Remets dans l'ordre : « ${vocab.fr} »`,
        answer: sentence,
        choices: words,
        audioText: sentence,
        hint: `Commence par « ${sentence.split(' ')[0]} »`,
      };
    }

    case 'spelling_bee': {
      return {
        question: `Épelle « ${vocab.fr} » (${vocab.en.length} lettres)`,
        answer: vocab.en,
        audioText: vocab.en,
        hint: `Commence par ${vocab.en[0].toUpperCase()}, finit par ${vocab.en.slice(-1).toUpperCase()}`,
      };
    }

    case 'alphabet_car': {
      // Voiture qui saute sur les lettres de l'alphabet avec pièges
      const letter = vocab.en; // Lettre courante (A-Z)
      const phonetic = getPhonetic(letter);
      
      // Génère des pièges : lettres proches dans l'alphabet ou phonétiquement proches
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const idx = alphabet.indexOf(letter);
      const neighbors = [
        alphabet[Math.max(0, idx - 1)],
        alphabet[Math.min(25, idx + 1)],
        alphabet[Math.max(0, idx - 2)],
        alphabet[Math.min(25, idx + 2)],
      ].filter(Boolean);
      
      // Ajoute des pièges phonétiques
      const phoneticTraps = ['B', 'D', 'P', 'T', 'V', 'F', 'M', 'N', 'S', 'Z']
        .filter(l => l !== letter)
        .slice(0, 2);
      
      const trapChoices = shuffle([...neighbors, ...phoneticTraps]).slice(0, 3);
      const choices = shuffle([letter, ...trapChoices]);
      
      const trapTypes = ['lettre voisine', 'son proche', 'piège visuel'];
      const trapType = trapTypes[Math.floor(Math.random() * trapTypes.length)];
      
      return {
        question: `🚗 La voiture arrive sur la lettre **${letter}** ! Quelle lettre entends-tu ?`,
        answer: letter,
        choices,
        audioText: phonetic,
        hint: `Phonétique : /${phonetic}/ — Attention au ${trapType} !`,
        metadata: { letter, phonetic, trapType, isTrapRound: Math.random() < 0.3 },
      };
    }

    case 'word_race': {
      // Course de mots : tape le mot avant qu'il ne disparaisse
      const word = vocab.en;
      const scrambled = shuffle(word.split('')).join('');
      const distractors = sample(pool, 3).map(v => v.en);
      
      return {
        question: `🏁 Course de mots ! Tape rapidement : **${word}**`,
        answer: word,
        choices: shuffle([word, ...distractors]),
        audioText: word,
        hint: `Indices : ${word.length} lettres, commence par ${word[0].toUpperCase()}`,
        metadata: { scrambled, timeLimit: 5000 },
      };
    }

    case 'sound_hunter': {
      // Chasseur de sons : identifie le son dans le mot
      const word = vocab.en;
      const sounds = [
        { pattern: /^(a|e|i|o|u)/i, name: 'voyelle initiale' },
        { pattern: /(sh|ch|th|ph)/i, name: 'digramme' },
        { pattern: /(tion|sion|ing|ed)$/i, name: 'suffixe' },
        { pattern: /[aeiou]{2}/i, name: 'diphtongue' },
        { pattern: /[bcdfghjklmnpqrstvwxyz]{2,}/i, name: 'consonnes doubles' },
      ];
      
      const foundSound = sounds.find(s => s.pattern.test(word)) || { name: 'son simple', pattern: /./ };
      const soundName = foundSound.name;
      
      const distractors = [
        'voyelle initiale', 'digramme', 'suffixe', 'diphtongue', 
        'consonnes doubles', 'son nasale', 'son liquide'
      ].filter(s => s !== soundName);
      
      const choices = shuffle([soundName, ...sample(distractors, 3)]);
      
      return {
        question: `🔍 Chasseur de sons ! Quel son entends-tu dans **${word}** ?`,
        answer: soundName,
        choices,
        audioText: word,
        hint: `Le mot est « ${vocab.fr} » — écoute bien la prononciation`,
        metadata: { word, targetSound: soundName },
      };
    }

    case 'grammar_guardian': {
      // Gardien de grammaire : corrige la phrase
      const templates = [
        { correct: `I am ${vocab.en}.`, error: `I is ${vocab.en}.`, type: 'verbe être' },
        { correct: `She has ${vocab.en}.`, error: `She have ${vocab.en}.`, type: 'verbe avoir' },
        { correct: `The ${vocab.en} is here.`, error: `The ${vocab.en} are here.`, type: 'singulier/pluriel' },
        { correct: `We like ${vocab.en}s.`, error: `We like ${vocab.en}.`, type: 'pluriel' },
        { correct: `He can ${vocab.en}.`, error: `He cans ${vocab.en}.`, type: 'modal' },
      ];
      const template = templates[Math.floor(Math.random() * templates.length)];
      const choices = shuffle([template.correct, template.error]);
      
      return {
        question: `🛡️ Gardien de grammaire ! Quelle phrase est correcte ?`,
        answer: template.correct,
        choices,
        audioText: template.correct,
        hint: `Type d'erreur : ${template.type} — ${vocab.fr}`,
        metadata: { errorType: template.type },
      };
    }
  }
}

/** Vérifie la réponse selon le type de jeu. */
export function checkGameAnswer(session: GameSession, userAnswer: string, round: GameRound): boolean {
  const vocab = session.vocab[session.round % session.vocab.length];

  if (session.type === 'word_builder') {
    return userAnswer.toLowerCase().replace(/\s+/g, '') === vocab.en.toLowerCase().replace(/\s+/g, '');
  }
  if (session.type === 'sentence_scramble') {
    return userAnswer.trim().toLowerCase() === round.answer.trim().toLowerCase();
  }
  if (session.type === 'spelling_bee') {
    return userAnswer.trim().toLowerCase() === vocab.en.toLowerCase();
  }
  if (session.type === 'alphabet_car') {
    return userAnswer.trim().toUpperCase() === vocab.en.toUpperCase();
  }
  if (session.type === 'word_race') {
    return userAnswer.trim().toLowerCase() === vocab.en.toLowerCase();
  }
  if (session.type === 'sound_hunter') {
    return userAnswer.trim().toLowerCase() === round.answer.trim().toLowerCase();
  }
  if (session.type === 'grammar_guardian') {
    return userAnswer.trim().toLowerCase() === round.answer.trim().toLowerCase();
  }
  return userAnswer.trim().toLowerCase() === vocab.en.toLowerCase();
}

/** Termine un round, met à jour le score/streak. */
export function completeRound(session: GameSession, correct: boolean): void {
  if (correct) {
    session.score += 10 + session.streak * 2;
    session.streak += 1;
    session.bestStreak = Math.max(session.bestStreak, session.streak);
  } else {
    session.streak = 0;
  }
  session.round += 1;

  if (session.round >= session.maxRounds) {
    session.completed = true;
    session.xpEarned = calculateGameXP(session);
  }
}

/** Noms des jeux pour l'UI. */
export const GAME_LABELS: Record<GameType, { name: string; icon: string; desc: string }> = {
  memory: { name: 'Memory', icon: '🧠', desc: 'Retrouve les paires anglais/français' },
  speed_match: { name: 'Rapido', icon: '⚡', desc: 'Associe le plus vite possible' },
  word_builder: { name: 'Word Builder', icon: '🔤', desc: 'Reconstitue le mot lettre par lettre' },
  listening: { name: 'Écoute', icon: '🎧', desc: 'Écoute et choisis le bon mot' },
  sentence_scramble: { name: 'Phrase Mix', icon: '🔀', desc: 'Remets les mots dans l\'ordre' },
  spelling_bee: { name: 'Épellation', icon: '🐝', desc: 'Épelle le mot à l\'oral' },
  alphabet_car: { name: 'Alphabet Car', icon: '🚗', desc: 'Voiture qui saute sur l\'alphabet avec pièges' },
  word_race: { name: 'Word Race', icon: '🏁', desc: 'Course de mots contre la montre' },
  sound_hunter: { name: 'Sound Hunter', icon: '🔍', desc: 'Identifie les sons dans les mots' },
  grammar_guardian: { name: 'Grammar Guardian', icon: '🛡️', desc: 'Corrige les erreurs grammaticales' },
};

/** Tous les jeux disponibles. */
export const ALL_GAMES: GameType[] = ['memory', 'speed_match', 'word_builder', 'listening', 'sentence_scramble', 'spelling_bee', 'alphabet_car', 'word_race', 'sound_hunter', 'grammar_guardian'];