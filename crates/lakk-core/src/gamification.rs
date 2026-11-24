//! Gamification : XP, série (streak), cœurs, gemmes, objectif quotidien.
//!
//! Toutes les règles sont pures et testables : on passe explicitement la date
//! courante (`now`) pour pouvoir simuler plusieurs jours dans les tests.

use chrono::{DateTime, Duration, NaiveDate, Utc};

/// Profil local d'un apprenant.
#[derive(Debug, Clone)]
pub struct LearnerProfile {
    pub name: String,
    /// Objectif de XP par jour (10, 20, 30, 50...).
    pub daily_goal_xp: u32,
    pub xp_total: u32,
    /// XP gagnés aujourd'hui.
    pub xp_today: u32,
    /// Jours consécutifs d'activité.
    pub streak_days: u32,
    /// Dernier jour où une leçon a été terminée.
    pub last_active: Option<NaiveDate>,
    pub hearts: u32,
    pub max_hearts: u32,
    /// Horodatage de la dernière régénération de cœur.
    pub hearts_updated_at: Option<DateTime<Utc>>,
    pub gems: u32,
    /// Nombre de gels de série possédés.
    pub freeze_count: u32,
    /// Mode gratuit : cœurs illimités (désactivable).
    pub unlimited_hearts: bool,
}

impl LearnerProfile {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            daily_goal_xp: 20,
            xp_total: 0,
            xp_today: 0,
            streak_days: 0,
            last_active: None,
            hearts: 5,
            max_hearts: 5,
            hearts_updated_at: None,
            gems: 0,
            freeze_count: 0,
            unlimited_hearts: true,
        }
    }

    /// Régénère 1 cœur par heure écoulée (sauf en mode illimité).
    pub fn refresh_hearts(&mut self, now: DateTime<Utc>) {
        if self.unlimited_hearts {
            return;
        }
        let Some(last) = self.hearts_updated_at else {
            self.hearts_updated_at = Some(now);
            return;
        };
        if self.hearts >= self.max_hearts {
            self.hearts_updated_at = Some(now);
            return;
        }
        let hours = (now - last).num_hours();
        if hours > 0 {
            let gain = hours as u32;
            self.hearts = (self.hearts + gain).min(self.max_hearts);
            let consumed = Duration::hours(gain as i64);
            self.hearts_updated_at = Some(last + consumed);
        }
    }

    /// Perd un cœur (mode normal uniquement). Renvoie `true` s'il en reste.
    pub fn lose_heart(&mut self, now: DateTime<Utc>) -> bool {
        if self.unlimited_hearts {
            return true;
        }
        if self.hearts_updated_at.is_none() {
            self.hearts_updated_at = Some(now);
        }
        self.hearts = self.hearts.saturating_sub(1);
        self.hearts > 0
    }

    /// Enregistre la fin d'une leçon : XP, gemmes, série, cœur régénéré.
    pub fn register_lesson(&mut self, now: DateTime<Utc>, xp: u32) {
        let today = now.date_naive();

        // XP et gemmes.
        self.xp_total += xp;
        self.gems += xp / 5;

        // Objectif / XP du jour + série.
        match self.last_active {
            Some(last) if last == today => {
                // Déjà actif aujourd'hui : la série ne bouge pas.
                self.xp_today += xp;
            }
            Some(last) if last == today - Duration::days(1) => {
                // Hier : la série continue.
                self.streak_days += 1;
                self.xp_today = xp;
            }
            Some(_) => {
                // Trou : la série repart (sauf si un gel est disponible).
                if self.freeze_count > 0 {
                    self.freeze_count -= 1;
                    self.streak_days += 1;
                } else {
                    self.streak_days = 1;
                }
                self.xp_today = xp;
            }
            None => {
                self.streak_days = 1;
                self.xp_today = xp;
            }
        }

        self.last_active = Some(today);
        self.refresh_hearts(now);
    }

    /// L'objectif quotidien est-il atteint ?
    pub fn daily_goal_reached(&self) -> bool {
        self.xp_today >= self.daily_goal_xp
    }

    /// Pourcentage de progression vers l'objectif (0..=100).
    pub fn daily_goal_percent(&self) -> u32 {
        if self.daily_goal_xp == 0 {
            return 100;
        }
        ((self.xp_today as f64 / self.daily_goal_xp as f64) * 100.0).min(100.0) as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(n: i64) -> DateTime<Utc> {
        // Une date fixe + n jours, à midi UTC.
        let base = chrono::NaiveDate::from_ymd_opt(2026, 11, 1)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap();
        DateTime::from_naive_utc_and_offset(base, Utc) + Duration::days(n)
    }

    #[test]
    fn first_lesson_starts_streak() {
        let mut p = LearnerProfile::new("Idrissa");
        p.register_lesson(day(0), 25);
        assert_eq!(p.streak_days, 1);
        assert_eq!(p.xp_today, 25);
        assert_eq!(p.xp_total, 25);
    }

    #[test]
    fn consecutive_days_increase_streak() {
        let mut p = LearnerProfile::new("Idrissa");
        p.register_lesson(day(0), 20);
        p.register_lesson(day(1), 20);
        p.register_lesson(day(2), 20);
        assert_eq!(p.streak_days, 3);
    }

    #[test]
    fn gap_resets_streak() {
        let mut p = LearnerProfile::new("Idrissa");
        p.register_lesson(day(0), 20);
        p.register_lesson(day(3), 20);
        assert_eq!(p.streak_days, 1);
    }

    #[test]
    fn same_day_does_not_increase_streak() {
        let mut p = LearnerProfile::new("Idrissa");
        p.register_lesson(day(0), 10);
        p.register_lesson(day(0), 10);
        assert_eq!(p.streak_days, 1);
        assert_eq!(p.xp_today, 20);
    }

    #[test]
    fn freeze_preserves_streak_after_gap() {
        let mut p = LearnerProfile::new("Idrissa");
        p.freeze_count = 1;
        p.register_lesson(day(0), 20);
        p.register_lesson(day(2), 20);
        assert_eq!(p.streak_days, 2);
        assert_eq!(p.freeze_count, 0);
    }

    #[test]
    fn unlimited_hearts_never_decrease() {
        let mut p = LearnerProfile::new("Idrissa");
        assert!(p.unlimited_hearts);
        for _ in 0..10 {
            assert!(p.lose_heart(day(0)));
        }
        assert_eq!(p.hearts, 5);
    }

    #[test]
    fn normal_hearts_decrease_and_regenerate() {
        let mut p = LearnerProfile::new("Idrissa");
        p.unlimited_hearts = false;
        p.hearts_updated_at = Some(day(0));
        p.lose_heart(day(0));
        p.lose_heart(day(0));
        assert_eq!(p.hearts, 3);
        p.refresh_hearts(day(0) + Duration::hours(2));
        assert_eq!(p.hearts, 5);
    }

    #[test]
    fn daily_goal_percent_is_capped() {
        let mut p = LearnerProfile::new("Idrissa");
        p.daily_goal_xp = 20;
        p.xp_today = 50;
        assert_eq!(p.daily_goal_percent(), 100);
        p.xp_today = 10;
        assert_eq!(p.daily_goal_percent(), 50);
    }
}
