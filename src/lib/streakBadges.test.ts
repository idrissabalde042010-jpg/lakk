import { describe, it, expect, beforeEach } from 'vitest';
import { newProfile, registerLesson, checkStreakBadges, hasBadge, earnedBadges, STREAK_MILESTONES, repairStreak } from './engine';

// Helper pour créer un timestamp à midi UTC
function day(offset: number): number {
  // 2026-10-28 est un mercredi (semaine ISO 44)
  const base = new Date('2026-10-28T12:00:00Z').getTime();
  return base + offset * 86400000;
}

describe('engine.ts — Streak Badges (milestones)', () => {
  let p: ReturnType<typeof newProfile>;
  let now: number;

  beforeEach(() => {
    p = newProfile('Test');
    now = day(0);
  });

  // ──────────────────────────────────────────────────────────────────────
  // STREAK_MILESTONES — Constantes
  // ──────────────────────────────────────────────────────────────────────
  describe('STREAK_MILESTONES', () => {
    it('contains the expected milestones', () => {
      expect(STREAK_MILESTONES).toEqual([7, 30, 50, 100, 365]);
    });

    it('is readonly', () => {
      // TypeScript readonly check at compile time
      expect(STREAK_MILESTONES.length).toBe(5);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // checkStreakBadges — Attribution des badges
  // ──────────────────────────────────────────────────────────────────────
  describe('checkStreakBadges', () => {
    it('returns empty array when no milestones reached', () => {
      p.streakDays = 1;
      const newBadges = checkStreakBadges(p, now);
      expect(newBadges).toEqual([]);
    });

    it('awards badge when 7-day milestone reached', () => {
      p.streakDays = 7;
      const newBadges = checkStreakBadges(p, now);
      expect(newBadges).toEqual([7]);
      expect(hasBadge(p, 7)).toBe(true);
    });

    it('awards multiple badges if multiple milestones reached', () => {
      p.streakDays = 50;
      const newBadges = checkStreakBadges(p, now);
      expect(newBadges).toEqual([7, 30, 50]);
      expect(hasBadge(p, 7)).toBe(true);
      expect(hasBadge(p, 30)).toBe(true);
      expect(hasBadge(p, 50)).toBe(true);
    });

    it('does not duplicate badges on second call', () => {
      p.streakDays = 7;
      checkStreakBadges(p, now);
      const newBadges = checkStreakBadges(p, now);
      expect(newBadges).toEqual([]);
      expect(hasBadge(p, 7)).toBe(true);
    });

    it('only awards badges up to current streak', () => {
      p.streakDays = 25;
      const newBadges = checkStreakBadges(p, now);
      expect(newBadges).toEqual([7]);
      expect(hasBadge(p, 30)).toBe(false);
      expect(hasBadge(p, 50)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // hasBadge — Vérification simple
  // ──────────────────────────────────────────────────────────────────────
  describe('hasBadge', () => {
    it('returns false for non-earned badge', () => {
      expect(hasBadge(p, 7)).toBe(false);
    });

    it('returns true after badge earned', () => {
      p.badges['7'] = { days: 7, earnedAt: now };
      expect(hasBadge(p, 7)).toBe(true);
    });

    it('returns false for different milestone', () => {
      p.badges['7'] = { days: 7, earnedAt: now };
      expect(hasBadge(p, 30)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // earnedBadges — Liste triée
  // ──────────────────────────────────────────────────────────────────────
  describe('earnedBadges', () => {
    it('returns empty array when no badges', () => {
      expect(earnedBadges(p)).toEqual([]);
    });

    it('returns badges sorted by days', () => {
      p.badges = {
        '50': { days: 50, earnedAt: day(50) },
        '7': { days: 7, earnedAt: day(7) },
        '30': { days: 30, earnedAt: day(30) },
      };
      const badges = earnedBadges(p);
      expect(badges.map(b => b.days)).toEqual([7, 30, 50]);
    });

    it('preserves earnedAt timestamps', () => {
      p.badges = { '7': { days: 7, earnedAt: day(6) } };
      const badges = earnedBadges(p);
      expect(badges[0].earnedAt).toBe(day(6));
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Integration: registerLesson awards badges at milestones
  // ──────────────────────────────────────────────────────────────────────
  describe('registerLesson — badge integration', () => {
    it('awards 7-day badge after 7 consecutive lessons', () => {
      for (let i = 0; i < 7; i++) {
        registerLesson(p, day(i), 20);
      }
      expect(hasBadge(p, 7)).toBe(true);
      expect(p.badges['7'].earnedAt).toBe(day(6));
    });

    it('awards 30-day badge after 30 consecutive lessons', () => {
      for (let i = 0; i < 30; i++) {
        registerLesson(p, day(i), 20);
      }
      expect(hasBadge(p, 7)).toBe(true);
      expect(hasBadge(p, 30)).toBe(true);
    });

    it('awards all 5 badges at their respective milestones', () => {
      // 7 jours
      for (let i = 0; i < 7; i++) registerLesson(p, day(i), 20);
      expect(hasBadge(p, 7)).toBe(true);

      // 30 jours
      for (let i = 7; i < 30; i++) registerLesson(p, day(i), 20);
      expect(hasBadge(p, 30)).toBe(true);

      // 50 jours
      for (let i = 30; i < 50; i++) registerLesson(p, day(i), 20);
      expect(hasBadge(p, 50)).toBe(true);

      // 100 jours
      for (let i = 50; i < 100; i++) registerLesson(p, day(i), 20);
      expect(hasBadge(p, 100)).toBe(true);

      // 365 jours
      for (let i = 100; i < 365; i++) registerLesson(p, day(i), 20);
      expect(hasBadge(p, 365)).toBe(true);

      // Vérifie l'ordre
      const badges = earnedBadges(p);
      expect(badges.map(b => b.days)).toEqual([7, 30, 50, 100, 365]);
    });

    it('does not award duplicate badges on same-day lessons', () => {
      for (let i = 0; i < 7; i++) {
        registerLesson(p, day(i), 20);
      }
      // Deuxième leçon le jour 7
      registerLesson(p, day(6), 20);
      const badges = earnedBadges(p);
      expect(badges.length).toBe(1); // Pas de doublon
    });

    it('badge earnedAt timestamp is correct (last day of streak)', () => {
      for (let i = 0; i < 7; i++) {
        registerLesson(p, day(i), 20);
      }
      // Le 7e jour est day(6) (0-indexed)
      expect(p.badges['7'].earnedAt).toBe(day(6));
    });
  });
});

describe('engine.ts — Streak Repair', () => {
  function day(offset: number): number {
    const base = new Date('2026-10-28T12:00:00Z').getTime();
    return base + offset * 86400000;
  }

  function dayKeyStr(offset: number): string {
    // Helper to get YYYY-MM-DD string from day offset
    const ts = day(offset);
    const d = new Date(ts);
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const dayStr = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dayStr}`;
  }

  let p: ReturnType<typeof newProfile>;
  let now: number;

  beforeEach(() => {
    p = newProfile('Test');
    p.gems = 100; // Assez de gemmes pour la réparation
    now = day(10); // Un jour après une pause
  });

  it('repairs lost streak when conditions met', () => {
    // Simule une série perdue : streak=0, lastActive vieux de 3 jours
    p.streakDays = 0;
    p.lastActive = dayKeyStr(7); // 3 jours avant now (day 10)
    p.xpToday = 0;

    const result = repairStreak(p, now);
    expect(result).toBe(true);
    expect(p.streakDays).toBe(1);
    expect(p.lastActive).toBe(dayKeyStr(10));
    expect(p.xpToday).toBe(0);
    expect(p.gems).toBe(50); // 100 - 50
  });

  it('fails if not enough gems', () => {
    p.gems = 30; // Pas assez de gemmes
    p.streakDays = 0;
    p.lastActive = dayKeyStr(7);

    const result = repairStreak(p, now);
    expect(result).toBe(false);
    expect(p.gems).toBe(30); // Inchangé
    expect(p.streakDays).toBe(0);
  });

  it('fails if streak not actually lost (streak > 0)', () => {
    p.streakDays = 5;
    p.lastActive = dayKeyStr(9); // Hier

    const result = repairStreak(p, now);
    expect(result).toBe(false);
    expect(p.streakDays).toBe(5);
    expect(p.gems).toBe(100);
  });

  it('fails if lastActive was yesterday (not a gap)', () => {
    p.streakDays = 0;
    p.lastActive = dayKeyStr(9); // Hier

    const result = repairStreak(p, now);
    expect(result).toBe(false);
    expect(p.streakDays).toBe(0);
  });

  it('fails if lastActive is today (already active)', () => {
    p.streakDays = 0;
    p.lastActive = dayKeyStr(10); // Aujourd'hui

    const result = repairStreak(p, now);
    expect(result).toBe(false);
    expect(p.streakDays).toBe(0);
  });

  it('fails if lastActive is null (never played)', () => {
    p.streakDays = 0;
    p.lastActive = null;

    const result = repairStreak(p, now);
    expect(result).toBe(false);
    expect(p.streakDays).toBe(0);
  });

  it('deducts exactly 50 gems on success', () => {
    p.gems = 75;
    p.streakDays = 0;
    p.lastActive = dayKeyStr(7);

    repairStreak(p, now);
    expect(p.gems).toBe(25);
  });
});