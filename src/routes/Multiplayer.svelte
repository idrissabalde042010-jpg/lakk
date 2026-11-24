<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { supabase, joinMatchmaking, leaveMatchmaking, findMatch, createBotMatch, subscribeToMatch, subscribeToRounds, submitRoundAnswer, nextTurn, finishMatch, type MatchmakingQueueEntry, type MultiplayerMatch } from '../lib/supabase';
  import { BotMatch, createBot, BOT_DIFFICULTIES, type BotConfig, type BotMatchState, type RoundResult } from '../lib/bot';
  import { sfx, speak } from '../lib/audio';
  import { locale, _ } from 'svelte-i18n';

  // États de l'interface
  let state: 'idle' | 'searching' | 'matched' | 'playing' | 'round_result' | 'match_end' = $state('idle');
  let queueEntry: MatchmakingQueueEntry | null = $state(null);
  let match: MultiplayerMatch | null = $state(null);
  let matchChannel: ReturnType<typeof supabase.channel> | null = $state(null);
  let roundsChannel: ReturnType<typeof supabase.channel> | null = $state(null);
  let botMatch: BotMatch | null = $state(null);
  
  // Données du round actuel
  let currentQuestion = $state('');
  let currentOptions: string[] = $state([]);
  let correctAnswer = $state('');
  let playerAnswer: string | null = $state(null);
  let botAnswer: string | null = $state(null);
  let playerCorrect: boolean | null = $state(null);
  let botCorrect: boolean | null = $state(null);
  let roundNumber = $state(1);
  let isBotMatch = $state(false);
  
  // Timer pour chercher un match
  let searchStartTime = $state(0);
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let matchCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Profil du joueur actuel
  const p = $derived(app.profile);

  // Générer une question de vocabulaire pour le duel
  function generateDuelQuestion(): { question: string; correctAnswer: string; options: string[] } {
    const learnedWords = Object.values(app.data.cards).map(c => c.vocab);
    if (learnedWords.length === 0) {
      // Mots par défaut si aucun vocabulaire appris
      const defaults = [
        { en: 'hello', fr: 'bonjour' },
        { en: 'goodbye', fr: 'au revoir' },
        { en: 'thank you', fr: 'merci' },
        { en: 'please', fr: 's\'il vous plaît' },
        { en: 'yes', fr: 'oui' },
        { en: 'no', fr: 'non' },
      ];
      const correct = defaults[Math.floor(Math.random() * defaults.length)];
      const options = [...new Set([correct.en, ...defaults.filter(d => d.en !== correct.en).slice(0, 2).map(d => d.en)])]
        .sort(() => Math.random() - 0.5);
      return {
        question: `Comment dit-on "${correct.fr}" en anglais ?`,
        correctAnswer: correct.en,
        options,
      };
    }

    const correct = learnedWords[Math.floor(Math.random() * learnedWords.length)];
    const otherWords = learnedWords.filter(w => w.en !== correct.en);
    const distractors = otherWords
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map(w => w.en);
    
    const options = [correct.en, ...distractors].sort(() => Math.random() - 0.5);
    
    return {
      question: `Comment dit-on "${correct.fr}" en anglais ?`,
      correctAnswer: correct.en,
      options,
    };
  }

  // Démarrer la recherche de match
  async function startSearch(): Promise<void> {
    if (!p || !p.name) return;
    
    state = 'searching';
    searchStartTime = Date.now();
    
    try {
      const queueId = await joinMatchmaking(
        p.name, // Utiliser le nom comme ID pour l'instant
        p.name,
        p.avatar || '🦁'
      );
      
      queueEntry = { 
        id: queueId, 
        user_id: p.name, 
        user_name: p.name, 
        user_avatar: p.avatar || '🦁',
        status: 'waiting',
        matched_with: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Vérifier toutes les 2 secondes si un match est trouvé
      matchCheckInterval = setInterval(async () => {
        const result = await findMatch(queueId, p.name);
        if (result) {
          clearInterval(matchCheckInterval!);
          matchCheckInterval = null;
          
          const matchData = await getMatchDetails(result.matchId);
          if (matchData) {
            match = matchData;
            isBotMatch = result.isBot;
            startMatch(matchData, result.isBot);
          }
        } else {
          // Après 5 secondes sans adversaire, proposer un bot
          const elapsed = (Date.now() - searchStartTime) / 1000;
          if (elapsed >= 5) {
            clearInterval(matchCheckInterval!);
            matchCheckInterval = null;
            await startBotMatch();
          }
        }
      }, 2000);
      
    } catch (e) {
      console.error('[Multiplayer] Erreur recherche match:', e);
      state = 'idle';
    }
  }

  // Récupérer les détails complets d'un match
  async function getMatchDetails(matchId: string): Promise<MultiplayerMatch | null> {
    const { data, error } = await supabase
      .from('multiplayer_matches')
      .select(`
        *,
        player1:profiles!player1_id(name, avatar),
        player2:profiles!player2_id(name, avatar)
      `)
      .eq('id', matchId)
      .single();

    if (error) return null;
    return data as MultiplayerMatch;
  }

  // Démarrer un match contre un bot
  async function startBotMatch(): Promise<void> {
    try {
      const matchId = await createBotMatch(p.name, p.name, p.avatar || '🦁');
      const matchData = await getMatchDetails(matchId);
      if (matchData) {
        match = matchData;
        isBotMatch = true;
        startMatch(matchData, true);
      }
    } catch (e) {
      console.error('[Multiplayer] Erreur bot match:', e);
      state = 'idle';
    }
  }

  // Démarrer un match (joueur vs joueur ou joueur vs bot)
  function startMatch(matchData: MultiplayerMatch, isBot: boolean): void {
    state = 'playing';
    isBotMatch = isBot;
    
    // S'abonner aux mises à jour du match
    matchChannel = subscribeToMatch(matchData.id, (payload) => {
      if (payload.new) {
        match = payload.new as MultiplayerMatch;
      }
    });
    
    roundsChannel = subscribeToRounds(matchData.id, (payload) => {
      // Gérer les nouveaux rounds
      console.log('[Multiplayer] Nouveau round:', payload);
    });
    
    nextRound();
  }

  // Passer au round suivant
  function nextRound(): void {
    roundNumber = (match?.round_number || 0) + 1;
    playerAnswer = null;
    botAnswer = null;
    playerCorrect = null;
    botCorrect = null;
    state = 'playing';
    
    const q = generateDuelQuestion();
    currentQuestion = q.question;
    currentOptions = q.options;
    correctAnswer = q.correctAnswer;
    
    // Si c'est un bot, il attend le joueur
    if (isBotMatch) {
      // Le bot répondra après que le joueur ait répondu
    }
  }

  // Le joueur répond
  async function submitPlayerAnswer(answer: string): Promise<void> {
    if (!match || playerAnswer !== null) return;
    
    playerAnswer = answer;
    playerCorrect = answer === correctAnswer;
    
    // Son
    if (playerCorrect) {
      sfx.correct?.();
    } else {
      sfx.wrong?.();
    }
    
    // Prononcer la réponse
    speak(correctAnswer, 'en-US');
    
    // Si match contre bot, le bot répond
    if (isBotMatch) {
      await handleBotTurn();
    } else {
      // En multijoueur réel, envoyer la réponse au serveur
      await submitRoundAnswer(
        match.id,
        roundNumber,
        'player1', // Simplifié : on est toujours player1
        answer,
        playerCorrect
      );
      state = 'round_result';
    }
  }

  // Gérer le tour du bot
  async function handleBotTurn(): Promise<void> {
    const botConfig = BOT_DIFFICULTIES.normal;
    const botMatchState: BotMatchState = {
      matchId: match!.id,
      botId: 'bot',
      config: botConfig,
      currentRound: roundNumber,
      botScore: match!.player2_score,
      playerScore: match!.player1_score,
      isBotTurn: true,
      onBotAnswer: (answer: string, isCorrect: boolean) => {
        botAnswer = answer;
        botCorrect = isCorrect;
        state = 'round_result';
      },
      onRoundEnd: async (roundData: RoundResult) => {
        // Mettre à jour les scores locaux
        if (roundData.playerCorrect) match!.player1_score++;
        if (roundData.botCorrect) match!.player2_score++;
        
        // Vérifier fin de match
        if (roundNumber >= 5) {
          await endMatch();
        }
      },
      onMatchEnd: (winner) => {
        showMatchEnd(winner);
      },
    };
    
    botMatch = new BotMatch(botMatchState);
    botMatch.startBotTurn(
      currentQuestion,
      correctAnswer,
      currentOptions,
      playerAnswer!,
      playerCorrect!
    );
  }

  // Fin du match
  async function endMatch(): Promise<void> {
    state = 'match_end';
    
    if (matchChannel) {
      matchChannel.unsubscribe();
      matchChannel = null;
    }
    if (roundsChannel) {
      roundsChannel.unsubscribe();
      roundsChannel = null;
    }
    if (botMatch) {
      botMatch.stop();
      botMatch = null;
    }
    
    // Déterminer le gagnant
    let winner: 'bot' | 'player' | 'draw' = 'draw';
    if (match) {
      if (match.player1_score > match.player2_score) winner = 'player';
      else if (match.player2_score > match.player1_score) winner = 'bot';
    }
    
    if (!isBotMatch && match) {
      await finishMatch(match.id, winner === 'player' ? match.player1_id : winner === 'bot' ? match.player2_id : null);
    }
  }

  // Afficher le résultat final
  function showMatchEnd(winner: 'bot' | 'player' | 'draw'): void {
    state = 'match_end';
    // Le composant affichera le résultat
  }

  // Annuler la recherche
  function cancelSearch(): void {
    if (queueEntry) {
      leaveMatchmaking(queueEntry.id);
      queueEntry = null;
    }
    if (matchCheckInterval) {
      clearInterval(matchCheckInterval);
      matchCheckInterval = null;
    }
    state = 'idle';
  }

  // Rejouer
  function playAgain(): void {
    state = 'idle';
    match = null;
    isBotMatch = false;
    roundNumber = 1;
  }

  // Nettoyage au démontage
  onDestroy(() => {
    cancelSearch();
    if (matchChannel) matchChannel.unsubscribe();
    if (roundsChannel) roundsChannel.unsubscribe();
    if (botMatch) botMatch.stop();
  });
</script>

<div class="multiplayer rise">
  {#if state === 'idle'}
    <div>
      <header class="head">
        <h1>⚔️ {$_('multiplayer.title')}</h1>
        <p class="small muted">{$_('multiplayer.subtitle')}</p>
      </header>
      
      <div class="mode-select">
        <button class="mode-btn" onclick={startSearch}>
          <span class="mode-icon">🔍</span>
          <div>
            <strong>{$_('multiplayer.find_match')}</strong>
            <span class="small muted">{$_('multiplayer.find_match_desc')}</span>
          </div>
        </button>
        <button class="mode-btn" onclick={startBotMatch}>
          <span class="mode-icon">🤖</span>
          <div>
            <strong>{$_('multiplayer.vs_bot')}</strong>
            <span class="small muted">{$_('multiplayer.vs_bot_desc')}</span>
          </div>
        </button>
      </div>
    </div>

  {:else if state === 'searching'}
    <div>
      <header class="head">
        <h1>🔍 {$_('multiplayer.searching')}</h1>
      </header>
      <div class="searching">
        <div class="spinner"></div>
        <p>{$_('multiplayer.searching_desc')}</p>
        <p class="small muted">{$_('multiplayer.bot_fallback')}</p>
        <div class="search-timer">
          ⏱ {Math.floor((Date.now() - searchStartTime) / 1000)}s
        </div>
        <button class="btn ghost block" onclick={cancelSearch}>{$_('common.cancel')}</button>
      </div>
    </div>

  {:else if state === 'matched'}
    <div>
      <header class="head">
        <h1>✅ {$_('multiplayer.match_found')}</h1>
      </header>
      <div class="matched">
        <p>{$_('multiplayer.preparing')}</p>
      </div>
    </div>

  {:else if state === 'playing'}
    <div>
      <header class="head">
        <div class="score-board">
          <div class="player-score">
            <span class="avatar">{p.avatar || '🦁'}</span>
            <span class="name">{p.name}</span>
            <span class="score">{match?.player1_score || 0}</span>
          </div>
          <div class="round-info">Round {roundNumber} / 5</div>
          <div class="player-score opponent">
            <span class="avatar">{isBotMatch ? '🤖' : (match?.player2_avatar || '👤')}</span>
            <span class="name">{isBotMatch ? 'Bot Lakk' : (match?.player2_name || 'Adversaire')}</span>
            <span class="score">{match?.player2_score || 0}</span>
          </div>
        </div>
      </header>
      
      <div class="game-area">
        <div class="question-card">
          <p class="question">{currentQuestion}</p>
          <div class="options">
            {#each currentOptions as opt}
              <button
                class="option-btn"
                class:selected={playerAnswer === opt}
                class:correct={playerCorrect !== null && playerCorrect && playerAnswer === opt}
                class:wrong={playerCorrect !== null && !playerCorrect && playerAnswer === opt}
                disabled={playerAnswer !== null}
                onclick={() => submitPlayerAnswer(opt)}
              >
                {opt}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>

  {:else if state === 'round_result'}
    <div>
      <header class="head">
        <div class="score-board">
          <div class="player-score">
            <span class="avatar">{p.avatar || '🦁'}</span>
            <span class="name">{p.name}</span>
            <span class="score">{match?.player1_score || 0}</span>
          </div>
          <div class="round-info">Round {roundNumber} / 5</div>
          <div class="player-score opponent">
            <span class="avatar">{isBotMatch ? '🤖' : (match?.player2_avatar || '👤')}</span>
            <span class="name">{isBotMatch ? 'Bot Lakk' : (match?.player2_name || 'Adversaire')}</span>
            <span class="score">{match?.player2_score || 0}</span>
          </div>
        </div>
      </header>
      
      <div class="result-card">
        <div class="player-result">
          <span class="avatar">{p.avatar || '🦁'}</span>
          <div>
            <strong>{p.name}</strong>
            <span class="answer {playerCorrect ? 'correct' : 'wrong'}">
              {playerAnswer}
              {playerCorrect ? ' ✓' : ' ✗'}
            </span>
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="player-result">
          <span class="avatar">{isBotMatch ? '🤖' : (match?.player2_avatar || '👤')}</span>
          <div>
            <strong>{isBotMatch ? 'Bot Lakk' : (match?.player2_name || 'Adversaire')}</strong>
            <span class="answer {botCorrect ? 'correct' : 'wrong'}">
              {botAnswer}
              {botCorrect ? ' ✓' : ' ✗'}
            </span>
          </div>
        </div>
        <p class="correct-answer">💡 Bonne réponse : <strong>{correctAnswer}</strong></p>
        <button class="btn orange block" onclick={nextRound}>Round suivant</button>
      </div>
    </div>

  {:else if state === 'match_end'}
    <div>
      <header class="head">
        <h1>🏁 {$_('multiplayer.match_over')}</h1>
      </header>
      <div class="final-result">
        <div class="winner">
          {#if match}
            <div class="final-score">
              <div class="player-final">
                <span class="avatar">{p.avatar || '🦁'}</span>
                <span class="name">{p.name}</span>
                <span class="score">{match.player1_score}</span>
              </div>
              <span class="vs">VS</span>
              <div class="player-final">
                <span class="avatar">{isBotMatch ? '🤖' : (match.player2_avatar || '👤')}</span>
                <span class="name">{isBotMatch ? 'Bot Lakk' : (match.player2_name || 'Adversaire')}</span>
                <span class="score">{match.player2_score}</span>
              </div>
            </div>
          {/if}
          <p class="winner-text">
            {match?.player1_score === match?.player2_score ? 'Match nul !' : 
             match && match.player1_score > match.player2_score ? '🎉 Tu as gagné !' : '😔 Défaite...'}
          </p>
        </div>
        <div class="final-actions">
          <button class="btn orange block" onclick={playAgain}>Rejouer</button>
          <button class="btn ghost block" onclick={cancelSearch}>Retour au menu</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .multiplayer { padding: 0 16px 24px; }
  .head { padding: 20px 0 16px; text-align: center; }
  .head h1 { margin: 0; font-size: 22px; }
  .small { font-size: 13px; }
  .muted { color: var(--muted); }

  /* Mode select */
  .mode-select { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
  .mode-btn {
    display: flex; align-items: center; gap: 14px;
    padding: 18px; border-radius: 16px;
    border: 2px solid var(--line); background: var(--card);
    cursor: pointer; text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .mode-btn:active { transform: scale(0.98); }
  .mode-btn:hover { border-color: var(--orange); box-shadow: 0 8px 24px -8px var(--orange); }
  .mode-icon { font-size: 28px; flex: none; }
  .mode-btn strong { display: block; font-size: 16px; margin-bottom: 4px; }
  .mode-btn .small { color: var(--muted); font-size: 13px; }

  /* Searching */
  .searching { text-align: center; padding: 40px 20px; }
  .spinner {
    width: 56px; height: 56px; margin: 0 auto 24px;
    border: 4px solid var(--line); border-top-color: var(--orange);
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .search-timer { margin: 16px 0; font-family: var(--font-display); font-size: 28px; color: var(--orange); }

  /* Matched */
  .matched { text-align: center; padding: 40px 20px; }

  /* Game area */
  .game-area { padding: 16px 0; }
  .score-board {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px; background: var(--card); border-radius: 12px; margin-bottom: 16px;
  }
  .player-score {
    display: flex; align-items: center; gap: 8px; flex: 1;
  }
  .player-score.opponent { flex-direction: row-reverse; }
  .player-score .avatar { font-size: 24px; }
  .player-score .name { font-weight: 600; font-size: 14px; }
  .player-score .score {
    font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--orange);
    background: var(--orange-soft); padding: 4px 10px; border-radius: 999px;
  }
  .round-info {
    text-align: center; font-size: 13px; color: var(--muted);
    background: var(--paper); padding: 4px 12px; border-radius: 999px;
  }

  .question-card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
  .question { font-size: 18px; font-weight: 600; margin: 0 0 16px; text-align: center; }
  .options { display: flex; flex-direction: column; gap: 10px; }
  .option-btn {
    padding: 16px; border-radius: 12px; border: 2px solid var(--line);
    background: var(--card); font-size: 16px; font-weight: 500; cursor: pointer;
    transition: all 0.12s;
  }
  .option-btn:hover:not(:disabled) { border-color: var(--orange); background: var(--orange-soft); }
  .option-btn:disabled { cursor: default; }
  .option-btn.selected { border-color: var(--orange); background: var(--orange-soft); }
  .option-btn.correct { border-color: var(--teal); background: var(--teal-soft); color: var(--teal-deep); }
  .option-btn.wrong { border-color: var(--rose); background: var(--rose-soft); color: var(--rose); }

  /* Round result */
  .result-card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; margin-top: 16px; }
  .player-result { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; margin-bottom: 12px; }
  .player-result:first-child { background: var(--orange-soft); }
  .player-result:last-child { background: var(--blue-soft); }
  .player-result .avatar { font-size: 28px; }
  .player-result strong { font-size: 15px; }
  .answer { font-size: 14px; margin-top: 4px; display: block; }
  .answer.correct { color: var(--teal); font-weight: 600; }
  .answer.wrong { color: var(--rose); }
  .vs { text-align: center; font-weight: 700; color: var(--muted); margin: 8px 0; }
  .correct-answer { text-align: center; margin-top: 16px; color: var(--ink-soft); }

  /* Match end */
  .final-result { text-align: center; padding: 20px; }
  .final-score { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px 0; }
  .player-final { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .player-final .avatar { font-size: 40px; }
  .player-final .name { font-weight: 600; }
  .player-final .score { font-family: var(--font-display); font-size: 32px; font-weight: 700; color: var(--orange); }
  .vs { font-size: 20px; font-weight: 700; color: var(--muted); }
  .winner-text { font-size: 20px; font-weight: 700; margin: 20px 0; }
  .final-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
  .final-actions .btn { width: 100%; }
</style>