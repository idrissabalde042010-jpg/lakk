<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { setLocale, LEARN_LANGUAGES, type LearnLanguage } from '../lib/i18n';
  import { locale, _ } from 'svelte-i18n';

  let { onDone }: { onDone: () => void } = $props();

  // Langues d'interface disponibles
  const uiLanguages = [
    { code: 'fr', name: 'Français', native: 'Français' },
    { code: 'en', name: 'English', native: 'English' },
  ] as const;

  let selectedUiLang = $state<'fr' | 'en'>('fr');
  let selectedLearnLang = $state<'en' | 'es' | 'wo'>('en');

  // Applique la locale i18n quand la langue d'interface change
  $effect(() => {
    if (selectedUiLang) {
      setLocale(selectedUiLang);
    }
  });

  // Au montage, lit les préférences du profil
  onMount(() => {
    selectedUiLang = app.profile.uiLang;
    selectedLearnLang = app.profile.learnLang;
    // La locale i18n est déjà initialisée au démarrage de l'app
  });

  async function continueSetup(): Promise<void> {
    // Sauvegarde les choix dans le profil
    app.setUILang(selectedUiLang);
    app.setLearnLang(selectedLearnLang);
    onDone();
  }
</script>

<div class="lang-select rise">
  <header class="head">
    <span class="wordmark">Lakk</span>
  </header>

  <div class="mascot" aria-hidden="true">
    <div class="halo"></div>
    <svg viewBox="0 0 120 120" width="160" height="160" role="img" aria-label="Baobab">
      <ellipse cx="60" cy="108" rx="30" ry="5" fill="var(--line)" />
      <path d="M59 107 C57 92 55 80 57 66 C50 62 44 60 38 53 M60 66 C67 62 73 59 81 52" fill="none" stroke="var(--trunk)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M57 96 C54 88 52 84 48 80 M62 92 C66 86 69 83 73 80" fill="none" stroke="var(--trunk)" stroke-width="4" stroke-linecap="round" />
      <g fill="var(--leaf)">
        {#each [1,2,3,4,5,6,7,8,9,10,11,12,13,14] as _}
          <circle cx={50 + Math.random() * 20} cy={40 + Math.random() * 30} r={4 + Math.random() * 3} />
        {/each}
      </g>
    </svg>
  </div>

  <div class="body">
    <h1>{$_( 'language_select.title' )}</h1>
    <p class="subtitle">{$_( 'language_select.subtitle' )}</p>

    <div class="field">
      <label>{$_( 'language_select.ui_lang_label' )}</label>
      <div class="radio-group">
        {#each uiLanguages as lang}
          <label class="radio">
            <input type="radio" name="uiLang" bind:group={selectedUiLang} value={lang.code} />
            <span class="radio-label">
              <span class="radio-native">{lang.native}</span>
              <span class="radio-name">({lang.name})</span>
            </span>
          </label>
        {/each}
      </div>
    </div>

    <div class="field">
      <label>{$_( 'language_select.learn_lang_label' )}</label>
      <div class="radio-group">
        {#each LEARN_LANGUAGES as lang}
          <label class="radio" class:disabled={!lang.available}>
            <input
              type="radio"
              name="learnLang"
              bind:group={selectedLearnLang}
              value={lang.code}
              disabled={!lang.available}
            />
            <span class="radio-label">
              <span class="radio-native">{lang.name}</span>
              {#if !lang.available}
                <span class="soon">{$_( 'language_select.soon' )}</span>
              {:else}
                <span class="available">{$_( 'language_select.available' )}</span>
              {/if}
            </span>
          </label>
        {/each}
      </div>
    </div>
  </div>

  <div class="actions">
    <button class="btn orange block" type="button" onclick={continueSetup}>
      {$_( 'language_select.continue' )}
    </button>
  </div>
</div>

<style>
  .lang-select {
    position: absolute;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    padding: calc(18px + env(safe-area-inset-top)) 22px calc(22px + env(safe-area-inset-bottom));
    background:
      radial-gradient(120% 80% at 50% 0%, var(--orange-soft), transparent 60%),
      radial-gradient(90% 60% at 50% 100%, var(--teal-soft), transparent 65%),
      var(--paper);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 1;
  }
  .wordmark {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.02em;
    color: var(--orange);
  }
  .mascot {
    position: relative;
    display: grid;
    place-items: center;
    margin: 8px 0 4px;
    min-height: 180px;
  }
  .halo {
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(47, 163, 107, 0.18), transparent 70%);
    animation: breathe 5s ease-in-out infinite;
  }
  .body {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
    z-index: 1;
    padding: 0 8px;
  }
  .body h1 {
    margin: 0;
    text-align: center;
    font-size: 24px;
    line-height: 1.2;
  }
  .subtitle {
    margin: 0;
    text-align: center;
    color: var(--muted);
    font-size: 15px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .field label {
    font-weight: 600;
    color: var(--ink-soft);
    font-size: 14px;
  }
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .radio {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    border: 2px solid var(--line);
    background: var(--card);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .radio:hover {
    border-color: var(--orange);
    box-shadow: 0 4px 16px -4px var(--orange);
  }
  .radio:has(input:checked) {
    border-color: var(--orange);
    background: var(--orange-soft);
  }
  .radio.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .radio input {
    flex: none;
    width: 20px;
    height: 20px;
    accent-color: var(--orange);
  }
  .radio-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    font-size: 16px;
    color: var(--ink);
  }
  .radio-native {
    font-weight: 600;
  }
  .radio-name {
    font-size: 13px;
    color: var(--muted);
  }
  .soon, .available {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    width: fit-content;
  }
  .soon {
    background: var(--mango-soft);
    color: var(--mango-deep);
  }
  .available {
    background: var(--teal-soft);
    color: var(--teal-deep);
  }
  .actions {
    position: relative;
    z-index: 1;
    padding-top: 8px;
  }
  .actions .btn {
    width: 100%;
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.08); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .halo { animation: none; }
  }
  @media (max-height: 700px) {
    .mascot { min-height: 140px; }
    .mascot svg { width: 128px; height: 128px; }
    .body { gap: 16px; }
    .body h1 { font-size: 20px; }
  }
</style>