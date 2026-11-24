// Contenu pédagogique.
// - `defaultCourse` : copie locale embarquée dans le bundle web (fr-en par défaut).
// - `loadCourse(sourceLang, targetLang)` : charge dynamiquement le JSON pour la paire de langues.
// - En application Tauri, le contenu vient de `lakk-core` (Rust) via
//   `nativeCourse()` : le Rust reste la source de vérité.
import defaultRaw from '../../content/fr-en-a1.json';
import type { CourseData, LessonData, Phrase } from './engine';

export const defaultCourse = defaultRaw as unknown as CourseData;

export interface LessonRef {
  u: number;
  l: number;
  data: LessonData;
  unitTitle: string;
  unitColor?: string;
}

/** Toutes les leçons à plat, dans l'ordre du parcours. */
export function lessonRefs(course: CourseData): LessonRef[] {
  return course.units.flatMap((unit, u) =>
    unit.lessons.map((data, l) => ({
      u,
      l,
      data,
      unitTitle: unit.title,
      unitColor: unit.color,
    })),
  );
}

/** Phrases de repli (utilisées si le cours n'en fournit pas). */
export const fallbackPhrases: Phrase[] = [
  {
    en: 'How are you today?',
    fr: 'Comment vas-tu aujourd’hui ?',
    tip: 'Réponds : “I’m fine, thank you!”',
  },
];

/** Construit le chemin du fichier de contenu selon les langues. */
function contentPath(sourceLang: string, targetLang: string): string {
  return `../../content/${sourceLang}-${targetLang}-a1.json`;
}

/**
 * Charge le cours pour une paire de langues donnée.
 * Retourne le cours par défaut (fr-en) en cas d'échec.
 */
export async function loadCourse(sourceLang: string, targetLang: string): Promise<CourseData> {
  // Normalise les codes de langue (minuscules)
  const src = sourceLang.toLowerCase();
  const tgt = targetLang.toLowerCase();

  // Si c'est la paire par défaut, retourne la version embarquée (build-time)
  if (src === 'fr' && tgt === 'en') {
    return defaultCourse;
  }

  try {
    // Import dynamique : Vite va créer un chunk séparé pour chaque paire de langues
    const module = await import(/* @vite-ignore */ contentPath(src, tgt));
    return (module.default ?? module) as unknown as CourseData;
  } catch (err) {
    console.warn(`[content] Impossible de charger ${src}-${tgt}-a1.json, utilisation de fr-en par défaut :`, err);
    return defaultCourse;
  }
}
