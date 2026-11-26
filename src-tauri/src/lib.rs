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
use tauri::webview::{PermissionKind, PermissionResponse};

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

// ---------------------- Synthèse neuronale Edge TTS -----------------------
//
// Microsoft Edge « Read Aloud » fournit des voix neuronales de très haute
// qualité, gratuitement et sans clé API. On l'utilise en priorité depuis le
// frontend ; si le réseau est absent (ou le service indisponible), le
// frontend bascule automatiquement sur la voix locale du système.

/// Synthétise `text` avec une voix neuronale Microsoft Edge, écrit le MP3
/// dans un fichier temporaire et renvoie son chemin absolu. `lang` permet de
/// choisir la voix (français par défaut).
///
/// On ne renvoie pas les octets bruts : sous WebKitGTK, lire un MP3 depuis un
/// Blob mémoire est peu fiable (son saccadé ou coupé). Un vrai fichier lu via
/// `convertFileSrc` (protocole asset de Tauri) est beaucoup plus stable.
#[tauri::command]
async fn synthesize_edge_tts(text: String, lang: Option<String>) -> Result<String, String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("texte vide".to_string());
    }

    // Voix neuronale française par défaut (Denise), anglaise si demandé.
    let voice = match lang.as_deref() {
        Some(l) if l.starts_with("en") => "en-US-AriaNeural",
        _ => "fr-FR-DeniseNeural",
    }
    .to_string();

    // Le client msedge-tts (feature `blocking`) est bloquant : on l'exécute
    // sur un thread dédié pour ne pas bloquer le runtime async de Tauri.
    tauri::async_runtime::spawn_blocking(move || {
        use msedge_tts::tts::{client::connect, SpeechConfig};

        let config = SpeechConfig {
            voice_name: voice,
            audio_format: "audio-24khz-48kbitrate-mono-mp3".to_string(),
            pitch: 0,
            rate: 0,
            volume: 0,
        };

        let mut tts =
            connect().map_err(|e| format!("connexion Edge TTS échouée : {e}"))?;
        let audio = tts
            .synthesize(&text, &config)
            .map_err(|e| format!("synthèse Edge TTS échouée : {e}"))?;

        if audio.audio_bytes.is_empty() {
            return Err("Edge TTS : audio vide".to_string());
        }

        // Fichier temporaire unique : évite toute collision entre deux
        // lectures rapprochées (le frontend lit via le protocole asset).
        let mut path = std::env::temp_dir();
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        path.push(format!("lakk_tts_{stamp}.mp3"));

        std::fs::write(&path, &audio.audio_bytes)
            .map_err(|e| format!("écriture du fichier TTS échouée : {e}"))?;

        eprintln!(
            "[TTS] {} octets écrits dans {}",
            audio.audio_bytes.len(),
            path.display()
        );

        Ok::<String, String>(path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| format!("tâche Edge TTS interrompue : {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Rustls : aws-lc-rs et ring sont tous deux tirés par les dépendances
    // (reqwest, msedge-tts). Sans choix explicite, rustls panique au premier
    // appel TLS ("Could not automatically determine the process-level
    // CryptoProvider"). On installe `ring` AVANT toute connexion réseau.
    let _ = rustls::crypto::ring::default_provider().install_default();

    #[cfg(target_os = "linux")]
    disable_dmabuf_renderer();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        // Autorise l'accès au micro depuis le webview (nécessaire pour la preuve
        // de vie de la Mission du Jour sous WebKitGTK / Linux, où la permission
        // est refusée par défaut).
        .on_permission_request(|_, kind| match kind {
            PermissionKind::Microphone => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            course_json,
            course_stats,
            validate_course,
            review_card,
            log_error,
            tts_backend,
            speak_native,
            stop_native_speech,
            synthesize_edge_tts
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Lakk");
}
