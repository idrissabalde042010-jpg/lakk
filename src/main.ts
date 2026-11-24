import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { app } from './lib/store.svelte';
import { loadAccount } from './lib/account.svelte.ts';

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

window.addEventListener('error', (e) => {
  reportError('window.onerror: ' + e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  reportError('unhandledrejection: ' + e.reason, e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
});

// Thème sombre mémorisé.
try {
  const theme = localStorage.getItem('lakk.theme');
  if (theme === 'dark') document.documentElement.classList.add('dark');
} catch (e) {
  reportError('localStorage theme error', e instanceof Error ? e : new Error(String(e)));
}

// Mount with error boundary — only render error in DOM if mount fails
let ui: ReturnType<typeof mount> | null = null;
try {
  ui = mount(App, { target: document.getElementById('app')! });
} catch (e) {
  reportError('mount(App) failed', e instanceof Error ? e : new Error(String(e)));
  // Only now render in DOM since the app cannot start
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:0;background:#111;color:#f43;color:#f43;font:12px monospace;padding:16px;z-index:9999;white-space:pre-wrap;overflow:auto;pointer-events:none';
  pre.textContent = `Erreur de démarrage : ${e instanceof Error ? e.message : String(e)}`;
  document.body.appendChild(pre);
  throw e;
}

// Initialisation : compte + contenu Rust
Promise.all([loadAccount(), app.init()]).catch((e) => reportError('init failed', e instanceof Error ? e : new Error(String(e))));

// Hors ligne : le service worker s'enregistre (le build inclut sw.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('[SW] Registered:', reg.scope))
    .catch(err => reportError('[SW] Registration failed', err instanceof Error ? err : new Error(String(err))));
}

export default ui;