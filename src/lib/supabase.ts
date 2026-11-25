// Client Supabase pour Lakk
// Configuration via variables d'environnement (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
// Initialisation paresseuse : le client n'est créé que si les variables sont présentes

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseGetter = () => SupabaseClient | null;

let supabaseInstance: SupabaseClient | null = null;
let initError: Error | null = null;

/**
 * Vérifie si les variables d'environnement Supabase sont valides
 */
function isSupabaseConfigured(): boolean {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && key && url.startsWith('http'));
}

/**
 * Obtient l'instance singleton du client Supabase.
 * Retourne null si les variables d'environnement ne sont pas configurées.
 * Ne lève jamais d'exception.
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance !== null) {
    return supabaseInstance;
  }
  if (initError !== null) {
    return null;
  }
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Variables d\'environnement manquantes ou invalides (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY). Mode hors ligne activé.');
    return null;
  }
  try {
    supabaseInstance = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
    return supabaseInstance;
  } catch (e) {
    initError = e instanceof Error ? e : new Error(String(e));
    console.warn('[Supabase] Échec de l\'initialisation du client:', initError);
    return null;
  }
}

/**
 * Vérifie si Supabase est disponible (configuré et initialisable)
 */
export function isSupabaseAvailable(): boolean {
  return getSupabase() !== null;
}

/**
 * Réinitialise l'instance (pour les tests)
 */
export function resetSupabaseForTesting(): void {
  supabaseInstance = null;
  initError = null;
}

// Types pour la table matchmaking_queue
export interface MatchmakingQueueEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  status: 'waiting' | 'matched' | 'cancelled';
  matched_with: string | null;
  created_at: string;
  updated_at: string;
}

// Types pour les parties multijoueur
export interface MultiplayerMatch {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  round_number: number;
  current_turn: 'player1' | 'player2';
  status: 'active' | 'finished' | 'abandoned';
  winner_id: string | null;
  created_at: string;
  updated_at: string;
  // Données enrichies pour l'affichage
  player1_name?: string;
  player1_avatar?: string;
  player2_name?: string;
  player2_avatar?: string;
}

// Type pour un tour de jeu
export interface MatchRound {
  id: string;
  match_id: string;
  round_number: number;
  player1_answer: string | null;
  player2_answer: string | null;
  player1_correct: boolean | null;
  player2_correct: boolean | null;
  question: string;
  correct_answer: string;
  created_at: string;
}

/**
 * Rejoindre la file d'attente de matchmaking
 * Retourne null si Supabase n'est pas disponible
 */
export async function joinMatchmaking(userId: string, userName: string, userAvatar: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  
  const { data, error } = await client
    .from('matchmaking_queue')
    .insert({
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar,
      status: 'waiting',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Quitter la file d'attente
 * Retourne false si Supabase n'est pas disponible
 */
export async function leaveMatchmaking(queueId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  
  const { error } = await client
    .from('matchmaking_queue')
    .update({ status: 'cancelled' })
    .eq('id', queueId);

  if (error) throw error;
  return true;
}

/**
 * Chercher un adversaire (ou créer un match avec un bot après 5s)
 * Retourne null si Supabase n'est pas disponible ou personne trouvé
 */
export async function findMatch(queueId: string, userId: string): Promise<{ matchId: string; isBot: boolean } | null> {
  const client = getSupabase();
  if (!client) return null;
  
  // 1. Chercher un autre joueur en attente (pas nous-même)
  const { data: otherPlayers, error: searchError } = await client
    .from('matchmaking_queue')
    .select('id, user_id, user_name, user_avatar')
    .eq('status', 'waiting')
    .neq('user_id', userId)
    .limit(1);

  if (searchError) throw searchError;

  if (otherPlayers && otherPlayers.length > 0) {
    // Joueur trouvé ! Créer le match
    const opponent = otherPlayers[0];
    const matchId = await createMatch(userId, opponent.user_id);
    if (!matchId) return null;
    
    // Marquer les deux comme matched
    await client
      .from('matchmaking_queue')
      .update({ status: 'matched', matched_with: opponent.user_id })
      .eq('id', queueId);
    
    await client
      .from('matchmaking_queue')
      .update({ status: 'matched', matched_with: userId })
      .eq('id', opponent.id);

    return { matchId, isBot: false };
  }

  return null; // Personne trouvé, le caller décidera d'attendre ou de lancer un bot
}

/**
 * Créer un match multijoueur
 * Retourne null si Supabase n'est pas disponible
 */
export async function createMatch(player1Id: string, player2Id: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  
  const { data, error } = await client
    .from('multiplayer_matches')
    .insert({
      player1_id: player1Id,
      player2_id: player2Id,
      player1_score: 0,
      player2_score: 0,
      round_number: 0,
      current_turn: 'player1',
      status: 'active',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Créer un match contre un bot
 * Retourne null si Supabase n'est pas disponible
 */
export async function createBotMatch(userId: string, userName: string, userAvatar: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  
  // Créer un "utilisateur bot" virtuel
  const botId = `bot_${crypto.randomUUID()}`;
  
  const { data, error } = await client
    .from('multiplayer_matches')
    .insert({
      player1_id: userId,
      player2_id: botId,
      player1_score: 0,
      player2_score: 0,
      round_number: 0,
      current_turn: 'player1',
      status: 'active',
    })
    .select('id')
    .single();

  if (error) throw error;
  
  // Stocker les infos du bot pour l'affichage
  await client
    .from('bot_profiles')
    .upsert({
      bot_id: botId,
      name: 'Bot Lakk',
      avatar: '🤖',
      difficulty: 'normal',
    });

  return data.id;
}

/**
 * Récupérer un match avec les infos des joueurs
 * Retourne null si Supabase n'est pas disponible
 */
export async function getMatch(matchId: string): Promise<MultiplayerMatch | null> {
  const client = getSupabase();
  if (!client) return null;
  
  const { data, error } = await client
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

/**
 * S'abonner aux mises à jour d'un match (temps réel)
 * Retourne null si Supabase n'est pas disponible
 */
export function subscribeToMatch(matchId: string, callback: (payload: any) => void) {
  const client = getSupabase();
  if (!client) return null;
  
  return client
    .channel(`match:${matchId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'multiplayer_matches',
      filter: `id=eq.${matchId}`,
    }, callback)
    .subscribe();
}

/**
 * S'abonner aux rounds d'un match
 * Retourne null si Supabase n'est pas disponible
 */
export function subscribeToRounds(matchId: string, callback: (payload: any) => void) {
  const client = getSupabase();
  if (!client) return null;
  
  return client
    .channel(`rounds:${matchId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'match_rounds',
      filter: `match_id=eq.${matchId}`,
    }, callback)
    .subscribe();
}

/**
 * Jouer un tour (soumettre une réponse)
 * Retourne false si Supabase n'est pas disponible
 */
export async function submitRoundAnswer(
  matchId: string,
  roundNumber: number,
  playerId: string,
  answer: string,
  isCorrect: boolean
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  
  const { error } = await client
    .from('match_rounds')
    .insert({
      match_id: matchId,
      round_number: roundNumber,
      [`player${playerId === 'player1' ? '1' : '2'}_answer`]: answer,
      [`player${playerId === 'player1' ? '1' : '2'}_correct`]: isCorrect,
    });

  if (error) throw error;

  // Mettre à jour le score
  const scoreColumn = playerId === 'player1' ? 'player1_score' : 'player2_score';
  await client.rpc('increment_score', { match_id: matchId, score_column: scoreColumn });
  return true;
}

/**
 * Passer au tour suivant
 * Retourne false si Supabase n'est pas disponible
 */
export async function nextTurn(matchId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  
  const { data: match } = await client
    .from('multiplayer_matches')
    .select('current_turn, round_number')
    .eq('id', matchId)
    .single();

  if (!match) return false;

  const nextTurn = match.current_turn === 'player1' ? 'player2' : 'player1';
  const nextRound = match.current_turn === 'player2' ? match.round_number + 1 : match.round_number;

  await client
    .from('multiplayer_matches')
    .update({
      current_turn: nextTurn,
      round_number: nextRound,
    })
    .eq('id', matchId);
  return true;
}

/**
 * Terminer le match
 * Retourne false si Supabase n'est pas disponible
 */
export async function finishMatch(matchId: string, winnerId: string | null): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  
  await client
    .from('multiplayer_matches')
    .update({
      status: 'finished',
      winner_id: winnerId,
    })
    .eq('id', matchId);
  return true;
}