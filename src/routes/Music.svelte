<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { sfx, speak, cancelSpeech, isSpeechAvailable } from '../lib/audio';
  import { SONGS, getLineAtTime, getWordAtTime, playLine, playWord, formatTime, type Song, type KaraokeState, type LyricLine } from '../lib/music';

  let selectedSong = $state<Song | null>(null);
  let karaoke: KaraokeState = $state({ song: null, currentLine: 0, currentWord: -1, isPlaying: false, currentTime: 0, showTranslation: true, speed: 1 });
  let animationFrame: number | null = null;
  let lastTick = 0;

  const learnedWords = $derived(new Set(Object.values(app.data.cards).map((c) => c.vocab.en.toLowerCase())));
  const speechAvailable = $derived(isSpeechAvailable());

  function selectSong(song: Song): void {
    selectedSong = song;
    karaoke = { song, currentLine: 0, currentWord: -1, isPlaying: false, currentTime: 0, showTranslation: true, speed: 1 };
    sfx.tap();
  }

  function goBack(): void {
    stopPlayback();
    selectedSong = null;
    karaoke = { song: null, currentLine: 0, currentWord: -1, isPlaying: false, currentTime: 0, showTranslation: true, speed: 1 };
  }

  function togglePlay(): void {
    if (!karaoke.song) return;
    if (karaoke.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback(): void {
    karaoke.isPlaying = true;
    lastTick = performance.now();
    tick();
  }

  function pausePlayback(): void {
    karaoke.isPlaying = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    cancelSpeech();
  }

  function stopPlayback(): void {
    pausePlayback();
    karaoke.currentTime = 0;
    karaoke.currentLine = 0;
    karaoke.currentWord = -1;
  }

  function tick(): void {
    if (!karaoke.isPlaying || !karaoke.song) return;
    const now = performance.now();
    const delta = (now - lastTick) / 1000 * karaoke.speed;
    lastTick = now;
    karaoke.currentTime = Math.min(karaoke.song.duration, karaoke.currentTime + delta);

    // Mettre à jour ligne/mot courant
    karaoke.currentLine = getLineAtTime(karaoke.song, karaoke.currentTime);
    const line = karaoke.song.lyrics[karaoke.currentLine];
    karaoke.currentWord = getWordAtTime(line, karaoke.currentTime - line.time);

    if (karaoke.currentTime >= karaoke.song.duration) {
      stopPlayback();
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function seek(time: number): void {
    karaoke.currentTime = Math.max(0, Math.min(karaoke.song!.duration, time));
    karaoke.currentLine = getLineAtTime(karaoke.song!, karaoke.currentTime);
    const line = karaoke.song!.lyrics[karaoke.currentLine];
    karaoke.currentWord = getWordAtTime(line, karaoke.currentTime - line.time);
  }

  async function playCurrentLine(): Promise<void> {
    if (!karaoke.song) return;
    const line = karaoke.song.lyrics[karaoke.currentLine];
    await playLine(line);
  }

  async function playCurrentWord(): Promise<void> {
    if (!karaoke.song) return;
    const line = karaoke.song.lyrics[karaoke.currentLine];
    if (karaoke.currentWord >= 0) {
      await playWord(line.words[karaoke.currentWord].word);
    }
  }

  function prevLine(): void {
    if (!karaoke.song) return;
    karaoke.currentLine = Math.max(0, karaoke.currentLine - 1);
    karaoke.currentTime = karaoke.song.lyrics[karaoke.currentLine].time;
    karaoke.currentWord = -1;
  }

  function nextLine(): void {
    if (!karaoke.song) return;
    karaoke.currentLine = Math.min(karaoke.song.lyrics.length - 1, karaoke.currentLine + 1);
    karaoke.currentTime = karaoke.song.lyrics[karaoke.currentLine].time;
    karaoke.currentWord = -1;
  }

  function toggleTranslation(): void {
    karaoke.showTranslation = !karaoke.showTranslation;
  }

  function setSpeed(s: number): void {
    karaoke.speed = s;
  }

  function isWordLearned(word: string): boolean {
    return learnedWords.has(word.toLowerCase().replace(/[.,!?]/g, ''));
  }

  function getProgress(): number {
    if (!karaoke.song) return 0;
    return (karaoke.currentTime / karaoke.song.duration) * 100;
  }
</script>

<div class="music rise">
  {#if !selectedSong}
    <!-- Bibliothèque de chansons -->
    <header class="head">
      <h1>🎵 Musique</h1>
      <p class="small muted">Apprends l'anglais en chantant — karaoké interactif</p>
    </header>

    <div class="songs-list">
      {#each SONGS as song}
        <button class="song-card" onclick={() => selectSong(song)}>
          <div class="song-info">
            <h3>{song.title}</h3>
            <p class="small muted">{song.artist} · {song.level} · {formatTime(song.duration)}</p>
            <div class="song-vocab">
              {#each song.vocab.slice(0, 4) as v}
                <span class="vocab-tag" class:learned={isWordLearned(v.en)}>{v.en}</span>
              {/each}
              {#if song.vocab.length > 4}
                <span class="vocab-tag more">+{song.vocab.length - 4}</span>
              {/if}
            </div>
          </div>
          <span class="play-icon">▶</span>
        </button>
      {/each}
    </div>

    <p class="footer-note">Chansons domaine public • Gratuit • Hors ligne (TTS)</p>

  {:else}
    <!-- Lecteur Karaoké -->
    <header class="head">
      <button class="x" onclick={goBack} aria-label="Retour">✕</button>
      <div class="song-title">
        <h3>{selectedSong.title}</h3>
        <p class="small muted">{selectedSong.artist} · {selectedSong.level}</p>
      </div>
      <div class="header-actions">
        <button class="icon-btn" onclick={toggleTranslation} aria-label={karaoke.showTranslation ? 'Cacher traduction' : 'Afficher traduction'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>
          </svg>
        </button>
        <select class="speed-select" bind:value={karaoke.speed} onchange={() => {}}>
          <option value={0.5}>0.5×</option>
          <option value={0.75}>0.75×</option>
          <option value={1} selected>1×</option>
          <option value={1.25}>1.25×</option>
        </select>
      </div>
    </header>

    <div class="karaoke-area">
      <!-- Paroles avec karaoké -->
      <div class="lyrics-container">
        {#each selectedSong.lyrics as line, i}
          <div class="lyric-line" class:active={i === karaoke.currentLine} class:current-word={karaoke.currentLine === i}>
            <span class="line-time">{formatTime(line.time)}</span>
            <button
              type="button"
              class="line-text"
              onclick={() => { karaoke.currentLine = i; karaoke.currentTime = line.time; karaoke.currentWord = -1; if (karaoke.isPlaying) { lastTick = performance.now(); } }}
            >
              {#each line.words as word, wi}
                <span class="word"
                      role="button"
                      tabindex="0"
                      class:current={karaoke.currentLine === i && karaoke.currentWord === wi}
                      class:learned={isWordLearned(word.word)}
                      onclick={() => { if (speechAvailable) playWord(word.word); }}
                      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (speechAvailable) playWord(word.word); } }}>
                  {word.word}
                </span>
              {/each}
            </button>
            {#if karaoke.showTranslation}
              <div class="line-translation">{line.translation}</div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Contrôles playback -->
      <div class="player-controls">
        <div class="progress-bar"
             role="slider"
             aria-label="Progression de la chanson"
             aria-valuemin={0}
             aria-valuemax={100}
             aria-valuenow={Math.round(getProgress())}
             tabindex="0"
             onkeydown={(e) => {
               if (e.key === 'ArrowLeft') seek(karaoke.currentTime - 2);
               else if (e.key === 'ArrowRight') seek(karaoke.currentTime + 2);
             }}
             onclick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; seek(pct * selectedSong!.duration); }}>
          <div class="progress-fill" style={`width: ${getProgress()}%`}></div>
          <div class="progress-handle" style={`left: ${getProgress()}%`}></div>
        </div>
        <div class="time-display">
          <span>{formatTime(karaoke.currentTime)}</span>
          <span>/</span>
          <span>{formatTime(selectedSong.duration)}</span>
        </div>
        <div class="transport">
          <button class="transport-btn" onclick={prevLine} aria-label="Ligne précédente">⏮</button>
          <button class="transport-btn main" onclick={togglePlay} aria-label={karaoke.isPlaying ? 'Pause' : 'Lecture'}>
            {karaoke.isPlaying ? '⏸' : '▶'}
          </button>
          <button class="transport-btn" onclick={nextLine} aria-label="Ligne suivante">⏭</button>
        </div>
        <div class="quick-actions">
          {#if speechAvailable}
            <button class="btn ghost small" onclick={playCurrentLine}>🔊 Ligne</button>
            <button class="btn ghost small" onclick={playCurrentWord}>🔤 Mot</button>
          {:else}
            <span class="btn ghost small muted" aria-label="Audio indisponible">🔊 Audio indisponible</span>
          {/if}
        </div>
      </div>

      <!-- Vocabulaire de la chanson -->
      <details class="vocab-panel">
        <summary>📚 Vocabulaire clé ({selectedSong.vocab.length} mots)</summary>
        <div class="vocab-grid">
          {#each selectedSong.vocab as v}
            <div class="vocab-item" class:learned={isWordLearned(v.en)}>
              <strong>{v.en}</strong>
              <span class="small muted">{v.fr}</span>
              {#if speechAvailable}
                <button class="icon-btn tiny" onclick={() => playWord(v.en)} aria-label="Écouter">🔊</button>
              {:else}
                <span class="icon-btn tiny muted" aria-label="Audio indisponible">🔇</span>
              {/if}
            </div>
          {/each}
        </div>
      </details>
    </div>
  {/if}
</div>

<style>
  .music { padding: 0 16px 20px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 0 12px; }
  .head h1 { margin: 0; }
  .x { width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--line); color: var(--ink-soft); font-size: 18px; cursor: pointer; flex: none; }
  .song-title { flex: 1; text-align: center; }
  .song-title h3 { margin: 0; font-size: 17px; }
  .header-actions { display: flex; gap: 8px; flex: none; }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink-soft); display: grid; place-items: center; cursor: pointer; flex: none; }
  .icon-btn svg { width: 20px; height: 20px; }
  .icon-btn.tiny { width: 28px; height: 28px; }
  .speed-select { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font-size: 13px; cursor: pointer; }

  .songs-list { display: flex; flex-direction: column; gap: 10px; }
  .song-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--card); cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
  .song-card:active { transform: scale(0.99); }
  .song-card:hover { border-color: var(--teal); box-shadow: 0 6px 16px -6px var(--teal); }
  .song-info { flex: 1; text-align: left; }
  .song-info h3 { margin: 0 0 4px; font-size: 16px; }
  .song-vocab { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .vocab-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--orange-soft); color: var(--orange-deep); }
  .vocab-tag.learned { background: var(--teal-soft); color: var(--teal-deep); }
  .vocab-tag.more { background: var(--line); color: var(--muted); }
  .play-icon { font-size: 22px; color: var(--teal); flex: none; }

  .karaoke-area { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
  .lyrics-container { flex: 1; overflow-y: auto; padding: 8px 4px 16px; }
  .lyric-line { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 12px; margin-bottom: 6px; transition: background 0.15s; }
  .lyric-line.active { background: var(--orange-soft); }
  .line-time { font-size: 10px; color: var(--muted); font-family: monospace; align-self: flex-start; }
  .line-text { display: flex; flex-wrap: wrap; gap: 4px; line-height: 2; }
  .word { padding: 2px 6px; border-radius: 6px; cursor: pointer; transition: all 0.1s; font-size: 16px; }
  .word.current { background: var(--mango); color: var(--ink); font-weight: 700; transform: scale(1.1); }
  .word.learned { border-bottom: 2px solid var(--teal); }
  .word:hover { background: var(--teal-soft); color: var(--teal-deep); }
  .line-translation { font-size: 13px; color: var(--muted); padding-left: 4px; animation: fade 0.2s; }
  @keyframes fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

  .player-controls { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .progress-bar { position: relative; height: 8px; border-radius: 999px; background: var(--line); cursor: pointer; }
  .progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--mango), var(--orange)); transition: width 0.1s linear; }
  .progress-handle { position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 50%; background: var(--orange); box-shadow: 0 2px 6px rgba(0,0,0,0.3); transform: translate(-50%, -50%); pointer-events: none; transition: left 0.1s linear; }
  .time-display { display: flex; justify-content: center; gap: 8px; font-size: 12px; color: var(--muted); font-family: monospace; }
  .transport { display: flex; justify-content: center; align-items: center; gap: 16px; }
  .transport-btn { width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--line); color: var(--ink-soft); font-size: 18px; cursor: pointer; display: grid; place-items: center; transition: background 0.15s, transform 0.1s; }
  .transport-btn:active { transform: scale(0.95); }
  .transport-btn.main { width: 56px; height: 56px; background: var(--orange); color: #fff; font-size: 22px; box-shadow: 0 4px 0 var(--orange-deep); }
  .transport-btn.main:active { transform: translateY(2px); box-shadow: 0 2px 0 var(--orange-deep); }
  .quick-actions { display: flex; justify-content: center; gap: 8px; }
  .btn.small { padding: 8px 12px; font-size: 12px; }

  .vocab-panel { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .vocab-panel summary { padding: 12px 16px; font-family: var(--font-display); font-weight: 600; font-size: 14px; cursor: pointer; list-style: none; }
  .vocab-panel summary::-webkit-details-marker { display: none; }
  .vocab-panel summary::before { content: '▸'; margin-right: 8px; color: var(--teal); transition: transform 0.15s; }
  .vocab-panel[open] summary::before { transform: rotate(90deg); }
  .vocab-grid { padding: 0 16px 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .vocab-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px; background: var(--paper); border-radius: 10px; }
  .vocab-item.learned { background: var(--teal-soft); }
  .vocab-item strong { font-size: 14px; }
  .vocab-item .icon-btn.tiny { flex: none; }

  .footer-note { text-align: center; font-size: 11.5px; color: var(--muted); margin-top: 24px; }
</style>