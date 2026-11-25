//! Shell Tauri de Lakk.
//!
//! L'interface Svelte contient un miroir TypeScript du moteur pour pouvoir
//! tourner dans un navigateur sans compilation WASM. Dans l'application
//! Tauri (desktop, Android, iOS), **c'est `lakk-core` (Rust) qui fait
//! autorité** : le contenu, les statistiques et le planificateur FSRS
//! viennent des commandes ci-dessous.

use lakk_core::bridge::{self, CardWire, CourseStats};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};

#[cfg(target_os = "linux")]
fn disable_dmabuf_renderer() {
    // Évite les zones sombres / blocs gris sur WebKitGTK 4.1 (Ubuntu 24.04, Zorin, etc.)
    // Doit être défini AVANT la création de la fenêtre WebView.
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
}

#[derive(serde::Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    free: bool,
    engine: &'static str,
}

/// Informations sur l'application et le moteur actif.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "Lakk",
        version: env!("CARGO_PKG_VERSION"),
        free: true,
        engine: "lakk-core (Rust)",
    }
}

/// Contenu pédagogique A1 complet, embarqué dans le binaire.
#[tauri::command]
fn course_json() -> &'static str {
    bridge::COURSE_JSON
}

/// Statistiques du cours (unités, leçons, exercices, mots).
#[tauri::command]
fn course_stats() -> Result<CourseStats, String> {
    let course = bridge::embedded_course().map_err(|e| e.to_string())?;
    Ok(bridge::course_stats(&course))
}

/// Liste des anomalies détectées dans le contenu (vide = tout va bien).
#[tauri::command]
fn validate_course() -> Result<Vec<String>, String> {
    let course = bridge::embedded_course().map_err(|e| e.to_string())?;
    Ok(course.validate())
}

/// Applique une note FSRS à une carte et renvoie la carte replanifiée.
#[tauri::command]
fn review_card(mut card: CardWire, grade: u8, now: i64) -> Result<CardWire, String> {
    bridge::review_card(&mut card, grade, now)
}

/// Reçoit les erreurs JS du frontend pour les logger côté Rust (visible dans le terminal).
#[tauri::command]
fn log_error(text: String) {
    eprintln!("[LAKK JS ERROR] {}", text);
}

// ------------------------- Synthèse vocale native -------------------------
//
// WebKitGTK (Linux) n'implémente pas — ou très mal — `window.speechSynthesis`.
// On se rabat donc sur le moteur TTS du système : espeak-ng, espeak ou
// spd-say (speech-dispatcher). Aucun plugin ni permission supplémentaire.

/// Cherche un exécutable dans le PATH.
fn command_exists(name: &str) -> bool {
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            if std::path::Path::new(dir).join(name).is_file() {
                return true;
            }
        }
    }
    false
}

/// Renvoie le premier moteur TTS système disponible.
fn find_tts_backend() -> Option<&'static str> {
    ["espeak-ng", "espeak", "spd-say"]
        .into_iter()
        .find(|name| command_exists(name))
}

/// Processus TTS en cours, pour couper la lecture précédente.
fn tts_child() -> &'static Mutex<Option<Child>> {
    static CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
    CHILD.get_or_init(|| Mutex::new(None))
}

fn stop_child() {
    if let Ok(mut guard) = tts_child().lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// Voix eSpeak : langue + variante féminine, plus claire pour apprendre.
fn espeak_voice(lang: &str) -> String {
    let base = lang.split(['-', '_']).next().unwrap_or("en").to_lowercase();
    match base.as_str() {
        "en" => "en-us+f3".into(),
        "fr" => "fr+f3".into(),
        "es" => "es+f3".into(),
        "pt" => "pt+f3".into(),
        other => {
            if other.is_empty() {
                "en-us+f3".into()
            } else {
                other.into()
            }
        }
    }
}

fn short_lang(lang: &str) -> String {
    lang.split(['-', '_'])
        .next()
        .unwrap_or("en")
        .to_lowercase()
}

/// Indique quel moteur TTS natif est installé (None = aucun).
#[tauri::command]
fn tts_backend() -> Option<String> {
    find_tts_backend().map(str::to_string)
}

/// Prononce un texte via le moteur TTS système, sans bloquer l'interface.
#[tauri::command]
fn speak_native(text: String, lang: Option<String>) -> Result<(), String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Ok(());
    }
    let lang = lang.unwrap_or_else(|| "en-US".to_string());
    let backend = find_tts_backend().ok_or_else(|| {
        "aucun moteur TTS trouvé : installe espeak-ng (ou speech-dispatcher)".to_string()
    })?;

    // Coupe la lecture précédente pour éviter les chevauchements.
    stop_child();

    let mut cmd = Command::new(backend);
    if backend == "spd-say" {
        cmd.arg("-l").arg(short_lang(&lang)).arg("-r").arg("-10");
    } else {
        // Voix féminine, débit ralenti et petite pause entre les mots :
        // plus intelligible pour un apprenant francophone.
        cmd.arg("-v")
            .arg(espeak_voice(&lang))
            .arg("-s")
            .arg("140")
            .arg("-p")
            .arg("48")
            .arg("-g")
            .arg("4")
            .arg("-a")
            .arg("160");
    }
    cmd.arg(&text)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = cmd
        .spawn()
        .map_err(|e| format!("échec du lancement de {backend} : {e}"))?;
    if let Ok(mut guard) = tts_child().lock() {
        *guard = Some(child);
    }
    Ok(())
}

/// Arrête la prononciation native en cours.
#[tauri::command]
fn stop_native_speech() {
    stop_child();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    disable_dmabuf_renderer();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            app_info,
            course_json,
            course_stats,
            validate_course,
            review_card,
            log_error,
            tts_backend,
            speak_native,
            stop_native_speech
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Lakk");
}
