// État global de l'application (Svelte 5 runes) + persistance locale.
import { defaultCourse, fallbackPhrases, lessonRefs, loadCourse, type LessonRef } from './content';
import type { Card, CourseData, Grade, LessonData, Phrase, Profile, Vocab } from './engine';
import {
  cancelPause as engineCancelPause,
  dailyGoalPercent,
  dayKey,
  isDue,
  isJokerAvailable,
  isPaused,
  isStreakBroken,
  newCard,
  newProfile,
  registerLesson,
  regularityRing as computeRegularityRing,
  reviewCard,
  startPause as engineStartPause,
  type RegularityRingData,
} from './engine';
import { isTauri, nativeCourse, nativeReview, nativeStats, type NativeStats } from './native';
import { DEFAULT_AVATAR, isValidAvatar, sanitizeName } from './profile';
import { introSeen } from './intro';

export interface Persist {
  profile: Profile;
  cards: Record<string, Card>;
  completed: Record<string, boolean>;
  history: Record<string, number>; // YYYY-MM-DD -> graines
}

const KEY = 'lakk.v1';
const DAY = 86_400_000;

function defaultState(): Persist {
  return { profile: newProfile('Idrissa'), cards: {}, completed: {}, history: {} };
}

function loadState(): Persist {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<Persist>;
    const base = defaultState();
    const profile = { ...base.profile, ...(parsed.profile ?? {}) };
    if (!isValidAvatar(profile.avatar)) profile.avatar = DEFAULT_AVATAR;

    // Migration douce : les profils créés avant la Série Vivante n'ont pas
    // encore de journal de jours actifs. On le reconstruit depuis l'historique.
    if (!Array.isArray(profile.activeDays)) profile.activeDays = [];
    if (profile.activeDays.length === 0) {
      const fromHistory = Object.keys(parsed.history ?? {})
        .filter((k) => (parsed.history?.[k] ?? 0) > 0)
        .slice(-60);
      profile.activeDays = fromHistory;
      if (profile.lastActive && !profile.activeDays.includes(profile.lastActive)) {
        profile.activeDays.push(profile.lastActive);
        profile.activeDays.sort();
      }
    }

    return {
      profile,
      cards: parsed.cards ?? {},
      completed: parsed.completed ?? {},
      history: parsed.history ?? {},
    };
  } catch {
    return defaultState();
  }
}

export type Screen = 'home' | 'lesson' | 'review' | 'games' | 'music' | 'profile' | 'multiplayer';

/** Moteur qui fait autorité pour le contenu et la planification. */
export type Engine = 'rust' | 'typescript';

class AppState {
  screen = $state<Screen>('home');
  data = $state<Persist>(loadState());
  active = $state<{ u: number; l: number } | null>(null);
  toast = $state<string | null>(null);
  /** Histoire d'introduction ouverte (premier lancement ou relecture). */
  introOpen = $state(!introSeen());

  /** Contenu actif : Rust en application native, copie locale sur le web. */
  course = $state<CourseData>(defaultCourse);
  engine = $state<Engine>(isTauri ? 'rust' : 'typescript');
  stats = $state<NativeStats | null>(null);

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // stockage indisponible : on continue en mémoire
    }
  }

  get profile(): Profile {
    return this.data.profile;
  }

  setScreen(s: Screen): void {
    this.screen = s;
  }

  /** Rouvre l'histoire (depuis le profil). */
  openIntro(): void {
    this.introOpen = true;
  }

  /** Ferme l'histoire une fois terminée. */
  closeIntro(): void {
    this.introOpen = false;
  }

  /** Charge le contenu pour les langues du profil. */
  async loadContent(): Promise<void> {
    const { uiLang, learnLang } = this.data.profile;
    if (isTauri) {
      // En Tauri, on essaie d'abord le Rust, sinon fallback dynamique
      const [course, stats] = await Promise.all([nativeCourse(), nativeStats()]);
      if (course && course.units?.length) {
        this.course = course;
        this.engine = 'rust';
      } else {
        this.course = await loadCourse(uiLang, learnLang);
        this.engine = 'typescript';
      }
      if (stats) this.stats = stats;
    } else {
      // Sur le web : chargement dynamique selon les langues
      this.course = await loadCourse(uiLang, learnLang);
      this.engine = 'typescript';
    }
  }

  /** Charge le contenu et les statistiques depuis `lakk-core` (Rust). */
  async init(): Promise<void> {
    await this.loadContent();
  }

  // ------------------------------ Parcours ------------------------------

  get lessons(): LessonRef[] {
    return lessonRefs(this.course);
  }

  /** Phrase du jour : elle change chaque jour, pas à chaque lancement. */
  get dailyPhrase(): Phrase {
    const list = this.course.phrases?.length ? this.course.phrases : fallbackPhrases;
    const index = Math.floor(Date.now() / DAY) % list.length;
    return list[index];
  }

  lessonData(u: number, l: number): LessonData {
    return this.course.units[u].lessons[l];
  }

  key(u: number, l: number): string {
    return `${u}-${l}`;
  }

  isCompleted(u: number, l: number): boolean {
    return !!this.data.completed[this.key(u, l)];
  }

  isUnlocked(u: number, l: number): boolean {
    if (u === 0 && l === 0) return true;
    const flat = this.lessons.map((x) => ({ u: x.u, l: x.l }));
    const i = flat.findIndex((x) => x.u === u && x.l === l);
    if (i <= 0) return true;
    const prev = flat[i - 1];
    return this.isCompleted(prev.u, prev.l);
  }

  startLesson(u: number, l: number): void {
    this.active = { u, l };
    this.screen = 'lesson';
  }

  completeLesson(u: number, l: number, xp: number, _accuracy: number): void {
    this.data.completed[this.key(u, l)] = true;
    registerLesson(this.data.profile, Date.now(), xp);
    const today = dayKey();
    this.data.history[today] = (this.data.history[today] ?? 0) + xp;
    this.save();
  }

  // ------------------------------ Révision ------------------------------

  /**
   * Applique une note à un mot. Si le pont Rust est disponible
   * (`lakk-core`), c'est le planificateur FSRS de Rust qui replanifie ;
   * sinon on utilise le miroir TypeScript (même algorithme).
   */
  async review(vocab: Vocab, grade: Grade): Promise<void> {
    const k = vocab.en.toLowerCase();
    let card = this.data.cards[k];
    if (!card) {
      card = newCard(vocab);
      this.data.cards[k] = card;
    }

    const native = this.engine === 'rust' ? await nativeReview(card, grade) : null;
    if (native) {
      this.data.cards[k] = native;
    } else {
      reviewCard(card, grade, Date.now());
    }
    this.save();
  }

  dueCards(): Card[] {
    const now = Date.now();
    return Object.values(this.data.cards).filter((c) => isDue(c, now));
  }

  cardCount(): number {
    return Object.keys(this.data.cards).length;
  }

  // ------------------------------ Divers ------------------------------

  goalPercent(): number {
    return dailyGoalPercent(this.data.profile);
  }

  // ------------------------------ Série Vivante ------------------------------

  /** Anneau de régularité : X/7 jours actifs sur une semaine glissante. */
  regularityRing(): RegularityRingData {
    return computeRegularityRing(this.data.profile.activeDays, Date.now());
  }

  /** Un joker automatique est disponible ce mois-ci. */
  jokerAvailable(): boolean {
    return isJokerAvailable(this.data.profile, Date.now());
  }

  /** Une pause planifiée couvre-t-elle aujourd'hui ? */
  paused(): boolean {
    return isPaused(this.data.profile, Date.now());
  }

  pauseUntil(): string | null {
    return this.data.profile.pauseUntil;
  }

  /** Un jour a été manqué : proposer « Reprendre en 2 min ». */
  streakBroken(): boolean {
    return isStreakBroken(this.data.profile, Date.now());
  }

  startPause(days = 7): void {
    engineStartPause(this.data.profile, Date.now(), days);
    this.save();
  }

  cancelPause(): void {
    engineCancelPause(this.data.profile);
    this.save();
  }

  /** Démarre la leçon de reprise (2 minutes suffisent). */
  startRecoveryLesson(): void {
    const next =
      this.lessons.find((r) => !this.isCompleted(r.u, r.l) && this.isUnlocked(r.u, r.l)) ??
      this.lessons[0];
    if (next) this.startLesson(next.u, next.l);
  }

  setGoal(xp: number): void {
    this.data.profile.dailyGoalXp = xp;
    this.save();
  }

  /** Change le nom affiché (nettoyé, non vide). */
  setName(name: string): void {
    const clean = sanitizeName(name);
    if (!clean) return;
    this.data.profile.name = clean;
    this.save();
  }

  /** Change l'avatar parmi les 5 emojis autorisés. */
  setAvatar(avatar: string): void {
    this.data.profile.avatar = isValidAvatar(avatar) ? avatar : DEFAULT_AVATAR;
    this.save();
  }

  /** Change la langue de l'interface. */
  setUILang(lang: 'fr' | 'en'): void {
    this.data.profile.uiLang = lang;
    this.save();
    // Recharge le contenu avec la nouvelle langue
    this.loadContent();
  }

  /** Change la langue d'apprentissage. */
  setLearnLang(lang: 'en' | 'es' | 'wo'): void {
    this.data.profile.learnLang = lang;
    this.save();
    // Recharge le contenu avec la nouvelle langue
    this.loadContent();
  }

  toggleEnergy(): void {
    this.data.profile.unlimitedEnergy = !this.data.profile.unlimitedEnergy;
    this.save();
  }

  reset(): void {
    this.data = defaultState();
    this.save();
  }

  notify(msg: string): void {
    this.toast = msg;
    setTimeout(() => (this.toast = null), 2200);
  }
}

export const app = new AppState();
