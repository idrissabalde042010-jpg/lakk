// Comptes utilisateurs — optionnels, hors-ligne d'abord, sync cloud additive.
// - Mode anonyme : tout dans localStorage (par défaut)
// - Mode compte : email/mot de passe, sauvegarde chiffrée, sync multi-appareils
// - Aucune donnée sensible en clair, pas de tracking, RGPD-friendly.

import { app } from './store.svelte';
import type { Persist } from './store.svelte';

const ACCOUNT_KEY = 'lakk.account';
const SYNC_KEY = 'lakk.sync';
const ANON_KEY = 'lakk.anon';

export interface Account {
  id: string;              // UUID
  email: string;           // hashé pour l'affichage
  emailHash: string;       // SHA-256 pour lookup
  createdAt: number;       // timestamp
  lastSync: number | null; // timestamp
  plan: 'free' | 'pro';    // futur
  settings: AccountSettings;
}

export interface AccountSettings {
  syncEnabled: boolean;
  backupEncrypted: boolean;
  marketingEmails: boolean;
  language: 'fr' | 'en';
}

export interface SyncPayload {
  version: number;
  accountId: string;
  timestamp: number;
  data: Persist;           // état complet (profil, cartes, leçons, historique)
  schemaVersion: number;   // pour migrations futures
}

const DEFAULT_SETTINGS: AccountSettings = {
  syncEnabled: true,
  backupEncrypted: true,
  marketingEmails: false,
  language: 'fr',
};

/** Génère un ID anonyme stable. */
function generateAnonId(): string {
  const stored = localStorage.getItem(ANON_KEY);
  if (stored) return stored;
  const id = 'anon_' + crypto.randomUUID();
  localStorage.setItem(ANON_KEY, id);
  return id;
}

/** Hash simple pour email (affichage masqué). */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash mot de passe (PBKDF2-like via Web Crypto). */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Chiffre les données pour le backup local (AES-GCM). */
async function encryptData(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data));
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Déchiffre les données. */
async function decryptData(encryptedB64: string, password: string): Promise<string> {
  const combined = new Uint8Array(atob(encryptedB64).split('').map((c) => c.charCodeAt(0)));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

/** État du compte (réactif). */
let currentAccount = $state<Account | null>(null);
let isAuthenticated = $state(false);
let syncStatus = $state<'idle' | 'syncing' | 'synced' | 'error'>('idle');
let lastError = $state<string | null>(null);

/** Charge le compte au démarrage. */
export async function loadAccount(): Promise<void> {
  try {
    const stored = localStorage.getItem(ACCOUNT_KEY);
    if (stored) {
      const acc = JSON.parse(stored) as Account;
      currentAccount = acc;
      isAuthenticated = true;
    } else {
      // Mode anonyme
      generateAnonId();
      isAuthenticated = false;
    }
  } catch {
    generateAnonId();
    isAuthenticated = false;
  }
}

/** Crée un compte (email + mot de passe). */
export async function createAccount(email: string, password: string): Promise<Account> {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail.includes('@')) throw new Error('Email invalide');
  if (password.length < 6) throw new Error('Mot de passe trop court (min 6 caractères)');

  const emailHash = await hashEmail(cleanEmail);
  const salt = crypto.randomUUID();
  const pwdHash = await hashPassword(password, salt);

  const account: Account = {
    id: crypto.randomUUID(),
    email: maskEmail(cleanEmail),
    emailHash,
    createdAt: Date.now(),
    lastSync: null,
    plan: 'free',
    settings: DEFAULT_SETTINGS,
  };

  // Stocker localement (hash + sel pour vérification)
  const storage = {
    account,
    auth: { emailHash, salt, pwdHash },
  };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(storage));

  currentAccount = account;
  isAuthenticated = true;

  // Sauvegarder l'état actuel comme première version
  await backupNow(password);
  return account;
}

/** Connexion. */
export async function login(email: string, password: string): Promise<Account> {
  const cleanEmail = email.toLowerCase().trim();
  const stored = localStorage.getItem(ACCOUNT_KEY);
  if (!stored) throw new Error('Aucun compte trouvé');

  const storage = JSON.parse(stored) as { account: Account; auth: { emailHash: string; salt: string; pwdHash: string } };
  const emailHash = await hashEmail(cleanEmail);
  if (emailHash !== storage.auth.emailHash) throw new Error('Email ou mot de passe incorrect');

  const pwdHash = await hashPassword(password, storage.auth.salt);
  if (pwdHash !== storage.auth.pwdHash) throw new Error('Email ou mot de passe incorrect');

  currentAccount = storage.account;
  isAuthenticated = true;
  return currentAccount;
}

/** Déconnexion (garde les données locales). */
export function logout(): void {
  currentAccount = null;
  isAuthenticated = false;
}

/** Supprime le compte et toutes les données. */
export async function deleteAccount(password: string): Promise<void> {
  if (!currentAccount) throw new Error('Pas de compte connecté');
  const stored = localStorage.getItem(ACCOUNT_KEY);
  if (!stored) throw new Error('Données manquantes');

  const storage = JSON.parse(stored);
  const pwdHash = await hashPassword(password, storage.auth.salt);
  if (pwdHash !== storage.auth.pwdHash) throw new Error('Mot de passe incorrect');

  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.removeItem(SYNC_KEY);
  currentAccount = null;
  isAuthenticated = false;
  generateAnonId(); // Nouveau mode anonyme
}

/** Masque l'email pour l'affichage. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local.length > 2 ? local[0] + '***'.slice(0, local.length - 1) : '***';
  return `${masked}@${domain}`;
}

/** Sauvegarde locale chiffrée (backup manuel). */
export async function backupNow(password?: string): Promise<string> {
  const data: SyncPayload = {
    version: 1,
    accountId: currentAccount?.id ?? generateAnonId(),
    timestamp: Date.now(),
    data: app.data,
    schemaVersion: 1,
  };
  const json = JSON.stringify(data);
  if (password && currentAccount?.settings.backupEncrypted) {
    return encryptData(json, password);
  }
  return json;
}

/** Restaure depuis une sauvegarde. */
export async function restoreBackup(backupJson: string, password?: string): Promise<void> {
  let json = backupJson;
  if (password) {
    try {
      json = await decryptData(backupJson, password);
    } catch {
      throw new Error('Mot de passe incorrect ou sauvegarde corrompue');
    }
  }
  const payload = JSON.parse(json) as SyncPayload;
  if (payload.schemaVersion !== 1) throw new Error('Version de sauvegarde non supportée');

  // Fusion intelligente : garde le plus récent pour chaque clé
  const merged = mergePersist(app.data, payload.data);
  app.data = merged;
  app.save();
}

/** Fusion de deux états Persist (garde le plus récent). */
function mergePersist(local: Persist, remote: Persist): Persist {
  const merged: Persist = {
    profile: remote.profile.xpTotal >= local.profile.xpTotal ? remote.profile : local.profile,
    cards: { ...local.cards },
    completed: { ...local.completed, ...remote.completed },
    history: { ...local.history },
    errors: [...local.errors, ...remote.errors],
  };
  // Cartes : garde la plus avancée (stabilité max)
  for (const [key, remoteCard] of Object.entries(remote.cards)) {
    const localCard = local.cards[key];
    if (!localCard || remoteCard.stability > localCard.stability) {
      merged.cards[key] = remoteCard;
    } else {
      merged.cards[key] = localCard;
    }
  }
  // Historique : somme par jour
  for (const [day, xp] of Object.entries(remote.history)) {
    merged.history[day] = Math.max(merged.history[day] ?? 0, xp);
  }
  return merged;
}

/** Sync cloud (stub — à connecter à votre backend : Firebase, Supabase, custom). */
export async function syncToCloud(): Promise<void> {
  if (!currentAccount || !currentAccount.settings.syncEnabled) return;
  if (syncStatus === 'syncing') return;

  syncStatus = 'syncing';
  lastError = null;

  try {
    const backup = await backupNow(); // Non chiffré pour le cloud (TLS assure la sécurité)
    // TODO: Remplacer par vrai appel API
    // await fetch('/api/sync', { method: 'POST', body: backup });
    
    // Simulation locale
    localStorage.setItem(SYNC_KEY, JSON.stringify({ timestamp: Date.now(), data: backup }));
    
    if (currentAccount) {
      currentAccount.lastSync = Date.now();
      saveAccount();
    }
    syncStatus = 'synced';
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'Erreur de synchronisation';
    syncStatus = 'error';
  }
}

/** Sync depuis le cloud. */
export async function syncFromCloud(): Promise<void> {
  if (!currentAccount || !currentAccount.settings.syncEnabled) return;
  if (syncStatus === 'syncing') return;

  syncStatus = 'syncing';
  lastError = null;

  try {
    // TODO: Remplacer par vrai appel API
    // const resp = await fetch('/api/sync');
    // const backup = await resp.text();
    
    const stored = localStorage.getItem(SYNC_KEY);
    if (!stored) throw new Error('Aucune sauvegarde cloud');
    
    const { data } = JSON.parse(stored);
    await restoreBackup(data);
    
    if (currentAccount) {
      currentAccount.lastSync = Date.now();
      saveAccount();
    }
    syncStatus = 'synced';
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'Erreur de synchronisation';
    syncStatus = 'error';
  }
}

function saveAccount(): void {
  if (!currentAccount) return;
  const stored = localStorage.getItem(ACCOUNT_KEY);
  const auth = stored ? JSON.parse(stored).auth : { emailHash: '', salt: '', pwdHash: '' };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ account: currentAccount, auth }));
}

/** Getters réactifs. */
export function getAccount(): Account | null { return currentAccount; }
export function getAuthState(): boolean { return isAuthenticated; }
export function getSyncStatus(): typeof syncStatus { return syncStatus; }
export function getLastError(): string | null { return lastError; }
export function isAnon(): boolean { return !isAuthenticated; }

/** Met à jour les réglages du compte. */
export function updateSettings(settings: Partial<AccountSettings>): void {
  if (!currentAccount) return;
  currentAccount.settings = { ...currentAccount.settings, ...settings };
  saveAccount();
}