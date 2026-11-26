<script lang="ts">
  import { app } from '../lib/store.svelte';
  import type { Card, Grade } from '../lib/engine';
  import { mastery, weakCards as computeWeakCards } from '../lib/engine';
  import { speak, isSpeechAvailable } from '../lib/audio';
  import { shuffle, shuffledIndices } from '../lib/shuffle';
  import {
    extractPhrases,
    marketExerciseFor,
    type MarketExercise,
  } from '../lib/phrases';

  let due = $state<Card[]>(app.dueCards());
  let weakCards = $state<Card[]>([]);
  let weakMode = $state(false);
  let revealed = $state(false);
  let reviewed = $state(0);
  const speechAvailable = $derived(isSpeechAvailable());

  const activeCards = $derived(weakMode ? weakCards : due);
  const current = $derived(activeCards[0]);
  const total = $derived(app.cardCount());
  const remaining = $derived(activeCards.length);

  // Marché des Phrases : exercices de cloze/construction à partir des phrases du cours.
  const marketPhrases = $derived(extractPhrases(app.course));
  const marketTarget = $derived(weakCards.length > 0 ? weakCards[0].vocab.en : null);
  const marketExercise = $derived(
    marketTarget && marketPhrases.length > 0
      ? marketExerciseFor(marketTarget, marketPhrases)
      : undefined,
  );

  let marketAnswer = $state('');
  let marketRevealed = $state(false);
  let marketOk = $state(false);

  const grades: { g: Grade; label: string; cls: string }[] = [
    { g: 1, label: 'Encore', cls: 'rose' },
    { g: 2, label: 'Difficile', cls: 'mango' },
    { g: 3, label: 'Bien', cls: 'teal' },
    { g: 4, label: 'Facile', cls: 'blue' },
  ];

  // Indices mélangés pour les boutons de note (remélangés à chaque carte)
  let shuffledGradeIndices = $state<number[]>([]);

  function shuffleGrades(): void {
    shuffledGradeIndices = shuffledIndices(grades.length);
  }

    $effect(() => {
    weakCards = computeWeakCards(Object.values(app.data.cards));
  });

  function toggleWeakMode(): void {
    weakMode = !weakMode;
    revealed = false;
    reviewed = 0;
    shuffleGrades();
  }

  function reveal(): void {
    revealed = true;
    if (current && speechAvailable) speak(current.vocab.en);
  }

  async function grade(g: Grade): Promise<void> {
    if (!current) return;
    await app.review(current.vocab, g);
    reviewed += 1;
    revealed = false;
    due = app.dueCards();
    weakCards = computeWeakCards(Object.values(app.data.cards));
    shuffleGrades();
  }

  // Mélanger au premier affichage et après chaque réponse
  $effect(() => {
    due;
    weakCards;
    shuffleGrades();
  });

  // --- Marché des Phrases ---
  function revealMarket(): void {
    marketRevealed = true;
    if (marketExercise && speechAvailable) speak(marketExercise.phrase);
  }

  function checkMarket(): void {
    if (!marketExercise || marketRevealed) return;
    const given = marketAnswer.trim();
    if (marketExercise.kind === 'cloze') {
      marketOk = given.toLowerCase() === (marketExercise.target ?? '').toLowerCase();
    } else if (marketExercise.kind === 'construction') {
      marketOk =
        given
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s']/gu, ' ')
          .split(/\s+/)
          .filter(Boolean)
          .join(' ') ===
        marketExercise.phrase.toLowerCase();
    } else {
      marketOk = given.length > 0;
    }
    marketRevealed = true;
    if (marketOk && speechAvailable) speak(marketExercise.phrase);
  }

  function resetMarket(): void {
    marketAnswer = '';
    marketRevealed = false;
    marketOk = false;
  }
</script>

<div class="review rise">
  <header class="head">
    <p class="eyebrow">Mémoire FSRS</p>
    <h1>Réviser</h1>
    <p class="small muted">
      {#if weakMode}
        {remaining} mot{remaining > 1 ? 's' : ''} faible{remaining > 1 ? 's' : ''} à réviser · {total} en mémoire
      {:else if remaining > 0}
        {remaining} carte{remaining > 1 ? 's' : ''} à revoir · {total} en mémoire
      {:else}
        {total} mot{total > 1 ? 's' : ''} en mémoire
      {/if}
    </p>
    {#if weakCards.length > 0}
      <button class="mini-btn" class:on={weakMode} onclick={toggleWeakMode} aria-label={weakMode ? 'Quitter le mode mots faibles' : 'Activer le mode mots faibles'}>
        {weakMode ? '🔙 Tous les mots' : `🎯 ${weakCards.length} mots faibles`}
      </button>
    {/if}
  </header>

  {#if !current}
    <div class="empty card">
      <div class="empty-badge">✓</div>
      <h2>Tout est à jour</h2>
      <p class="small muted">
        Ta mémoire est fraîche. Reviens plus tard : Lakk te montrera les mots juste avant que tu
        les oublies.
      </p>
      <button class="btn block" onclick={() => app.setScreen('home')}>Retour au parcours</button>
    </div>
  {:else}
    <div class="card flip">
      <p class="eyebrow">Mot {reviewed + 1}</p>
      <p class="front">{current.vocab.fr}</p>
      {#if revealed}
        <div class="answer">
          <p class="en">{current.vocab.en}</p>
          <button
            class="speak"
            type="button"
            onclick={() => speak(current.vocab.en)}
            aria-label={`Écouter ${current.vocab.en}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            </svg>
            🔊 Réécouter
          </button>
        </div>
      {:else}
        <button class="btn block reveal-btn" onclick={reveal}>Afficher la réponse</button>
      {/if}
      <p class="mastery small muted">Maîtrise : {mastery(current).label}</p>
    </div>

    {#if revealed}
      <div class="grades">
        {#each shuffledGradeIndices as gradeIdx}
          <button class="grade {grades[gradeIdx].cls}" onclick={() => grade(grades[gradeIdx].g)}>
            <span class="dot"></span>
            {grades[gradeIdx].label}
          </button>
        {/each}
      </div>
      <p class="hint small muted center">Choisis selon la difficulté ressentie : le planning s'adapte.</p>
    {:else}
      <p class="hint small muted center">
        Essaie de te souvenir avant de révéler — c’est ce qui fait progresser.
      </p>
    {/if}
  {/if}

  <!-- Marché des Phrases : cloze & construction sur un mot faible -->
  {#if marketExercise && marketPhrases.length > 0}
    <section class="card market">
      <p class="eyebrow">Marché des phrases</p>
      <p class="small muted">Mot du jour : {marketTarget}</p>

      {#if marketExercise.kind === 'cloze'}
        <p class="market-body">{marketExercise.body}</p>
        {#if marketRevealed}
          <p class="result">{marketOk ? '✓ Bien joué !' : '✕ Le mot était : ' + (marketExercise.target ?? '')}</p>
        {:else}
          <input
            class="input"
            bind:value={marketAnswer}
            placeholder="Le mot manquant…"
            onkeydown={(e) => e.key === 'Enter' && checkMarket()}
          />
          <div class="market-actions">
            <button class="btn block" onclick={checkMarket} disabled={!marketAnswer.trim()}>
              Vérifier
            </button>
            <button class="btn ghost block" onclick={revealMarket}>Afficher la réponse</button>
          </div>
        {/if}

      {:else if marketExercise.kind === 'construction'}
        <p class="market-body">Remettez les mots dans l’ordre :</p>
        <div class="word-bank">
          {#each marketExercise.body.split(' ') as w}
            <button class="bank-word" onclick={() => { marketAnswer = marketAnswer ? `${marketAnswer} ${w}` : w; }}>
              {w}
            </button>
          {/each}
        </div>
        {#if marketRevealed}
          <p class="result">{marketOk ? '✓ Bien joué !' : '✕ La phrase était : ' + marketExercise.phrase}</p>
        {:else}
          <input class="input" bind:value={marketAnswer} placeholder="Ta phrase…" />
          <div class="market-actions">
            <button class="btn block" onclick={checkMarket} disabled={!marketAnswer.trim()}>
              Vérifier
            </button>
            <button class="btn ghost block" onclick={revealMarket}>Afficher la réponse</button>
          </div>
        {/if}

      {:else}
        <p class="market-body">{marketExercise.phrase}</p>
        <p class="small muted">Écoutez la phrase et répétez-la à voix haute.</p>
        <button class="btn block" onclick={revealMarket}>🔊 Écouter la phrase</button>
      {/if}

      <button class="btn ghost block" onclick={resetMarket} style="margin-top:8px">
        Autre phrase
      </button>
    </section>
  {/if}
</div>

<style>
  .review {
    padding: 0 16px 20px;
  }
  .head {
    padding: 20px 0 16px;
  }
  .head h1 {
    margin: 2px 0 4px;
  }
  .flip {
    margin-top: 6px;
    text-align: center;
    padding: 26px 20px;
  }
  .front {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 600;
    margin: 14px 0 20px;
    line-height: 1.15;
  }
  .answer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: rise 0.3s ease both;
  }
  .en {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 600;
    color: var(--teal);
  }
  .speak {
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1.5px solid var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
    border-radius: 12px;
    padding: 8px 14px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .speak svg {
    width: 17px;
    height: 17px;
  }
  .reveal-btn {
    background: var(--teal);
    box-shadow: 0 4px 0 var(--teal-deep);
  }
  .mastery {
    margin-top: 16px;
  }
  .grades {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }
  .grade {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    padding: 13px;
    border-radius: 14px;
    border: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    color: #fff;
    cursor: pointer;
    transition: transform 0.08s ease;
  }
  .grade:active {
    transform: translateY(2px);
  }
  .grade .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
  }
  .grade.rose {
    background: var(--rose);
  }
  .grade.mango {
    background: var(--mango);
    color: var(--ink);
  }
  .grade.mango .dot {
    background: var(--ink);
  }
  .grade.teal {
    background: var(--teal);
  }
  .grade.blue {
    background: var(--blue);
  }
  .hint {
    margin-top: 12px;
    line-height: 1.4;
  }
  .empty {
    margin-top: 6px;
    text-align: center;
    padding: 30px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }
  .empty-badge {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--teal-soft);
    color: var(--teal);
    display: grid;
    place-items: center;
    font-size: 30px;
    font-weight: 700;
  }
  .empty .btn {
    margin-top: 8px;
    background: var(--blue);
    box-shadow: 0 4px 0 #2648b8;
  }
  .mini-btn {
    padding: 7px 14px;
    border-radius: 10px;
    border: 1.5px solid var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .mini-btn:active {
    transform: scale(0.97);
  }
  .mini-btn.on {
    border-color: var(--mango);
    background: var(--mango-soft);
    color: var(--mango-deep);
  }
  .market {
    margin-top: 14px;
    padding: 20px;
  }
  .market-body {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    text-align: center;
    margin: 14px 0 14px;
    color: var(--ink);
  }
  .word-bank {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin: 10px 0 14px;
  }
  .bank-word {
    padding: 8px 14px;
    border-radius: 10px;
    border: 1.5px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
  }
  .bank-word:active {
    background: var(--orange-soft);
  }
  .market-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
  .result {
    font-size: 13px;
    font-weight: 600;
    margin-top: 6px;
    text-align: center;
  }
  .input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: 2px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 16px;
    margin-bottom: 8px;
  }
  .input:focus {
    outline: none;
    border-color: var(--orange);
  }
</style>
