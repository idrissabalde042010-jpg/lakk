// Client Supabase pour Lakk
// Configuration via variables d'environnement (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variables d\'environnement manquantes (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

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
 */
export async function joinMatchmaking(userId: string, userName: string, userAvatar: string): Promise<string> {
  const { data, error } = await supabase
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
 */
export async function leaveMatchmaking(queueId: string): Promise<void> {
  const { error } = await supabase
    .from('matchmaking_queue')
    .update({ status: 'cancelled' })
    .eq('id', queueId);

  if (error) throw error;
}

/**
 * Chercher un adversaire (ou créer un match avec un bot après 5s)
 */
export async function findMatch(queueId: string, userId: string): Promise<{ matchId: string; isBot: boolean } | null> {
  // 1. Chercher un autre joueur en attente (pas nous-même)
  const { data: otherPlayers, error: searchError } = await supabase
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
    
    // Marquer les deux comme matched
    await supabase
      .from('matchmaking_queue')
      .update({ status: 'matched', matched_with: opponent.user_id })
      .eq('id', queueId);
    
    await supabase
      .from('matchmaking_queue')
      .update({ status: 'matched', matched_with: userId })
      .eq('id', opponent.id);

    return { matchId, isBot: false };
  }

  return null; // Personne trouvé, le caller décidera d'attendre ou de lancer un bot
}

/**
 * Créer un match multijoueur
 */
export async function createMatch(player1Id: string, player2Id: string): Promise<string> {
  const { data, error } = await supabase
    .from('multiplayer_matches')
    .insert({
      player1_id: player1Id,
      player2_id: player2Id,
      player1_score: 0,
      player2_score: 0,
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
 */
export async function createBotMatch(userId: string, userName: string, userAvatar: string): Promise<string> {
  // Créer un "utilisateur bot" virtuel
  const botId = `bot_${crypto.randomUUID()}`;
  
  const { data, error } = await supabase
    .from('multiplayer_matches')
    .insert({
      player1_id: userId,
      player2_id: botId,
      player1_score: 0,
      player2_score: 0,
      current_turn: 'player1',
      status: 'active',
    })
    .select('id')
    .single();

  if (error) throw error;
  
  // Stocker les infos du bot pour l'affichage
  await supabase
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
 */
export async function getMatch(matchId: string): Promise<MultiplayerMatch | null> {
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

/**
 * S'abonner aux mises à jour d'un match (temps réel)
 */
export function subscribeToMatch(matchId: string, callback: (payload: any) => void) {
  return supabase
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
 */
export function subscribeToRounds(matchId: string, callback: (payload: any) => void) {
  return supabase
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
 */
export async function submitRoundAnswer(
  matchId: string,
  roundNumber: number,
  playerId: string,
  answer: string,
  isCorrect: boolean
): Promise<void> {
  const { error } = await supabase
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
  await supabase.rpc('increment_score', { match_id: matchId, score_column: scoreColumn });
}

/**
 * Passer au tour suivant
 */
export async function nextTurn(matchId: string): Promise<void> {
  const { data: match } = await supabase
    .from('multiplayer_matches')
    .select('current_turn, round_number')
    .eq('id', matchId)
    .single();

  if (!match) return;

  const nextTurn = match.current_turn === 'player1' ? 'player2' : 'player1';
  const nextRound = match.current_turn === 'player2' ? match.round_number + 1 : match.round_number;

  await supabase
    .from('multiplayer_matches')
    .update({
      current_turn: nextTurn,
      round_number: nextRound,
    })
    .eq('id', matchId);
}

/**
 * Terminer le match
 */
export async function finishMatch(matchId: string, winnerId: string | null): Promise<void> {
  await supabase
    .from('multiplayer_matches')
    .update({
      status: 'finished',
      winner_id: winnerId,
    })
    .eq('id', matchId);
}