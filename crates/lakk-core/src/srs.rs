//! Planificateur de répétition espacée inspiré de **FSRS**.
//!
//! FSRS (Free Spaced Repetition Scheduler) modélise la mémoire avec trois
//! grandeurs : la *stabilité* (combien de temps un souvenir tient), la
//! *difficulté* (à quel point la carte est dure) et la *récupérabilité*
//! (probabilité de se rappeler maintenant).
//!
//! Cette implémentation est volontairement compacte et sans dépendance :
//! elle est suffisante pour un MVP et peut être remplacée plus tard par le
//! crate officiel `fsrs` sans changer le reste de l'application. Les notes
//! vont de 1 (oublie) à 4 (facile), comme dans Anki.

use chrono::{DateTime, Duration, Utc};

use crate::models::{Card, CardState, Vocab};

/// Note donnée à une révision.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Grade {
    /// Oublié / faux.
    Again = 1,
    /// Difficile, mais retrouvé.
    Hard = 2,
    /// Correct.
    Good = 3,
    /// Facile.
    Easy = 4,
}

impl Grade {
    /// Convertit une note numérique (1..=4) en `Grade`.
    pub fn from_value(v: u8) -> Option<Grade> {
        match v {
            1 => Some(Grade::Again),
            2 => Some(Grade::Hard),
            3 => Some(Grade::Good),
            4 => Some(Grade::Easy),
            _ => None,
        }
    }

    fn as_f64(self) -> f64 {
        self as u8 as f64
    }
}

/// Le planificateur. `desired_retention` est la probabilité de rappel visée
/// (0,9 = on révise quand il reste ~90 % de chances de se souvenir).
#[derive(Debug, Clone)]
pub struct Scheduler {
    pub desired_retention: f64,
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new(0.9)
    }
}

impl Scheduler {
    pub fn new(desired_retention: f64) -> Self {
        Self {
            desired_retention: desired_retention.clamp(0.7, 0.97),
        }
    }

    /// Crée une carte neuve, due immédiatement.
    pub fn new_card(vocab: Vocab, now: DateTime<Utc>) -> Card {
        Card {
            vocab,
            stability: 0.0,
            difficulty: 5.0,
            reps: 0,
            lapses: 0,
            state: CardState::New,
            due_at: now,
            last_review: None,
        }
    }

    /// Probabilité de se rappeler la carte maintenant (courbe de l'oubli).
    pub fn retrievability(&self, card: &Card, now: DateTime<Utc>) -> f64 {
        let Some(last) = card.last_review else {
            return 0.0;
        };
        if card.stability <= 0.0 {
            return 0.0;
        }
        let elapsed_days = (now - last).num_seconds().max(0) as f64 / 86_400.0;
        (-elapsed_days / card.stability).exp()
    }

    /// La carte est-elle à réviser ?
    pub fn is_due(&self, card: &Card, now: DateTime<Utc>) -> bool {
        card.due_at <= now
    }

    /// Applique une révision et renvoie l'intervalle planifié en jours.
    pub fn review(&self, card: &mut Card, grade: Grade, now: DateTime<Utc>) -> f64 {
        let elapsed_days = card
            .last_review
            .map(|t| (now - t).num_seconds().max(0) as f64 / 86_400.0)
            .unwrap_or(0.0);
        let retrievability = if card.stability > 0.0 {
            (-elapsed_days / card.stability).exp()
        } else {
            0.0
        };

        let was_new = card.stability <= 0.0;
        let mut stability = card.stability;
        let mut difficulty = card.difficulty;

        if was_new {
            stability = match grade {
                Grade::Again => 0.3,
                Grade::Hard => 0.8,
                Grade::Good => 1.5,
                Grade::Easy => 3.0,
            };
            difficulty = match grade {
                Grade::Again => 6.0,
                Grade::Hard => 5.5,
                Grade::Good => 5.0,
                Grade::Easy => 4.0,
            };
        } else {
            let g = grade.as_f64();
            // Ajustement de la difficulté.
            difficulty += match grade {
                Grade::Again => 1.0,
                Grade::Hard => 0.3,
                Grade::Good => -0.05,
                Grade::Easy => -0.3,
            };
            difficulty = difficulty.clamp(1.0, 10.0);

            // Ajustement de la stabilité.
            let factor = match grade {
                Grade::Again => 0.25,
                Grade::Hard => 1.15,
                Grade::Good => (1.6 - 0.05 * difficulty).max(1.1),
                Grade::Easy => (2.2 - 0.05 * difficulty).max(1.3),
            };
            stability = (stability * factor).max(0.2);
            // La récupérabilité module légèrement l'allongement.
            stability *= 1.0 + 0.05 * (1.0 - retrievability) * (g - 2.0).max(0.0);
        }

        card.stability = stability;
        card.difficulty = difficulty;
        card.reps += 1;
        card.last_review = Some(now);

        if grade == Grade::Again {
            card.lapses += 1;
            card.state = if was_new {
                CardState::Learning
            } else {
                CardState::Relearning
            };
        } else {
            card.state = CardState::Review;
        }

        // Intervalle : au moins 1 jour, arrondi au jour supérieur.
        let interval_days = stability.max(1.0).ceil();
        card.due_at = now + Duration::seconds((interval_days * 86_400.0) as i64);
        interval_days
    }

    /// Date de la prochaine révision.
    pub fn next_due(&self, card: &Card) -> DateTime<Utc> {
        card.due_at
    }

    /// Rétention visée (utile pour l'UI).
    pub fn desired_retention(&self) -> f64 {
        self.desired_retention
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card() -> Card {
        let now = Utc::now();
        Scheduler::new_card(
            Vocab {
                en: "hello".into(),
                fr: "bonjour".into(),
            },
            now,
        )
    }

    #[test]
    fn new_card_is_due_now() {
        let now = Utc::now();
        let s = Scheduler::default();
        let c = Scheduler::new_card(
            Vocab {
                en: "cat".into(),
                fr: "chat".into(),
            },
            now,
        );
        assert!(s.is_due(&c, now));
        assert_eq!(c.state, CardState::New);
        assert_eq!(c.reps, 0);
    }

    #[test]
    fn good_review_schedules_in_the_future() {
        let now = Utc::now();
        let s = Scheduler::default();
        let mut c = card();
        let interval = s.review(&mut c, Grade::Good, now);
        assert!(interval >= 1.0);
        assert!(c.due_at > now);
        assert!(!s.is_due(&c, now));
        assert_eq!(c.reps, 1);
        assert_eq!(c.state, CardState::Review);
    }

    #[test]
    fn again_increments_lapses_and_reduces_stability() {
        let now = Utc::now();
        let s = Scheduler::default();
        let mut c = card();
        s.review(&mut c, Grade::Good, now);
        let stability_after_good = c.stability;
        s.review(&mut c, Grade::Again, now);
        assert_eq!(c.lapses, 1);
        assert!(c.stability < stability_after_good);
        assert_eq!(c.state, CardState::Relearning);
    }

    #[test]
    fn easy_interval_is_at_least_good_interval() {
        let now = Utc::now();
        let s = Scheduler::default();
        let mut g = card();
        let mut e = card();
        let gi = s.review(&mut g, Grade::Good, now);
        let ei = s.review(&mut e, Grade::Easy, now);
        assert!(ei >= gi);
    }

    #[test]
    fn retrievability_decreases_with_time() {
        let now = Utc::now();
        let s = Scheduler::default();
        let mut c = card();
        s.review(&mut c, Grade::Good, now);
        let now_r = s.retrievability(&c, now);
        let later_r = s.retrievability(&c, now + Duration::days(3));
        assert!(now_r > later_r);
    }
}
