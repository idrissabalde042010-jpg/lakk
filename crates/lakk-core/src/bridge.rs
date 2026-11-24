//! Pont entre le cœur Rust (`lakk-core`) et l'interface (Tauri).
//!
//! Ce module évite de dupliquer la logique métier dans la couche UI :
//! - [`COURSE_JSON`] est le contenu A1 embarqué dans le binaire (hors ligne
//!   par construction, aucune requête réseau) ;
//! - [`CardWire`] est la représentation d'une carte SRS pour le front
//!   (timestamps en millisecondes, comme dans le miroir TypeScript) ;
//! - [`review_card`] applique une note FSRS côté Rust et renvoie la carte
//!   replanifiée.

use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};

use crate::content::load_course;
use crate::models::{Card, CardState, Course, Vocab};
use crate::srs::{Grade, Scheduler};

/// Contenu A1 embarqué dans le binaire.
pub const COURSE_JSON: &str = include_str!("../../../content/fr-en-a1.json");

/// Charge le cours embarqué (source de vérité côté Rust).
pub fn embedded_course() -> Result<Course, serde_json::Error> {
    load_course(COURSE_JSON)
}

/// Statistiques du cours, affichées dans l'interface.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CourseStats {
    pub units: usize,
    pub lessons: usize,
    pub exercises: usize,
    pub words: usize,
}

/// Calcule les statistiques d'un cours.
pub fn course_stats(course: &Course) -> CourseStats {
    CourseStats {
        units: course.units.len(),
        lessons: course.lessons().len(),
        exercises: course.exercise_count(),
        words: course.vocabulary().len(),
    }
}

/// Carte SRS au format de l'interface : timestamps en millisecondes depuis
/// l'époque Unix, exactement comme le miroir TypeScript (`src/lib/engine.ts`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CardWire {
    pub vocab: Vocab,
    pub stability: f64,
    pub difficulty: f64,
    pub reps: u32,
    pub lapses: u32,
    /// `new` | `learning` | `review` | `relearning`
    pub state: String,
    /// Prochaine révision (ms).
    pub due_at: i64,
    /// Dernière révision (ms).
    pub last_review: Option<i64>,
}

fn state_name(state: CardState) -> &'static str {
    match state {
        CardState::New => "new",
        CardState::Learning => "learning",
        CardState::Review => "review",
        CardState::Relearning => "relearning",
    }
}

fn state_from_name(name: &str) -> Result<CardState, String> {
    match name {
        "new" => Ok(CardState::New),
        "learning" => Ok(CardState::Learning),
        "review" => Ok(CardState::Review),
        "relearning" => Ok(CardState::Relearning),
        other => Err(format!("état de carte inconnu : {other}")),
    }
}

fn ms_to_datetime(ms: i64) -> Result<DateTime<Utc>, String> {
    Utc.timestamp_millis_opt(ms)
        .single()
        .ok_or_else(|| format!("timestamp invalide : {ms}"))
}

impl From<Card> for CardWire {
    fn from(card: Card) -> Self {
        CardWire {
            vocab: card.vocab,
            stability: card.stability,
            difficulty: card.difficulty,
            reps: card.reps,
            lapses: card.lapses,
            state: state_name(card.state).to_string(),
            due_at: card.due_at.timestamp_millis(),
            last_review: card.last_review.map(|t| t.timestamp_millis()),
        }
    }
}

impl CardWire {
    /// Convertit vers le modèle Rust.
    pub fn to_card(&self) -> Result<Card, String> {
        Ok(Card {
            vocab: self.vocab.clone(),
            stability: self.stability,
            difficulty: self.difficulty,
            reps: self.reps,
            lapses: self.lapses,
            state: state_from_name(&self.state)?,
            due_at: ms_to_datetime(self.due_at)?,
            last_review: match self.last_review {
                Some(ms) => Some(ms_to_datetime(ms)?),
                None => None,
            },
        })
    }
}

/// Applique une note FSRS (1 = oublié … 4 = facile) et renvoie la carte
/// replanifiée. La note est bornée à 1..=4.
pub fn review_card(card: &mut CardWire, grade: u8, now_ms: i64) -> Result<CardWire, String> {
    let g = Grade::from_value(grade).ok_or_else(|| format!("note invalide : {grade}"))?;
    let mut native = card.to_card()?;
    let now = ms_to_datetime(now_ms)?;
    Scheduler::default().review(&mut native, g, now);
    *card = CardWire::from(native);
    Ok(card.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::srs::Grade;

    fn wire() -> CardWire {
        let now = Utc::now();
        CardWire::from(Scheduler::new_card(
            Vocab {
                en: "hello".into(),
                fr: "bonjour".into(),
            },
            now,
        ))
    }

    #[test]
    fn embedded_course_is_valid() {
        let course = embedded_course().expect("contenu embarqué invalide");
        let problems = course.validate();
        assert!(problems.is_empty(), "contenu à corriger : {problems:?}");
    }

    #[test]
    fn stats_match_content() {
        let course = embedded_course().unwrap();
        let stats = course_stats(&course);
        assert_eq!(stats.units, course.units.len());
        assert_eq!(stats.lessons, course.lessons().len());
        assert!(stats.exercises >= stats.words);
        assert!(stats.words > 0);
    }

    #[test]
    fn card_wire_round_trip() {
        let original = wire();
        let back = original.to_card().unwrap();
        assert_eq!(CardWire::from(back), original);
    }

    #[test]
    fn review_plans_in_the_future() {
        let now = 1_700_000_000_000;
        let mut card = wire();
        let updated = review_card(&mut card, Grade::Good as u8, now).unwrap();
        assert_eq!(updated.reps, 1);
        assert_eq!(updated.state, "review");
        assert!(updated.due_at > now);
    }

    #[test]
    fn again_marks_relearning() {
        let now = 1_700_000_000_000;
        let mut card = wire();
        review_card(&mut card, Grade::Good as u8, now).unwrap();
        let updated = review_card(&mut card, Grade::Again as u8, now + 86_400_000).unwrap();
        assert_eq!(updated.state, "relearning");
        assert_eq!(updated.lapses, 1);
    }

    #[test]
    fn invalid_grade_is_rejected() {
        let mut card = wire();
        assert!(review_card(&mut card, 9, 1_700_000_000_000).is_err());
    }
}
