<script lang="ts">
  import { app } from '../lib/store.svelte';
  import type { Card, Grade } from '../lib/engine';
  import { mastery } from '../lib/engine';
  import { sfx, speak, isSpeechAvailable } from '../lib/audio';
  import { shuffle, shuffledIndices } from '../lib/shuffle';

  let due = $state<Card[]>(app.dueCards());
  let revealed = $state(false);
  let reviewed = $state(0);
  const speechAvailable = $derived(isSpeechAvailable());

  const current = $derived(due[0]);
  const total = $derived(app.cardCount());
  const remaining = $derived(due.length);

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
    sfx.tap();
    shuffleGrades();
  }

  // Mélanger au premier affichage et après chaque réponse
  $effect(() => {
    due;
    shuffleGrades();
  });
</script>

<div class="review rise">
  <header class="head">
    <p class="eyebrow">Mémoire FSRS</p>
    <h1>Réviser</h1>
    <p class="small muted">
      {#if remaining > 0}
        {remaining} carte{remaining > 1 ? 's' : ''} à revoir · {total} en mémoire
      {:else}
        {total} mot{total > 1 ? 's' : ''} en mémoire
      {/if}
    </p>
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
          {#if speechAvailable}
            <button class="speak" onclick={() => speak(current.vocab.en)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 5 6 9H3v6h3l5 4z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              </svg>
              Réécouter
            </button>
          {:else}
            <span class="speak muted" aria-label="Audio indisponible" title="Audio indisponible">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 5 6 9H3v6h3l5 4z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" />
              </svg>
              Audio indisponible
            </span>
          {/if}
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
</style>
