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
  import Multiplayer from './routes/Multiplayer.svelte';
  import Story from './routes/Story.svelte';
  import Express from './routes/Express.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import IntroStory from './components/IntroStory.svelte';
  import LanguageSelect from './components/LanguageSelect.svelte';
  import { maybeStartTour } from './lib/guidedTour';
  import { introSeen } from './lib/intro';
  import { _ } from 'svelte-i18n';
  import {
    updaterState,
    checkForUpdates,
    downloadAndInstallUpdate,
    dismissUpdate,
  } from './lib/updater';

  // État des écrans d'onboarding
  let showLanguageSelect = $state(!introSeen() && !app.profile.uiLang);
  let showIntro = $derived(app.introOpen || (!introSeen() && app.profile.uiLang));

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

  // Vérification en arrière-plan, sans bloquer l'interface.
  // Toute erreur réseau est ignorée silencieusement (l'app reste utilisable hors ligne).
  onMount(() => {
    const timer = setTimeout(() => {
      void checkForUpdates({ silent: true });
    }, 3000);
    return () => clearTimeout(timer);
  });

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
  {#if $updaterState.status === 'available'}
    <div class="update-banner" role="alert">
      <div class="update-info">
        <span class="update-icon">🔄</span>
        <span class="update-text">
          {$_('updater.available', { values: { version: $updaterState.version ?? '' } })}
        </span>
      </div>
      <div class="update-actions">
        <button class="btn ghost" onclick={dismissUpdate}>{$_('updater.later')}</button>
        <button class="btn orange" onclick={downloadAndInstallUpdate}>{$_('updater.update')}</button>
      </div>
    </div>
  {/if}

  {#if $updaterState.status === 'downloading' || $updaterState.status === 'ready'}
    <div class="update-banner downloading" role="status" aria-live="polite">
      <div class="update-info">
        <span class="update-icon">⬇</span>
        <span class="update-text">
          {$updaterState.status === 'ready'
            ? $_('updater.ready')
            : $_('updater.downloading', { values: { progress: Math.round($updaterState.progress) } })}
        </span>
      </div>
      <div class="update-progress-bar">
        <div class="update-progress-fill" style="width: {$updaterState.progress}%"></div>
      </div>
    </div>
  {/if}

  {#if $updaterState.status === 'error' && $updaterState.error}
    <div class="update-banner error" role="alert">
      <div class="update-info">
        <span class="update-icon">⚠</span>
        <span class="update-text">{$_('updater.error')} : {$updaterState.error}</span>
      </div>
      <div class="update-actions">
        <button class="btn ghost" onclick={dismissUpdate}>{$_('common.close')}</button>
      </div>
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
      {:else if app.screen === 'multiplayer'}
        <Multiplayer />
      {:else if app.screen === 'story'}
        <Story />
      {:else if app.screen === 'express'}
        <Express />
      {:else}
        <Profile />
      {/if}
    </main>

    {#if app.screen !== 'lesson' && app.screen !== 'express'}
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
  .update-banner.error {
    border-color: var(--rose);
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
</style>