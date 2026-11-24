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

export function answersMatch(expected: string, given: string): boolean {
  return normalize(expected) === normalize(given);
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

// ----------------------------- Profil / gamification -----------------------------

export interface Profile {
  name: string;
  dailyGoalXp: number;
  xpTotal: number;
  xpToday: number;
  streakDays: number;
  lastActive: string | null; // YYYY-MM-DD
  energy: number;
  maxEnergy: number;
  gems: number;
  unlimitedEnergy: boolean;
  freezeCount: number;
}

export function newProfile(name: string): Profile {
  return {
    name,
    dailyGoalXp: 20,
    xpTotal: 0,
    xpToday: 0,
    streakDays: 0,
    lastActive: null,
    energy: 5,
    maxEnergy: 5,
    gems: 0,
    unlimitedEnergy: true,
    freezeCount: 0,
  };
}

export function dayKey(ts = Date.now()): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function yesterdayKey(ts = Date.now()): string {
  return dayKey(ts - DAY);
}

export function loseEnergy(p: Profile): boolean {
  if (p.unlimitedEnergy) return true;
  p.energy = Math.max(0, p.energy - 1);
  return p.energy > 0;
}

/** Enregistre la fin d'une leçon : graines, gemmes, rythme (série). */
export function registerLesson(p: Profile, now: number, xp: number): void {
  const today = dayKey(now);
  const yesterday = yesterdayKey(now);

  p.xpTotal += xp;
  p.gems += Math.floor(xp / 5);

  if (p.lastActive === today) {
    p.xpToday += xp;
  } else if (p.lastActive === yesterday) {
    p.streakDays += 1;
    p.xpToday = xp;
  } else if (p.lastActive == null) {
    p.streakDays = 1;
    p.xpToday = xp;
  } else {
    if (p.freezeCount > 0) {
      p.freezeCount -= 1;
      p.streakDays += 1;
    } else {
      p.streakDays = 1;
    }
    p.xpToday = xp;
  }
  p.lastActive = today;
}

export function dailyGoalPercent(p: Profile): number {
  if (p.dailyGoalXp <= 0) return 100;
  return Math.min(100, Math.round((p.xpToday / p.dailyGoalXp) * 100));
}
