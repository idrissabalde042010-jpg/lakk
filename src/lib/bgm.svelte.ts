// Musique d'ambiance : un seul lecteur partagé par toute l'application.
// - démarrage uniquement après un geste utilisateur (règle d'autoplay)
// - fondu d'entrée de 2 s jusqu'à 30 % du volume
// - coupure / reprise depuis le profil, état conservé entre les lancements

const TRACK = '/audio/bgm.mp3';
const VOLUME = 0.3;
const FADE_IN_MS = 2000;
const FADE_OUT_MS = 350;
const MUTE_KEY = 'lakk.bgm.muted';
const FADE_STEP_MS = 40;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = $state(readMuted());
let started = $state(false);
let audio: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

export function isBgmMuted(): boolean {
  return muted;
}

/** La musique a-t-elle déjà été lancée au moins une fois ? */
export function isBgmStarted(): boolean {
  return started;
}

function element(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(TRACK);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
  }
  return audio;
}

function stopFade(): void {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

/** Ramène progressivement le volume vers `target`. */
function fadeTo(target: number, durationMs: number, done?: () => void): void {
  const a = element();
  if (!a) return;
  stopFade();

  const from = a.volume;
  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
  let i = 0;

  fadeTimer = setInterval(() => {
    i += 1;
    const ratio = Math.min(1, i / steps);
    a.volume = Math.max(0, Math.min(1, from + (target - from) * ratio));
    if (ratio >= 1) {
      stopFade();
      done?.();
    }
  }, FADE_STEP_MS);
}

function playSafely(a: HTMLAudioElement): void {
  const result = a.play();
  if (result && typeof result.catch === 'function') {
    void result.catch(() => {
      /* lecture refusée : on réessaiera au prochain geste */
    });
  }
}

/** Démarre la musique avec un fondu de 2 secondes (à appeler depuis un clic). */
export function startBgm(): void {
  const a = element();
  if (!a) return;
  started = true;
  if (a.paused) playSafely(a);
  if (muted) {
    a.volume = 0;
    return;
  }
  a.volume = 0;
  fadeTo(VOLUME, FADE_IN_MS);
}

/** Coupe (fondu court puis pause) ou relance la musique. */
export function setBgmMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* ignore */
  }

  const a = element();
  if (!a) return;

  if (next) {
    fadeTo(0, FADE_OUT_MS, () => a.pause());
  } else {
    started = true;
    if (a.paused) playSafely(a);
    fadeTo(VOLUME, 800);
  }
}

export function toggleBgmMuted(): void {
  setBgmMuted(!muted);
}
