<script lang="ts">
  import { app } from './lib/store.svelte';
  import Home from './routes/Home.svelte';
  import Lesson from './routes/Lesson.svelte';
  import Review from './routes/Review.svelte';
  import Games from './routes/Games.svelte';
  import Music from './routes/Music.svelte';
  import Profile from './routes/Profile.svelte';
  import BottomNav from './components/BottomNav.svelte';

  // Reset scroll position when screen changes
  $effect(() => {
    app.screen; // subscribe to screen changes
    const screen = document.querySelector('.screen');
    if (screen) screen.scrollTo(0, 0);
  });
</script>

<div class="phone">
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
