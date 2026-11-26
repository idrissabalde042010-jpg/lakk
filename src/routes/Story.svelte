<script lang="ts">
  import { app } from '../lib/store.svelte';
  import {
    generateStory,
    newVocab,
    storyOfTheDay,
    type GeneratedStory,
  } from '../lib/story';
  import { speak } from '../lib/audio';

  const cards = $derived(Object.values(app.data.cards));
  const newWords = $derived(newVocab(cards, 6));
  const story = $derived(storyOfTheDay(cards, newWords));

  let reading = $state(false);
  let sentenceIndex = $state(0);
  let answered = $state(0);
  let score = $state(0);

  const sentences = $derived(
    story ? story.text.split(/[.!?]+/).filter(Boolean).map((s) => s.trim()) : [],
  );

  const totalSentences = $derived(sentences.length);
  const isReading = $derived(reading && sentenceIndex < totalSentences);
  const showQuiz = $derived(!reading && sentenceIndex >= totalSentences && totalSentences > 0);

  const quiz = $derived(
    story
      ? [
          {
            q: `Dans « ${story.title } », que fait le narrateur ?`,
            a: 'Il raconte une histoire',
            options: ['Il raconte une histoire', 'Il dort', 'Il chante'],
          },
          {
            q: `Combien de mots utilisez-vous dans « ${story.title } » ?`,
            a: story.words.length.toString(),
            options: [story.words.length.toString(), '0', '100'],
          },
          {
            q: 'Quel est le titre de l’histoire ?',
            a: story.title,
            options: [story.title, 'Le marché', 'La nuit'],
          },
        ]
      : [],
  );

  async function readSentence(): Promise<void> {
    const s = sentences[sentenceIndex];
    if (!s) return;
    reading = true;
    await speak(s, 'en-US');
    reading = false;
    sentenceIndex += 1;
  }

  async function readAll(): Promise<void> {
    reading = true;
    for (let i = sentenceIndex; i < sentences.length; i++) {
      await speak(sentences[i], 'en-US');
      sentenceIndex = i + 1;
    }
    reading = false;
  }

  function check(answer: string, correct: string): void {
    answered += 1;
    if (answer === correct) score += 1;
  }

  function restart(): void {
    sentenceIndex = 0;
    answered = 0;
    score = 0;
  }

  function resultFor(qi: number, opt: string, q: { a: string }): string {
    if (answered <= qi) return '';
    return opt === q.a ? `✓ ${q.a}` : `✕ ${q.a}`;
  }
</script>

<div class="story rise">
  <header class="head">
    <p class="eyebrow">Conte du Baobab</p>
    <h1>{story?.title ?? 'Histoire du jour'}</h1>
    <p class="small muted">
      {story?.words.length ?? 0} mots de votre vocabulaire intégrés
    </p>
  </header>

  {#if story && story.text}
    <section class="card story-text">
      <p class="eyebrow">Lisez et écoutez :</p>
      <p class="story-body">
        {#each sentences as s, i}
          <span
            class="sentence"
            class:current={i === sentenceIndex && isReading}
            class:done={i < sentenceIndex}
            role="button"
            tabindex="0"
            aria-label={`Lire la phrase ${i + 1}`}
            onclick={() => { sentenceIndex = i; void readSentence(); }}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sentenceIndex = i; void readSentence(); } }}
          >
            {s}{i < sentences.length - 1 ? '. ' : ''}
          </span>
        {/each}
      </p>
      <div class="story-actions">
        <button class="btn block" disabled={isReading} onclick={readSentence}>
          {isReading ? '…' : '🔊 Lire la phrase suivante'}
        </button>
        <button class="btn ghost block" disabled={isReading} onclick={readAll}>
          🔊 Tout écouter
        </button>
      </div>
      <p class="small muted words-list">
        Mots utilisés : {story.words.map((w) => `${w.en} (${w.fr})`).join(' · ')}
      </p>

      {#if !showQuiz && sentenceIndex >= sentences.length && !reading}
        <button class="btn block" onclick={() => { sentenceIndex = 0; }} style="margin-top:10px">
          Recommencer la lecture
        </button>
      {/if}
    </section>

    {#if showQuiz}
      <section class="card quiz">
        <p class="eyebrow">Compréhension</p>
        {#each quiz as q, qi}
          <div class="question">
            <p class="small">{q.q}</p>
            {#each q.options as opt}
              <button
                class="choice"
                class:selected={answered > qi}
                onclick={() => check(opt, q.a)}
              >
                {opt}
              </button>
            {/each}
            {#if answered > qi}
              <p class="result">{resultFor(qi, quiz[qi].options[0], q)}</p>
              <p class="result">{resultFor(qi, quiz[qi].options[1], q)}</p>
              <p class="result">{resultFor(qi, quiz[qi].options[2], q)}</p>
            {/if}
          </div>
        {/each}
        <p class="small muted">Score : {score} / {quiz.length}</p>
        <button class="btn block" onclick={restart}>Recommencer</button>
      </section>
    {/if}
  {:else}
    <div class="empty card">
      <p class="small muted">Aucun vocabulaire disponible pour générer une histoire. Faites d’abord quelques leçons.</p>
      <button class="btn block" onclick={() => app.setScreen('home')}>Retour au parcours</button>
    </div>
  {/if}
</div>

<style>
  .story {
    padding: 0 16px 20px;
  }
  .head {
    padding: 20px 0 16px;
  }
  .head h1 {
    margin: 2px 0 4px;
  }
  .story-text {
    margin-top: 6px;
    padding: 26px 20px;
    text-align: center;
    line-height: 1.8;
  }
  .story-body {
    font-family: var(--font-display);
    font-size: 20px;
    margin: 14px 0 22px;
    color: var(--ink);
  }
  .sentence {
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 8px;
    transition: background 0.1s;
  }
  .sentence.current {
    background: var(--orange-soft);
    color: var(--orange-deep);
    font-weight: 600;
  }
  .sentence.done {
    color: var(--muted);
  }
  .story-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .words-list {
    margin-top: 10px;
    font-size: 12px;
    color: var(--ink-soft);
  }
  .quiz {
    margin-top: 12px;
    padding: 20px;
  }
  .question {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }
  .choice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 12px;
    border: 1.5px solid var(--line);
    background: var(--card);
    text-align: left;
    cursor: pointer;
    font-size: 15px;
  }
  .choice.selected {
    border-color: var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
  }
  .result {
    font-size: 12px;
    font-weight: 600;
    margin-top: 2px;
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
</style>
