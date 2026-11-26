import { describe, it, expect } from 'vitest';
import { MISSIONS, dailyMission, missionById } from './missions';

describe('MISSIONS — deck local', () => {
  it('contient entre 30 et 50 missions', () => {
    expect(MISSIONS.length).toBeGreaterThanOrEqual(30);
    expect(MISSIONS.length).toBeLessThanOrEqual(50);
  });

  it('a des identifiants uniques', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque mission est complète et courte', () => {
    for (const mission of MISSIONS) {
      expect(mission.id.trim()).not.toBe('');
      expect(mission.title.trim()).not.toBe('');
      expect(mission.hint.trim()).not.toBe('');
      expect(mission.icon.trim()).not.toBe('');
      expect(mission.duration).toMatch(/^(30 s|1 min|2 min)$/);
    }
  });

  it('missionById retrouve une mission, ou undefined', () => {
    expect(missionById(MISSIONS[0].id)?.id).toBe(MISSIONS[0].id);
    expect(missionById('inconnue')).toBeUndefined();
  });
});

describe('dailyMission — tirage déterministe', () => {
  it('donne la même mission pour une même date', () => {
    const a = dailyMission('2026-11-26');
    const b = dailyMission('2026-11-26');
    expect(a.id).toBe(b.id);
  });

  it('change de mission selon la date', () => {
    const ids = new Set(
      ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30'].map(
        (d) => dailyMission(d).id,
      ),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('couvre tout le deck sur une année', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 365; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      ids.add(dailyMission(date).id);
    }
    expect(ids.size).toBe(MISSIONS.length);
  });

  it('accepte un deck personnalisé', () => {
    const deck = [
      { id: 'a', title: 'A', hint: '', category: 'speaking' as const, duration: '30 s', icon: '🅰️' },
      { id: 'b', title: 'B', hint: '', category: 'listening' as const, duration: '1 min', icon: '🅱️' },
    ];
    expect(dailyMission('2026-11-26', deck).id).toBe(dailyMission('2026-11-26', deck).id);
    expect(deck.map((m) => m.id)).toContain(dailyMission('2026-11-26', deck).id);
  });

  it('refuse un deck vide', () => {
    expect(() => dailyMission('2026-11-26', [])).toThrow();
  });
});
