// Quêtes quotidiennes — 3 quêtes par jour (bronze/argent/or) style Duolingo/Babbel.
// Chaque quête a un niveau de difficulté croissant et donne une récompense.
// Compléter les 3 ouvre un coffre bonus.

import { app } from './store.svelte';
import type { Vocab, Phrase } from './engine';
import { normalize, answersMatch } from './engine';

export type ChallengeType =
  | 'listen_write'      // Écouter + écrire
  | 'translate'         // FR → EN (banque de mots)
  | 'fill_blank'        // Compléter la phrase
  | 'order_words'       // Remettre les mots dans l'ordre
  | 'multiple_choice';  // Choix multiple

export type QuestTier = 'bronze' | 'silver' | 'gold';

export interface DailyQuest {
  id: QuestTier;
  type: ChallengeType;
  prompt: string;           // Consigne affichée
  question: string;         // Question/phrase source
  answer: string;           // Réponse attendue
  choices?: string[];       // Pour multiple_choice
  word_bank?: string[];     // Pour translate / order_words
  vocab?: Vocab;            // Vocab associé (pour SRS)
  audioText?: string;       // Texte à lire (TTS)
  xp: number;               // XP récompense
  gemReward: number;        // Gemmes récompense
  tip?: string;             // Indice contextuel
  completed: boolean;       // Si la quête est terminée
}

export interface DailyQuests {
  date: string;             // YYYY-MM-DD
  quests: DailyQuest[];     // 3 quêtes : bronze, argent, or
  chestClaimed: boolean;    // Si le coffre bonus a été réclamé
  allCompleted: boolean;    // Si les 3 quêtes sont terminées
}

export interface ChestReward {
  type: 'bronze' | 'silver' | 'gold' | 'bonus';
  gems: number;
  xpBoostMinutes?: number;  // Minutes de boost XP (ex: 10 min 3× XP)
  message: string;
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

/** Génère un RNG déterministe basé sur une seed. */
function createSeededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

/** Configuration des quêtes par tier (difficulté croissante). */
export const QUEST_CONFIG: Record<QuestTier, { xp: number; gems: number; weight: number }> = {
  bronze: { xp: 10, gems: 3, weight: 1 },    // Facile, récompense modeste
  silver: { xp: 20, gems: 8, weight: 2 },    // Moyen, récompense correcte
  gold:   { xp: 35, gems: 15, weight: 3 },   // Difficile, belle récompense
};

/** Types de défis disponibles par tier (plus de variété pour l'or). */
export const TIER_CHALLENGE_MAKERS: Record<QuestTier, Array<{ weight: number; make: (v: Vocab, k: Vocab[], tier: QuestTier) => DailyQuest }>> = {
  bronze: [
    { weight: 30, make: (v, k, t) => makeMultipleChoice(v, k, t) },
    { weight: 25, make: (v, k, t) => makeTranslate(v, k, t) },
    { weight: 25, make: (v, k, t) => makeFillBlank(v, k, t) },
    { weight: 20, make: (v, k, t) => makeListenWrite(v, k, t) },
  ],
  silver: [
    { weight: 25, make: (v, k, t) => makeTranslate(v, k, t) },
    { weight: 25, make: (v, k, t) => makeOrderWords(v, k, t) },
    { weight: 20, make: (v, k, t) => makeFillBlank(v, k, t) },
    { weight: 15, make: (v, k, t) => makeListenWrite(v, k, t) },
    { weight: 15, make: (v, k, t) => makeMultipleChoice(v, k, t) },
  ],
  gold: [
    { weight: 30, make: (v, k, t) => makeListenWrite(v, k, t) },
    { weight: 25, make: (v, k, t) => makeOrderWords(v, k, t) },
    { weight: 20, make: (v, k, t) => makeTranslate(v, k, t) },
    { weight: 15, make: (v, k, t) => makeFillBlank(v, k, t) },
    { weight: 10, make: (v, k, t) => makeMultipleChoice(v, k, t) },
  ],
};

/** Génère un défi d'écoute : entendre + écrire. */
function makeListenWrite(vocab: Vocab, knownWords: Vocab[], tier: QuestTier): DailyQuest {
  const sentences = [
    `${vocab.en}.`,
    `I say "${vocab.en}".`,
    `Do you know "${vocab.en}"?`,
    `The word is "${vocab.en}".`,
  ];
  const sentence = pickOne(sentences);
  const cfg = QUEST_CONFIG[tier];
  return {
    id: tier,
    type: 'listen_write',
    prompt: 'Écris ce que tu entends',
    question: sentence,
    answer: sentence,
    vocab,
    audioText: sentence,
    xp: cfg.xp,
    gemReward: cfg.gems,
    tip: `Indice : "${vocab.fr}"`,
    completed: false,
  };
}

/** Génère un défi de traduction FR → EN avec banque de mots. */
function makeTranslate(vocab: Vocab, knownWords: Vocab[], tier: QuestTier): DailyQuest {
  const distractors = shuffle(knownWords.filter((v) => v.en !== vocab.en).map((v) => v.en)).slice(0, 3);
  const bank = shuffle([vocab.en, ...distractors]);
  const cfg = QUEST_CONFIG[tier];
  return {
    id: tier,
    type: 'translate',
    prompt: 'Traduis en anglais',
    question: vocab.fr,
    answer: vocab.en,
    word_bank: bank,
    vocab,
    audioText: vocab.en,
    xp: cfg.xp,
    gemReward: cfg.gems,
    tip: `Mots disponibles : ${bank.join(', ')}`,
    completed: false,
  };
}

/** Génère un défi à trous. */
function makeFillBlank(vocab: Vocab, knownWords: Vocab[], tier: QuestTier): DailyQuest {
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
  const cfg = QUEST_CONFIG[tier];
  return {
    id: tier,
    type: 'fill_blank',
    prompt: 'Complète la phrase',
    question: template.replace('___', '_____'),
    answer: vocab.en,
    vocab,
    audioText: fullSentence,
    xp: cfg.xp,
    gemReward: cfg.gems,
    tip: `Indice : "${vocab.fr}"`,
    completed: false,
  };
}

/** Génère un défi d'ordonnancement. */
function makeOrderWords(vocab: Vocab, knownWords: Vocab[], tier: QuestTier): DailyQuest {
  const words = vocab.en.split(' ');
  if (words.length < 2) return makeFillBlank(vocab, knownWords, tier);

  const shuffled = shuffle([...words]);
  const cfg = QUEST_CONFIG[tier];
  return {
    id: tier,
    type: 'order_words',
    prompt: 'Remets les mots dans l\'ordre',
    question: vocab.fr,
    answer: vocab.en,
    word_bank: shuffled,
    vocab,
    audioText: vocab.en,
    xp: cfg.xp,
    gemReward: cfg.gems,
    tip: `${words.length} mots à ordonner`,
    completed: false,
  };
}

/** Génère un défi choix multiple. */
function makeMultipleChoice(vocab: Vocab, knownWords: Vocab[], tier: QuestTier): DailyQuest {
  const distractors = shuffle(knownWords.filter((v) => v.en !== vocab.en).map((v) => v.en)).slice(0, 3);
  const choices = shuffle([vocab.en, ...distractors]);
  const cfg = QUEST_CONFIG[tier];
  return {
    id: tier,
    type: 'multiple_choice',
    prompt: 'Choisis la bonne réponse',
    question: `Comment dit-on « ${vocab.fr} » ?`,
    answer: vocab.en,
    choices,
    vocab,
    audioText: vocab.en,
    xp: cfg.xp,
    gemReward: cfg.gems,
    completed: false,
  };
}

/** Choix pondéré pour le type de défi. */
function weightedPick<T>(items: Array<{ weight: number; value: T }>, random: () => number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

/** Clé de stockage pour les quêtes quotidiennes. */
const QUESTS_KEY = 'lakk.quests.v1';

/** Charge les quêtes du jour depuis localStorage. */
function loadDailyQuests(): DailyQuests | null {
  try {
    const raw = localStorage.getItem(QUESTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyQuests;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return null; // Quêtes expirées (nouveau jour)
    return parsed;
  } catch {
    return null;
  }
}

/** Sauvegarde les quêtes du jour dans localStorage. */
function saveDailyQuests(quests: DailyQuests): void {
  try {
    localStorage.setItem(QUESTS_KEY, JSON.stringify(quests));
  } catch {
    // stockage indisponible
  }
}

/**
 * Génère les 3 quêtes du jour (bronze, argent, or).
 * Déterministe par jour : mêmes quêtes pour tous à une date donnée.
 */
export function generateDailyQuests(): DailyQuests {
  const today = new Date().toISOString().slice(0, 10);

  // Essaie de charger les quêtes existantes
  const existing = loadDailyQuests();
  if (existing) return existing;

  // Vocabulaire connu
  const knownWords = Object.values(app.data.cards)
    .map((c) => c.vocab)
    .filter((v) => v.en.trim());

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

  // Seed déterministe par jour
  let seed = 0;
  for (let i = 0; i < today.length; i++) seed = seed * 31 + today.charCodeAt(i);
  const random = createSeededRandom(seed);

  // Génère une quête par tier
  const tiers: QuestTier[] = ['bronze', 'silver', 'gold'];
  const quests: DailyQuest[] = tiers.map((tier) => {
    const vocab = pool[Math.floor(random() * pool.length)];
    const makers = TIER_CHALLENGE_MAKERS[tier];
    const maker = weightedPick(makers.map((m) => ({ weight: m.weight, value: m.make })), random);
    return maker(vocab, pool, tier);
  });

  const dailyQuests: DailyQuests = {
    date: today,
    quests,
    chestClaimed: false,
    allCompleted: false,
  };

  saveDailyQuests(dailyQuests);
  return dailyQuests;
}

/** Vérifie la réponse d'une quête. */
export function checkDailyQuest(quest: DailyQuest, userAnswer: string): boolean {
  if (quest.type === 'multiple_choice') {
    return answersMatch(quest.answer, userAnswer);
  }
  if (quest.type === 'translate' || quest.type === 'order_words') {
    return answersMatch(quest.answer, userAnswer);
  }
  if (quest.type === 'listen_write') {
    return answersMatch(quest.answer, userAnswer);
  }
  if (quest.type === 'fill_blank') {
    return answersMatch(quest.answer, userAnswer);
  }
  return false;
}

/** Marque une quête comme terminée et met à jour les récompenses. */
export function completeDailyQuest(tier: QuestTier): { quest: DailyQuest; chestReward?: ChestReward } | null {
  const questsData = loadDailyQuests();
  if (!questsData) return null;

  const quest = questsData.quests.find((q) => q.id === tier);
  if (!quest || quest.completed) return null;

  quest.completed = true;

  // Donne les récompenses immédiates (XP + gemmes)
  app.completeLesson(99, 99, quest.xp, 100); // XP via completeLesson (gère gemmes = xp/5)
  // Ajoute les gemmes bonus de la quête
  app.data.profile.gems += quest.gemReward;

  // Vérifie si toutes les quêtes sont terminées
  const allDone = questsData.quests.every((q) => q.completed);
  if (allDone && !questsData.allCompleted) {
    questsData.allCompleted = true;
    // Coffre bonus pour avoir complété les 3 quêtes
    const bonusGems = 20;
    app.data.profile.gems += bonusGems;
    questsData.chestClaimed = false; // Le coffre n'est pas encore réclamé visuellement
  }

  app.save();
  saveDailyQuests(questsData);

  // Détermine la récompense de coffre si applicable
  let chestReward: ChestReward | undefined;
  if (allDone && !questsData.chestClaimed) {
    chestReward = {
      type: 'bonus',
      gems: 20,
      xpBoostMinutes: 10,
      message: 'Toutes les quêtes terminées ! Coffre bonus +20 gemmes + 10 min 3× XP',
    };
  } else {
    const tierRewards: Record<QuestTier, ChestReward> = {
      bronze: { type: 'bronze', gems: 3, message: 'Quête bronze terminée ! +3 gemmes' },
      silver: { type: 'silver', gems: 8, message: 'Quête argent terminée ! +8 gemmes' },
      gold: { type: 'gold', gems: 15, xpBoostMinutes: 5, message: 'Quête or terminée ! +15 gemmes + 5 min 3× XP' },
    };
    chestReward = tierRewards[tier];
  }

  return { quest, chestReward };
}

/** Réclame le coffre bonus (visuel uniquement, gemmes déjà données). */
export function claimBonusChest(): ChestReward | null {
  const questsData = loadDailyQuests();
  if (!questsData || !questsData.allCompleted || questsData.chestClaimed) return null;

  questsData.chestClaimed = true;
  saveDailyQuests(questsData);

  return {
    type: 'bonus',
    gems: 20,
    xpBoostMinutes: 10,
    message: 'Coffre bonus réclamé ! +20 gemmes + 10 min 3× XP demain',
  };
}

/** Récompenses de coffre par tier (pour affichage). */
export function getChestReward(tier: QuestTier): ChestReward {
  const rewards: Record<QuestTier, ChestReward> = {
    bronze: { type: 'bronze', gems: 3, message: 'Coffre bronze : +3 gemmes' },
    silver: { type: 'silver', gems: 8, message: 'Coffre argent : +8 gemmes' },
    gold: { type: 'gold', gems: 15, xpBoostMinutes: 5, message: 'Coffre or : +15 gemmes + 5 min 3× XP' },
  };
  return rewards[tier];
}

/** Pour rétrocompatibilité : génère un défi unique (ancienne API). */
export function generateDailyChallenge(): DailyQuest {
  const quests = generateDailyQuests();
  // Retourne la quête bronze par défaut
  return quests.quests[0];
}

/** Pour rétrocompatibilité. */
export function checkDailyChallenge(challenge: DailyQuest, userAnswer: string): boolean {
  return checkDailyQuest(challenge, userAnswer);
}