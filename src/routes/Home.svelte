<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { dayKey } from '../lib/engine';
  import {
    dailyMission,
    completeMission,
    loadMissionLog,
    getMissionProof,
    saveMissionProof,
    type MissionLog,
  } from '../lib/missions';
  import Baobab from '../components/Baobab.svelte';
  import ProgressRing from '../components/ProgressRing.svelte';
  import RegularityRing from '../components/RegularityRing.svelte';
  import PathNode from '../components/PathNode.svelte';
  import { speak, warmUpSpeech, isSpeechAvailable } from '../lib/audio';
  import { _ } from 'svelte-i18n';
  import {
    generateDailyQuests,
    checkDailyQuest,
    completeDailyQuest,
    claimBonusChest,
    getChestReward,
    type DailyQuest,
    type DailyQuests,
    type QuestTier,
    type ChestReward,
  } from '../lib/dailyChallenge';

  const p = $derived(app.profile);
  const percent = $derived(app.goalPercent());
  const course = $derived(app.course);
  const lessons = $derived(app.lessons);
  const speechAvailable = $derived(isSpeechAvailable());

  // Série Vivante : anneau de régularité, joker et pause.
  const ring = $derived(app.regularityRing());
  const jokerAvailable = $derived(app.jokerAvailable());
  const paused = $derived(app.paused());
  const pauseUntil = $derived(app.pauseUntil());
  const streakBroken = $derived(app.streakBroken());
  const crownRemaining = $derived(Math.max(0, ring.target - ring.activeCount));

  // Mission du jour : tirage déterministe, preuve audio locale optionnelle.
  const today = dayKey();
  const mission = dailyMission(today);
  let missionLog = $state<MissionLog>(loadMissionLog());
  const missionDone = $derived(!!missionLog[today]);
  let proofUrl = $state<string | null>(getMissionProof(today));
  let recording = $state(false);
  let proofError = $state<string | null>(null);
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let proofTimer: ReturnType<typeof setTimeout> | null = null;

  // Texte dynamique selon la langue d'apprentissage
  const readyText = $derived($_( `home.ready_${p.learnLang}` ) || $_('home.ready'));

  // État des quêtes quotidiennes
  let dailyQuests = $state<DailyQuests>(generateDailyQuests());
  let activeQuest = $state<QuestTier>('bronze');
  let challengeAnswer = $state('');
  let challengePhase = $state<'answer' | 'feedback'>('answer');
  let challengeOk = $state(false);
  let showTip = $state(false);
  let showChest = $state<ChestReward | null>(null);

  // Tiers typés pour l'itération
  const QUEST_TIERS: QuestTier[] = ['bronze', 'silver', 'gold'];

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

  /** Choisit une leçon au hasard parmi celles déjà complétées. */
  function startRandomLesson(): void {
    const completed = lessons.filter((r) => app.isCompleted(r.u, r.l));
    if (completed.length === 0) return;
    const target = completed[Math.floor(Math.random() * completed.length)];
    app.startLesson(target.u, target.l);
  }

  const hasCompletedLessons = $derived(lessons.some((r) => app.isCompleted(r.u, r.l)));

  /** Reprendre après un jour manqué : une leçon suffit. */
  function startRecovery(): void {
    app.startRecoveryLesson();
  }

  function planPause(): void {
    app.startPause(7);
    app.notify('Pause de 7 jours activée. Ta série est protégée.');
  }

  function resumeFromPause(): void {
    app.cancelPause();
    app.notify('Pause annulée. On reprend !');
  }

  function markMissionDone(): void {
    missionLog = completeMission(today, mission.id);
    app.notify('Mission du jour accomplie ! 🌿');
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function toggleProof(): Promise<void> {
    if (recording) {
      recorder?.stop();
      return;
    }
    proofError = null;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      proofError = 'L\'enregistrement audio n\'est pas disponible sur cet appareil. Tu peux valider la mission sans preuve de vie.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);
      recorder = rec;
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      rec.onstop = async () => {
        recording = false;
        if (proofTimer) {
          clearTimeout(proofTimer);
          proofTimer = null;
        }
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        try {
          const dataUrl = await blobToDataUrl(blob);
          if (saveMissionProof(today, dataUrl)) {
            proofUrl = dataUrl;
            app.notify('Preuve de vie enregistrée sur cet appareil.');
          } else {
            proofError = 'Preuve trop lourde pour le stockage local.';
          }
        } catch {
          proofError = 'Impossible de sauvegarder la preuve.';
        }
      };
      rec.start();
      recording = true;
      proofTimer = setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, 10_000);
    } catch (e: unknown) {
      const name = e instanceof DOMException ? e.name : String(e);
      const message =
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'L\'accès au micro a été refusé. Tu peux valider la mission sans preuve de vie.'
          : name === 'NotFoundError' || name === 'DevicesNotFoundError'
            ? 'Aucun microphone détecté sur cet appareil. Tu peux valider la mission sans preuve de vie.'
            : 'L\'enregistrement audio est indisponible pour l\'instant. Tu peux valider la mission sans preuve de vie.';
      proofError = message;
      recording = false;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  onDestroy(() => {
    if (proofTimer) clearTimeout(proofTimer);
    if (recorder && recorder.state === 'recording') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
  });

  function open(u: number, l: number): void {
    if (app.isUnlocked(u, l)) {
      app.startLesson(u, l);
    }
  }

  // Quête active dérivée
  const currentQuest = $derived(
    dailyQuests.quests.find((q) => q.id === activeQuest) ?? dailyQuests.quests[0]
  );

  // Vérifie si toutes les quêtes sont terminées
  const allQuestsDone = $derived(dailyQuests.quests.every((q) => q.completed));
  const chestAvailable = $derived(allQuestsDone && !dailyQuests.chestClaimed);

  // --- Quêtes quotidiennes ---
  function speakQuest(): void {
    if (currentQuest?.audioText) speak(currentQuest.audioText);
  }

  function selectQuest(tier: QuestTier): void {
    if (dailyQuests.quests.find((q) => q.id === tier)?.completed) return;
    activeQuest = tier;
    challengeAnswer = '';
    challengePhase = 'answer';
    challengeOk = false;
    showTip = false;
  }

  function submitQuest(): void {
    if (!currentQuest || !challengeAnswer.trim() || challengePhase !== 'answer') return;
    challengeOk = checkDailyQuest(currentQuest, challengeAnswer);
    challengePhase = 'feedback';
    if (challengeOk) {
      const result = completeDailyQuest(currentQuest.id);
      if (result?.chestReward) {
        showChest = result.chestReward;
      }
      // Recharge les quêtes pour avoir l'état à jour
      dailyQuests = generateDailyQuests();
      // Passe à la prochaine quête non terminée
      const next = dailyQuests.quests.find((q) => !q.completed);
      if (next) activeQuest = next.id;
    }
  }

  function retryQuest(): void {
    challengeAnswer = '';
    challengePhase = 'answer';
    challengeOk = false;
    showTip = false;
  }

  function claimChest(): void {
    if (chestAvailable) {
      const reward = claimBonusChest();
      if (reward) showChest = reward;
      dailyQuests = generateDailyQuests();
    }
  }

  function closeChest(): void {
    showChest = null;
  }

  function challengeTypeLabel(type?: string): string {
    switch (type) {
      case 'listen_write': return '🎧 Écoute & écriture';
      case 'translate': return '🔤 Traduction';
      case 'fill_blank': return '✏️ Complétion';
      case 'order_words': return '🔀 Ordre des mots';
      case 'multiple_choice': return '☑️ Choix multiple';
      default: return 'Quête';
    }
  }

  function tierLabel(tier: QuestTier): string {
    switch (tier) {
      case 'bronze': return '🥉 Bronze';
      case 'silver': return '🥈 Argent';
      case 'gold': return '🥇 Or';
    }
  }

  function tierIcon(tier: QuestTier): string {
    switch (tier) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
    }
  }

  // Préchauffer la synthèse vocale à la première interaction
  function primeAudio(): void {
    warmUpSpeech();
  }

  /** Clic sur la carte quête : préchauffe l'audio. */
  function onQuestTap(event: MouseEvent): void {
    primeAudio();
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, label, a, select, textarea')) return;
  }

  /** Même au clavier (Entrée / Espace). */
  function onQuestKey(event: KeyboardEvent): void {
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
        <h1>{@html readyText}</h1>
      </div>
      <RegularityRing ring={ring} size={82} />
    </div>
    <div class="chips">
      <span class="chip cyan">🌿 {ring.activeCount}/7</span>
      <span class="chip mango">🔥 {p.streakDays} j</span>
      <span class="chip blue">◆ {p.gems}</span>
      <span class="chip cyan">❄️ {p.freezeCount}/2</span>
      <span class="chip rose">⚡ {p.unlimitedEnergy ? '∞' : p.energy}</span>
    </div>
  </header>

  <!-- Série Vivante : la régularité plutôt qu'une chaîne fragile. -->
  <section class="card streak-card">
    <div class="streak-main">
      <Baobab streak={p.streakDays} size={64} />
      <div class="grow">
        <p class="eyebrow">Série vivante</p>
        <p class="big"><strong>{ring.activeCount}</strong><span class="den">/ 7 jours actifs</span></p>
        <p class="small muted">
          {#if ring.crown}
            Couronne de régularité ! Ta semaine est complète. 🌿
          {:else}
            Encore {crownRemaining} jour{crownRemaining > 1 ? 's' : ''} pour ta couronne.
          {/if}
        </p>
      </div>
    </div>

    <div class="streak-meta">
      <span class="chip mango">🔥 {p.streakDays} j de suite</span>
      <span class="chip" class:cyan={jokerAvailable} class:rose={!jokerAvailable}>
        🎟️ {jokerAvailable ? 'Joker du mois prêt' : 'Joker du mois utilisé'}
      </span>
      {#if paused}
        <span class="chip blue">⏸ Pause jusqu’au {pauseUntil}</span>
      {/if}
    </div>

    {#if streakBroken}
      <div class="recover">
        <p class="small">
          Un jour manqué ? Une leçon de 2 minutes suffit : ta série revient à 50 %.
        </p>
        <button class="btn orange block" onclick={startRecovery}>Reprendre en 2 min</button>
      </div>
    {:else}
      <div class="pause-row">
        {#if paused}
          <button class="link" onclick={resumeFromPause}>Reprendre maintenant</button>
        {:else}
          <button class="link" onclick={planPause}>Planifier une pause de 7 jours</button>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Mission du jour : un petit transfert dans la vraie vie. -->
  <section class="card mission-card">
    <div class="mission-head">
      <div class="grow">
        <p class="eyebrow">Mission du jour</p>
        <p class="mission-title">
          <span class="mission-icon" aria-hidden="true">{mission.icon}</span>
          <span>{mission.title}</span>
        </p>
      </div>
      <span class="mission-duration">{mission.duration}</span>
    </div>

    <p class="small muted">{mission.hint}</p>

    <button
      class="mission-check"
      class:done={missionDone}
      onclick={markMissionDone}
      disabled={missionDone}
      aria-pressed={missionDone}
    >
      <span class="box" aria-hidden="true">{missionDone ? '✓' : ''}</span>
      <span>{missionDone ? 'Mission accomplie' : 'J’ai accompli la mission'}</span>
    </button>

    {#if missionDone}
      <div class="proof-row">
        {#if proofUrl}
          <audio class="proof-audio" controls preload="none" src={proofUrl}></audio>
        {/if}
        {#if recording}
          <button class="link recording" onclick={toggleProof}>⏺ Arrêter l’enregistrement</button>
        {:else}
          <button class="link" onclick={toggleProof}>
            {proofUrl ? '🎙️ Refaire la preuve (10 s)' : '🎙️ Ajouter une preuve de vie (10 s)'}
          </button>
        {/if}
        {#if proofUrl && !recording}
          <span class="small muted">Preuve audio gardée sur cet appareil.</span>
        {/if}
        {#if proofError}
          <p class="small proof-error">{proofError}</p>
        {/if}
      </div>
    {/if}
  </section>

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
    {#if hasCompletedLessons}
      <button class="btn ghost block" onclick={startRandomLesson} aria-label="Leçon aléatoire">
        🎲 Leçon aléatoire
      </button>
    {:else}
      <button class="btn ghost block" disabled aria-label="Aucune leçon complétée">
        🎲 Leçon aléatoire
      </button>
    {/if}
  </section>

  <!-- Barre de sélection des quêtes -->
  <section class="card quest-tabs">
    <div class="quest-tabs-row">
      {#each QUEST_TIERS as tier}
        {@const quest = dailyQuests.quests.find((q) => q.id === tier)}
        <button
          class="quest-tab"
          class:active={activeQuest === tier}
          class:done={quest?.completed}
          onclick={() => selectQuest(tier)}
          disabled={quest?.completed}
          aria-label={tierLabel(tier)}
          aria-disabled={quest?.completed}
        >
          <span class="tier-icon">{tierIcon(tier)}</span>
          <span class="tier-name">{tierLabel(tier)}</span>
          {#if quest?.completed}
            <span class="check">✓</span>
          {:else}
            <span class="reward">+{quest?.xp ?? 0} XP · {quest?.gemReward ?? 0} ◆</span>
          {/if}
        </button>
      {/each}
    </div>
    {#if chestAvailable}
      <button class="btn bonus-chest" onclick={claimChest} aria-label="Ouvrir le coffre bonus">
        <span class="chest-icon">🎁</span>
        <span>Coffre bonus</span>
        <span class="chest-reward">+20 ◆ + 10 min 3× XP</span>
      </button>
    {/if}
  </section>

  <!-- Carte de quête active -->
  <section class="card challenge wax quest-card" role="button" tabindex="0" onclick={onQuestTap} onkeydown={onQuestKey} onmouseover={primeAudio} onfocus={primeAudio}>
    <div class="quest-header">
      <span class="tag">{tierLabel(activeQuest)} — {challengeTypeLabel(currentQuest?.type)}</span>
      {#if speechAvailable}
        <button class="icon-btn" onclick={speakQuest} aria-label="Écouter">
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

    <p class="challenge-prompt">{currentQuest?.prompt}</p>
    <p class="challenge-question">{currentQuest?.question}</p>

    {#if challengePhase === 'answer'}
      <div class="challenge-input-area">
        {#if currentQuest?.type === 'multiple_choice'}
          <div class="choices">
            {#each currentQuest.choices ?? [] as choice, i}
              <button
                class="choice"
                class:sel={challengeAnswer === choice}
                onclick={() => { challengeAnswer = choice; }}
              >
                {choice}
              </button>
            {/each}
          </div>
        {:else if currentQuest?.type === 'translate' || currentQuest?.type === 'order_words'}
          {#if currentQuest}
            <div class="tray" class:empty={!challengeAnswer}>
              {#if currentQuest.type === 'translate'}
                <button
                  type="button"
                  class="word"
                  onclick={() => { challengeAnswer = currentQuest.answer; }}
                >{currentQuest.answer}</button>
              {:else}
                {#each challengeAnswer.split(' ') as w}
                  <span class="word">{w}</span>
                {/each}
              {/if}
              {#if !challengeAnswer}
                <span class="placeholder">{currentQuest.type === 'order_words' ? 'Appuie sur les mots dans l\'ordre' : 'Traduis la phrase'}</span>
              {/if}
            </div>
            <div class="bank">
              {#each currentQuest.word_bank ?? [] as w}
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
            onkeydown={(e) => e.key === 'Enter' && submitQuest()}
          />
        {/if}
      </div>

      {#if currentQuest?.tip}
        <button class="link" onclick={() => (showTip = !showTip)}>
          {showTip ? 'Cacher l\'indice' : 'Besoin d\'un indice ?'}
        </button>
        {#if showTip}
          <p class="hint">{currentQuest.tip}</p>
        {/if}
      {/if}

      <button class="btn orange block" onclick={submitQuest} disabled={!challengeAnswer.trim()}>
        Vérifier
      </button>

    {:else}
      <div class="fb" class:good={challengeOk} class:bad={!challengeOk}>
        <div class="fb-text">
          <strong>{challengeOk ? '✓ Bien joué !' : '✕ Presque !'}</strong>
          {#if !challengeOk && currentQuest}
            <span>Réponse : {currentQuest.answer}</span>
          {/if}
        </div>
        {#if challengeOk}
          <div class="quest-reward">
            <span>+{currentQuest.xp} XP</span>
            <span>+{currentQuest.gemReward} ◆</span>
          </div>
        {/if}
        <button class="btn block" class:orange={!challengeOk} onclick={challengeOk ? (allQuestsDone && !dailyQuests.chestClaimed ? claimChest : retryQuest) : retryQuest}>
          {challengeOk ? (allQuestsDone && !dailyQuests.chestClaimed ? 'Ouvrir le coffre 🎁' : 'Quête suivante') : 'Réessayer'}
        </button>
      </div>
    {/if}
  </section>

  <!-- Modal coffre -->
  {#if showChest}
    <div
      class="chest-modal"
      role="button"
      tabindex="0"
      onclick={closeChest}
      onkeydown={(e) => { if (e.key === 'Escape' || e.key === ' ') closeChest(); }}
      aria-label="Fermer le coffre"
    >
      <div
        class="chest-content"
        role="dialog"
        aria-modal="true"
        aria-label="Récompense du coffre"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="chest-animation">🎁</div>
        <h3>{showChest.type === 'bonus' ? 'Coffre Bonus !' : `Coffre ${showChest.type.charAt(0).toUpperCase() + showChest.type.slice(1)}`}</h3>
        <p class="chest-message">{showChest.message}</p>
        <button class="btn orange block" onclick={closeChest}>Super !</button>
      </div>
    </div>
  {/if}

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

  /* Série Vivante */
  .streak-card {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .streak-main {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .streak-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .streak-meta .chip {
    font-size: 11px;
  }
  .recover {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 12px;
    background: var(--orange-soft);
    border: 1px solid color-mix(in srgb, var(--orange) 30%, transparent);
  }
  .pause-row {
    text-align: right;
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

  /* Mission du jour */
  .mission-card {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mission-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .mission-title {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 4px 0 0;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
  }
  .mission-icon {
    font-size: 22px;
    line-height: 1;
    flex: none;
  }
  .mission-duration {
    flex: none;
    padding: 4px 9px;
    border-radius: 999px;
    background: var(--teal-soft);
    color: var(--teal-deep);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .mission-check {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 2px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.08s;
  }
  .mission-check:active:not(:disabled) {
    transform: scale(0.99);
  }
  .mission-check .box {
    width: 24px;
    height: 24px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 7px;
    border: 2px solid var(--line);
    color: #fff;
    font-size: 15px;
    line-height: 1;
  }
  .mission-check.done {
    border-color: var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
    cursor: default;
  }
  .mission-check.done .box {
    border-color: var(--teal);
    background: var(--teal);
  }
  .proof-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 2px;
  }
  .proof-audio {
    width: 100%;
    height: 36px;
  }
  .proof-error {
    color: var(--rose);
  }
  .link.recording {
    color: var(--rose);
  }

  /* Onglets quêtes */
  .quest-tabs {
    margin-top: 12px;
  }
  .quest-tabs-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .quest-tab {
    flex: 1;
    min-width: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    border-radius: 12px;
    border: 2px solid var(--line);
    background: var(--card);
    color: var(--ink-soft);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.08s;
  }
  .quest-tab:active {
    transform: scale(0.97);
  }
  .quest-tab:hover:not(:disabled) {
    border-color: var(--orange);
  }
  .quest-tab.active {
    border-color: var(--orange);
    background: var(--orange-soft);
    color: var(--orange-deep);
  }
  .quest-tab.done {
    border-color: var(--teal);
    background: var(--teal-soft);
    color: var(--teal-deep);
    cursor: default;
  }
  .quest-tab:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .tier-icon {
    font-size: 18px;
  }
  .tier-name {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .check {
    color: var(--teal);
    font-weight: 700;
  }
  .reward {
    font-size: 9px;
    color: var(--muted);
  }
  .bonus-chest {
    width: 100%;
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    border-radius: 12px;
    border: 2px dashed var(--mango);
    background: var(--mango-soft);
    color: var(--mango-deep);
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 106, 43, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(255, 106, 43, 0); }
  }
  .chest-icon { font-size: 16px; }
  .chest-reward { font-size: 11px; opacity: 0.8; }

  /* Carte quête */
  .quest-card {
    margin-top: 12px;
  }
  .quest-header {
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
  .icon-btn svg { width: 20px; height: 20px; }
  .icon-btn.muted { color: var(--muted); border-color: var(--line); }
  .challenge-prompt { font-size: 13px; color: var(--ink-soft); margin: 8px 0 4px; }
  .challenge-question { font-size: 18px; font-weight: 600; margin: 0 0 12px; }
  .challenge-input-area { display: flex; flex-direction: column; gap: 8px; }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .choice {
    padding: 12px;
    border-radius: 10px;
    border: 2px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 15px;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
  }
  .choice.sel { border-color: var(--orange); background: var(--orange-soft); }
  .tray {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px;
    border-radius: 10px;
    border: 2px solid var(--line);
    background: var(--card);
    min-height: 48px;
  }
  .tray.empty { border-style: dashed; opacity: 0.5; }
  .word { padding: 6px 10px; border-radius: 8px; background: var(--orange-soft); color: var(--orange-deep); font-weight: 600; }
  .bank { display: flex; flex-wrap: wrap; gap: 6px; }
  .bank-word { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font-weight: 500; cursor: pointer; }
  .bank-word.used { opacity: 0.4; cursor: not-allowed; }
  .bank-word:disabled { opacity: 0.4; }
  .placeholder { font-size: 12px; color: var(--muted); align-self: center; }
  .input { padding: 12px 14px; border-radius: 10px; border: 2px solid var(--line); background: var(--card); color: var(--ink); font-family: var(--font-body); font-size: 16px; }
  .input:focus { outline: none; border-color: var(--orange); }
  .link { background: none; border: 0; color: var(--orange); font-size: 13px; cursor: pointer; padding: 4px 0; }
  .link:hover { text-decoration: underline; }
  .hint { font-size: 12px; color: var(--muted); background: var(--orange-soft); padding: 8px 10px; border-radius: 8px; margin-top: 4px; }
  .btn { padding: 12px 16px; border-radius: 10px; border: 0; font-family: var(--font-display); font-weight: 600; font-size: 15px; cursor: pointer; }
  .btn.orange { background: linear-gradient(135deg, var(--mango), var(--orange)); color: #fff; }
  .btn.orange:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.block { width: 100%; }
  .btn.ghost { background: transparent; color: var(--ink-soft); border: 1px solid var(--line); }
  .btn.ghost:disabled { opacity: 0.5; cursor: not-allowed; }
  .fb { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
  .fb-text { display: flex; flex-direction: column; gap: 4px; font-size: 15px; }
  .fb-text strong { font-family: var(--font-display); }
  .fb.good .fb-text strong { color: var(--teal); }
  .fb.bad .fb-text strong { color: var(--rose); }
  .fb-text span { font-size: 13px; color: var(--muted); }
  .quest-reward { display: flex; gap: 16px; font-size: 13px; font-weight: 600; color: var(--mango-deep); padding: 4px 0; }
  .quest-reward span { display: flex; align-items: center; gap: 4px; }

  /* Modal coffre */
  .chest-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 100;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .chest-content {
    background: var(--card);
    border-radius: 20px;
    padding: 24px;
    text-align: center;
    max-width: 320px;
    box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.3);
    animation: popIn 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  @keyframes popIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
  .chest-animation { font-size: 64px; line-height: 1; margin-bottom: 8px; animation: bounce 1s ease infinite; }
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .chest-content h3 { margin: 0 0 8px; font-size: 22px; color: var(--ink); }
  .chest-message { margin: 0 0 16px; font-size: 14px; color: var(--ink-soft); line-height: 1.4; }

  .section-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 26px 2px 8px;
  }
  .section-title h2 { font-size: 18px; }
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
  .unit-band h3 { font-size: 18px; margin-top: 2px; }
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
  .nodes :global(.wrap) { position: relative; z-index: 1; }
  .footer-note { text-align: center; font-size: 11.5px; color: var(--muted); margin-top: 26px; }
</style>