//! Moteur de leçon : parcourt les exercices, corrige les réponses et compte
//! les points. Aucune dépendance à l'interface : la CLI et l'app Tauri
//! utilisent exactement ce même moteur.

use crate::models::{Exercise, Lesson};

/// Une session de leçon en cours.
#[derive(Debug)]
pub struct LessonSession<'a> {
    lesson: &'a Lesson,
    index: usize,
    pub correct: u32,
    pub wrong: u32,
}

impl<'a> LessonSession<'a> {
    pub fn new(lesson: &'a Lesson) -> Self {
        Self {
            lesson,
            index: 0,
            correct: 0,
            wrong: 0,
        }
    }

    /// Exercice courant, ou `None` si la leçon est finie.
    pub fn current(&self) -> Option<&Exercise> {
        self.lesson.exercises.get(self.index)
    }

    pub fn index(&self) -> usize {
        self.index
    }

    pub fn total(&self) -> usize {
        self.lesson.exercises.len()
    }

    pub fn remaining(&self) -> usize {
        self.total().saturating_sub(self.index)
    }

    pub fn is_finished(&self) -> bool {
        self.index >= self.total()
    }

    /// Soumet une réponse textuelle. Renvoie `true` si elle est correcte.
    pub fn submit(&mut self, answer: &str) -> bool {
        let Some(ex) = self.current() else {
            return false;
        };
        let ok = answers_match(&ex.answer, answer);
        if ok {
            self.correct += 1;
        } else {
            self.wrong += 1;
        }
        self.index += 1;
        ok
    }

    /// Soumet un choix par index (pour le choix multiple). Renvoie `true` si
    /// c'est la bonne réponse.
    pub fn submit_choice(&mut self, choice_index: usize) -> Option<bool> {
        let expected = {
            let ex = self.current()?;
            ex.choices.get(choice_index)?.clone()
        };
        Some(self.submit(&expected))
    }

    /// XP gagnée dans cette session : +10 par bonne réponse, +20 si la leçon
    /// est terminée.
    pub fn xp(&self) -> u32 {
        let base = self.correct * 10;
        if self.is_finished() {
            base + 20
        } else {
            base
        }
    }

    /// Précision en pourcentage (0..=100).
    pub fn accuracy(&self) -> u32 {
        let total = self.correct + self.wrong;
        if total == 0 {
            return 0;
        }
        ((self.correct as f64 / total as f64) * 100.0).round() as u32
    }
}

/// Normalise une réponse : minuscules, sans ponctuation ni espaces superflus.
pub fn normalize(s: &str) -> String {
    let cleaned: String = s
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c.is_whitespace() || c == '\'' || c == '-' {
                c
            } else {
                ' '
            }
        })
        .collect();
    cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Compare deux réponses après normalisation.
pub fn answers_match(expected: &str, given: &str) -> bool {
    normalize(expected) == normalize(given)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ExerciseKind, Vocab};

    fn lesson() -> Lesson {
        Lesson {
            id: "u1-l1".into(),
            slug: "u1-l1-test".into(),
            title: "Test".into(),
            exercises: vec![
                Exercise {
                    kind: ExerciseKind::MultipleChoice,
                    prompt: "Bonjour ?".into(),
                    choices: vec!["hello".into(), "bye".into()],
                    word_bank: vec![],
                    answer: "hello".into(),
                    vocab: Some(Vocab {
                        en: "hello".into(),
                        fr: "bonjour".into(),
                    }),
                    audio_key: None,
                },
                Exercise {
                    kind: ExerciseKind::Translate,
                    prompt: "Je suis étudiant.".into(),
                    choices: vec![],
                    word_bank: vec!["I".into(), "am".into(), "a".into(), "student".into()],
                    answer: "I am a student".into(),
                    vocab: None,
                    audio_key: None,
                },
            ],
        }
    }

    #[test]
    fn normalization_ignores_case_and_punctuation() {
        assert_eq!(normalize("  I  am a STUDENT. "), "i am a student");
        assert!(answers_match("I am a student", "i am a student."));
    }

    #[test]
    fn progress_and_scoring() {
        let l = lesson();
        let mut s = LessonSession::new(&l);
        assert_eq!(s.total(), 2);
        assert!(!s.is_finished());
        assert!(s.submit("Hello"));
        assert!(s.submit("i am a student."));
        assert!(s.is_finished());
        assert_eq!(s.correct, 2);
        assert_eq!(s.wrong, 0);
        assert_eq!(s.accuracy(), 100);
        assert_eq!(s.xp(), 2 * 10 + 20);
    }

    #[test]
    fn wrong_answer_counts() {
        let l = lesson();
        let mut s = LessonSession::new(&l);
        assert!(!s.submit("bonjour"));
        assert_eq!(s.wrong, 1);
        assert_eq!(s.correct, 0);
        assert_eq!(s.accuracy(), 0);
    }

    #[test]
    fn choice_submission() {
        let l = lesson();
        let mut s = LessonSession::new(&l);
        assert_eq!(s.submit_choice(0), Some(true));
        assert!(s.is_finished() == false || s.index() == 1);
    }
}
