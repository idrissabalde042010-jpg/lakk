// Moteur frontend de Lakk (miroir TypeScript de `lakk-core` en Rust).
// Il permet à l'interface de tourner dans un navigateur sans compilation WASM.
// En production Tauri, on peut brancher les commandes Rust à la place.

export type ExerciseKind =
  | 'multiple_choice'
  | 'translate'
  | 'listen_type'
  | 'match'
  | 'fill_blank'
  | 'order_words'
  | 'spelling_bee';

export interface Vocab {
  en: string;
  fr: string;
}

export interface Exercise {
  kind: ExerciseKind;
  prompt: string;
  choices?: string[];
  word_bank?: string[];
  answer: string;
  /** Réponses alternatives acceptées (ex: contractions, synonymes) */
  accepted?: string[];
  vocab?: Vocab;
  audio_key?: string;
}

export interface LessonData {
  title: string;
  exercises: Exercise[];
}

export interface UnitData {
  title: string;
  color?: string;
  lessons: LessonData[];
}

/** Phrase « réelle » du jour (défi quotidien). */
export interface Phrase {
  en: string;
  fr: string;
  tip?: string;
}

export interface CourseData {
  course: { source: string; target: string; title: string };
  phrases?: Phrase[];
  units: UnitData[];
}

/** Normalise une réponse : minuscules, sans ponctuation, espaces simples. */
export function normalize(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Génère des variantes avec contractions développées. */
function expandContractions(s: string): string[] {
  const contractions: Record<string, string> = {
    "it's": "it is",
    "i'm": "i am",
    "you're": "you are",
    "we're": "we are",
    "they're": "they are",
    "he's": "he is",
    "she's": "she is",
    "that's": "that is",
    "what's": "what is",
    "where's": "where is",
    "who's": "who is",
    "how's": "how is",
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "won't": "will not",
    "wouldn't": "would not",
    "can't": "cannot",
    "couldn't": "could not",
    "shouldn't": "should not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "hasn't": "has not",
    "haven't": "have not",
    "hadn't": "had not",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "i'd": "i would",
    "you'd": "you would",
    "he'd": "he would",
    "she'd": "she would",
    "we'd": "we would",
    "they'd": "they would",
    "i'll": "i will",
    "you'll": "you will",
    "he'll": "he will",
    "she'll": "she will",
    "we'll": "we will",
    "they'll": "they will",
  };
  
  let result = s;
  for (const [contracted, expanded] of Object.entries(contractions)) {
    result = result.replace(new RegExp(`\\b${contracted.replace("'", "\\'")}\\b`, 'gi'), expanded);
  }
  return [s, result];
}

/** Vérifie si la réponse correspond, en gérant les contractions et réponses alternatives. */
export function answersMatch(expected: string, given: string, accepted?: string[]): boolean {
  const normGiven = normalize(given);
  const normExpected = normalize(expected);
  
  if (normGiven === normExpected) return true;
  
  // Vérifier les contractions
  const [, expandedGiven] = expandContractions(normGiven);
  const [, expandedExpected] = expandContractions(normExpected);
  if (normalize(expandedGiven) === normalize(expandedExpected)) return true;
  
  // Vérifier les réponses alternatives acceptées
  if (accepted) {
    for (const alt of accepted) {
      if (normGiven === normalize(alt)) return true;
      const [, expandedAlt] = expandContractions(normalize(alt));
      if (normalize(expandedGiven) === normalize(expandedAlt)) return true;
    }
  }
  
  return false;
}

// ----------------------------- SRS (FSRS-lite) -----------------------------

export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export const DAY = 86_400_000;

export interface Card {
  vocab: Vocab;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: CardState;
  due_at: number;
  last_review: number | null;
}

export function newCard(vocab: Vocab, now = Date.now()): Card {
  return {
    vocab,
    stability: 0,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    state: 'new',
    due_at: now,
    last_review: null,
  };
}

export function retrievability(card: Card, now = Date.now()): number {
  if (card.last_review == null || card.stability <= 0) return 0;
  const elapsed = Math.max(0, now - card.last_review) / DAY;
  return Math.exp(-elapsed / card.stability);
}

export function isDue(card: Card, now = Date.now()): boolean {
  return card.due_at <= now;
}

/** Applique une révision, mute la carte, renvoie l'intervalle en jours. */
export function reviewCard(card: Card, grade: Grade, now = Date.now()): number {
  const elapsed = card.last_review == null ? 0 : Math.max(0, now - card.last_review) / DAY;
  const r = card.stability > 0 ? Math.exp(-elapsed / card.stability) : 0;
  const wasNew = card.stability <= 0;

  let s = card.stability;
  let d = card.difficulty;

  if (wasNew) {
    s = grade === 1 ? 0.3 : grade === 2 ? 0.8 : grade === 3 ? 1.5 : 3.0;
    d = grade === 1 ? 6 : grade === 2 ? 5.5 : grade === 3 ? 5 : 4;
  } else {
    d += grade === 1 ? 1 : grade === 2 ? 0.3 : grade === 3 ? -0.05 : -0.3;
    d = Math.min(10, Math.max(1, d));
    const factor =
      grade === 1
        ? 0.25
        : grade === 2
          ? 1.15
          : grade === 3
            ? Math.max(1.1, 1.6 - 0.05 * d)
            : Math.max(1.3, 2.2 - 0.05 * d);
    s = Math.max(0.2, s * factor);
    s *= 1 + 0.05 * (1 - r) * Math.max(0, grade - 2);
  }

  card.stability = s;
  card.difficulty = d;
  card.reps += 1;
  card.last_review = now;

  if (grade === 1) {
    card.lapses += 1;
    card.state = wasNew ? 'learning' : 'relearning';
  } else {
    card.state = 'review';
  }

  const interval = Math.max(1, Math.ceil(s));
  card.due_at = now + interval * DAY;
  return interval;
}

/** Libellé de maîtrise pour le carnet de mots. */
export function mastery(card: Card): { label: string; pct: number } {
  const pct = Math.round(Math.min(1, card.stability / 21) * 100);
  if (card.state === 'new') return { label: 'Nouveau', pct: 0 };
  if (pct >= 70) return { label: 'Solide', pct };
  if (pct >= 30) return { label: 'En cours', pct };
  return { label: 'À revoir', pct };
}

/** Retourne les mots faibles (maîtrise < 70%), triés du plus faible au plus fort, limités à 10.
 * Exclut les cartes "Nouveau" (jamais révisées) qui sont gérées par le flux SRS normal. */
export function weakCards(cards: Card[], limit = 10): Card[] {
  return cards
    .filter((c) => c.state !== 'new' && mastery(c).pct < 70)
    .sort((a, b) => mastery(a).pct - mastery(b).pct)
    .slice(0, limit);
}

// ----------------------------- Profil / gamification -----------------------------

// Jalons de série (style Streak Society Duolingo).
export const STREAK_MILESTONES: readonly number[] = [7, 30, 50, 100, 365];

export interface StreakBadge {
  days: number;
  earnedAt: number | null; // timestamp
}

export interface Profile {
  name: string;
  avatar: string;
  /** Langue de l'interface (code ISO) : 'fr' | 'en' */
  uiLang: 'fr' | 'en';
  /** Langue d'apprentissage (code ISO) : 'en' | 'es' | 'wo' */
  learnLang: 'en' | 'es' | 'wo';
  dailyGoalXp: number;
  xpTotal: number;
  xpToday: number;
  streakDays: number;
  lastActive: string | null; // YYYY-MM-DD
  /** Jours actifs (YYYY-MM-DD) pour l'anneau de régularité. */
  activeDays: string[];
  /** Mois (YYYY-MM) où le joker automatique a été consommé. */
  jokerUsedMonth: string | null;
  /** Dernier jour couvert par une pause planifiée (incluse), ou null. */
  pauseUntil: string | null;
  /** Série visuelle avant la dernière interruption (reprise à 50 %). */
  streakBeforeLapse: number | null;
  /** Vrai si la dernière leçon a restauré une série interrompue à 50 %. */
  recoveredFromLapse: boolean;
  energy: number;
  maxEnergy: number;
  gems: number;
  unlimitedEnergy: boolean;
  freezeCount: number;
  /** Dernière semaine ISO où les gels ont été accordés (ex: 2026-W45 -> 45) */
  lastFreezeGrantWeek: number | null;
  /** Badges de série gagnés (clé = nombre de jours en string, ex: "7", "30") */
  badges: Record<string, StreakBadge>;
}

export function newProfile(name: string): Profile {
  return {
    name,
    avatar: '🦁',
    uiLang: 'fr',
    learnLang: 'en',
    dailyGoalXp: 20,
    xpTotal: 0,
    xpToday: 0,
    streakDays: 0,
    lastActive: null,
    activeDays: [],
    jokerUsedMonth: null,
    pauseUntil: null,
    streakBeforeLapse: null,
    recoveredFromLapse: false,
    energy: 5,
    maxEnergy: 5,
    gems: 0,
    unlimitedEnergy: true,
    freezeCount: 0,
    lastFreezeGrantWeek: null,
    badges: {},
  };
}

export function dayKey(ts = Date.now()): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function yesterdayKey(ts = Date.now()): string {
  return dayKey(ts - DAY);
}

// ----------------------------- Série Vivante -----------------------------

/** Nombre de jours affichés dans l'anneau de régularité. */
export const REGULARITY_DAYS = 7;
/** Nombre maximum de jours de pause planifiée. */
export const MAX_PAUSE_DAYS = 7;
/** Nombre de jours actifs conservés dans le profil. */
const ACTIVE_DAYS_KEEP = 60;

export interface RingDay {
  /** Date locale YYYY-MM-DD. */
  key: string;
  active: boolean;
}

export interface RegularityRingData {
  days: RingDay[];
  activeCount: number;
  target: number;
  percent: number;
  crown: boolean;
}

/** Décale une clé YYYY-MM-DD de `delta` jours (à midi, pour éviter les pièges DST). */
export function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + delta);
  return dayKey(dt.getTime());
}

/** Différence en jours entre deux clés YYYY-MM-DD (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
  const tb = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((tb - ta) / DAY);
}

/** Clé de mois locale YYYY-MM. */
export function monthKey(ts = Date.now()): string {
  return dayKey(ts).slice(0, 7);
}

/** Ajoute un jour actif (dédupliqué, borné aux 60 derniers jours). */
export function addActiveDay(p: Profile, key: string): void {
  if (!p.activeDays.includes(key)) p.activeDays.push(key);
  p.activeDays.sort();
  if (p.activeDays.length > ACTIVE_DAYS_KEEP) {
    p.activeDays = p.activeDays.slice(-ACTIVE_DAYS_KEEP);
  }
}

/** Calcule l'anneau de régularité sur les 7 derniers jours (aujourd'hui inclus). */
export function regularityRing(activeDays: readonly string[], now = Date.now()): RegularityRingData {
  const today = dayKey(now);
  const days: RingDay[] = [];
  for (let i = REGULARITY_DAYS - 1; i >= 0; i--) {
    const key = shiftDayKey(today, -i);
    days.push({ key, active: activeDays.includes(key) });
  }
  const activeCount = days.filter((d) => d.active).length;
  return {
    days,
    activeCount,
    target: REGULARITY_DAYS,
    percent: Math.round((activeCount / REGULARITY_DAYS) * 100),
    crown: activeCount >= REGULARITY_DAYS,
  };
}

/** Un joker automatique est disponible chaque mois civil. */
export function isJokerAvailable(p: Profile, now = Date.now()): boolean {
  return p.jokerUsedMonth !== monthKey(now);
}

/** Consomme le joker du mois. Retourne true s'il était disponible. */
export function consumeMonthlyJoker(p: Profile, now = Date.now()): boolean {
  if (!isJokerAvailable(p, now)) return false;
  p.jokerUsedMonth = monthKey(now);
  return true;
}

/** Active une pause planifiée (1 à 7 jours, aujourd'hui inclus). */
export function startPause(p: Profile, now = Date.now(), days = MAX_PAUSE_DAYS): void {
  const span = Math.min(MAX_PAUSE_DAYS, Math.max(1, Math.floor(days)));
  p.pauseUntil = shiftDayKey(dayKey(now), span - 1);
}

/** Annule la pause planifiée. */
export function cancelPause(p: Profile): void {
  p.pauseUntil = null;
}

/** Vrai si la pause couvre aujourd'hui. */
export function isPaused(p: Profile, now = Date.now()): boolean {
  return p.pauseUntil != null && p.pauseUntil >= dayKey(now);
}

/**
 * Vrai si un jour a été manqué (dernière activité avant hier) et qu'aucune
 * pause n'est active. L'utilisateur peut alors « reprendre en 2 min ».
 */
export function isStreakBroken(p: Profile, now = Date.now()): boolean {
  return p.lastActive != null
    && p.lastActive < yesterdayKey(now)
    && !isPaused(p, now);
}

/** Retourne le numéro de semaine ISO (1-53) pour un timestamp. */
function isoWeek(ts: number): number {
  const d = new Date(ts);
  // Jeudi de la semaine courante (ISO 8601)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

/** Accorde les gels de série hebdomadaires (2 par semaine, reset le lundi).
 * Retourne true si les gels ont été mis à jour. */
export function grantWeeklyFreezes(p: Profile, now: number): boolean {
  const week = isoWeek(now);
  if (p.lastFreezeGrantWeek === week) {
    return false;
  }
  // Babbel style: 2 freezes par semaine, non cumulables, reset lundi.
  p.freezeCount = 2;
  p.lastFreezeGrantWeek = week;
  return true;
}

/** Vérifie et attribue les nouveaux badges de série atteints.
 * Retourne la liste des jours des badges nouvellement gagnés. */
export function checkStreakBadges(p: Profile, now: number): number[] {
  const newBadges: number[] = [];
  for (const milestone of STREAK_MILESTONES) {
    if (p.streakDays >= milestone) {
      const key = milestone.toString();
      if (!p.badges[key]) {
        p.badges[key] = { days: milestone, earnedAt: now };
        newBadges.push(milestone);
      }
    }
  }
  return newBadges;
}

/** Retourne true si un badge pour ce jalon a déjà été gagné. */
export function hasBadge(p: Profile, days: number): boolean {
  return !!p.badges[days.toString()];
}

/** Retourne la liste des badges gagnés, triés par jours. */
export function earnedBadges(p: Profile): StreakBadge[] {
  return Object.values(p.badges)
    .sort((a, b) => a.days - b.days);
}

/** Répare la série perdue : restaure streakDays à 1 et lastActive à aujourd'hui.
 * Coûte 50 gemmes. Retourne true si la réparation a réussi. */
export function repairStreak(p: Profile, now: number): boolean {
  if (p.gems < 50) {
    return false;
  }
  // Ne répare que si la série est perdue (streak=0 et lastActive plus vieux qu'hier)
  const today = dayKey(now);
  const yesterday = yesterdayKey(now);
  const canRepair = p.streakDays === 0
    && p.lastActive != null
    && p.lastActive < yesterday;
  if (!canRepair) {
    return false;
  }
  p.gems -= 50;
  p.streakDays = 1;
  p.lastActive = today;
  p.xpToday = 0; // Reset XP du jour pour la nouvelle série
  return true;
}

export function loseEnergy(p: Profile): boolean {
  if (p.unlimitedEnergy) return true;
  p.energy = Math.max(0, p.energy - 1);
  return p.energy > 0;
}

/** Enregistre la fin d'une leçon : graines, gemmes, rythme (série). */
export function registerLesson(p: Profile, now: number, xp: number): void {
  // Accorde les gels hebdomadaires au début de la semaine (lundi).
  grantWeeklyFreezes(p, now);

  const today = dayKey(now);
  const yesterday = yesterdayKey(now);
  const last = p.lastActive;

  p.xpTotal += xp;
  p.gems += Math.floor(xp / 5);

  if (last === today) {
    // Deuxième leçon du jour : la série ne bouge pas.
    p.xpToday += xp;
  } else {
    const gap = last == null ? null : daysBetweenKeys(last, today);

    if (last == null) {
      // Premier jour : la série démarre.
      p.streakDays = 1;
      p.recoveredFromLapse = false;
    } else if (gap === 1) {
      // Jour consécutif.
      p.streakDays += 1;
      p.recoveredFromLapse = false;
    } else if (p.pauseUntil != null && p.pauseUntil >= yesterday) {
      // La pause planifiée couvre le trou : aucune pénalité.
      p.streakDays = Math.max(1, p.streakDays + 1);
      p.recoveredFromLapse = false;
    } else if (p.freezeCount > 0) {
      // Gel hebdomadaire (compatibilité avec l'ancien système).
      p.freezeCount -= 1;
      p.streakDays += 1;
      p.recoveredFromLapse = false;
    } else if (gap === 2 && consumeMonthlyJoker(p, now)) {
      // Joker mensuel automatique : un jour manqué est pardonné.
      p.streakDays += 1;
      p.recoveredFromLapse = false;
    } else if (gap === 2) {
      // Never miss twice : la série visuelle revient à 50 %, pas à zéro.
      p.streakBeforeLapse = p.streakDays;
      p.streakDays = Math.max(1, Math.floor(p.streakDays / 2));
      p.recoveredFromLapse = p.streakDays > 1;
    } else {
      // Interruption plus longue : on repart, mais on garde une trace.
      p.streakBeforeLapse = p.streakDays;
      p.streakDays = 1;
      p.recoveredFromLapse = false;
    }

    p.xpToday = xp;
  }

  p.lastActive = today;
  addActiveDay(p, today);
  // Une pause terminée n'a plus besoin d'être conservée.
  if (p.pauseUntil != null && p.pauseUntil < today) p.pauseUntil = null;
  // Vérifie les badges de série après mise à jour de la streak.
  checkStreakBadges(p, now);
}

export function dailyGoalPercent(p: Profile): number {
  if (p.dailyGoalXp <= 0) return 100;
  return Math.min(100, Math.round((p.xpToday / p.dailyGoalXp) * 100));
}
