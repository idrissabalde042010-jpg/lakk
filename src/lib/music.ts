// Musique & Karaoké — apprentissage par la chanson.
// Utilise des chansons du domaine public / Creative Commons + paroles synchronisées.

import { speak, cancelSpeech } from './audio';
import type { Vocab } from './engine';

export interface Song {
  id: string;
  title: string;
  artist: string;
  level: 'A1' | 'A2' | 'B1';
  duration: number; // secondes
  lyrics: LyricLine[];
  vocab: Vocab[]; // mots clés à apprendre
  audioUrl?: string; // optionnel : fichier audio local
  youtubeId?: string; // pour version future
}

export interface LyricLine {
  time: number; // début en secondes
  end: number;  // fin en secondes
  text: string; // paroles originales
  translation: string; // traduction FR
  words: WordTiming[]; // timing mot par mot pour karaoké
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

/** Chansons intégrées (domaine public / CC0) — paroles + traduction. */
export const SONGS: Song[] = [
  {
    id: 'happy_birthday',
    title: 'Happy Birthday',
    artist: 'Traditionnel',
    level: 'A1',
    duration: 20,
    vocab: [
      { en: 'happy', fr: 'heureux/joyeux' },
      { en: 'birthday', fr: 'anniversaire' },
      { en: 'dear', fr: 'cher/chère' },
    ],
    lyrics: [
      { time: 0, end: 4, text: 'Happy birthday to you', translation: 'Joyeux anniversaire à toi', words: [
        { word: 'Happy', start: 0, end: 1.2 },
        { word: 'birthday', start: 1.2, end: 2.5 },
        { word: 'to', start: 2.5, end: 3 },
        { word: 'you', start: 3, end: 4 },
      ]},
      { time: 4, end: 8, text: 'Happy birthday to you', translation: 'Joyeux anniversaire à toi', words: [
        { word: 'Happy', start: 4, end: 5.2 },
        { word: 'birthday', start: 5.2, end: 6.5 },
        { word: 'to', start: 6.5, end: 7 },
        { word: 'you', start: 7, end: 8 },
      ]},
      { time: 8, end: 12, text: 'Happy birthday dear friend', translation: 'Joyeux anniversaire cher ami', words: [
        { word: 'Happy', start: 8, end: 9.2 },
        { word: 'birthday', start: 9.2, end: 10.5 },
        { word: 'dear', start: 10.5, end: 11 },
        { word: 'friend', start: 11, end: 12 },
      ]},
      { time: 12, end: 16, text: 'Happy birthday to you', translation: 'Joyeux anniversaire à toi', words: [
        { word: 'Happy', start: 12, end: 13.2 },
        { word: 'birthday', start: 13.2, end: 14.5 },
        { word: 'to', start: 14.5, end: 15 },
        { word: 'you', start: 15, end: 16 },
      ]},
    ],
  },
  {
    id: 'twinkle_twinkle',
    title: 'Twinkle Twinkle Little Star',
    artist: 'Traditionnel',
    level: 'A1',
    duration: 30,
    vocab: [
      { en: 'twinkle', fr: 'briller/scintiller' },
      { en: 'little', fr: 'petit' },
      { en: 'star', fr: 'étoile' },
      { en: 'wonder', fr: 'se demander' },
      { en: 'what', fr: 'quoi' },
      { en: 'are', fr: 'sont/suis/es/est' },
      { en: 'up', fr: 'en haut' },
      { en: 'above', fr: 'au-dessus' },
      { en: 'world', fr: 'monde' },
      { en: 'high', fr: 'haut' },
      { en: 'sky', fr: 'ciel' },
    ],
    lyrics: [
      { time: 0, end: 5, text: 'Twinkle twinkle little star', translation: 'Brille brille petite étoile', words: [
        { word: 'Twinkle', start: 0, end: 1.2 },
        { word: 'twinkle', start: 1.2, end: 2.4 },
        { word: 'little', start: 2.4, end: 3.4 },
        { word: 'star', start: 3.4, end: 5 },
      ]},
      { time: 5, end: 10, text: 'How I wonder what you are', translation: 'Comme je me demande ce que tu es', words: [
        { word: 'How', start: 5, end: 5.8 },
        { word: 'I', start: 5.8, end: 6.2 },
        { word: 'wonder', start: 6.2, end: 7.5 },
        { word: 'what', start: 7.5, end: 8.2 },
        { word: 'you', start: 8.2, end: 8.8 },
        { word: 'are', start: 8.8, end: 10 },
      ]},
      { time: 10, end: 15, text: 'Up above the world so high', translation: 'Là-haut au-dessus du monde si haut', words: [
        { word: 'Up', start: 10, end: 10.8 },
        { word: 'above', start: 10.8, end: 11.8 },
        { word: 'the', start: 11.8, end: 12.2 },
        { word: 'world', start: 12.2, end: 13.2 },
        { word: 'so', start: 13.2, end: 13.8 },
        { word: 'high', start: 13.8, end: 15 },
      ]},
      { time: 15, end: 20, text: 'Like a diamond in the sky', translation: 'Comme un diamant dans le ciel', words: [
        { word: 'Like', start: 15, end: 15.8 },
        { word: 'a', start: 15.8, end: 16.1 },
        { word: 'diamond', start: 16.1, end: 17.5 },
        { word: 'in', start: 17.5, end: 17.9 },
        { word: 'the', start: 17.9, end: 18.2 },
        { word: 'sky', start: 18.2, end: 20 },
      ]},
      { time: 20, end: 25, text: 'Twinkle twinkle little star', translation: 'Brille brille petite étoile', words: [
        { word: 'Twinkle', start: 20, end: 21.2 },
        { word: 'twinkle', start: 21.2, end: 22.4 },
        { word: 'little', start: 22.4, end: 23.4 },
        { word: 'star', start: 23.4, end: 25 },
      ]},
      { time: 25, end: 30, text: 'How I wonder what you are', translation: 'Comme je me demande ce que tu es', words: [
        { word: 'How', start: 25, end: 25.8 },
        { word: 'I', start: 25.8, end: 26.2 },
        { word: 'wonder', start: 26.2, end: 27.5 },
        { word: 'what', start: 27.5, end: 28.2 },
        { word: 'you', start: 28.2, end: 28.8 },
        { word: 'are', start: 28.8, end: 30 },
      ]},
    ],
  },
  {
    id: 'head_shoulders',
    title: 'Head Shoulders Knees and Toes',
    artist: 'Traditionnel',
    level: 'A1',
    duration: 25,
    vocab: [
      { en: 'head', fr: 'tête' },
      { en: 'shoulders', fr: 'épaules' },
      { en: 'knees', fr: 'genoux' },
      { en: 'toes', fr: 'orteils' },
      { en: 'eyes', fr: 'yeux' },
      { en: 'ears', fr: 'oreilles' },
      { en: 'mouth', fr: 'bouche' },
      { en: 'nose', fr: 'nez' },
    ],
    lyrics: [
      { time: 0, end: 4, text: 'Head, shoulders, knees and toes', translation: 'Tête, épaules, genoux et orteils', words: [
        { word: 'Head', start: 0, end: 1 },
        { word: 'shoulders', start: 1, end: 2 },
        { word: 'knees', start: 2, end: 3 },
        { word: 'and', start: 3, end: 3.5 },
        { word: 'toes', start: 3.5, end: 4 },
      ]},
      { time: 4, end: 8, text: 'Knees and toes', translation: 'Genoux et orteils', words: [
        { word: 'Knees', start: 4, end: 5 },
        { word: 'and', start: 5, end: 5.5 },
        { word: 'toes', start: 5.5, end: 6 },
      ]},
      { time: 8, end: 12, text: 'Head, shoulders, knees and toes', translation: 'Tête, épaules, genoux et orteils', words: [
        { word: 'Head', start: 8, end: 9 },
        { word: 'shoulders', start: 9, end: 10 },
        { word: 'knees', start: 10, end: 11 },
        { word: 'and', start: 11, end: 11.5 },
        { word: 'toes', start: 11.5, end: 12 },
      ]},
      { time: 12, end: 16, text: 'Knees and toes', translation: 'Genoux et orteils', words: [
        { word: 'Knees', start: 12, end: 13 },
        { word: 'and', start: 13, end: 13.5 },
        { word: 'toes', start: 13.5, end: 14 },
      ]},
      { time: 16, end: 20, text: 'Eyes and ears and mouth and nose', translation: 'Yeux et oreilles et bouche et nez', words: [
        { word: 'Eyes', start: 16, end: 17 },
        { word: 'and', start: 17, end: 17.3 },
        { word: 'ears', start: 17.3, end: 18 },
        { word: 'and', start: 18, end: 18.3 },
        { word: 'mouth', start: 18.3, end: 19 },
        { word: 'and', start: 19, end: 19.3 },
        { word: 'nose', start: 19.3, end: 20 },
      ]},
      { time: 20, end: 25, text: 'Head, shoulders, knees and toes', translation: 'Tête, épaules, genoux et orteils', words: [
        { word: 'Head', start: 20, end: 21 },
        { word: 'shoulders', start: 21, end: 22 },
        { word: 'knees', start: 22, end: 23 },
        { word: 'and', start: 23, end: 23.5 },
        { word: 'toes', start: 23.5, end: 25 },
      ]},
    ],
  },
  {
    id: 'abc_song',
    title: 'The Alphabet Song (ABC)',
    artist: 'Traditionnel',
    level: 'A1',
    duration: 35,
    vocab: [
      { en: 'alphabet', fr: 'alphabet' },
      { en: 'letter', fr: 'lettre' },
      { en: 'sing', fr: 'chanter' },
      { en: 'with', fr: 'avec' },
      { en: 'me', fr: 'moi' },
    ],
    lyrics: [
      { time: 0, end: 6, text: 'A B C D E F G', translation: 'A B C D E F G', words: [
        { word: 'A', start: 0, end: 0.7 },
        { word: 'B', start: 0.7, end: 1.4 },
        { word: 'C', start: 1.4, end: 2.1 },
        { word: 'D', start: 2.1, end: 2.8 },
        { word: 'E', start: 2.8, end: 3.5 },
        { word: 'F', start: 3.5, end: 4.2 },
        { word: 'G', start: 4.2, end: 6 },
      ]},
      { time: 6, end: 12, text: 'H I J K L M N O P', translation: 'H I J K L M N O P', words: [
        { word: 'H', start: 6, end: 6.6 },
        { word: 'I', start: 6.6, end: 7.2 },
        { word: 'J', start: 7.2, end: 7.8 },
        { word: 'K', start: 7.8, end: 8.4 },
        { word: 'L', start: 8.4, end: 9 },
        { word: 'M', start: 9, end: 9.6 },
        { word: 'N', start: 9.6, end: 10.2 },
        { word: 'O', start: 10.2, end: 10.8 },
        { word: 'P', start: 10.8, end: 12 },
      ]},
      { time: 12, end: 18, text: 'Q R S T U V', translation: 'Q R S T U V', words: [
        { word: 'Q', start: 12, end: 13 },
        { word: 'R', start: 13, end: 14 },
        { word: 'S', start: 14, end: 15 },
        { word: 'T', start: 15, end: 16 },
        { word: 'U', start: 16, end: 17 },
        { word: 'V', start: 17, end: 18 },
      ]},
      { time: 18, end: 24, text: 'W X Y and Z', translation: 'W X Y et Z', words: [
        { word: 'W', start: 18, end: 19.5 },
        { word: 'X', start: 19.5, end: 20.5 },
        { word: 'Y', start: 20.5, end: 21.5 },
        { word: 'and', start: 21.5, end: 22 },
        { word: 'Z', start: 22, end: 24 },
      ]},
      { time: 24, end: 30, text: 'Now I know my ABCs', translation: 'Maintenant je connais mes ABC', words: [
        { word: 'Now', start: 24, end: 25 },
        { word: 'I', start: 25, end: 25.5 },
        { word: 'know', start: 25.5, end: 26.5 },
        { word: 'my', start: 26.5, end: 27 },
        { word: 'A', start: 27, end: 27.5 },
        { word: 'B', start: 27.5, end: 28 },
        { word: 'C', start: 28, end: 28.5 },
        { word: 's', start: 28.5, end: 30 },
      ]},
      { time: 30, end: 35, text: 'Next time won\'t you sing with me', translation: 'La prochaine fois, tu chanteras avec moi', words: [
        { word: 'Next', start: 30, end: 31 },
        { word: 'time', start: 31, end: 32 },
        { word: 'won\'t', start: 32, end: 33 },
        { word: 'you', start: 33, end: 33.5 },
        { word: 'sing', start: 33.5, end: 34 },
        { word: 'with', start: 34, end: 34.5 },
        { word: 'me', start: 34.5, end: 35 },
      ]},
    ],
  },
];

/** État du lecteur karaoké. */
export interface KaraokeState {
  song: Song | null;
  currentLine: number;
  currentWord: number;
  isPlaying: boolean;
  currentTime: number;
  showTranslation: boolean;
  speed: number; // 0.5, 0.75, 1, 1.25
}

/** Trouve la ligne courante selon le temps. */
export function getLineAtTime(song: Song, time: number): number {
  for (let i = 0; i < song.lyrics.length; i++) {
    if (time >= song.lyrics[i].time && time < song.lyrics[i].end) return i;
  }
  return Math.max(0, song.lyrics.length - 1);
}

/** Trouve le mot courant dans une ligne. */
export function getWordAtTime(line: LyricLine, time: number): number {
  for (let i = 0; i < line.words.length; i++) {
    if (time >= line.words[i].start && time < line.words[i].end) return i;
  }
  return -1;
}

/** Joue une ligne (TTS). */
export async function playLine(line: LyricLine): Promise<void> {
  await speak(line.text, 'en-US');
}

/** Joue un mot spécifique. */
export async function playWord(word: string): Promise<void> {
  await speak(word, 'en-US');
}

/** Formate le temps en mm:ss. */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}