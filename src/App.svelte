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
</style>