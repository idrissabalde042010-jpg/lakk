//! Structures de données du domaine.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Les types d'exercices supportés.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExerciseKind {
    /// Choix multiple (une bonne réponse parmi plusieurs).
    MultipleChoice,
    /// Traduction : reconstruire une phrase avec une banque de mots.
    Translate,
    /// Écoute puis saisie (dictée).
    ListenType,
    /// Associer deux colonnes.
    Match,
    /// Compléter un trou.
    FillBlank,
    /// Remettre les mots dans l'ordre.
    OrderWords,
}

/// Un mot de vocabulaire, cœur de la répétition espacée.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Vocab {
    /// Mot ou expression en anglais (langue cible).
    pub en: String,
    /// Traduction en français (langue source).
    pub fr: String,
}

/// Un exercice d'une leçon.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exercise {
    pub kind: ExerciseKind,
    /// Consigne affichée à l'apprenant.
    pub prompt: String,
    /// Choix proposés (pour `multiple_choice` / `match`).
    #[serde(default)]
    pub choices: Vec<String>,
    /// Banque de mots (pour `translate` / `order_words`).
    #[serde(default)]
    pub word_bank: Vec<String>,
    /// Réponse attendue (comparée après normalisation).
    pub answer: String,
    /// Vocabulaire associé (crée une carte SRS si présent).
    #[serde(default)]
    pub vocab: Option<Vocab>,
    /// Clé d'un fichier audio (TTS / enregistrement).
    #[serde(default)]
    pub audio_key: Option<String>,
}

/// Métadonnées d'un cours.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseMeta {
    /// Langue de départ, ex. "fr".
    #[serde(rename = "source")]
    pub source_lang: String,
    /// Langue apprise, ex. "en".
    #[serde(rename = "target")]
    pub target_lang: String,
    pub title: String,
}

/// Une leçon.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lesson {
    pub title: String,
    pub exercises: Vec<Exercise>,
}

/// Une unité du parcours.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Unit {
    pub title: String,
    #[serde(default)]
    pub color: Option<String>,
    pub lessons: Vec<Lesson>,
}

/// Une phrase « réelle » du jour (défi quotidien).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Phrase {
    /// Phrase en anglais.
    pub en: String,
    /// Traduction française.
    pub fr: String,
    /// Conseil pour répondre naturellement.
    #[serde(default)]
    pub tip: String,
}

/// Un cours complet (arbre unités -> leçons -> exercices).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Course {
    pub course: CourseMeta,
    /// Phrases du défi quotidien (facultatives).
    #[serde(default)]
    pub phrases: Vec<Phrase>,
    pub units: Vec<Unit>,
}

/// État d'une carte dans le planificateur SRS.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardState {
    New,
    Learning,
    Review,
    Relearning,
}

/// Une carte de révision (un mot + son état de mémorisation).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub vocab: Vocab,
    /// Stabilité : nombre de jours avant que la rétention chute (~90 %).
    pub stability: f64,
    /// Difficulté intrinsèque de la carte (1 = facile, 10 = difficile).
    pub difficulty: f64,
    /// Nombre total de révisions.
    pub reps: u32,
    /// Nombre d'oublis (réponses « Again »).
    pub lapses: u32,
    pub state: CardState,
    /// Prochaine date de révision.
    pub due_at: DateTime<Utc>,
    /// Dernière révision.
    pub last_review: Option<DateTime<Utc>>,
}
