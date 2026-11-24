//! Shell Tauri de Lakk.
//!
//! L'interface Svelte contient un miroir TypeScript du moteur pour pouvoir
//! tourner dans un navigateur sans compilation WASM. Dans l'application
//! Tauri (desktop, Android, iOS), **c'est `lakk-core` (Rust) qui fait
//! autorité** : le contenu, les statistiques et le planificateur FSRS
//! viennent des commandes ci-dessous.

use lakk_core::bridge::{self, CardWire, CourseStats};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    disable_dmabuf_renderer();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_info,
            course_json,
            course_stats,
            validate_course,
            review_card,
            log_error
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Lakk");
}
