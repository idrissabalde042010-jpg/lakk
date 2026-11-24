// Pont vers le cœur Rust (`lakk-core`) exposé par les commandes Tauri.
// Dans un navigateur simple, ces fonctions renvoient `null` : l'application
// utilise alors le miroir TypeScript de `engine.ts`.
import type { Card, CourseData, Grade } from './engine';

/** Vrai dans l'application Tauri (desktop, Android, iOS). */
export const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as object);

export interface NativeStats {
  units: number;
  lessons: number;
  exercises: number;
  words: number;
}

export interface NativeInfo {
  name: string;
  version: string;
  free: boolean;
  engine: string;
}

/** Import dynamique : la lib Tauri n'est chargée que dans l'app native. */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function nativeInfo(): Promise<NativeInfo | null> {
  if (!isTauri) return null;
  try {
    return await call<NativeInfo>('app_info');
  } catch {
    return null;
  }
}

/** Contenu A1 complet, servi par le cœur Rust. */
export async function nativeCourse(): Promise<CourseData | null> {
  if (!isTauri) return null;
  try {
    const json = await call<string>('course_json');
    return JSON.parse(json) as CourseData;
  } catch {
    return null;
  }
}

export async function nativeStats(): Promise<NativeStats | null> {
  if (!isTauri) return null;
  try {
    return await call<NativeStats>('course_stats');
  } catch {
    return null;
  }
}

/** Anomalies détectées dans le contenu (vide = tout va bien). */
export async function nativeValidate(): Promise<string[] | null> {
  if (!isTauri) return null;
  try {
    return await call<string[]>('validate_course');
  } catch {
    return null;
  }
}

/**
 * Replanifie une carte avec le planificateur FSRS de `lakk-core` (Rust).
 * Renvoie `null` si le pont natif n'est pas disponible ou échoue.
 */
export async function nativeReview(card: Card, grade: Grade, now = Date.now()): Promise<Card | null> {
  if (!isTauri) return null;
  try {
    return await call<Card>('review_card', { card, grade, now });
  } catch {
    return null;
  }
}
