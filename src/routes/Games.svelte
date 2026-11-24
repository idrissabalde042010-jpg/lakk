<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { sfx, speak } from '../lib/audio';
  import {
    newGame,
    generateRound,
    checkGameAnswer,
    completeRound,
    calculateGameXP,
    ALL_GAMES,
    GAME_LABELS,
    type GameSession,
    type GameRound,
    type GameType,
  } from '../lib/games';
  import { shuffle } from '../lib/shuffle';

  let selectedGame = $state<GameType | null>(null);
  let session = $state<GameSession | null>(null);
  let round = $state<GameRound | null>(null);
  let answer = $state('');
  let showResult = $state(false);
  let roundCorrect = $state(false);
  let wordBuilderInput = $state('');

  const learnedCount = $derived(Object.keys(app.data.cards).length);

  function startGame(type: GameType): void {
    selectedGame = type;
    session = newGame(type);
    sfx.tap();
    nextRound();
  }

  function nextRound(): void {
    if (!session) return;
    round = generateRound(session);
    answer = '';
    wordBuilderInput = '';
    showResult = false;
  }

  function submitAnswer(): void {
    if (!session || !round || showResult) return;

    let userAnswer = answer;
    if (session.type === 'word_builder') userAnswer = wordBuilderInput;
    if (session.type === 'memory' && round.metadata?.phase === 'memorize') {
      // Phase de mémorisation : passer au premier vrai round
      round = generateRound(session);
      return;
    }

    roundCorrect = checkGameAnswer(session, userAnswer, round);
    completeRound(session, roundCorrect);
    showResult = true;

    if (session.completed) {
      // Jeu fini : donner l'XP
      app.completeLesson(99, 99, session.xpEarned, 100);
    }
  }

  function continueGame(): void {
    if (!session) return;
    if (session.completed) {
      selectedGame = null;
      session = null;
    } else {
      nextRound();
    }
  }

  // Pour Word Builder
  function addLetter(letter: string): void {
    if (session?.type === 'word_builder' && !showResult) {
      wordBuilderInput += letter;
      sfx.tap();
    }
  }
  function removeLetter(): void {
    if (session?.type === 'word_builder' && !showResult) {
      wordBuilderInput = wordBuilderInput.slice(0, -1);
      sfx.tap();
    }
  }
  function clearWordBuilder(): void {
    wordBuilderInput = '';
  }

  // Pour Sentence Scramble
  function addWord(word: string): void {
    if (session?.type === 'sentence_scramble' && !showResult) {
      answer = answer ? `${answer} ${word}` : word;
      sfx.tap();
    }
  }
  function removeWord(): void {
    if (session?.type === 'sentence_scramble' && !showResult) {
      const words = answer.split(' ');
      words.pop();
      answer = words.join(' ');
      sfx.tap();
    }
  }
  function clearSentence(): void {
    answer = '';
  }

  function speakRound(): void {
    if (round?.audioText) speak(round.audioText);
  }
</script>

<div class="games rise">
  {#if !selectedGame}
    <!-- Sélection du jeu -->
    <header class="head">
      <h1>🎮 Jeux</h1>
      <p class="small muted">{learnedCount} mots appris — débloque plus de variété !</p>
    </header>

    <div class="games-grid">
      {#each ALL_GAMES as type}
        <button class="game-card" onclick={() => startGame(type)}>
          <span class="game-icon">{GAME_LABELS[type].icon}</span>
          <h3>{GAME_LABELS[type].name}</h3>
          <p class="small muted">{GAME_LABELS[type].desc}</p>
          <span class="game-tag">{type === 'memory' ? 'Mémoire' : type === 'speed_match' ? 'Vitesse' : type === 'word_builder' ? 'Écriture' : type === 'listening' ? 'Écoute' : type === 'sentence_scramble' ? 'Grammaire' : 'Orthographe'}</span>
        </button>
      {/each}
    </div>

    <p class="footer-note">Gratuit, sans pub, hors ligne.</p>

  {:else}
    <!-- Jeu en cours -->
    <header class="head">
      <button class="x" onclick={() => { selectedGame = null; session = null; sfx.tap(); }} aria-label="Quitter">✕</button>
      <div class="game-header-info">
        <span class="game-icon">{GAME_LABELS[selectedGame!].icon}</span>
        <div>
          <h3>{GAME_LABELS[selectedGame!].name}</h3>
          <p class="small muted">Round {(session?.round ?? 0) + 1} / {session?.maxRounds ?? 10}</p>
        </div>
      </div>
      <div class="score">⭐ {session?.score ?? 0}</div>
    </header>

    {#if session && round}
      <div class="game-area">
        {#if session.type === 'memory' && round.metadata?.phase === 'memorize'}
          <div class="memory-memorize">
            <p class="eyebrow">Mémorise ces paires (3 secondes)</p>
            <div class="pairs-grid">
              {#each (round.metadata as { pairs: Array<{en: string; fr: string}> }).pairs as pair}
                <div class="pair-card">
                  <strong>{pair.en}</strong>
                  <span class="small muted">{pair.fr}</span>
                </div>
              {/each}
            </div>
            <button class="btn orange block" onclick={nextRound}>J\'ai mémorisé</button>
          </div>
        {:else}
          <div class="round-card">
            <p class="round-prompt">{round.question}</p>
            {#if round.hint && !showResult}
              <p class="hint">{round.hint}</p>
            {/if}

            <div class="answer-zone">
              {#if session.type === 'word_builder'}
                <div class="word-builder">
                  <div class="target-display">{wordBuilderInput || '⬜'.repeat((round.metadata as { targetWord?: string })?.targetWord?.length ?? 0)}</div>
                  <div class="letter-bank">
                    {#each round.choices ?? [] as letter}
                      <button class="letter-btn" onclick={() => addLetter(letter)}>{letter.toUpperCase()}</button>
                    {/each}
                  </div>
                  <div class="builder-actions">
                    <button class="btn ghost" onclick={removeLetter}>⌫</button>
                    <button class="btn ghost" onclick={clearWordBuilder}>Effacer</button>
                  </div>
                </div>
              {:else if session.type === 'sentence_scramble'}
                <div class="sentence-builder">
                  <div class="built-sentence">{answer || '📝 Construis la phrase…'}</div>
                  <div class="word-bank">
                    {#each round.choices ?? [] as word}
                      <button class="word-btn" class:used={answer.includes(word)} onclick={() => addWord(word)} disabled={answer.includes(word)}>{word}</button>
                    {/each}
                  </div>
                  <div class="builder-actions">
                    <button class="btn ghost" onclick={removeWord}>⌫</button>
                    <button class="btn ghost" onclick={clearSentence}>Effacer</button>
                  </div>
                </div>
              {:else if session.type === 'spelling_bee'}
                <div class="spelling-bee">
                  <button class="listen-big" onclick={speakRound}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    </svg>
                    🔊 Écouter le mot
                  </button>
                  <input
                    class="input"
                    bind:value={answer}
                    placeholder="Écris le mot ici…"
                    onkeydown={(e) => e.key === 'Enter' && submitAnswer()}
                  />
                </div>
              {:else}
                <!-- Choix multiples / Speed Match / Listening -->
                <div class="choices">
                  {#each round.choices ?? [] as choice}
                    <button
                      class="choice"
                      class:sel={answer === choice}
                      class:correct={showResult && roundCorrect && choice === round.answer}
                      class:wrong={showResult && !roundCorrect && choice === answer && choice !== round.answer}
                      onclick={() => { if (!showResult) { answer = choice; sfx.tap(); } }}
                      disabled={showResult}
                    >
                      {choice}
                    </button>
                  {/each}
                </div>
                {#if session.type === 'listening'}
                  <button class="listen-btn" onclick={speakRound}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    </svg>
                    Réécouter
                  </button>
                {/if}
              {/if}
            </div>

            {#if !showResult}
              <button class="btn orange block submit-btn" onclick={submitAnswer} disabled={!answer && session.type !== 'word_builder' && session.type !== 'sentence_scramble'}>
                Vérifier
              </button>
            {:else}
              <div class="feedback" class:good={roundCorrect} class:bad={!roundCorrect}>
                <strong>{roundCorrect ? '✓ Bien joué !' : '✕ Presque !'}</strong>
                {#if !roundCorrect && round.answer}
                <span>Réponse : {round.answer}</span>
              {/if}
              </div>
              <button class="btn block" class:orange={!roundCorrect} onclick={continueGame}>
                {session.completed ? `Terminé ! +${session.xpEarned} XP 🎉` : 'Suivant'}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .games { padding: 0 16px 20px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 0 12px; }
  .head h1 { margin: 0; }
  .x { width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--line); color: var(--ink-soft); font-size: 18px; cursor: pointer; flex: none; }
  .game-header-info { display: flex; align-items: center; gap: 10px; flex: 1; }
  .game-header-info h3 { margin: 0; font-size: 18px; }
  .score { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--mango-deep); flex: none; }

  .games-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .game-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 12px; border-radius: 18px; border: 2px solid var(--line); background: var(--card); cursor: pointer; transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s; }
  .game-card:active { transform: scale(0.98); }
  .game-card:hover { border-color: var(--orange); box-shadow: 0 8px 20px -8px var(--orange); }
  .game-icon { font-size: 32px; }
  .game-card h3 { margin: 0; font-size: 15px; }
  .game-tag { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--orange-soft); color: var(--orange-deep); margin-top: 4px; }

  .game-area { padding: 8px 0 16px; }
  .round-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }
  .round-prompt { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  .hint { font-size: 13px; color: var(--muted); margin: 0 0 16px; }
  .choices { display: flex; flex-direction: column; gap: 10px; }
  .choice { text-align: left; padding: 16px; border-radius: 14px; border: 2px solid var(--line); background: var(--card); font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.12s; }
  .choice.sel { border-color: var(--orange); background: var(--orange-soft); }
  .choice.correct { border-color: var(--teal); background: var(--teal-soft); color: var(--teal-deep); }
  .choice.wrong { border-color: var(--rose); background: var(--rose-soft); color: var(--rose); }
  .listen-btn { margin-top: 10px; align-self: center; padding: 10px 16px; border-radius: 12px; border: 1.5px solid var(--teal); background: var(--teal-soft); color: var(--teal-deep); font-weight: 600; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; }
  .listen-btn svg { width: 18px; height: 18px; }
  .submit-btn { margin-top: 16px; }
  .feedback { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; padding: 14px; border-radius: 14px; text-align: center; }
  .feedback.good { background: var(--teal-soft); color: var(--teal-deep); }
  .feedback.bad { background: var(--rose-soft); color: var(--rose); }
  .feedback span { font-size: 14px; font-weight: 400; opacity: 0.85; }

  /* Memory memorize */
  .memory-memorize { text-align: center; padding: 10px; }
  .memory-memorize .eyebrow { margin-bottom: 14px; }
  .pairs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
  .pair-card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
  .pair-card strong { font-size: 16px; }

  /* Word Builder */
  .word-builder { display: flex; flex-direction: column; gap: 12px; align-items: center; }
  .target-display { font-family: var(--font-display); font-size: 32px; letter-spacing: 8px; min-height: 48px; color: var(--ink); }
  .letter-bank { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .letter-btn { width: 52px; height: 52px; border-radius: 12px; border: 2px solid var(--line); background: var(--card); font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--ink); cursor: pointer; box-shadow: 0 2px 0 var(--line); }
  .letter-btn:active { transform: translateY(1px); box-shadow: none; }
  .builder-actions { display: flex; gap: 8px; margin-top: 4px; }
  .builder-actions .btn { padding: 10px 16px; font-size: 13px; }

  /* Sentence Builder */
  .sentence-builder { display: flex; flex-direction: column; gap: 12px; }
  .built-sentence { min-height: 56px; padding: 14px; border-radius: 12px; background: var(--paper); border: 2px dashed var(--line); font-size: 17px; line-height: 1.5; }
  .word-bank { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .word-btn { padding: 10px 14px; border-radius: 10px; border: 2px solid var(--line); background: var(--card); font-size: 15px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 0 var(--line); }
  .word-btn.used { opacity: 0.4; pointer-events: none; }
  .word-btn:active { transform: translateY(1px); box-shadow: none; }

  /* Spelling Bee */
  .spelling-bee { text-align: center; }
  .listen-big { margin-bottom: 16px; padding: 16px 24px; font-size: 16px; border-radius: 14px; border: 1.5px solid var(--teal); background: var(--teal-soft); color: var(--teal-deep); font-weight: 600; cursor: pointer; display: inline-flex; gap: 10px; align-items: center; }
  .listen-big svg { width: 22px; height: 22px; }
  .spelling-bee .input { text-align: center; font-size: 22px; letter-spacing: 4px; }

  .footer-note { text-align: center; font-size: 11.5px; color: var(--muted); margin-top: 24px; }
</style>