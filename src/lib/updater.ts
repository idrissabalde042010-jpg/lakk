// Mise à jour automatique de Lakk (Tauri Updater v2).
//
// Règles :
// - jamais bloquant : la vérification se fait en arrière-plan ;
// - hors ligne / erreur réseau : on ignore silencieusement (aucun message) ;
// - l'application reste 100 % utilisable si la vérification échoue.
//
// Ce module est volontairement en `.ts` (et non `.svelte.ts`) : l'état est
// exposé via un store Svelte classique, utilisable avec `$updaterState`.

import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { get, writable } from 'svelte/store';

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdaterState {
  status: UpdaterStatus;
  /** Version proposée par le serveur, si une mise à jour existe. */
  version: string | null;
  /** Progression du téléchargement, de 0 à 100. */
  progress: number;
  /** Message d'erreur (uniquement pour une action manuelle). */
  error: string | null;
}

export const updaterState = writable<UpdaterState>({
  status: 'idle',
  version: null,
  progress: 0,
  error: null,
});

/** Mise à jour détectée, conservée entre la vérification et le téléchargement. */
let pendingUpdate: Update | null = null;
/** Évite deux vérifications simultanées. */
let checkInFlight: Promise<UpdaterState> | null = null;

function patch(partial: Partial<UpdaterState>): void {
  updaterState.update((state) => ({ ...state, ...partial }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Vérifie l'existence d'une mise à jour.
 *
 * @param options.silent `true` (défaut) : toute erreur est ignorée (démarrage).
 *                       `false` : l'erreur est exposée (bouton du profil).
 */
export async function checkForUpdates(
  options: { silent?: boolean } = {},
): Promise<UpdaterState> {
  const silent = options.silent ?? true;

  // Navigateur / aperçu web : l'updater natif n'existe pas.
  if (!isTauri()) return get(updaterState);

  // Hors ligne : on ne tente même pas la requête.
  if (offline()) {
    if (!silent) patch({ status: 'idle', version: null, progress: 0, error: 'offline' });
    return get(updaterState);
  }

  // Une mise à jour a déjà été trouvée : on la réutilise.
  if (pendingUpdate) {
    patch({ status: 'available', version: pendingUpdate.version, progress: 0, error: null });
    return get(updaterState);
  }

  if (checkInFlight) return checkInFlight;

  patch({ status: 'checking', error: null });

  checkInFlight = (async () => {
    try {
      const update = await check({ timeout: 15_000 });
      if (update) {
        pendingUpdate = update;
        patch({ status: 'available', version: update.version, progress: 0, error: null });
      } else {
        patch({ status: 'idle', version: null, progress: 0, error: null });
      }
    } catch (error) {
      // Silencieux au démarrage : pas de bannière, pas de blocage.
      // En manuel, l'erreur est seulement remontée au profil (pas de bannière).
      console.warn('[updater] vérification impossible :', error);
      patch({
        status: 'idle',
        version: null,
        progress: 0,
        error: silent ? null : errorMessage(error),
      });
    } finally {
      checkInFlight = null;
    }
    return get(updaterState);
  })();

  return checkInFlight;
}

/**
 * Télécharge et installe la mise à jour détectée, puis relance Lakk.
 * La progression est publiée dans `updaterState`.
 */
export async function downloadAndInstallUpdate(): Promise<void> {
  if (!isTauri()) return;

  const current = get(updaterState);
  if (current.status === 'downloading' || current.status === 'ready') return;

  if (!pendingUpdate) {
    await checkForUpdates({ silent: false });
  }

  const update = pendingUpdate;
  if (!update) {
    patch({ status: 'error', error: 'no-update' });
    return;
  }

  patch({ status: 'downloading', progress: 0, error: null });

  let downloaded = 0;
  let total = 0;

  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength ?? 0;
          patch({ progress: total > 0 ? 0 : 2 });
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          patch({
            progress:
              total > 0
                ? Math.min(99, Math.round((downloaded / total) * 100))
                : Math.min(90, get(updaterState).progress + 2),
          });
          break;
        case 'Finished':
          patch({ progress: 100, status: 'ready' });
          break;
      }
    });

    patch({ status: 'ready', progress: 100 });
    await relaunch();
  } catch (error) {
    console.error('[updater] échec de la mise à jour :', error);
    patch({ status: 'error', error: errorMessage(error) });
  }
}

/** Masque le bandeau sans supprimer la mise à jour détectée. */
export function dismissUpdate(): void {
  patch({ status: 'idle', error: null });
}

/** Version actuelle de l'application (fallback web pour le développement). */
export async function getCurrentVersion(): Promise<string> {
  if (!isTauri()) return '0.1.0';
  try {
    return await getVersion();
  } catch (error) {
    console.warn('[updater] version introuvable :', error);
    return '0.1.0';
  }
}
