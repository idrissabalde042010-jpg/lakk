<script lang="ts">
  import Baobab from './Baobab.svelte';
  import { INTRO_STEPS, markIntroSeen } from '../lib/intro';
  import { startBgm } from '../lib/bgm.svelte';
  import { speak, cancelSpeech } from '../lib/audio';
  import { _ } from 'svelte-i18n';

  let { onDone }: { onDone: () => void } = $props();

  let step = $state(0);
  const current = $derived(INTRO_STEPS[step]);
  const last = $derived(step === INTRO_STEPS.length - 1);
  let speaking = $state(false);

  /** Timeout de sécurité max (10 s) pour éviter le blocage sur Linux/WebKitGTK. */
  const SPEAK_TIMEOUT_MS = 10_000;

  /** Langue TTS selon la langue d'interface (fr-FR ou en-US) */
  const ttsLang = $derived(
    (typeof document !== 'undefined' && document.documentElement.lang === 'en') ? 'en-US' : 'fr-FR'
  );

  /** Titre traduit de l'étape courante. */
  const currentTitle = $derived($_( current.titleKey ));
  /** Texte traduit de l'étape courante. */
  const currentText = $derived($_( current.textKey ));
  /** CTA traduit de l'étape courante. */
  const currentCta = $derived($_( current.ctaKey ));

  /** Lit l'étape courante avec timeout de sécurité. */
  async function readStep(): Promise<void> {
    if (speaking) return;
    speaking = true;

    // Lance la lecture (speak gère déjà le fallback Rust/espeak)
    const speakPromise = speak(currentText, ttsLang);

    // Timeout de sécurité : si speak ne résout pas dans les 10 s, on débloque
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (speaking) {
          console.warn('[IntroStory] timeout speak → déblocage forcé');
          speaking = false;
        }
        resolve();
      }, SPEAK_TIMEOUT_MS);
    });

    await Promise.race([speakPromise, timeoutPromise]);
    speaking = false;
  }

  /** Bouton "Écouter" manuel : relit l'étape courante. */
  async function replayStep(): Promise<void> {
    if (speaking) {
      cancelSpeech();
      speaking = false;
      // Attendre un peu pour que cancelSpeech prenne effet
      await new Promise(r => setTimeout(r, 50));
    }
    await readStep();
  }

  /** Passe à l'étape suivante (et lance la musique au premier « Suivant »). */
  async function next(): Promise<void> {
    // Si on clique pendant la lecture : on coupe la voix et on passe à la suite
    if (speaking) {
      cancelSpeech();
      speaking = false;
    }

    if (step === 0) startBgm();

    if (last) {
      markIntroSeen();
      onDone();
      return;
    }
    step += 1;
    await readStep();
  }

  function back(): void {
    if (step === 0) return;
    // Coupe la voix en cours si on revient en arrière
    if (speaking) {
      cancelSpeech();
      speaking = false;
    }
    step -= 1;
  }

  async function skip(): Promise<void> {
    cancelSpeech();
    markIntroSeen();
    onDone();
  }

  // Lecture automatique de la première étape au montage
  let mounted = $state(false);
  $effect(() => {
    if (!mounted) {
      mounted = true;
      readStep();
    }
  });

  // Re-lire si l'étape change (et qu'on ne lit pas déjà)
  $effect(() => {
    if (mounted && !speaking) {
      readStep();
    }
  });

  // Re-lire si la langue change
  $effect(() => {
    if (mounted && !speaking) {
      ttsLang; // subscribe
      readStep();
    }
  });
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
        <div class="text-with-speaker">
          <h1 id="intro-title">{currentText}</h1>
          <button
            class="speaker-btn"
            type="button"
            onclick={replayStep}
            aria-label={$_( 'intro.speak_again' )}
            disabled={speaking}
          >
            {speaking ? '⏳' : '🔊'}
          </button>
        </div>
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
      {speaking ? '…' : currentCta}
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
  .text-with-speaker {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 10px;
    max-width: 21em;
    margin: 0 auto;
  }
  .copy h1 {
    font-size: 23px;
    line-height: 1.32;
    font-weight: 500;
    letter-spacing: -0.01em;
    flex: 1;
    text-align: left;
  }
  .speaker-btn {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid var(--line);
    background: var(--card);
    font-size: 20px;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .speaker-btn:hover:not(:disabled) {
    border-color: var(--orange);
    background: var(--orange-soft);
    transform: scale(1.05);
  }
  .speaker-btn:active:not(:disabled) {
    transform: scale(0.95);
  }
  .speaker-btn:disabled {
    opacity: 0.5;
    cursor: wait;
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
    .text-with-speaker {
      max-width: 18em;
    }
  }
</style>