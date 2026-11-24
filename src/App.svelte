<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/store.svelte';
  import { locale, setLocale } from './lib/i18n';
  import Home from './routes/Home.svelte';
  import Lesson from './routes/Lesson.svelte';
  import Review from './routes/Review.svelte';
  import Games from './routes/Games.svelte';
  import Music from './routes/Music.svelte';
  import Profile from './routes/Profile.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import IntroStory from './components/IntroStory.svelte';
  import LanguageSelect from './components/LanguageSelect.svelte';
  import { maybeStartTour } from './lib/guidedTour';
  import { introSeen } from './lib/intro';
  import { check } from '@tauri-apps/plugin-updater';
import type { Update } from '@tauri-apps/plugin-updater';

  // État des écrans d'onboarding
  let showLanguageSelect = $state(!introSeen() && !app.profile.uiLang);
  let showIntro = $derived(app.introOpen || (!introSeen() && app.profile.uiLang));

  // État pour la mise à jour
  let updateAvailable = $state(false);
  let updateDownloading = $state(false);
  let updateProgress = $state(0);
  let updateError = $state<string | null>(null);

  // Initialise la locale i18n depuis le profil au démarrage
  onMount(() => {
    if (app.profile.uiLang) {
      setLocale(app.profile.uiLang);
    }
  });

  // Reset scroll position when screen changes
  $effect(() => {
    app.screen; // subscribe to screen changes
    const screen = document.querySelector('.screen');
    if (screen) screen.scrollTo(0, 0);
  });

  // Visite guidée : au premier lancement, ou juste après l'histoire.
  onMount(() => {
    if (!app.introOpen && introSeen()) maybeStartTour();
  });

  // Vérification de mise à jour 5 secondes après le lancement
  onMount(() => {
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (update) {
          updateAvailable = true;
        }
      } catch (e) {
        console.warn('[Updater] Erreur vérification mise à jour:', e);
      }
    }, 5000);
    return () => clearTimeout(timer);
  });

  async function downloadAndInstallUpdate(): Promise<void> {
    updateDownloading = true;
    updateProgress = 0;
    updateError = null;

    try {
      const update = await check();
      if (!update) {
        updateError = 'Aucune mise à jour disponible';
        updateDownloading = false;
        return;
      }

      await update.downloadAndInstall((event) => {
        if (event && event.event === 'Progress') {
          updateProgress = Math.min(100, updateProgress + 5); // Approximation
        } else if (event && event.event === 'Started' && event.data.contentLength) {
          // Started downloading
        }
      });

      // Sur macOS/Linux, il faut relancer l'app manuellement
      // Sur Windows, l'installateur gère le redémarrage
    } catch (e) {
      updateError = e instanceof Error ? e.message : 'Erreur lors de la mise à jour';
      updateDownloading = false;
    }
  }

  function dismissUpdate(): void {
    updateAvailable = false;
  }

  function finishLanguageSelect(): void {
    showLanguageSelect = false;
    // Si l'intro n'a pas été vue, on l'affiche ensuite
    if (!introSeen()) {
      app.openIntro();
    }
  }

  function finishIntro(): void {
    app.closeIntro();
    maybeStartTour(500);
  }
</script>

<div class="phone">
  {#if updateAvailable && !updateDownloading}
    <div class="update-banner" role="alert">
      <div class="update-info">
        <span class="update-icon">🔄</span>
        <span class="update-text">Une nouvelle version de Lakk est disponible.</span>
      </div>
      <div class="update-actions">
        <button class="btn ghost" onclick={dismissUpdate}>Plus tard</button>
        <button class="btn orange" onclick={downloadAndInstallUpdate}>Mettre à jour</button>
      </div>
    </div>
  {/if}

  {#if updateDownloading}
    <div class="update-banner downloading" role="status" aria-live="polite">
      <div class="update-info">
        <span class="update-icon">⬇</span>
        <span class="update-text">Téléchargement de la mise à jour… {updateProgress}%</span>
      </div>
      <div class="update-progress-bar">
        <div class="update-progress-fill" style="width: {updateProgress}%"></div>
      </div>
      {#if updateError}
        <div class="update-error">{updateError}</div>
      {/if}
    </div>
  {/if}

  {#if showLanguageSelect}
    <LanguageSelect onDone={finishLanguageSelect} />
  {:else if showIntro}
    <IntroStory onDone={finishIntro} />
  {:else}
    <main class="screen" class:no-nav={app.screen === 'lesson'}>
      {#if app.screen === 'home'}
        <Home />
      {:else if app.screen === 'lesson'}
        <Lesson />
      {:else if app.screen === 'review'}
        <Review />
      {:else if app.screen === 'games'}
        <Games />
      {:else if app.screen === 'music'}
        <Music />
      {:else}
        <Profile />
      {/if}
    </main>

    {#if app.screen !== 'lesson'}
      <BottomNav />
    {/if}

    {#if app.toast}
      <div class="toast">{app.toast}</div>
    {/if}
  {/if}
</div>

<style>
  .toast {
    position: absolute;
    left: 50%;
    bottom: calc(84px + 16px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--paper);
    padding: 10px 16px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    z-index: 50;
    animation: rise 0.25s ease both;
    white-space: nowrap;
  }

  /* --- Update Banner --- */
  .update-banner {
    position: absolute;
    top: calc(16px + env(safe-area-inset-top));
    left: 16px;
    right: 16px;
    z-index: 100;
    background: var(--card);
    border: 1.5px solid var(--orange);
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    animation: slideDown 0.3s ease both;
  }
  .update-banner.downloading {
    border-color: var(--teal);
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .update-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .update-icon {
    font-size: 20px;
    flex: none;
  }
  .update-text {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
  }
  .update-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .update-progress-bar {
    height: 6px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }
  .update-progress-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--teal), var(--orange));
    transition: width 0.3s ease;
  }
  .update-error {
    margin-top: 8px;
    font-size: 12px;
    color: var(--rose);
  }
</style>