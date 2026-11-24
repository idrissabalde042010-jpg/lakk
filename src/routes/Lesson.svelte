<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { answersMatch, loseEnergy } from '../lib/engine';
  import type { Grade, Exercise } from '../lib/engine';
  import { sfx, speak, isSpeechAvailable } from '../lib/audio';
  import { shuffle, shuffledIndices } from '../lib/shuffle';

  const ctx = app.active!;
  const lesson = app.lessonData(ctx.u, ctx.l);
  const total = lesson.exercises.length;
  const speechAvailable = $derived(isSpeechAvailable());

  let idx = $state(0);
  let selected = $state<number | null>(null);
  let picked = $state<number[]>([]);
  let typed = $state('');
  let phase = $state<'answer' | 'feedback'>('answer');
  let ok = $state(false);
  let correct = $state(0);
  let wrong = $state(0);
  let done = $state(false);
  let earnedXp = $state(0);
  let accuracy = $state(0);
  let shake = $state(false);
  let showHint = $state(false);

  // État pour le mélange des choix (stable pendant l'exercice, remélangé à chaque tentative)
  let shuffledChoiceIndices = $state<number[] | null>(null);
  let shuffledBankIndices = $state<number[] | null>(null);

  const ex: Exercise = $derived(lesson.exercises[idx]);

  // Helpers typés pour l'accès aux choix et banque de mots
  const getChoice = (idx: number): string => ex.choices?.[idx] ?? '';
  const getBankWord = (idx: number): string => ex.word_bank?.[idx] ?? '';

  // État pour le type d'exercice (mis à jour dans shuffleChoices)
  let isChoice = $state(false);
  let isBuild = $state(false);
  let isInput = $state(false);

  // Mélanger les indices des choix à chaque nouvel exercice / nouvelle tentative
  function shuffleChoices(): void {
    if (ex.choices && ex.choices.length > 1) {
      shuffledChoiceIndices = shuffledIndices(ex.choices.length);
      isChoice = true;
      isBuild = false;
      isInput = false;
    } else {
      shuffledChoiceIndices = null;
    }
    if (ex.word_bank && ex.word_bank.length > 1) {
      shuffledBankIndices = shuffledIndices(ex.word_bank.length);
      isBuild = ex.kind === 'translate' || ex.kind === 'order_words';
      isInput = ex.kind === 'fill_blank' || ex.kind === 'listen_type';
      isChoice = false;
    } else {
      shuffledBankIndices = null;
    }
    if (ex.kind === 'fill_blank' || ex.kind === 'listen_type') {
      isInput = true;
      isChoice = false;
      isBuild = false;
    }
  }

  // Appeler shuffleChoices quand l'exercice change ou qu'on réessaie
  $effect(() => {
    ex;
    phase;
    shuffleChoices();
  });

  const given = $derived(
    isChoice
      ? selected != null
        ? (shuffledChoiceIndices ? getChoice(shuffledChoiceIndices[selected]) : getChoice(selected)) ?? ''
        : ''
      : isBuild
        ? picked.map((i) => getBankWord(shuffledBankIndices?.[i] ?? i) ?? '').join(' ')
        : typed,
  );

  const canCheck = $derived(
    phase === 'answer' &&
      (isChoice ? selected != null : isBuild ? picked.length > 0 : typed.trim().length > 0),
  );

  const progress = $derived(Math.round((idx / total) * 100));

  function check(): void {
    if (!canCheck) return;
    ok = answersMatch(ex.answer, given, ex.accepted);
    if (ok) {
      correct += 1;
      sfx.correct();
    } else {
      wrong += 1;
      sfx.wrong();
      loseEnergy(app.profile);
      app.save();
      shake = true;
      window.setTimeout(() => (shake = false), 420);
    }
    if (ex.vocab) {
      const g: Grade = ok ? 3 : 1;
      void app.review(ex.vocab, g);
    }
    phase = 'feedback';
  }

  function next(): void {
    if (idx + 1 >= total) {
      finish();
      return;
    }
    idx += 1;
    selected = null;
    picked = [];
    typed = '';
    showHint = false;
    ok = false;
    phase = 'answer';
  }

  function finish(): void {
    earnedXp = correct * 10 + 20;
    accuracy = Math.round((correct / Math.max(1, correct + wrong)) * 100);
    app.completeLesson(ctx.u, ctx.l, earnedXp, accuracy);
    done = true;
    sfx.win();
  }

  function choose(i: number): void {
    if (phase !== 'answer') return;
    selected = i;
    sfx.tap();
  }
  function pickWord(i: number): void {
    if (phase !== 'answer' || picked.includes(i)) return;
    picked = [...picked, i];
    sfx.tap();
  }
  function unpick(i: number): void {
    if (phase !== 'answer') return;
    picked = picked.filter((x) => x !== i);
  }
  function hear(): void {
    speak(ex.vocab?.en ?? ex.answer);
  }
  function quit(): void {
    app.setScreen('home');
  }
</script>

<div class="lesson">
  <header class="lh">
    <button class="x" onclick={quit} aria-label="Quitter la leçon">✕</button>
    <div class="bar">
      <span style={`width:${progress}%`}></span>
    </div>
    <div class="energy" aria-label="Énergie">⚡ {app.profile.unlimitedEnergy ? '∞' : app.profile.energy}</div>
  </header>

  <div class="body" class:shake>
    <p class="eyebrow">Exercice {idx + 1} / {total}</p>

    {#if ex.kind === 'listen_type'}
      {#if speechAvailable}
        <button class="listen-big" onclick={hear}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          </svg>
          Écouter
        </button>
        <p class="prompt center">Écris ce que tu entends</p>
      {:else}
        <p class="prompt center muted">Écoute indisponible — écris la traduction</p>
      {/if}
    {:else}
      <h2 class="prompt">{ex.prompt}</h2>
      {#if ex.vocab && speechAvailable}
        <button class="speak" onclick={hear}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          </svg>
          Écouter
        </button>
      {:else if ex.vocab}
        <span class="speak muted" title="Audio indisponible" aria-label="Audio indisponible">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" />
          </svg>
          Audio indisponible
        </span>
      {/if}
    {/if}

    <div class="answer-zone">
      {#if isChoice}
        <div class="choices">
          {#if shuffledChoiceIndices && ex.choices}
            {#each shuffledChoiceIndices as choiceIdx, displayIdx}
              <button
                class="choice"
                class:sel={selected === choiceIdx}
                onclick={() => choose(choiceIdx)}
                disabled={phase !== 'answer'}
              >
                {getChoice(choiceIdx)}
              </button>
            {/each}
          {/if}
        </div>
      {:else if isBuild}
        <div class="tray" class:empty={picked.length === 0}>
          {#each picked as pi}
            <button class="word" onclick={() => unpick(pi)}>
              {getBankWord(shuffledBankIndices?.[pi] ?? pi)}
            </button>
          {/each}
          {#if picked.length === 0}
            <span class="placeholder">{ex.kind === 'order_words' ? 'Appuie sur les mots dans l\'ordre' : 'Traduis la phrase…'}</span>
          {/if}
        </div>
        <div class="bank">
          {#if shuffledBankIndices && ex.word_bank}
            {#each shuffledBankIndices as bankIdx, displayIdx}
              <button
                class="word bank-word"
                class:used={picked.includes(bankIdx)}
                onclick={() => pickWord(bankIdx)}
                disabled={picked.includes(bankIdx) || phase !== 'answer'}
              >
                {getBankWord(bankIdx)}
              </button>
            {/each}
          {/if}
        </div>
      {:else}
        <input
          class="input"
          bind:value={typed}
          placeholder="Écris ta réponse…"
          disabled={phase !== 'answer'}
          onkeydown={(e) => {
            if (e.key === 'Enter' && canCheck) check();
          }}
        />
        {#if showHint && ex.vocab}
          <p class="hint">Indice : {ex.vocab.fr}</p>
        {/if}
      {/if}
    </div>
  </div>

  {#if phase === 'answer'}
    <div class="footer">
      {#if isInput && ex.vocab}
        <button class="link" onclick={() => (showHint = !showHint)}>Besoin d’un indice ?</button>
      {/if}
      <button class="btn orange block" disabled={!canCheck} onclick={check}>Vérifier</button>
    </div>
  {:else}
    <div class="fb" class:good={ok} class:bad={!ok}>
      <div class="fb-text">
        <strong>{ok ? '✓ Bien joué !' : '✕ Presque !'}</strong>
        {#if !ok}<span>Bonne réponse : {ex.answer}</span>{/if}
      </div>
      <button class="btn block" class:orange={!ok} onclick={next}>
        {idx + 1 >= total ? 'Terminer' : 'Continuer'}
      </button>
    </div>
  {/if}
</div>

{#if done}
  <div class="overlay">
    <div class="complete rise">
      {#each Array(12) as _, i}
        <span class="confetti" style={`--i:${i}`}></span>
      {/each}
      <div class="medal">🌱</div>
      <h2>Leçon terminée !</h2>
      <p class="muted small">Ton baobab a grandi.</p>
      <div class="stats">
        <div><strong>+{earnedXp}</strong><span>graines</span></div>
        <div><strong>{accuracy}%</strong><span>précision</span></div>
        <div><strong>{app.profile.streakDays}</strong><span>jours</span></div>
      </div>
      <button class="btn block" onclick={() => app.setScreen('home')}>Continuer</button>
    </div>
  </div>
{/if}

<style>
  .lesson {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 0 16px;
  }
  .lh {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 0 10px;
  }
  .x {
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 50%;
    background: var(--line);
    color: var(--ink-soft);
    font-size: 15px;
    cursor: pointer;
    flex: none;
  }
  .bar {
    flex: 1;
    height: 12px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--mango), var(--orange));
    transition: width 0.4s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .energy {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--rose);
    font-size: 14px;
    flex: none;
  }
  .body {
    flex: 1;
    padding-top: 8px;
  }
  .prompt {
    font-size: 23px;
    line-height: 1.25;
    margin: 6px 0 4px;
  }
  .speak,
  .listen-big {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0 6px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 1.5px solid var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
  .speak svg,
  .listen-big svg {
    width: 18px;
    height: 18px;
  }
  .listen-big {
    margin: 16px auto;
    padding: 18px 26px;
    font-size: 17px;
    display: flex;
  }
  .answer-zone {
    margin-top: 18px;
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .choice {
    text-align: left;
    padding: 15px 16px;
    border-radius: 16px;
    border: 2px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease, transform 0.08s ease;
  }
  .choice:active {
    transform: scale(0.99);
  }
  .choice.sel {
    border-color: var(--orange);
    background: var(--orange-soft);
  }
  .tray {
    min-height: 60px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-content: flex-start;
    padding: 12px;
    border-bottom: 2px solid var(--line);
    margin-bottom: 14px;
  }
  .tray.empty {
    border-bottom-style: dashed;
  }
  .placeholder {
    color: var(--muted);
    font-size: 14px;
    align-self: center;
  }
  .bank {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .word {
    padding: 9px 13px;
    border-radius: 12px;
    border: 2px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 0 var(--line);
  }
  .word:active {
    transform: translateY(1px);
    box-shadow: none;
  }
  .bank-word.used {
    opacity: 0.3;
    pointer-events: none;
  }
  .input {
    width: 100%;
    padding: 15px 16px;
    border-radius: 16px;
    border: 2px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 17px;
    outline: none;
  }
  .input:focus {
    border-color: var(--orange);
  }
  .hint {
    margin-top: 10px;
    font-size: 13px;
    color: var(--muted);
  }
  .footer,
  .fb {
    position: sticky;
    bottom: 0;
    padding: 14px 0 calc(14px + env(safe-area-inset-bottom));
    background: linear-gradient(to top, var(--paper) 70%, transparent);
  }
  .link {
    display: block;
    margin: 0 auto 10px;
    background: none;
    border: 0;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .fb {
    margin: 0 -16px;
    padding: 16px;
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fb.good {
    background: var(--teal-soft);
  }
  .fb.bad {
    background: var(--rose-soft);
  }
  .fb-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .fb.good .fb-text strong {
    color: var(--teal-deep);
  }
  .fb.bad .fb-text strong {
    color: var(--rose);
  }
  .fb-text span {
    font-size: 14px;
    color: var(--ink-soft);
  }
  .shake {
    animation: shake 0.4s ease;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-7px); }
    40% { transform: translateX(7px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  /* -------- écran de fin -------- */
  .overlay {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--ink) 55%, transparent);
    backdrop-filter: blur(3px);
    display: grid;
    place-items: center;
    padding: 24px;
    z-index: 60;
  }
  .complete {
    position: relative;
    width: 100%;
    max-width: 340px;
    background: var(--card);
    border-radius: 26px;
    padding: 26px 22px 20px;
    text-align: center;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .medal {
    font-size: 44px;
    line-height: 1;
    margin-bottom: 8px;
  }
  .complete > :not(.confetti) {
    position: relative;
    z-index: 1;
  }
  .complete h2 {
    font-size: 24px;
  }
  .stats {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 20px 0;
  }
  .stats div {
    flex: 1;
    background: var(--paper);
    border-radius: 14px;
    padding: 12px 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stats strong {
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--teal);
  }
  .stats span {
    font-size: 11px;
    color: var(--muted);
  }
  .confetti {
    position: absolute;
    top: -10px;
    left: calc(var(--i) * 8.3%);
    width: 8px;
    height: 12px;
    border-radius: 2px;
    background: hsl(calc(var(--i) * 30), 80%, 55%);
    animation: fall 1.4s ease-in both;
    animation-delay: calc(var(--i) * 40ms);
    z-index: 0;
    pointer-events: none;
  }
  @keyframes fall {
    from { transform: translateY(-20px) rotate(0); opacity: 1; }
    to { transform: translateY(320px) rotate(400deg); opacity: 0; }
  }
</style>
