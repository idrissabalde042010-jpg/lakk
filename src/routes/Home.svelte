<script lang="ts">
  import { app } from '../lib/store.svelte';
  import Baobab from '../components/Baobab.svelte';
  import ProgressRing from '../components/ProgressRing.svelte';
  import PathNode from '../components/PathNode.svelte';
  import { speak, warmUpSpeech, isSpeechAvailable } from '../lib/audio';
  import { generateDailyChallenge, checkDailyChallenge, type DailyChallenge } from '../lib/dailyChallenge';

  const p = $derived(app.profile);
  const percent = $derived(app.goalPercent());
  const course = $derived(app.course);
  const lessons = $derived(app.lessons);
  const speechAvailable = $derived(isSpeechAvailable());
  let showTip = $state(false);
  let dailyChallenge = $state<DailyChallenge | null>(generateDailyChallenge());
  let challengeAnswer = $state('');
  let challengePhase = $state<'answer' | 'feedback'>('answer');
  let challengeOk = $state(false);
  let challengeDone = $state(false);

  function lessonNumber(ui: number, li: number): number {
    let n = 0;
    for (let i = 0; i < ui; i++) n += course.units[i].lessons.length;
    return n + li + 1;
  }

  function continueLesson(): void {
    const next = lessons.find((r) => !app.isCompleted(r.u, r.l) && app.isUnlocked(r.u, r.l));
    const target = next ?? lessons[0];
    app.startLesson(target.u, target.l);
  }

  function open(u: number, l: number): void {
    if (app.isUnlocked(u, l)) {
      app.startLesson(u, l);
    }
  }

  // Narrowed reference for template type safety
  const dc = $derived(dailyChallenge);

  // --- Défi quotidien ---
  function speakChallenge(): void {
    if (dailyChallenge?.audioText) speak(dailyChallenge.audioText);
  }

  function submitChallenge(): void {
    if (!dailyChallenge || !challengeAnswer.trim() || challengePhase !== 'answer') return;
    challengeOk = checkDailyChallenge(dailyChallenge, challengeAnswer);
    challengePhase = 'feedback';
    if (challengeOk) {
      app.completeLesson(99, 99, dailyChallenge.xp, 100); // XP bonus sans leçon réelle
      challengeDone = true;
    }
  }

  function nextChallenge(): void {
    dailyChallenge = generateDailyChallenge();
    challengeAnswer = '';
    challengePhase = 'answer';
    challengeOk = false;
    challengeDone = false;
    showTip = false;
  }

  function challengeTypeLabel(type?: string): string {
    switch (type) {
      case 'listen_write': return '🎧 Écoute & écriture';
      case 'translate': return '🔤 Traduction';
      case 'fill_blank': return '✏️ Complétion';
      case 'order_words': return '🔀 Ordre des mots';
      case 'multiple_choice': return '☑️ Choix multiple';
      default: return 'Défi du jour';
    }
  }

  // Préchauffer la synthèse vocale à la première interaction
  function primeAudio(): void {
    warmUpSpeech();
  }

  /** Clic sur la carte « Défi du jour » : préchauffe l'audio. */
  function onChallengeTap(event: MouseEvent): void {
    primeAudio();
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, label, a, select, textarea')) return;
  }

  /** Même au clavier (Entrée / Espace). */
  function onChallengeKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    primeAudio();
  }
</script>

<div class="home rise">
  <header class="head wax">
    <div class="head-top">
      <div>
        <p class="eyebrow">Salut, {p.name}</p>
        <h1>Prêt pour ta dose<br />d’anglais ?</h1>
      </div>
      <Baobab streak={p.streakDays} size={72} />
    </div>
    <div class="chips">
      <span class="chip mango">🔥 {p.streakDays} j</span>
      <span class="chip rose">⚡ {p.unlimitedEnergy ? '∞' : p.energy}</span>
      <span class="chip blue">◆ {p.gems}</span>
      <span class="chip cyan">❄️ {p.freezeCount}/2</span>
    </div>
  </header>

  <section class="card hero">
    <div class="hero-row">
      <div class="grow">
        <p class="eyebrow">Objectif du jour</p>
        <p class="big"><strong>{p.xpToday}</strong><span class="den">graines</span></p>
        <p class="small muted">
          {percent >= 100 ? 'Objectif atteint, bravo !' : `Objectif : ${p.dailyGoalXp} graines`}
        </p>
      </div>
      <ProgressRing percent={percent} size={78} label={`${percent}%`} />
    </div>
    <button class="btn orange block" data-tour="start" onclick={continueLesson}>Continuer</button>
  </section>

  <section class="card challenge wax" role="button" tabindex="0" onclick={onChallengeTap} onkeydown={onChallengeKey} onmouseover={primeAudio} onfocus={primeAudio}>
    <div class="challenge-top">
      <span class="tag">{challengeTypeLabel(dailyChallenge?.type)}</span>
      {#if speechAvailable}
        <button class="icon-btn" onclick={speakChallenge} aria-label="Écouter">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          </svg>
        </button>
      {:else}
        <span class="icon-btn muted" aria-label="Audio indisponible" title="Synthèse vocale non supportée">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" />
          </svg>
        </span>
      {/if}
    </div>

    <p class="challenge-prompt">{dailyChallenge?.prompt}</p>
    <p class="challenge-question">{dailyChallenge?.question}</p>

    {#if challengePhase === 'answer'}
      <div class="challenge-input-area">
        {#if dailyChallenge?.type === 'multiple_choice'}
          <div class="choices">
            {#each dailyChallenge.choices ?? [] as choice, i}
              <button
                class="choice"
                class:sel={challengeAnswer === choice}
                onclick={() => { challengeAnswer = choice; }}
              >
                {choice}
              </button>
            {/each}
          </div>
        {:else if dc?.type === 'translate' || dc?.type === 'order_words'}
          {#if dc}
            <div class="tray" class:empty={!challengeAnswer}>
              {#if dc.type === 'translate'}
                <button
                  type="button"
                  class="word"
                  onclick={() => { challengeAnswer = dc.answer; }}
                >{dc.answer}</button>
              {:else}
                {#each challengeAnswer.split(' ') as w}
                  <span class="word">{w}</span>
                {/each}
              {/if}
              {#if !challengeAnswer}
                <span class="placeholder">{dc.type === 'order_words' ? 'Appuie sur les mots dans l\'ordre' : 'Traduis la phrase'}</span>
              {/if}
            </div>
            <div class="bank">
              {#each dc.word_bank ?? [] as w}
                <button
                  class="word bank-word"
                  class:used={challengeAnswer.includes(w)}
                  onclick={() => {
                    if (!challengeAnswer.includes(w)) {
                      challengeAnswer = challengeAnswer ? `${challengeAnswer} ${w}` : w;
                    }
                  }}
                  disabled={challengeAnswer.includes(w)}
                >
                  {w}
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <input
            class="input"
            bind:value={challengeAnswer}
            placeholder="Ta réponse…"
            onkeydown={(e) => e.key === 'Enter' && submitChallenge()}
          />
        {/if}
      </div>

      {#if dailyChallenge?.tip}
        <button class="link" onclick={() => (showTip = !showTip)}>
          {showTip ? 'Cacher l\'indice' : 'Besoin d\'un indice ?'}
        </button>
        {#if showTip}
          <p class="hint">{dailyChallenge.tip}</p>
        {/if}
      {/if}

      <button class="btn orange block" onclick={submitChallenge} disabled={!challengeAnswer.trim()}>
        Vérifier
      </button>

    {:else}
      <div class="fb" class:good={challengeOk} class:bad={!challengeOk}>
        <div class="fb-text">
          <strong>{challengeOk ? '✓ Bien joué !' : '✕ Presque !'}</strong>
          {#if !challengeOk && dailyChallenge}
            <span>Réponse : {dailyChallenge.answer}</span>
          {/if}
        </div>
        <button class="btn block" class:orange={!challengeOk} onclick={nextChallenge}>
          {challengeOk && dailyChallenge ? `Défi réussi +${dailyChallenge.xp} XP` : 'Réessayer'}
        </button>
      </div>
    {/if}
  </section>

  <div class="section-title">
    <h2>Ton parcours</h2>
    <span class="small muted">{app.cardCount()} mot{app.cardCount() > 1 ? 's' : ''} en mémoire</span>
  </div>

  <section class="path">
    {#each course.units as unit, ui}
      <div class="unit-band" style={`--band:${unit.color ?? '#ff6a2b'}`}>
        <span class="unit-kicker">Unité {ui + 1}</span>
        <h3>{unit.title}</h3>
      </div>
      <div class="nodes">
        {#each unit.lessons as lesson, li}
          {@const done = app.isCompleted(ui, li)}
          {@const unlocked = app.isUnlocked(ui, li)}
          <PathNode
            state={done ? 'done' : unlocked ? 'current' : 'locked'}
            index={lessonNumber(ui, li)}
            title={lesson.title}
            side={li % 2 === 0 ? 'left' : 'right'}
            onclick={() => open(ui, li)}
          />
        {/each}
      </div>
    {/each}
  </section>

  <p class="footer-note">Gratuit, sans pub, hors ligne.</p>
</div>

<style>
  .home {
    padding: 0 16px 18px;
  }
  .head {
    margin: 0 -16px 16px;
    padding: 22px 18px 18px;
    border-radius: 0 0 26px 26px;
    background:
      radial-gradient(120% 120% at 100% 0%, rgba(255, 106, 43, 0.18), transparent 60%),
      linear-gradient(160deg, #fff6ef, var(--paper));
    border-bottom: 1px solid var(--line);
  }
  :root.dark .head {
    background:
      radial-gradient(120% 120% at 100% 0%, rgba(255, 106, 43, 0.13), transparent 60%),
      linear-gradient(160deg, #131e1c, var(--paper));
  }
  .head-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .head h1 {
    margin-top: 4px;
    font-size: 25px;
    line-height: 1.08;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .chips .chip {
    box-shadow: 0 2px 0 rgba(17, 30, 28, 0.06);
  }
  .hero {
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 12px 30px -22px rgba(17, 30, 28, 0.5);
  }
  .hero-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .big {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 34px;
    line-height: 1;
    margin: 4px 0 4px;
  }
  .den {
    font-size: 15px;
    color: var(--muted);
    font-weight: 500;
    margin-left: 6px;
  }
  .challenge {
    margin-top: 12px;
    background:
      radial-gradient(130% 140% at 0% 0%, rgba(255, 106, 43, 0.13), transparent 62%),
      var(--card);
  }
  .challenge-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .tag {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--orange-deep);
  }
  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--orange);
    display: grid;
    place-items: center;
    cursor: pointer;
    flex: none;
  }
  .icon-btn svg {
    width: 20px;
    height: 20px;
  }
  .section-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 26px 2px 8px;
  }
  .section-title h2 {
    font-size: 18px;
  }
  .unit-band {
    background: var(--band);
    color: #fff;
    border-radius: 18px;
    padding: 14px 16px;
    margin: 18px 0 6px;
    box-shadow: 0 6px 0 color-mix(in srgb, var(--band) 70%, #000);
  }
  .unit-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.9;
  }
  .unit-band h3 {
    font-size: 18px;
    margin-top: 2px;
  }
  .nodes {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 18px 0 6px;
  }
  .nodes::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 0;
    border-left: 2px dashed var(--line);
    transform: translateX(-1px);
    z-index: 0;
  }
  .nodes :global(.wrap) {
    position: relative;
    z-index: 1;
  }
  .footer-note {
    text-align: center;
    font-size: 11.5px;
    color: var(--muted);
    margin-top: 26px;
  }
</style>
