<script lang="ts">
  import { app } from '../lib/store.svelte';

  const tabs = [
    { id: 'home', label: 'Parcours' },
    { id: 'review', label: 'Réviser' },
    { id: 'games', label: 'Jouer' },
    { id: 'story', label: 'Conte' },
    { id: 'music', label: 'Musique' },
    { id: 'multiplayer', label: 'Multijoueur' },
    { id: 'profile', label: 'Profil' },
  ] as const;

  const due = $derived(app.dueCards().length);
</script>

<nav class="nav" aria-label="Navigation principale">
  {#each tabs as t}
    <button
      class="tab"
      class:active={app.screen === t.id}
      data-tour={t.id}
      onclick={() => app.setScreen(t.id)}
      aria-current={app.screen === t.id ? 'page' : undefined}
    >
      <span class="ico" aria-hidden="true">
        {#if t.id === 'home'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z" />
          </svg>
        {:else if t.id === 'review'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        {:else if t.id === 'games'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" />
            <path d="M6 10h12" />
            <path d="M10 6v12" />
            <path d="M6 14h.01" />
            <path d="M18 14h.01" />
            <path d="M14 18h.01" />
          </svg>
        {:else if t.id === 'story'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M12 12L2 7l10 5L22 7" />
          </svg>
        {:else if t.id === 'music'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        {:else if t.id === 'multiplayer'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        {/if}
      </span>
      <span class="lbl">{t.label}</span>
      {#if t.id === 'review' && due > 0}
        <span class="badge">{due}</span>
      {/if}
    </button>
  {/each}
</nav>

<style>
  .nav {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(84px + env(safe-area-inset-bottom));
    display: flex;
    align-items: stretch;
    background: var(--card);
    border-top: 1px solid var(--line);
    padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
    z-index: 20;
    flex-shrink: 0;
  }
  .tab {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 11.5px;
    cursor: pointer;
    border-radius: 14px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .tab .ico {
    width: 24px;
    height: 24px;
  }
  .tab .ico svg {
    width: 100%;
    height: 100%;
  }
  .tab.active {
    color: var(--teal);
    background: var(--teal-soft);
  }
  .badge {
    position: absolute;
    top: 4px;
    right: calc(50% - 24px);
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--rose);
    color: #fff;
    font-size: 10px;
    line-height: 17px;
    text-align: center;
    font-weight: 700;
  }
</style>
