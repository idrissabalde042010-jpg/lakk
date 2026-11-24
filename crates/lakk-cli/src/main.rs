//! Démo terminal de Lakk.
//!
//! - `cargo run -p lakk-cli -- --demo`  : déroulé automatique (pour tester)
//! - `cargo run -p lakk-cli`            : mode interactif (tu réponds)
//! - `cargo run -p lakk-cli -- --file chemin.json` : charge un autre cours

use std::collections::HashMap;
use std::io::{self, Write};

use chrono::Utc;
use lakk_core::{
    load_course, Card, Course, ExerciseKind, Grade, LearnerProfile, LessonSession, Scheduler, Vocab,
};

const CONTENT: &str = include_str!("../../../content/fr-en-a1.json");

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let demo = args.iter().any(|a| a == "--demo");
    let json = match args.iter().position(|a| a == "--file") {
        Some(i) => std::fs::read_to_string(&args[i + 1]).expect("lecture du fichier impossible"),
        None => CONTENT.to_string(),
    };

    let course = load_course(&json).expect("JSON de cours invalide");
    let problems = course.validate();
    if !problems.is_empty() {
        eprintln!("⚠ Contenu à corriger :");
        for p in &problems {
            eprintln!("  - {p}");
        }
    }

    banner(&course);
    let mut app = App::new();
    if demo {
        app.run_demo(&course);
    } else {
        app.run_interactive(&course);
    }
    app.summary();
}

struct App {
    profile: LearnerProfile,
    scheduler: Scheduler,
    cards: HashMap<String, Card>,
}

impl App {
    fn new() -> Self {
        Self {
            profile: LearnerProfile::new("Idrissa"),
            scheduler: Scheduler::default(),
            cards: HashMap::new(),
        }
    }

    /// Met à jour la carte SRS associée à un exercice.
    fn review_vocab(&mut self, vocab: &Vocab, grade: Grade) {
        let now = Utc::now();
        let key = vocab.en.to_lowercase();
        let card = self
            .cards
            .entry(key)
            .or_insert_with(|| Scheduler::new_card(vocab.clone(), now));
        self.scheduler.review(card, grade, now);
    }

    fn finish_lesson(&mut self, session: &LessonSession) {
        let xp = session.xp();
        self.profile.register_lesson(Utc::now(), xp);
        println!(
            "\n✅ Leçon terminée : +{xp} XP  |  précision {}%\n",
            session.accuracy()
        );
    }

    fn run_demo(&mut self, course: &Course) {
        let lessons = course.lessons();
        println!("(mode démo automatique)\n");
        for (li, lesson) in lessons.iter().enumerate() {
            println!("── Leçon {}/{} : {} ──", li + 1, lessons.len(), lesson.title);
            let mut session = LessonSession::new(lesson);
            let mut n = 0;
            while !session.is_finished() {
                // On capture les infos dans un bloc pour libérer l'emprunt
                // immuable de `session` avant de le modifier.
                let (answer, vocab, prompt) = {
                    let ex = session.current().expect("exercice courant");
                    (ex.answer.clone(), ex.vocab.clone(), ex.prompt.clone())
                };
                n += 1;
                // Une erreur volontaire sur le 2e exercice pour montrer le SRS.
                let force_wrong = li == 0 && n == 2;
                let given = if force_wrong {
                    "___".to_string()
                } else {
                    answer
                };
                let ok = session.submit(&given);
                if let Some(v) = vocab {
                    self.review_vocab(&v, if ok { Grade::Good } else { Grade::Again });
                }
                print_feedback(&prompt, &given, ok, n, session.total());
            }
            self.finish_lesson(&session);
        }
    }

    fn run_interactive(&mut self, course: &Course) {
        let lessons = course.lessons();
        for (li, lesson) in lessons.iter().enumerate() {
            println!("── Leçon {}/{} : {} ──", li + 1, lessons.len(), lesson.title);
            let mut session = LessonSession::new(lesson);
            while !session.is_finished() {
                let (kind, prompt, choices, word_bank, vocab) = {
                    let ex = session.current().expect("exercice courant");
                    (
                        ex.kind,
                        ex.prompt.clone(),
                        ex.choices.clone(),
                        ex.word_bank.clone(),
                        ex.vocab.clone(),
                    )
                };
                let n = session.index() + 1;
                let total = session.total();

                println!("\n({n}/{total}) {prompt}");
                match kind {
                    ExerciseKind::MultipleChoice | ExerciseKind::Match => {
                        for (i, c) in choices.iter().enumerate() {
                            println!("  {}) {}", i + 1, c);
                        }
                        print!("Ta réponse (numéro) : ");
                    }
                    ExerciseKind::Translate | ExerciseKind::OrderWords => {
                        if !word_bank.is_empty() {
                            println!("Mots : {}", word_bank.join(" · "));
                        }
                        print!("Ta réponse : ");
                    }
                    _ => print!("Ta réponse : "),
                }
                io::stdout().flush().ok();

                let mut line = String::new();
                if io::stdin().read_line(&mut line).is_err() {
                    return;
                }
                let line = line.trim().to_string();

                let ok = match kind {
                    ExerciseKind::MultipleChoice | ExerciseKind::Match => {
                        if let Ok(idx) = line.parse::<usize>() {
                            session.submit_choice(idx.saturating_sub(1)).unwrap_or(false)
                        } else {
                            session.submit(&line)
                        }
                    }
                    _ => session.submit(&line),
                };
                if let Some(v) = vocab {
                    self.review_vocab(&v, if ok { Grade::Good } else { Grade::Again });
                }
                print_feedback(&prompt, &line, ok, n, total);
            }
            self.finish_lesson(&session);
        }
    }

    fn summary(&self) {
        let now = Utc::now();
        let due = self
            .cards
            .values()
            .filter(|c| self.scheduler.is_due(c, now))
            .count();
        println!("══════════════ RÉSUMÉ ══════════════");
        println!("Apprenant       : {}", self.profile.name);
        println!("XP total        : {}", self.profile.xp_total);
        println!("Série (streak)  : {} jour(s)", self.profile.streak_days);
        println!(
            "Objectif du jour: {}/{} XP ({} %)",
            self.profile.xp_today,
            self.profile.daily_goal_xp,
            self.profile.daily_goal_percent()
        );
        println!(
            "Cœurs           : {} / {} (illimités : {})",
            self.profile.hearts, self.profile.max_hearts, self.profile.unlimited_hearts
        );
        println!("Gemmes          : {}", self.profile.gems);
        println!("Cartes SRS      : {} (dues maintenant : {})", self.cards.len(), due);
        println!("════════════════════════════════════");
    }
}

fn banner(course: &Course) {
    println!("\n  ██╗      █████╗ ██╗  ██╗██╗  ██╗");
    println!("  ██║     ██╔══██╗██║ ██╔╝██║ ██╔╝");
    println!("  ██║     ███████║█████╔╝ █████╔╝ ");
    println!("  ██║     ██╔══██║██╔═██╗ ██╔═██╗ ");
    println!("  ███████╗██║  ██║██║  ██╗██║  ██╗");
    println!("  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝");
    println!("\n  {}", course.course.title);
    println!(
        "  {} leçon(s), {} exercice(s), {} mot(s) de vocabulaire\n",
        course.lessons().len(),
        course.exercise_count(),
        course.vocabulary().len()
    );
}

fn print_feedback(prompt: &str, given: &str, ok: bool, n: usize, total: usize) {
    if ok {
        println!("  ✔ ({n}/{total}) « {given} » — correct !");
    } else {
        println!("  ✘ ({n}/{total}) « {prompt} » → « {given} » — à revoir.");
    }
}
