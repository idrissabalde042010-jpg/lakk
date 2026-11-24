// Bot pour le mode multijoueur de Lakk
// Simule un adversaire avec temps de réaction et taux de réussite configurables

import type { Vocab } from './engine';

export interface BotConfig {
  /** Temps de réaction min/max en millisecondes */
  reactionTimeMin: number;
  reactionTimeMax: number;
  /** Taux de réussite (0-1) */
  accuracy: number;
  /** Nom du bot */
  name: string;
  /** Avatar du bot */
  avatar: string;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  reactionTimeMin: 1500,
  reactionTimeMax: 3000,
  accuracy: 0.7,
  name: 'Bot Lakk',
  avatar: '🤖',
};

export interface BotMatchState {
  matchId: string;
  botId: string;
  config: BotConfig;
  currentRound: number;
  botScore: number;
  playerScore: number;
  isBotTurn: boolean;
  onBotAnswer: (answer: string, isCorrect: boolean) => void;
  onRoundEnd: (roundData: RoundResult) => void;
  onMatchEnd: (winner: 'bot' | 'player' | 'draw') => void;
}

export interface RoundResult {
  round: number;
  playerAnswer: string;
  playerCorrect: boolean;
  botAnswer: string;
  botCorrect: boolean;
  question: string;
  correctAnswer: string;
}

/**
 * Génère une réponse du bot (correcte ou non selon le taux de réussite)
 */
export function generateBotAnswer(
  question: string,
  correctAnswer: string,
  options: string[],
  accuracy: number
): { answer: string; isCorrect: boolean } {
  const roll = Math.random();
  
  if (roll < accuracy) {
    // Le bot répond correctement
    return { answer: correctAnswer, isCorrect: true };
  } else {
    // Le bot se trompe - choisir une mauvaise réponse
    const wrongOptions = options.filter(opt => opt !== correctAnswer);
    const wrongAnswer = wrongOptions.length > 0 
      ? wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
      : 'mauvaise réponse';
    return { answer: wrongAnswer, isCorrect: false };
  }
}

/**
 * Calcule le temps de réaction aléatoire du bot
 */
export function getBotReactionTime(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Classe pour gérer un match contre un bot
 */
export class BotMatch {
  private state: BotMatchState;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  constructor(state: BotMatchState) {
    this.state = state;
  }

  /**
   * Démarre le tour du bot
   */
  startBotTurn(
    question: string,
    correctAnswer: string,
    options: string[],
    playerAnswer: string,
    playerCorrect: boolean
  ): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Temps de réaction aléatoire
    const reactionTime = getBotReactionTime(
      this.state.config.reactionTimeMin,
      this.state.config.reactionTimeMax
    );

    // Génère la réponse du bot
    const { answer: botAnswer, isCorrect: botCorrect } = generateBotAnswer(
      question,
      correctAnswer,
      options,
      this.state.config.accuracy
    );

    // Simule le délai de réflexion
    this.timeoutId = setTimeout(() => {
      // Notifie la réponse du bot
      this.state.onBotAnswer(botAnswer, botCorrect);

      // Prépare le résultat du round
      const roundResult: RoundResult = {
        round: this.state.currentRound,
        playerAnswer,
        playerCorrect,
        botAnswer,
        botCorrect,
        question,
        correctAnswer,
      };

      // Met à jour les scores
      if (playerCorrect) this.state.playerScore++;
      if (botCorrect) this.state.botScore++;

      // Notifie la fin du round
      this.state.onRoundEnd(roundResult);

      // Vérifie si le match est fini (ex: 5 rounds)
      if (this.state.currentRound >= 5) {
        this.endMatch();
      } else {
        this.state.currentRound++;
        this.state.isBotTurn = false;
      }

      this.isRunning = false;
    }, reactionTime);
  }

  /**
   * Termine le match
   */
  private endMatch(): void {
    let winner: 'bot' | 'player' | 'draw' = 'draw';
    if (this.state.botScore > this.state.playerScore) winner = 'bot';
    else if (this.state.playerScore > this.state.botScore) winner = 'player';
    
    this.state.onMatchEnd(winner);
    this.isRunning = false;
  }

  /**
   * Arrête le bot (nettoyage)
   */
  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.isRunning = false;
  }
}

/**
 * Crée un bot avec configuration personnalisée
 */
export function createBot(config: Partial<BotConfig> = {}): BotConfig {
  return { ...DEFAULT_BOT_CONFIG, ...config };
}

/**
 * Niveaux de difficulté prédéfinis
 */
export const BOT_DIFFICULTIES = {
  easy: {
    name: 'Bot Facile',
    avatar: '🤖',
    reactionTimeMin: 2000,
    reactionTimeMax: 4000,
    accuracy: 0.5,
  },
  normal: {
    name: 'Bot Normal',
    avatar: '🤖',
    reactionTimeMin: 1500,
    reactionTimeMax: 3000,
    accuracy: 0.7,
  },
  hard: {
    name: 'Bot Difficile',
    avatar: '🤖',
    reactionTimeMin: 1000,
    reactionTimeMax: 2000,
    accuracy: 0.85,
  },
} as const;

export type BotDifficulty = keyof typeof BOT_DIFFICULTIES;