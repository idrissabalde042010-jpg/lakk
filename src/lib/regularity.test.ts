import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_PAUSE_DAYS,
  cancelPause,
  consumeMonthlyJoker,
  dayKey,
  daysBetweenKeys,
  isJokerAvailable,
  isPaused,
  isStreakBroken,
  monthKey,
  newProfile,
  registerLesson,
  regularityRing,
  shiftDayKey,
  startPause,
} from './engine';

// 2026-10-28 est un mercredi (semaine ISO 44), loin des frontières de semaine.
function day(offset: number): number {
  return new Date('2026-10-28T12:00:00Z').getTime() + offset * 86_400_000;
}

function key(offset: number): string {
  return dayKey(day(offset));
}

describe('Série Vivante — anneau de régularité', () => {
  it('retourne 7 jours, du plus ancien à aujourd’hui', () => {
    const ring = regularityRing([], day(0));
    expect(ring.days).toHaveLength(7);
    expect(ring.days[0].key).toBe(key(-6));
    expect(ring.days[6].key).toBe(key(0));
    expect(ring.activeCount).toBe(0);
    expect(ring.percent).toBe(0);
    expect(ring.crown).toBe(false);
  });

  it('compte uniquement les jours actifs de la fenêtre glissante', () => {
    const ring = regularityRing([key(-6), key(-2), key(0), key(-7), key(3)], day(0));
    expect(ring.activeCount).toBe(3);
    expect(ring.days.filter((d) => d.active).map((d) => d.key)).toEqual([
      key(-6),
      key(-2),
      key(0),
    ]);
  });

  it('accorde la couronne à 7/7', () => {
    const active = Array.from({ length: 7 }, (_, i) => key(-i));
    const ring = regularityRing(active, day(0));
    expect(ring.activeCount).toBe(7);
    expect(ring.percent).toBe(100);
    expect(ring.crown).toBe(true);
  });

  it('ignore les doublons et les dates futures', () => {
    const ring = regularityRing([key(0), key(0), key(1)], day(0));
    expect(ring.activeCount).toBe(1);
  });

  it('shiftDayKey et daysBetweenKeys gèrent les mois', () => {
    expect(shiftDayKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetweenKeys('2026-10-28', '2026-11-02')).toBe(5);
    expect(daysBetweenKeys('2026-11-02', '2026-10-28')).toBe(-5);
  });
});

describe('Série Vivante — joker mensuel', () => {
  let p: ReturnType<typeof newProfile>;

  beforeEach(() => {
    p = newProfile('Test');
  });

  it('est disponible au départ, puis une seule fois par mois', () => {
    expect(isJokerAvailable(p, day(0))).toBe(true);
    expect(consumeMonthlyJoker(p, day(0))).toBe(true);
    expect(p.jokerUsedMonth).toBe(monthKey(day(0)));
    expect(isJokerAvailable(p, day(0))).toBe(false);
    expect(consumeMonthlyJoker(p, day(1))).toBe(false);
  });

  it('se recharge le mois suivant', () => {
    consumeMonthlyJoker(p, day(0)); // octobre
    expect(isJokerAvailable(p, day(0))).toBe(false);
    expect(isJokerAvailable(p, day(5))).toBe(true); // novembre
    expect(consumeMonthlyJoker(p, day(5))).toBe(true);
  });

  it('pardonne automatiquement un jour manqué (gap de 2 jours)', () => {
    registerLesson(p, day(0), 20); // installe la semaine + 2 gels
    p.freezeCount = 0;
    p.streakDays = 10;

    registerLesson(p, day(2), 20); // un jour manqué, pas de gel

    expect(p.streakDays).toBe(11);
    expect(isJokerAvailable(p, day(2))).toBe(false);
    expect(p.recoveredFromLapse).toBe(false);
  });

  it('ne consomme pas le joker pour une interruption plus longue', () => {
    registerLesson(p, day(0), 20);
    p.freezeCount = 0;
    p.streakDays = 10;

    registerLesson(p, day(4), 20); // trois jours manqués

    expect(p.streakDays).toBe(1);
    expect(isJokerAvailable(p, day(4))).toBe(true);
  });
});

describe('Série Vivante — never miss twice', () => {
  let p: ReturnType<typeof newProfile>;

  beforeEach(() => {
    p = newProfile('Test');
  });

  it('restaure la série visuelle à 50 % quand le joker est déjà utilisé', () => {
    registerLesson(p, day(0), 20);
    p.freezeCount = 0;
    p.streakDays = 10;
    p.jokerUsedMonth = monthKey(day(2));

    registerLesson(p, day(2), 20);

    expect(p.streakDays).toBe(5);
    expect(p.streakBeforeLapse).toBe(10);
    expect(p.recoveredFromLapse).toBe(true);
  });

  it('ne descend jamais sous 1 jour', () => {
    registerLesson(p, day(0), 20);
    p.freezeCount = 0;
    p.streakDays = 1;
    p.jokerUsedMonth = monthKey(day(2));

    registerLesson(p, day(2), 20);

    expect(p.streakDays).toBe(1);
    expect(p.recoveredFromLapse).toBe(false);
  });
});

describe('Série Vivante — pause planifiée', () => {
  let p: ReturnType<typeof newProfile>;

  beforeEach(() => {
    p = newProfile('Test');
  });

  it('dure 7 jours maximum, aujourd’hui inclus', () => {
    startPause(p, day(0), 30);
    expect(p.pauseUntil).toBe(key(MAX_PAUSE_DAYS - 1));
    expect(isPaused(p, day(0))).toBe(true);
    expect(isPaused(p, day(6))).toBe(true);
    expect(isPaused(p, day(7))).toBe(false);
  });

  it('protège la série sans consommer le joker', () => {
    registerLesson(p, day(0), 20);
    p.freezeCount = 0;
    p.streakDays = 10;
    startPause(p, day(0), 7);

    registerLesson(p, day(3), 20);

    expect(p.streakDays).toBe(11);
    expect(isJokerAvailable(p, day(3))).toBe(true);
    expect(p.recoveredFromLapse).toBe(false);
  });

  it('peut être annulée', () => {
    startPause(p, day(0), 7);
    cancelPause(p);
    expect(p.pauseUntil).toBeNull();
    expect(isPaused(p, day(0))).toBe(false);
  });

  it('détecte une série interrompue hors pause', () => {
    p.lastActive = key(-2);
    expect(isStreakBroken(p, day(0))).toBe(true);
    startPause(p, day(0), 7);
    expect(isStreakBroken(p, day(0))).toBe(false);
  });
});

describe('Série Vivante — journal des jours actifs', () => {
  it('enregistre un jour actif une seule fois', () => {
    const p = newProfile('Test');
    registerLesson(p, day(0), 20);
    registerLesson(p, day(0), 20);
    expect(p.activeDays).toEqual([key(0)]);
  });

  it('alimente l’anneau après plusieurs jours', () => {
    const p = newProfile('Test');
    registerLesson(p, day(0), 20);
    registerLesson(p, day(1), 20);
    registerLesson(p, day(2), 20);
    const ring = regularityRing(p.activeDays, day(2));
    expect(ring.activeCount).toBe(3);
  });
});
