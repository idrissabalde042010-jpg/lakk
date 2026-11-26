<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { speak } from '../lib/audio';

  const ex = $derived(app.expressExercises[app.expressIndex]?.exercise);
  const progress = $derived(
    Math.round(((app.expressIndex + 1) / app.expressExercises.length) * 100),
  );

  let typed = $state('');
  let selected = $state<number | null>(null);
  let phase = $state<'answer' | 'feedback'>('answer');
  let ok = $state(false);

  const shuffledChoiceIndices = $derived(
    ex?.choices && ex.choices.length > 1
      ? Array.from({ length: ex.choices.length }, (_, i) => i)
      : [],
  );

  function getChoice(i: number): string {
    return ex?.choices?.[i] ?? '';
  }

  const given = $derived(
    ex?.choices && selected != null
      ? getChoice(selected)
      : typed,
  );

  const canCheck = $derived(
    phase === 'answer' &&
    (ex?.choices ? selected != null : typed.trim().length > 0),
  );

  function hear(): void {
    if (ex?.vocab) speak(ex.vocab.en);
  }

  function check(): void {
    if (!canCheck) return;
    ok = app.checkExpress(given);
    phase = 'feedback';
  }

  function next(): void {
    app.nextExpress();
    typed = '';
    selected = null;
    phase = 'answer';
    ok = false;
  }

  function finish(): void {
    const xp = app.expressCorrect * 10 + 20;
    app.finishExpress(xp);
    app.notify(`Séance express terminée ! ${app.expressCorrect}/3 bonnes réponses.`);
  }
</script>

<div class="express rise">
  <header class="head">
    <p class="eyebrow">⚡ Séance Express</p>
    <h1>Exercice {app.expressIndex + 1} / 3</h1>
    <div class="bar">
      <span style={`width:${progress}%`}></span>
    </div>
  </header>

  {#if app.expressDone}
    <div class="card success">
      <div class="medal">🌟</div>
      <h2>Séance terminée !</h2>
      <p class="small muted">
        {app.expressCorrect} / 3 bonnes réponses · {Math.round(
          (app.expressCorrect / 3) * 100,
        )}%
      </p>
      <button class="btn block" onclick={finish}>
        Revenir à l’accueil
      </button>
    </div>
  {:else if ex}
    <div class="card exercise">
      <p class="prompt">{ex.prompt}</p>
      {#if ex.vocab}
        <button class="speak" onclick={hear}>🔊 Écouter</button>
      {/if}

      {#if ex.choices && ex.choices.length > 1}
        <div class="choices">
          {#each shuffledChoiceIndices as choiceIdx, displayIdx}
            <button
              class="choice"
              class:sel={selected === displayIdx}
              onclick={() => (selected = displayIdx)}
              disabled={phase !== 'answer'}
            >
              {getChoice(choiceIdx)}
            </button>
          {/each}
        </div>
      {:else}
        <input
          class="input"
          bind:value={typed}
          placeholder="Écris ta réponse…"
          disabled={phase !== 'answer'}
          onkeydown={(e) => e.key === 'Enter' && check()}
        />
      {/if}

      {#if phase === 'answer'}
        <button class="btn block" disabled={!canCheck} onclick={check}>
          Vérifier
        </button>
      {:else}
        <div class="fb" class:good={ok} class:bad={!ok}>
          <strong>{ok ? '✓ Bien joué !' : 'Ce n’est pas grave !'}</strong>
          {#if !ok}<span>Réponse : {ex.answer}</span>{/if}
          <button class="btn block" onclick={next}>
            {app.expressIndex + 1 >= app.expressExercises.length ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .express {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 0 16px;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 0 10px;
  }
  .head h1 {
    margin: 0;
    font-size: 20px;
  }
  .bar {
    height: 8px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--mango), var(--orange));
    transition: width 0.4s ease;
  }
  .card {
    flex: 1;
    padding: 26px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .exercise {
    text-align: center;
  }
  .prompt {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink);
  }
  .speak {
    align-self: center;
    margin-top: 8px;
    padding: 8px 14px;
    border-radius: 12px;
    border: 1.5px solid var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
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
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
  }
  .choice:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .choice.sel {
    border-color: var(--orange);
    background: var(--orange-soft);
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
    margin-top: 10px;
  }
  .input:focus {
    border-color: var(--orange);
  }
  .btn {
    width: 100%;
    padding: 12px 16px;
    border-radius: 10px;
    border: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
  }
  .btn.block {
    width: 100%;
  }
  .fb {
    margin-top: 10px;
    padding: 14px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fb.good {
    background: var(--teal-soft);
  }
  .fb.bad {
    background: var(--orange-soft);
  }
  .fb strong {
    font-family: var(--font-display);
    font-size: 16px;
  }
  .fb span {
    font-size: 13px;
    color: var(--ink-soft);
  }
  .success {
    align-items: center;
    text-align: center;
  }
  .medal {
    font-size: 44px;
    line-height: 1;
  }
  .success h2 {
    margin: 8px 0 4px;
    font-size: 22px;
  }
  .success .small {
    margin-bottom: 16px;
  }
</style>
