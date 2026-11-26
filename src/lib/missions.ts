// Missions du jour — transfert dans la vraie vie, 100 % local.
// Le tirage est déterministe par date : même jour = même mission, sans serveur.
// Aucune donnée ne quitte l'appareil : la preuve de vie est un audio local.

export type MissionCategory = 'speaking' | 'listening' | 'vocabulary' | 'culture' | 'writing';

export interface Mission {
  id: string;
  title: string;
  hint: string;
  category: MissionCategory;
  duration: string;
  icon: string;
}

/**
 * Deck local de 40 missions. Elles sont volontairement courtes (30 s à 2 min)
 * et utilisent le vocabulaire A1 du parcours Lakk.
 */
export const MISSIONS: readonly Mission[] = [
  { id: 'hello-3', title: 'Dis bonjour à 3 personnes', hint: 'Essaie « Hello! How are you? »', category: 'speaking', duration: '1 min', icon: '👋' },
  { id: 'kitchen-5', title: 'Nomme 5 objets de ta cuisine', hint: 'Table, cup, spoon, water, rice…', category: 'vocabulary', duration: '1 min', icon: '🍳' },
  { id: 'song-2-words', title: 'Écoute une chanson et repère 2 mots', hint: 'Mets pause dès que tu reconnais un mot.', category: 'listening', duration: '2 min', icon: '🎧' },
  { id: 'voice-15s', title: 'Envoie un vocal de 15 s', hint: 'Présente-toi ou raconte ta matinée.', category: 'speaking', duration: '1 min', icon: '🎙️' },
  { id: 'count-20', title: 'Compte de 1 à 20 à voix haute', hint: 'One, two, three… jusqu’à twenty.', category: 'speaking', duration: '30 s', icon: '🔢' },
  { id: 'day-3-sentences', title: 'Décris ta journée en 3 phrases', hint: 'This morning I… Then I… Tonight I…', category: 'speaking', duration: '2 min', icon: '☀️' },
  { id: 'clothes-5', title: 'Nomme 5 vêtements que tu portes', hint: 'Shirt, trousers, shoes, cap, scarf…', category: 'vocabulary', duration: '1 min', icon: '👕' },
  { id: 'street-3-words', title: 'Trouve 3 mots anglais dans la rue', hint: 'Panneaux, boutiques, emballages.', category: 'vocabulary', duration: '2 min', icon: '🛣️' },
  { id: 'radio-1min', title: 'Écoute 1 minute de radio en anglais', hint: 'Ne cherche pas tout comprendre : attrape le ton.', category: 'listening', duration: '2 min', icon: '📻' },
  { id: 'thanks-3', title: 'Dis merci à 3 personnes', hint: '« Thank you! » avec un sourire.', category: 'speaking', duration: '1 min', icon: '🙏' },
  { id: 'colors-5', title: 'Nomme 5 couleurs autour de toi', hint: 'Red, blue, green, yellow, black…', category: 'vocabulary', duration: '30 s', icon: '🎨' },
  { id: 'weather', title: 'Décris le temps qu’il fait', hint: 'It is sunny / cloudy / hot / windy.', category: 'speaking', duration: '1 min', icon: '🌤️' },
  { id: 'teach-word', title: 'Apprends un mot à un proche', hint: 'Choisis un mot de ta dernière leçon.', category: 'culture', duration: '2 min', icon: '🧑‍🏫' },
  { id: 'sing-chorus', title: 'Chante le refrain d’une chanson anglaise', hint: 'Même faux, c’est bon pour la mémoire.', category: 'speaking', duration: '2 min', icon: '🎵' },
  { id: 'animals-5', title: 'Nomme 5 animaux que tu connais', hint: 'Dog, cat, bird, goat, elephant…', category: 'vocabulary', duration: '1 min', icon: '🐘' },
  { id: 'tell-time', title: 'Dis l’heure en anglais', hint: 'It is seven o’clock. It is half past six.', category: 'speaking', duration: '30 s', icon: '🕒' },
  { id: 'write-3-words', title: 'Écris 3 mots dans ton carnet', hint: 'Un mot appris aujourd’hui + sa traduction.', category: 'writing', duration: '1 min', icon: '✍️' },
  { id: 'dialogue-2', title: 'Écoute un dialogue et note 2 expressions', hint: 'Un film, une série, une vidéo courte.', category: 'listening', duration: '2 min', icon: '🎬' },
  { id: 'introduce-self', title: 'Présente-toi en 3 phrases', hint: 'My name is… I live in… I like…', category: 'speaking', duration: '2 min', icon: '🪪' },
  { id: 'body-5', title: 'Nomme 5 parties de ton corps', hint: 'Head, hand, foot, eye, mouth…', category: 'vocabulary', duration: '30 s', icon: '🧍' },
  { id: 'ask-price', title: 'Demande le prix de quelque chose', hint: 'How much is this?', category: 'speaking', duration: '1 min', icon: '🛒' },
  { id: 'family-3', title: 'Décris ta famille en 3 mots', hint: 'Mother, brother, kind, funny…', category: 'vocabulary', duration: '1 min', icon: '👨‍👩‍👧' },
  { id: 'birds-2', title: 'Écoute les oiseaux et nomme 2 sons', hint: 'Tweet, chirp, sing…', category: 'listening', duration: '1 min', icon: '🐦' },
  { id: 'like-3', title: 'Dis 3 choses que tu aimes', hint: 'I like tea. I like music. I like walking.', category: 'speaking', duration: '1 min', icon: '❤️' },
  { id: 'transport-5', title: 'Nomme 5 moyens de transport', hint: 'Bus, car, train, bike, boat…', category: 'vocabulary', duration: '1 min', icon: '🚌' },
  { id: 'read-aloud', title: 'Lis une phrase à voix haute 3 fois', hint: 'Choisis une phrase de ta leçon.', category: 'speaking', duration: '1 min', icon: '📖' },
  { id: 'red-object', title: 'Trouve un objet rouge et nomme-le', hint: 'A red cup, a red shirt…', category: 'vocabulary', duration: '30 s', icon: '🔴' },
  { id: 'goodbye', title: 'Dis au revoir en anglais à quelqu’un', hint: 'Goodbye! See you tomorrow!', category: 'speaking', duration: '30 s', icon: '👋' },
  { id: 'podcast-2min', title: 'Écoute un podcast 2 minutes', hint: 'Note un mot que tu as reconnu.', category: 'listening', duration: '2 min', icon: '🎙️' },
  { id: 'food-5', title: 'Nomme 5 aliments que tu aimes', hint: 'Rice, fish, mango, bread, tea…', category: 'vocabulary', duration: '1 min', icon: '🍲' },
  { id: 'describe-street', title: 'Décris ta rue en 2 phrases', hint: 'My street is… There is…', category: 'speaking', duration: '1 min', icon: '🏘️' },
  { id: 'local-greeting', title: 'Apprends une salutation locale en anglais', hint: 'Demande à un proche comment il dit bonjour.', category: 'culture', duration: '1 min', icon: '🌍' },
  { id: 'spell-numbers', title: 'Dis 3 nombres et épelle-les', hint: 'Seven, eight, nine…', category: 'speaking', duration: '1 min', icon: '🔤' },
  { id: 'jobs-5', title: 'Nomme 5 métiers', hint: 'Teacher, driver, nurse, farmer, seller…', category: 'vocabulary', duration: '1 min', icon: '👩‍⚕️' },
  { id: 'ad-product', title: 'Écoute une pub et repère le produit', hint: 'Une pub radio ou une vidéo courte.', category: 'listening', duration: '1 min', icon: '📺' },
  { id: 'future-sentence', title: 'Dis une phrase au futur', hint: 'Tomorrow I will…', category: 'speaking', duration: '30 s', icon: '⏭️' },
  { id: 'bag-5', title: 'Nomme 5 choses dans ton sac', hint: 'Phone, keys, book, pen, water…', category: 'vocabulary', duration: '1 min', icon: '🎒' },
  { id: 'favorite-dish', title: 'Raconte ton plat préféré en 2 phrases', hint: 'My favourite dish is… It is…', category: 'speaking', duration: '2 min', icon: '🍛' },
  { id: 'gratitude', title: 'Écris une phrase de gratitude', hint: 'Thank you for…', category: 'writing', duration: '1 min', icon: '💌' },
  { id: 'hello-2-langs', title: 'Dis bonjour dans 2 langues', hint: 'English + une langue que tu aimes.', category: 'culture', duration: '30 s', icon: '🗣️' },
];

export interface MissionEntry {
  date: string;
  missionId: string;
  completedAt: number;
}

export type MissionLog = Record<string, MissionEntry>;

const LOG_KEY = 'lakk.missions.v1';
const PROOF_KEY = 'lakk.missions.proofs.v1';
/** Limite de sécurité pour ne pas saturer localStorage. */
const MAX_PROOF_CHARS = 1_800_000;

/** Hash FNV-1a 32 bits : stable, rapide, sans dépendance. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Tirage déterministe : la même date donne toujours la même mission. */
export function dailyMission(date: string, missions: readonly Mission[] = MISSIONS): Mission {
  if (missions.length === 0) throw new Error('Aucune mission disponible');
  return missions[hashString(date) % missions.length];
}

export function missionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadMissionLog(): MissionLog {
  const log = readJson<MissionLog>(LOG_KEY, {});
  return log && typeof log === 'object' ? log : {};
}

export function saveMissionLog(log: MissionLog): void {
  writeJson(LOG_KEY, log);
}

/** Marque la mission du jour comme accomplie (idempotent). */
export function completeMission(date: string, missionId: string, now = Date.now()): MissionLog {
  const log = loadMissionLog();
  if (!log[date]) {
    log[date] = { date, missionId, completedAt: now };
    saveMissionLog(log);
  }
  return log;
}

export function getMissionProof(date: string): string | null {
  const proofs = readJson<Record<string, string>>(PROOF_KEY, {});
  return proofs[date] ?? null;
}

/**
 * Stocke la preuve de vie audio (data URL) localement.
 * Retourne false si le quota est dépassé ou si le stockage est indisponible.
 */
export function saveMissionProof(date: string, dataUrl: string): boolean {
  if (!dataUrl.startsWith('data:audio/')) return false;
  if (dataUrl.length > MAX_PROOF_CHARS) return false;
  const proofs = readJson<Record<string, string>>(PROOF_KEY, {});
  proofs[date] = dataUrl;
  return writeJson(PROOF_KEY, proofs);
}

export interface MissionHistoryItem {
  entry: MissionEntry;
  mission: Mission;
  proof: string | null;
}

/** Historique trié du plus récent au plus ancien, pour le Carnet de terrain. */
export function missionHistory(): MissionHistoryItem[] {
  const log = loadMissionLog();
  return Object.values(log)
    .map((entry) => {
      const mission = missionById(entry.missionId);
      if (!mission) return null;
      return { entry, mission, proof: getMissionProof(entry.date) };
    })
    .filter((item): item is MissionHistoryItem => item !== null)
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date));
}
