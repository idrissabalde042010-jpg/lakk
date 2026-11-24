<script lang="ts">
  import Baobab from './Baobab.svelte';
  import { INTRO_STEPS, markIntroSeen } from '../lib/intro';
  import { startBgm } from '../lib/bgm.svelte';
  import { _ } from 'svelte-i18n';

  let { onDone }: { onDone: () => void } = $props();

  let step = $state(0);
  const current = $derived(INTRO_STEPS[step]);
  const last = $derived(step === INTRO_STEPS.length - 1);

  /** Titre traduit de l'étape courante. */
  const currentTitle = $derived($_( current.titleKey ));
  /** Texte traduit de l'étape courante. */
  const currentText = $derived($_( current.textKey ));
  /** CTA traduit de l'étape courante. */
  const currentCta = $derived($_( current.ctaKey ));

  /** Passe à l'étape suivante (et lance la musique au premier « Suivant »). */
  function next(): void {
    if (step === 0) startBgm();

    if (last) {
      markIntroSeen();
      onDone();
      return;
    }
    step += 1;
  }

  function back(): void {
    if (step === 0) return;
    step -= 1;
  }

  function skip(): void {
    markIntroSeen();
    onDone();
  }
</script>

<div class="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
  <div class="glow" aria-hidden="true"></div>

  <header class="intro-top">
    <span class="wordmark">Lakk</span>
    <button class="skip" type="button" onclick={skip}>{$_( 'intro.skip' )}</button>
  </header>

  <div class="mascot" aria-hidden="true">
    <div class="halo"></div>
    <Baobab streak={12} size={176} />
  </div>

  <div class="body">
    <div class="dots" aria-hidden="true">
      {#each INTRO_STEPS as _, i}
        <span class="dot" class:on={i <= step}></span>
      {/each}
    </div>

    {#key step}
      <div class="copy rise">
        <p class="eyebrow">{currentTitle}</p>
        <h1 id="intro-title">{currentText}</h1>
      </div>
    {/key}
  </div>

  <div class="actions">
    {#if last}
      <p class="music-note">{$_( 'intro.music_note' )}</p>
    {/if}
    {#if step > 0}
      <button class="btn ghost block" type="button" onclick={back}>{$_( 'intro.back' )}</button>
    {/if}
    <button class="btn orange block" type="button" onclick={next}>
      {currentCta}
    </button>
  </div>
</div>

<style>
  .intro {
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
  .glow {
    position: absolute;
    top: -80px;
    left: 50%;
    width: 320px;
    height: 320px;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 197, 49, 0.28), transparent 65%);
    pointer-events: none;
  }
  .intro-top {
    position: relative;
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
  .skip {
    border: 0;
    background: none;
    color: var(--muted);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    padding: 6px 4px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .mascot {
    position: relative;
    display: grid;
    place-items: center;
    margin: 12px 0 4px;
    min-height: 190px;
  }
  .halo {
    position: absolute;
    width: 210px;
    height: 210px;
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
    gap: 14px;
    z-index: 1;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 7px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--line);
    transition: background 0.25s ease, width 0.25s ease;
  }
  .dot.on {
    width: 22px;
    background: var(--orange);
  }
  .copy {
    text-align: center;
    padding: 0 4px;
  }
  .copy .eyebrow {
    color: var(--teal-deep);
    margin-bottom: 10px;
  }
  .copy h1 {
    font-size: 23px;
    line-height: 1.32;
    font-weight: 500;
    letter-spacing: -0.01em;
    max-width: 21em;
    margin: 0 auto;
  }
  .actions {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1;
  }
  .actions .btn {
    width: 100%;
  }
  .music-note {
    margin: 0 0 4px;
    text-align: center;
    font-size: 12px;
    color: var(--muted);
  }
  @keyframes breathe {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.08);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .halo {
      animation: none;
    }
  }
  @media (max-height: 700px) {
    .mascot {
      min-height: 150px;
      margin: 4px 0;
    }
    .mascot :global(svg) {
      width: 138px;
      height: 138px;
    }
    .copy h1 {
      font-size: 20px;
    }
  }
</style>