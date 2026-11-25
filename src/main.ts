import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { app } from './lib/store.svelte';
import { loadAccount } from './lib/account.svelte.ts';
import { init, register, waitLocale } from 'svelte-i18n';

// Enregistre les dictionnaires (chargement paresseux)
register('fr', () => import('./lib/locales/fr.json'));
register('en', () => import('./lib/locales/en.json'));

// Initialise i18n AVANT de monter l'app
init({
  fallbackLocale: 'fr',
  initialLocale: 'fr', // Force la langue au démarrage
});

// --- Error reporting: log to console + Tauri, only render in DOM if mount fails ---
function reportError(msg: string, err?: Error): void {
  const text = `${new Date().toISOString()} | ${msg}${err ? '\n' + err.stack : ''}`;
  console.error(text);
  // Also write to a file via Tauri if available (best effort)
  try {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('log_error', { text }).catch(() => {});
    }).catch(() => {});
  } catch {}
}

window.addEventListener('error', (e: ErrorEvent) => {
  reportError('window.onerror: ' + e.message, e.error);
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  reportError('unhandledrejection: ' + e.reason, e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
});

// Thème sombre mémorisé.
try {
  const theme = localStorage.getItem('lakk.theme');
  if (theme === 'dark') document.documentElement.classList.add('dark');
} catch (e: unknown) {
  reportError('localStorage theme error', e instanceof Error ? e : new Error(String(e)));
}

// Détecte si on est dans Tauri (pas de SW dans l'app native)
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Hors ligne : le service worker s'enregistre (le build inclut sw.js).
// Ne pas enregistrer dans Tauri (protocole tauri:// ne supporte pas les SW).
if (!isTauri() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch((err: unknown) => reportError('[SW] Registration failed', err instanceof Error ? err : new Error(String(err))));
  });
}

let ui: ReturnType<typeof mount> | null = null;

async function startApp(): Promise<void> {
  // ATTENDRE que fr.json soit chargé AVANT de monter l'app.
  // Sinon IntroStory.svelte appelle $_(...) alors que la locale n'est pas définie
  // (=> "[svelte-i18n] Cannot format a message without first setting the initial locale").
  await waitLocale();

  try {
    ui = mount(App, { target: document.getElementById('app')! });
  } catch (e: unknown) {
    reportError('mount(App) failed', e instanceof Error ? e : new Error(String(e)));
    // Only now render in DOM since the app cannot start
    const pre = document.createElement('pre');
    pre.style.cssText = 'position:fixed;inset:0;background:#111;color:#f43;color:#f43;font:12px monospace;padding:16px;z-index:9999;white-space:pre-wrap;overflow:auto;pointer-events:none';
    pre.textContent = `Erreur de démarrage : ${e instanceof Error ? e.message : String(e)}`;
    document.body.appendChild(pre);
    throw e;
  }

  // Initialisation : compte + contenu Rust
  Promise.all([loadAccount(), app.init()]).catch((e: unknown) => reportError('init failed', e instanceof Error ? e : new Error(String(e))));
}

// Point d'entrée unique : i18n prêt, puis montage.
startApp().catch((e: unknown) => reportError('startApp failed', e instanceof Error ? e : new Error(String(e))));

export default ui;
