// Effets sonores générés (WebAudio) + synthèse vocale robuste.
//
// Deux moteurs sont utilisés, dans cet ordre :
//   1. Web Speech API (navigateurs modernes, Android, iOS, Windows, macOS).
//   2. Commande Rust native (`speak_native`) appelée via Tauri : espeak-ng,
//      espeak ou spd-say. Indispensable sous Linux / WebKitGTK, qui
//      n'implémente pas — ou très mal — `window.speechSynthesis`.
//
// Toutes les API navigateur optionnelles sont vérifiées avant usage.

let audioCtx: AudioContext | null = null;
let voicesLoaded = false;
let availableVoices: SpeechSynthesisVoice[] = [];

/** Vrai si l'application tourne dans la WebView Tauri. */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Moteur TTS natif (Rust). `undefined` = pas encore testé, `null` = absent.
let nativeBackend: string | null | undefined = undefined;
let nativeChecked = false;

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
  // Dans la WebView, le contexte peut démarrer suspendu : on le réveille
  // à chaque son (l'appel vient d'un geste utilisateur).
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  correct(): void {
    // Accord ascendant, clair et court.
    tone(660, 0.14, 'sine', 0.09);
    window.setTimeout(() => tone(880, 0.18, 'sine', 0.09), 85);
  },
  wrong(): void {
    // Buzz descendant, distinct du succès.
    tone(220, 0.16, 'sawtooth', 0.06);
    window.setTimeout(() => tone(165, 0.22, 'sawtooth', 0.05), 110);
  },
  tap(): void {
    tone(520, 0.06, 'sine', 0.05);
  },
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.2, 'sine', 0.08), i * 105));
  },
};

// ------------------------- Moteur natif (Rust) -------------------------

/** Demande à Rust quel moteur TTS système est installé. */
async function detectNativeTts(): Promise<string | null> {
  if (!isTauri()) return null;
  if (nativeChecked) return nativeBackend ?? null;
  nativeChecked = true;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const backend = await invoke<string | null>('tts_backend');
    nativeBackend = backend;
    console.log('[audio] moteur TTS natif détecté :', backend ?? 'aucun (installe espeak-ng ou spd-say)');
  } catch (err) {
    console.warn('[audio] impossible d’interroger le TTS natif :', err);
    nativeBackend = null;
  }
  return nativeBackend ?? null;
}

/** Lance la prononciation via la commande Rust. Retourne true si lancée. */
async function speakNative(text: string, lang: string): Promise<boolean> {
  if (!isTauri()) return false;
  const backend = await detectNativeTts();
  if (!backend) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('speak_native', { text, lang });
    console.log('[audio] lecture native via', backend, ':', text);
    return true;
  } catch (err) {
    console.warn('[audio] échec du TTS natif :', err);
    return false;
  }
}

// ------------------- Moteur Edge TTS (voix neuronale) -------------------
//
// Microsoft Edge « Read Aloud » : voix neuronale très naturelle, gratuite,
// sans clé API. On l'appelle via la commande Rust `synthesize_edge_tts`
// (Tauri uniquement), on joue le MP3 reçu en Blob, et on retombe sur la voix
// locale du système si le réseau est absent ou le service indisponible.

let edgeAudioEl: HTMLAudioElement | null = null;
let edgeObjectUrl: string | null = null;

function stopEdgeAudio(): void {
  if (edgeAudioEl) {
    try {
      edgeAudioEl.pause();
      edgeAudioEl.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}

function revokeEdgeUrl(): void {
  if (edgeObjectUrl) {
    URL.revokeObjectURL(edgeObjectUrl);
    edgeObjectUrl = null;
  }
}

/**
 * Synthétise et joue un texte avec la voix neuronale Microsoft Edge.
 * Résout `true` si la lecture a abouti, `false` s'il faut basculer sur la
 * voix locale (hors ligne, commande absente, format audio non supporté…).
 */
async function speakEdge(text: string, lang: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // Borne l'attente réseau : sans internet, on ne bloque pas l'app.
    const bytes = await Promise.race([
      invoke<number[] | Uint8Array>('synthesize_edge_tts', { text, lang }),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('délai Edge TTS dépassé')), 8000)
      ),
    ]);

    const data = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    if (data.length === 0) return false;

    // Copie dans un ArrayBuffer standard (compatible BlobPart).
    const buffer = new Uint8Array(data).buffer;
    const blob = new Blob([buffer], { type: 'audio/mpeg' });
    revokeEdgeUrl();
    edgeObjectUrl = URL.createObjectURL(blob);

    if (!edgeAudioEl) {
      edgeAudioEl = new Audio();
      edgeAudioEl.preload = 'auto';
    }
    stopEdgeAudio();
    edgeAudioEl.src = edgeObjectUrl;

    await new Promise<void>((resolve, reject) => {
      const el = edgeAudioEl!;
      const cleanup = (): void => {
        el.onended = null;
        el.onerror = null;
      };
      el.onended = () => {
        cleanup();
        resolve();
      };
      el.onerror = () => {
        cleanup();
        reject(new Error('lecture Edge TTS échouée'));
      };
      el.play().catch((err) => {
        cleanup();
        reject(err);
      });
    });

    console.log('[audio] lecture Edge TTS :', text);
    return true;
  } catch (err) {
    console.warn('[audio] Edge TTS indisponible → voix locale :', err);
    return false;
  }
}

// --------------------- Moteur Web Speech API ---------------------------

/**
 * Charge les voix disponibles.
 * WebKitGTK renvoie souvent une liste vide au démarrage : on écoute
 * `voiceschanged`, on sonde `getVoices()` et on borne l'attente.
 */
function ensureVoicesLoaded(): Promise<void> {
  if (!hasSpeechSynthesis()) return Promise.resolve();
  const synth = window.speechSynthesis!;

  const current = synth.getVoices();
  if (current.length > 0) {
    availableVoices = current;
    voicesLoaded = true;
    return Promise.resolve();
  }
  if (voicesLoaded) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (source: string): void => {
      if (settled) return;
      settled = true;
      availableVoices = synth.getVoices();
      voicesLoaded = true;
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
      }
      synth.onvoiceschanged = null;
      const langs = availableVoices.map((v) => v.lang).join(', ');
      console.log(`[audio] voix Web Speech (${source}) : ${availableVoices.length}${langs ? ` [${langs}]` : ''}`);
      resolve();
    };
    const onVoicesChanged = (): void => finish('voiceschanged');

    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', onVoicesChanged);
    }
    synth.onvoiceschanged = onVoicesChanged;

    // Certains moteurs remplissent la liste juste après le premier tick.
    window.setTimeout(() => {
      if (synth.getVoices().length > 0) finish('poll');
    }, 250);
    // WebKitGTK peut ne jamais émettre l'événement : on rend la main.
    window.setTimeout(() => finish('timeout'), 1200);
  });
}

/** Choisit la meilleure voix pour une langue. */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (availableVoices.length === 0) return null;

  const base = lang.split('-')[0];
  const exact = availableVoices.filter((v) => v.lang === lang);
  const sameLanguage = availableVoices.filter((v) => v.lang.startsWith(base));
  const pool = exact.length > 0 ? exact : sameLanguage.length > 0 ? sameLanguage : availableVoices;

  // Voix réputées claires et naturelles (navigateurs et OS courants).
  const preferred = [
    'Google US English',
    'Google UK English Female',
    'Samantha',
    'Ava',
    'Aria',
    'Jenny',
    'Zira',
    'Serena',
    'Karen',
    'Moira',
  ];
  const nice = pool.find((v) => preferred.some((name) => v.name.includes(name)));
  if (nice) return nice;

  // Sinon : éviter les voix robotiques quand une alternative existe.
  const notRobotic = pool.find((v) => !/espeak|compact|robot/i.test(v.name));
  return notRobotic ?? pool[0] ?? null;
}

/** State pour éviter les coupures intempestives. */
let speakQueue: Array<{ text: string; lang: string; resolve: () => void }> = [];
let isSpeaking = false;

function processQueue(): void {
  if (!hasSpeechSynthesis() || availableVoices.length === 0) {
    // Pas de moteur Web Speech utilisable : on vide la file (le fallback
    // natif est déclenché en amont, dans speak()).
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
  
  // Paramètres par langue pour une meilleure qualité
  if (lang.startsWith('fr')) {
    u.rate = 0.9;
    u.pitch = 1.0;
    u.volume = 1.0;
  } else if (lang.startsWith('en')) {
    u.rate = 0.88;
    u.pitch = 1.02;
    u.volume = 1.0;
  } else {
    u.rate = 0.92;
    u.pitch = 1.0;
    u.volume = 1.0;
  }

  const voice = pickVoice(lang);
  if (voice) {
    u.voice = voice;
    console.log('[audio] voix utilisée :', voice.name, voice.lang);
  }

  let fellBack = false;
  const fallback = (): void => {
    if (fellBack) return;
    fellBack = true;
    void speakNative(text, lang);
  };

  u.onend = () => {
    isSpeaking = false;
    resolve();
    processQueue();
  };
  u.onerror = (e) => {
    // 'interrupted' arrive quand on appelle cancel() : ce n'est pas une panne.
    if (e.error !== 'interrupted') {
      console.warn('[audio] erreur Web Speech :', e.error, '→ repli natif');
      fallback();
    }
    isSpeaking = false;
    resolve();
    processQueue();
  };

  try {
    window.speechSynthesis!.speak(u);
  } catch (err) {
    console.warn('[audio] speak() a levé une exception :', err, '→ repli natif');
    fallback();
    isSpeaking = false;
    resolve();
    processQueue();
  }
}

/**
 * Prononce un texte (anglais par défaut).
 *
 * Ordre : voix neuronale Edge (Tauri) si le réseau répond, sinon Web Speech,
 * sinon commande Rust native (espeak-ng / espeak / spd-say). Résout toujours
 * sans lever d'erreur.
 */
export async function speak(text: string, lang = 'en-US'): Promise<void> {
  if (!text.trim()) return;

  // Reprendre le contexte audio si suspendu (politique navigateur).
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }

  // 1) Voix neuronale Microsoft Edge (haute qualité) sous Tauri.
  if (await speakEdge(text, lang)) return;

  // 2) Repli local : Web Speech puis moteur natif.
  if (hasSpeechSynthesis()) {
    await ensureVoicesLoaded();
    if (availableVoices.length > 0) {
      return new Promise((resolve) => {
        speakQueue.push({ text, lang, resolve });
        processQueue();
      });
    }
    console.warn('[audio] Web Speech présent mais aucune voix (WebKitGTK ?) → repli natif');
  } else {
    console.log('[audio] Web Speech indisponible → repli natif');
  }

  const ok = await speakNative(text, lang);
  if (!ok) {
    console.warn('[audio] aucun moteur TTS disponible pour :', text);
  }
  // Toujours résoudre pour ne pas bloquer la file d'attente
}

/** Arrête toute synthèse en cours. */
export function cancelSpeech(): void {
  stopEdgeAudio();
  if (hasSpeechSynthesis()) {
    window.speechSynthesis!.cancel();
    speakQueue = [];
    isSpeaking = false;
  }
  if (isTauri()) {
    void (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('stop_native_speech');
      } catch { /* moteur natif absent : rien à arrêter */ }
    })();
  }
}

/** Précharge les voix au démarrage (appeler après interaction utilisateur). */
export async function warmUpSpeech(): Promise<void> {
  if (hasSpeechSynthesis()) await ensureVoicesLoaded();
  if (isTauri()) void detectNativeTts();
  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }
}

/**
 * Indique si un moteur de synthèse est disponible.
 * Sous Tauri, on répond oui par optimisme : le moteur natif sera sondé au
 * premier clic (sinon les boutons 🔊 seraient masqués sous WebKitGTK).
 */
export function isSpeechAvailable(): boolean {
  return hasSpeechSynthesis() || isTauri();
}
