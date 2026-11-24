//! # lakk-core
//!
//! Cœur métier de **Lakk**, une application gratuite pour apprendre l'anglais
//! depuis le français. Ce crate ne dépend d'aucune interface graphique : il est
//! donc testable partout (desktop, mobile, web, terminal).
//!
//! Modules :
//! - [`models`]      : structures de données (cours, leçons, exercices, cartes)
//! - [`srs`]         : répétition espacée inspirée de FSRS
//! - [`gamification`]: XP, série (streak), cœurs, gemmes, objectif quotidien
//! - [`lesson`]      : moteur de leçon (pose les exercices, corrige, compte)
//! - [`content`]     : chargement du cours depuis du JSON
//! - [`bridge`]      : pont vers l'interface (contenu embarqué, cartes, notes)

pub mod bridge;
pub mod content;
pub mod gamification;
pub mod lesson;
pub mod models;
pub mod srs;

pub use bridge::{course_stats, embedded_course, review_card, CardWire, CourseStats, COURSE_JSON};
pub use content::load_course;
pub use gamification::LearnerProfile;
pub use lesson::LessonSession;
pub use models::*;
pub use srs::{Grade, Scheduler};
