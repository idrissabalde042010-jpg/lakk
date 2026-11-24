//! Chargement et validation du contenu pédagogique (JSON).

use crate::models::{Course, Lesson, Vocab};

/// Charge un cours depuis une chaîne JSON.
pub fn load_course(json: &str) -> Result<Course, serde_json::Error> {
    serde_json::from_str(json)
}

impl Course {
    /// Toutes les leçons, dans l'ordre du parcours.
    pub fn lessons(&self) -> Vec<&Lesson> {
        self.units
            .iter()
            .flat_map(|u| u.lessons.iter())
            .collect()
    }

    /// Nombre total d'exercices.
    pub fn exercise_count(&self) -> usize {
        self.lessons().iter().map(|l| l.exercises.len()).sum()
    }

    /// Tous les mots de vocabulaire distincts du cours.
    pub fn vocabulary(&self) -> Vec<Vocab> {
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for lesson in self.lessons() {
            for ex in &lesson.exercises {
                if let Some(v) = &ex.vocab {
                    if seen.insert(v.en.to_lowercase()) {
                        out.push(v.clone());
                    }
                }
            }
        }
        out
    }

    /// Vérifie quelques invariants et renvoie la liste des problèmes.
    pub fn validate(&self) -> Vec<String> {
        let mut problems = Vec::new();
        if self.course.source_lang == self.course.target_lang {
            problems.push("langue source et cible identiques".into());
        }
        if self.units.is_empty() {
            problems.push("aucune unité".into());
        }
        for (ui, unit) in self.units.iter().enumerate() {
            if unit.lessons.is_empty() {
                problems.push(format!("unité {ui} sans leçon"));
            }
            for (li, lesson) in unit.lessons.iter().enumerate() {
                if lesson.exercises.is_empty() {
                    problems.push(format!("leçon {ui}/{li} sans exercice"));
                }
                for (ei, ex) in lesson.exercises.iter().enumerate() {
                    if ex.answer.trim().is_empty() {
                        problems.push(format!("exercice {ui}/{li}/{ei} sans réponse"));
                    }
                    if matches!(
                        ex.kind,
                        crate::models::ExerciseKind::MultipleChoice
                            | crate::models::ExerciseKind::Match
                    ) && !ex.choices.iter().any(|c| crate::lesson::answers_match(c, &ex.answer))
                    {
                        problems.push(format!(
                            "exercice {ui}/{li}/{ei} : la bonne réponse n'est pas dans les choix"
                        ));
                    }
                }
            }
        }
        problems
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "course": {"source":"fr","target":"en","title":"Test"},
      "units": [{
        "title":"U1",
        "lessons": [{
          "title":"L1",
          "exercises": [{
            "kind":"multiple_choice",
            "prompt":"Bonjour ?",
            "choices":["hello","bye"],
            "answer":"hello",
            "vocab":{"en":"hello","fr":"bonjour"}
          }]
        }]
      }]
    }"#;

    #[test]
    fn loads_and_counts() {
        let c = load_course(SAMPLE).unwrap();
        assert_eq!(c.lessons().len(), 1);
        assert_eq!(c.exercise_count(), 1);
        assert_eq!(c.vocabulary().len(), 1);
        assert!(c.validate().is_empty(), "{:?}", c.validate());
    }

    #[test]
    fn detects_missing_answer_choice() {
        let bad = SAMPLE.replace("\"hello\",\"bye\"", "\"hi\",\"bye\"");
        let c = load_course(&bad).unwrap();
        assert!(!c.validate().is_empty());
    }
}
