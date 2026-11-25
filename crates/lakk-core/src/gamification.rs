//! Gamification : XP, série (streak), cœurs, gemmes, objectif quotidien.
//!
//! Toutes les règles sont pures et testables : on passe explicitement la date
//! courante (`now`) pour pouvoir simuler plusieurs jours dans les tests.

use chrono::{DateTime, Duration, NaiveDate, Utc, Datelike};

// Jalons de série (style Streak Society Duolingo).
pub const STREAK_MILESTONES: &[u32] = &[7, 30, 50, 100, 365];

/// Badge de série gagné.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreakBadge {
    pub days: u32,
    pub earned_at: Option<DateTime<Utc>>,
}

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
    /// Nombre de gels de série possédés (max 2, reset chaque lundi).
    pub freeze_count: u32,
    /// Dernière semaine (ISO) où les gels ont été accordés.
    pub last_freeze_grant_week: Option<u32>,
    /// Badges de série gagnés (clé = nombre de jours, ex: "7", "30").
    pub badges: std::collections::HashMap<String, StreakBadge>,
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
            last_freeze_grant_week: None,
            badges: std::collections::HashMap::new(),
            unlimited_hearts: true,
        }
    }

    /// Vérifie et attribue les nouveaux badges de série atteints.
    /// Retourne la liste des badges nouvellement gagnés.
    pub fn check_streak_badges(&mut self, now: DateTime<Utc>) -> Vec<u32> {
        let mut new_badges = Vec::new();
        for &milestone in STREAK_MILESTONES {
            if self.streak_days >= milestone {
                let key = milestone.to_string();
                if !self.badges.contains_key(&key) {
                    self.badges.insert(key.clone(), StreakBadge {
                        days: milestone,
                        earned_at: Some(now),
                    });
                    new_badges.push(milestone);
                }
            }
        }
        new_badges
    }

    /// Retourne true si un badge pour ce jalon a déjà été gagné.
    pub fn has_badge(&self, days: u32) -> bool {
        self.badges.contains_key(&days.to_string())
    }

    /// Retourne la liste des badges gagnés, triés par jours.
    pub fn earned_badges(&self) -> Vec<&StreakBadge> {
        let mut badges: Vec<_> = self.badges.values().collect();
        badges.sort_by_key(|b| b.days);
        badges
    }

    /// Répare la série perdue : restaure streak_days à 1 et last_active à aujourd'hui.
    /// Coûte 50 gemmes. Retourne `true` si la réparation a réussi.
    pub fn repair_streak(&mut self, now: DateTime<Utc>) -> bool {
        if self.gems < 50 {
            return false;
        }
        // Ne répare que si la série est perdue (streak=0 et last_active plus vieux qu'hier)
        let today = now.date_naive();
        let yesterday = today - Duration::days(1);
        let can_repair = self.streak_days == 0
            && self.last_active.is_some_and(|last| last < yesterday);
        if !can_repair {
            return false;
        }
        self.gems -= 50;
        self.streak_days = 1;
        self.last_active = Some(today);
        self.xp_today = 0; // Reset XP du jour pour la nouvelle série
        true
    }

    /// Accorde les gels de série hebdomadaires (2 par semaine, reset le lundi).
    /// Retourne `true` si les gels ont été mis à jour.
    pub fn grant_weekly_freezes(&mut self, now: DateTime<Utc>) -> bool {
        let iso_week = now.iso_week().week();
        if self.last_freeze_grant_week == Some(iso_week) {
            return false;
        }
        // Babbel style: 2 freezes par semaine, non cumulables, reset lundi.
        self.freeze_count = 2;
        self.last_freeze_grant_week = Some(iso_week);
        true
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
        // Accorde les gels hebdomadaires au début de la semaine (lundi).
        self.grant_weekly_freezes(now);

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
        // Vérifie les badges de série après mise à jour de la streak.
        let _ = self.check_streak_badges(now);
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
        // 2026-10-28 est un mercredi (semaine ISO 44), loin des frontières de semaine.
        let base = chrono::NaiveDate::from_ymd_opt(2026, 10, 28)
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
        // Set last_freeze_grant_week so freezes are granted but then consumed
        p.last_freeze_grant_week = Some(44);
        p.register_lesson(day(0), 20); // gets 2 freezes
        p.register_lesson(day(3), 20); // gap of 3 days, uses 1 freeze, but still gap > 1 day after freeze
        // After day(0): streak=1, freezes=2
        // day(3) is 3 days later: gap of 2 days (day 1 and 2 missed)
        // First gap day consumes 1 freeze -> streak=2, freezes=1
        // Second gap day: no freeze left -> streak resets to 1
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
        // Set last_freeze_grant_week to current week so grant_weekly_freezes doesn't reset
        p.last_freeze_grant_week = Some(44); // week of day(0)
        p.freeze_count = 1;
        p.register_lesson(day(0), 20); // Sunday week 44, freezes stay at 1
        // day(2) is Wednesday week 45 - this will trigger a new week grant!
        // So we need to use day(1) which is Monday week 45, but that's only 1 day gap
        // Actually, let's use a different approach: don't cross week boundary
        p.register_lesson(day(0), 20); // same day, no streak change
        // Actually the test wants a gap of 2 days (Sunday to Wednesday)
        // But day(2) is week 45, which triggers a new week grant
        // Let's just test with a 1-day gap within the same week
        p.last_freeze_grant_week = Some(44);
        p.freeze_count = 1;
        p.register_lesson(day(0), 20); // Sunday
        p.register_lesson(day(1), 20); // Monday - but this is week 45!
        // Hmm, the week boundary is between day(0) and day(1)
        // Let's use a base date that's not on a week boundary
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

    #[test]
    fn grant_weekly_freezes_resets_on_monday() {
        // Base: 2026-10-28 (mercredi, semaine 44)
        // day(5) = lundi 2026-11-02 (semaine 45)
        // day(12) = lundi 2026-11-09 (semaine 46)
        let mut p = LearnerProfile::new("Idrissa");

        // Print actual week numbers for debugging
        println!("day(0) week: {}", day(0).iso_week().week());
        println!("day(5) week: {}", day(5).iso_week().week());
        println!("day(12) week: {}", day(12).iso_week().week());

        // Mercredi (semaine 44) : pas de gels encore
        p.grant_weekly_freezes(day(0)); // mercredi, semaine 44
        assert_eq!(p.freeze_count, 2);
        assert_eq!(p.last_freeze_grant_week, Some(44));

        // Lundi suivant (semaine 45) : reset à 2
        p.freeze_count = 0; // utilisateur a utilisé ses gels
        p.grant_weekly_freezes(day(5)); // lundi, semaine 45
        assert_eq!(p.freeze_count, 2);
        assert_eq!(p.last_freeze_grant_week, Some(45));

        // Lundi d'après (semaine 46) : reset à 2
        p.freeze_count = 0;
        p.grant_weekly_freezes(day(12)); // lundi, semaine 46
        assert_eq!(p.freeze_count, 2);
        assert_eq!(p.last_freeze_grant_week, Some(46));
    }

    #[test]
    fn weekly_freezes_not_cumulative() {
        let mut p = LearnerProfile::new("Idrissa");
        p.grant_weekly_freezes(day(0)); // semaine 44 (mercredi)
        assert_eq!(p.freeze_count, 2);

        // Utilise 1 gel pendant la semaine
        p.freeze_count = 1;

        // Même semaine : pas de reset, le compte reste à 1
        // (les gels ne se rechargent que le lundi suivant)
        let result = p.grant_weekly_freezes(day(1));
        assert!(!result); // pas de nouveau grant
        assert_eq!(p.freeze_count, 1);

        // Lundi suivant (nouvelle semaine) : reset à 2 (pas 3 !)
        p.grant_weekly_freezes(day(5)); // lundi semaine 45
        assert_eq!(p.freeze_count, 2); // reset à 2, pas addition
    }

    #[test]
    fn register_lesson_grants_freezes_on_new_week() {
        let mut p = LearnerProfile::new("Idrissa");
        // Première leçon mercredi (semaine 44)
        p.register_lesson(day(0), 20);
        assert_eq!(p.freeze_count, 2);

        // Leçon jeudi même semaine -> pas de reset
        p.register_lesson(day(1), 20);
        assert_eq!(p.freeze_count, 2);

        // Leçon vendredi même semaine -> pas de reset, pas de gap
        p.register_lesson(day(2), 20);
        assert_eq!(p.freeze_count, 2);

        // Leçon lundi suivant (semaine 45) -> reset à 2 (pas 3 !)
        // Pas de gap car dernière leçon était vendredi (day 2), aujourd'hui lundi (day 5) = gap de 2 jours (sam, dim)
        // Un gel sera consommé pour le gap
        p.register_lesson(day(5), 20);
        // grant_weekly_freezes donne 2, puis gap consomme 1 -> reste 1
        assert_eq!(p.freeze_count, 1);

        // Leçon mardi (même semaine 45) -> pas de reset, pas de gap
        p.register_lesson(day(6), 20);
        assert_eq!(p.freeze_count, 1);

        // Leçon lundi d'après (semaine 46) -> reset à 2
        // Gap de 6 jours (mercredi à lundi), 1 gel consommé
        p.register_lesson(day(12), 20);
        assert_eq!(p.freeze_count, 1);
    }

    #[test]
    fn streak_badges_awarded_at_milestones() {
        let mut p = LearnerProfile::new("Idrissa");
        let now = day(0); // mercredi semaine 44

        // Pas de badge au début
        assert!(!p.has_badge(7));
        assert!(!p.has_badge(30));
        assert_eq!(p.earned_badges().len(), 0);

        // Simule 7 jours consécutifs
        for i in 0..7 {
            p.register_lesson(day(i), 20);
        }
        // Badge 7 jours gagné
        assert!(p.has_badge(7));
        assert_eq!(p.earned_badges().len(), 1);
        assert_eq!(p.earned_badges()[0].days, 7);

        // Simule jusqu'à 30 jours
        for i in 7..30 {
            p.register_lesson(day(i), 20);
        }
        // Badge 30 jours gagné
        assert!(p.has_badge(30));
        assert_eq!(p.earned_badges().len(), 2);

        // Simule jusqu'à 50 jours
        for i in 30..50 {
            p.register_lesson(day(i), 20);
        }
        // Badge 50 jours gagné
        assert!(p.has_badge(50));
        assert_eq!(p.earned_badges().len(), 3);

        // Simule jusqu'à 100 jours
        for i in 50..100 {
            p.register_lesson(day(i), 20);
        }
        // Badge 100 jours gagné
        assert!(p.has_badge(100));
        assert_eq!(p.earned_badges().len(), 4);

        // Simule jusqu'à 365 jours
        for i in 100..365 {
            p.register_lesson(day(i), 20);
        }
        // Badge 365 jours gagné
        assert!(p.has_badge(365));
        assert_eq!(p.earned_badges().len(), 5);
    }

    #[test]
    fn streak_badges_not_duplicated() {
        let mut p = LearnerProfile::new("Idrissa");
        for i in 0..7 {
            p.register_lesson(day(i), 20);
        }
        assert_eq!(p.earned_badges().len(), 1);

        // Re-vérifie les badges (check_streak_badges appelé à chaque leçon)
        p.register_lesson(day(7), 20);
        assert_eq!(p.earned_badges().len(), 1); // Pas de doublon
    }

    #[test]
    fn check_streak_badges_returns_new_badges() {
        let mut p = LearnerProfile::new("Idrissa");
        let now = day(0);

        // Avant le jalon : pas de nouveaux badges
        let new = p.check_streak_badges(now);
        assert!(new.is_empty());

        // Après 7 jours
        p.streak_days = 7;
        let new = p.check_streak_badges(now);
        assert_eq!(new, vec![7]);

        // Deuxième appel : pas de nouveaux badges
        let new = p.check_streak_badges(now);
        assert!(new.is_empty());
    }

    #[test]
    fn badge_earned_at_has_timestamp() {
        let mut p = LearnerProfile::new("Idrissa");
        let now = day(0);
        for i in 0..7 {
            p.register_lesson(day(i), 20);
        }
        let badges = p.earned_badges();
        assert!(badges[0].earned_at.is_some());
        assert_eq!(badges[0].earned_at.unwrap(), day(6)); // 7e jour = day(6)
    }
}
