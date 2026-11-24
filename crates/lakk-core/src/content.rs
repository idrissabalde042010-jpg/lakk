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
        
        // Check unique unit IDs and slugs
        let mut seen_unit_ids = std::collections::HashSet::new();
        let mut seen_unit_slugs = std::collections::HashSet::new();
        for (ui, unit) in self.units.iter().enumerate() {
            if !seen_unit_ids.insert(&unit.id) {
                problems.push(format!("unité {ui}: ID dupliqué '{}'", unit.id));
            }
            if !seen_unit_slugs.insert(&unit.slug) {
                problems.push(format!("unité {ui}: slug dupliqué '{}'", unit.slug));
            }
            
            if unit.lessons.is_empty() {
                problems.push(format!("unité {ui} sans leçon"));
            }
            
            // Check unique lesson IDs and slugs within unit
            let mut seen_lesson_ids = std::collections::HashSet::new();
            let mut seen_lesson_slugs = std::collections::HashSet::new();
            for (li, lesson) in unit.lessons.iter().enumerate() {
                if !seen_lesson_ids.insert(&lesson.id) {
                    problems.push(format!("unité {ui}, leçon {li}: ID dupliqué '{}'", lesson.id));
                }
                if !seen_lesson_slugs.insert(&lesson.slug) {
                    problems.push(format!("unité {ui}, leçon {li}: slug dupliqué '{}'", lesson.slug));
                }
                
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
                    ) {
                        // Check answer is in choices
                        if !ex.choices.iter().any(|c| crate::lesson::answers_match(c, &ex.answer)) {
                            problems.push(format!(
                                "exercice {ui}/{li}/{ei} : la bonne réponse n'est pas dans les choix"
                            ));
                        }
                        // Check answer appears exactly once
                        let answer_count = ex.choices.iter().filter(|c| crate::lesson::answers_match(c, &ex.answer)).count();
                        if answer_count != 1 {
                            problems.push(format!(
                                "exercice {ui}/{li}/{ei} : la réponse apparaît {} fois dans les choix (attendu: 1)",
                                answer_count
                            ));
                        }
                        // Check no duplicate choices
                        let mut seen_choices = std::collections::HashSet::new();
                        for choice in &ex.choices {
                            if !seen_choices.insert(choice) {
                                problems.push(format!(
                                    "exercice {ui}/{li}/{ei} : choix dupliqué '{}'",
                                    choice
                                ));
                            }
                        }
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
    "id": "u1",
    "slug": "u1-test",
    "title":"U1",
    "lessons": [{
      "id": "u1-l1",
      "slug": "u1-l1-test",
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

    #[test]
    fn validates_unique_unit_ids_and_slugs() {
        let dup_id = SAMPLE.replace(
            "\"units\": [{",
            "\"units\": [{\"id\": \"u1\", \"slug\": \"u1-dup\", \"title\":\"U1dup\", \"lessons\":[{\"id\":\"u1-l1\",\"slug\":\"u1-l1\",\"title\":\"L1\",\"exercises\":[]}]}, {",
        );
        let c = load_course(&dup_id).unwrap();
        let problems = c.validate();
        assert!(problems.iter().any(|p| p.contains("ID dupliqué") && p.contains("u1")), "problems: {:?}", problems);
    }

    #[test]
    fn validates_unique_lesson_ids_and_slugs() {
        let dup_lesson = SAMPLE.replace(
            "\"lessons\": [{",
            "\"lessons\": [{\"id\": \"u1-l1\", \"slug\": \"u1-l1-dup\", \"title\":\"L1dup\", \"exercises\":[{\"kind\":\"multiple_choice\",\"prompt\":\"?\",\"choices\":[\"a\",\"b\"],\"answer\":\"a\"}]}, {",
        );
        let c = load_course(&dup_lesson).unwrap();
        let problems = c.validate();
        assert!(problems.iter().any(|p| p.contains("ID dupliqué") && p.contains("u1-l1")), "problems: {:?}", problems);
    }

    #[test]
    fn validates_answer_appears_once_in_choices() {
        // Answer appears twice in choices
        let dup_answer = SAMPLE.replace("\"hello\",\"bye\"", "\"hello\",\"hello\"");
        let c = load_course(&dup_answer).unwrap();
        let problems = c.validate();
        assert!(problems.iter().any(|p| p.contains("réponse apparaît") && p.contains("2 fois")), "problems: {:?}", problems);
    }

    #[test]
    fn validates_no_duplicate_choices() {
        // Two identical wrong choices
        let dup_choices = SAMPLE.replace("\"hello\",\"bye\"", "\"bye\",\"bye\"");
        let c = load_course(&dup_choices).unwrap();
        let problems = c.validate();
        assert!(problems.iter().any(|p| p.contains("choix dupliqué")), "problems: {:?}", problems);
    }
}