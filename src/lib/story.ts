// Contes du Baobab — histoires personnalisées générées localement.
// Chaque conte est un gabarit avec des trous remplis par le vocabulaire de l'utilisateur.
// Répartition des mots insérés : 60 % faibles, 30 % solides, 10 % nouveaux.

import type { Card, Vocab } from './engine';
import { mastery, newCard } from './engine';
import { shuffledIndices } from './shuffle';

export interface StoryTemplate {
  id: string;
  title: string;
  /** Chaque trou est une clé : `{{cle}}` remplacée par un mot. */
  template: string;
  /** Nombre de mots à insérer. */
  slots: number;
}

export const STORY_TEMPLATES: readonly StoryTemplate[] = [
  {
    id: 'marche',
    title: 'Au marché',
    template:
      "Aujourd'hui je vais au {{lieu}}. J'achète {{objet1}} et {{objet2}}. Le vendeur dit : « C'est {{prix}} ! » Je paie et je rentre à la {{maison}}.",
    slots: 4,
  },
  {
    id: 'famille',
    title: 'En famille',
    template:
      "Ma {{personne1}} et ma {{personne2}} habitent dans une {{maison}}. Le {{jour}} nous mangeons {{nourriture}} ensemble. C'est {{adjectif}}.",
    slots: 5,
  },
  {
    id: 'voyage',
    title: 'Un voyage',
    template:
      "Je pars en {{transport}} vers {{lieu}}. Je vois {{objet1}} et {{objet2}}. Je dis bonjour à {{personne1}}. Le voyage est {{adjectif}}.",
    slots: 5,
  },
  {
    id: 'ecole',
    title: 'Une journée à l’école',
    template:
      "Le {{jour}} je vais à l’école avec {{personne1}}. J'apprends {{objet1}}. Le professeur est {{adjectif}}. Je mange {{nourriture}} à midi.",
    slots: 5,
  },
  {
    id: 'maison',
    title: 'À la maison',
    template:
      "Je suis chez moi dans la {{maison}}. Je bois {{boisson}} et je mange {{nourriture}}. {{personne1}} lit un livre. C'est {{adjectif}} ici.",
    slots: 5,
  },
  {
    id: 'weekend',
    title: 'Le week-end',
    template:
      "Le {{jour}} je reste à la {{maison}}. Je regarde {{objet1}}. Je parle avec {{personne1}}. Le temps est {{adjectif}}.",
    slots: 4,
  },
  {
    id: 'ville',
    title: 'Dans la ville',
    template:
      "Je marche dans {{lieu}}. Je vois {{objet1}} et {{objet2}}. Je demande le chemin à {{personne1}}. La ville est {{adjectif}}.",
    slots: 5,
  },
  {
    id: 'restaurant',
    title: 'Au restaurant',
    template:
      "Je vais au {{lieu}} avec {{personne1}}. Je commande {{nourriture}} et {{boisson}}. Le serveur est {{adjectif}}. C'est {{prix}}.",
    slots: 5,
  },
  {
    id: 'soiree',
    title: 'Une soirée',
    template:
      "Le {{jour}} soir, {{personne1}} et {{personne2}} vont au {{lieu}}. Ils boivent {{boisson}}. Ils rient. C'est {{adjectif}}.",
    slots: 5,
  },
  {
    id: 'sport',
    title: 'Le sport',
    template:
      "Je fais du {{sport}} avec {{personne1}}. C'est {{adjectif}}. Je bois {{boisson}} après. Le {{jour} nous gagnons.",
    slots: 4,
  },
  {
    id: 'temps',
    title: 'Le temps qu’il fait',
    template:
      "Aujourd’hui le temps est {{adjectif}}. Je porte {{objet1}}. Je vais à {{lieu}}. {{personne1}} est avec moi.",
    slots: 4,
  },
  {
    id: 'animaux',
    title: 'Les animaux',
    template:
      "À {{lieu}} je vois {{objet1}} et {{objet2}}. {{personne1}} dit que c'est {{adjectif}}. Je donne {{nourriture}} à l'animal.",
    slots: 5,
  },
  {
    id: 'musique',
    title: 'La musique',
    template:
      "J'écoute {{objet1}} avec {{personne1}}. La chanson est {{adjectif}}. Je chante toute la {{journee}}.",
    slots: 4,
  },
  {
    id: 'amitie',
    title: 'L’amitié',
    template:
      "{{personne1}} et {{personne2}} sont amis. Ils vont à {{lieu}}. Ils parlent de {{objet1}}. C'est {{adjectif}}.",
    slots: 4,
  },
  {
    id: 'matin',
    title: 'Le matin',
    template:
      "Le {{jour}} matin je me lève. Je bois {{boisson}}. Je mange {{nourriture}}. Je vais à {{lieu}}. C'est {{adjectif}}.",
    slots: 5,
  },
  {
    id: 'nuit',
    title: 'La nuit',
    template:
      "La {{journee}} est finie. Je vais à la {{maison}}. Je dis bonne nuit à {{personne1}}. Je dors. C'est {{adjectif}}.",
    slots: 4,
  },
  {
    id: 'vacances',
    title: 'Les vacances',
    template:
      "Pendant les {{journee}} je vais à {{lieu}} en {{transport}}. Je vois {{objet1}}. {{personne1}} est heureux. C'est {{adjectif}}.",
    slots: 5,
  },
  {
    id: 'cadeau',
    title: 'Un cadeau',
    template:
      "Je donne {{objet1}} à {{personne1}}. {{personne2}} est content. C'est pour le {{jour}}. Le cadeau est {{adjectif}}.",
    slots: 4,
  },
  {
    id: 'soin',
    title: 'Prendre soin de soi',
    template:
      "Je bois {{boisson}}. Je me lave à la {{maison}}. {{personne1}} dit : « Tu es {{adjectif}} ! ». Je me sens bien.",
    slots: 4,
  },
  {
    id: 'shopping',
    title: 'Faire du shopping',
    template:
      "Je vais au {{lieu}} pour acheter {{objet1}}. Le prix est {{prix}}. {{personne1}} m'aide. C'est {{adjectif}}.",
    slots: 4,
  },
];

/** Catégorie de sélection d’un mot pour un trou. */
type WordPick = 'weak' | 'solid' | 'new';

/** Tire un nombre de mots selon la répartition 60/30/10. */
export function pickDistribution(slots: number): WordPick[] {
  const nWeak = Math.round(slots * 0.6);
  const nSolid = Math.round(slots * 0.3);
  const nNew = slots - nWeak - nSolid;
  const picks: WordPick[] = [];
  for (let i = 0; i < nWeak; i++) picks.push('weak');
  for (let i = 0; i < nSolid; i++) picks.push('solid');
  for (let i = 0; i < nNew; i++) picks.push('new');
  return shuffledIndices(picks.length).map((i) => picks[i]);
}

/** Génère un conte en remplissant les trous avec du vocabulaire. */
export interface GeneratedStory {
  id: string;
  title: string;
  text: string; // texte avec les mots insérés
  words: Vocab[]; // mots utilisés (dans l'ordre des trous)
}

export function generateStory(
  templateId: string,
  cards: Card[],
  newWords: Vocab[],
): GeneratedStory | undefined {
  const template = STORY_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return undefined;

  const weak = cards.filter((c) => c.state !== 'new' && mastery(c).pct < 70);
  const solid = cards.filter((c) => c.state !== 'new' && mastery(c).pct >= 70);

  // Nombre de trous réels dans le gabarit.
  const placeholderCount = (template.template.match(/\{\{[^}]+\}\}/g) ?? []).length;
  const picks = pickDistribution(placeholderCount);
  const usedWeak = [...weak];
  const usedSolid = [...solid];
  const usedNew = [...newWords];

  const words: Vocab[] = [];
  let text = template.template;

  for (const pick of picks) {
    let vocab: Vocab | null = null;
    if (pick === 'weak' && usedWeak.length > 0) {
      vocab = usedWeak.shift()!.vocab;
    } else if (pick === 'solid' && usedSolid.length > 0) {
      vocab = usedSolid.shift()!.vocab;
    } else if (pick === 'new' && usedNew.length > 0) {
      vocab = usedNew.shift()!;
    } else if (usedWeak.length > 0) {
      vocab = usedWeak.shift()!.vocab;
    } else if (usedSolid.length > 0) {
      vocab = usedSolid.shift()!.vocab;
    } else if (usedNew.length > 0) {
      vocab = usedNew.shift()!;
    } else {
      // Aucun mot disponible : on remplit avec un mot générique.
      vocab = { en: 'thing', fr: 'chose' };
    }
    words.push(vocab);
    // Remplace le premier trou restant {{cle}} par le mot (anglais affiché).
    text = text.replace(/\{\{[^}]+\}\}/, vocab.en);
  }

  return { id: template.id, title: template.title, text, words };
}

/** Génère le « conte du jour » : tirage déterministe par date. */
export function storyOfTheDay(
  cards: Card[],
  newWords: Vocab[],
  now = Date.now(),
): GeneratedStory | undefined {
  const day = Math.floor(now / 86_400_000);
  const template = STORY_TEMPLATES[day % STORY_TEMPLATES.length];
  return generateStory(template.id, cards, newWords);
}

/** Mots « nouveaux » : jamais révisés (état new), jusqu’à 6. */
export function newVocab(cards: Card[], limit = 6): Vocab[] {
  return cards
    .filter((c) => c.state === 'new')
    .slice(0, limit)
    .map((c) => c.vocab);
}
