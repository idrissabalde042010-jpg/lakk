// Contenu pédagogique.
// - `defaultCourse` : copie locale embarquée dans le bundle web.
// - En application Tauri, le contenu vient de `lakk-core` (Rust) via
//   `nativeCourse()` : le Rust reste la source de vérité.
import raw from '../../content/fr-en-a1.json';
import type { CourseData, LessonData, Phrase } from './engine';

export const defaultCourse = raw as unknown as CourseData;

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
