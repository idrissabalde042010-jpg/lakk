// Effets sonores générés (WebAudio) + synthèse vocale robuste (Web Speech API).
// Gestion du chargement des voix, interaction utilisateur requise, fallback.
// Toutes les API navigateur optionnelles sont vérifiées avant usage.

let audioCtx: AudioContext | null = null;
let voicesLoaded = false;
let availableVoices: SpeechSynthesisVoice[] = [];

/** Vérifie si l'API Web Speech est disponible. */
function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' &&
         'speechSynthesis' in window &&
         typeof window.speechSynthesis !== 'undefined' &&
         'SpeechSynthesisUtterance' in window;
}

/** Vérifie si WebAudio est disponible. */
function hasWebAudio(): boolean {
  return typeof window !== 'undefined' &&
         ('AudioContext' in window || 'webkitAudioContext' in window);
}

function getAudioContext(): AudioContext | null {
  if (!hasWebAudio()) return null;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.06): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  correct(): void {
    tone(660, 0.12, 'sine', 0.05);
    window.setTimeout(() => tone(880, 0.16, 'sine', 0.05), 90);
  },
  wrong(): void {
    tone(200, 0.2, 'sawtooth', 0.04);
  },
  tap(): void {
    tone(440, 0.05, 'sine', 0.025);
  },
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.18, 'sine', 0.05), i * 110));
  },
};

/** Charge les voix disponibles (asynchrone sur certains navigateurs). */
function ensureVoicesLoaded(): Promise<void> {
  if (!hasSpeechSynthesis()) return Promise.resolve();
  if (voicesLoaded) return Promise.resolve();
  
  return new Promise((resolve) => {
    const synth = window.speechSynthesis!;
    const voices = synth.getVoices();
    if (voices.length > 0) {
      availableVoices = voices;
      voicesLoaded = true;
      resolve();
    } else {
      synth.onvoiceschanged = () => {
        availableVoices = synth.getVoices();
        voicesLoaded = true;
        synth.onvoiceschanged = null;
        resolve();
      };
      // Fallback timeout
      window.setTimeout(() => {
        availableVoices = synth.getVoices();
        voicesLoaded = true;
        resolve();
      }, 500);
    }
  });
}

/** Choisit la meilleure voix pour une langue. */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (!hasSpeechSynthesis()) return null;
  const primary = availableVoices.find((v) => v.lang === lang);
  if (primary) return primary;
  const fallback = availableVoices.find((v) => v.lang.startsWith(lang.split('-')[0]));
  if (fallback) return fallback;
  return availableVoices.find((v) => v.lang.startsWith('en')) ?? null;
}

/** State pour éviter les coupures intempestives. */
let speakQueue: Array<{ text: string; lang: string; resolve: () => void }> = [];
let isSpeaking = false;

function processQueue(): void {
  if (!hasSpeechSynthesis()) {
    // Résout la queue immédiatement si pas de synthèse
    while (speakQueue.length > 0) {
      speakQueue.shift()!.resolve();
    }
    return;
  }
  if (isSpeaking || speakQueue.length === 0) return;
  const { text, lang, resolve } = speakQueue.shift()!;
  isSpeaking = true;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.92;
  u.pitch = 1.0;
  u.volume = 1.0;

  const voice = pickVoice(lang);
  if (voice) u.voice = voice;

  u.onend = () => {
    isSpeaking = false;
    resolve();
    processQueue();
  };
  u.onerror = (e) => {
    // Ignore 'interrupted' errors (common when cancel() is called)
    if (e.error !== 'interrupted') console.warn('TTS error:', e.error);
    isSpeaking = false;
    resolve();
    processQueue();
  };

  window.speechSynthesis!.speak(u);
}

/**
 * Prononce un texte en anglais (ou autre langue).
 * Gère la file d'attente pour ne pas couper la synthèse en cours.
 * Nécessite une interaction utilisateur préalable (politique navigateur).
 * Si l'API n'est pas disponible, résout immédiatement sans erreur.
 */
export async function speak(text: string, lang = 'en-US'): Promise<void> {
  if (!hasSpeechSynthesis()) return;
  if (!text.trim()) return;

  // S'assurer que les voix sont chargées
  await ensureVoicesLoaded();

  // Reprendre le contexte audio si suspendu (politique navigateur)
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }

  return new Promise((resolve) => {
    speakQueue.push({ text, lang, resolve });
    processQueue();
  });
}

/** Arrête toute synthèse en cours. */
export function cancelSpeech(): void {
  if (hasSpeechSynthesis()) {
    window.speechSynthesis!.cancel();
    speakQueue = [];
    isSpeaking = false;
  }
}

/** Précharge les voix au démarrage (appeler après interaction utilisateur). */
export async function warmUpSpeech(): Promise<void> {
  if (!hasSpeechSynthesis()) return;
  await ensureVoicesLoaded();
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }
}

/** Indique si la synthèse vocale est disponible. */
export function isSpeechAvailable(): boolean {
  return hasSpeechSynthesis();
}