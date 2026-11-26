// Carnet de Traces — journalisation et catégorisation des erreurs.
// Enregistre chaque mauvaise réponse, la tague par pattern,
// et permet de générer des exercices ciblés (drills).

import type { Vocab } from './engine';

export type ErrorPattern = 'article' | 'ordre' | 'orthographe' | 'conjugaison' | 'sens';

export interface ErrorEntry {
  /** Identifiant stable de l'erreur (timestamp + index). */
  id: string;
  /** Prompt de l'exercice d'origine. */
  prompt: string;
  /** Réponse attendue. */
  expected: string;
  /** Réponse donnée par l'utilisateur. */
  given: string;
  /** Type d'exercice. */
  kind: string;
  /** Date YYYY-MM-DD. */
  date: string;
  /** Pattern détecté. */
  pattern: ErrorPattern;
}

const ERROR_KEY = 'lakk.errors.v1';
const MAX_ERRORS = 500;

/** Mot clés anglais pour détecter un oubli d'article. */
const ARTICLES = ['a', 'an', 'the'];

/** Tague une erreur selon des patterns simples de comparaison attendu/donné. */
export function tagError(
  expected: string,
  given: string,
  kind: string,
): ErrorPattern {
  const normExpected = expected.trim().toLowerCase();
  const normGiven = given.trim().toLowerCase();

  // --- Article : l'un contient un article, l'autre non, ou articles diffèrent ---
  if (hasArticleDiff(normExpected, normGiven)) return 'article';

  // --- Conjugaison : même radical mais terminaison verbe différente ---
  if (isConjugationDiff(normExpected, normGiven)) return 'conjugaison';

  // --- Ordre : mêmes mots, ordre différent ---
  if (isWordOrderDiff(normExpected, normGiven)) return 'ordre';

  // --- Orthographe : très proche (quelques caractères de diff) ---
  if (isCloseSpell(normExpected, normGiven)) return 'orthographe';

  // --- Par défaut : erreur de sens / traduction ---
  return 'sens';
}

/** Vérifie si deux chaînes sont orthographiquement proches (faute de frappe mineure).
 * Ne s'applique que aux chaînes courtes ou à une distance absolue très faible,
 * pour éviter de confondre un mot différent avec une faute d'orthographe
 * dans une longue phrase. */
function isCloseSpell(a: string, b: string): boolean {
  if (a === b) return false;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > 2) return false;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(lenA, lenB);
  // Distance absolue <= 2 (faute de frappe sur un mot court)
  if (dist <= 2) return true;
  // Pour les chaînes courtes, tolère une distance relative faible
  if (maxLen <= 12 && dist / maxLen <= 0.3) return true;
  return false;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j] + 1, // suppression
        dp[i]![j - 1] + 1, // insertion
        dp[i - 1]![j - 1] + cost, // substitution
      );
    }
  }
  return dp[m]![n]!;
}

/** Détecte une différence d'article entre attendu et donné. */
function hasArticleDiff(a: string, b: string): boolean {
  const articlesA = extractArticles(a);
  const articlesB = extractArticles(b);
  // Si l'un a un article et l'autre non, ou qu'ils diffèrent.
  if (articlesA.length === 0 && articlesB.length === 0) return false;
  if (articlesA.length !== articlesB.length) return true;
  for (let i = 0; i < articlesA.length; i++) {
    if (articlesA[i] !== articlesB[i]) return true;
  }
  return false;
}

function extractArticles(s: string): string[] {
  const words = s.split(/\s+/);
  return words.filter((w) => ARTICLES.includes(w));
}

/** Détecte une différence de conjugaison (même sujet, verbe différent). */
function isConjugationDiff(a: string, b: string): boolean {
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  if (wordsA.length !== wordsB.length || wordsA.length < 2) return false;
  // Si tous les mots sont identiques sauf un verbe courant, c'est peut-être conjugaison.
  const diffs = wordsA.filter((w, i) => w !== wordsB[i]);
  if (diffs.length === 1) {
    const verbList = [
      'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did',
      'go', 'goes', 'went', 'go',
      'like', 'likes', 'liked',
      'eat', 'eats', 'ate',
      'drink', 'drinks', 'drank',
      'speak', 'speaks', 'spoke',
    ];
    return verbList.some((v) => diffs[0].includes(v));
  }
  return false;
}

/** Détecte un problème d'ordre des mots (mêmes mots, ordre différent). */
function isWordOrderDiff(a: string, b: string): boolean {
  const wa = a.split(/\s+/).filter(Boolean).sort();
  const wb = b.split(/\s+/).filter(Boolean).sort();
  if (wa.length !== wb.length || wa.length < 3) return false;
  // Mêmes mots mais ordre différent
  const sameWords = wa.every((w, i) => w === wb[i]);
  return sameWords && a !== b;
}

/** Lecture des erreurs stockées. */
export function loadErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(ERROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ErrorEntry[];
  } catch {
    return [];
  }
}

/** Écrit la liste complète des erreurs. */
function saveErrors(errors: ErrorEntry[]): void {
  try {
    localStorage.setItem(ERROR_KEY, JSON.stringify(errors));
  } catch {
    /* stockage indisponible */
  }
}

/** Enregistre une nouvelle erreur (dédupliquée par id, bornée à MAX_ERRORS). */
export function recordError(entry: Omit<ErrorEntry, 'id'>): ErrorEntry {
  const errors = loadErrors();
  const full: ErrorEntry = {
    ...entry,
    id: `${entry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  errors.unshift(full);
  if (errors.length > MAX_ERRORS) errors.length = MAX_ERRORS;
  saveErrors(errors);
  return full;
}

/** Retourne les erreurs triées du plus récent au plus ancien. */
export function getErrors(): ErrorEntry[] {
  return loadErrors();
}

/** Compte les occurrences par pattern. */
export function errorsByPattern(): Record<ErrorPattern, number> {
  const counts: Record<ErrorPattern, number> = {
    article: 0,
    ordre: 0,
    orthographe: 0,
    conjugaison: 0,
    sens: 0,
  };
  for (const e of getErrors()) {
    counts[e.pattern] = (counts[e.pattern] ?? 0) + 1;
  }
  return counts;
}

/** Top N des patterns les plus fréquents, triés par fréquence décroissante. */
export function topPatterns(limit = 3): Array<{ pattern: ErrorPattern; count: number }> {
  const counts = errorsByPattern();
  return Object.entries(counts)
    .map(([pattern, count]) => ({ pattern: pattern as ErrorPattern, count }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Libellé lisible d'un pattern. */
export function patternLabel(pattern: ErrorPattern): string {
  const labels: Record<ErrorPattern, string> = {
    article: 'Articles',
    ordre: 'Ordre des mots',
    orthographe: 'Orthographe',
    conjugaison: 'Conjugaison',
    sens: 'Sens / traduction',
  };
  return labels[pattern];
}

/** Message pédagogique associé à un pattern. */
export function patternMessage(pattern: ErrorPattern): string {
  const messages: Record<ErrorPattern, string> = {
    article: "Tu oublies souvent les articles (a, an, the).",
    ordre: "L'ordre des mots dans la phrase n'est pas encore naturel.",
    orthographe: "Quelques fautes d'orthographe à corriger.",
    conjugaison: "Le temps du verbe pose parfois problème.",
    sens: "Le sens de la phrase n'est pas encore tout à fait clair.",
  };
  return messages[pattern];
}
