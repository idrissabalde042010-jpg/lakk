// Contes du Baobab — histoires personnalisées générées localement.
// Chaque conte est un gabarit en ANGLAIS (langue cible du cours A1) avec des
// trous remplis par le vocabulaire anglais de l'utilisateur.
// Une traduction française est fournie pour chaque gabarit.
// Répartition des mots insérés : 60 % faibles, 30 % solides, 10 % nouveaux.

import type { Card, Vocab } from './engine';
import { mastery } from './engine';
import { shuffledIndices } from './shuffle';

export interface StoryTemplate {
  id: string;
  title: string; // titre anglais
  translation: string; // traduction française du sens
  /** Chaque trou est une clé : `{word}` remplacée par un mot anglais. */
  template: string;
  /** Nombre de mots à insérer. */
  slots: number;
}

export const STORY_TEMPLATES: readonly StoryTemplate[] = [
  {
    id: 'marche',
    title: 'At the market',
    translation: "Aujourd'hui je vais au marché. J'achète des objets. Le vendeur dit le prix. Je paie et je rentre à la maison.",
    template:
      "Today I go to the {place}. I buy {object1} and {object2}. The seller says: \"It is {price}!\" I pay and I go home.",
    slots: 4,
  },
  {
    id: 'famille',
    title: 'In the family',
    translation: "Ma {person1} et ma {person2} habitent dans une maison. Le {day} nous mangeons {food} ensemble. C'est {adjective}.",
    template:
      "My {person1} and my {person2} live in a {house}. On {day} we eat {food} together. It is {adjective}.",
    slots: 5,
  },
  {
    id: 'voyage',
    title: 'A trip',
    translation: "Je voyage en {transport} vers {place}. Je vois {object1} et {object2}. Je dis bonjour à {person1}. Le voyage est {adjective}.",
    template:
      "I travel by {transport} to {place}. I see {object1} and {object2}. I say hello to {person1}. The trip is {adjective}.",
    slots: 5,
  },
  {
    id: 'ecole',
    title: 'A day at school',
    translation: "Le {day} je vais à l'école avec {person1}. J'apprends {object1}. Le professeur est {adjective}. Je mange {food} à midi.",
    template:
      "On {day} I go to school with {person1}. I learn {object1}. The teacher is {adjective}. I eat {food} at noon.",
    slots: 5,
  },
  {
    id: 'maison',
    title: 'At home',
    translation: "Je suis chez moi dans la maison. Je bois {drink} et je mange {food}. {person1} lit un livre. C'est {adjective} ici.",
    template:
      "I am at home in the {house}. I drink {drink} and I eat {food}. {person1} reads a book. It is {adjective} here.",
    slots: 5,
  },
  {
    id: 'weekend',
    title: 'The weekend',
    translation: "Le {day} je reste à la maison. Je regarde {object1}. Je parle avec {person1}. Le temps est {adjective}.",
    template:
      "On {day} I stay at home. I watch {object1}. I talk with {person1}. The weather is {adjective}.",
    slots: 4,
  },
  {
    id: 'ville',
    title: 'In the city',
    translation: "Je marche dans la ville. Je vois {object1} et {object2}. Je demande le chemin à {person1}. La ville est {adjective}.",
    template:
      "I walk in the {place}. I see {object1} and {object2}. I ask the way to {person1}. The city is {adjective}.",
    slots: 5,
  },
  {
    id: 'restaurant',
    title: 'At the restaurant',
    translation: "Je vais au restaurant avec {person1}. Je commande {food} et {drink}. Le serveur est {adjective}. C'est {price}.",
    template:
      "I go to the {place} with {person1}. I order {food} and {drink}. The waiter is {adjective}. It is {price}.",
    slots: 5,
  },
  {
    id: 'soiree',
    title: 'An evening',
    translation: "Le {day} soir, {person1} et {person2} vont au {place}. Ils boivent {drink}. Ils rient. C'est {adjective}.",
    template:
      "On {day} evening, {person1} and {person2} go to the {place}. They drink {drink}. They laugh. It is {adjective}.",
    slots: 5,
  },
  {
    id: 'sport',
    title: 'Sport',
    translation: "Je fais du {sport} avec {person1}. C'est {adjective}. Je bois {drink} après. Le {day} nous gagnons.",
    template:
      "I do {sport} with {person1}. It is {adjective}. I drink {drink} after. On {day} we win.",
    slots: 4,
  },
  {
    id: 'temps',
    title: 'The weather',
    translation: "Aujourd'hui le temps est {adjective}. Je porte {object1}. Je vais à la {place}. {person1} est avec moi.",
    template:
      "Today the weather is {adjective}. I wear {object1}. I go to the {place}. {person1} is with me.",
    slots: 4,
  },
  {
    id: 'animaux',
    title: 'Animals',
    translation: "Au {place} je vois {object1} et {object2}. {person1} dit que c'est {adjective}. Je donne {food} à l'animal.",
    template:
      "At the {place} I see {object1} and {object2}. {person1} says it is {adjective}. I give {food} to the animal.",
    slots: 5,
  },
  {
    id: 'musique',
    title: 'Music',
    translation: "J'écoute {object1} avec {person1}. La chanson est {adjective}. Je chante toute la {day}.",
    template:
      "I listen to {object1} with {person1}. The song is {adjective}. I sing all {day}.",
    slots: 4,
  },
  {
    id: 'amitie',
    title: 'Friendship',
    translation: "{person1} et {person2} sont amis. Ils vont à la {place}. Ils parlent de {object1}. C'est {adjective}.",
    template:
      "{person1} and {person2} are friends. They go to the {place}. They talk about {object1}. It is {adjective}.",
    slots: 4,
  },
  {
    id: 'matin',
    title: 'Morning',
    translation: "Le {day} matin je me lève. Je bois {drink}. Je mange {food}. Je vais à la {place}. C'est {adjective}.",
    template:
      "On {day} morning I get up. I drink {drink}. I eat {food}. I go to the {place}. It is {adjective}.",
    slots: 5,
  },
  {
    id: 'nuit',
    title: 'Night',
    translation: "La {day} est finie. Je vais à la maison. Je dis bonne nuit à {person1}. Je dors. C'est {adjective}.",
    template:
      "The {day} is finished. I go home. I say good night to {person1}. I sleep. It is {adjective}.",
    slots: 4,
  },
  {
    id: 'vacances',
    title: 'Holidays',
    translation: "Pendant les {day} je vais à la {place} en {transport}. Je vois {object1}. {person1} est heureux. C'est {adjective}.",
    template:
      "During the {day} I go to the {place} by {transport}. I see {object1}. {person1} is happy. It is {adjective}.",
    slots: 5,
  },
  {
    id: 'cadeau',
    title: 'A gift',
    translation: "Je donne {object1} à {person1}. {person2} est content. C'est pour le {day}. Le cadeau est {adjective}.",
    template:
      "I give {object1} to {person1}. {person2} is happy. It is for {day}. The gift is {adjective}.",
    slots: 4,
  },
  {
    id: 'soin',
    title: 'Taking care of myself',
    translation: "Je bois {drink}. Je me lave à la maison. {person1} dit : « Tu es {adjective} ! ». Je me sens bien.",
    template:
      "I drink {drink}. I wash at home. {person1} says: \"You are {adjective}!\" I feel well.",
    slots: 4,
  },
  {
    id: 'shopping',
    title: 'Shopping',
    translation: "Je vais à la {place} pour acheter {object1}. Le prix est {price}. {person1} m'aide. C'est {adjective}.",
    template:
      "I go to the {place} to buy {object1}. The price is {price}. {person1} helps me. It is {adjective}.",
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

/** Génère un conte en remplissant les trous avec du vocabulaire anglais. */
export interface GeneratedStory {
  id: string;
  title: string;
  translation: string;
  text: string; // texte anglais avec les mots insérés
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
  const placeholderCount = (template.template.match(/\{[^}]+\}/g) ?? []).length;
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
    // Remplace le premier trou restant {word} par le mot anglais.
    text = text.replace(/\{[^}]+\}/, vocab.en);
  }

  return {
    id: template.id,
    title: template.title,
    translation: template.translation,
    text,
    words,
  };
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
