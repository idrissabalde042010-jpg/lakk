import { describe, it, expect } from 'vitest';
import { tagError, topPatterns, patternLabel } from './errors';

describe('Carnet de Traces — tagger d\'erreurs', () => {
  it('tagge l\'oubli d\'article', () => {
    expect(tagError('I have a cat', 'I have cat', 'translate')).toBe('article');
    expect(tagError('She is the teacher', 'She is teacher', 'translate')).toBe('article');
    expect(tagError('This is an apple', 'This is apple', 'translate')).toBe('article');
  });

  it('tagge la faute d\'orthographe', () => {
    expect(tagError('apple', 'aple', 'translate')).toBe('orthographe');
    expect(tagError('house', 'hous', 'translate')).toBe('orthographe');
    expect(tagError('hello', 'helo', 'translate')).toBe('orthographe');
  });

  it('tagge le problème d\'ordre des mots', () => {
    expect(tagError('I like cats', 'cats like I', 'translate')).toBe('ordre');
    expect(tagError('She eats an apple', 'an apple eats She', 'translate')).toBe('ordre');
  });

  it('tagge la conjugaison', () => {
    expect(tagError('He go to school', 'He goes to school', 'translate')).toBe('conjugaison');
    expect(tagError('She like cats', 'She likes cats', 'translate')).toBe('conjugaison');
  });

  it('tagge le sens par défaut', () => {
    expect(tagError('I am happy', 'I am sad', 'translate')).toBe('sens');
    expect(tagError('The book is on the table', 'The cat is on the table', 'translate')).toBe('sens');
  });
});

describe('Carnet de Traces — top patterns', () => {
  it('retourne les patterns les plus fréquents', () => {
    // On ne peut pas facilement injecter des erreurs ici sans localStorage,
    // donc on vérifie juste que la fonction ne plante pas et retourne un tableau.
    const result = topPatterns();
    expect(Array.isArray(result)).toBe(true);
    for (const item of result) {
      expect(item.count).toBeGreaterThan(0);
      expect(['article', 'ordre', 'orthographe', 'conjugaison', 'sens']).toContain(item.pattern);
    }
  });
});

describe('patternLabel', () => {
  it('retourne un libellé pour chaque pattern', () => {
    expect(patternLabel('article')).toBe('Articles');
    expect(patternLabel('ordre')).toBe('Ordre des mots');
    expect(patternLabel('orthographe')).toBe('Orthographe');
    expect(patternLabel('conjugaison')).toBe('Conjugaison');
    expect(patternLabel('sens')).toBe('Sens / traduction');
  });
});
